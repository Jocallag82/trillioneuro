import Link from 'next/link';
import type { Metadata } from 'next';
import { SearchForm } from '@/components/SearchForm';
import { CategoryIcon } from '@/components/CategoryIcon';
import { BusinessCard } from '@/components/BusinessCard';
import { Faq } from '@/components/Faq';
import { MembershipCard } from '@/components/MembershipCard';
import { ProductShowcase, ReviewFlow, ProfilePreview, QrCardPreview, DashboardPreview, SampleTag } from '@/components/ProductShowcase';
import { getCategories, topLevel } from '@/lib/catalog';
import { recentlyReviewed, platformCounts } from '@/lib/businesses';
import { publicPlan } from '@/lib/membership';
import { formatEuro } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { alternates: { canonical: '/' } };

export default async function Home() {
  const [cats, recent, counts, plan] = await Promise.all([getCategories(), recentlyReviewed(6), platformCounts(), publicPlan()]);
  const tops = topLevel(cats);
  return (
    <>
      <section className="border-b border-line bg-paper">
        <div className="container-x pb-14 pt-12 sm:pb-20 sm:pt-20">
          <p className="rise eyebrow">Irish businesses, rated by their customers</p>
          <h1 className="rise mt-4 max-w-3xl text-[2.5rem] leading-[1.04] text-ink sm:text-[4.1rem]">
            Choose Irish businesses <span className="text-sea">with confidence.</span>
          </h1>
          <p className="rise mt-5 max-w-2xl text-lg leading-relaxed text-ink-2 sm:text-xl">
            Discover local businesses, share your own experience and help people choose well. Ratings come from customers who
            say they used the business — collected fairly and published under rules we show you.
          </p>
          <div className="rise mt-8 max-w-4xl"><SearchForm /></div>
          <p className="mt-4 text-sm text-muted">
            Free for customers. No account needed to start a rating.{' '}
            <Link href="/how-it-works" className="font-medium text-sea underline">How ratings work</Link>
          </p>
          <p className="mt-10 inline-flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line pt-5 text-sm text-ink-2">
            <span>Own a business?</span>
            <Link href="#product" className="font-semibold text-sea hover:underline">See what members get</Link>
            <span aria-hidden="true" className="text-line">|</span>
            <Link href="/dashboard/claim" className="font-semibold text-sea hover:underline">Claim your listing</Link>
          </p>
        </div>
      </section>

      <section className="container-x mt-16" aria-labelledby="cats">
        <div className="flex items-end justify-between gap-4">
          <h2 id="cats" className="text-2xl font-semibold sm:text-3xl">Browse by category</h2>
          <Link href="/categories" className="text-sm font-semibold text-sea hover:underline">All categories</Link>
        </div>
        <ul className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {tops.map((c) => (
            <li key={c.id}>
              <Link href={`/categories/${c.slug}`} className="card flex h-full flex-col gap-3 p-4 transition hover:-translate-y-0.5 hover:border-sea/40">
                <span className="grid h-11 w-11 place-items-center rounded-xl bg-sea-soft text-sea"><CategoryIcon slug={c.slug} /></span>
                <span className="font-semibold leading-snug">{c.name}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="container-x mt-20" aria-labelledby="recent">
        <h2 id="recent" className="text-2xl font-semibold sm:text-3xl">Recently rated</h2>
        {recent.length ? (
          <ul className="mt-6 grid gap-3 md:grid-cols-2 lg:grid-cols-3">{recent.map((b) => <li key={b.id}><BusinessCard b={b} /></li>)}</ul>
        ) : (
          <div className="card mt-6 grid gap-6 border-dashed p-6 sm:grid-cols-[1.4fr_1fr] sm:p-8">
            <div>
              <p className="display text-2xl">RateMe.ie is new — and we won’t pretend otherwise.</p>
              <p className="mt-2 max-w-xl text-ink-2">
                You won’t find invented reviews or padded numbers here. Every rating you see will come from a real person’s
                submission. Know a business you’d like to rate? Add it and be one of the first.
              </p>
            </div>
            <div className="flex flex-col justify-center gap-2 sm:items-end">
              <Link href="/add-business" className="btn btn-primary">Suggest a business to rate</Link>
              <Link href="/for-business" className="btn btn-ghost">I own a business</Link>
            </div>
          </div>
        )}
        {counts.businesses >= 25 && (
          <p className="mt-4 text-sm text-muted">{counts.businesses.toLocaleString('en-IE')} businesses listed · {counts.reviews.toLocaleString('en-IE')} published reviews</p>
        )}
      </section>

      <ReviewFlow />

      <section className="container-x mt-20" aria-labelledby="trust">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="eyebrow">Our trust rules</p>
            <h2 id="trust" className="mt-2 text-3xl font-semibold sm:text-4xl">Fair to customers. Fair to businesses.</h2>
            <p className="mt-4 text-lg text-ink-2">
              Businesses pay for membership tools — not for better ratings. These rules apply to every business, whether it pays or not.
            </p>
            <Link href="/review-policy" className="btn btn-ghost mt-6">Read the full review policy</Link>
          </div>
          <ul className="grid gap-4 sm:grid-cols-2">
            {[
              ['No paying to look better', 'Membership never changes a rating, the order of reviews or whether a review is shown.'],
              ['Disputes settled automatically', 'If a business questions a review, the reviewer is asked to reconfirm it. Reviews people stand behind stay; unconfirmed ones are removed.'],
              ['No review gating', 'Every customer gets the same form. Happy and unhappy customers are never routed differently.'],
              ['Honest labels', 'We don’t claim a review is a “verified purchase”. Reviewers declare it’s their own genuine experience.'],
              ['Checks before publishing', 'Email confirmation, rate limits and rating-blind automated checks block spam, abuse and conflicts of interest.'],
              ['Scores need real data', 'We only show a score once real customers have rated a business. No invented numbers.'],
            ].map(([t, d]) => (
              <li key={t} className="card p-5">
                <p className="font-semibold">{t}</p>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-2">{d}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <div className="mt-24"><ProductShowcase /></div>

      <section className="container-x mt-20" aria-labelledby="biz">
        <div className="grid items-start gap-10 lg:grid-cols-[1.15fr_1fr]">
          <div>
            <p className="eyebrow">For Irish businesses</p>
            <h2 id="biz" className="mt-2 text-3xl font-bold sm:text-4xl">One membership. Your profile, QR card and dashboard.</h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-2">
              Put your QR code on the counter, an invoice or the back of the van. Customers scan, rate in about a minute and
              their published review appears on your profile — helping the next customer choose you.
              {plan ? ` All for ${formatEuro(plan.amount_cents)} a year.` : ''}
            </p>
            <div className="relative mt-8 grid grid-cols-[1fr_auto] items-center gap-4 rounded-3xl bg-paper-2/70 p-4 sm:p-6" inert aria-hidden="true">
              <div className="space-y-4 [&_.card]:text-[13px]"><div className="max-h-56 overflow-hidden rounded-2xl"><ProfilePreview /></div><div className="hidden max-h-44 overflow-hidden rounded-2xl sm:block"><DashboardPreview /></div></div>
              <div className="w-32 sm:w-44"><QrCardPreview compact /></div>
              <span className="absolute right-3 top-3"><SampleTag /></span>
            </div>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/dashboard/claim" className="btn btn-ghost text-base">Claim your business</Link>
              <Link href="/for-business" className="btn btn-ghost text-base">How membership works</Link>
            </div>
          </div>
          <MembershipCard plan={plan} />
        </div>
      </section>

      <section className="container-x mt-24" aria-labelledby="faq">
        <h2 id="faq" className="text-3xl font-semibold">Questions people ask</h2>
        <div className="mt-6">
          <Faq items={[
            { q: 'Do I have to pay to leave a rating?', a: 'No. Rating a business is free and always will be. Only businesses pay, and only for membership tools.' },
            { q: 'Will my email address be shown?', a: 'Never. We use it to confirm your review is genuine and to let you manage it later. Only the display name you choose is shown.' },
            { q: 'Are the reviews verified purchases?', a: 'No, and we don’t claim they are. Reviewers declare that they personally used the business. We confirm their email and run automated and human checks, but we can’t independently verify every transaction.' },
            { q: 'Can a business remove a bad review?', a: <>Not directly. A business can reply publicly or dispute a review. A dispute automatically asks the reviewer to reconfirm it: if they stand by it, it stays; if they don’t respond within 14 days, it’s removed. The same applies to good and bad reviews. <Link className="text-sea underline" href="/review-policy">Review policy</Link></> },
            { q: 'Does paying for membership improve a business’s rating?', a: 'No. Ratings are calculated the same way for every business from published reviews only. Membership is clearly labelled.' },
            { q: 'My business is listed but I didn’t add it. What can I do?', a: <>Customers can suggest businesses so they can rate them. You can <Link className="text-sea underline" href="/dashboard/claim">claim the listing</Link>, verify you’re the owner and keep its details accurate — or <Link className="text-sea underline" href="/contact">contact us</Link> if something is wrong.</> },
          ]} />
        </div>
      </section>
    </>
  );
}
