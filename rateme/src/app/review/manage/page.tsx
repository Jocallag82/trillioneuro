import Link from 'next/link';
import type { Metadata } from 'next';
import { peekToken } from '@/lib/tokens';
import { sql } from '@/lib/db';
import { STATUS_LABELS } from '@/lib/reviews';
import { HOLD_REASON_LABELS, type HoldReason } from '@/lib/screening';
import { Stars } from '@/components/Stars';
import { formatDate, formatMonth } from '@/lib/format';
import { withdrawReview, restoreReview } from './actions';
import { SubmitButton } from '@/components/SubmitButton';
import { Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Manage your review', robots: { index: false } };

export default async function ManageReview({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const { token = '', done } = await searchParams;
  const tok = await peekToken(token, 'review_manage');
  if (!tok?.ref_id) {
    return <div className="mx-auto max-w-lg px-4 py-16"><Notice kind="error">This link is invalid or has expired. If you need help with a review, <Link className="underline" href="/contact">contact us</Link>.</Notice></div>;
  }
  const [r] = await sql<{ id: string; rating: number; title: string | null; body: string | null; status: string; hold_reasons: string[]; experience_month: Date; created_at: Date; name: string; slug: string }[]>`
    select r.id, r.rating, r.title, r.body, r.status, r.hold_reasons, r.experience_month, r.created_at, b.name, b.slug
    from reviews r join businesses b on b.id = r.business_id where r.id = ${tok.ref_id}`;
  const [lastMod] = await sql<{ reason: string | null; notes: string | null }[]>`
    select reason, notes from moderation_actions where review_id = ${r.id} and actor_user_id is not null order by created_at desc limit 1`;
  const [pendingCheck] = await sql<{ deadline_at: Date }[]>`select deadline_at from disputes where review_id = ${r.id} and status = 'open'`;
  const canRestore = r.status === 'removed' && (await sql`select 1 from disputes where review_id = ${r.id} and status = 'upheld'`).length > 0;
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Your review of {r.name}</h1>
      {done === 'withdrawn' && <div className="mt-4"><Notice kind="ok">Your review has been withdrawn and is no longer public.</Notice></div>}
      {done === 'restored' && <div className="mt-4"><Notice kind="ok">Your review is published again.</Notice></div>}
      {pendingCheck && r.status === 'published' && <div className="mt-4"><Notice kind="warn">This review has been questioned. Reconfirm it by {formatDate(pendingCheck.deadline_at)} or it will be removed automatically — use the reconfirm button below.</Notice></div>}
      <div className="card mt-6 p-5">
        <p className="text-sm font-semibold">Status: <span className={r.status === 'published' ? 'text-ok' : 'text-ink'}>{STATUS_LABELS[r.status]}</span></p>
        {r.status === 'rejected' && r.hold_reasons.length > 0 && (
          <p className="mt-1 text-sm text-muted">Automatically rejected because: {r.hold_reasons.map((h) => HOLD_REASON_LABELS[h as HoldReason] ?? h).join('; ')}.</p>
        )}
        {['rejected', 'removed'].includes(r.status) && lastMod?.reason && !r.hold_reasons.length && <p className="mt-1 text-sm text-muted">Reason: {lastMod.reason}</p>}
        <div className="mt-4"><Stars value={r.rating} size={15} /></div>
        {r.title && <p className="mt-2 font-semibold">{r.title}</p>}
        {r.body && <p className="mt-1 whitespace-pre-line text-ink-2">{r.body}</p>}
        <p className="mt-3 text-sm text-muted">Experience: {formatMonth(r.experience_month)} · Submitted {formatDate(r.created_at)}</p>
        {r.status === 'published' && <Link className="mt-3 inline-block text-sm text-sea underline" href={`/business/${r.slug}`}>See it on the business profile</Link>}
      </div>

      {['published', 'pending_confirmation'].includes(r.status) && (
        <form action={withdrawReview} className="card mt-6 p-5">
          <input type="hidden" name="token" value={token} />
          <h2 className="font-sans text-lg font-bold tracking-normal">Withdraw your review</h2>
          <p className="mt-1 text-sm text-ink-2">This removes your review from public view. It can’t be undone, but you can write a new review later.</p>
          <SubmitButton className="btn btn-ghost mt-4" pendingText="Withdrawing…">Withdraw review</SubmitButton>
        </form>
      )}

      {(canRestore || (pendingCheck && r.status === 'published')) && (
        <form action={restoreReview} className="card mt-6 p-5">
          <input type="hidden" name="token" value={token} />
          <h2 className="font-sans text-lg font-bold tracking-normal">{canRestore ? 'Restore your review' : 'Reconfirm your review'}</h2>
          <p className="mt-1 text-sm text-ink-2">Confirm this is your own genuine experience and the review {canRestore ? 'is published again' : 'stays published'}. No one at RateMe.ie needs to approve it.</p>
          <label className="mt-3 flex items-start gap-3 text-sm"><input type="checkbox" name="confirm" value="yes" required className="mt-0.5 h-4 w-4 accent-[#1d4a35]" /><span>I confirm this is my own genuine experience.</span></label>
          <SubmitButton className="btn btn-primary mt-3" pendingText="Saving…">{canRestore ? 'Restore my review' : 'Keep my review published'}</SubmitButton>
        </form>
      )}
      {r.status === 'rejected' && <p className="mt-6 text-sm text-ink-2">You can write a new review that follows the <Link className="text-sea underline" href="/review-policy">review policy</Link>.</p>}
      <p className="mt-6 text-xs text-muted">Keep this page’s link private. Anyone with it can manage this review.</p>
    </div>
  );
}
