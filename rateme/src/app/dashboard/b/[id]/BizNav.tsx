import Link from 'next/link';
import type { BizCtx } from '@/lib/dashboard';

export function BizNav({ ctx, active }: { ctx: BizCtx; active: string }) {
  const id = ctx.business.id;
  const all = [
    ['overview', `/dashboard/b/${id}`, 'Overview'],
    ['verify', `/dashboard/b/${id}/verify`, ctx.verified ? 'Verification' : 'Verify ownership'],
    ['membership', `/dashboard/b/${id}/membership`, 'Membership'],
    ['qr', `/dashboard/b/${id}/qr`, 'QR code'],
    ['reviews', `/dashboard/b/${id}/reviews`, 'Reviews'],
    ['edit', `/dashboard/b/${id}/edit`, 'Edit profile'],
  ];
  const items = ctx.verified ? all : all.filter(([k]) => k === 'verify');
  return (
    <div className="mb-8">
      <Link href="/dashboard" className="text-sm text-muted hover:underline">← All businesses</Link>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold">{ctx.business.name}</h1>
        <Link href={`/business/${ctx.business.slug}`} className="btn btn-ghost btn-sm">{ctx.business.status === 'published' ? 'View public profile' : 'Preview profile'}</Link>
      </div>
      <nav aria-label="Business sections" className="-mx-1 mt-4 flex gap-1 overflow-x-auto pb-1">
        {items.map(([k, href, label]) => (
          <Link key={k} href={href} aria-current={active === k ? 'page' : undefined}
            className={`shrink-0 rounded-full px-4 py-2 text-sm font-semibold ${active === k ? 'bg-ink text-white' : 'bg-white text-ink-2 hover:bg-paper-2'} border border-line`}>{label}</Link>
        ))}
      </nav>
    </div>
  );
}

export function StatusSteps({ ctx }: { ctx: BizCtx }) {
  const steps = [
    { label: 'Account', done: !!ctx.user.email_verified_at, help: 'Email confirmed' },
    { label: 'Claimed', done: true, help: 'You’ve claimed this listing' },
    { label: 'Ownership verified', done: ctx.verified, help: ctx.verified ? 'We’ve checked you manage it' : 'Needed before membership' },
    { label: 'Membership', done: ctx.ent.active, help: ctx.ent.active ? `Active${ctx.ent.state === 'cancelling' ? ' (ends at period end)' : ''}` : 'Not active' },
  ];
  return (
    <ol className="grid gap-2 sm:grid-cols-4" aria-label="Setup progress">
      {steps.map((s, i) => (
        <li key={s.label} className={`card flex items-center gap-3 p-3 ${s.done ? '' : 'border-dashed'}`}>
          <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-sm font-bold ${s.done ? 'bg-sea text-white' : 'bg-paper-2 text-muted'}`} aria-hidden="true">{s.done ? '✓' : i + 1}</span>
          <span className="min-w-0"><span className="block text-sm font-semibold">{s.label}</span><span className="block truncate text-xs text-muted">{s.help}</span></span>
          <span className="sr-only">{s.done ? 'complete' : 'not complete'}</span>
        </li>
      ))}
    </ol>
  );
}
