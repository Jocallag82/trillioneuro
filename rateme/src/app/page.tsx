import Link from 'next/link';
import type { Metadata } from 'next';
import { SearchForm } from '@/components/SearchForm';
import { CategoryIcon } from '@/components/CategoryIcon';
import { BusinessCard } from '@/components/BusinessCard';
import { Faq } from '@/components/Faq';
import { MembershipCard } from '@/components/MembershipCard';
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
      <section className="relative overflow-hidden">
        <div aria-hidden="true" className="pointer-events-none absolute -right-40 -top-40 h-[34rem] w-[34rem] rounded-full bg-sea-soft blur-2xl" />
        <div aria-hidden="true" className="pointer-events-none absolute -left-24 top-60 h-72 w-72 rounded-full bg-gorse-soft blur-2xl" />
        <div className="container-x relative pb-16 pt-14 sm:pt-20">
          <p className="rise mb-4 inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-sm font-medium text-ink-2">
            <span className="h-2 w-2 rounded-full bg-gorse" aria-hidden="true" /> Irish businesses, rated by their customers
          </p>
          <h1 className="rise max-w-3xl text-[2.6rem] font-semibold leading-[1.05] sm:text-6xl">
            Choose Irish businesses <span className="italic text-sea">with confidence.</span>
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
        </div>
      </section>

      <section className="container-x" aria-labelledby="cats">
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

      <section className="mt-24 bg-ink py-20 text-white" aria-labelledby="how">
        <div className="container-x">
          <h2 id="how" className="text-3xl font-semibold sm:text-4xl">Rating a business takes about a minute</h2>
          <ol className="mt-10 grid gap-6 md:grid-cols-3">
            {[
              ['Find it or scan it', 'Search for the business, or scan the RateMe QR code on their counter, receipt or van.'],
              ['Rate your experience', 'Choose 1 to 5 stars, add a few words if you like, and tell us roughly when it happened.'],
              ['Confirm it’s you', 'We email you a link to confirm. Your email address is never published.'],
            ].map(([t, d], i) => (
              <li key={t} className="rounded-2xl border border-white/10 bg-white/[.04] p-6">
                <span className="display text-4xl text-gorse">{i + 1}</span>
                <p className="mt-3 text-lg font-semibold text-white">{t}</p>
                <p className="mt-2 leading-relaxed text-white/70">{d}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="container-x mt-20" aria-labelledby="trust">
        <div className="grid gap-10 lg:grid-cols-[1fr_1.4fr]">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.12em] text-sea">Our trust rules</p>
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

      <section className="container-x mt-24" aria-labelledby="biz">
        <div className="grid items-start gap-10 lg:grid-cols-2">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[.12em] text-sea">For Irish businesses</p>
            <h2 id="biz" className="mt-2 text-3xl font-semibold sm:text-4xl">Turn happy customers into your best advertising</h2>
            <p className="mt-4 text-lg leading-relaxed text-ink-2">
              Put your QR code on the counter, a receipt or the back of the van. Customers scan, rate in under a minute and
              their experience appears on your profile — helping the next customer choose you.
            </p>
            <ul className="mt-6 space-y-2 text-ink-2">
              <li>• Plumbers, garages, cafés, salons, shops, accountants — any legitimate Irish business</li>
              <li>• One simple annual price{plan ? ` — ${formatEuro(plan.amount_cents)} a year` : ''}</li>
              <li>• Ownership checks protect your listing from impostors</li>
            </ul>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link href="/for-business" className="btn btn-primary">See how membership works</Link>
              <Link href="/dashboard/claim" className="btn btn-ghost">Claim your business</Link>
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
