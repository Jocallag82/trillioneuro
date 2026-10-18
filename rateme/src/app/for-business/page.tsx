import Link from 'next/link';
import type { Metadata } from 'next';
import { publicPlan } from '@/lib/membership';
import { MembershipCard } from '@/components/MembershipCard';
import { Faq } from '@/components/Faq';
import { ProductShowcase } from '@/components/ProductShowcase';
import { formatEuro } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = {
  title: 'For businesses — membership & pricing',
  description: 'Get a RateMe.ie business profile, your own QR code and tools to collect genuine customer ratings. One simple annual price in euro.',
  alternates: { canonical: '/for-business' },
};

export default async function ForBusiness() {
  const plan = await publicPlan();
  const price = plan ? formatEuro(plan.amount_cents) : null;
  return (
    <div>
      <section className="container-x grid items-start gap-12 py-14 lg:grid-cols-[1.2fr_1fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[.12em] text-sea">For Irish businesses</p>
          <h1 className="mt-2 text-4xl font-semibold leading-tight sm:text-5xl">Let your customers do the talking.</h1>
          <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-2">
            Most happy customers never think to leave a review. RateMe.ie gives you a professional profile and a QR code that makes
            rating you take a minute — so the next customer can see what people really think.
          </p>
          <ol className="mt-8 space-y-5">
            {[
              ['Claim or create your listing', 'Search first — a customer may already have added you. Then confirm your details.'],
              ['Verify you’re the owner', 'Instantly with a business email or website, or with a quick manual check for sole traders.'],
              [`Join${price ? ` for ${price} a year` : ''}`, 'Pay securely by card. Cancel future renewals whenever you like.'],
              ['Display your QR code', 'Counter, receipts, invoices, the van, the menu. Customers scan and rate in about a minute.'],
            ].map(([t, d], i) => (
              <li key={t} className="flex gap-4"><span className="display grid h-10 w-10 shrink-0 place-items-center rounded-full bg-ink text-lg text-gorse">{i + 1}</span>
                <div><p className="font-semibold">{t}</p><p className="text-ink-2">{d}</p></div></li>
            ))}
          </ol>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/register?intent=business" className="btn btn-primary text-base">Create a business account</Link>
            <Link href="/login?next=/dashboard/claim" className="btn btn-ghost text-base">I already have an account</Link>
          </div>
        </div>
        <MembershipCard plan={plan} />
      </section>

      <ProductShowcase />

      <section className="container-x mt-16">
        <div className="card grid gap-6 p-6 sm:p-8 md:grid-cols-3">
          {[
            ['Fair for everyone', 'You can’t buy a better rating — and neither can your competitors. That’s exactly why customers trust what they read.'],
            ['Your say, in public', 'Reply to every review professionally. A thoughtful reply to a 2-star review often wins more trust than ten 5-stars.'],
            ['Protection from abuse', 'Report or dispute reviews that break the rules. Fake, conflicted and abusive reviews are removed after review.'],
          ].map(([t, d]) => <div key={t}><p className="display text-xl">{t}</p><p className="mt-2 text-ink-2">{d}</p></div>)}
        </div>
      </section>

      <section className="container-x mt-16" id="faq">
        <h2 className="text-3xl font-semibold">Business FAQ</h2>
        <div className="mt-6"><Faq items={[
          { q: 'What do I get for the membership?', a: 'A public profile with your own permanent link, a unique permanent QR code (PNG, SVG and print-ready cards), the ability to reply to reviews, profile editing including your logo and links, and a dashboard with your ratings and genuinely measured profile activity.' },
          { q: 'Is the founding price limited?', a: `There’s no deadline or limited number of places. ${price ? `Founding membership is ${price} a year. ` : ''}We expect to introduce a higher standard price in future; founding members keep their price for as long as their membership renews without a break.` },
          { q: 'What if I get an unfair review?', a: 'Reply publicly — and if you believe it isn’t from a real customer, dispute it in one click. We automatically ask the reviewer to reconfirm it. If they don’t within 14 days, it’s removed. If they do, it stays. You can dispute up to 5 reviews every 30 days, whether or not you’re a member.' },
          { q: 'What happens if I stop paying?', a: 'Your profile and its legitimate reviews stay visible, and your printed QR codes keep working. Member tools — QR downloads, editing, replies and insights — pause until you rejoin. We never delete genuine reviews because a business leaves.' },
          { q: 'Can I offer customers a discount for a review?', a: 'No. Incentivised reviews aren’t allowed and can breach consumer-protection law. Ask every customer for honest feedback — that’s what makes your rating credible.' },
          { q: 'I’m a sole trader without a website. Can I join?', a: 'Yes. Choose manual verification — we’ll check public records such as the CRO register and your existing online presence, and may call your business number. We don’t publish home addresses.' },
          { q: 'How do I cancel?', a: 'From your dashboard, under Membership, at any time. Your membership stays active until the end of the period you’ve paid for, then doesn’t renew.' },
          { q: 'Do you charge VAT?', a: 'Prices are shown in euro. Any VAT that applies is shown on Stripe’s checkout page and on your invoice before you pay.' },
        ]} /></div>
      </section>
    </div>
  );
}
