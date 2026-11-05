import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getCategories, getCounties, childrenOf } from '@/lib/catalog';
import { listBusinesses, parseSort, type Sort } from '@/lib/businesses';
import { SortNav } from '@/components/SortNav';
import { activeMemberIds } from '@/lib/membership';
import { BusinessCard } from '@/components/BusinessCard';
import { Breadcrumbs, EmptyState, PageHeader } from '@/components/ui';
import { MIN_LISTING_FOR_INDEX } from '@/lib/seo';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ county?: string; sort?: string }> };

export async function generateMetadata({ params, searchParams }: P): Promise<Metadata> {
  const { slug } = await params; const { county, sort } = await searchParams;
  const cat = (await getCategories()).find((c) => c.slug === slug);
  if (!cat) return { title: 'Category not found' };
  const list = await listBusinesses({ categorySlug: slug, limit: MIN_LISTING_FOR_INDEX });
  return {
    title: `${cat.name} in Ireland — customer ratings`,
    description: `Irish ${cat.name.toLowerCase()} rated by their customers on RateMe.ie.`,
    alternates: { canonical: `/categories/${slug}` },
    // Thin pages (few real listings) and filtered variants stay out of the index.
    robots: { index: !county && !sort && list.length >= MIN_LISTING_FOR_INDEX, follow: true },
  };
}

export default async function CategoryPage({ params, searchParams }: P) {
  const { slug } = await params; const { county, sort: sortP } = await searchParams;
  const sort = parseSort(sortP, 'reviewed');
  const [cats, counties] = await Promise.all([getCategories(), getCounties()]);
  const cat = cats.find((c) => c.slug === slug);
  if (!cat) notFound();
  // One URL per county/category combination.
  if (county && counties.some((c) => c.slug === county)) permanentRedirect(`/county/${county}/${slug}${sortP ? `?sort=${encodeURIComponent(sortP)}` : ''}`);
  const parent = cat.parent_id ? cats.find((c) => c.id === cat.parent_id) : null;
  const subs = childrenOf(cats, cat.id);
  const list = await listBusinesses({ categorySlug: slug, countySlug: county || undefined, sort });
  const members = await activeMemberIds(list.map((b) => b.id));
  return (
    <div className="container-x py-12">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { href: '/categories', label: 'Categories' }, ...(parent ? [{ href: `/categories/${parent.slug}`, label: parent.name }] : []), { label: cat.name }]} />
      <PageHeader title={cat.name}>{cat.description ?? `Irish ${cat.name.toLowerCase()} rated by their customers.`}</PageHeader>
      {subs.length > 0 && (
        <ul className="mb-6 flex flex-wrap gap-2">{subs.map((s) => <li key={s.id}><Link className="badge badge-muted px-3 py-1.5" href={`/categories/${s.slug}`}>{s.name}</Link></li>)}</ul>
      )}
      <form className="mb-6 flex items-center gap-2" method="get">
        <label htmlFor="county" className="text-sm font-medium">County</label>
        <select id="county" name="county" defaultValue={county ?? ''} className="select w-auto py-2">
          <option value="">All of Ireland</option>
          {counties.map((c) => <option key={c.id} value={c.slug}>Co. {c.name}</option>)}
        </select>
        <button className="btn btn-ghost btn-sm">Apply</button>
      </form>
      <SortNav current={sort} include={['reviewed', 'rated', 'recent', 'new']} hrefFor={(s: Sort) => `/categories/${slug}?${county ? `county=${county}&` : ''}sort=${s}`} />
      {list.length ? (
        <ul className="grid gap-3 md:grid-cols-2">{list.map((b) => <li key={b.id}><BusinessCard b={b} member={members.has(b.id)} /></li>)}</ul>
      ) : (
        <EmptyState title={`No ${cat.name.toLowerCase()} listed${county ? ' in this county' : ''} yet`}
          action={<div className="flex flex-wrap gap-2"><Link className="btn btn-primary" href="/add-business">Suggest a business</Link><Link className="btn btn-ghost" href="/for-business">List your own business</Link></div>}>
          RateMe.ie is growing county by county. Know a good one? Suggest it so you and others can rate it.
        </EmptyState>
      )}
    </div>
  );
}
