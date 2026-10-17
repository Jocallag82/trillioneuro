const STAR = 'M12 2.8l2.8 5.7 6.3.9-4.6 4.5 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.4l6.3-.9L12 2.8z';

/** Display-only star tiles. Partial fill reflects the true average; never rounded up. */
export function Stars({ value, size = 18, label }: { value: number; size?: number; label?: string }) {
  const v = Math.max(0, Math.min(5, value));
  return (
    <span className="inline-flex gap-[3px]" role="img" aria-label={label ?? `${v.toFixed(1)} out of 5 stars`}>
      {[0, 1, 2, 3, 4].map((i) => {
        const fill = Math.max(0, Math.min(1, v - i));
        return (
          <span key={i} className="relative inline-block overflow-hidden rounded-[5px] bg-paper-2" style={{ width: size + 6, height: size + 6 }}>
            <span className="absolute inset-y-0 left-0 bg-gorse" style={{ width: `${fill * 100}%` }} />
            <svg viewBox="0 0 24 24" width={size} height={size} className="absolute" style={{ left: 3, top: 3 }} aria-hidden="true">
              <path d={STAR} fill={fill > 0 ? '#10202b' : '#b9b1a3'} />
            </svg>
          </span>
        );
      })}
    </span>
  );
}

export function RatingNumber({ avg, count }: { avg: string | number | null; count: number }) {
  if (!count || avg === null) return <span className="text-sm text-muted">No ratings yet</span>;
  const n = Number(avg);
  return (
    <span className="inline-flex items-center gap-2">
      <Stars value={n} size={14} />
      <span className="font-semibold">{n.toFixed(1)}</span>
      <span className="text-sm text-muted">({count.toLocaleString('en-IE')})</span>
    </span>
  );
}
