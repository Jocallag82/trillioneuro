import Link from 'next/link';
import { reviewConfidence } from '@/lib/confidence';

/** Volume/recency indicator. Never a claim about authenticity. */
export function ConfidenceBadge({ count, lastReviewAt, full }: { count: number; lastReviewAt: Date | string | null; full?: boolean }) {
  const c = reviewConfidence(count, lastReviewAt);
  if (c.level === 'none') return null;
  const tone = c.level === 'established' && !c.stale ? 'badge-sea' : 'badge-muted';
  if (!full) return <span className={`badge ${tone}`} title={c.detail}>{c.label}</span>;
  return (
    <div className="mt-4 rounded-xl border border-line p-3 text-sm">
      <p className="font-semibold">Score confidence: <span className={`badge ${tone} ml-1`}>{c.label}</span></p>
      <p className="mt-1 text-ink-2">{c.detail}</p>
      <p className="mt-1 text-xs text-muted">Based on number and recency of reviews only. <Link className="underline" href="/how-it-works#confidence">How this works</Link></p>
    </div>
  );
}
