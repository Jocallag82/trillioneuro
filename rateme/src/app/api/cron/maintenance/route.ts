import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { env } from '@/lib/env';

// Daily housekeeping (Vercel Cron). Implements the data-retention policy.
export async function GET(req: Request) {
  if (!env.cronSecret || req.headers.get('authorization') !== `Bearer ${env.cronSecret}`) return new NextResponse('Unauthorized', { status: 401 });
  const r = await sql.begin(async (tx) => {
    const expiredReviews = await tx`delete from reviews where status = 'pending_confirmation' and created_at < now() - interval '14 days' returning id`;
    const sessions = await tx`delete from sessions where expires_at < now() returning id`;
    const tokens = await tx`delete from email_tokens where expires_at < now() - interval '7 days' returning id`;
    const limits = await tx`delete from rate_limits where window_start < now() - interval '2 days' returning key`;
    // Network fingerprints are only needed for abuse checks; drop them after 90 days.
    const ips = await tx`update reviews set ip_hash = null where ip_hash is not null and created_at < now() - interval '90 days' returning id`;
    const reportIps = await tx`update reports set ip_hash = null where ip_hash is not null and created_at < now() - interval '90 days' returning id`;
    const outbox = await tx`delete from email_outbox where created_at < now() - interval '90 days' returning id`;
    return { expiredReviews: expiredReviews.length, sessions: sessions.length, tokens: tokens.length, limits: limits.length, ips: ips.length + reportIps.length, outbox: outbox.length };
  });
  return NextResponse.json({ ok: true, ...r });
}
