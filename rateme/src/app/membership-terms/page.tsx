import Link from 'next/link';
import type { Metadata } from 'next';
import { LegalPage } from '@/components/Prose';
import { publicPlan } from '@/lib/membership';
import { formatEuro } from '@/lib/format';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Membership terms', alternates: { canonical: '/membership-terms' } };

export default async function MembershipTerms() {
  const plan = await publicPlan();
  return (
    <LegalPage title="Membership terms" intro="Clear terms for the RateMe.ie annual business membership.">
      <h2>1. What you’re buying</h2>
      <p>Membership gives a verified business access to member tools: QR code downloads and print materials, profile editing (including logo and links), public replies to reviews and activity insights. {plan ? <>The current price is <strong>{formatEuro(plan.amount_cents)} per {plan.billing_interval}</strong>.</> : null} Any VAT is shown at checkout.</p>
      <h2>2. What membership doesn’t do</h2>
      <p>It doesn’t verify ownership, change ratings, hide or reorder reviews, or affect moderation decisions. Paid members are labelled as such on their profile.</p>
      <h2>3. Ownership verification first</h2>
      <p>You can only buy membership for a business after we’ve verified you own or manage it.</p>
      <h2>4. Billing and renewal</h2>
      <ul>
        <li>Membership is billed annually in advance by card through Stripe and <strong>renews automatically</strong> each year until you cancel.</li>
        <li>We’ll email you before each renewal. Founding members keep their founding price for as long as their membership renews without a break.</li>
        <li>If a renewal payment fails, Stripe retries and we email you. Member tools stay available during a grace period (currently 14 days), then pause.</li>
      </ul>
      <h2>5. Cancelling</h2>
      <p>Cancel future renewals at any time from your dashboard’s Membership page. Your membership continues until the end of the paid period. As this is a business-to-business service, consumer cooling-off rights generally don’t apply; if you’ve been charged for a renewal you didn’t intend, contact us within 14 days and we’ll refund it if you haven’t used member tools since.</p>
      <h2>6. When membership ends</h2>
      <p>Your public profile and legitimate reviews remain visible and your QR code keeps working. Member tools pause. You remain able to dispute reviews that break our policy.</p>
      <h2>7. Refunds and chargebacks</h2>
      <p>If a payment is fully refunded or disputed with your card provider, member tools are suspended until the matter is resolved.</p>
      <h2>8. Suspension</h2>
      <p>We may suspend membership without refund for serious or repeated breaches of the <Link href="/review-policy">review policy</Link>, such as buying, faking or gating reviews.</p>
    </LegalPage>
  );
}
