'use server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { env } from '@/lib/env';
import { requireStaff } from '@/lib/auth';
import { setReviewStatus, STATUS_LABELS } from '@/lib/reviews';
import { sendEmail, templates } from '@/lib/email';
import { createToken } from '@/lib/tokens';
import { audit } from '@/lib/audit';
import { decideDispute, decideAppeal as decideAppealLib } from '@/lib/disputes';

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
  if (!isUuid(disputeId) || !isUuid(reviewId) || !['upheld', 'rejected'].includes(outcome) || finding.length < 30) redirect(back(reviewId, 'A written finding of at least 30 characters is required — it is sent to both parties.'));
  const ok = await decideDispute({ disputeId, staffId: staff.id, outcome: outcome as 'upheld' | 'rejected', finding });
  redirect(back(reviewId, ok ? 'Dispute decided. Both parties have been notified.' : 'This dispute was already decided.'));
}

export async function decideAppeal(form: FormData) {
  const staff = await requireStaff();
  const appealId = String(form.get('appeal_id') ?? '');
  const reviewId = String(form.get('review_id') ?? '');
  const outcome = String(form.get('outcome') ?? '');
  const notes = String(form.get('notes') ?? '').trim().slice(0, 2000);
  if (!isUuid(appealId) || !isUuid(reviewId) || !['granted', 'denied'].includes(outcome) || notes.length < 10) redirect(back(reviewId, 'Decision notes (10+ characters) are required.'));
  const done = await decideAppealLib({ appealId, staffId: staff.id, outcome: outcome as 'granted' | 'denied', notes });
  if (done) { await notifyReviewer(reviewId); await audit(staff.id, 'review.appeal_decided', 'review', reviewId, { outcome }); }
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
