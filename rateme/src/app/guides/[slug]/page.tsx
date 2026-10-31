import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { GUIDES, guideBySlug } from '@/lib/guides';
import { Breadcrumbs } from '@/components/ui';
import { siteUrl } from '@/lib/site';

type P = { params: Promise<{ slug: string }> };
export const generateStaticParams = () => GUIDES.map((g) => ({ slug: g.slug }));
export const dynamicParams = false;

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const g = guideBySlug((await params).slug);
  if (!g) return { title: 'Guide not found' };
  return { title: g.title, description: g.description, alternates: { canonical: `/guides/${g.slug}` }, openGraph: { title: g.title, description: g.description, type: 'article' } };
}

export default async function GuidePage({ params }: P) {
  const g = guideBySlug((await params).slug);
  if (!g) notFound();
  const related = GUIDES.filter((x) => x.audience === g.audience && x.slug !== g.slug);
  const ld = { '@context': 'https://schema.org', '@type': 'Article', headline: g.title, description: g.description, dateModified: g.updated,
    publisher: { '@type': 'Organization', name: 'RateMe.ie', url: siteUrl() }, mainEntityOfPage: `${siteUrl()}/guides/${g.slug}` };
  return (
    <div className="container-x py-12">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld).replace(/</g, '\\u003c') }} />
      <div className="mx-auto max-w-3xl">
        <Breadcrumbs items={[{ href: '/', label: 'Home' }, { href: '/guides', label: 'Guides' }, { label: g.title }]} />
        <p className="text-sm font-semibold text-sea">{g.audience === 'consumer' ? 'For customers' : 'For businesses'}</p>
        <h1 className="mt-2 text-4xl font-semibold">{g.title}</h1>
        <p className="mt-3 text-lg text-ink-2">{g.description}</p>
        <div className="prose-rm mt-8">{g.body}</div>
        <div className="card mt-10 flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          {g.audience === 'consumer'
            ? <><p className="font-semibold">Find an Irish business and read customer experiences.</p><Link href="/search" className="btn btn-primary shrink-0">Search businesses</Link></>
            : <><p className="font-semibold">Claim your free listing and start collecting reviews fairly.</p><Link href="/dashboard/claim" className="btn btn-primary shrink-0">Claim your business</Link></>}
        </div>
        {related.length > 0 && (
          <nav aria-label="Related guides" className="mt-10">
            <h2 className="text-xl font-semibold">Related guides</h2>
            <ul className="mt-3 space-y-2">{related.map((r) => <li key={r.slug}><Link className="text-sea underline" href={`/guides/${r.slug}`}>{r.title}</Link></li>)}</ul>
          </nav>
        )}
      </div>
    </div>
  );
}
