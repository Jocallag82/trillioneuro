import Link from 'next/link';
import type { Metadata } from 'next';
import { ConfirmReviewForm } from './ConfirmReviewForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Confirm your review', robots: { index: false } };

// Confirmation needs an explicit click (POST), so email link scanners can't publish reviews on someone's behalf.
export default async function ConfirmReview({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <div className="mx-auto max-w-lg px-4 py-16">
      <div className="card p-6 text-center sm:p-10">
        <h1 className="text-2xl font-semibold">Confirm your review</h1>
        {token ? (
          <>
            <p className="mt-2 text-ink-2">One last step: confirm that you wrote this review and that it reflects your own genuine experience.</p>
            <ConfirmReviewForm token={token} />
          </>
        ) : (
          <p className="mt-2 text-ink-2">This link is incomplete. Please use the full link from your email. <Link className="text-sea underline" href="/">Go home</Link></p>
        )}
      </div>
    </div>
  );
}
