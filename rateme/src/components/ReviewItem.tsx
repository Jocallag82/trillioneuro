import Link from 'next/link';
import type { PublicReview } from '@/lib/businesses';
import { Stars } from './Stars';
import { formatDate, formatMonth, relativeDays } from '@/lib/format';

export function ReviewItem({ r, businessName, slug, showReport = true }: { r: PublicReview; businessName: string; slug: string; showReport?: boolean }) {
  return (
    <article className="card p-5" aria-labelledby={`rv-${r.id}`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Stars value={r.rating} size={15} label={`Rated ${r.rating} out of 5`} />
        <time className="text-sm text-muted" dateTime={new Date(r.published_at).toISOString()} title={formatDate(r.published_at)}>Published {relativeDays(r.published_at)}</time>
      </div>
      {r.title && <h3 id={`rv-${r.id}`} className="mt-3 font-sans text-lg font-bold tracking-normal">{r.title}</h3>}
      {!r.title && <h3 id={`rv-${r.id}`} className="sr-only">Review by {r.reviewer_name}</h3>}
      {r.body && <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-2">{r.body}</p>}
      <p className="mt-3 text-sm text-muted">
        <span className="font-semibold text-ink">{r.reviewer_name}</span>
        {' · '}Experience: {formatMonth(r.experience_month)}{r.experience_type ? ` · ${r.experience_type}` : ''}
        {r.source === 'qr' && ' · Via the business’s QR code'}
      </p>
      <p className="mt-1 text-xs text-muted">Reviewer declared this is their own genuine experience and confirmed their email.</p>
      {r.response_body && (
        <div className="mt-4 rounded-xl border-l-4 border-sea bg-sea-soft/60 p-4">
          <p className="text-sm font-semibold text-sea-2">Response from {businessName}</p>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-ink-2">{r.response_body}</p>
        </div>
      )}
      {showReport && (
        <div className="mt-3 text-right">
          <Link href={`/business/${slug}/report?review=${r.id}`} className="text-xs text-muted underline hover:text-ink" rel="nofollow">Report this review</Link>
        </div>
      )}
    </article>
  );
}
