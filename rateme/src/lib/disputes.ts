import 'server-only';
import { sql } from './db';
import type { Tx } from './db';
import { env } from './env';
import { createToken } from './tokens';
import { sendEmail } from './email';
import { setReviewStatus } from './reviews';
import { audit } from './audit';

// Hands-off dispute resolution. Nobody at RateMe.ie decides who is right:
//  1. A dispute (from the business, or from repeated visitor reports) emails the reviewer a link.
//  2. Reviewer clicks "I stand by my review" → review stays, dispute closes.
//  3. No reconfirmation within the window → review is removed automatically.
//  4. A removed reviewer can still reconfirm later from their manage link → review is restored.
// Identical for positive and negative reviews.

type DisputeSettings = { reconfirm_days: number; max_per_business_per_30_days: number; reports_to_trigger: number };

export async function disputeSettings(tx?: Tx): Promise<DisputeSettings> {
  const q = tx ?? sql;
  const [s] = await q<{ value: Partial<DisputeSettings> }[]>`select value from settings where key = 'disputes'`;
  return { reconfirm_days: 14, max_per_business_per_30_days: 5, reports_to_trigger: 3, ...(s?.value ?? {}) };
}

export type OpenResult = { ok: true } | { ok: false; error: string };

export async function openReconfirmation(opts: { reviewId: string; businessId: string; source: 'business' | 'reports'; raisedBy: string | null; reason: string; allegation: string }): Promise<OpenResult> {
  const settings = await disputeSettings();
  const res = await sql.begin(async (tx) => {
    const [r] = await tx<{ status: string; reviewer_email: string; reviewer_name: string; name: string }[]>`
      select r.status, r.reviewer_email, r.reviewer_name, b.name from reviews r join businesses b on b.id = r.business_id
      where r.id = ${opts.reviewId} and r.business_id = ${opts.businessId} for update of r`;
    if (!r || r.status !== 'published') return { ok: false as const, error: 'Review not found.' };
    const [open] = await tx`select 1 from disputes where review_id = ${opts.reviewId} and status = 'open'`;
    if (open) return { ok: false as const, error: 'This review is already waiting for the reviewer to reconfirm.' };
    // A review the reviewer has already stood behind can't be disputed again by the business.
    const [reconfirmed] = await tx`select 1 from disputes where review_id = ${opts.reviewId} and reconfirmed_at is not null`;
    if (reconfirmed && opts.source === 'business') return { ok: false as const, error: 'The reviewer has already reconfirmed this review, so it can’t be disputed again.' };
    if (opts.source === 'business') {
      const [{ n }] = await tx<{ n: number }[]>`select count(*)::int n from disputes where business_id = ${opts.businessId} and source = 'business' and created_at > now() - interval '30 days'`;
      if (n >= settings.max_per_business_per_30_days) return { ok: false as const, error: `You can dispute up to ${settings.max_per_business_per_30_days} reviews every 30 days.` };
    }
    const [d] = await tx<{ id: string }[]>`
      insert into disputes (review_id, business_id, raised_by, reason, allegation, source, deadline_at)
      values (${opts.reviewId}, ${opts.businessId}, ${opts.raisedBy}, ${opts.reason}, ${opts.allegation.slice(0, 3000)}, ${opts.source},
              now() + make_interval(days => ${settings.reconfirm_days})) returning id`;
    await tx`insert into moderation_actions (review_id, actor_user_id, action, reason, notes)
             values (${opts.reviewId}, ${opts.raisedBy}, 'reconfirmation_requested', ${opts.reason}, ${opts.source === 'business' ? 'Disputed by the business' : 'Repeated visitor reports'})`;
    const token = await createToken('review_reconfirm', { refId: d.id, ttlHours: 24 * (settings.reconfirm_days + 365) }, tx);
    return { ok: true as const, token, email: r.reviewer_email, name: r.reviewer_name, business: r.name };
  });
  if (!res.ok) return res;
  const link = `${env.appUrl}/review/reconfirm?token=${res.token}`;
  await sendEmail({
    to: res.email, template: 'review_reconfirm',
    subject: `Please reconfirm your review of ${res.business}`,
    text: `Hi ${res.name},\n\n${opts.source === 'business' ? `${res.business} has questioned your review` : 'Several visitors have reported your review'} (reason given: "${opts.reason}").\n\nIf your review is your own genuine experience, click below to keep it published. It takes one click:\n${link}\n\nIf you don't reconfirm within ${settings.reconfirm_days} days, the review is removed automatically. You can still restore it later with the same link.\n\nYour email address is never shared with the business.\n\n— RateMe.ie`,
  });
  await audit(opts.raisedBy, 'review.reconfirmation_requested', 'review', opts.reviewId, { source: opts.source });
  return { ok: true };
}

/** Reviewer clicked "I stand by my review". Keeps or restores the review. */
export async function reconfirm(disputeId: string): Promise<{ businessSlug: string; restored: boolean } | null> {
  return sql.begin(async (tx) => {
    const [d] = await tx<{ id: string; review_id: string; status: string; slug: string; review_status: string }[]>`
      select d.id, d.review_id, d.status, b.slug, r.status review_status
      from disputes d join reviews r on r.id = d.review_id join businesses b on b.id = d.business_id where d.id = ${disputeId} for update of d`;
    if (!d || !['published', 'removed'].includes(d.review_status)) return null;
    let restored = false;
    if (d.review_status === 'removed') {
      await setReviewStatus(tx, d.review_id, 'published', null, 'restored_by_reconfirmation', 'Reviewer reconfirmed after automatic removal', null);
      restored = true;
    }
    await tx`update disputes set status = 'rejected', reconfirmed_at = coalesce(reconfirmed_at, now()), decided_at = now(),
               finding = 'The reviewer reconfirmed that this is their own genuine experience.' where id = ${d.id}`;
    await tx`insert into moderation_actions (review_id, action, reason) values (${d.review_id}, 'reviewer_reconfirmed', 'Reviewer stood by the review')`;
    return { businessSlug: d.slug, restored };
  });
}

/** Cron: remove reviews whose reconfirmation window has passed. */
export async function expireReconfirmations(): Promise<number> {
  const due = await sql<{ id: string; review_id: string }[]>`select id, review_id from disputes where status = 'open' and deadline_at < now() limit 500`;
  for (const d of due) {
    await sql.begin(async (tx) => {
      const [r] = await tx<{ status: string }[]>`select status from reviews where id = ${d.review_id} for update`;
      if (r?.status === 'published') await setReviewStatus(tx, d.review_id, 'removed', null, 'auto_removed_not_reconfirmed', 'Reviewer did not reconfirm within the deadline', null);
      await tx`update disputes set status = 'upheld', decided_at = now(), finding = 'The reviewer did not reconfirm within the deadline, so the review was removed automatically.' where id = ${d.id} and status = 'open'`;
    });
  }
  return due.length;
}

/** Visitor reports: once enough independent reports arrive, start the same automatic reconfirmation. */
export async function maybeTriggerFromReports(reviewId: string) {
  const settings = await disputeSettings();
  const [r] = await sql<{ business_id: string; n: number; reasons: string }[]>`
    select rv.business_id, count(distinct p.ip_hash)::int n, string_agg(distinct p.reason, ', ') reasons
    from reports p join reviews rv on rv.id = p.review_id
    where p.review_id = ${reviewId} and p.status = 'open' group by rv.business_id`;
  if (!r || r.n < settings.reports_to_trigger) return;
  const res = await openReconfirmation({ reviewId, businessId: r.business_id, source: 'reports', raisedBy: null, reason: 'Reported by several visitors', allegation: `Visitor report reasons: ${r.reasons}` });
  if (res.ok) await sql`update reports set status = 'actioned', resolved_at = now(), resolution_notes = 'Automatic reconfirmation requested' where review_id = ${reviewId} and status = 'open'`;
}
