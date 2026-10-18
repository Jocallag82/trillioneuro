import Link from 'next/link';
import type { Plan } from '@/lib/membership';
import { formatEuro } from '@/lib/format';

export const MEMBER_BENEFITS = [
  'A public business profile with your own permanent link',
  'Your unique QR code — PNG, SVG and a printable review card',
  'Invite customers to rate genuine experiences they’ve had with you',
  'Reply publicly to reviews under a fair response policy',
  'Dashboard: ratings, distribution, recent reviews and genuinely measured profile activity',
  'Edit your business details, logo and links any time',
];

export function MembershipCard({ plan, cta = true }: { plan: Plan | null; cta?: boolean }) {
  if (!plan) return null;
  return (
    <div className="card relative overflow-hidden p-6 sm:p-8">
      <div className="absolute inset-x-0 top-0 h-1.5 bg-sea" aria-hidden="true" />
      <p className="eyebrow">{plan.is_founding ? 'Founding membership' : 'Membership'}</p>
      <p className="display mt-2 text-2xl font-semibold">{plan.name}</p>
      <p className="mt-4 flex items-baseline gap-1">
        <span className="display text-5xl font-semibold">{formatEuro(plan.amount_cents)}</span>
        <span className="text-muted">/ {plan.billing_interval}</span>
      </p>
      <p className="mt-2 text-sm text-muted">
        Billed {plan.billing_interval === 'year' ? 'annually' : 'monthly'} in euro. Cancel future renewals any time.
        {plan.is_founding && ' Founding members keep this price for as long as their membership renews without a break.'}
      </p>
      <ul className="mt-6 space-y-3">
        {MEMBER_BENEFITS.map((b) => (
          <li key={b} className="flex gap-3"><Check /><span>{b}</span></li>
        ))}
      </ul>
      <p className="mt-6 rounded-xl bg-paper p-4 text-sm text-ink-2">
        <strong>What membership doesn’t buy:</strong> a better rating, hidden or removed reviews, or a higher place in search and category listings.
        The same rules apply to every business, paying or not.
      </p>
      {cta && <Link href="/register?intent=business" className="btn btn-primary mt-6 w-full text-base">Get started</Link>}
    </div>
  );
}

function Check() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true" className="mt-0.5 shrink-0">
      <circle cx="12" cy="12" r="11" fill="#e7efe9" />
      <path d="m7.5 12.5 3 3 6-7" fill="none" stroke="#1d4a35" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
