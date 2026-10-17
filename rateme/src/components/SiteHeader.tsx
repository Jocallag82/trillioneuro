import Link from 'next/link';
import { currentUser, isStaff } from '@/lib/auth';
import { Logo } from './Logo';
import { MobileMenu } from './MobileMenu';

const NAV = [
  { href: '/search', label: 'Find a business' },
  { href: '/categories', label: 'Categories' },
  { href: '/how-it-works', label: 'How ratings work' },
  { href: '/for-business', label: 'For businesses' },
];

export async function SiteHeader() {
  const user = await currentUser();
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-paper/90 backdrop-blur no-print">
      <div className="container-x flex h-16 items-center justify-between gap-4">
        <Link href="/" aria-label="RateMe.ie home" className="shrink-0"><Logo /></Link>
        <nav aria-label="Main" className="hidden items-center gap-1 lg:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-full px-3 py-2 text-[.95rem] font-medium text-ink-2 hover:bg-paper-2 hover:text-ink">{n.label}</Link>
          ))}
        </nav>
        <div className="hidden items-center gap-2 lg:flex">
          {user ? (
            <>
              {isStaff(user) && <Link href="/admin" className="btn btn-ghost btn-sm">Admin</Link>}
              <Link href="/dashboard" className="btn btn-ink btn-sm">Dashboard</Link>
            </>
          ) : (
            <>
              <Link href="/login" className="btn btn-ghost btn-sm">Sign in</Link>
              <Link href="/for-business" className="btn btn-primary btn-sm">List your business</Link>
            </>
          )}
        </div>
        <MobileMenu nav={NAV} signedIn={!!user} staff={isStaff(user)} />
      </div>
    </header>
  );
}
