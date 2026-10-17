import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { currentUser } from '@/lib/auth';
import { emailConfigured } from '@/lib/email';
import { isProduction } from '@/lib/env';
import { AuthShell } from '@/components/AuthShell';
import { VerifyEmailForm, ResendVerification } from '@/components/AuthForms';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Confirm your email', robots: { index: false } };

export default async function VerifyEmail({ searchParams }: { searchParams: Promise<{ token?: string; sent?: string }> }) {
  const { token } = await searchParams;
  if (token) {
    return <AuthShell title="Confirm your email"><p className="mb-4 text-ink-2">Click below to confirm this email address.</p><VerifyEmailForm token={token} /></AuthShell>;
  }
  const u = await currentUser();
  if (!u) redirect('/login');
  if (u.email_verified_at) redirect('/dashboard');
  return (
    <AuthShell title="Check your inbox">
      <p className="text-ink-2">We’ve sent a confirmation link to <strong>{u.email}</strong>. Open it to continue setting up your business.</p>
      {!emailConfigured() && !isProduction() && <p className="mt-3 rounded-lg bg-gorse-soft p-3 text-sm">Development mode: email is written to the outbox table instead of being sent.</p>}
      <div className="mt-6"><ResendVerification /></div>
    </AuthShell>
  );
}
