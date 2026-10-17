'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { loginAction, registerAction, forgotPasswordAction, resetPasswordAction, verifyEmailAction, resendVerification, type AuthState } from '@/lib/auth-actions';
import { SubmitButton } from './SubmitButton';
import { FormStarted } from './FormStarted';

function Err({ s }: { s: AuthState }) {
  return s.error ? <div role="alert" className="notice notice-error">{s.error}</div> : null;
}

export function LoginForm({ next }: { next?: string }) {
  const [s, a] = useActionState(loginAction, {});
  return (
    <form action={a} className="space-y-4">
      <Err s={s} />
      <input type="hidden" name="next" value={next ?? ''} />
      <label className="field"><span className="label">Email</span><input name="email" type="email" className="input" autoComplete="email" required /></label>
      <label className="field"><span className="label">Password</span><input name="password" type="password" className="input" autoComplete="current-password" required /></label>
      <SubmitButton className="btn btn-primary w-full" pendingText="Signing in…">Sign in</SubmitButton>
      <p className="text-center text-sm"><Link className="text-sea underline" href="/forgot-password">Forgot your password?</Link></p>
    </form>
  );
}

export function RegisterForm({ intent }: { intent?: string }) {
  const [s, a] = useActionState(registerAction, {});
  if (s.ok) return <div className="notice notice-info" role="status">Check your inbox — we’ve sent you an email with the next step.</div>;
  return (
    <form action={a} className="space-y-4">
      <Err s={s} />
      <input type="hidden" name="intent" value={intent ?? ''} />
      <div className="sr-only-hp" aria-hidden="true"><label>Leave empty<input name="website_confirm" tabIndex={-1} autoComplete="off" /></label></div>
      <FormStarted />
      <label className="field"><span className="label">Your name</span><input name="display_name" className="input" autoComplete="name" required maxLength={80} /></label>
      <label className="field"><span className="label">Email</span><input name="email" type="email" className="input" autoComplete="email" required /><span className="hint">Use your business email if you have one (e.g. you@yourbusiness.ie) — it can verify ownership instantly.</span></label>
      <label className="field"><span className="label">Password</span><input name="password" type="password" className="input" autoComplete="new-password" required minLength={10} /><span className="hint">At least 10 characters.</span></label>
      <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="terms" value="yes" required className="mt-0.5 h-4 w-4 accent-[#0d5c61]" />
        <span>I agree to the <Link className="text-sea underline" href="/terms" target="_blank">terms of service</Link> and have read the <Link className="text-sea underline" href="/privacy" target="_blank">privacy notice</Link>.</span></label>
      <SubmitButton className="btn btn-primary w-full" pendingText="Creating account…">Create account</SubmitButton>
    </form>
  );
}

export function ForgotForm() {
  const [s, a] = useActionState(forgotPasswordAction, {});
  if (s.ok) return <div className="notice notice-info" role="status">If an account exists for that email, we’ve sent a reset link. It expires in 1 hour.</div>;
  return (
    <form action={a} className="space-y-4">
      <Err s={s} />
      <label className="field"><span className="label">Email</span><input name="email" type="email" className="input" autoComplete="email" required /></label>
      <SubmitButton className="btn btn-primary w-full" pendingText="Sending…">Send reset link</SubmitButton>
    </form>
  );
}

export function ResetForm({ token }: { token: string }) {
  const [s, a] = useActionState(resetPasswordAction, {});
  return (
    <form action={a} className="space-y-4">
      <Err s={s} />
      <input type="hidden" name="token" value={token} />
      <label className="field"><span className="label">New password</span><input name="password" type="password" className="input" autoComplete="new-password" required minLength={10} /></label>
      <SubmitButton className="btn btn-primary w-full" pendingText="Saving…">Set new password</SubmitButton>
    </form>
  );
}

export function VerifyEmailForm({ token }: { token: string }) {
  const [s, a] = useActionState(verifyEmailAction, {});
  return (
    <form action={a} className="space-y-4">
      <Err s={s} />
      <input type="hidden" name="token" value={token} />
      <SubmitButton className="btn btn-primary w-full" pendingText="Confirming…">Confirm my email</SubmitButton>
    </form>
  );
}

export function ResendVerification() {
  const [s, a] = useActionState(async () => resendVerification(), {} as AuthState);
  return (
    <form action={a} className="space-y-3">
      <Err s={s} />
      {s.ok && <div className="notice notice-ok" role="status">{s.message}</div>}
      <SubmitButton className="btn btn-ghost" pendingText="Sending…">Resend the email</SubmitButton>
    </form>
  );
}
