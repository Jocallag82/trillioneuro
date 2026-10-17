import Link from 'next/link';
import type { Metadata } from 'next';
import { getCounties } from '@/lib/catalog';
import { PageHeader } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Browse by county', alternates: { canonical: '/counties' } };

export default async function Counties() {
  const counties = await getCounties();
  const provinces = ['Leinster', 'Munster', 'Connacht', 'Ulster'];
  return (
    <div className="container-x py-12">
      <PageHeader eyebrow="Browse" title="Businesses by county">All 26 counties of the Republic of Ireland.</PageHeader>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        {provinces.map((p) => (
          <section key={p} className="card p-5">
            <h2 className="text-xl font-semibold">{p}</h2>
            <ul className="mt-3 space-y-1.5">
              {counties.filter((c) => c.province === p).map((c) => <li key={c.id}><Link className="hover:text-sea hover:underline" href={`/county/${c.slug}`}>Co. {c.name}</Link></li>)}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
