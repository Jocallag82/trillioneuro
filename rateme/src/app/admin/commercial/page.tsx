import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { formatEuro } from '@/lib/format';

export const metadata = { title: 'Commercial' };
export const dynamic = 'force-dynamic';

export default async function Commercial() {
  await requireStaff('admin');
  const [k] = await sql<Record<string, number>[]>`
    with live as (
      select s.*, coalesce(p.billing_interval, 'year') iv from subscriptions s left join plans p on p.id = s.plan_id
      where s.status in ('active','trialing','past_due') and s.refunded_at is null and s.disputed_at is null and (s.current_period_end is null or s.current_period_end > now() - interval '14 days'))
    select
      (select count(*)::int from businesses where status = 'published' and not is_test_data) listings,
      (select count(distinct business_id)::int from business_members where status in ('pending','verified')) claimed_any,
      (select count(distinct business_id)::int from business_members where status = 'verified') verified,
      (select count(distinct business_id)::int from live) paying,
      (select coalesce(sum(case when iv = 'month' then amount_cents * 12 else amount_cents end), 0)::int from live) arr_cents,
      (select coalesce(sum(case when iv = 'month' then amount_cents * 12 else amount_cents end), 0)::int from live where not cancel_at_period_end) committed_arr_cents,
      (select count(*)::int from live where cancel_at_period_end) cancelling,
      (select count(*)::int from subscriptions where status = 'past_due') past_due,
      (select count(*)::int from subscriptions where created_at > now() - interval '30 days') new_30,
      (select count(*)::int from invoices i where i.status = 'paid' and i.created_at > now() - interval '30 days'
         and exists (select 1 from invoices j where j.subscription_id = i.subscription_id and j.created_at < i.created_at and j.status = 'paid')) renewals_30,
      (select count(*)::int from subscriptions where canceled_at > now() - interval '30 days' or (cancel_at_period_end and updated_at > now() - interval '30 days')) cancels_30,
      (select count(*)::int from subscriptions where refunded_at > now() - interval '90 days') refunds_90,
      (select coalesce(sum(i.amount_paid), 0)::int from invoices i left join subscriptions s on s.id = i.subscription_id where i.status = 'paid' and s.refunded_at is null and i.created_at > now() - interval '365 days') cash_12m_cents,
      (select count(*)::int from reviews where created_at > now() - interval '30 days') submitted_30,
      (select count(*)::int from reviews where status = 'published' and published_at > now() - interval '30 days') published_30,
      (select coalesce(sum(qr_scans), 0)::int from business_daily_stats where day > current_date - 30) scans_30,
      (select coalesce(sum(profile_views), 0)::int from business_daily_stats where day > current_date - 30) views_30,
      (select coalesce(sum(review_starts), 0)::int from business_daily_stats where day > current_date - 30) starts_30,
      (select count(*)::int from business_attribution where source = 'partner') partner_claims,
      (select count(*)::int from business_attribution where source = 'campaign') campaign_claims,
      (select coalesce(sum(cost_micro_usd), 0)::int from ai_usage where created_at > date_trunc('month', now())) ai_micro_usd`;
  const months = await sql<{ m: string; new_subs: number; published: number; claims: number; cash: number }[]>`
    select to_char(g.m, 'Mon YY') m,
      (select count(*)::int from subscriptions s where date_trunc('month', s.created_at) = g.m) new_subs,
      (select count(*)::int from reviews r where r.status = 'published' and date_trunc('month', r.published_at) = g.m) published,
      (select count(*)::int from business_members bm where date_trunc('month', bm.created_at) = g.m) claims,
      (select coalesce(sum(amount_paid), 0)::int from invoices i where i.status = 'paid' and date_trunc('month', i.created_at) = g.m) cash
    from generate_series(date_trunc('month', now()) - interval '11 months', date_trunc('month', now()), interval '1 month') g(m) order by g.m`;
  const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '—');
  const tiles: [string, string, string][] = [
    ['Published listings', String(k.listings), 'Excludes test data'],
    ['Claimed (any)', String(k.claimed_any), 'Pending or verified owner'],
    ['Verified free + paid', String(k.verified), 'Ownership verified'],
    ['Paying businesses', String(k.paying), 'Active, trialing or in grace'],
    ['ARR (run-rate)', formatEuro(k.arr_cents), 'Annualised live subscriptions'],
    ['Committed ARR', formatEuro(k.committed_arr_cents), 'Excludes those set to cancel'],
    ['Cash, last 12 months', formatEuro(k.cash_12m_cents), 'Paid invoices, refunds excluded'],
    ['Verified → paid', pct(k.paying, k.verified), 'Conversion of verified owners'],
    ['New memberships (30d)', String(k.new_30), ''], ['Renewals (30d)', String(k.renewals_30), 'Second+ paid invoice'],
    ['Cancellations (30d)', String(k.cancels_30), `${k.cancelling} currently set to cancel`], ['Refunds (90d)', String(k.refunds_90), `${k.past_due} past due now`],
    ['Profile views (30d)', String(k.views_30), 'Deduplicated'], ['QR scans (30d)', String(k.scans_30), 'Deduplicated'],
    ['Review forms → published (30d)', `${k.starts_30} → ${k.published_30}`, `${k.submitted_30} submitted · ${pct(k.published_30, k.starts_30)} form-to-publish`],
    ['Claims by source', `${k.partner_claims} partner · ${k.campaign_claims} campaign`, 'First-touch'],
    ['AI spend this month', `$${(k.ai_micro_usd / 1e6).toFixed(2)}`, 'Reply drafts'],
  ];
  return (
    <div>
      <h1 className="text-3xl font-semibold">Commercial</h1>
      <p className="mt-1 text-sm text-muted">From live database records. Amounts are gross as charged by Stripe, so they include any VAT. ARR is a run-rate, not cash received. Profit is not shown: subtract Stripe fees (~1.5% + €0.25 per EU card payment), VAT due, hosting and email.</p>
      <ul className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {tiles.map(([t, v, h]) => <li key={t} className="card p-4"><p className="text-xs font-semibold text-ink-2">{t}</p><p className="display mt-1 text-2xl tabular-nums">{v}</p>{h && <p className="mt-1 text-xs text-muted">{h}</p>}</li>)}
      </ul>
      <h2 className="mt-10 text-xl font-semibold">Last 12 months</h2>
      <div className="mt-3 overflow-x-auto"><table className="table-rm">
        <thead><tr><th>Month</th><th>Claims started</th><th>New memberships</th><th>Published reviews</th><th>Cash (gross)</th></tr></thead>
        <tbody>{months.map((m) => <tr key={m.m}><td>{m.m}</td><td>{m.claims}</td><td>{m.new_subs}</td><td>{m.published}</td><td>{formatEuro(m.cash)}</td></tr>)}</tbody>
      </table></div>
    </div>
  );
}
