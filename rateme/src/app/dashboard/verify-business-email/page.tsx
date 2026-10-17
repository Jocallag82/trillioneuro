import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { SubmitButton } from '@/components/SubmitButton';
import { confirmBusinessEmail } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Confirm business email' };

export default async function Page({ searchParams }: { searchParams: Promise<{ token?: string; err?: string }> }) {
  const { token = '', err } = await searchParams;
  await requireUser({ next: `/dashboard/verify-business-email?token=${encodeURIComponent(token)}` });
  return (
    <div className="card mx-auto max-w-lg p-8 text-center">
      <h1 className="text-2xl font-semibold">Confirm business email</h1>
      {err ? <p className="notice notice-error mt-4">{err}</p> : <p className="mt-2 text-ink-2">Confirm that you control this business email address to verify ownership.</p>}
      {!err && <form action={confirmBusinessEmail} className="mt-6"><input type="hidden" name="token" value={token} /><SubmitButton pendingText="Confirming…">Confirm and verify</SubmitButton></form>}
    </div>
  );
}
