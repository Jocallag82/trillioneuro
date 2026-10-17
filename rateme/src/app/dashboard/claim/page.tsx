import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getCategories, getCounties, getLocalities } from '@/lib/catalog';
import { BusinessFormFields } from '@/components/BusinessFormFields';
import { Notice } from '@/components/ui';
import { SubmitButton } from '@/components/SubmitButton';
import { claimBusiness } from './actions';
import { CreateBusinessForm } from './CreateBusinessForm';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Find or add your business' };

export default async function Claim({ searchParams }: { searchParams: Promise<{ q?: string; county?: string; business?: string; error?: string }> }) {
  const sp = await searchParams;
  await requireUser({ next: '/dashboard/claim' });
  const [cats, counties, localities] = await Promise.all([getCategories(), getCounties(), getLocalities()]);
  const q = (sp.q ?? '').trim().slice(0, 80);
  const results = q || sp.business ? await sql<{ id: string; slug: string; name: string; status: string; county: string; locality: string | null; claimed: boolean }[]>`
    select b.id, b.slug, b.name, b.status, co.name county, l.name locality,
      exists(select 1 from business_members m where m.business_id = b.id and m.status = 'verified') claimed
    from businesses b join counties co on co.id = b.county_id left join localities l on l.id = b.locality_id
    where b.status in ('published','pending')
      ${sp.business ? sql`and b.slug = ${sp.business}` : sql`and (rateme.norm(b.name) like '%' || rateme.norm(${q}) || '%' or similarity(rateme.norm(b.name), rateme.norm(${q})) > 0.35)`}
      ${sp.county ? sql`and co.slug = ${sp.county}` : sql``}
    order by similarity(rateme.norm(b.name), rateme.norm(${q || sp.business || ''})) desc limit 10` : [];
  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard" className="text-sm text-muted hover:underline">← Dashboard</Link>
      <h1 className="mt-2 text-3xl font-semibold">Find or add your business</h1>
      {sp.error && <div className="mt-4"><Notice kind="error">{sp.error}</Notice></div>}

      <section className="card mt-6 p-5 sm:p-6">
        <h2 className="font-sans text-lg font-bold tracking-normal">1. Is it already listed?</h2>
        <form className="mt-3 flex flex-col gap-2 sm:flex-row" method="get">
          <input name="q" defaultValue={q} className="input" placeholder="Business name" aria-label="Business name" required />
          <select name="county" defaultValue={sp.county ?? ''} className="select sm:w-48" aria-label="County">
            <option value="">Any county</option>{counties.map((c) => <option key={c.id} value={c.slug}>Co. {c.name}</option>)}
          </select>
          <button className="btn btn-ink">Search</button>
        </form>
        {(q || sp.business) && (
          results.length ? (
            <ul className="mt-4 divide-y divide-line">
              {results.map((r) => (
                <li key={r.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-semibold">{r.name}</p>
                    <p className="text-sm text-muted">{r.locality ? `${r.locality}, ` : ''}Co. {r.county}{r.status === 'pending' ? ' · awaiting review' : ''}</p>
                  </div>
                  <form action={claimBusiness}>
                    <input type="hidden" name="business_id" value={r.id} />
                    <SubmitButton className="btn btn-primary btn-sm" pendingText="…">{r.claimed ? 'Request access' : 'Claim this business'}</SubmitButton>
                  </form>
                </li>
              ))}
            </ul>
          ) : <p className="mt-4 text-sm text-muted">No matching listing. Add it below.</p>
        )}
        <p className="mt-3 text-xs text-muted">Already claimed by someone else? You can still request access — we check it manually and contact the existing owner.</p>
      </section>

      <section className="card mt-6 p-5 sm:p-6">
        <h2 className="font-sans text-lg font-bold tracking-normal">2. Or create a new listing</h2>
        <p className="mt-1 text-sm text-muted">Your listing goes live once we’ve verified you own or manage the business.</p>
        <div className="mt-5"><CreateBusinessForm fields={<BusinessFormFields cats={cats} counties={counties} localities={localities} d={{ name: q }} mode="owner" />} /></div>
      </section>
    </div>
  );
}
