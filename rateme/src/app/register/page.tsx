import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { AuthShell } from '@/components/AuthShell';
import { RegisterForm } from '@/components/AuthForms';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Create an account', robots: { index: false } };

export default async function Register({ searchParams }: { searchParams: Promise<{ intent?: string }> }) {
  const { intent } = await searchParams;
  if (await currentUser()) redirect('/dashboard');
  return (
    <AuthShell title="Create your business account" aside={
      <div className="max-w-md">
        <h2 className="text-4xl font-semibold">Get your business rated by real customers.</h2>
        <ol className="mt-6 space-y-3 text-ink-2">
          {['Create your account and confirm your email', 'Find your business or add it', 'Verify you own or manage it', 'Choose membership and pay securely', 'Download your QR code and start collecting ratings'].map((s, i) => (
            <li key={s} className="flex gap-3"><span className="display grid h-7 w-7 shrink-0 place-items-center rounded-full bg-sea text-sm text-white">{i + 1}</span>{s}</li>
          ))}
        </ol>
      </div>}>
      <RegisterForm intent={intent} />
      <p className="mt-6 text-center text-sm text-muted">Already have an account? <Link className="text-sea underline" href="/login">Sign in</Link></p>
      <p className="mt-2 text-center text-xs text-muted">Just want to rate a business? <Link className="underline" href="/search">No account needed</Link>.</p>
    </AuthShell>
  );
}
