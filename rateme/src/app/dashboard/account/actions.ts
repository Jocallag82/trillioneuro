'use server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireUser, destroyAllSessions, createSession, destroySession } from '@/lib/auth';
import { hashPassword, verifyPassword, passwordProblem } from '@/lib/password';
import { audit } from '@/lib/audit';
import { rateLimit } from '@/lib/security';
import { randomToken } from '@/lib/util';

const back = (k: 'msg' | 'err', m: string) => `/dashboard/account?${k}=${encodeURIComponent(m)}`;

export async function updateName(form: FormData) {
  const u = await requireUser({ verified: false });
  const name = String(form.get('display_name') ?? '').trim().slice(0, 80);
  if (!name) redirect(back('err', 'Enter a name.'));
  await sql`update users set display_name = ${name}, updated_at = now() where id = ${u.id}`;
  redirect(back('msg', 'Saved.'));
}

export async function changePassword(form: FormData) {
  const u = await requireUser({ verified: false });
  if (!(await rateLimit(`pwchange:${u.id}`, 5, 3600))) redirect(back('err', 'Too many attempts.'));
  const [row] = await sql<{ password_hash: string }[]>`select password_hash from users where id = ${u.id}`;
  if (!(await verifyPassword(String(form.get('current') ?? ''), row.password_hash))) redirect(back('err', 'Your current password is wrong.'));
  const pw = String(form.get('password') ?? '');
  const p = passwordProblem(pw);
  if (p) redirect(back('err', p));
  await sql`update users set password_hash = ${await hashPassword(pw)}, updated_at = now() where id = ${u.id}`;
  await destroyAllSessions(u.id);
  await createSession(u.id);
  await audit(u.id, 'user.password_changed', 'user', u.id);
  redirect(back('msg', 'Password changed.'));
}

export async function deleteAccount(form: FormData) {
  const u = await requireUser({ verified: false });
  if (form.get('confirm') !== 'DELETE') redirect(back('err', 'Type DELETE to confirm.'));
  const [active] = await sql`select 1 from subscriptions s join business_members m on m.business_id = s.business_id
                             where m.user_id = ${u.id} and s.status in ('active','trialing','past_due') and not s.cancel_at_period_end`;
  if (active) redirect(back('err', 'Cancel the renewal of your active membership first (Membership page), then delete your account.'));
  await sql.begin(async (tx) => {
    await tx`update business_members set status = 'revoked' where user_id = ${u.id}`;
    await tx`update users set email = ${`deleted-${u.id}@deleted.invalid`}, display_name = 'Deleted user', password_hash = ${'disabled$' + randomToken(16)},
               status = 'deleted', updated_at = now() where id = ${u.id}`;
    await tx`delete from sessions where user_id = ${u.id}`;
    await tx`insert into audit_events (actor_user_id, action, entity_type, entity_id) values (${u.id}, 'user.deleted', 'user', ${u.id})`;
  });
  await destroySession();
  redirect('/?account=deleted');
}
