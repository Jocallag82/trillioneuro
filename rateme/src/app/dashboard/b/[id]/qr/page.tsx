import Link from 'next/link';
import type { Metadata } from 'next';
import { loadBusinessCtx } from '@/lib/dashboard';
import { ensureQrCode, qrSvg, qrUrl } from '@/lib/qr';
import { BizNav } from '../BizNav';
import { Notice } from '@/components/ui';
import { CopyButton } from '@/components/CopyButton';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'QR code' };

export default async function QrPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadBusinessCtx(id, `/dashboard/b/${id}/qr`);
  if (!ctx.verified || !ctx.ent.active) {
    return (<div><BizNav ctx={ctx} active="qr" />
      <Notice kind="info">Your QR code is part of membership. {ctx.verified ? <Link className="underline" href={`/dashboard/b/${id}/membership`}>Activate membership</Link> : <Link className="underline" href={`/dashboard/b/${id}/verify`}>Verify ownership first</Link>}.</Notice></div>);
  }
  const code = await ensureQrCode(id);
  const svg = await qrSvg(code);
  const link = qrUrl(code);
  return (
    <div>
      <BizNav ctx={ctx} active="qr" />
      <div className="grid gap-8 lg:grid-cols-[22rem_1fr]">
        <div className="card p-5">
          <div className="mx-auto aspect-square w-full max-w-xs" dangerouslySetInnerHTML={{ __html: svg }} aria-label={`QR code linking to ${link}`} role="img" />
          <p className="mt-3 break-all text-center text-sm text-muted">{link}</p>
          <div className="mt-4 grid gap-2">
            <a className="btn btn-primary" href={`/api/qr/${id}?format=png`} download>Download PNG (high resolution)</a>
            <a className="btn btn-ghost" href={`/api/qr/${id}?format=svg`} download>Download SVG (for printers)</a>
            <Link className="btn btn-ghost" href={`/dashboard/b/${id}/poster`} target="_blank">Printable review card & poster</Link>
            <CopyButton text={link} label="Copy review link" />
          </div>
        </div>
        <div className="prose-rm max-w-2xl">
          <h2>Where to put your QR code</h2>
          <ul>
            <li><strong>At the counter or reception</strong> — print the review card and stand it next to the till.</li>
            <li><strong>On receipts and invoices</strong> — add the PNG to your invoice template or receipt printer logo.</li>
            <li><strong>After a job</strong> — tradespeople: leave a card with the customer, or text them the link.</li>
            <li><strong>On your van, menu or window</strong> — use the SVG for large prints; it stays sharp at any size.</li>
          </ul>
          <h2>How to ask — fairly</h2>
          <p>Ask <strong>every</strong> customer, not just the happy ones, e.g. <em>“We’d really value your honest feedback — scan this to rate us on RateMe.ie.”</em></p>
          <ul>
            <li>Don’t offer discounts, gifts or entries into draws in return for reviews.</li>
            <li>Don’t ask only satisfied customers, or ask customers to change a rating.</li>
            <li>Don’t write reviews yourself or ask staff, family or friends to.</li>
          </ul>
          <p>These practices break our <Link href="/review-policy">review policy</Link> and may breach consumer-protection law. We monitor patterns and may remove affected reviews or suspend a membership.</p>
          <h2>It never expires</h2>
          <p>This code is permanent. It keeps working if you rename your business, change your web address, or even if your membership lapses — so printed material is never wasted.</p>
        </div>
      </div>
    </div>
  );
}
