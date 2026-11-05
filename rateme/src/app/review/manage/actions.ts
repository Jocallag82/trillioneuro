'use server';
import { redirect } from 'next/navigation';
import { peekToken } from '@/lib/tokens';
import { sql } from '@/lib/db';
import { setReviewStatus } from '@/lib/reviews';
import { ipRateLimit } from '@/lib/security';
import { reconfirm, submitAppeal } from '@/lib/disputes';

export async function withdrawReview(form: FormData) {
  const token = String(form.get('token') ?? '');
  const tok = await peekToken(token, 'review_manage');
  if (!tok?.ref_id) redirect('/review/manage');
  await sql.begin(async (tx) => {
    const [r] = await tx<{ status: string }[]>`select status from reviews where id = ${tok.ref_id} for update`;
    if (r && ['published', 'pending_confirmation'].includes(r.status)) {
      await setReviewStatus(tx, tok.ref_id!, 'withdrawn', null, 'withdrawn_by_reviewer', 'Withdrawn by the reviewer', null);
    }
  });
  redirect(`/review/manage?token=${encodeURIComponent(token)}&done=withdrawn`);
}

export async function restoreReview(form: FormData) {
  const token = String(form.get('token') ?? '');
  const tok = await peekToken(token, 'review_manage');
  if (!tok?.ref_id || form.get('confirm') !== 'yes') redirect(`/review/manage?token=${encodeURIComponent(token)}`);
  if (!(await ipRateLimit('restore', 10, 3600))) redirect(`/review/manage?token=${encodeURIComponent(token)}`);
  // Only active disputes, or legacy automatic removals (no human decided). Moderator removals go through appeal.
  const [d] = await sql<{ id: string }[]>`select id from disputes where review_id = ${tok.ref_id}
    and (status in ('open','escalated') or (status = 'upheld' and decided_by is null)) order by created_at desc limit 1`;
  const res = d ? await reconfirm(d.id, String(form.get('statement') ?? '')) : null;
  redirect(`/review/manage?token=${encodeURIComponent(token)}&done=${res?.outcome === 'escalated' ? 'escalated' : 'restored'}`);
}

export async function appealAsReviewer(form: FormData) {
  const token = String(form.get('token') ?? '');
  const back = `/review/manage?token=${encodeURIComponent(token)}`;
  const tok = await peekToken(token, 'review_manage');
  if (!tok?.ref_id || !(await ipRateLimit('appeal', 5, 3600))) redirect(back);
  const res = await submitAppeal({ reviewId: tok.ref_id, appellant: 'reviewer', userId: null, body: String(form.get('body') ?? '') });
  redirect(res.ok ? `${back}&done=appealed` : `${back}&err=${encodeURIComponent(res.error)}`);
}
