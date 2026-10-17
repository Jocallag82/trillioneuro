import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { sql } from '@/lib/db';
import { getEntitlement } from '@/lib/membership';
import { ensureQrCode, qrPng, qrSvg } from '@/lib/qr';
import { slugify } from '@/lib/util';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await currentUser();
  if (!user || !/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Not found', { status: 404 });
  const [m] = await sql<{ name: string }[]>`
    select b.name from business_members m join businesses b on b.id = m.business_id
    where m.business_id = ${id} and m.user_id = ${user.id} and m.status = 'verified'`;
  if (!m) return new NextResponse('Not found', { status: 404 });
  if (!(await getEntitlement(id)).active) return new NextResponse('An active membership is required to download QR codes.', { status: 402 });
  const code = await ensureQrCode(id);
  const format = new URL(req.url).searchParams.get('format') === 'svg' ? 'svg' : 'png';
  const filename = `rateme-qr-${slugify(m.name) || 'business'}.${format}`;
  const headers = { 'Content-Disposition': `attachment; filename="${filename}"`, 'Cache-Control': 'private, no-store', 'X-Content-Type-Options': 'nosniff' };
  if (format === 'svg') return new NextResponse(await qrSvg(code), { headers: { ...headers, 'Content-Type': 'image/svg+xml' } });
  return new NextResponse(new Uint8Array(await qrPng(code, 2000)), { headers: { ...headers, 'Content-Type': 'image/png' } });
}
