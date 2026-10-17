'use server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { env } from '@/lib/env';
import { loadBusinessCtx } from '@/lib/dashboard';
import { approveMembership, checkDnsTxt, checkWebsiteFile, isContested, notifyVerification, validDomain } from '@/lib/verification';
import { createToken } from '@/lib/tokens';
import { sendEmail, templates } from '@/lib/email';
import { rateLimit } from '@/lib/security';
import { audit } from '@/lib/audit';
import { FREE_EMAIL_DOMAINS, emailDomain } from '@/lib/util';

const back = (id: string, k: 'msg' | 'err', m: string) => `/dashboard/b/${id}/verify?${k}=${encodeURIComponent(m)}`;

async function ctxFor(form: FormData) {
  const id = String(form.get('id') ?? '');
  const ctx = await loadBusinessCtx(id, `/dashboard/b/${id}/verify`, { allowPending: true });
  if (ctx.verified) redirect(`/dashboard/b/${id}`);
  return ctx;
}

export async function verifyByAccountEmail(form: FormData) {
  const ctx = await ctxFor(form);
  const b = ctx.business;
  const d = emailDomain(ctx.user.email);
  if (await isContested(b.id, ctx.user.id)) redirect(back(b.id, 'err', 'This listing needs a manual check.'));
  if (!validDomain(b.website_domain) || FREE_EMAIL_DOMAINS.has(d) || !(d === b.website_domain || d.endsWith(`.${b.website_domain}`)) || !ctx.user.email_verified_at) {
    redirect(back(b.id, 'err', 'Your account email doesn’t match the business’s website domain.'));
  }
  const res = await sql.begin(async (tx) => {
    const [r] = await tx<{ id: string }[]>`insert into verification_requests (business_id, member_id, user_id, method, target, status)
                                        values (${b.id}, ${ctx.member.id}, ${ctx.user.id}, 'email_domain', ${ctx.user.email}, 'pending') returning id`;
    return approveMembership(tx, { memberId: ctx.member.id, requestId: r.id, actorId: null, method: 'email_domain' });
  });
  if (res) await notifyVerification(res.email, res.name, b.id, true, null);
  redirect(`/dashboard/b/${b.id}/membership?verified=1`);
}

export async function sendBusinessEmail(form: FormData) {
  const ctx = await ctxFor(form);
  const b = ctx.business;
  const local = String(form.get('local') ?? '').trim().toLowerCase();
  if (!/^[a-z0-9._%+-]{1,64}$/.test(local) || !validDomain(b.website_domain)) redirect(back(b.id, 'err', 'Enter the part of the email before the @.'));
  if (await isContested(b.id, ctx.user.id)) redirect(back(b.id, 'err', 'This listing needs a manual check.'));
  if (!(await rateLimit(`biz-email:${ctx.member.id}`, 4, 86400))) redirect(back(b.id, 'err', 'You’ve requested several emails today. Try again tomorrow or use another method.'));
  const target = `${local}@${b.website_domain}`;
  const [r] = await sql<{ id: string }[]>`insert into verification_requests (business_id, member_id, user_id, method, target)
                                       values (${b.id}, ${ctx.member.id}, ${ctx.user.id}, 'email_domain', ${target}) returning id`;
  const raw = await createToken('business_email', { userId: ctx.user.id, refId: r.id, ttlHours: 48 });
  await sendEmail({ to: target, template: 'business_email', ...templates.businessEmailCode(b.name, `${env.appUrl}/dashboard/verify-business-email?token=${raw}`) });
  redirect(back(b.id, 'msg', `We’ve emailed ${target}. Open the link while signed in to this account.`));
}

export async function checkDomain(form: FormData) {
  const ctx = await ctxFor(form);
  const b = ctx.business;
  if (await isContested(b.id, ctx.user.id)) redirect(back(b.id, 'err', 'This listing needs a manual check.'));
  if (!(await rateLimit(`domain-check:${ctx.member.id}`, 12, 3600))) redirect(back(b.id, 'err', 'Too many checks. Wait a few minutes — DNS changes can take time to appear.'));
  const reqs = await sql<{ id: string; method: 'dns_txt' | 'website_file'; target: string; challenge: string }[]>`
    select id, method, target, challenge from verification_requests
    where member_id = ${ctx.member.id} and status = 'pending' and method in ('dns_txt','website_file') and target = ${b.website_domain}`;
  for (const r of reqs) {
    await sql`update verification_requests set attempts = attempts + 1 where id = ${r.id}`;
    const ok = r.method === 'dns_txt' ? await checkDnsTxt(r.target, r.challenge) : await checkWebsiteFile(r.target, r.challenge);
    if (ok) {
      const res = await sql.begin((tx) => approveMembership(tx, { memberId: ctx.member.id, requestId: r.id, actorId: null, method: r.method }));
      if (res) await notifyVerification(res.email, res.name, b.id, true, null);
      redirect(`/dashboard/b/${b.id}/membership?verified=1`);
    }
  }
  redirect(back(b.id, 'err', 'We couldn’t find the record or file yet. DNS changes can take up to an hour — try again shortly.'));
}

export async function requestManual(form: FormData) {
  const ctx = await ctxFor(form);
  const b = ctx.business;
  const evidence = String(form.get('evidence') ?? '').trim().slice(0, 2000);
  const phone = String(form.get('phone') ?? '').trim().slice(0, 30);
  const cro = String(form.get('cro') ?? '').trim().slice(0, 20).toUpperCase();
  if (evidence.length < 20 || !/^[+0-9 ()-]{6,30}$/.test(phone)) redirect(back(b.id, 'err', 'Please describe your connection to the business and give a phone number.'));
  const [open] = await sql`select 1 from verification_requests where member_id = ${ctx.member.id} and method = 'manual' and status = 'pending'`;
  if (!open) {
    await sql`insert into verification_requests (business_id, member_id, user_id, method, evidence, contact_phone, target)
              values (${b.id}, ${ctx.member.id}, ${ctx.user.id}, 'manual', ${evidence}, ${phone}, ${cro || null})`;
    await audit(ctx.user.id, 'business.manual_verification_requested', 'business', b.id, { contested: await isContested(b.id, ctx.user.id) });
  }
  redirect(back(b.id, 'msg', 'Thanks — we’ll review your request and email you.'));
}
