import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser, safeNext } from '@/lib/auth';
import { AuthShell } from '@/components/AuthShell';
import { LoginForm } from '@/components/AuthForms';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Sign in', robots: { index: false } };

export default async function Login({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  if (await currentUser()) redirect(safeNext(next));
  return (
    <AuthShell title="Sign in" aside={<div className="max-w-md"><h2 className="text-4xl font-semibold">Welcome back.</h2><p className="mt-3 text-lg text-ink-2">Manage your business profile, download your QR code and reply to your customers.</p></div>}>
      <LoginForm next={next} />
      <p className="mt-6 text-center text-sm text-muted">New to RateMe.ie? <Link className="text-sea underline" href="/register">Create an account</Link></p>
      <p className="mt-2 text-center text-xs text-muted">Customers don’t need an account to leave a rating.</p>
    </AuthShell>
  );
}
