import Link from 'next/link';
import type { Metadata } from 'next';
import { loadBusinessCtx } from '@/lib/dashboard';
import { sql } from '@/lib/db';
import { DISPUTE_REASONS } from '@/lib/reviews';
import { BizNav } from '../BizNav';
import { Stars } from '@/components/Stars';
import { EmptyState, Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { formatDate, formatMonth } from '@/lib/format';
import { respondToReview, disputeReview, appealDecision } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Reviews' };

type Row = { id: string; rating: number; title: string | null; body: string | null; reviewer_name: string; experience_month: Date; published_at: Date;
  response_body: string | null; response_status: string | null; dispute_status: string | null; dispute_finding: string | null; appeal_until: Date | null; appealed: boolean };

export default async function Reviews({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ msg?: string; err?: string }> }) {
  const { id } = await params; const sp = await searchParams;
  const ctx = await loadBusinessCtx(id, `/dashboard/b/${id}/reviews`);
  const rows = await sql<Row[]>`
    select r.id, r.rating, r.title, r.body, r.reviewer_name, r.experience_month, r.published_at,
      rr.body response_body, rr.status response_status,
      (select d.status from disputes d where d.review_id = r.id order by d.created_at desc limit 1) dispute_status,
      (select d.finding from disputes d where d.review_id = r.id order by d.created_at desc limit 1) dispute_finding,
      (select d.appeal_until from disputes d where d.review_id = r.id order by d.created_at desc limit 1) appeal_until,
      exists(select 1 from appeals a where a.review_id = r.id and a.appellant = 'business') appealed
    from reviews r left join review_responses rr on rr.review_id = r.id
    where r.business_id = ${id} and r.status = 'published' order by r.published_at desc limit 200`;
  const canRespond = ctx.verified && ctx.ent.active;
  return (
    <div>
      <BizNav ctx={ctx} active="reviews" />
      <div className="space-y-3">
        {sp.msg && <Notice kind="ok">{sp.msg}</Notice>}
        {sp.err && <Notice kind="error">{sp.err}</Notice>}
        {!canRespond && ctx.verified && <Notice kind="info">Replying to reviews is a member feature. <Link className="underline" href={`/dashboard/b/${id}/membership`}>Activate membership</Link>. Disputing a review that breaks our policy is free.</Notice>}
      </div>
      <details className="card mt-4 p-4 text-sm">
        <summary className="cursor-pointer font-semibold">Response policy — read before replying</summary>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-ink-2">
          <li>Be professional. Thank the customer, address the issue and explain what you’ll do.</li>
          <li>Never reveal customer information (names, addresses, order details, phone numbers).</li>
          <li>No threats, including legal threats, and no pressure to change or remove a review.</li>
          <li>Don’t misrepresent facts. If you dispute what happened, say so calmly or use the dispute option.</li>
          <li>Responses are public and can be moderated under the same policy as reviews.</li>
        </ul>
      </details>
      <div className="mt-6 space-y-4">
        {rows.length === 0 && <EmptyState title="No published reviews yet">Share your QR code with customers to start collecting genuine reviews.</EmptyState>}
        {rows.map((r) => (
          <article key={r.id} className="card p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <Stars value={r.rating} size={14} />
              <span className="text-sm text-muted">{formatDate(r.published_at)}</span>
            </div>
            {r.title && <h3 className="mt-2 font-sans text-lg font-bold tracking-normal">{r.title}</h3>}
            {r.body && <p className="mt-1 whitespace-pre-line text-ink-2">{r.body}</p>}
            <p className="mt-2 text-sm text-muted">{r.reviewer_name} · experience {formatMonth(r.experience_month)}</p>
            {r.response_body && <div className="mt-3 rounded-xl bg-sea-soft/60 p-3 text-sm"><strong>Your response{r.response_status === 'hidden' ? ' (hidden by moderation)' : ''}:</strong> {r.response_body}</div>}
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {canRespond && (
                <details className="rounded-xl border border-line p-3">
                  <summary className="cursor-pointer text-sm font-semibold">{r.response_body ? 'Edit response' : 'Respond publicly'}</summary>
                  <form action={respondToReview} className="mt-3 space-y-2">
                    <input type="hidden" name="business_id" value={id} /><input type="hidden" name="review_id" value={r.id} />
                    <textarea name="body" className="textarea" minLength={2} maxLength={2000} required defaultValue={r.response_body ?? ''} aria-label="Your response" />
                    <SubmitButton className="btn btn-primary btn-sm" pendingText="Saving…">Publish response</SubmitButton>
                  </form>
                </details>
              )}
              {ctx.verified && (
                r.dispute_status === 'open' ? <p className="rounded-xl border border-line p-3 text-sm text-ink-2">Dispute in progress: the reviewer has been asked to respond. The review stays published meanwhile.</p> :
                r.dispute_status === 'escalated' ? <p className="rounded-xl border border-line p-3 text-sm text-ink-2">With a moderator. You’ll get a written decision by email.</p> :
                r.dispute_status === 'rejected' || r.dispute_status === 'upheld' ? (
                  <div className="rounded-xl border border-line p-3 text-sm text-ink-2">
                    <p><strong>Decision:</strong> {r.dispute_finding}</p>
                    {r.appealed ? <p className="mt-2 text-xs text-muted">You have appealed this decision.</p>
                      : r.appeal_until && new Date(r.appeal_until) > new Date() ? (
                      <details className="mt-2"><summary className="cursor-pointer font-semibold">Appeal (once, until {formatDate(r.appeal_until)})</summary>
                        <form action={appealDecision} className="mt-2 space-y-2">
                          <input type="hidden" name="business_id" value={id} /><input type="hidden" name="review_id" value={r.id} />
                          <textarea name="body" className="textarea" minLength={30} maxLength={3000} required placeholder="What new information should a moderator consider?" aria-label="Appeal" />
                          <SubmitButton className="btn btn-ghost btn-sm" pendingText="Sending…">Submit appeal</SubmitButton>
                        </form></details>) : null}
                  </div>) :
                <details className="rounded-xl border border-line p-3">
                  <summary className="cursor-pointer text-sm font-semibold">Dispute this review</summary>
                  <form action={disputeReview} className="mt-3 space-y-2">
                    <input type="hidden" name="business_id" value={id} /><input type="hidden" name="review_id" value={r.id} />
                    <select name="reason" className="select" required defaultValue="" aria-label="Reason"><option value="" disabled>Specific reason</option>{Object.entries(DISPUTE_REASONS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <textarea name="allegation" className="textarea" minLength={30} maxLength={3000} required placeholder="What is wrong with this review? Be specific (e.g. no booking under that name in that month). The reviewer sees the reason and this explanation." aria-label="Explanation" />
                    <textarea name="evidence" className="textarea" maxLength={3000} placeholder="Evidence for the moderator (optional): what records you checked, dates, reference numbers. Don’t include customers’ personal data." aria-label="Evidence" />
                    <p className="text-xs text-muted">The reviewer gets 14 days to stand by or withdraw the review. A reviewer not replying does <strong>not</strong> remove the review — a moderator decides and both sides get a written finding they can appeal. Up to 5 disputes every 30 days. Membership has no effect on the outcome.</p>
                    <SubmitButton className="btn btn-ghost btn-sm" pendingText="Sending…">Submit dispute</SubmitButton>
                  </form>
                </details>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
