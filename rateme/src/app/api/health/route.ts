import { NextResponse } from 'next/server';
import { sql } from '@/lib/db';
import { emailConfigured } from '@/lib/email';
import { paymentsStatus } from '@/lib/env';

export const dynamic = 'force-dynamic';

// Liveness/readiness for monitoring. Reports configuration state only — never values.
export async function GET() {
  let database = 'ok';
  try {
    await sql`select 1 from categories limit 1`;
  } catch (e) {
    database = 'error';
    console.error('health: database check failed', (e as Error).message);
  }
  const body = { ok: database === 'ok', database, payments: paymentsStatus().mode, email: emailConfigured() ? 'configured' : 'not_configured' };
  return NextResponse.json(body, { status: body.ok ? 200 : 503, headers: { 'Cache-Control': 'no-store' } });
}
