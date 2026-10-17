import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { Stars } from '@/components/Stars';
import { formatDate } from '@/lib/format';
import { HOLD_REASON_LABELS, type HoldReason } from '@/lib/screening';

const FILTERS: Record<string, string> = { held: 'Held', reported: 'Reported', disputed: 'Disputed', appealed: 'Appealed', published: 'Published', rejected: 'Rejected', removed: 'Removed', pending_confirmation: 'Unconfirmed' };

export default async function AdminReviews({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireStaff();
  const { status = 'held', q } = await searchParams;
  const cond =
    status === 'reported' ? sql`r.id in (select review_id from reports where status = 'open' and review_id is not null)`
    : status === 'disputed' ? sql`r.id in (select review_id from disputes where status = 'open')`
    : status === 'appealed' ? sql`r.id in (select review_id from appeals where status = 'open')`
    : sql`r.status = ${FILTERS[status] ? status : 'held'}`;
  const rows = await sql<{ id: string; rating: number; title: string | null; body: string | null; status: string; hold_reasons: string[]; created_at: Date; business: string; reports: number }[]>`
    select r.id, r.rating, r.title, r.body, r.status, r.hold_reasons, r.created_at, b.name business,
      (select count(*)::int from reports p where p.review_id = r.id and p.status = 'open') reports
    from reviews r join businesses b on b.id = r.business_id
    where ${cond} ${q ? sql`and (b.name ilike ${'%' + q + '%'} or r.reviewer_email = ${q.toLowerCase()})` : sql``}
    order by r.created_at asc limit 100`;
  return (
    <div>
      <h1 className="text-3xl font-semibold">Review moderation</h1>
      <p className="mt-1 text-sm text-muted">Oldest first. Decide on policy grounds only — never on star rating or on whether the business is a paying member.</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(FILTERS).map(([k, v]) => <Link key={k} href={`/admin/reviews?status=${k}`} className={`badge px-3 py-1.5 ${status === k ? 'badge-sea' : 'badge-muted'}`}>{v}</Link>)}
      </div>
      <form className="mt-4 flex gap-2"><input type="hidden" name="status" value={status} /><input name="q" defaultValue={q} className="input max-w-sm" placeholder="Business name or reviewer email" aria-label="Search" /><button className="btn btn-ghost">Search</button></form>
      <ul className="mt-6 space-y-3">
        {rows.length === 0 && <li className="text-muted">Nothing in this queue.</li>}
        {rows.map((r) => (
          <li key={r.id}>
            <Link href={`/admin/reviews/${r.id}`} className="card block p-4 hover:border-sea/40">
              <div className="flex flex-wrap items-center gap-3"><Stars value={r.rating} size={12} /><strong>{r.business}</strong><span className="badge badge-muted">{r.status}</span>
                {r.reports > 0 && <span className="badge badge-danger">{r.reports} report{r.reports > 1 ? 's' : ''}</span>}<span className="text-sm text-muted">{formatDate(r.created_at)}</span></div>
              {r.hold_reasons.length > 0 && <p className="mt-1 text-sm text-ink-2">Flags: {r.hold_reasons.map((h) => HOLD_REASON_LABELS[h as HoldReason] ?? h).join(' · ')}</p>}
              <p className="mt-1 line-clamp-2 text-sm text-muted">{r.title ? `${r.title} — ` : ''}{r.body ?? '(rating only)'}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
