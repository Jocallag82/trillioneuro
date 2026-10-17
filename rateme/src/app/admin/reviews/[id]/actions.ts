'use server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { env } from '@/lib/env';
import { requireStaff } from '@/lib/auth';
import { setReviewStatus, STATUS_LABELS } from '@/lib/reviews';
import { sendEmail, templates } from '@/lib/email';
import { createToken } from '@/lib/tokens';
import { audit } from '@/lib/audit';

const back = (id: string, m: string) => `/admin/reviews/${id}?msg=${encodeURIComponent(m)}`;
const isUuid = (s: string) => /^[0-9a-f-]{36}$/i.test(s);

async function notifyReviewer(reviewId: string, override?: string) {
  const [r] = await sql<{ reviewer_email: string; name: string; status: string }[]>`select r.reviewer_email, r.status, b.name from reviews r join businesses b on b.id = r.business_id where r.id = ${reviewId}`;
  if (!r) return;
  const status = override ?? r.status;
  const manage = await createToken('review_manage', { refId: reviewId, ttlHours: 24 * 365 });
  await sendEmail({ to: r.reviewer_email, template: 'review_status', ...templates.reviewStatus(r.name, STATUS_LABELS[status] ?? status, `${env.appUrl}/review/manage?token=${manage}`) });
}

export async function moderateReview(form: FormData) {
  const staff = await requireStaff();
  const id = String(form.get('review_id') ?? '');
  const to = String(form.get('to') ?? '');
  const reason = String(form.get('reason') ?? '').trim() || null;
  const notes = String(form.get('notes') ?? '').trim().slice(0, 2000) || null;
  if (!isUuid(id)) redirect('/admin/reviews');
  if ((to === 'rejected' || to === 'removed') && !reason) redirect(back(id, 'Choose a policy reason before rejecting or removing.'));
  await sql.begin(async (tx) => {
    if (to === 'keep') {
      await tx`update reports set status = 'dismissed', resolved_by = ${staff.id}, resolved_at = now(), resolution_notes = ${notes} where review_id = ${id} and status = 'open'`;
      await tx`insert into moderation_actions (review_id, actor_user_id, action, reason, notes) values (${id}, ${staff.id}, 'reports_dismissed', 'No policy breach found', ${notes})`;
      return;
    }
    if (!['published', 'rejected', 'removed'].includes(to)) return;
    await setReviewStatus(tx, id, to as 'published' | 'rejected' | 'removed', staff.id, `moderator_${to}`, reason, notes);
    await tx`update reports set status = ${to === 'published' ? 'dismissed' : 'actioned'}, resolved_by = ${staff.id}, resolved_at = now() where review_id = ${id} and status = 'open'`;
  });
  if (to !== 'keep') await notifyReviewer(id);
  redirect(back(id, 'Decision recorded.'));
}

export async function resolveDispute(form: FormData) {
  const staff = await requireStaff();
  const disputeId = String(form.get('dispute_id') ?? '');
  const reviewId = String(form.get('review_id') ?? '');
  const outcome = String(form.get('outcome') ?? '');
  const finding = String(form.get('finding') ?? '').trim().slice(0, 3000);
  if (!isUuid(disputeId) || !isUuid(reviewId) || !['upheld', 'rejected'].includes(outcome) || finding.length < 10) redirect(back(reviewId, 'A finding of at least 10 characters is required.'));
  const info = await sql.begin(async (tx) => {
    const [d] = await tx<{ business_id: string; raised_by: string }[]>`
      update disputes set status = ${outcome}, finding = ${finding}, decided_by = ${staff.id}, decided_at = now()
      where id = ${disputeId} and status = 'open' returning business_id, raised_by`;
    if (!d) return null;
    if (outcome === 'upheld') await setReviewStatus(tx, reviewId, 'removed', staff.id, 'dispute_upheld', 'Business dispute upheld', finding);
    else await tx`insert into moderation_actions (review_id, actor_user_id, action, reason, notes) values (${reviewId}, ${staff.id}, 'dispute_rejected', 'Dispute not upheld', ${finding})`;
    const [u] = await tx<{ email: string; name: string }[]>`select u.email, b.name from users u, businesses b where u.id = ${d.raised_by} and b.id = ${d.business_id}`;
    return { ...u, businessId: d.business_id };
  });
  if (info) {
    await sendEmail({ to: info.email, template: 'dispute_decision', ...templates.disputeDecision(info.name, outcome === 'upheld' ? 'Upheld — the review has been removed' : 'Not upheld — the review stays published', finding, `${env.appUrl}/dashboard/b/${info.businessId}/reviews`) });
    if (outcome === 'upheld') await notifyReviewer(reviewId);
  }
  redirect(back(reviewId, 'Dispute resolved.'));
}

export async function decideAppeal(form: FormData) {
  const staff = await requireStaff();
  const appealId = String(form.get('appeal_id') ?? '');
  const reviewId = String(form.get('review_id') ?? '');
  const outcome = String(form.get('outcome') ?? '');
  const notes = String(form.get('notes') ?? '').trim().slice(0, 2000);
  if (!isUuid(appealId) || !isUuid(reviewId) || !['granted', 'denied'].includes(outcome)) redirect(back(reviewId, 'Invalid request.'));
  await sql.begin(async (tx) => {
    const [a] = await tx`update appeals set status = ${outcome}, decision_notes = ${notes}, decided_by = ${staff.id}, decided_at = now() where id = ${appealId} and status = 'open' returning id`;
    if (!a) return;
    if (outcome === 'granted') await setReviewStatus(tx, reviewId, 'published', staff.id, 'appeal_granted', 'Appeal granted', notes);
    else await tx`insert into moderation_actions (review_id, actor_user_id, action, reason, notes) values (${reviewId}, ${staff.id}, 'appeal_denied', 'Appeal denied', ${notes})`;
  });
  await notifyReviewer(reviewId);
  redirect(back(reviewId, 'Appeal decided.'));
}

export async function moderateResponse(form: FormData) {
  const staff = await requireStaff();
  const responseId = String(form.get('response_id') ?? '');
  const reviewId = String(form.get('review_id') ?? '');
  const to = form.get('to') === 'hidden' ? 'hidden' : 'published';
  if (!isUuid(responseId)) redirect('/admin/reviews');
  await sql`update review_responses set status = ${to}, updated_at = now() where id = ${responseId}`;
  await sql`insert into moderation_actions (response_id, review_id, actor_user_id, action, to_status) values (${responseId}, ${reviewId}, ${staff.id}, 'response_moderated', ${to})`;
  await audit(staff.id, 'review.response_moderated', 'review_response', responseId, { to });
  redirect(back(reviewId, `Response ${to}.`));
}
