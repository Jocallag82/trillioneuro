import Link from 'next/link';
import type { Metadata } from 'next';
import { loadBusinessCtx } from '@/lib/dashboard';
import { publishedReviews } from '@/lib/businesses';
import { sql } from '@/lib/db';
import { BizNav, StatusSteps } from './BizNav';
import { RatingSummary } from '@/components/RatingSummary';
import { ReviewItem } from '@/components/ReviewItem';
import { EmptyState, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Business overview' };

export default async function Overview({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadBusinessCtx(id, `/dashboard/b/${id}`);
  const b = ctx.business;
  const [recent, stats] = await Promise.all([
    publishedReviews(id, { limit: 3 }),
    sql<{ views: number; scans: number; starts: number; days: number }[]>`
      select coalesce(sum(profile_views),0)::int views, coalesce(sum(qr_scans),0)::int scans, coalesce(sum(review_starts),0)::int starts, count(*)::int days
      from business_daily_stats where business_id = ${id} and day > (now() at time zone 'Europe/Dublin')::date - 30`,
  ]);
  const s = stats[0];
  const next = !ctx.verified
    ? { text: 'Verify that you own or manage this business.', href: `/dashboard/b/${id}/verify`, cta: 'Verify ownership' }
    : !ctx.ent.active
      ? { text: 'Activate membership to get your QR code and member tools.', href: `/dashboard/b/${id}/membership`, cta: 'Choose membership' }
      : b.rating_count === 0
        ? { text: 'Put your QR code where customers will see it and ask recent customers to share their experience.', href: `/dashboard/b/${id}/qr`, cta: 'Get your QR code' }
        : null;
  return (
    <div>
      <BizNav ctx={ctx} active="overview" />
      <StatusSteps ctx={ctx} />
      {next && (
        <div className="card mt-6 flex flex-col items-start justify-between gap-3 border-sea/30 bg-sea-soft/50 p-5 sm:flex-row sm:items-center">
          <p className="font-medium">Next step: {next.text}</p>
          <Link href={next.href} className="btn btn-primary shrink-0">{next.cta}</Link>
        </div>
      )}
      {ctx.ent.state === 'grace' && <div className="mt-4"><Notice kind="warn">Your last payment failed. <Link className="underline" href={`/dashboard/b/${id}/membership`}>Update payment details</Link> to keep member tools.</Notice></div>}
      <div className="mt-8 grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-6">
          <RatingSummary avg={b.rating_avg} count={b.rating_count} dist={b.rating_dist} />
          <div className="card p-5">
            <h2 className="font-sans text-base font-bold tracking-normal">Activity — last 30 days</h2>
            {ctx.ent.active ? (
              s.days === 0 ? <p className="mt-2 text-sm text-muted">No activity recorded yet. Numbers appear here as people view your profile or scan your QR code.</p> : (
                <dl className="mt-3 grid grid-cols-3 gap-3 text-center">
                  <div><dt className="text-xs text-muted">Profile views</dt><dd className="display text-2xl">{s.views}</dd></div>
                  <div><dt className="text-xs text-muted">QR scans</dt><dd className="display text-2xl">{s.scans}</dd></div>
                  <div><dt className="text-xs text-muted">Review forms opened</dt><dd className="display text-2xl">{s.starts}</dd></div>
                </dl>
              )
            ) : <p className="mt-2 text-sm text-muted">Activity insights are a member feature.</p>}
            <p className="mt-3 text-xs text-muted">Counted from real page loads; known bots and your own visits are excluded. Approximate.</p>
          </div>
        </div>
        <section>
          <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">Recent reviews</h2><Link className="text-sm font-semibold text-sea" href={`/dashboard/b/${id}/reviews`}>All reviews</Link></div>
          <div className="mt-4 space-y-4">
            {recent.length ? recent.map((r) => <ReviewItem key={r.id} r={r} businessName={b.name} slug={b.slug} showReport={false} />) : (
              <EmptyState title="No reviews yet">When customers rate you, their reviews appear here and on your public profile.</EmptyState>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
