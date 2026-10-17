'use server';
import { redirect } from 'next/navigation';
import { peekToken } from '@/lib/tokens';
import { sql } from '@/lib/db';
import { setReviewStatus } from '@/lib/reviews';
import { ipRateLimit } from '@/lib/security';
import { reconfirm } from '@/lib/disputes';

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
  const [d] = await sql<{ id: string }[]>`select id from disputes where review_id = ${tok.ref_id} and status in ('open','upheld') order by created_at desc limit 1`;
  if (d) await reconfirm(d.id);
  redirect(`/review/manage?token=${encodeURIComponent(token)}&done=restored`);
}
