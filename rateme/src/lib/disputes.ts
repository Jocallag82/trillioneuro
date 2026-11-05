import 'server-only';
import { sql } from './db';
import type { Tx } from './db';
import { env } from './env';
import { createToken } from './tokens';
import { sendEmail } from './email';
import { setReviewStatus } from './reviews';
import { audit } from './audit';
import { afterNoResponse, afterReviewerStandsBy, appealGrantedReviewStatus, DISPUTE_REASONS } from './dispute-policy';

// Fair dispute process (see /review-policy#disputes):
//  1. A dispute (from the verified business, or from repeated visitor reports) states a specific reason,
//     an explanation and optional evidence. The review stays published while it is looked at.
//  2. The reviewer is emailed and can stand by the review (with their own statement) or withdraw it.
//  3. Standing by an unsupported allegation closes the dispute; evidence-backed or policy allegations go to a moderator.
//  4. No reply by the deadline → a moderator decides. Silence is never treated as proof of fraud.
//  5. Every decision has a written finding, is sent to both sides, and can be appealed once within the appeal window.
// Membership plays no part at any step.

type DisputeSettings = { reconfirm_days: number; max_per_business_per_30_days: number; reports_to_trigger: number; reminder_days_before: number; appeal_days: number };

export async function disputeSettings(tx?: Tx): Promise<DisputeSettings> {
  const q = tx ?? sql;
  const [s] = await q<{ value: Partial<DisputeSettings> }[]>`select value from settings where key = 'disputes'`;
  return { reconfirm_days: 14, max_per_business_per_30_days: 5, reports_to_trigger: 3, reminder_days_before: 5, appeal_days: 30, ...(s?.value ?? {}) };
}

export type OpenResult = { ok: true } | { ok: false; error: string };

const sig = `\n\n— RateMe.ie\n${env.appUrl}/review-policy#disputes`;

export async function openReconfirmation(opts: {
  reviewId: string; businessId: string; source: 'business' | 'reports'; raisedBy: string | null;
  reasonCode: string; allegation: string; evidence?: string | null;
}): Promise<OpenResult> {
  const settings = await disputeSettings();
  const reasonLabel = DISPUTE_REASONS[opts.reasonCode as keyof typeof DISPUTE_REASONS] ?? opts.reasonCode;
  const res = await sql.begin(async (tx) => {
    const [r] = await tx<{ status: string; reviewer_email: string; reviewer_name: string; name: string }[]>`
      select r.status, r.reviewer_email, r.reviewer_name, b.name from reviews r join businesses b on b.id = r.business_id
      where r.id = ${opts.reviewId} and r.business_id = ${opts.businessId} for update of r`;
    if (!r || r.status !== 'published') return { ok: false as const, error: 'Review not found.' };
    const [active] = await tx`select 1 from disputes where review_id = ${opts.reviewId} and status in ('open','escalated')`;
    if (active) return { ok: false as const, error: 'This review already has a dispute in progress.' };
    if (opts.source === 'business') {
      const [decided] = await tx`select 1 from disputes where review_id = ${opts.reviewId} and source = 'business' and status in ('upheld','rejected')`;
      if (decided) return { ok: false as const, error: 'A dispute about this review has already been decided. You can appeal that decision instead.' };
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int n from disputes where business_id = ${opts.businessId} and source = 'business' and created_at > now() - interval '30 days'`;
      if (n >= settings.max_per_business_per_30_days) return { ok: false as const, error: `You can dispute up to ${settings.max_per_business_per_30_days} reviews every 30 days.` };
    }
    const [d] = await tx<{ id: string }[]>`
      insert into disputes (review_id, business_id, raised_by, reason, reason_code, allegation, evidence, source, deadline_at)
      values (${opts.reviewId}, ${opts.businessId}, ${opts.raisedBy}, ${reasonLabel}, ${opts.reasonCode}, ${opts.allegation.slice(0, 3000)},
              ${opts.evidence?.trim().slice(0, 3000) || null}, ${opts.source}, now() + make_interval(days => ${settings.reconfirm_days})) returning id`;
    await tx`insert into moderation_actions (review_id, actor_user_id, action, reason, notes)
             values (${opts.reviewId}, ${opts.raisedBy}, 'dispute_opened', ${reasonLabel}, ${opts.source === 'business' ? 'Disputed by the business' : 'Repeated visitor reports'})`;
    const token = await createToken('review_reconfirm', { refId: d.id, ttlHours: 24 * (settings.reconfirm_days + 365) }, tx);
    return { ok: true as const, token, email: r.reviewer_email, name: r.reviewer_name, business: r.name };
  });
  if (!res.ok) return res;
  const link = `${env.appUrl}/review/reconfirm?token=${res.token}`;
  await sendEmail({
    to: res.email, template: 'review_reconfirm',
    subject: `Your review of ${res.business} has been questioned`,
    text: `Hi ${res.name},\n\n${opts.source === 'business' ? `${res.business} has disputed your review` : 'Several visitors have reported your review'}.\nReason given: "${reasonLabel}".\n\nYour review stays published while this is looked at. Please tell us what you'd like to do — it takes a minute:\n${link}\n\n• Stand by your review (you can add a short explanation for our moderators), or\n• Withdraw it.\n\nPlease reply within ${settings.reconfirm_days} days. If we don't hear from you, a RateMe.ie moderator reviews the dispute — your review is not removed just because you didn't reply.\n\nYour email address is never shared with the business.${sig}`,
  });
  await audit(opts.raisedBy, 'review.dispute_opened', 'review', opts.reviewId, { source: opts.source, reason: opts.reasonCode });
  return { ok: true };
}

/** Reviewer stands by the review. Restores it only if it was removed by the legacy automatic rule. */
export async function reconfirm(disputeId: string, statement?: string | null): Promise<{ businessSlug: string; restored: boolean; outcome: 'kept' | 'escalated' } | null> {
  return sql.begin(async (tx) => {
    const [d] = await tx<{ id: string; review_id: string; status: string; slug: string; review_status: string; source: 'business' | 'reports'; reason_code: string | null; evidence: string | null; decided_by: string | null }[]>`
      select d.id, d.review_id, d.status, b.slug, r.status review_status, d.source, d.reason_code, d.evidence, d.decided_by
      from disputes d join reviews r on r.id = d.review_id join businesses b on b.id = d.business_id where d.id = ${disputeId} for update of d`;
    if (!d) return null;
    const stmt = statement?.trim().slice(0, 3000) || null;
    // Legacy: removed automatically for silence (no human decided). Reconfirming restores it.
    if (d.status === 'upheld' && d.decided_by === null && d.review_status === 'removed') {
      await setReviewStatus(tx, d.review_id, 'published', null, 'restored_by_reconfirmation', 'Reviewer reconfirmed after automatic removal', stmt);
      await tx`update disputes set status = 'rejected', reconfirmed_at = now(), reviewer_responded_at = now(), reviewer_statement = coalesce(${stmt}, reviewer_statement),
                 finding = 'The reviewer reconfirmed this is their own genuine experience.' where id = ${d.id}`;
      return { businessSlug: d.slug, restored: true, outcome: 'kept' as const };
    }
    if (!['open', 'escalated'].includes(d.status) || d.review_status !== 'published') return null;
    const next = afterReviewerStandsBy({ source: d.source, reasonCode: d.reason_code, evidence: d.evidence });
    if (next.status === 'rejected') {
      await tx`update disputes set status = 'rejected', reconfirmed_at = now(), reviewer_responded_at = now(), reviewer_statement = ${stmt}, decided_at = now(),
                 appeal_until = now() + interval '30 days',
                 finding = 'The reviewer confirmed this is their own genuine experience and the dispute did not include evidence to the contrary, so the review stays published.'
               where id = ${d.id}`;
    } else {
      await tx`update disputes set status = 'escalated', reconfirmed_at = now(), reviewer_responded_at = now(), reviewer_statement = ${stmt},
                 escalated_at = coalesce(escalated_at, now()), escalation_reason = ${next.escalationReason} where id = ${d.id}`;
    }
    await tx`insert into moderation_actions (review_id, action, reason, notes) values (${d.review_id}, 'reviewer_stood_by', 'Reviewer stood by the review',
               ${next.status === 'escalated' ? 'Escalated to a moderator' : 'Dispute closed — review kept'})`;
    return { businessSlug: d.slug, restored: false, outcome: next.status === 'rejected' ? 'kept' as const : 'escalated' as const };
  });
}

/** Reviewer withdraws the review in response to a dispute. */
export async function withdrawDisputed(disputeId: string): Promise<boolean> {
  return sql.begin(async (tx) => {
    const [d] = await tx<{ review_id: string }[]>`select review_id from disputes where id = ${disputeId} and status in ('open','escalated') for update`;
    if (!d) return false;
    const [r] = await tx<{ status: string }[]>`select status from reviews where id = ${d.review_id}`;
    if (r?.status === 'published') await setReviewStatus(tx, d.review_id, 'withdrawn', null, 'withdrawn_by_reviewer', 'Withdrawn by the reviewer during a dispute', null);
    await tx`update disputes set status = 'withdrawn', reviewer_responded_at = now(), decided_at = now(), finding = 'The reviewer withdrew the review.' where id = ${disputeId}`;
    return true;
  });
}

/** Cron: send one reminder, then escalate unanswered disputes to a moderator. Never removes reviews. */
export async function processDisputeDeadlines(): Promise<{ reminded: number; escalated: number }> {
  const settings = await disputeSettings();
  const remind = await sql<{ id: string; email: string; name: string; business: string; deadline_at: Date }[]>`
    select d.id, r.reviewer_email email, r.reviewer_name name, b.name business, d.deadline_at
    from disputes d join reviews r on r.id = d.review_id join businesses b on b.id = d.business_id
    where d.status = 'open' and d.reminder_sent_at is null and d.reviewer_responded_at is null
      and d.deadline_at < now() + make_interval(days => ${settings.reminder_days_before}) and d.deadline_at > now() limit 500`;
  for (const d of remind) {
    const token = await createToken('review_reconfirm', { refId: d.id, ttlHours: 24 * 400 });
    await sendEmail({ to: d.email, template: 'review_reconfirm_reminder', subject: `Reminder: your review of ${d.business} is being looked at`,
      text: `Hi ${d.name},\n\nA reminder that your review of ${d.business} was questioned. Please stand by it or withdraw it by ${new Date(d.deadline_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'long' })}:\n${env.appUrl}/review/reconfirm?token=${token}\n\nIf you don't reply, a moderator reviews it. It is not removed automatically.${sig}` });
    await sql`update disputes set reminder_sent_at = now() where id = ${d.id}`;
  }
  const next = afterNoResponse();
  const esc = await sql`update disputes set status = ${next.status}, escalated_at = now(), escalation_reason = ${next.escalationReason}
                        where status = 'open' and deadline_at < now() returning review_id`;
  for (const e of esc) await sql`insert into moderation_actions (review_id, action, reason) values (${e.review_id}, 'dispute_escalated', 'No reply from the reviewer — sent to a moderator; review stays published')`;
  return { reminded: remind.length, escalated: esc.length };
}

/** Moderator decision. Always documented, sent to both parties, appealable. */
export async function decideDispute(opts: { disputeId: string; staffId: string; outcome: 'upheld' | 'rejected'; finding: string }) {
  const settings = await disputeSettings();
  const info = await sql.begin(async (tx) => {
    const [d] = await tx<{ review_id: string; business_id: string; raised_by: string | null }[]>`
      update disputes set status = ${opts.outcome}, finding = ${opts.finding}, decided_by = ${opts.staffId}, decided_at = now(),
        appeal_until = now() + make_interval(days => ${settings.appeal_days})
      where id = ${opts.disputeId} and status in ('open','escalated') returning review_id, business_id, raised_by`;
    if (!d) return null;
    if (opts.outcome === 'upheld') await setReviewStatus(tx, d.review_id, 'removed', opts.staffId, 'dispute_upheld', 'Dispute upheld by a moderator', opts.finding);
    else await tx`insert into moderation_actions (review_id, actor_user_id, action, reason, notes) values (${d.review_id}, ${opts.staffId}, 'dispute_rejected', 'Dispute not upheld', ${opts.finding})`;
    const [x] = await tx<{ owner_email: string | null; reviewer_email: string; business: string }[]>`
      select (select email from users where id = ${d.raised_by}) owner_email, r.reviewer_email, b.name business
      from reviews r join businesses b on b.id = r.business_id where r.id = ${d.review_id}`;
    return { ...x, ...d };
  });
  if (!info) return false;
  const outcomeText = opts.outcome === 'upheld' ? 'Upheld — the review has been removed' : 'Not upheld — the review stays published';
  if (info.owner_email) {
    await sendEmail({ to: info.owner_email, template: 'dispute_decision', subject: `Outcome of your review dispute (${info.business})`,
      text: `Outcome: ${outcomeText}\nFinding: ${opts.finding}\n\nYou can appeal once within ${settings.appeal_days} days from your dashboard if you have new information:\n${env.appUrl}/dashboard/b/${info.business_id}/reviews${sig}` });
  }
  const manage = await createToken('review_manage', { refId: info.review_id, ttlHours: 24 * 365 });
  await sendEmail({ to: info.reviewer_email, template: 'dispute_decision_reviewer', subject: `Decision on your review of ${info.business}`,
    text: `Outcome: ${outcomeText}\nFinding: ${opts.finding}\n\nYou can appeal once within ${settings.appeal_days} days:\n${env.appUrl}/review/manage?token=${manage}${sig}` });
  await audit(opts.staffId, 'review.dispute_decided', 'review', info.review_id, { outcome: opts.outcome });
  return true;
}

export type AppealResult = { ok: true } | { ok: false; error: string };

/** One appeal per party per decided dispute, within the appeal window. */
export async function submitAppeal(opts: { reviewId: string; appellant: 'reviewer' | 'business'; userId: string | null; body: string; businessId?: string }): Promise<AppealResult> {
  const body = opts.body.trim().slice(0, 3000);
  if (body.length < 30) return { ok: false, error: 'Please explain your appeal in at least 30 characters, including any new information.' };
  const [d] = await sql<{ id: string; status: string; appeal_until: Date | null; business_id: string }[]>`
    select id, status, appeal_until, business_id from disputes where review_id = ${opts.reviewId} and status in ('upheld','rejected')
    order by decided_at desc nulls last limit 1`;
  if (!d || (opts.businessId && d.business_id !== opts.businessId)) return { ok: false, error: 'There is no decision to appeal.' };
  if (!d.appeal_until || d.appeal_until < new Date()) return { ok: false, error: 'The appeal window for this decision has closed.' };
  const [prior] = await sql`select 1 from appeals where dispute_id = ${d.id} and appellant = ${opts.appellant}`;
  if (prior) return { ok: false, error: 'You have already appealed this decision.' };
  await sql`insert into appeals (review_id, dispute_id, appellant, user_id, body) values (${opts.reviewId}, ${d.id}, ${opts.appellant}, ${opts.userId}, ${body})`;
  await sql`insert into moderation_actions (review_id, actor_user_id, action, reason) values (${opts.reviewId}, ${opts.userId}, 'appeal_submitted', ${`Appeal by the ${opts.appellant}`})`;
  return { ok: true };
}

/** Appeal decision. Granting reverses the dispute outcome. */
export async function decideAppeal(opts: { appealId: string; staffId: string; outcome: 'granted' | 'denied'; notes: string }) {
  return sql.begin(async (tx) => {
    const [a] = await tx<{ review_id: string; dispute_status: 'upheld' | 'rejected' | null; dispute_id: string | null }[]>`
      update appeals a set status = ${opts.outcome}, decision_notes = ${opts.notes}, decided_by = ${opts.staffId}, decided_at = now()
      where a.id = ${opts.appealId} and a.status = 'open'
      returning a.review_id, a.dispute_id, (select status from disputes where id = a.dispute_id) dispute_status`;
    if (!a) return null;
    if (opts.outcome === 'granted') {
      // Legacy appeals with no linked dispute: granting republishes (previous behaviour).
      const to = a.dispute_status === 'upheld' || a.dispute_status === 'rejected' ? appealGrantedReviewStatus(a.dispute_status) : 'published';
      await setReviewStatus(tx, a.review_id, to, opts.staffId, 'appeal_granted', 'Appeal granted', opts.notes);
      if (a.dispute_id) await tx`update disputes set status = ${a.dispute_status === 'upheld' ? 'rejected' : 'upheld'}, appeal_until = null,
                                   finding = finding || ' — Reversed on appeal: ' || ${opts.notes} where id = ${a.dispute_id}`;
    } else {
      await tx`insert into moderation_actions (review_id, actor_user_id, action, reason, notes) values (${a.review_id}, ${opts.staffId}, 'appeal_denied', 'Appeal denied', ${opts.notes})`;
    }
    return a.review_id;
  });
}

/** Visitor reports: once enough independent reports arrive, open the same fair dispute process. */
export async function maybeTriggerFromReports(reviewId: string) {
  const settings = await disputeSettings();
  const [r] = await sql<{ business_id: string; n: number; reasons: string; top: string }[]>`
    select rv.business_id, count(distinct p.ip_hash)::int n, string_agg(distinct p.reason, ', ') reasons, mode() within group (order by p.reason) top
    from reports p join reviews rv on rv.id = p.review_id
    where p.review_id = ${reviewId} and p.status = 'open' group by rv.business_id`;
  if (!r || r.n < settings.reports_to_trigger) return;
  const map: Record<string, string> = { personal_info: 'personal_info', harassment: 'harassment', conflict: 'conflict', not_genuine: 'not_a_customer', defamatory: 'false_facts' };
  const res = await openReconfirmation({ reviewId, businessId: r.business_id, source: 'reports', raisedBy: null,
    reasonCode: map[r.top] ?? 'other', allegation: `Reported by several visitors. Reasons: ${r.reasons}` });
  if (res.ok) await sql`update reports set status = 'actioned', resolved_at = now(), resolution_notes = 'Dispute process started' where review_id = ${reviewId} and status = 'open'`;
}
