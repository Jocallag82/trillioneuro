'use server';
import { redirect } from 'next/navigation';
import { peekToken } from '@/lib/tokens';
import { reconfirm, withdrawDisputed } from '@/lib/disputes';
import { ipRateLimit } from '@/lib/security';

export async function reconfirmAction(form: FormData) {
  const token = String(form.get('token') ?? '');
  const back = `/review/reconfirm?token=${encodeURIComponent(token)}`;
  if (form.get('confirm') !== 'yes' || !(await ipRateLimit('reconfirm', 20, 3600))) redirect(back);
  const tok = await peekToken(token, 'review_reconfirm');
  if (!tok?.ref_id) redirect(back);
  const res = await reconfirm(tok.ref_id, String(form.get('statement') ?? ''));
  redirect(`${back}&done=${res?.outcome ?? 'kept'}`);
}

export async function withdrawAction(form: FormData) {
  const token = String(form.get('token') ?? '');
  const back = `/review/reconfirm?token=${encodeURIComponent(token)}`;
  if (!(await ipRateLimit('reconfirm', 20, 3600))) redirect(back);
  const tok = await peekToken(token, 'review_reconfirm');
  if (!tok?.ref_id) redirect(back);
  await withdrawDisputed(tok.ref_id);
  redirect(`${back}&done=withdrawn`);
}
