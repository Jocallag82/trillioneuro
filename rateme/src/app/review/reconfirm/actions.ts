'use server';
import { redirect } from 'next/navigation';
import { peekToken } from '@/lib/tokens';
import { reconfirm } from '@/lib/disputes';
import { ipRateLimit } from '@/lib/security';

export async function reconfirmAction(form: FormData) {
  const token = String(form.get('token') ?? '');
  const back = `/review/reconfirm?token=${encodeURIComponent(token)}`;
  if (form.get('confirm') !== 'yes' || !(await ipRateLimit('reconfirm', 20, 3600))) redirect(back);
  const tok = await peekToken(token, 'review_reconfirm');
  if (!tok?.ref_id) redirect(back);
  await reconfirm(tok.ref_id);
  redirect(`${back}&done=1`);
}
