import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';

export default async function AdminHome() {
  await requireStaff();
  const [c] = await sql<Record<string, number>[]>`select
    (select count(*)::int from disputes where status = 'open') reconfirming,
    (select count(*)::int from disputes where status = 'upheld' and decided_at > now() - interval '30 days') auto_removed,
    (select count(*)::int from reports where status = 'open' and kind in ('review','response')) review_reports,
    (select count(*)::int from reports where status = 'open' and kind = 'business_info') info_reports,
    (select count(*)::int from disputes where status = 'open') disputes,
    (select count(*)::int from appeals where status = 'open') appeals,
    (select count(*)::int from verification_requests where status = 'pending' and method = 'manual') manual_claims,
    (select count(*)::int from businesses where status = 'pending' and source = 'community') suggestions,
    (select count(*)::int from data_requests where status <> 'closed') data_requests,
    (select count(*)::int from businesses where status = 'published') published,
    (select count(*)::int from reviews where status = 'published') reviews_published,
    (select count(distinct business_id)::int from subscriptions where status in ('active','trialing','past_due') and refunded_at is null and disputed_at is null) members,
    (select count(*)::int from stripe_events where processed_at is null and received_at < now() - interval '10 minutes') stuck_events`;
  const tiles: [string, number, string][] = [
    ['Awaiting reviewer reconfirmation', c.reconfirming, '/admin/reviews?status=disputed'], ['Auto-removed (30 days)', c.auto_removed, '/admin/reviews?status=removed'],
    ['Manual ownership claims', c.manual_claims, '/admin/verifications'], ['Business suggestions', c.suggestions, '/admin/businesses?status=pending'],
    ['Corrections & info reports', c.info_reports, '/admin/reports'], ['Privacy / legal requests', c.data_requests, '/admin/data-requests'],
  ];
  return (
    <div>
      <h1 className="text-3xl font-semibold">Overview</h1>
      <p className="mt-1 text-sm text-muted">Review moderation and disputes run automatically. These numbers are for monitoring — no action is required.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([label, n, href]) => (
          <li key={label}><Link href={href} className={`card block p-5 hover:border-sea/40 ${n ? 'border-gorse' : ''}`}><p className="text-sm text-muted">{label}</p><p className="display mt-1 text-3xl">{n}</p></Link></li>
        ))}
      </ul>
      <h2 className="mt-10 text-xl font-semibold">Platform</h2>
      <ul className="mt-3 grid gap-3 sm:grid-cols-4">
        <li className="card p-4"><p className="text-sm text-muted">Published businesses</p><p className="display text-2xl">{c.published}</p></li>
        <li className="card p-4"><p className="text-sm text-muted">Published reviews</p><p className="display text-2xl">{c.reviews_published}</p></li>
        <li className="card p-4"><p className="text-sm text-muted">Businesses with membership</p><p className="display text-2xl">{c.members}</p></li>
        <li className={`card p-4 ${c.stuck_events ? 'border-danger' : ''}`}><p className="text-sm text-muted">Unprocessed payment events</p><p className="display text-2xl">{c.stuck_events}</p></li>
      </ul>
    </div>
  );
}
