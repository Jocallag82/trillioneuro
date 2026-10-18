import QRCode from 'qrcode';
import type { PublicReview } from '@/lib/businesses';
import { siteUrl } from '@/lib/site';
import { LogoMark } from './Logo';
import { Stars } from './Stars';
import { RatingSummary } from './RatingSummary';
import { ReviewItem } from './ReviewItem';

/*
 * Product previews for the business pitch. They render the same components the live profile and dashboard use,
 * fed with clearly labelled sample data. Nothing here is a real business, review, rating or metric.
 */

const SAMPLE_NAME = 'Sample Plumbing & Heating';
const SAMPLE_DIST = [0, 1, 1, 4, 12];
const SAMPLE_COUNT = SAMPLE_DIST.reduce((a, b) => a + b, 0);
const SAMPLE_AVG = (SAMPLE_DIST.reduce((a, c, i) => a + c * (i + 1), 0) / SAMPLE_COUNT).toFixed(2);

const month = (offset: number) => { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - offset); return d; };
const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000);

const SAMPLE_REVIEWS: PublicReview[] = [
  { id: 'sample-1', rating: 5, title: 'Boiler fixed the same day', body: 'Rang in the morning and the boiler was running again by teatime. Clear price up front and tidied up after.',
    experience_type: 'Boiler repair', experience_month: month(0), reviewer_name: 'Sample reviewer', published_at: daysAgo(3), source: 'qr',
    response_body: 'Thanks for taking the time to rate us — glad the house is warm again.', response_at: daysAgo(2) },
  { id: 'sample-2', rating: 4, title: 'Good work, slight delay', body: 'Arrived an hour later than planned but kept me informed. Job done well.',
    experience_type: 'Radiator install', experience_month: month(1), reviewer_name: 'Sample reviewer', published_at: daysAgo(12), source: 'search',
    response_body: null, response_at: null },
];

export function SampleTag({ children = 'Sample data' }: { children?: React.ReactNode }) {
  return <span className="sample-tag"><svg width="10" height="10" viewBox="0 0 10 10" aria-hidden="true"><circle cx="5" cy="5" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" /></svg>{children}</span>;
}

/** Browser-style frame so each preview reads as a screen of the product. */
function Frame({ path, children, className = '' }: { path: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`overflow-hidden rounded-2xl border border-line bg-paper shadow-float ${className}`}>
      <div className="flex items-center gap-2 border-b border-line bg-white px-3 py-2" aria-hidden="true">
        <span className="flex gap-1"><i className="h-2 w-2 rounded-full bg-line" /><i className="h-2 w-2 rounded-full bg-line" /><i className="h-2 w-2 rounded-full bg-line" /></span>
        <span className="truncate rounded-md bg-paper px-2 py-0.5 text-[11px] text-muted">rateme.ie{path}</span>
      </div>
      {children}
    </div>
  );
}

export function ProfilePreview() {
  return (
    <Frame path="/business/your-business">
      <div className="space-y-3 p-4">
        <div className="card flex items-start gap-3 p-4">
          <span className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-sea text-lg font-bold text-white" aria-hidden="true">SP</span>
          <div className="min-w-0">
            <p className="font-bold leading-tight">{SAMPLE_NAME}</p>
            <p className="text-sm text-muted">Plumbers · Ballincollig, Co. Cork</p>
            <p className="mt-1 text-sm text-muted">021 000 0000 · example.ie</p>
          </div>
        </div>
        <div className="card flex items-center gap-3 p-4"><span className="text-3xl font-bold">{Number(SAMPLE_AVG).toFixed(1)}</span><div><Stars value={Number(SAMPLE_AVG)} size={13} /><p className="text-xs text-muted">{SAMPLE_COUNT} published ratings</p></div></div>
        <ReviewItem r={SAMPLE_REVIEWS[0]} businessName={SAMPLE_NAME} slug="sample" showReport={false} />
        <span className="btn btn-primary pointer-events-none w-full" aria-hidden="true">Rate this business</span>
      </div>
    </Frame>
  );
}

export async function QrCardPreview({ compact = false }: { compact?: boolean }) {
  // A real, scannable code. Members' cards encode their own permanent /r/<code> link; this sample opens the business page.
  const target = `${siteUrl()}/for-business`;
  const svg = await QRCode.toString(target, { type: 'svg', margin: 0, errorCorrectionLevel: 'Q', color: { dark: '#16211BFF', light: '#FFFFFF00' } });
  return (
    <div className={`relative mx-auto w-full ${compact ? 'max-w-[13rem]' : 'max-w-[17rem]'}`}>
      <div className="rounded-[1.4rem] bg-sea p-2 shadow-float">
        <div className="rounded-2xl bg-white p-5 text-center">
          <div className="flex items-center justify-center gap-1.5"><LogoMark size={22} /><span className="font-bold tracking-tight">RateMe<span className="text-sea">.ie</span></span></div>
          <p className="mt-3 text-lg font-bold leading-tight">How did we do?</p>
          <p className="text-xs text-muted">Scan to rate {SAMPLE_NAME}</p>
          <div className="mx-auto mt-3 aspect-square w-full max-w-[9.5rem] [&>svg]:h-full [&>svg]:w-full" role="img" aria-label="Sample QR code linking to RateMe for business" dangerouslySetInnerHTML={{ __html: svg }} />
          <div className="mt-3 flex justify-center"><Stars value={5} size={11} label="Five star rating illustration" /></div>
          <p className="mt-2 text-[11px] leading-snug text-muted">Takes about a minute. Free, no account needed.</p>
        </div>
      </div>
    </div>
  );
}

export function DashboardPreview() {
  const r = SAMPLE_REVIEWS[1];
  return (
    <Frame path="/dashboard">
      <div className="space-y-3 p-4">
        <RatingSummary avg={SAMPLE_AVG} count={SAMPLE_COUNT} dist={SAMPLE_DIST} />
        <div className="card p-4">
          <p className="text-sm font-bold">Activity — last 30 days</p>
          <dl className="mt-2 grid grid-cols-3 gap-2 text-center">
            {[['Profile views', 214], ['QR scans', 37], ['Review forms opened', 22]].map(([k, v]) => (
              <div key={k} className="rounded-lg bg-paper p-2"><dt className="text-[11px] leading-tight text-muted">{k}</dt><dd className="text-xl font-bold tabular-nums">{v}</dd></div>
            ))}
          </dl>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between gap-2"><Stars value={r.rating} size={12} label={`Rated ${r.rating} out of 5`} /><span className="badge badge-gorse">Awaiting reply</span></div>
          <p className="mt-2 font-bold">{r.title}</p>
          <p className="mt-1 text-sm text-ink-2">{r.body}</p>
          <div className="mt-3 rounded-xl border border-line bg-paper p-3 text-sm text-muted" aria-hidden="true">Write a public reply…</div>
          <div className="mt-2 flex gap-2" aria-hidden="true"><span className="btn btn-primary btn-sm pointer-events-none">Publish reply</span><span className="btn btn-ghost btn-sm pointer-events-none">Dispute</span></div>
        </div>
      </div>
    </Frame>
  );
}

/** "Everything your business needs to earn trust." — profile, QR card and dashboard. */
export async function ProductShowcase() {
  const items = [
    { t: 'Public business profile', d: 'Your identity, location and contact details, your genuine rating once customers have rated you, and every published review with your public replies.', node: <ProfilePreview /> },
    { t: 'QR review card', d: 'One permanent QR code for the counter, invoices and the van. Download PNG or SVG, or print ready-made review cards and posters.', node: <QrCardPreview /> },
    { t: 'Business dashboard', d: 'See published reviews, your rating distribution and measured profile views, QR scans and review forms opened. Reply or dispute from one place.', node: <DashboardPreview /> },
  ];
  return (
    <section className="border-y border-line bg-white py-20" aria-labelledby="product">
      <div className="container-x">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="eyebrow">What members get</p>
            <h2 id="product" className="mt-2 text-3xl font-bold sm:text-[2.6rem] sm:leading-[1.1]">Everything your business needs to earn trust.</h2>
          </div>
          <SampleTag>Previews use sample data</SampleTag>
        </div>
        <ul className="mt-12 grid gap-10 lg:grid-cols-3 lg:gap-8">
          {items.map((it) => (
            <li key={it.t} className="flex flex-col">
              <div className="flex min-h-[25rem] items-center rounded-3xl bg-paper-2/60 p-4 sm:p-6" inert>{it.node}</div>
              <h3 className="mt-5 text-xl font-bold">{it.t}</h3>
              <p className="mt-1.5 leading-relaxed text-ink-2">{it.d}</p>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-sm text-muted">
          Previews are built from RateMe’s real profile and dashboard components. The business, reviews, ratings and activity numbers shown are invented samples, not real results.
        </p>
      </div>
    </section>
  );
}

/** Customer journey from scan to published review. Mirrors the real flow; does not alter it. */
export function ReviewFlow() {
  const steps = [
    ['Scan the QR code', 'A customer scans your card with their phone camera. It opens your RateMe review form — no app, no account.', <ScanIcon key="i" />],
    ['Rate and comment', 'They choose 1 to 5 stars and can add a few words about what happened and roughly when.', <StarIcon key="i" />],
    ['Confirm and publish', 'They confirm by email. After automated checks, the published review appears on your profile.', <CheckIcon key="i" />],
  ] as const;
  return (
    <section className="container-x mt-20" aria-labelledby="flow">
      <p className="eyebrow">How a review reaches your profile</p>
      <h2 id="flow" className="mt-2 text-3xl font-bold sm:text-4xl">From scan to published in three steps</h2>
      <ol className="mt-10 grid gap-4 md:grid-cols-3">
        {steps.map(([t, d, icon], i) => (
          <li key={t} className="flow-step card relative p-6">
            <div className="flex items-center gap-3">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-sea-soft text-sea">{icon}</span>
              <span className="text-sm font-bold text-muted">Step {i + 1}</span>
            </div>
            <p className="mt-4 text-lg font-bold">{t}</p>
            <p className="mt-1.5 leading-relaxed text-ink-2">{d}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}

const ico = { width: 22, height: 22, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const, 'aria-hidden': true };
function ScanIcon() { return <svg {...ico}><path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3" /><path d="M9 9h2v2H9zM13 13h2v2h-2zM13 9h2M9 15h2" /></svg>; }
function StarIcon() { return <svg {...ico}><path d="M12 3.5l2.6 5.3 5.8.8-4.2 4.1 1 5.8L12 16.8l-5.2 2.7 1-5.8-4.2-4.1 5.8-.8L12 3.5z" /></svg>; }
function CheckIcon() { return <svg {...ico}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /><path d="m15 17 2 2 4-4" /></svg>; }
