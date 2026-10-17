import { NextResponse } from 'next/server';
import { currentUser } from '@/lib/auth';
import { sql } from '@/lib/db';

export async function GET() {
  const u = await currentUser();
  if (!u) return new NextResponse('Unauthorized', { status: 401 });
  const [account] = await sql`select id, email, display_name, role, status, email_verified_at, created_at from users where id = ${u.id}`;
  const memberships = await sql`select m.business_id, b.name, m.role, m.status, m.created_at, m.verified_at from business_members m join businesses b on b.id = m.business_id where m.user_id = ${u.id}`;
  const verification = await sql`select business_id, method, status, target, evidence, contact_phone, created_at, decided_at from verification_requests where user_id = ${u.id}`;
  const reviews = await sql`select r.id, b.name business, r.rating, r.title, r.body, r.status, r.created_at from reviews r join businesses b on b.id = r.business_id where r.reviewer_email = ${u.email}`;
  const subs = await sql`select s.business_id, s.status, s.amount_cents, s.currency, s.current_period_end, s.created_at from subscriptions s where s.purchaser_id = ${u.id}`;
  const body = JSON.stringify({ exported_at: new Date().toISOString(), account, memberships, verification_requests: verification, reviews_written_with_this_email: reviews, subscriptions: subs }, null, 2);
  return new NextResponse(body, { headers: { 'Content-Type': 'application/json', 'Content-Disposition': 'attachment; filename="rateme-my-data.json"', 'Cache-Control': 'no-store' } });
}
