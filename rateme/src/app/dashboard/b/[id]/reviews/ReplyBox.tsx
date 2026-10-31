'use client';
import { useActionState, useEffect, useRef } from 'react';
import { draftReplyAction, respondToReview, type DraftState } from './actions';
import { SubmitButton } from '@/components/SubmitButton';

const TONES = [['professional', 'Professional'], ['friendly', 'Friendly'], ['empathetic', 'Empathetic'], ['concise', 'Concise']] as const;

export function ReplyBox({ businessId, reviewId, initial, aiOn }: { businessId: string; reviewId: string; initial: string; aiOn: boolean }) {
  const [d, draft, drafting] = useActionState<DraftState, FormData>(draftReplyAction, {});
  const ref = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { if (d.text && ref.current) { ref.current.value = d.text; ref.current.focus(); } }, [d.text, d.n]);
  return (
    <div className="mt-3 space-y-2">
      {aiOn && (
        <form action={draft} className="flex flex-wrap items-center gap-2">
          <input type="hidden" name="business_id" value={businessId} /><input type="hidden" name="review_id" value={reviewId} />
          <label className="sr-only" htmlFor={`tone-${reviewId}`}>Tone</label>
          <select id={`tone-${reviewId}`} name="tone" className="select w-auto py-1.5 text-sm" defaultValue="professional">
            {TONES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
          <button className="btn btn-ghost btn-sm" disabled={drafting}>{drafting ? 'Drafting…' : 'Draft a reply'}</button>
          <span className="text-xs text-muted">AI writes a starting point from this review only. Check it, edit it, then publish.</span>
        </form>
      )}
      {d.error && <p role="alert" className="text-sm text-danger">{d.error}</p>}
      {d.text && <p role="status" className="text-xs text-ok">Draft added below. It is not published until you click Publish response.</p>}
      <form action={respondToReview} className="space-y-2">
        <input type="hidden" name="business_id" value={businessId} /><input type="hidden" name="review_id" value={reviewId} />
        <textarea ref={ref} name="body" className="textarea" minLength={2} maxLength={2000} required defaultValue={initial} aria-label="Your response" />
        <SubmitButton className="btn btn-primary btn-sm" pendingText="Saving…">Publish response</SubmitButton>
      </form>
    </div>
  );
}
