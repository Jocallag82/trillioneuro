'use client';
import { useActionState, type ReactNode } from 'react';
import Link from 'next/link';
import { suggestBusiness, type SuggestState } from './actions';
import { SubmitButton } from '@/components/SubmitButton';
import { FormStarted } from '@/components/FormStarted';

export function AddBusinessForm({ fields }: { fields: ReactNode }) {
  const [state, action] = useActionState<SuggestState, FormData>(suggestBusiness, {});
  if (state.ok) {
    return (
      <div className="card p-6" role="status">
        <p className="display text-2xl">Thanks — we’ll check it</p>
        <p className="mt-2 text-ink-2">We review suggestions to make sure they’re real, legitimate businesses and not duplicates. Once it’s published, you’ll be able to rate it.</p>
        <Link href="/" className="btn btn-ghost mt-4">Back to home</Link>
      </div>
    );
  }
  return (
    <form action={action} className="card space-y-6 p-5 sm:p-7">
      <div className="sr-only-hp" aria-hidden="true"><label>Leave empty<input name="website_confirm" tabIndex={-1} autoComplete="off" /></label></div>
      <FormStarted />
      {state.error && <div role="alert" className="notice notice-error">{state.error}</div>}
      {state.duplicates && state.duplicates.length > 0 && (
        <div className="notice notice-warn">
          <p className="font-semibold">This might already be listed:</p>
          <ul className="mt-1 list-disc pl-5">{state.duplicates.map((d) => <li key={d.slug}>{d.status === 'published' ? <Link className="underline" href={`/business/${d.slug}`}>{d.name}</Link> : <>{d.name} (awaiting review)</>}{d.locality ? `, ${d.locality}` : ''}</li>)}</ul>
        </div>
      )}
      {fields}
      <label className="field"><span className="label">Your email <span className="font-normal text-muted">(optional)</span></span>
        <input name="suggester_email" type="email" className="input" /><span className="hint">Only if you’d like us to tell you when it’s published.</span></label>
      <SubmitButton pendingText="Sending…">Suggest this business</SubmitButton>
    </form>
  );
}
