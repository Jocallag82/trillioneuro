'use server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { consumeToken } from '@/lib/tokens';
import { approveMembership, notifyVerification } from '@/lib/verification';

export async function confirmBusinessEmail(form: FormData) {
  const user = await requireUser();
  const token = String(form.get('token') ?? '');
  const res = await sql.begin(async (tx) => {
    const tok = await consumeToken(token, 'business_email', tx);
    if (!tok?.ref_id || tok.user_id !== user.id) return { error: 'This link has expired, was already used, or belongs to a different account.' };
    const [r] = await tx<{ id: string; member_id: string; business_id: string; status: string }[]>`
      select id, member_id, business_id, status from verification_requests where id = ${tok.ref_id} and user_id = ${user.id} for update`;
    if (!r || r.status !== 'pending') return { error: 'This verification request is no longer open.' };
    const ok = await approveMembership(tx, { memberId: r.member_id, requestId: r.id, actorId: null, method: 'email_domain' });
    return { ok, businessId: r.business_id };
  });
  if ('error' in res) redirect(`/dashboard/verify-business-email?err=${encodeURIComponent(res.error!)}`);
  if (res.ok) await notifyVerification(res.ok.email, res.ok.name, res.businessId, true, null);
  redirect(`/dashboard/b/${res.businessId}/membership?verified=1`);
}
