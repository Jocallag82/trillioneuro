import Link from 'next/link';
import type { Metadata } from 'next';
import { loadBusinessCtx } from '@/lib/dashboard';
import { publishedReviews } from '@/lib/businesses';
import { loadFunnel, parseRange, profileCompleteness, RANGES } from '@/lib/insights';
import { BizNav, StatusSteps } from './BizNav';
import { RatingSummary } from '@/components/RatingSummary';
import { ReviewItem } from '@/components/ReviewItem';
import { EmptyState, Notice } from '@/components/ui';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Business overview' };

export default async function Overview({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ range?: string }> }) {
  const { id } = await params;
  const range = parseRange((await searchParams).range);
  const days = RANGES[range];
  const ctx = await loadBusinessCtx(id, `/dashboard/b/${id}`);
  const b = ctx.business;
  const [recent, f] = await Promise.all([publishedReviews(id, { limit: 3 }), loadFunnel(id, days)]);
  const comp = profileCompleteness(b);
  // Prompts appear only when the underlying data supports them.
  const prompts: { text: string; href: string; cta: string }[] = [];
  if (ctx.verified) {
    if (f.unanswered > 0) prompts.push({ text: `You have ${f.unanswered} published ${f.unanswered === 1 ? 'review' : 'reviews'} without a reply.`, href: `/dashboard/b/${id}/reviews`, cta: 'Reply' });
    if (ctx.ent.active && f.scans > 0 && f.submitted === 0) prompts.push({ text: `Your QR code was scanned ${f.scans} ${f.scans === 1 ? 'time' : 'times'} in this period but no review was submitted. Mention that it takes about a minute.`, href: `/dashboard/b/${id}/qr`, cta: 'See invitation wording' });
    if (ctx.ent.active && f.views > f.prevViews && f.views >= 5) prompts.push({ text: `Profile visits are up: ${f.views} this period vs ${f.prevViews} the period before.`, href: `/business/${b.slug}`, cta: 'View profile' });
    if (comp.pct < 100) prompts.push({ text: `Your profile is ${comp.pct}% complete. Missing: ${comp.items.filter((i) => !i.done).map((i) => i.label.toLowerCase()).slice(0, 3).join(', ')}.`, href: `/dashboard/b/${id}/edit`, cta: 'Complete profile' });
  }
  const funnel = [
    { label: 'Profile visits', value: f.views, help: 'Visitors who opened your public profile (one per visitor per day).' },
    { label: 'QR scans', value: f.scans, help: 'Scans of your permanent QR code (one per phone per day).' },
    { label: 'Review forms opened', value: f.starts, help: 'Visitors who opened your review form, from a scan or your profile.' },
    { label: 'Reviews submitted', value: f.submitted, help: 'Reviews written in this period, before email confirmation. Unconfirmed ones are deleted after 14 days.' },
    { label: 'Email confirmed', value: f.confirmed, help: 'Reviewers who clicked the confirmation link.' },
    { label: 'Published', value: f.published, help: 'Reviews that passed checks and are live on your profile.' },
  ];
  const peak = Math.max(1, ...f.series.map((d) => d.views + d.scans));
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
      {prompts.length > 0 && (
        <ul className="mt-6 space-y-2" aria-label="Suggestions">
          {prompts.map((p) => (
            <li key={p.text} className="card flex flex-col items-start justify-between gap-2 p-4 sm:flex-row sm:items-center">
              <p className="text-sm">{p.text}</p>
              <Link href={p.href} className="btn btn-ghost btn-sm shrink-0">{p.cta}</Link>
            </li>
          ))}
        </ul>
      )}
      <section className="card mt-6 p-5" aria-labelledby="activity-h">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 id="activity-h" className="font-sans text-base font-bold tracking-normal">Customer feedback funnel</h2>
          <nav aria-label="Date range" className="flex gap-1 text-sm">
            {(Object.keys(RANGES) as (keyof typeof RANGES)[]).map((k) => (
              <Link key={k} href={`/dashboard/b/${id}?range=${k}`} aria-current={range === k ? 'page' : undefined}
                className={`rounded-full border border-line px-3 py-1 ${range === k ? 'bg-ink text-white' : 'bg-white'}`}>{k === '365' ? '12 months' : `${k} days`}</Link>
            ))}
          </nav>
        </div>
        {ctx.ent.active ? (
          <>
            <dl className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
              {funnel.map((m) => (
                <div key={m.label} className="rounded-xl bg-paper p-3">
                  <dt className="text-xs font-semibold text-ink-2">{m.label}</dt>
                  <dd className="display mt-1 text-2xl tabular-nums">{m.value.toLocaleString('en-IE')}</dd>
                  <dd className="mt-1 text-[11px] leading-snug text-muted">{m.help}</dd>
                </div>
              ))}
            </dl>
            {f.series.some((d) => d.views + d.scans > 0) ? (
              <div className="mt-5">
                <p className="text-xs text-muted">Daily profile visits and QR scans{days > 90 ? ' (last 90 days)' : ''}</p>
                <div className="mt-2 flex h-20 items-end gap-px" role="img" aria-label={`Daily activity chart: ${f.views} profile visits and ${f.scans} QR scans in total`}>
                  {f.series.map((d) => (
                    <div key={d.day} className="flex-1 rounded-t-sm bg-sea/80" style={{ height: `${Math.max(2, ((d.views + d.scans) / peak) * 100)}%`, opacity: d.views + d.scans ? 1 : 0.15 }} title={`${d.day}: ${d.views} visits, ${d.scans} scans`} />
                  ))}
                </div>
              </div>
            ) : <p className="mt-4 text-sm text-muted">No visits or scans recorded in this period yet. Numbers appear as people view your profile or scan your QR code.</p>}
            <p className="mt-3 text-xs text-muted">Counted from real page loads and the reviews themselves. Bots, link previews and your own visits are excluded; repeat visits by the same visitor on the same day count once.</p>
          </>
        ) : <p className="mt-2 text-sm text-muted">Activity insights are a member feature. Reviews and your rating stay public either way.</p>}
      </section>
      <div className="mt-8 grid gap-6 lg:grid-cols-[22rem_1fr]">
        <div className="space-y-6">
          <RatingSummary avg={b.rating_avg} count={b.rating_count} dist={b.rating_dist} />
          <div className="card p-5">
            <h2 className="font-sans text-base font-bold tracking-normal">Profile completeness</h2>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-paper-2" role="progressbar" aria-valuenow={comp.pct} aria-valuemin={0} aria-valuemax={100} aria-label="Profile completeness">
              <div className="h-full rounded-full bg-sea" style={{ width: `${comp.pct}%` }} />
            </div>
            <ul className="mt-3 space-y-1 text-sm">
              {comp.items.map((i) => <li key={i.key} className={i.done ? 'text-muted' : 'text-ink'}><span aria-hidden="true">{i.done ? '✓ ' : '○ '}</span>{i.label}<span className="sr-only">{i.done ? ' (done)' : ' (missing)'}</span></li>)}
            </ul>
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
