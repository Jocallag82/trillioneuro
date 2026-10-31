import 'server-only';
import { sql } from './db';
import { env } from './env';
import { hmac } from './security';
import { sendEmail } from './email';
import { classifyBusinessEmail, claimInviteEligible } from './recipients';
import { formatEuro, formatDate } from './format';

export type NotifySettings = { claim_invite_enabled: boolean; digest_enabled: boolean; renewal_enabled: boolean; kit_nudge_enabled: boolean; max_per_run: number };
export async function notifySettings(): Promise<NotifySettings> {
  const [s] = await sql<{ value: Partial<NotifySettings> }[]>`select value from settings where key = 'notifications'`;
  const v = s?.value ?? {};
  return { claim_invite_enabled: !!v.claim_invite_enabled, digest_enabled: !!v.digest_enabled, renewal_enabled: !!v.renewal_enabled,
    kit_nudge_enabled: !!v.kit_nudge_enabled, max_per_run: Number(v.max_per_run ?? 200) };
}

export const unsubscribeToken = (email: string) => hmac(`unsub:${email.toLowerCase()}`).slice(0, 32);
export const unsubscribeUrl = (email: string) => `${env.appUrl}/unsubscribe?e=${encodeURIComponent(email)}&t=${unsubscribeToken(email)}`;

async function suppressed(email: string, essential = false) {
  const [s] = await sql<{ scope: string }[]>`select scope from email_suppressions where email = ${email}`;
  return !!s && (!essential || s.scope === 'all');
}

/** Event hook: a review was published. Queues (never sends) a claim invitation for unclaimed listings. */
export async function onReviewPublished(businessId: string, reviewId: string) {
  const [b] = await sql<{ claimed: boolean }[]>`
    select exists(select 1 from business_members m where m.business_id = ${businessId} and m.status in ('pending','verified')) claimed`;
  if (b?.claimed) return;
  await sql`insert into notifications (kind, dedupe_key, business_id, review_id) values ('claim_invite', ${`claim_invite:${reviewId}`}, ${businessId}, ${reviewId})
            on conflict (dedupe_key) do nothing`;
}

type Outcome = { status: 'sent' | 'outbox' | 'suppressed' | 'failed' | 'pending'; reason?: string; recipient?: string; cls?: string };

async function finish(id: string, o: Outcome) {
  await sql`update notifications set status = ${o.status}, reason = ${o.reason ?? null}, recipient = coalesce(${o.recipient ?? null}, recipient),
            recipient_class = coalesce(${o.cls ?? null}, recipient_class), attempts = attempts + 1,
            processed_at = case when ${o.status} = 'pending' then null else now() end where id = ${id}`;
}

async function deliver(to: string, subject: string, text: string, template: string): Promise<Outcome> {
  const r = await sendEmail({ to, subject, text, template });
  return { status: r.delivered ? 'sent' : 'outbox', recipient: to };
}

const sig = (to: string) => `\n\n— RateMe.ie\n${env.appUrl}\n\nDon't want these emails? ${unsubscribeUrl(to)}`;

async function processClaimInvite(n: { id: string; business_id: string; created_at: Date }, s: NotifySettings): Promise<Outcome> {
  const [b] = await sql<{ name: string; slug: string; public_email: string | null; website_domain: string | null; claimed: boolean; outreach: string | null; recent: number }[]>`
    select b.name, b.slug, b.public_email, b.website_domain,
      exists(select 1 from business_members m where m.business_id = b.id and m.status in ('pending','verified')) claimed,
      (select status from outreach_prospects p where p.business_id = b.id) outreach,
      (select count(*)::int from notifications x where x.business_id = b.id and x.kind = 'claim_invite' and x.status in ('sent','outbox') and x.processed_at > now() - interval '90 days') recent
    from businesses b where b.id = ${n.business_id} and b.status = 'published'`;
  if (!b) return { status: 'suppressed', reason: 'listing not published' };
  if (b.claimed) return { status: 'suppressed', reason: 'already claimed' };
  if (b.outreach === 'do_not_contact' || b.outreach === 'not_interested') return { status: 'suppressed', reason: `outreach: ${b.outreach}` };
  if (b.recent > 0) return { status: 'suppressed', reason: 'invited in last 90 days' };
  const cls = classifyBusinessEmail(b.public_email, b.website_domain);
  if (!claimInviteEligible(cls)) return { status: 'suppressed', reason: `recipient not eligible (${cls}); use post/phone`, cls };
  const to = b.public_email!;
  if (await suppressed(to)) return { status: 'suppressed', reason: 'on suppression list', recipient: to, cls };
  if (!s.claim_invite_enabled) {
    if (Date.now() - new Date(n.created_at).getTime() > 14 * 86400000) return { status: 'suppressed', reason: 'expired while sending disabled', recipient: to, cls };
    return { status: 'pending', reason: 'sending disabled', recipient: to, cls };
  }
  const text = `Hello,\n\nA customer has published a review of ${b.name} on RateMe.ie, an independent Irish business review site.\n\nRead it: ${env.appUrl}/business/${b.slug}\n\nYou can claim the listing free of charge to keep its details accurate and reply publicly. Claiming is free; paid membership is optional.\nClaim: ${env.appUrl}/dashboard/claim?business=${b.slug}\n\nWe sent this once because this address is listed publicly as the business's contact address. We won't send another invitation for at least 90 days.${sig(to)}`;
  return { ...(await deliver(to, `A customer reviewed ${b.name} on RateMe.ie`, text, 'claim_invite')), cls };
}

/** Pending-queue processor for claim invitations. Safe to run repeatedly. */
export async function processQueue(s: NotifySettings) {
  const rows = await sql<{ id: string; kind: string; business_id: string; created_at: Date }[]>`
    select id, kind, business_id, created_at from notifications where status = 'pending' and kind = 'claim_invite' and attempts < 5
    order by created_at limit ${s.max_per_run}`;
  const counts: Record<string, number> = {};
  for (const n of rows) {
    let o: Outcome;
    try { o = await processClaimInvite(n, s); } catch (e) { o = { status: 'failed', reason: String((e as Error).message).slice(0, 200) }; }
    await finish(n.id, o);
    counts[o.status] = (counts[o.status] ?? 0) + 1;
  }
  return counts;
}

async function enqueueAndSend(kind: string, key: string, businessId: string, to: string, essential: boolean, build: () => Promise<{ subject: string; text: string } | null>) {
  const ins = await sql<{ id: string }[]>`insert into notifications (kind, dedupe_key, business_id, recipient, recipient_class)
    values (${kind}, ${key}, ${businessId}, ${to}, 'account_holder') on conflict (dedupe_key) do nothing returning id`;
  if (!ins.length) return 'duplicate';
  if (await suppressed(to, essential)) { await finish(ins[0].id, { status: 'suppressed', reason: 'on suppression list' }); return 'suppressed'; }
  try {
    const m = await build();
    if (!m) { await finish(ins[0].id, { status: 'suppressed', reason: 'nothing to report' }); return 'suppressed'; }
    const o = await deliver(to, m.subject, m.text, kind);
    await finish(ins[0].id, o);
    return o.status;
  } catch (e) {
    await finish(ins[0].id, { status: 'failed', reason: String((e as Error).message).slice(0, 200) });
    return 'failed';
  }
}

const isoWeek = (d = new Date()) => {
  const t = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const day = t.getUTCDay() || 7; t.setUTCDate(t.getUTCDate() + 4 - day);
  const y = new Date(Date.UTC(t.getUTCFullYear(), 0, 1));
  return `${t.getUTCFullYear()}-W${Math.ceil(((t.getTime() - y.getTime()) / 86400000 + 1) / 7)}`;
};

/** Weekly digest for verified owners of active members. Skipped entirely when there's no real activity. */
export async function runDigest() {
  const week = isoWeek();
  const owners = await sql<{ business_id: string; name: string; email: string; user_id: string }[]>`
    select b.id business_id, b.name, u.email, u.id user_id from business_members m join users u on u.id = m.user_id join businesses b on b.id = m.business_id
    join subscriptions s on s.business_id = b.id and s.status in ('active','trialing','past_due') and s.refunded_at is null and s.disputed_at is null
    where m.status = 'verified' and u.status = 'active' and not u.digest_opt_out and b.status = 'published'
    group by b.id, b.name, u.email, u.id`;
  const out: Record<string, number> = {};
  for (const o of owners) {
    const r = await enqueueAndSend('weekly_digest', `digest:${o.business_id}:${o.user_id}:${week}`, o.business_id, o.email, false, async () => {
      const [a] = await sql<{ views: number; scans: number; starts: number; published: number; unanswered: number }[]>`
        select
          (select coalesce(sum(profile_views),0)::int from business_daily_stats where business_id = ${o.business_id} and day > (now() at time zone 'Europe/Dublin')::date - 7) views,
          (select coalesce(sum(qr_scans),0)::int from business_daily_stats where business_id = ${o.business_id} and day > (now() at time zone 'Europe/Dublin')::date - 7) scans,
          (select coalesce(sum(review_starts),0)::int from business_daily_stats where business_id = ${o.business_id} and day > (now() at time zone 'Europe/Dublin')::date - 7) starts,
          (select count(*)::int from reviews where business_id = ${o.business_id} and status = 'published' and published_at > now() - interval '7 days') published,
          (select count(*)::int from reviews r where r.business_id = ${o.business_id} and r.status = 'published'
             and not exists (select 1 from review_responses x where x.review_id = r.id and x.status = 'published')) unanswered`;
      if (!a.views && !a.scans && !a.starts && !a.published && !a.unanswered) return null;
      const tips = [
        a.unanswered ? `• ${a.unanswered} review${a.unanswered === 1 ? '' : 's'} still without a reply.` : '',
        a.scans && !a.published ? '• Your QR code was scanned but no new review was published. Mention it only takes a minute.' : '',
      ].filter(Boolean).join('\n');
      return { subject: `Your week on RateMe.ie: ${o.name}`, text:
        `Last 7 days for ${o.name}:\n\nProfile visits: ${a.views}\nQR scans: ${a.scans}\nReview forms opened: ${a.starts}\nNew published reviews: ${a.published}\n${tips ? `\n${tips}\n` : ''}\nDashboard: ${env.appUrl}/dashboard/b/${o.business_id}\n\nTurn off weekly summaries in your account settings: ${env.appUrl}/dashboard/account${sig(o.email)}` };
    });
    out[r] = (out[r] ?? 0) + 1;
  }
  return out;
}

/** Renewal reminders for auto-renewing subscriptions, 30 and 7 days ahead. Service messages (essential). */
export async function runRenewals() {
  const subs = await sql<{ id: string; business_id: string; name: string; email: string | null; period_end: Date; amount_cents: number | null; window: number }[]>`
    select s.id, s.business_id, b.name, u.email, s.current_period_end period_end, s.amount_cents,
      case when s.current_period_end <= now() + interval '7 days' then 7 else 30 end "window"
    from subscriptions s join businesses b on b.id = s.business_id left join users u on u.id = s.purchaser_id and u.status = 'active'
    where s.status in ('active','trialing') and not s.cancel_at_period_end and s.refunded_at is null and s.disputed_at is null
      and s.current_period_end > now() and s.current_period_end <= now() + interval '30 days'`;
  const out: Record<string, number> = {};
  for (const s of subs) {
    if (!s.email) { out.no_recipient = (out.no_recipient ?? 0) + 1; continue; }
    const kind = s.window === 7 ? 'renewal_7' : 'renewal_30';
    const r = await enqueueAndSend(kind, `${kind}:${s.id}:${new Date(s.period_end).toISOString().slice(0, 10)}`, s.business_id, s.email, true, async () => ({
      subject: `Your RateMe.ie membership for ${s.name} renews on ${formatDate(s.period_end)}`,
      text: `Your membership for ${s.name} renews automatically on ${formatDate(s.period_end)}${s.amount_cents ? ` for ${formatEuro(s.amount_cents)}` : ''}. Any VAT is shown on your invoice.\n\nNothing to do if you want to continue.\n\nTo cancel, do it before that date from your dashboard: ${env.appUrl}/dashboard/b/${s.business_id}/membership\nIf you cancel, your profile, reviews and printed QR codes stay live; member tools stop at the end of the paid period.\n\n— RateMe.ie\n${env.appUrl}`,
    }));
    out[r] = (out[r] ?? 0) + 1;
  }
  return out;
}

/** One-off onboarding nudge: kit downloaded/printed 21+ days ago, never scanned since. */
export async function runKitNudges() {
  const rows = await sql<{ business_id: string; name: string; email: string }[]>`
    select b.id business_id, b.name, u.email from businesses b
    join business_members m on m.business_id = b.id and m.status = 'verified' join users u on u.id = m.user_id and u.status = 'active'
    where (select min(day) from business_daily_stats d where d.business_id = b.id and d.kit_downloads > 0) <= (now() at time zone 'Europe/Dublin')::date - 21
      and coalesce((select sum(qr_scans) from business_daily_stats d where d.business_id = b.id), 0) = 0`;
  const out: Record<string, number> = {};
  for (const r of rows) {
    const s = await enqueueAndSend('kit_nudge', `kit_nudge:${r.business_id}:${r.email}`, r.business_id, r.email, false, async () => ({
      subject: `Your RateMe.ie QR code for ${r.name} hasn't been scanned yet`,
      text: `You downloaded your review kit for ${r.name} three weeks ago, but we haven't recorded a scan yet.\n\nWhat works for most businesses:\n• Put the counter card right next to the card machine.\n• Trades: send the WhatsApp message the evening you finish a job.\n• Ask every customer the same way, not just the happy ones.\n\nYour kit and invitation wording: ${env.appUrl}/dashboard/b/${r.business_id}/qr${sig(r.email)}`,
    }));
    out[s] = (out[s] ?? 0) + 1;
  }
  return out;
}

/** Runs a job at most once concurrently (10-minute lease row) and records the outcome in job_runs. */
export async function runJob<T>(job: string, fn: () => Promise<T>): Promise<T | { skipped: 'locked' }> {
  const got = await sql`insert into job_locks (job, locked_until) values (${job}, now() + interval '10 minutes')
    on conflict (job) do update set locked_until = excluded.locked_until where job_locks.locked_until < now() returning job`;
  if (!got.length) return { skipped: 'locked' };
  const [run] = await sql<{ id: number }[]>`insert into job_runs (job) values (${job}) returning id`;
  try {
    const result = await fn();
    await sql`update job_runs set finished_at = now(), ok = true, result = ${sql.json(result as never)} where id = ${run.id}`;
    return result;
  } catch (e) {
    await sql`update job_runs set finished_at = now(), ok = false, error = ${String((e as Error).message).slice(0, 500)} where id = ${run.id}`;
    throw e;
  } finally {
    await sql`update job_locks set locked_until = now() where job = ${job}`;
  }
}

export async function runLifecycle() {
  const s = await notifySettings();
  const dublinDay = new Date().toLocaleDateString('en-GB', { timeZone: 'Europe/Dublin', weekday: 'short' });
  return {
    claimInvites: await runJob('claim_invites', () => processQueue(s)),
    digest: s.digest_enabled && dublinDay === 'Mon' ? await runJob('weekly_digest', runDigest) : 'disabled_or_not_monday',
    renewals: s.renewal_enabled ? await runJob('renewals', runRenewals) : 'disabled',
    kitNudges: s.kit_nudge_enabled ? await runJob('kit_nudges', runKitNudges) : 'disabled',
  };
}
