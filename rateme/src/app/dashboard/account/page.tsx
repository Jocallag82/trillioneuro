import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { updateName, changePassword, deleteAccount } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Account' };

export default async function Account({ searchParams }: { searchParams: Promise<{ msg?: string; err?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser({ next: '/dashboard/account', verified: false });
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/dashboard" className="text-sm text-muted hover:underline">← Dashboard</Link>
      <h1 className="text-3xl font-semibold">Account settings</h1>
      {sp.msg && <Notice kind="ok">{sp.msg}</Notice>}{sp.err && <Notice kind="error">{sp.err}</Notice>}
      <form action={updateName} className="card space-y-3 p-5">
        <h2 className="font-sans text-lg font-bold tracking-normal">Your details</h2>
        <p className="text-sm text-muted">Email: {user.email} {user.email_verified_at ? '(confirmed)' : '(not confirmed)'}</p>
        <label className="field"><span className="label">Name</span><input name="display_name" className="input" defaultValue={user.display_name} maxLength={80} required /></label>
        <SubmitButton className="btn btn-ghost" pendingText="Saving…">Save</SubmitButton>
      </form>
      <form action={changePassword} className="card space-y-3 p-5">
        <h2 className="font-sans text-lg font-bold tracking-normal">Change password</h2>
        <label className="field"><span className="label">Current password</span><input name="current" type="password" className="input" autoComplete="current-password" required /></label>
        <label className="field"><span className="label">New password</span><input name="password" type="password" className="input" autoComplete="new-password" minLength={10} required /></label>
        <SubmitButton className="btn btn-ghost" pendingText="Saving…">Change password</SubmitButton>
        <p className="text-xs text-muted">Changing your password signs you out everywhere else.</p>
      </form>
      <section className="card space-y-3 p-5">
        <h2 className="font-sans text-lg font-bold tracking-normal">Your data</h2>
        <p className="text-sm text-ink-2">Download a copy of the personal data your account holds (GDPR Article 15/20).</p>
        <a className="btn btn-ghost" href="/api/account/export">Download my data (JSON)</a>
      </section>
      <form action={deleteAccount} className="card space-y-3 border-danger/30 p-5">
        <h2 className="font-sans text-lg font-bold tracking-normal text-danger">Delete account</h2>
        <p className="text-sm text-ink-2">This signs you out, removes your access to any business and anonymises your account. Business listings and customers’ reviews stay published, because they belong to the public record. Cancel any active membership first.</p>
        <label className="field"><span className="label">Type DELETE to confirm</span><input name="confirm" className="input" required pattern="DELETE" /></label>
        <SubmitButton className="btn btn-danger" pendingText="Deleting…">Delete my account</SubmitButton>
      </form>
    </div>
  );
}
