import 'server-only';
import { notFound, redirect } from 'next/navigation';
import { sql } from './db';
import { requireUser, type User } from './auth';
import { getEntitlement, type Entitlement } from './membership';

export type DashBusiness = {
  id: string; slug: string; name: string; status: string; category_id: number; county_id: number; locality_id: number | null;
  address_line1: string | null; address_line2: string | null; eircode: string | null; show_address: boolean; phone: string | null;
  public_email: string | null; website: string | null; website_domain: string | null; description: string | null; cro_number: string | null;
  socials: Record<string, string>; logo_id: string | null; rating_count: number; rating_avg: string | null; rating_dist: number[];
  ownership_verified_at: Date | null; source: string;
};

export type BizCtx = { user: User; member: { id: string; status: string; role: string }; business: DashBusiness; ent: Entitlement; verified: boolean };

/** Loads a business for the signed-in user, enforcing membership server-side (404 otherwise). */
export async function loadBusinessCtx(id: string, path: string, opts: { allowPending?: boolean } = {}): Promise<BizCtx> {
  const user = await requireUser({ next: path });
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const [row] = await sql<(DashBusiness & { member_id: string; member_status: string; member_role: string })[]>`
    select b.id, b.slug, b.name, b.status, b.category_id, b.county_id, b.locality_id, b.address_line1, b.address_line2, b.eircode,
      b.show_address, b.phone, b.public_email, b.website, b.website_domain, b.description, b.cro_number, b.socials, b.logo_id,
      b.rating_count, b.rating_avg::text, b.rating_dist, b.ownership_verified_at, b.source,
      m.id member_id, m.status member_status, m.role member_role
    from business_members m join businesses b on b.id = m.business_id
    where m.business_id = ${id} and m.user_id = ${user.id} and m.status in ('pending','verified') and b.status <> 'removed'`;
  if (!row) notFound();
  const { member_id, member_status, member_role, ...business } = row;
  // Until ownership is verified, a claimant may only see the verification step — never the
  // business's membership, billing, activity or moderation data.
  if (member_status !== 'verified' && !opts.allowPending) redirect(`/dashboard/b/${id}/verify`);
  const ent = await getEntitlement(id);
  return { user, member: { id: member_id, status: member_status, role: member_role }, business, ent, verified: member_status === 'verified' };
}

export async function myBusinesses(userId: string) {
  return sql<{ id: string; slug: string; name: string; status: string; member_status: string; rating_count: number; rating_avg: string | null }[]>`
    select b.id, b.slug, b.name, b.status, m.status member_status, b.rating_count, b.rating_avg::text
    from business_members m join businesses b on b.id = m.business_id
    where m.user_id = ${userId} and m.status in ('pending','verified') and b.status <> 'removed'
    order by m.created_at`;
}
