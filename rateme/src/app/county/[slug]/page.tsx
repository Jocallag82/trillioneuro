import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getCounties, getCategories, topLevel } from '@/lib/catalog';
import { listBusinesses } from '@/lib/businesses';
import { activeMemberIds } from '@/lib/membership';
import { BusinessCard } from '@/components/BusinessCard';
import { Breadcrumbs, EmptyState, PageHeader } from '@/components/ui';
import { MIN_LISTING_FOR_INDEX } from '@/lib/seo';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params;
  const county = (await getCounties()).find((c) => c.slug === slug);
  if (!county) return { title: 'County not found' };
  const list = await listBusinesses({ countySlug: slug, limit: MIN_LISTING_FOR_INDEX });
  return {
    title: `Businesses in Co. ${county.name} — customer ratings`,
    description: `Find and rate businesses in County ${county.name}.`,
    alternates: { canonical: `/county/${slug}` },
    robots: { index: list.length >= MIN_LISTING_FOR_INDEX, follow: true },
  };
}

export default async function CountyPage({ params }: P) {
  const { slug } = await params;
  const county = (await getCounties()).find((c) => c.slug === slug);
  if (!county) notFound();
  const [list, cats] = await Promise.all([listBusinesses({ countySlug: slug }), getCategories()]);
  const members = await activeMemberIds(list.map((b) => b.id));
  return (
    <div className="container-x py-12">
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { href: '/counties', label: 'Counties' }, { label: `Co. ${county.name}` }]} />
      <PageHeader title={`Businesses in Co. ${county.name}`}>{county.province}</PageHeader>
      <ul className="mb-6 flex flex-wrap gap-2">
        {topLevel(cats).map((c) => <li key={c.id}><Link className="badge badge-muted px-3 py-1.5" href={`/categories/${c.slug}?county=${county.slug}`}>{c.name}</Link></li>)}
      </ul>
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
