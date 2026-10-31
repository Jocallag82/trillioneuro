import 'server-only';
import { headers } from 'next/headers';
import { hmac } from './security';

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|embedly|quora|whatsapp|curl|wget|python|headless|lighthouse/i;

/** True for real browser page loads (not bots, not prefetches) — used for honest activity counts. */
export async function isHumanPageView(): Promise<boolean> {
  const h = await headers();
  const ua = h.get('user-agent') ?? '';
  if (!ua || BOT.test(ua)) return false;
  if (h.get('next-router-prefetch') || h.get('purpose') === 'prefetch' || h.get('sec-purpose')?.includes('prefetch')) return false;
  return true;
}

/** Non-reversible, day-scoped visitor key for de-duplicating activity counts. Never stored with an IP. */
export async function visitorKey(h?: Headers): Promise<string> {
  const hh = h ?? (await headers());
  const ip = (hh.get('x-vercel-forwarded-for')?.split(',')[0] || hh.get('x-forwarded-for')?.split(',')[0] || hh.get('x-real-ip') || '0.0.0.0').trim();
  const day = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Dublin' });
  return hmac(`visitor:${day}:${ip}:${hh.get('user-agent') ?? ''}`).slice(0, 32);
}
