import type { Metadata } from 'next';
import { loadBusinessCtx } from '@/lib/dashboard';
import { BizNav } from '../BizNav';
import { CopyButton } from '@/components/CopyButton';
import { Notice } from '@/components/ui';
import { BADGE_STYLES, BADGE_SIZE, badgeLabel, type BadgeStyle } from '@/lib/badge';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';
export const metadata: Metadata = { title: 'Website badge' };

// Free for every verified owner: it puts real ratings in front of the business's own visitors.
export default async function BadgePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const ctx = await loadBusinessCtx(id, `/dashboard/b/${id}/badge`);
  const b = ctx.business;
  const label = badgeLabel(b.rating_count, b.rating_avg == null ? null : Number(b.rating_avg));
  const code = (s: BadgeStyle) => {
    const [w, h] = BADGE_SIZE[s];
    return `<a href="${env.appUrl}/business/${b.slug}" target="_blank" rel="noopener"><img src="${env.appUrl}/badge/${b.slug}?style=${s}" width="${w}" height="${h}" alt="${label}" loading="lazy"></a>`;
  };
  return (
    <div>
      <BizNav ctx={ctx} active="badge" />
      {b.status !== 'published' && <Notice kind="info">The badge works once your listing is published.</Notice>}
      <div className="prose-rm max-w-2xl">
        <p>Add your RateMe.ie rating to your website. It shows your real published score and review count, updates on its own within an hour of a new review, and links visitors to your profile.{b.rating_count === 0 && ' You have no published reviews yet, so it currently shows “Review us on RateMe.ie”.'}</p>
      </div>
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        {(Object.keys(BADGE_STYLES) as BadgeStyle[]).map((s) => (
          <section key={s} className="card space-y-3 p-5">
            <h2 className="font-sans text-base font-bold tracking-normal">{BADGE_STYLES[s]}</h2>
            <div className={`grid min-h-24 place-items-center rounded-xl p-4 ${s === 'dark' ? 'bg-paper-2' : 'bg-paper'}`}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={`/badge/${b.slug}?style=${s}`} width={BADGE_SIZE[s][0]} height={BADGE_SIZE[s][1]} alt={label} />
            </div>
            <label className="field"><span className="label text-sm">Embed code</span>
              <textarea readOnly className="textarea font-mono text-xs" rows={4} value={code(s)} /></label>
            <CopyButton text={code(s)} label="Copy embed code" />
          </section>
        ))}
      </div>
      <div className="prose-rm mt-8 max-w-2xl">
        <h2>Where to paste it</h2>
        <ul>
          <li><strong>WordPress</strong>: add a “Custom HTML” block to your footer or contact page.</li>
          <li><strong>Wix</strong>: Add → Embed code → Embed HTML.</li>
          <li><strong>Squarespace</strong>: add a Code block.</li>
          <li><strong>Shopify</strong>: Online Store → Themes → Customise → add a Custom Liquid section.</li>
        </ul>
        <p>The badge is there to show customers your genuine rating. Don’t change the code to add keywords or hide it.</p>
      </div>
    </div>
  );
}
