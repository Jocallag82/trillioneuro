import Link from 'next/link';
import type { Metadata } from 'next';
import { SearchForm } from '@/components/SearchForm';
import { BusinessCard } from '@/components/BusinessCard';
import { EmptyState } from '@/components/ui';
import { searchBusinesses } from '@/lib/businesses';
import { getCategories, getCounties, topLevel } from '@/lib/catalog';
import { activeMemberIds } from '@/lib/membership';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Find a business', robots: { index: false, follow: true }, alternates: { canonical: '/search' } };

type SP = Promise<Record<string, string | string[] | undefined>>;
const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? '';

export default async function SearchPage({ searchParams }: { searchParams: SP }) {
  const sp = await searchParams;
  const q = one(sp.q), where = one(sp.where), county = one(sp.county), category = one(sp.category);
  const page = Number(one(sp.page)) || 1;
  const [{ results, total, matchedCategory }, cats, counties] = await Promise.all([
    searchBusinesses({ q, where, county, category, page }), getCategories(), getCounties(),
  ]);
  const members = await activeMemberIds(results.map((r) => r.id));
  const countyName = counties.find((c) => c.slug === county)?.name;
  const catName = cats.find((c) => c.slug === category)?.name;
  const hasQuery = !!(q || where || county || category);
  const qs = (p: number) => {
    const u = new URLSearchParams();
    if (q) u.set('q', q); if (where) u.set('where', where); if (county) u.set('county', county); if (category) u.set('category', category);
    u.set('page', String(p));
    return `/search?${u}`;
  };

  return (
    <div className="container-x py-10">
      <h1 className="text-3xl font-semibold sm:text-4xl">Find a business</h1>
      <div className="mt-6"><SearchForm q={q} where={where} county={county} compact /></div>

      <div className="mt-6 flex flex-wrap gap-2" aria-label="Filter by category">
        <Link href={qsWith({ q, where, county })} className={`badge ${!category ? 'badge-sea' : 'badge-muted'} px-3 py-1.5`}>All</Link>
        {topLevel(cats).map((c) => (
          <Link key={c.id} href={qsWith({ q, where, county, category: c.slug })} className={`badge ${category === c.slug ? 'badge-sea' : 'badge-muted'} px-3 py-1.5`}>{c.name}</Link>
        ))}
      </div>

      <section className="mt-8" aria-live="polite">
        {hasQuery && (
          <p className="mb-4 text-muted">
            {total ? `${total.toLocaleString('en-IE')} ${total === 1 ? 'business' : 'businesses'}` : 'No businesses'}
            {q && <> matching “<strong className="text-ink">{q}</strong>”</>}
            {catName && <> in {catName}</>}
            {where && <> near <strong className="text-ink">{where}</strong></>}
            {countyName && <> in Co. {countyName}</>}
            {matchedCategory && !category && <> · including the <em>{matchedCategory}</em> category</>}
          </p>
        )}
        {results.length ? (
          <>
            <ul className="grid gap-3 md:grid-cols-2">
              {results.map((b) => <li key={b.id}><BusinessCard b={b} member={members.has(b.id)} /></li>)}
            </ul>
            {total > 20 && (
              <nav aria-label="Pagination" className="mt-8 flex justify-between">
                {page > 1 ? <Link className="btn btn-ghost" href={qs(page - 1)}>Previous</Link> : <span />}
                {page * 20 < total && <Link className="btn btn-ghost" href={qs(page + 1)}>Next</Link>}
              </nav>
            )}
          </>
        ) : (
          <EmptyState
            title={hasQuery ? 'We couldn’t find that business yet' : 'Start with a name, a service or a place'}
            action={<div className="flex flex-wrap gap-2"><Link href={`/add-business${q ? `?name=${encodeURIComponent(q)}` : ''}`} className="btn btn-primary">Suggest this business</Link><Link href="/categories" className="btn btn-ghost">Browse categories</Link></div>}
          >
            {hasQuery ? (
              <ul className="list-disc space-y-1 pl-5">
                <li>Check the spelling, or try fewer words (for example “Murphy” instead of “Murphy’s Garage Ltd”).</li>
                <li>Try the county instead of the town, or remove a filter.</li>
                <li>RateMe.ie is new, so many businesses aren’t listed yet. You can suggest one — we check it before it’s published.</li>
              </ul>
            ) : (
              <p>Search by business name, a service like “electrician”, or filter by county or Eircode routing key (e.g. D02, T12).</p>
            )}
          </EmptyState>
        )}
      </section>
    </div>
  );
}

function qsWith(o: Record<string, string | undefined>) {
  const u = new URLSearchParams();
  for (const [k, v] of Object.entries(o)) if (v) u.set(k, v);
  const s = u.toString();
  return s ? `/search?${s}` : '/search';
}
