'use server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { loadBusinessCtx } from '@/lib/dashboard';
import { DISPUTE_REASONS } from '@/lib/reviews';
import { screenText } from '@/lib/screening';
import { audit } from '@/lib/audit';
import { rateLimit } from '@/lib/security';
import { openReconfirmation } from '@/lib/disputes';
import { draftReply, TONES, type Tone } from '@/lib/ai';

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
  const res = await openReconfirmation({ reviewId, businessId: id, source: 'business', raisedBy: ctx.user.id,
    reason: DISPUTE_REASONS[reason as keyof typeof DISPUTE_REASONS], allegation });
  if (!res.ok) redirect(back(id, 'err', res.error));
  redirect(back(id, 'msg', 'Dispute submitted. We’ve asked the reviewer to reconfirm. If they don’t within 14 days, the review is removed automatically.'));
}

export type DraftState = { text?: string; error?: string; n?: number };

/** Returns an AI draft into the reply box. Never publishes: the owner edits and clicks Publish. */
export async function draftReplyAction(prev: DraftState, form: FormData): Promise<DraftState> {
  const id = String(form.get('business_id') ?? '');
  const reviewId = String(form.get('review_id') ?? '');
  const tone = String(form.get('tone') ?? 'professional');
  const ctx = await loadBusinessCtx(id, `/dashboard/b/${id}/reviews`);
  if (!ctx.verified || !ctx.ent.active) return { error: 'Reply drafts are a member feature.' };
  if (!(tone in TONES)) return { error: 'Choose a tone.' };
  if (!(await rateLimit(`draft:${ctx.user.id}`, 15, 3600))) return { error: 'Too many drafts in a short time. Try again later.' };
  const [r] = await sql<{ rating: number; title: string | null; body: string | null }[]>`
    select rating, title, body from reviews where id = ${reviewId} and business_id = ${id} and status = 'published'`;
  if (!r) return { error: 'Review not found.' };
  const res = await draftReply({ businessId: id, userId: ctx.user.id, reviewId, businessName: ctx.business.name, rating: r.rating, title: r.title, body: r.body, tone: tone as Tone });
  return res.ok ? { text: res.text, n: (prev.n ?? 0) + 1 } : { error: res.error, n: prev.n };
}
