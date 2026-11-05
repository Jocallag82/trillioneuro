import Link from 'next/link';
import type { Metadata } from 'next';
import { peekToken } from '@/lib/tokens';
import { sql } from '@/lib/db';
import { Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { Stars } from '@/components/Stars';
import { reconfirmAction, withdrawAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reconfirm your review', robots: { index: false } };

export default async function Reconfirm({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const { token = '', done } = await searchParams;
  const tok = await peekToken(token, 'review_reconfirm');
  if (!tok?.ref_id) return <div className="mx-auto max-w-lg px-4 py-16"><Notice kind="error">This link is invalid or has expired.</Notice></div>;
  const [d] = await sql<{ reason: string; allegation: string; source: string; deadline_at: Date; status: string; decided_by: string | null; rating: number; title: string | null; body: string | null; review_status: string; name: string; slug: string }[]>`
    select d.reason, d.allegation, d.source, d.deadline_at, d.status, d.decided_by, r.rating, r.title, r.body, r.status review_status, b.name, b.slug
    from disputes d join reviews r on r.id = d.review_id join businesses b on b.id = d.business_id where d.id = ${tok.ref_id}`;
  if (!d) return <div className="mx-auto max-w-lg px-4 py-16"><Notice kind="error">This link is invalid.</Notice></div>;
  return (
    <div className="mx-auto max-w-lg px-4 py-14">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">Do you stand by your review of {d.name}?</h1>
        {done ? (
          <div className="mt-4 space-y-4">
            <Notice kind="ok">{done === 'withdrawn' ? 'Your review has been withdrawn.' : done === 'escalated' ? 'Thanks. Your review stays published while a moderator looks at both sides. We’ll email you the decision.' : 'Thanks — your review stays published.'}</Notice>
            {done !== 'withdrawn' && <Link className="btn btn-primary" href={`/business/${d.slug}`}>View it</Link>}
          </div>
        ) : !(['open', 'escalated'].includes(d.status) && d.review_status === 'published') && !(d.status === 'upheld' && !d.decided_by && d.review_status === 'removed') ? (
          <div className="mt-4"><Notice kind="info">This dispute has been closed. If a decision was made you’ll find it, and how to appeal, on your review’s manage page.</Notice></div>
        ) : (
          <>
            <p className="mt-2 text-ink-2">{d.source === 'business' ? `${d.name} disputed it` : 'Several visitors reported it'} for this reason: <strong>{d.reason}</strong>.</p>
            {d.source === 'business' && <p className="mt-2 rounded-xl border border-line p-3 text-sm text-ink-2"><span className="font-semibold">The business says:</span> {d.allegation}</p>}
            <p className="mt-3 text-sm text-ink-2">{d.review_status === 'removed'
              ? 'It was removed under our old rule because it wasn’t reconfirmed in time. Stand by it now to restore it.'
              : `Your review stays published while this is looked at. Please reply by ${new Date(d.deadline_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'long' })}. If you don’t, a moderator decides — it is not removed just because you didn’t reply.`}</p>
            <blockquote className="mt-4 rounded-xl bg-paper p-4 text-sm"><Stars value={d.rating} size={13} />{d.title && <p className="mt-2 font-semibold">{d.title}</p>}{d.body && <p className="mt-1 text-ink-2">{d.body}</p>}</blockquote>
            <form action={reconfirmAction} className="mt-5 space-y-3">
              <input type="hidden" name="token" value={token} />
              <label className="field"><span className="label">Anything a moderator should know? (optional, never shown publicly or to the business)</span>
                <textarea name="statement" className="textarea" maxLength={3000} placeholder="e.g. when you visited, what you bought, a booking reference. Don’t include anyone else’s personal data." /></label>
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirm" value="yes" required className="mt-0.5 h-4 w-4 accent-[#1d4a35]" />
                <span>I confirm this review describes my own genuine experience and I have no connection to the business or its competitors.</span></label>
              <SubmitButton className="btn btn-primary w-full" pendingText="Saving…">I stand by my review</SubmitButton>
            </form>
            {d.review_status === 'published' && (
              <form action={withdrawAction} className="mt-3">
                <input type="hidden" name="token" value={token} />
                <SubmitButton className="btn btn-ghost w-full" pendingText="Withdrawing…">Withdraw my review instead</SubmitButton>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
