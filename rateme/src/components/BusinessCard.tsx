import Link from 'next/link';
import type { BusinessCard as Card } from '@/lib/businesses';
import { RatingNumber } from './Stars';

export function Initials({ name, logoId, size = 52 }: { name: string; logoId?: string | null; size?: number }) {
  if (logoId) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={`/api/logo/${logoId}`} alt="" width={size} height={size} className="shrink-0 rounded-xl border border-line bg-white object-contain" style={{ width: size, height: size }} />;
  }
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]?.toUpperCase()).join('');
  return (
    <span aria-hidden="true" className="display grid shrink-0 place-items-center rounded-xl bg-sea-soft text-lg font-semibold text-sea-2" style={{ width: size, height: size }}>
      {initials}
    </span>
  );
}

export function BusinessCard({ b, member }: { b: Card; member?: boolean }) {
  return (
    <Link href={`/business/${b.slug}`} className="card group flex gap-4 p-4 transition hover:border-sea/40 hover:shadow-[0_6px_24px_-12px_rgba(16,32,43,.25)]">
      <Initials name={b.name} logoId={b.logo_id} />
      <div className="min-w-0 flex-1">
        <h3 className="truncate font-sans text-[1.05rem] font-bold tracking-normal group-hover:text-sea">{b.name}</h3>
        <p className="truncate text-sm text-muted">{b.category_name} · {b.locality_name ? `${b.locality_name}, ` : ''}Co. {b.county_name}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <RatingNumber avg={b.rating_avg} count={b.rating_count} />
          {b.ownership_verified_at && <span className="badge badge-sea">Owner verified</span>}
          {member && <span className="badge badge-muted">Member</span>}
        </div>
      </div>
    </Link>
  );
}
