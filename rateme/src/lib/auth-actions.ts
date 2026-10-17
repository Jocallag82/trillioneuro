'use server';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { sql } from './db';
import { env } from './env';
import { hashPassword, verifyPassword, passwordProblem } from './password';
import { createSession, destroySession, destroyAllSessions, currentUser, safeNext } from './auth';
import { createToken, consumeToken } from './tokens';
import { sendEmail, templates } from './email';
import { ipRateLimit, rateLimit, looksAutomated } from './security';
import { audit } from './audit';

export type AuthState = { error?: string; ok?: boolean; message?: string };

const emailSchema = z.string().trim().toLowerCase().email().max(200);

export async function registerAction(_p: AuthState, form: FormData): Promise<AuthState> {
  if (looksAutomated(form)) return { error: 'Something went wrong. Please try again.' };
  if (!(await ipRateLimit('register', 8, 3600))) return { error: 'Too many sign-ups from this connection. Please try again later.' };
  const email = emailSchema.safeParse(form.get('email'));
  const name = String(form.get('display_name') ?? '').trim().slice(0, 80);
  const password = String(form.get('password') ?? '');
  if (!email.success) return { error: 'Enter a valid email address.' };
  if (!name) return { error: 'Enter your name.' };
  const pwErr = passwordProblem(password);
  if (pwErr) return { error: pwErr };
  if (form.get('terms') !== 'yes') return { error: 'Please accept the terms and privacy notice.' };
  const hash = await hashPassword(password);
  const rows = await sql<{ id: string }[]>`
    insert into users (email, password_hash, display_name) values (${email.data}, ${hash}, ${name})
    on conflict (email) do nothing returning id`;
  if (!rows.length) {
    // Don't reveal whether an account exists; tell the owner by email instead.
    await sendEmail({ to: email.data, template: 'account_exists', subject: 'You already have a RateMe.ie account',
      text: `Someone tried to create a RateMe.ie account with this email. If it was you, sign in here: ${env.appUrl}/login\n\nForgot your password? ${env.appUrl}/forgot-password` });
    return { ok: true, message: 'check-email' };
  }
  const id = rows[0].id;
  await audit(id, 'user.registered', 'user', id);
  const raw = await createToken('verify_email', { userId: id, ttlHours: 48 });
  await sendEmail({ to: email.data, template: 'verify_email', ...templates.verifyEmail(name, `${env.appUrl}/verify-email?token=${raw}`) });
  await createSession(id);
  redirect(`/verify-email?sent=1${form.get('intent') === 'business' ? '&intent=business' : ''}`);
}

export async function loginAction(_p: AuthState, form: FormData): Promise<AuthState> {
  const email = emailSchema.safeParse(form.get('email'));
  const password = String(form.get('password') ?? '');
  if (!email.success || !password) return { error: 'Enter your email and password.' };
  const ipOk = await ipRateLimit('login', 20, 900);
  const acctOk = await rateLimit(`login-acct:${email.data}`, 8, 900);
  if (!ipOk || !acctOk) return { error: 'Too many sign-in attempts. Wait 15 minutes and try again.' };
  const [u] = await sql<{ id: string; password_hash: string; status: string }[]>`select id, password_hash, status from users where email = ${email.data}`;
  // Always run a hash comparison so response time doesn't reveal whether the account exists.
  const ok = await verifyPassword(password, u?.password_hash ?? 'scrypt$16384$8$1$AAAAAAAAAAAAAAAAAAAAAA==$AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA==');
  if (!u || !ok) return { error: 'That email and password don’t match.' };
  if (u.status !== 'active') return { error: 'This account is not active. Contact support if you think this is a mistake.' };
  await createSession(u.id);
  redirect(safeNext(form.get('next')));
}

export async function logoutAction() {
  await destroySession();
  redirect('/');
}

export async function resendVerification(): Promise<AuthState> {
  const u = await currentUser();
  if (!u) redirect('/login');
  if (u.email_verified_at) redirect('/dashboard');
  if (!(await rateLimit(`resend:${u.id}`, 3, 3600))) return { error: 'We’ve sent a few emails already. Check your spam folder, or try again in an hour.' };
  const raw = await createToken('verify_email', { userId: u.id, ttlHours: 48 });
  const { delivered } = await sendEmail({ to: u.email, template: 'verify_email', ...templates.verifyEmail(u.display_name, `${env.appUrl}/verify-email?token=${raw}`) });
  return delivered || env.appEnv !== 'production' ? { ok: true, message: 'Sent — check your inbox.' } : { error: 'Email delivery is temporarily unavailable. Please try again later.' };
}

export async function verifyEmailAction(_p: AuthState, form: FormData): Promise<AuthState> {
  const tok = await consumeToken(String(form.get('token') ?? ''), 'verify_email');
  if (!tok?.user_id) return { error: 'This link has expired or was already used. Sign in and request a new one.' };
  await sql`update users set email_verified_at = coalesce(email_verified_at, now()), updated_at = now() where id = ${tok.user_id}`;
  await audit(tok.user_id, 'user.email_verified', 'user', tok.user_id);
  const u = await currentUser();
  if (!u || u.id !== tok.user_id) await createSession(tok.user_id);
  redirect('/dashboard?verified=1');
}

export async function forgotPasswordAction(_p: AuthState, form: FormData): Promise<AuthState> {
  const email = emailSchema.safeParse(form.get('email'));
  if (!email.success) return { error: 'Enter a valid email address.' };
  if (!(await ipRateLimit('forgot', 5, 3600)) || !(await rateLimit(`forgot:${email.data}`, 3, 3600))) return { ok: true };
  const [u] = await sql<{ id: string }[]>`select id from users where email = ${email.data} and status = 'active'`;
  if (u) {
    const raw = await createToken('reset_password', { userId: u.id, ttlHours: 1 });
    await sendEmail({ to: email.data, template: 'reset_password', ...templates.resetPassword(`${env.appUrl}/reset-password?token=${raw}`) });
  }
  return { ok: true };
}

export async function resetPasswordAction(_p: AuthState, form: FormData): Promise<AuthState> {
  const password = String(form.get('password') ?? '');
  const pwErr = passwordProblem(password);
  if (pwErr) return { error: pwErr };
  const tok = await consumeToken(String(form.get('token') ?? ''), 'reset_password');
  if (!tok?.user_id) return { error: 'This reset link has expired or was already used.' };
  await sql`update users set password_hash = ${await hashPassword(password)}, email_verified_at = coalesce(email_verified_at, now()), updated_at = now() where id = ${tok.user_id}`;
  await destroyAllSessions(tok.user_id);
  await audit(tok.user_id, 'user.password_reset', 'user', tok.user_id);
  await createSession(tok.user_id);
  redirect('/dashboard');
}
