import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { bumpStat } from '@/lib/businesses';

// Permanent QR target. Resolves even after a membership lapses, so printed codes never break.
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const base = new URL(req.url);
  if (!/^[A-Za-z0-9]{8}$/.test(code)) return NextResponse.redirect(new URL('/', base), 302);
  const [row] = await sql<{ id: string; slug: string; status: string }[]>`
    select b.id, b.slug, b.status from qr_codes q join businesses b on b.id = q.business_id
    where q.code = ${code} and q.revoked_at is null`;
  if (!row) return NextResponse.redirect(new URL('/search', base), 302);
  const ua = req.headers.get('user-agent') ?? '';
  if (!/bot|crawl|spider|preview/i.test(ua)) await bumpStat(row.id, 'qr_scans').catch(() => {});
  const target = row.status === 'published' ? `/business/${row.slug}/review?src=qr` : `/business/${row.slug}`;
  const res = NextResponse.redirect(new URL(target, base), 302);
  res.headers.set('Cache-Control', 'no-store');
  res.headers.set('X-Robots-Tag', 'noindex');
  return res;
}
