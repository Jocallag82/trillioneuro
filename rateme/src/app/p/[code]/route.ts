import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { normPartnerCode } from '@/lib/attribution';

// Partner referral link: /p/CODE → business sign-up carrying the code (no tracking cookie).
export async function GET(req: Request, { params }: { params: Promise<{ code: string }> }) {
  const code = normPartnerCode((await params).code);
  const base = new URL(req.url);
  const [p] = code ? await sql`select 1 from partners where code = ${code} and active` : [];
  const res = NextResponse.redirect(new URL(p ? `/for-business?ref=${code}` : '/for-business', base), 302);
  res.headers.set('X-Robots-Tag', 'noindex');
  return res;
}
