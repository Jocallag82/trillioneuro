import Link from 'next/link';
import { SORTS, MIN_RATED_REVIEWS, type Sort } from '@/lib/businesses';

/** Sort links plus a plain statement of how the chosen order works. */
export function SortNav({ current, hrefFor, include }: { current: Sort; hrefFor: (s: Sort) => string; include: Sort[] }) {
  const explain: Record<Sort, string> = {
    relevance: 'Closest name or service match first.',
    rated: `Average of published ratings, highest first. Only businesses with at least ${MIN_RATED_REVIEWS} published reviews are included, so one review can't top the list.`,
    reviewed: 'Most published reviews first. Businesses with no reviews are listed too, after those with reviews.',
    recent: 'Businesses with the most recent published review first.',
    new: 'Most recently added listings first.',
  };
  return (
    <div className="mb-5">
      <nav aria-label="Sort businesses" className="flex flex-wrap items-center gap-1.5 text-sm">
        <span className="mr-1 font-medium text-ink-2">Sort:</span>
        {include.map((s) => (
          <Link key={s} href={hrefFor(s)} aria-current={current === s ? 'true' : undefined} rel="nofollow"
            className={`rounded-full border border-line px-3 py-1 ${current === s ? 'bg-ink text-white' : 'bg-white hover:bg-paper-2'}`}>{SORTS[s]}</Link>
        ))}
      </nav>
      <p className="mt-2 text-xs text-muted">{explain[current]} Paid membership never affects order. <Link className="underline" href="/how-it-works#ranking">How ranking works</Link></p>
    </div>
  );
}
