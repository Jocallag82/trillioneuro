import Link from 'next/link';
import type { Metadata } from 'next';
import { getCategories, topLevel, childrenOf } from '@/lib/catalog';
import { CategoryIcon } from '@/components/CategoryIcon';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Business categories', description: 'Browse Irish businesses by category — trades, garages, restaurants, salons, retail, professional services and more.', alternates: { canonical: '/categories' } };

export default async function Categories() {
  const cats = await getCategories();
  return (
    <div className="container-x py-12">
      <PageHeader eyebrow="Browse" title="Business categories">Find Irish businesses by what they do.</PageHeader>
      <ul className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {topLevel(cats).map((c) => (
          <li key={c.id} className="card p-5">
            <Link href={`/categories/${c.slug}`} className="flex items-center gap-3 hover:text-sea">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-sea-soft text-sea"><CategoryIcon slug={c.slug} /></span>
              <span className="text-lg font-semibold">{c.name}</span>
            </Link>
            <ul className="mt-3 flex flex-wrap gap-1.5">
              {childrenOf(cats, c.id).map((s) => (
                <li key={s.id}><Link href={`/categories/${s.slug}`} className="badge badge-muted px-2.5 py-1 hover:bg-line">{s.name}</Link></li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  );
}
