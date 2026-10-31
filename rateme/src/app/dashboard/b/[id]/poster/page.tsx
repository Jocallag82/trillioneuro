import Link from 'next/link';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { loadBusinessCtx } from '@/lib/dashboard';
import { ensureQrCode, qrSvg, qrUrl } from '@/lib/qr';
import { bumpStat } from '@/lib/businesses';
import { LogoMark } from '@/components/Logo';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Printable review kit' };

const KITS = {
  poster: { label: 'A4 poster', help: 'For a window, wall or reception. Print on A4 at 100% scale.' },
  counter: { label: 'Counter cards', help: 'Four A6 cards per A4 sheet. Cut along the dashed lines and fold or stand them by the till.' },
  invoice: { label: 'Invoice inserts', help: 'Eight DL-third slips per A4 sheet to slip in with invoices, receipts or deliveries.' },
  van: { label: 'Van / vehicle sticker', help: 'Artwork for a sign maker. Print or send the SVG for vinyl; keep the QR at least 8 cm wide for scanning from a distance.' },
} as const;
type Kit = keyof typeof KITS;

// Every item uses the same neutral wording for every customer: no gating, no incentives.
export default async function Poster({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<{ kit?: string }> }) {
  const { id } = await params;
  const kitParam = (await searchParams).kit;
  const kit: Kit = kitParam && kitParam in KITS ? (kitParam as Kit) : 'poster';
  const ctx = await loadBusinessCtx(id, `/dashboard/b/${id}/poster`);
  if (!ctx.verified || !ctx.ent.active) redirect(`/dashboard/b/${id}/qr`);
  const code = await ensureQrCode(id);
  const svg = await qrSvg(code);
  const link = qrUrl(code).replace(/^https?:\/\//, '');
  const name = ctx.business.name;
  await bumpStat(id, 'kit_downloads', `owner:${ctx.user.id}:${new Date().toISOString().slice(0, 10)}:${kit}`).catch(() => {});
  const qr = (w: string) => <div className={`mx-auto ${w}`} dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label={`QR code linking to ${link}`} />;
  const brand = (s = 22) => <span className="inline-flex items-center gap-1.5"><LogoMark size={s} /><span className="font-semibold">RateMe<span className="text-sea">.ie</span></span></span>;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-6 space-y-4">
        <Link href={`/dashboard/b/${id}/qr`} className="text-sm text-muted hover:underline">← Back to QR code</Link>
        <nav aria-label="Print templates" className="flex flex-wrap gap-2">
          {(Object.keys(KITS) as Kit[]).map((k) => (
            <Link key={k} href={`?kit=${k}`} aria-current={kit === k ? 'page' : undefined}
              className={`rounded-full border border-line px-4 py-2 text-sm font-semibold ${kit === k ? 'bg-ink text-white' : 'bg-white'}`}>{KITS[k].label}</Link>
          ))}
        </nav>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-ink-2">{KITS[kit].help} Test-scan one copy with your own phone before printing a batch.</p>
          <PrintButton />
        </div>
      </div>

      {kit === 'poster' && (
        <section className="rounded-[1.5rem] border-2 border-ink bg-white p-10 text-center">
          {brand(36)}
          <p className="display mt-8 text-5xl font-semibold leading-tight">How did we do?</p>
          <p className="mt-3 text-xl">Tell other customers about your experience with <strong>{name}</strong>.</p>
          <div className="mt-8">{qr("w-72")}</div>
          <p className="mt-6 text-lg">Point your phone camera at the code. It takes about a minute.</p>
          <p className="mt-1 text-sm text-muted">or visit {link}</p>
          <p className="mt-8 text-xs text-muted">Free for customers. Every honest review is welcome, good or bad. Reviews follow the RateMe.ie review policy.</p>
        </section>
      )}

      {kit === 'counter' && (
        <section className="grid grid-cols-2 gap-0 border border-dashed border-ink/40 bg-white">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="border border-dashed border-ink/40 p-6 text-center">
              {brand()}
              <p className="display mt-3 text-xl font-semibold">Rate your visit</p>
              <p className="text-sm">{name}</p>
              <div className="mt-3">{qr("w-36")}</div>
              <p className="mt-3 text-xs">Scan to share your honest experience</p>
              <p className="text-[10px] text-muted">{link}</p>
            </div>
          ))}
        </section>
      )}

      {kit === 'invoice' && (
        <section className="grid grid-cols-2 bg-white">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 border border-dashed border-ink/40 p-4">
              <div className="w-20 shrink-0" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label="QR code" />
              <div className="min-w-0 text-left">
                <p className="text-sm font-semibold">Thanks for choosing {name}</p>
                <p className="mt-1 text-xs">How did we do? Scan to leave an honest review on RateMe.ie.</p>
                <p className="mt-1 break-all text-[10px] text-muted">{link}</p>
              </div>
            </div>
          ))}
        </section>
      )}

      {kit === 'van' && (
        <section className="mx-auto max-w-xl rounded-2xl bg-white p-8 ring-4 ring-ink">
          <div className="flex items-center gap-6">
            {qr("w-48 shrink-0")}
            <div className="text-left">
              <p className="display text-3xl font-semibold leading-tight">Used {name}?</p>
              <p className="mt-2 text-lg">Scan to rate us</p>
              <p className="mt-4">{brand(26)}</p>
            </div>
          </div>
          <p className="no-print mt-6 text-sm text-muted">For vinyl, give your sign maker the <a className="underline" href={`/api/qr/${id}?format=svg`}>SVG file</a>. Keep a white border (quiet zone) around the code and dark-on-light colours.</p>
        </section>
      )}
    </div>
  );
}
