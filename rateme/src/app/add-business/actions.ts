'use server';
import { sql } from '@/lib/db';
import { parseBusinessForm } from '@/lib/business-form';
import { similarBusinesses, uniqueSlug } from '@/lib/businesses';
import { ipRateLimit, looksAutomated } from '@/lib/security';
import { currentUser } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { slugify } from '@/lib/util';

export type SuggestState = { ok?: boolean; error?: string; duplicates?: { slug: string; name: string; locality: string | null; status: string }[] };

export async function suggestBusiness(_p: SuggestState, form: FormData): Promise<SuggestState> {
  if (looksAutomated(form)) return { error: 'Something went wrong. Please try again.' };
  if (!(await ipRateLimit('suggest', 5, 86400))) return { error: 'You’ve suggested several businesses today. Please try again tomorrow.' };
  const res = parseBusinessForm(form);
  if (!res.ok) return { error: Object.values(res.errors)[0] };
  const d = res.data;
  const dupes = await similarBusinesses(d.name, d.county_id);
  if (dupes.length && form.get('confirm_new') !== 'yes') {
    const exact = dupes.find((x) => x.name.toLowerCase() === d.name.toLowerCase());
    if (exact) return { error: 'That business is already listed or awaiting review.', duplicates: dupes.map((x) => ({ slug: x.slug, name: x.name, locality: x.locality_name, status: x.status })) };
  }
  const user = await currentUser();
  try {
    const slug = await uniqueSlug(slugify(d.name));
    const [b] = await sql<{ id: string }[]>`
      insert into businesses (slug, name, category_id, county_id, locality_id, website, website_domain, status, source, created_by)
      values (${slug}, ${d.name}, ${d.category_id}, ${d.county_id}, ${d.locality_id}, ${d.website}, ${d.website_domain}, 'pending', 'community', ${user?.id ?? null})
      returning id`;
    const email = String(form.get('suggester_email') ?? '').trim().slice(0, 200);
    await audit(user?.id ?? null, 'business.suggested', 'business', b.id, { notify: email.includes('@') ? 'requested' : 'no' });
    if (email.includes('@')) await sql`insert into reports (kind, business_id, reason, details, reporter_email) values ('business_info', ${b.id}, 'suggestion', 'Community suggestion — notify when published', ${email})`;
  } catch (e) {
    if ((e as { code?: string }).code === '23505') return { error: 'That business is already listed or awaiting review.' };
    throw e;
  }
  return { ok: true };
}
