'use client';
import { useActionState } from 'react';
import Link from 'next/link';
import { confirmReviewAction, type ConfirmState } from './actions';
import { SubmitButton } from '@/components/SubmitButton';

export function ConfirmReviewForm({ token }: { token: string }) {
  const [state, action] = useActionState<ConfirmState, FormData>(confirmReviewAction, {});
  if (state.status) {
    return (
      <div className="mt-6 space-y-4" role="status">
        {state.status === 'published' ? (
          <div className="notice notice-ok">Thank you — your review is now published.</div>
        ) : (
          <div className="notice notice-warn">Your review couldn’t be published because it didn’t pass our automatic checks (for example, a connection to the business, or another review of this business from the same network recently). Details are on your manage page.</div>
        )}
        <div className="flex flex-col gap-2">
          {state.slug && <Link className="btn btn-primary" href={`/business/${state.slug}`}>View the business</Link>}
          {state.manage && <Link className="btn btn-ghost" href={`/review/manage?token=${state.manage}`}>Manage your review</Link>}
        </div>
        <p className="text-xs text-muted">We’ve also emailed you a private link to manage your review later.</p>
      </div>
    );
  }
  return (
    <form action={action} className="mt-6 space-y-3">
      <input type="hidden" name="token" value={token} />
      {state.error && <div role="alert" className="notice notice-error">{state.error}</div>}
      <SubmitButton className="btn btn-primary w-full text-base" pendingText="Confirming…">Yes, publish my review</SubmitButton>
    </form>
  );
}
