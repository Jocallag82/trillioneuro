import 'server-only';
import { headers } from 'next/headers';

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora|whatsapp|curl|wget|python|headless|lighthouse/i;

/** True for real browser page loads (not bots, not prefetches) — used for honest activity counts. */
export async function isHumanPageView(): Promise<boolean> {
  const h = await headers();
  const ua = h.get('user-agent') ?? '';
  if (!ua || BOT.test(ua)) return false;
  if (h.get('next-router-prefetch') || h.get('purpose') === 'prefetch' || h.get('sec-purpose')?.includes('prefetch')) return false;
  return true;
}
