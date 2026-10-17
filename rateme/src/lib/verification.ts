import 'server-only';
import dns from 'node:dns/promises';
import net from 'node:net';
import { sql } from './db';
import type { Tx } from './db';
import { env } from './env';
import { audit } from './audit';
import { sendEmail, templates } from './email';
import { randomToken } from './util';

export async function isContested(businessId: string, userId: string): Promise<boolean> {
  const [r] = await sql`select 1 from business_members where business_id = ${businessId} and user_id <> ${userId} and status = 'verified'`;
  return !!r;
}

export async function getOrCreateChallenge(businessId: string, memberId: string, userId: string, method: 'dns_txt' | 'website_file', domain: string) {
  const [existing] = await sql<{ id: string; challenge: string }[]>`
    select id, challenge from verification_requests
    where member_id = ${memberId} and method = ${method} and status = 'pending' and target = ${domain} order by created_at desc limit 1`;
  if (existing) return existing;
  const challenge = randomToken(18);
  const [row] = await sql<{ id: string; challenge: string }[]>`
    insert into verification_requests (business_id, member_id, user_id, method, target, challenge)
    values (${businessId}, ${memberId}, ${userId}, ${method}, ${domain}, ${challenge}) returning id, challenge`;
  return row;
}

/** Approve a membership: the single place where "ownership verified" is granted. */
export async function approveMembership(tx: Tx, opts: { memberId: string; requestId?: string | null; actorId: string | null; method: string; notes?: string | null }) {
  const [m] = await tx<{ business_id: string; user_id: string }[]>`
    update business_members set status = 'verified', verified_at = now() where id = ${opts.memberId} and status = 'pending'
    returning business_id, user_id`;
  if (!m) return null;
  await tx`update businesses set ownership_verified_at = coalesce(ownership_verified_at, now()),
             status = case when status = 'pending' then 'published' else status end,
             published_at = case when status = 'pending' then now() else published_at end, updated_at = now()
           where id = ${m.business_id}`;
  if (opts.requestId) {
    await tx`update verification_requests set status = 'approved', decided_at = now(), decided_by = ${opts.actorId}, decision_notes = ${opts.notes ?? null} where id = ${opts.requestId}`;
  }
  await tx`update verification_requests set status = 'expired' where member_id = ${opts.memberId} and status = 'pending'`;
  await audit(opts.actorId ?? m.user_id, 'business.ownership_verified', 'business', m.business_id, { method: opts.method, member: opts.memberId }, tx);
  const [info] = await tx<{ email: string; name: string }[]>`select u.email, b.name from users u, businesses b where u.id = ${m.user_id} and b.id = ${m.business_id}`;
  return { ...m, ...info };
}

export async function notifyVerification(email: string, businessName: string, businessId: string, approved: boolean, notes: string | null) {
  const link = approved ? `${env.appUrl}/dashboard/b/${businessId}/membership` : `${env.appUrl}/dashboard/b/${businessId}/verify`;
  await sendEmail({ to: email, template: 'verification_decision', ...templates.verificationDecision(businessName, approved, notes, link) });
}

// ── Domain checks (SSRF-safe) ──────────────────────────────────────────────────
function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const l = ip.toLowerCase();
  return l === '::1' || l.startsWith('fc') || l.startsWith('fd') || l.startsWith('fe80') || l.startsWith('::ffff:') || l === '::';
}

export function validDomain(d: string | null): d is string {
  return !!d && /^(?=.{4,253}$)([a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,24}$/.test(d);
}

export async function checkDnsTxt(domain: string, challenge: string): Promise<boolean> {
  if (!validDomain(domain)) return false;
  try {
    const records = await dns.resolveTxt(domain);
    return records.some((parts) => parts.join('').trim() === `rateme-verification=${challenge}`);
  } catch {
    return false;
  }
}

export async function checkWebsiteFile(domain: string, challenge: string): Promise<boolean> {
  if (!validDomain(domain)) return false;
  try {
    const addrs = await dns.lookup(domain, { all: true });
    if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) return false;
    for (const host of [domain, `www.${domain}`]) {
      const r = await fetch(`https://${host}/.well-known/rateme-verification.txt`, { redirect: 'manual', signal: AbortSignal.timeout(5000), headers: { 'User-Agent': 'RateMe.ie-verification/1.0' } }).catch(() => null);
      if (r && r.ok) {
        const text = (await r.text()).slice(0, 1000);
        if (text.includes(challenge)) return true;
      }
    }
  } catch { /* fall through */ }
  return false;
}
