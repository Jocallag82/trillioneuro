import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return new NextResponse('Not found', { status: 404 });
  const [l] = await sql<{ mime: string; bytes: Buffer }[]>`
    select l.mime, l.bytes from logos l join businesses b on b.logo_id = l.id where l.id = ${id} and b.status <> 'removed'`;
  if (!l) return new NextResponse('Not found', { status: 404 });
  return new NextResponse(new Uint8Array(l.bytes), {
    headers: { 'Content-Type': l.mime, 'Cache-Control': 'public, max-age=31536000, immutable', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'" },
  });
}
