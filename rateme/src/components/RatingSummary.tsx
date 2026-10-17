import { Stars } from './Stars';

export function RatingSummary({ avg, count, dist }: { avg: string | null; count: number; dist: number[] }) {
  if (!count) {
    return (
      <div className="card p-5">
        <p className="display text-xl">No published ratings yet</p>
        <p className="mt-1 text-sm text-muted">We don’t show a score until real customers have rated this business.</p>
      </div>
    );
  }
  const n = Number(avg);
  return (
    <div className="card p-5">
      <div className="flex items-end gap-3">
        <span className="display text-5xl font-semibold leading-none">{n.toFixed(1)}</span>
        <div className="pb-1">
          <Stars value={n} size={16} />
          <p className="mt-1 text-sm text-muted">{count.toLocaleString('en-IE')} published {count === 1 ? 'rating' : 'ratings'}</p>
        </div>
      </div>
      <ul className="mt-4 space-y-1.5" aria-label="Rating distribution">
        {[5, 4, 3, 2, 1].map((star) => {
          const c = dist[star - 1] ?? 0;
          const pct = count ? Math.round((c / count) * 100) : 0;
          return (
            <li key={star} className="flex items-center gap-2 text-sm">
              <span className="w-12 shrink-0 text-muted">{star} star</span>
              <span className="h-2.5 flex-1 overflow-hidden rounded-full bg-paper-2">
                <span className="block h-full rounded-full bg-ink" style={{ width: `${pct}%` }} />
              </span>
              <span className="w-10 shrink-0 text-right tabular-nums text-muted">{c}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
