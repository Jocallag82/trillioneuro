import Link from 'next/link';
import { LogoMark } from './Logo';

const COLS = [
  { title: 'Discover', links: [['/search', 'Find a business'], ['/categories', 'Browse categories'], ['/counties', 'Browse by county'], ['/add-business', 'Suggest a business']] },
  { title: 'Businesses', links: [['/for-business', 'Membership & pricing'], ['/register', 'Create an account'], ['/dashboard', 'Business dashboard'], ['/for-business#faq', 'Business FAQ']] },
  { title: 'Trust', links: [['/how-it-works', 'How ratings work'], ['/review-policy', 'Review policy'], ['/contact', 'Complaints & contact'], ['/data-request', 'Privacy requests']] },
  { title: 'Legal', links: [['/terms', 'Terms of service'], ['/privacy', 'Privacy notice'], ['/cookies', 'Cookies'], ['/membership-terms', 'Membership terms']] },
];

export function SiteFooter() {
  return (
    <footer className="mt-24 border-t border-line bg-ink text-white/80 no-print">
      <div className="container-x grid gap-10 py-14 md:grid-cols-[1.3fr_repeat(4,1fr)]">
        <div>
          <div className="flex items-center gap-2 text-white"><LogoMark size={28} /><span className="display text-xl font-semibold">RateMe.ie</span></div>
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-white/70">
            Discover Irish businesses. Share your experience. Help people choose with confidence.
          </p>
          <p className="mt-4 max-w-xs text-xs leading-relaxed text-white/55">
            Ratings reflect customers’ own submitted experiences. They are not an endorsement or guarantee by RateMe.ie.
            Businesses can pay for membership; membership never affects ratings or which reviews are shown.
          </p>
        </div>
        {COLS.map((c) => (
          <div key={c.title}>
            <p className="text-sm font-semibold text-white">{c.title}</p>
            <ul className="mt-3 space-y-2 text-sm">
              {c.links.map(([href, label]) => <li key={href}><Link href={href} className="hover:text-white hover:underline">{label}</Link></li>)}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <div className="container-x flex flex-col justify-between gap-2 py-5 text-xs text-white/55 sm:flex-row">
          <p>© {new Date().getFullYear()} RateMe.ie · Made for the Republic of Ireland</p>
          <p>Prices in euro.</p>
        </div>
      </div>
    </footer>
  );
}
