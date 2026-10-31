import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { getCategories, getCounties, topLevel } from '@/lib/catalog';
import { OUTREACH_STATUSES, effectiveStatus, prospectColumns, type ProspectRow } from '@/lib/outreach';
import { formatDate } from '@/lib/format';

export const metadata = { title: 'Outreach' };
type SP = Promise<{ q?: string; county?: string; category?: string; status?: string; campaign?: string; due?: string }>;

export default async function Outreach({ searchParams }: { searchParams: SP }) {
  await requireStaff('admin');
  const sp = await searchParams;
  const [counties, cats, campaigns] = await Promise.all([getCounties(), getCategories(), sql<{ id: number; name: string }[]>`select id, name from outreach_campaigns order by name`]);
  const rows = await sql<ProspectRow[]>`
    select ${prospectColumns}
    from businesses b join counties co on co.id = b.county_id join categories c on c.id = b.category_id
      left join outreach_prospects p on p.business_id = b.id
    where b.status in ('published','pending')
      ${sp.q ? sql`and rateme.norm(b.name) like '%' || rateme.norm(${sp.q}) || '%'` : sql``}
      ${sp.county ? sql`and co.slug = ${sp.county}` : sql``}
      ${sp.category ? sql`and (c.slug = ${sp.category} or c.parent_id = (select id from categories where slug = ${sp.category}))` : sql``}
      ${sp.campaign ? sql`and p.campaign_id = ${Number(sp.campaign)}` : sql``}
      ${sp.due ? sql`and p.next_action_at <= (now() at time zone 'Europe/Dublin')::date` : sql``}
    order by p.next_action_at nulls last, b.name limit 300`;
  const list = rows.map((r) => ({ ...r, eff: effectiveStatus(r.manual_status, r.claim_pending, r.verified, r.paying) }))
    .filter((r) => !sp.status || r.eff === sp.status);
  const counts = Object.fromEntries(Object.keys(OUTREACH_STATUSES).map((k) => [k, list.filter((r) => r.eff === k).length]));
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold">Outreach</h1>
        <div className="flex gap-2"><Link className="btn btn-ghost btn-sm" href="/admin/outreach/campaigns">Campaigns & results</Link><Link className="btn btn-ghost btn-sm" href="/admin/partners">Partners</Link></div>
      </div>
      <p className="mt-1 text-sm text-muted">Founder-led sales. Use post, phone or in-person visits. This tool never emails businesses. Notes are private to admins.</p>
      <form className="mt-4 grid gap-2 sm:grid-cols-3 lg:grid-cols-6">
        <input name="q" defaultValue={sp.q} className="input" placeholder="Business name" aria-label="Business name" />
        <select name="county" defaultValue={sp.county ?? ''} className="select" aria-label="County"><option value="">All counties</option>{counties.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select>
        <select name="category" defaultValue={sp.category ?? ''} className="select" aria-label="Category"><option value="">All categories</option>{topLevel(cats).map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}</select>
        <select name="status" defaultValue={sp.status ?? ''} className="select" aria-label="Status"><option value="">Any status</option>{Object.entries(OUTREACH_STATUSES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select name="campaign" defaultValue={sp.campaign ?? ''} className="select" aria-label="Campaign"><option value="">Any campaign</option>{campaigns.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <label className="flex items-center gap-2 text-sm"><input type="checkbox" name="due" value="1" defaultChecked={!!sp.due} /> Follow-up due</label>
        <button className="btn btn-ink sm:col-span-3 lg:col-span-6">Filter</button>
      </form>
      <ul className="mt-4 flex flex-wrap gap-2 text-xs">{Object.entries(OUTREACH_STATUSES).map(([k, v]) => <li key={k} className="badge badge-muted">{v}: {counts[k]}</li>)}</ul>
      <div className="mt-4 overflow-x-auto"><table className="table-rm">
        <thead><tr><th>Business</th><th>County</th><th>Category</th><th>Status</th><th>Reviews</th><th>Last contact</th><th>Next action</th></tr></thead>
        <tbody>{list.map((r) => (
          <tr key={r.id}><td><Link className="text-sea underline" href={`/admin/outreach/${r.id}`}>{r.name}</Link></td><td>{r.county}</td><td>{r.category}</td>
            <td>{OUTREACH_STATUSES[r.eff]}</td><td>{r.rating_count}</td><td>{r.last_contact_at ? formatDate(r.last_contact_at) : '—'}</td>
            <td>{r.next_action ? `${r.next_action}${r.next_action_at ? ` (${formatDate(r.next_action_at)})` : ''}` : '—'}</td></tr>
        ))}</tbody>
      </table></div>
      {list.length === 0 && <p className="mt-4 text-sm text-muted">No businesses match. Add listings under Businesses, or loosen the filters.</p>}
    </div>
  );
}
