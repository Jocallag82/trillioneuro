import Link from 'next/link';
import type { Metadata } from 'next';
import { GUIDES } from '@/lib/guides';
import { PageHeader } from '@/components/ui';

export const metadata: Metadata = { title: 'Guides', description: 'Practical guides for Irish customers choosing a business and for small businesses collecting and answering reviews.', alternates: { canonical: '/guides' } };

export default function Guides() {
  const groups = [['consumer', 'For customers'], ['business', 'For businesses']] as const;
  return (
    <div className="container-x py-12">
      <PageHeader title="Guides">Practical advice for choosing a business, and for businesses collecting and answering reviews.</PageHeader>
      <div className="grid gap-10 md:grid-cols-2">
        {groups.map(([a, label]) => (
          <section key={a} aria-labelledby={`g-${a}`}>
            <h2 id={`g-${a}`} className="text-xl font-semibold">{label}</h2>
            <ul className="mt-4 space-y-3">
              {GUIDES.filter((g) => g.audience === a).map((g) => (
                <li key={g.slug} className="card p-5">
                  <Link href={`/guides/${g.slug}`} className="font-semibold text-ink hover:text-sea hover:underline">{g.title}</Link>
                  <p className="mt-1 text-sm text-ink-2">{g.description}</p>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
