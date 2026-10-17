import Link from 'next/link';
import type { Metadata } from 'next';
import { requireUser, isStaff } from '@/lib/auth';
import { myBusinesses } from '@/lib/dashboard';
import { RatingNumber } from '@/components/Stars';
import { EmptyState, Notice } from '@/components/ui';
import { logoutAction } from '@/lib/auth-actions';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Dashboard' };

export default async function Dashboard({ searchParams }: { searchParams: Promise<{ verified?: string; denied?: string }> }) {
  const sp = await searchParams;
  const user = await requireUser({ next: '/dashboard' });
  const list = await myBusinesses(user.id);
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm text-muted">Signed in as {user.email}</p>
          <h1 className="text-3xl font-semibold">Hello, {user.display_name.split(' ')[0]}</h1>
        </div>
        <div className="flex gap-2">
          {isStaff(user) && <Link className="btn btn-ghost btn-sm" href="/admin">Admin</Link>}
          <Link className="btn btn-ghost btn-sm" href="/dashboard/account">Account</Link>
          <form action={logoutAction}><button className="btn btn-ghost btn-sm">Sign out</button></form>
        </div>
      </div>
      <div className="mt-4 space-y-3">
        {sp.verified && <Notice kind="ok">Your email is confirmed. Next, find or add your business.</Notice>}
        {sp.denied && <Notice kind="error">You don’t have access to that page.</Notice>}
      </div>
      <section className="mt-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Your businesses</h2>
          {list.length > 0 && <Link href="/dashboard/claim" className="btn btn-ghost btn-sm">Add another business</Link>}
        </div>
        {list.length ? (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {list.map((b) => (
              <li key={b.id}>
                <Link href={`/dashboard/b/${b.id}`} className="card flex flex-col gap-2 p-5 hover:border-sea/40">
                  <span className="text-lg font-semibold">{b.name}</span>
                  <span className="flex flex-wrap gap-2">
                    <span className={`badge ${b.member_status === 'verified' ? 'badge-sea' : 'badge-gorse'}`}>{b.member_status === 'verified' ? 'Ownership verified' : 'Verification needed'}</span>
                    <span className="badge badge-muted">Listing: {b.status}</span>
                  </span>
                  <RatingNumber avg={b.rating_avg} count={b.rating_count} />
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="mt-4">
            <EmptyState title="Let’s get your business on RateMe.ie" action={<Link href="/dashboard/claim" className="btn btn-primary">Find or add your business</Link>}>
              Search for your business first — a customer may already have added it. If it isn’t there, you can create the listing.
            </EmptyState>
          </div>
        )}
      </section>
    </div>
  );
}
