import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCounties } from '@/lib/catalog';
import { listBusinesses, categoryCountsInCounty, parseSort, type Sort } from '@/lib/businesses';
import { SortNav } from '@/components/SortNav';
import { activeMemberIds } from '@/lib/membership';
import { BusinessCard } from '@/components/BusinessCard';
import { Breadcrumbs, EmptyState, PageHeader } from '@/components/ui';
import { MIN_LISTING_FOR_INDEX } from '@/lib/seo';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ sort?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params;
  const county = (await getCounties()).find((c) => c.slug === slug);
  if (!county) return { title: 'County not found' };
  const list = await listBusinesses({ countySlug: slug, limit: MIN_LISTING_FOR_INDEX });
  return {
    title: `Businesses in Co. ${county.name} — customer ratings`,
    description: `Businesses in County ${county.name} rated by their own customers. Browse by category and see how many reviews every score is based on.`,
    alternates: { canonical: `/county/${slug}` },
    robots: { index: list.length >= MIN_LISTING_FOR_INDEX, follow: true },
  };
}

export default async function CountyPage({ params, searchParams }: P) {
  const { slug } = await params;
  const sort = parseSort((await searchParams).sort, 'reviewed');
  const county = (await getCounties()).find((c) => c.slug === slug);
  if (!county) notFound();
  const [list, cats] = await Promise.all([listBusinesses({ countySlug: slug, sort }), categoryCountsInCounty(slug)]);
  const members = await activeMemberIds(list.map((b) => b.id));
  return (
    <div className="container-x py-12">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { href: '/counties', label: 'Counties' }, { label: `Co. ${county.name}` }]} />
      <PageHeader title={`Businesses in Co. ${county.name}`}>{county.province}</PageHeader>
      <ul className="mb-6 flex flex-wrap gap-2">
        {cats.map((c) => <li key={c.slug}><Link className="badge badge-muted px-3 py-1.5" href={`/county/${county.slug}/${c.slug}`}>{c.name} <span className="text-muted">({c.n})</span></Link></li>)}
      </ul>
      <SortNav current={sort} include={['reviewed', 'rated', 'recent', 'new']} hrefFor={(s: Sort) => `/county/${slug}?sort=${s}`} />
      {list.length ? (
        <ul className="grid gap-3 md:grid-cols-2">{list.map((b) => <li key={b.id}><BusinessCard b={b} member={members.has(b.id)} /></li>)}</ul>
      ) : (
        <EmptyState title={`No businesses in Co. ${county.name} yet`} action={<Link className="btn btn-primary" href="/add-business">Suggest a business</Link>}>
          Be the first to add a business from {county.name} so people can rate it.
        </EmptyState>
      )}
    </div>
  );
}
