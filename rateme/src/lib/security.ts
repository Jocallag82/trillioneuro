import 'server-only';
import crypto from 'node:crypto';
import { headers } from 'next/headers';
import { sql } from './db';
import { env } from './env';

export async function clientIp(): Promise<string> {
  const h = await headers();
  // Vercel sets x-vercel-forwarded-for / x-forwarded-for itself; clients can't spoof them there.
  return (h.get('x-vercel-forwarded-for')?.split(',')[0] || h.get('x-forwarded-for')?.split(',')[0] || h.get('x-real-ip') || '0.0.0.0').trim();
}

/** Keyed hash of an IP address: lets us spot abuse without storing the address itself. */
export function hashIp(ip: string): string {
  return crypto.createHmac('sha256', env.secret).update(`ip:${ip}`).digest('hex').slice(0, 32);
}

export function hmac(value: string): string {
  return crypto.createHmac('sha256', env.secret).update(value).digest('hex');
}

/**
 * Fixed-window rate limit stored in Postgres (no extra infrastructure).
 * Returns true when the action is allowed.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const [row] = await sql<{ count: number }[]>`
    insert into rate_limits (key, window_start, count)
    values (${key}, to_timestamp(floor(extract(epoch from now()) / ${windowSeconds}) * ${windowSeconds}), 1)
    on conflict (key, window_start) do update set count = rate_limits.count + 1
    returning count`;
  return row.count <= limit;
}

export async function ipRateLimit(scope: string, limit: number, windowSeconds: number): Promise<boolean> {
  return rateLimit(`${scope}:${hashIp(await clientIp())}`, limit, windowSeconds);
}

/** Simple honeypot + minimum fill-time bot check for public forms. */
export function looksAutomated(form: FormData): boolean {
  if (String(form.get('website_confirm') ?? '').length > 0) return true; // hidden field humans never fill
  const started = Number(form.get('form_started') ?? 0);
  if (!started) return false;
  return Date.now() - started < 2500;
}
