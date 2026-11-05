import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCounties, getCategories, childrenOf } from '@/lib/catalog';
import { listBusinesses, categoryCountsInCounty, parseSort, type Sort } from '@/lib/businesses';
import { SortNav } from '@/components/SortNav';
import { activeMemberIds } from '@/lib/membership';
import { BusinessCard } from '@/components/BusinessCard';
import { Breadcrumbs, EmptyState, PageHeader } from '@/components/ui';
import { MIN_LISTING_FOR_INDEX } from '@/lib/seo';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ slug: string; category: string }>; searchParams: Promise<{ sort?: string }> };

async function resolve(slug: string, category: string) {
  const [counties, cats] = await Promise.all([getCounties(), getCategories()]);
  const county = counties.find((c) => c.slug === slug);
  const cat = cats.find((c) => c.slug === category);
  return { county, cat, cats };
}

export async function generateMetadata({ params, searchParams }: P): Promise<Metadata> {
  const { slug, category } = await params; const { sort } = await searchParams;
  const { county, cat } = await resolve(slug, category);
  if (!county || !cat) return { title: 'Not found', robots: { index: false } };
  const list = await listBusinesses({ countySlug: slug, categorySlug: category, limit: MIN_LISTING_FOR_INDEX });
  return {
    title: `${cat.name} in Co. ${county.name} — customer ratings`,
    description: `${cat.name} in County ${county.name} rated by their own customers on RateMe.ie. Compare scores, read reviews and see how many reviews each score is based on.`,
    alternates: { canonical: `/county/${slug}/${category}` },
    // Only real, non-thin combinations are indexable. Sorted variants are never indexed.
    robots: { index: !sort && list.length >= MIN_LISTING_FOR_INDEX, follow: true },
  };
}

export default async function CountyCategoryPage({ params, searchParams }: P) {
  const { slug, category } = await params;
  const sort = parseSort((await searchParams).sort, 'reviewed');
  const { county, cat, cats } = await resolve(slug, category);
  if (!county || !cat) notFound();
  const [list, siblings] = await Promise.all([listBusinesses({ countySlug: slug, categorySlug: category, sort }), categoryCountsInCounty(slug)]);
  const members = await activeMemberIds(list.map((b) => b.id));
  const subs = childrenOf(cats, cat.id);
  const rated = list.filter((b) => b.rating_count > 0).length;
  return (
    <div className="container-x py-12">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { href: '/counties', label: 'Counties' }, { href: `/county/${slug}`, label: `Co. ${county.name}` }, { label: cat.name }]} />
      <PageHeader title={`${cat.name} in Co. ${county.name}`}>
        {list.length ? `${list.length} listed · ${rated} with customer ratings. Scores show how many reviews they’re based on.` : `${county.province}`}
      </PageHeader>
      {subs.length > 0 && (
        <ul className="mb-6 flex flex-wrap gap-2">{subs.map((s) => <li key={s.id}><Link className="badge badge-muted px-3 py-1.5" href={`/county/${slug}/${s.slug}`}>{s.name}</Link></li>)}</ul>
      )}
      <SortNav current={sort} include={['reviewed', 'rated', 'recent', 'new']} hrefFor={(s: Sort) => `/county/${slug}/${category}?sort=${s}`} />
      {list.length ? (
        <ul className="grid gap-3 md:grid-cols-2">{list.map((b) => <li key={b.id}><BusinessCard b={b} member={members.has(b.id)} /></li>)}</ul>
      ) : (
        <EmptyState title={`No ${cat.name.toLowerCase()} in Co. ${county.name} listed yet`}
          action={<div className="flex flex-wrap gap-2"><Link className="btn btn-primary" href="/add-business">Suggest a business</Link><Link className="btn btn-ghost" href={`/categories/${category}`}>{cat.name} elsewhere in Ireland</Link></div>}>
          RateMe.ie lists real businesses only. Know a good one? Suggest it so you and others can rate it.
        </EmptyState>
      )}
      {siblings.filter((s) => s.slug !== category).length > 0 && (
        <section className="mt-10">
          <h2 className="font-sans text-base font-bold tracking-normal">More in Co. {county.name}</h2>
          <ul className="mt-3 flex flex-wrap gap-2">{siblings.filter((s) => s.slug !== category).map((s) => (
            <li key={s.slug}><Link className="badge badge-muted px-3 py-1.5" href={`/county/${slug}/${s.slug}`}>{s.name} <span className="text-muted">({s.n})</span></Link></li>))}</ul>
        </section>
      )}
    </div>
  );
}
