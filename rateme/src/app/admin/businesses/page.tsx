import Link from 'next/link';
import { sql } from '@/lib/db';
import { requireStaff } from '@/lib/auth';
import { formatDate } from '@/lib/format';

export default async function AdminBusinesses({ searchParams }: { searchParams: Promise<{ status?: string; q?: string }> }) {
  await requireStaff();
  const { status = 'pending', q } = await searchParams;
  const rows = await sql<{ id: string; name: string; status: string; source: string; county: string; created_at: Date; rating_count: number; verified: boolean }[]>`
    select b.id, b.name, b.status, b.source, co.name county, b.created_at, b.rating_count, b.ownership_verified_at is not null verified
    from businesses b join counties co on co.id = b.county_id
    where ${status === 'all' ? sql`true` : sql`b.status = ${status}`} ${q ? sql`and rateme.norm(b.name) like '%' || rateme.norm(${q}) || '%'` : sql``}
    order by b.created_at desc limit 200`;
  return (
    <div>
      <h1 className="text-3xl font-semibold">Businesses</h1>
      <div className="mt-4 flex flex-wrap gap-2">{['pending', 'published', 'suspended', 'removed', 'all'].map((s) => <Link key={s} href={`/admin/businesses?status=${s}`} className={`badge px-3 py-1.5 ${s === status ? 'badge-sea' : 'badge-muted'}`}>{s}</Link>)}</div>
      <form className="mt-4 flex gap-2"><input type="hidden" name="status" value={status} /><input name="q" defaultValue={q} className="input max-w-sm" placeholder="Name" aria-label="Search by name" /><button className="btn btn-ghost">Search</button></form>
      <div className="mt-6 overflow-x-auto"><table className="table-rm">
        <thead><tr><th>Name</th><th>Status</th><th>Source</th><th>County</th><th>Reviews</th><th>Owner verified</th><th>Created</th></tr></thead>
        <tbody>{rows.map((b) => <tr key={b.id}><td><Link className="text-sea underline" href={`/admin/businesses/${b.id}`}>{b.name}</Link></td><td>{b.status}</td><td>{b.source}</td><td>{b.county}</td><td>{b.rating_count}</td><td>{b.verified ? 'Yes' : 'No'}</td><td>{formatDate(b.created_at)}</td></tr>)}</tbody>
      </table></div>
    </div>
  );
}
