import 'server-only';
import { notFound } from 'next/navigation';
import { sql } from './db';
import type { User } from './auth';

export type Membership = { id: string; business_id: string; role: string; status: string };

/**
 * Server-side authorisation for every business-scoped action. Returns 404 rather than 403 so
 * IDs of other businesses can't be probed. Staff use the separate /admin tools.
 */
export async function requireBusinessAccess(user: User, businessId: string, opts: { verified?: boolean } = { verified: true }) {
  if (!/^[0-9a-f-]{36}$/i.test(businessId)) notFound();
  const [m] = await sql<Membership[]>`
    select id, business_id, role, status from business_members
    where business_id = ${businessId} and user_id = ${user.id} and status in ('pending','verified')`;
  if (!m) notFound();
  if (opts.verified !== false && m.status !== 'verified') notFound();
  return m;
}
