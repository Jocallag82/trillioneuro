import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

// Personal claim link from founder outreach (letter/flyer QR). Attribution happens on claim.
export async function GET(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const base = new URL(req.url);
  if (!/^[A-Za-z0-9_-]{16,64}$/.test(token)) return NextResponse.redirect(new URL('/for-business', base), 302);
  const [p] = await sql<{ slug: string }[]>`select b.slug from outreach_prospects p join businesses b on b.id = p.business_id where p.claim_token = ${token}`;
  const target = p ? `/for-business?claim=${encodeURIComponent(p.slug)}&ct=${token}` : '/for-business';
  const res = NextResponse.redirect(new URL(target, base), 302);
  res.headers.set('X-Robots-Tag', 'noindex'); res.headers.set('Cache-Control', 'no-store');
  return res;
}
