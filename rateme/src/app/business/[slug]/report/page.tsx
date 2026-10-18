import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { sql } from '@/lib/db';
import { REPORT_REASONS } from '@/lib/reviews';
import { BotFields, Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { reportReview } from './actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Report a review', robots: { index: false } };

export default async function ReportPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ review?: string; sent?: string; error?: string }> }) {
  const { slug } = await params; const { review, sent, error } = await searchParams;
  if (!review || !/^[0-9a-f-]{36}$/i.test(review)) notFound();
  const [r] = await sql<{ id: string; title: string | null; body: string | null; reviewer_name: string; name: string }[]>`
    select r.id, r.title, r.body, r.reviewer_name, b.name from reviews r join businesses b on b.id = r.business_id
    where r.id = ${review} and b.slug = ${slug} and r.status = 'published'`;
  if (!r) notFound();
  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-3xl font-semibold">Report a review</h1>
      <p className="mt-2 text-ink-2">Tell us how this review of <strong>{r.name}</strong> breaks our <Link className="text-sea underline" href="/review-policy">review policy</Link>. When several people report the same review, the reviewer is automatically asked to reconfirm it — unconfirmed reviews are removed.</p>
      {sent ? (
        <div className="mt-6 space-y-4"><Notice kind="ok">Thanks — your report has been recorded.</Notice><Link className="btn btn-ghost" href={`/business/${slug}`}>Back to the business</Link></div>
      ) : (
        <form action={reportReview} className="mt-6 space-y-5">
          {error && <Notice kind="error">{error}</Notice>}
          <blockquote className="card border-l-4 border-l-line p-4 text-sm text-ink-2">
            <p className="font-semibold text-ink">{r.title ?? `Review by ${r.reviewer_name}`}</p>
            {r.body && <p className="mt-1 line-clamp-4">{r.body}</p>}
          </blockquote>
          <input type="hidden" name="review_id" value={r.id} /><input type="hidden" name="slug" value={slug} />
          <BotFields />
          <fieldset className="space-y-2">
            <legend className="mb-2 font-semibold">What’s the problem?</legend>
            {Object.entries(REPORT_REASONS).map(([k, v]) => (
              <label key={k} className="flex items-center gap-3 rounded-xl border border-line bg-white p-3"><input type="radio" name="reason" value={k} required className="h-4 w-4 accent-[#1d4a35]" />{v}</label>
            ))}
          </fieldset>
          <label className="field"><span className="label">Details <span className="font-normal text-muted">(optional)</span></span>
            <textarea name="details" className="textarea" maxLength={2000} placeholder="Anything that explains the problem." /></label>
          <label className="field"><span className="label">Your email <span className="font-normal text-muted">(optional)</span></span>
            <input name="email" type="email" className="input" autoComplete="email" /><span className="hint">Only if you’d like us to be able to follow up. Never shown publicly.</span></label>
          <SubmitButton pendingText="Sending…">Send report</SubmitButton>
        </form>
      )}
    </div>
  );
}
