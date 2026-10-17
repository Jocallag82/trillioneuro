'use server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { loadBusinessCtx } from '@/lib/dashboard';
import { DISPUTE_REASONS } from '@/lib/reviews';
import { screenText } from '@/lib/screening';
import { audit } from '@/lib/audit';
import { rateLimit } from '@/lib/security';

const back = (id: string, k: 'msg' | 'err', m: string) => `/dashboard/b/${id}/reviews?${k}=${encodeURIComponent(m)}`;

export async function respondToReview(form: FormData) {
  const id = String(form.get('business_id') ?? '');
  const reviewId = String(form.get('review_id') ?? '');
  const ctx = await loadBusinessCtx(id, `/dashboard/b/${id}/reviews`);
  if (!ctx.verified || !ctx.ent.active) redirect(back(id, 'err', 'Replying to reviews requires verified ownership and an active membership.'));
  const body = String(form.get('body') ?? '').trim().slice(0, 2000);
  if (body.length < 2) redirect(back(id, 'err', 'Write a response first.'));
  const flags = screenText(null, body);
  if (flags.includes('contact_details')) redirect(back(id, 'err', 'Please remove phone numbers or email addresses — responses must not include personal contact details.'));
  if (flags.includes('threat') || flags.includes('abusive_language')) redirect(back(id, 'err', 'Your response appears to contain abusive or threatening language. Please revise it.'));
  if (!(await rateLimit(`respond:${ctx.user.id}`, 60, 3600))) redirect(back(id, 'err', 'Too many responses in a short time.'));
  // The review must belong to THIS business — prevents responding to other businesses' reviews by editing the form.
  const [r] = await sql`select 1 from reviews where id = ${reviewId} and business_id = ${id} and status = 'published'`;
  if (!r) redirect(back(id, 'err', 'Review not found.'));
  await sql`insert into review_responses (review_id, business_id, author_user_id, body) values (${reviewId}, ${id}, ${ctx.user.id}, ${body})
            on conflict (review_id) do update set body = excluded.body, author_user_id = excluded.author_user_id, updated_at = now()
            where review_responses.status = 'published'`;
  await audit(ctx.user.id, 'review.response_saved', 'review', reviewId, { business: id });
  redirect(back(id, 'msg', 'Response published.'));
}

export async function disputeReview(form: FormData) {
  const id = String(form.get('business_id') ?? '');
  const reviewId = String(form.get('review_id') ?? '');
  const ctx = await loadBusinessCtx(id, `/dashboard/b/${id}/reviews`);
  if (!ctx.verified) redirect(back(id, 'err', 'Only verified owners can dispute reviews.'));
  const reason = String(form.get('reason') ?? '');
  const allegation = String(form.get('allegation') ?? '').trim().slice(0, 3000);
  if (!(reason in DISPUTE_REASONS) || allegation.length < 10) redirect(back(id, 'err', 'Choose a reason and explain the problem.'));
  if (!(await rateLimit(`dispute:${id}`, 20, 86400))) redirect(back(id, 'err', 'You’ve raised many disputes today. A moderator will work through the existing ones first.'));
  const [r] = await sql`select 1 from reviews where id = ${reviewId} and business_id = ${id} and status = 'published'`;
  if (!r) redirect(back(id, 'err', 'Review not found.'));
  try {
    await sql`insert into disputes (review_id, business_id, raised_by, reason, allegation) values (${reviewId}, ${id}, ${ctx.user.id}, ${reason}, ${allegation})`;
  } catch (e) {
    if ((e as { code?: string }).code === '23505') redirect(back(id, 'err', 'There is already an open dispute for this review.'));
    throw e;
  }
  await sql`insert into moderation_actions (review_id, actor_user_id, action, reason) values (${reviewId}, ${ctx.user.id}, 'dispute_opened', ${DISPUTE_REASONS[reason as keyof typeof DISPUTE_REASONS]})`;
  redirect(back(id, 'msg', 'Dispute submitted. The review stays visible while a moderator reviews it.'));
}
