import Link from 'next/link';
import type { Metadata } from 'next';
import { peekToken } from '@/lib/tokens';
import { sql } from '@/lib/db';
import { Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { Stars } from '@/components/Stars';
import { reconfirmAction } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reconfirm your review', robots: { index: false } };

export default async function Reconfirm({ searchParams }: { searchParams: Promise<{ token?: string; done?: string }> }) {
  const { token = '', done } = await searchParams;
  const tok = await peekToken(token, 'review_reconfirm');
  if (!tok?.ref_id) return <div className="mx-auto max-w-lg px-4 py-16"><Notice kind="error">This link is invalid or has expired.</Notice></div>;
  const [d] = await sql<{ reason: string; deadline_at: Date; status: string; rating: number; title: string | null; body: string | null; review_status: string; name: string; slug: string }[]>`
    select d.reason, d.deadline_at, d.status, r.rating, r.title, r.body, r.status review_status, b.name, b.slug
    from disputes d join reviews r on r.id = d.review_id join businesses b on b.id = d.business_id where d.id = ${tok.ref_id}`;
  if (!d) return <div className="mx-auto max-w-lg px-4 py-16"><Notice kind="error">This link is invalid.</Notice></div>;
  return (
    <div className="mx-auto max-w-lg px-4 py-14">
      <div className="card p-6 sm:p-8">
        <h1 className="text-2xl font-semibold">Do you stand by your review of {d.name}?</h1>
        {done ? (
          <div className="mt-4 space-y-4"><Notice kind="ok">Thanks — your review is published.</Notice><Link className="btn btn-primary" href={`/business/${d.slug}`}>View it</Link></div>
        ) : !['published', 'removed'].includes(d.review_status) ? (
          <div className="mt-4"><Notice kind="info">This review can no longer be reconfirmed.</Notice></div>
        ) : (
          <>
            <p className="mt-2 text-ink-2">It was questioned for this reason: <strong>{d.reason}</strong>.
              {d.review_status === 'removed' ? ' It was removed because it wasn’t reconfirmed in time — reconfirm now to restore it.' : ` If you don’t reconfirm by ${new Date(d.deadline_at).toLocaleDateString('en-IE', { day: 'numeric', month: 'long' })}, it will be removed automatically.`}</p>
            <blockquote className="mt-4 rounded-xl bg-paper p-4 text-sm"><Stars value={d.rating} size={13} />{d.title && <p className="mt-2 font-semibold">{d.title}</p>}{d.body && <p className="mt-1 text-ink-2">{d.body}</p>}</blockquote>
            <form action={reconfirmAction} className="mt-5 space-y-3">
              <input type="hidden" name="token" value={token} />
              <label className="flex items-start gap-3 text-sm"><input type="checkbox" name="confirm" value="yes" required className="mt-0.5 h-4 w-4 accent-[#0d5c61]" />
                <span>I confirm this review describes my own genuine experience and I have no connection to the business or its competitors.</span></label>
              <SubmitButton className="btn btn-primary w-full" pendingText="Saving…">Yes — keep my review published</SubmitButton>
            </form>
            <p className="mt-4 text-xs text-muted">Changed your mind? Do nothing and the review will be removed, or withdraw it now from your manage link.</p>
          </>
        )}
      </div>
    </div>
  );
}
