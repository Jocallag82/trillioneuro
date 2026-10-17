import Link from 'next/link';
import type { Metadata } from 'next';
import { requireStaff } from '@/lib/auth';

export const metadata: Metadata = { title: { default: 'Admin', template: '%s · Admin · RateMe.ie' }, robots: { index: false, follow: false } };
export const dynamic = 'force-dynamic';

const NAV: [string, string, 'moderator' | 'admin'][] = [
  ['/admin', 'Overview', 'moderator'], ['/admin/reviews', 'Reviews', 'moderator'], ['/admin/verifications', 'Ownership claims', 'moderator'],
  ['/admin/businesses', 'Businesses', 'moderator'], ['/admin/reports', 'Reports & corrections', 'moderator'], ['/admin/data-requests', 'Privacy & legal requests', 'moderator'],
  ['/admin/categories', 'Categories', 'admin'], ['/admin/pricing', 'Pricing', 'admin'], ['/admin/users', 'Users', 'admin'], ['/admin/audit', 'Audit log', 'admin'],
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaff('moderator');
  return (
    <div className="container-x py-8">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-semibold uppercase tracking-[.12em] text-sea">Administration · {user.role}</p>
        <p className="text-sm text-muted">{user.email}</p>
      </div>
      <nav aria-label="Admin" className="-mx-1 mb-8 flex gap-1 overflow-x-auto pb-1">
        {NAV.filter(([, , min]) => min === 'moderator' || user.role === 'admin').map(([href, label]) => (
          <Link key={href} href={href} className="shrink-0 rounded-full border border-line bg-white px-4 py-2 text-sm font-semibold text-ink-2 hover:bg-paper-2">{label}</Link>
        ))}
      </nav>
      {children}
    </div>
  );
}
