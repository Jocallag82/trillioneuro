import Link from 'next/link';
import { notFound, permanentRedirect } from 'next/navigation';
import type { Metadata } from 'next';
import { getBusinessBySlug, publishedReviews, bumpStat } from '@/lib/businesses';
import { getEntitlement } from '@/lib/membership';
import { currentUser, isStaff } from '@/lib/auth';
import { sql } from '@/lib/db';
import { isHumanPageView } from '@/lib/view';
import { RatingSummary } from '@/components/RatingSummary';
import { Initials } from '@/components/BusinessCard';
import { ReviewItem } from '@/components/ReviewItem';
import { Breadcrumbs, EmptyState, Notice } from '@/components/ui';
import { siteUrl } from '@/lib/site';

export const dynamic = 'force-dynamic';
type P = { params: Promise<{ slug: string }>; searchParams: Promise<{ stars?: string; page?: string }> };

async function load(slug: string) {
  const { business, redirectTo } = await getBusinessBySlug(slug);
  if (!business && redirectTo) permanentRedirect(`/business/${redirectTo}`);
  if (!business) notFound();
  const user = await currentUser();
  let canPreview = false;
  if (business.status !== 'published') {
    if (user && isStaff(user)) canPreview = true;
    else if (user) {
      const [m] = await sql`select 1 from business_members where business_id = ${business.id} and user_id = ${user.id} and status in ('pending','verified')`;
      canPreview = !!m;
    }
    if (!canPreview) notFound();
  }
  return { business, user, canPreview };
}

export async function generateMetadata({ params }: P): Promise<Metadata> {
  const { slug } = await params;
  const { business: b } = await getBusinessBySlug(slug);
  if (!b) return { title: 'Business not found', robots: { index: false } };
  const where = `${b.locality_name ? `${b.locality_name}, ` : ''}Co. ${b.county_name}`;
  const rating = b.rating_count ? ` Rated ${Number(b.rating_avg).toFixed(1)}/5 from ${b.rating_count} customer ${b.rating_count === 1 ? 'review' : 'reviews'}.` : '';
  return {
    title: `${b.name} — ${b.category_name}, ${where}`,
    description: `${b.name}: ${b.category_name.toLowerCase()} in ${where}.${rating} Read customer experiences or share your own on RateMe.ie.`.slice(0, 300),
    alternates: { canonical: `/business/${b.slug}` },
    robots: { index: b.status === 'published' && !b.is_test_data, follow: true },
    openGraph: { title: b.name, description: `${b.category_name} · ${where}`, url: `/business/${b.slug}` },
  };
}

export default async function BusinessPage({ params, searchParams }: P) {
  const { slug } = await params;
  const sp = await searchParams;
  const { business: b, user } = await load(slug);
  const stars = Number(sp.stars) >= 1 && Number(sp.stars) <= 5 ? Number(sp.stars) : undefined;
  const page = Math.max(1, Math.min(100, Number(sp.page) || 1));
  const [reviews, ent, verifiedOwner] = await Promise.all([
    publishedReviews(b.id, { rating: stars, limit: 20, offset: (page - 1) * 20 }),
    getEntitlement(b.id),
    sql`select 1 from business_members where business_id = ${b.id} and status = 'verified' limit 1`,
  ]);
  const isMember = ent.active;
  const isOwner = user ? (await sql`select 1 from business_members where business_id = ${b.id} and user_id = ${user.id} and status in ('pending','verified')`).length > 0 : false;
  if (b.status === 'published' && !isOwner && (await isHumanPageView())) await bumpStat(b.id, 'profile_views').catch(() => {});

  const location = [b.locality_name, `Co. ${b.county_name}`].filter(Boolean).join(', ');
  const jsonLd = b.status === 'published' ? {
    '@context': 'https://schema.org', '@type': 'LocalBusiness', name: b.name, url: `${siteUrl()}/business/${b.slug}`,
    address: { '@type': 'PostalAddress', addressLocality: b.locality_name ?? undefined, addressRegion: `Co. ${b.county_name}`, addressCountry: 'IE',
      ...(b.show_address ? { streetAddress: [b.address_line1, b.address_line2].filter(Boolean).join(', ') || undefined, postalCode: b.eircode ?? undefined } : {}) },
    ...(b.website ? { sameAs: [b.website] } : {}),
    // Third-party customer ratings only; never marked up when there are none.
    ...(b.rating_count > 0 ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: Number(b.rating_avg).toFixed(2), reviewCount: b.rating_count, bestRating: 5, worstRating: 1 } } : {}),
    ...(reviews.length ? { review: reviews.slice(0, 5).map((r) => ({ '@type': 'Review', reviewRating: { '@type': 'Rating', ratingValue: r.rating, bestRating: 5, worstRating: 1 },
      author: { '@type': 'Person', name: r.reviewer_name }, datePublished: new Date(r.published_at).toISOString().slice(0, 10), reviewBody: r.body ?? undefined })) } : {}),
  } : null;

  return (
    <div className="container-x py-8 sm:py-10">
      {jsonLd && <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd).replace(/</g, '\\u003c') }} />}
      {b.status !== 'published' && <div className="mb-4"><Notice kind="warn">Preview: this listing is <strong>{b.status}</strong> and is not visible to the public.</Notice></div>}
      <Breadcrumbs items={[{ href: '/', label: 'Home' }, { href: `/categories/${b.category_slug}`, label: b.category_name }, { label: b.name }]} />

      <header className="card flex flex-col gap-5 p-5 sm:flex-row sm:items-center sm:p-7">
        <Initials name={b.name} logoId={b.logo_id} size={76} />
        <div className="min-w-0 flex-1">
          <h1 className="text-3xl font-semibold leading-tight sm:text-4xl">{b.name}</h1>
          <p className="mt-1 text-ink-2">{b.category_name} · {location}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {verifiedOwner.length ? (
              <Link href="/how-it-works#badges" className="badge badge-sea" title="RateMe.ie has checked that the person managing this profile is connected to the business.">Owner verified</Link>
            ) : (
              <Link href="/how-it-works#badges" className="badge badge-muted" title="Nobody has verified ownership of this listing yet.">Unclaimed listing</Link>
            )}
            {b.is_test_data && <span className="badge badge-danger">Test data — not a real business</span>}
            {isMember && <Link href="/how-it-works#badges" className="badge badge-gorse" title="This business pays for a RateMe.ie membership. Membership does not affect ratings.">Paid member</Link>}
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          {b.status === 'published' && <Link href={`/business/${b.slug}/review`} className="btn btn-primary text-base">Rate your experience</Link>}
          {!verifiedOwner.length && <Link href={`/dashboard/claim?business=${b.slug}`} className="text-sm font-medium text-sea hover:underline">Is this your business? Claim it</Link>}
        </div>
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[22rem_1fr]">
        <aside className="space-y-6">
          <RatingSummary avg={b.rating_avg} count={b.rating_count} dist={b.rating_dist} />
          <div className="card p-5">
            <h2 className="font-sans text-base font-bold tracking-normal">About</h2>
            {b.description ? <p className="mt-2 whitespace-pre-line leading-relaxed text-ink-2">{b.description}</p> : <p className="mt-2 text-sm text-muted">The business hasn’t added a description yet.</p>}
            <dl className="mt-4 space-y-3 text-sm">
              <div><dt className="font-semibold">Area</dt><dd className="text-ink-2">{location}</dd></div>
              {b.show_address && b.address_line1 && <div><dt className="font-semibold">Address</dt><dd className="text-ink-2">{[b.address_line1, b.address_line2, b.eircode].filter(Boolean).join(', ')}</dd></div>}
              {b.phone && <div><dt className="font-semibold">Phone</dt><dd><a className="text-sea underline" href={`tel:${b.phone.replace(/\s/g, '')}`}>{b.phone}</a></dd></div>}
              {b.public_email && <div><dt className="font-semibold">Email</dt><dd><a className="break-all text-sea underline" href={`mailto:${b.public_email}`}>{b.public_email}</a></dd></div>}
              {b.website && <div><dt className="font-semibold">Website</dt><dd><a className="break-all text-sea underline" href={b.website} rel="nofollow noopener ugc" target="_blank">{b.website_domain ?? b.website}</a></dd></div>}
              {Object.entries(b.socials ?? {}).filter(([, v]) => v).map(([k, v]) => (
                <div key={k}><dt className="font-semibold capitalize">{k}</dt><dd><a className="break-all text-sea underline" href={v} rel="nofollow noopener ugc" target="_blank">{v.replace(/^https?:\/\/(www\.)?/, '')}</a></dd></div>
              ))}
            </dl>
            <p className="mt-4 text-xs text-muted">{b.source === 'import'
                ? <>Listing details © <a className="underline" href="https://www.openstreetmap.org/copyright" rel="noopener" target="_blank">OpenStreetMap contributors</a> (ODbL), via Find It in Ireland.</>
                : <>Contact details are supplied by the business{b.source === 'community' ? ' or the person who suggested this listing' : ''}.</>}{' '}
              <Link className="underline" href={`/business/${b.slug}/correction`}>Report incorrect information</Link></p>
          </div>
          <p className="text-xs leading-relaxed text-muted">
            Ratings reflect customers’ own submitted experiences, not an endorsement or guarantee by RateMe.ie. Reviewers declare the
            experience is genuine and confirm their email address; we don’t independently verify purchases.{' '}
            <Link href="/how-it-works" className="underline">How ratings work</Link>
          </p>
        </aside>

        <section aria-labelledby="reviews-h">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 id="reviews-h" className="text-2xl font-semibold">Customer reviews</h2>
            {b.rating_count > 0 && (
              <nav aria-label="Filter reviews by rating" className="flex flex-wrap gap-1.5 text-sm">
                <Link href={`/business/${b.slug}`} className={`badge ${!stars ? 'badge-sea' : 'badge-muted'} px-2.5 py-1`}>All</Link>
                {[5, 4, 3, 2, 1].map((s) => <Link key={s} href={`/business/${b.slug}?stars=${s}`} className={`badge ${stars === s ? 'badge-sea' : 'badge-muted'} px-2.5 py-1`}>{s}★</Link>)}
              </nav>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">Newest first. Order is never influenced by membership.</p>
          <div className="mt-5 space-y-4">
            {reviews.length ? reviews.map((r) => <ReviewItem key={r.id} r={r} businessName={b.name} slug={b.slug} />) : (
              <EmptyState title={stars ? `No ${stars}-star reviews` : 'No reviews yet'}
                action={b.status === 'published' ? <Link href={`/business/${b.slug}/review`} className="btn btn-primary">Be the first to rate {b.name}</Link> : undefined}>
                {stars ? 'Try another filter.' : 'If you’ve used this business, your experience will help others choose.'}
              </EmptyState>
            )}
          </div>
          {(reviews.length === 20 || page > 1) && (
            <nav aria-label="Pagination" className="mt-6 flex justify-between">
              {page > 1 ? <Link className="btn btn-ghost" href={`/business/${b.slug}?${stars ? `stars=${stars}&` : ''}page=${page - 1}`}>Newer</Link> : <span />}
              {reviews.length === 20 && <Link className="btn btn-ghost" href={`/business/${b.slug}?${stars ? `stars=${stars}&` : ''}page=${page + 1}`}>Older</Link>}
            </nav>
          )}
        </section>
      </div>
    </div>
  );
}
