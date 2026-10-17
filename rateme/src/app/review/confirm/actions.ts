'use server';
import { consumeToken } from '@/lib/tokens';
import { confirmReview, STATUS_LABELS } from '@/lib/reviews';
import { sendEmail, templates } from '@/lib/email';
import { sql } from '@/lib/db';
import { env } from '@/lib/env';
import { ipRateLimit } from '@/lib/security';

export type ConfirmState = { status?: string; slug?: string; manage?: string; error?: string };

export async function confirmReviewAction(_p: ConfirmState, form: FormData): Promise<ConfirmState> {
  if (!(await ipRateLimit('review-confirm', 30, 3600))) return { error: 'Too many attempts. Try again later.' };
  const tok = await consumeToken(String(form.get('token') ?? ''), 'review_confirm');
  if (!tok?.ref_id) return { error: 'This link has expired or has already been used. If you already confirmed, your review is in our system.' };
  const res = await confirmReview(tok.ref_id);
  if (!res) return { error: 'This review has already been confirmed or is no longer pending.' };
  const [r] = await sql<{ reviewer_email: string; name: string }[]>`select r.reviewer_email, b.name from reviews r join businesses b on b.id = r.business_id where r.id = ${tok.ref_id}`;
  await sendEmail({ to: r.reviewer_email, template: 'review_status', ...templates.reviewStatus(r.name, STATUS_LABELS[res.status], `${env.appUrl}/review/manage?token=${res.manageToken}`) });
  return { status: res.status, slug: res.businessSlug, manage: res.manageToken };
}
