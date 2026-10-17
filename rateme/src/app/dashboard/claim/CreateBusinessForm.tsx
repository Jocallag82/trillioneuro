'use client';
import { useActionState, type ReactNode } from 'react';
import Link from 'next/link';
import { createBusiness, type CreateState } from './actions';
import { SubmitButton } from '@/components/SubmitButton';

export function CreateBusinessForm({ fields }: { fields: ReactNode }) {
  const [s, a] = useActionState<CreateState, FormData>(createBusiness, {});
  return (
    <form action={a} className="space-y-5">
      {s.error && <div role="alert" className="notice notice-error">{s.error}</div>}
      {s.duplicates && s.duplicates.length > 0 && (
        <div className="notice notice-warn">
          <p className="font-semibold">We found similar listings in that county. Is one of these yours?</p>
          <ul className="mt-1 list-disc pl-5">{s.duplicates.map((d) => <li key={d.slug}><Link className="underline" href={`/dashboard/claim?business=${d.slug}`}>{d.name}</Link>{d.locality ? `, ${d.locality}` : ''}</li>)}</ul>
          <label className="mt-3 flex items-center gap-2"><input type="checkbox" name="confirm_new" value="yes" className="h-4 w-4" /> None of these — it’s a different business</label>
        </div>
      )}
      {fields}
      <label className="flex items-start gap-3 rounded-xl border border-line bg-white p-4 text-sm">
        <input type="checkbox" name="authority" value="yes" required className="mt-0.5 h-4 w-4 accent-[#0d5c61]" />
        <span>I own or am authorised to manage this business, it’s a legitimate business operating in the Republic of Ireland, and the details are accurate.</span>
      </label>
      <SubmitButton pendingText="Creating…">Create listing and verify</SubmitButton>
    </form>
  );
}
