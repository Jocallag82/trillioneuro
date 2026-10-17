'use server';
import { redirect } from 'next/navigation';
import { sql } from '@/lib/db';
import { requireUser } from '@/lib/auth';
import { parseBusinessForm } from '@/lib/business-form';
import { similarBusinesses, uniqueSlug } from '@/lib/businesses';
import { audit } from '@/lib/audit';
import { rateLimit } from '@/lib/security';
import { slugify } from '@/lib/util';

export type CreateState = { error?: string; duplicates?: { slug: string; name: string; locality: string | null }[] };

export async function claimBusiness(form: FormData) {
  const user = await requireUser();
  const id = String(form.get('business_id') ?? '');
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect('/dashboard/claim');
  if (!(await rateLimit(`claim:${user.id}`, 10, 86400))) redirect('/dashboard/claim?error=' + encodeURIComponent('Too many claims today.'));
  const [b] = await sql<{ id: string }[]>`select id from businesses where id = ${id} and status in ('published','pending')`;
  if (!b) redirect('/dashboard/claim');
  await sql`insert into business_members (business_id, user_id, role, status) values (${id}, ${user.id}, 'owner', 'pending')
            on conflict (business_id, user_id) do update set status = case when business_members.status in ('rejected','revoked') then 'pending' else business_members.status end`;
  await audit(user.id, 'business.claim_started', 'business', id);
  redirect(`/dashboard/b/${id}/verify`);
}

export async function createBusiness(_p: CreateState, form: FormData): Promise<CreateState> {
  const user = await requireUser();
  if (form.get('authority') !== 'yes') return { error: 'Please confirm you’re authorised to manage this business.' };
  if (!(await rateLimit(`create-biz:${user.id}`, 5, 86400))) return { error: 'You’ve created several listings today. Contact us if you manage many businesses.' };
  const res = parseBusinessForm(form);
  if (!res.ok) return { error: Object.values(res.errors)[0] };
  const d = res.data;
  if (form.get('confirm_new') !== 'yes') {
    const dupes = await similarBusinesses(d.name, d.county_id);
    if (dupes.length) return { duplicates: dupes.map((x) => ({ slug: x.slug, name: x.name, locality: x.locality_name })), error: 'This may already be listed.' };
  }
  let id: string;
  try {
    id = await sql.begin(async (tx) => {
      const slug = await uniqueSlug(slugify(d.name));
      const [b] = await tx<{ id: string }[]>`
        insert into businesses (slug, name, category_id, county_id, locality_id, address_line1, address_line2, eircode, show_address, phone,
          public_email, website, website_domain, description, cro_number, socials, status, source, created_by)
        values (${slug}, ${d.name}, ${d.category_id}, ${d.county_id}, ${d.locality_id}, ${d.address_line1}, ${d.address_line2}, ${d.eircode},
          ${d.show_address}, ${d.phone}, ${d.public_email}, ${d.website}, ${d.website_domain}, ${d.description}, ${d.cro_number},
          ${tx.json(d.socials)}, 'pending', 'owner', ${user.id}) returning id`;
      await tx`insert into business_members (business_id, user_id, role, status) values (${b.id}, ${user.id}, 'owner', 'pending')`;
      await tx`insert into audit_events (actor_user_id, action, entity_type, entity_id) values (${user.id}, 'business.created', 'business', ${b.id})`;
      return b.id;
    });
  } catch (e) {
    if ((e as { code?: string }).code === '23505') return { error: 'A business with this name already exists in that area. Search for it above and claim it instead.' };
    throw e;
  }
  redirect(`/dashboard/b/${id}/verify`);
}
