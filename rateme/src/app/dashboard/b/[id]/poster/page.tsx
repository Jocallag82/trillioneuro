import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { loadBusinessCtx } from '@/lib/dashboard';
import { ensureQrCode, qrSvg, qrUrl } from '@/lib/qr';
import { LogoMark } from '@/components/Logo';
import { PrintButton } from '@/components/PrintButton';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Printable review card' };

export default async function Poster({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadBusinessCtx(id, `/dashboard/b/${id}/poster`);
  if (!ctx.verified || !ctx.ent.active) redirect(`/dashboard/b/${id}/qr`);
  const code = await ensureQrCode(id);
  const svg = await qrSvg(code);
  return (
    <div className="mx-auto max-w-3xl">
      <div className="no-print mb-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-ink-2">Print on A4. The top half is a poster; cut out the cards below for counters or to hand to customers.</p>
        <PrintButton />
      </div>
      <section className="rounded-[1.5rem] border-2 border-ink bg-white p-8 text-center print:break-after-page">
        <div className="flex items-center justify-center gap-2"><LogoMark size={36} /><span className="display text-2xl font-semibold">RateMe<span className="text-sea">.ie</span></span></div>
        <p className="display mt-6 text-4xl font-semibold leading-tight">How did we do?</p>
        <p className="mt-2 text-xl">Rate your experience with <strong>{ctx.business.name}</strong></p>
        <div className="mx-auto mt-6 w-64" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label="QR code" />
        <p className="mt-4 text-lg">Scan with your phone camera — it takes about a minute.</p>
        <p className="mt-1 text-sm text-muted">{qrUrl(code)}</p>
        <p className="mt-6 text-xs text-muted">Free for customers. We welcome all honest feedback — good or bad. Reviews are moderated under the RateMe.ie review policy.</p>
      </section>
      <section className="mt-8 grid grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="rounded-2xl border border-dashed border-ink/50 p-4 text-center">
            <p className="display text-lg font-semibold">Rate {ctx.business.name}</p>
            <div className="mx-auto mt-2 w-32" dangerouslySetInnerHTML={{ __html: svg }} role="img" aria-label="QR code" />
            <p className="mt-2 text-xs">Scan to share your honest experience on RateMe.ie</p>
          </div>
        ))}
      </section>
    </div>
  );
}
