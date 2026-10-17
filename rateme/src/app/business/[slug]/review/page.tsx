import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { getBusinessBySlug, bumpStat } from '@/lib/businesses';
import { EXPERIENCE_TYPES } from '@/lib/reviews';
import { isProduction } from '@/lib/env';
import { isHumanPageView } from '@/lib/view';
import { Initials } from '@/components/BusinessCard';
import { ReviewForm } from './ReviewForm';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ src?: string }> };

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params;
  const { business } = await getBusinessBySlug(slug);
  return { title: business ? `Rate ${business.name}` : 'Rate a business', robots: { index: false, follow: false } };
}

function lastMonths(n: number) {
  const out: { value: string; label: string }[] = [];
  const d = new Date();
  for (let i = 0; i < n; i++) {
    const m = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - i, 1));
    out.push({ value: m.toISOString().slice(0, 7), label: new Intl.DateTimeFormat('en-IE', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(m) });
  }
  return out;
}

export default async function RatePage({ params, searchParams }: P) {
  const { slug } = await params;
  const { src } = await searchParams;
  const { business: b } = await getBusinessBySlug(slug);
  if (!b || b.status !== 'published') notFound();
  if (await isHumanPageView()) await bumpStat(b.id, 'review_starts').catch(() => {});
  return (
    <div className="mx-auto max-w-2xl px-4 py-8 sm:py-12">
      <div className="card flex items-center gap-4 p-4">
        <Initials name={b.name} logoId={b.logo_id} size={56} />
        <div className="min-w-0">
          <p className="text-sm text-muted">You’re rating</p>
          <h1 className="truncate font-sans text-xl font-bold tracking-normal">{b.name}</h1>
          <p className="truncate text-sm text-muted">{b.category_name} · {b.locality_name ? `${b.locality_name}, ` : ''}Co. {b.county_name}</p>
        </div>
      </div>
      <p className="mt-3 text-sm text-muted">Not the right business? <Link className="text-sea underline" href="/search">Search again</Link></p>
      <div className="mt-6">
        <ReviewForm businessId={b.id} businessName={b.name} source={src === 'qr' ? 'qr' : 'web'} months={lastMonths(36)} experienceTypes={EXPERIENCE_TYPES} devMode={!isProduction()} />
      </div>
    </div>
  );
}
