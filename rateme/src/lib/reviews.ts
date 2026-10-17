import 'server-only';
import { sql } from './db';
import type { Tx } from './db';
import { env } from './env';
import { sha256 } from './util';
import { createToken } from './tokens';
import { sendEmail, templates } from './email';
import { screenText, isConflictDomain, type HoldReason } from './screening';

export const EXPERIENCE_TYPES = [
  'In-store / on-site visit', 'Service at my home or premises', 'Dine-in', 'Takeaway or delivery',
  'Appointment', 'Online or phone order', 'Stay or booking', 'Course or lesson', 'Other',
] as const;

export const reviewerHash = (email: string) => sha256(`reviewer:${email.trim().toLowerCase()}`);

export type ReviewInput = {
  businessId: string; rating: number; title: string | null; body: string | null; experienceType: string | null;
  experienceMonth: string; reviewerName: string; reviewerEmail: string; declaration: boolean; source: 'web' | 'qr'; ipHash: string;
};

export type SubmitResult = { ok: true; delivered: boolean } | { ok: false; error: string };

export async function submitReview(input: ReviewInput): Promise<SubmitResult> {
  const [biz] = await sql<{ id: string; name: string; status: string }[]>`select id, name, status from businesses where id = ${input.businessId}`;
  if (!biz || biz.status !== 'published') return { ok: false, error: 'This business is not accepting reviews.' };
  const [settings] = await sql<{ value: { max_reviews_per_ip_per_day?: number; confirm_hours?: number } }[]>`select value from settings where key = 'reviews'`;
  const maxPerIp = Number(settings?.value?.max_reviews_per_ip_per_day ?? 6);
  const [{ n }] = await sql<{ n: number }[]>`select count(*)::int n from reviews where ip_hash = ${input.ipHash} and created_at > now() - interval '24 hours'`;
  if (n >= maxPerIp) return { ok: false, error: 'Too many reviews have been submitted from this connection today. Please try again tomorrow.' };

  const emailHash = reviewerHash(input.reviewerEmail);
  try {
    const raw = await sql.begin(async (tx) => {
      const [r] = await tx<{ id: string }[]>`
        insert into reviews (business_id, rating, title, body, experience_type, experience_month, reviewer_name, reviewer_email,
                             reviewer_email_hash, declaration_at, status, source, ip_hash)
        values (${biz.id}, ${input.rating}, ${input.title}, ${input.body}, ${input.experienceType}, ${input.experienceMonth},
                ${input.reviewerName}, ${input.reviewerEmail.trim().toLowerCase()}, ${emailHash}, now(), 'pending_confirmation', ${input.source}, ${input.ipHash})
        returning id`;
      await tx`insert into moderation_actions (review_id, action, to_status, reason) values (${r.id}, 'submitted', 'pending_confirmation', 'Awaiting email confirmation')`;
      return createToken('review_confirm', { refId: r.id, ttlHours: Number(settings?.value?.confirm_hours ?? 72) }, tx);
    });
    const mail = templates.confirmReview(input.reviewerName, biz.name, `${env.appUrl}/review/confirm?token=${raw}`);
    const { delivered } = await sendEmail({ to: input.reviewerEmail, template: 'review_confirm', ...mail });
    return { ok: true, delivered };
  } catch (e) {
    if ((e as { code?: string }).code === '23505') {
      return { ok: false, error: 'You’ve already reviewed this business with this email address. Use the link in your earlier confirmation email to manage that review.' };
    }
    throw e;
  }
}

/** Automated, rating-blind checks applied when the reviewer confirms their email. Any hit rejects automatically. */
export async function automatedRejectReasons(tx: Tx, reviewId: string): Promise<HoldReason[]> {
  const [r] = await tx<{ title: string | null; body: string | null; reviewer_email: string; business_id: string; ip_hash: string | null; website_domain: string | null }[]>`
    select r.title, r.body, r.reviewer_email, r.business_id, r.ip_hash, b.website_domain
    from reviews r join businesses b on b.id = r.business_id where r.id = ${reviewId}`;
  const reasons = screenText(r.title, r.body);
  if (isConflictDomain(r.reviewer_email, r.website_domain)) reasons.push('possible_conflict');
  const [member] = await tx`select 1 from business_members m join users u on u.id = m.user_id
                            where m.business_id = ${r.business_id} and u.email = ${r.reviewer_email} and m.status in ('pending','verified')`;
  if (member) reasons.push('reviewer_is_member');
  if (r.ip_hash) {
    const [{ same }] = await tx<{ same: number }[]>`
      select count(*)::int same from reviews where business_id = ${r.business_id} and id <> ${reviewId}
        and ip_hash = ${r.ip_hash} and created_at > now() - interval '30 days' and status = 'published'`;
    if (same >= 1) reasons.push('repeat_device');
  }
  return reasons;
}

export async function confirmReview(reviewId: string): Promise<{ status: string; manageToken: string; businessSlug: string } | null> {
  const result = await sql.begin(async (tx) => {
    const [r] = await tx<{ id: string; status: string; business_id: string; rating: number }[]>`
      select id, status, business_id, rating from reviews where id = ${reviewId} for update`;
    if (!r || r.status !== 'pending_confirmation') return null;
    const reasons = await automatedRejectReasons(tx, r.id);
    const status = reasons.length ? 'rejected' : 'published';
    await tx`update reviews set status = ${status}, hold_reasons = ${reasons}, confirmed_at = now(),
               published_at = ${status === 'published' ? new Date() : null}, updated_at = now() where id = ${r.id}`;
    await tx`insert into moderation_actions (review_id, action, from_status, to_status, reason)
             values (${r.id}, 'email_confirmed', 'pending_confirmation', ${status},
                     ${reasons.length ? `Automatically rejected: ${reasons.join(', ')}` : 'Passed automated checks'})`;
    const manageToken = await createToken('review_manage', { refId: r.id, ttlHours: 24 * 365 * 3 }, tx);
    const [b] = await tx<{ slug: string; name: string }[]>`select slug, name from businesses where id = ${r.business_id}`;
    return { status, manageToken, businessSlug: b.slug, businessName: b.name, businessId: r.business_id, rating: r.rating };
  });
  if (!result) return null;
  if (result.status === 'published') await notifyOwners(result.businessId, result.businessName, result.rating);
  return { status: result.status, manageToken: result.manageToken, businessSlug: result.businessSlug };
}

async function notifyOwners(businessId: string, name: string, rating: number) {
  const owners = await sql<{ email: string }[]>`
    select u.email from business_members m join users u on u.id = m.user_id
    where m.business_id = ${businessId} and m.status = 'verified' and u.status = 'active'`;
  for (const o of owners) {
    await sendEmail({ to: o.email, template: 'new_review', ...templates.newReview(name, rating, `${env.appUrl}/dashboard/b/${businessId}/reviews`) });
  }
}

/** Every status change goes through here so the audit trail is complete. */
export async function setReviewStatus(tx: Tx, reviewId: string, to: 'published' | 'held' | 'rejected' | 'removed' | 'withdrawn',
  actorId: string | null, action: string, reason: string | null, notes: string | null) {
  const [r] = await tx<{ status: string }[]>`select status from reviews where id = ${reviewId} for update`;
  if (!r) throw new Error('review not found');
  await tx`update reviews set status = ${to}, updated_at = now(),
             published_at = case when ${to} = 'published' then coalesce(published_at, now()) else published_at end
           where id = ${reviewId}`;
  await tx`insert into moderation_actions (review_id, actor_user_id, action, from_status, to_status, reason, notes)
           values (${reviewId}, ${actorId}, ${action}, ${r.status}, ${to}, ${reason}, ${notes})`;
  return r.status;
}

export const REPORT_REASONS = {
  not_genuine: 'Not based on a genuine experience',
  conflict: 'Written by the business, a competitor or someone connected to them',
  personal_info: 'Contains personal or private information',
  harassment: 'Harassment, threats or hate',
  defamatory: 'Makes false statements of fact (possibly defamatory)',
  incentivised: 'Written in exchange for an incentive',
  spam: 'Spam or advertising',
  other: 'Something else',
} as const;

export const DISPUTE_REASONS = {
  not_a_customer: 'We have no record of this customer or experience',
  conflict: 'We believe this was written by a competitor or someone connected to us',
  personal_info: 'It reveals private or personal information',
  false_facts: 'It states facts we can show are false',
  harassment: 'It is abusive or threatening',
  other: 'Other',
} as const;

export const STATUS_LABELS: Record<string, string> = {
  pending_confirmation: 'Awaiting email confirmation',
  published: 'Published',
  held: 'Being checked',
  rejected: 'Not published — breaches the review policy',
  removed: 'Removed — not reconfirmed after a dispute',
  withdrawn: 'Withdrawn by the reviewer',
};
