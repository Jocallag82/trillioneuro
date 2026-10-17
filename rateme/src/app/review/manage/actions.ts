'use server';
import { redirect } from 'next/navigation';
import { peekToken } from '@/lib/tokens';
import { sql } from '@/lib/db';
import { setReviewStatus } from '@/lib/reviews';
import { ipRateLimit } from '@/lib/security';

export async function withdrawReview(form: FormData) {
  const token = String(form.get('token') ?? '');
  const tok = await peekToken(token, 'review_manage');
  if (!tok?.ref_id) redirect('/review/manage');
  await sql.begin(async (tx) => {
    const [r] = await tx<{ status: string }[]>`select status from reviews where id = ${tok.ref_id} for update`;
    if (r && ['published', 'held', 'pending_confirmation'].includes(r.status)) {
      await setReviewStatus(tx, tok.ref_id!, 'withdrawn', null, 'withdrawn_by_reviewer', 'Withdrawn by the reviewer', null);
    }
  });
  redirect(`/review/manage?token=${encodeURIComponent(token)}&done=withdrawn`);
}

export async function appealReview(form: FormData) {
  const token = String(form.get('token') ?? '');
  const body = String(form.get('body') ?? '').trim().slice(0, 3000);
  const tok = await peekToken(token, 'review_manage');
  if (!tok?.ref_id || body.length < 10) redirect(`/review/manage?token=${encodeURIComponent(token)}`);
  if (!(await ipRateLimit('appeal', 5, 86400))) redirect(`/review/manage?token=${encodeURIComponent(token)}`);
  await sql`insert into appeals (review_id, appellant, body) values (${tok.ref_id}, 'reviewer', ${body}) on conflict do nothing`;
  await sql`insert into moderation_actions (review_id, action, reason) values (${tok.ref_id}, 'appeal_opened', 'Reviewer asked for reconsideration')`;
  redirect(`/review/manage?token=${encodeURIComponent(token)}&done=appeal`);
}
