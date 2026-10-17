import 'server-only';
import { sql } from './db';
import { isProduction } from './env';

export type BusinessCard = {
  id: string; slug: string; name: string; description: string | null; logo_id: string | null;
  category_name: string; category_slug: string; county_name: string; locality_name: string | null;
  rating_count: number; rating_avg: string | null; ownership_verified_at: Date | null; status: string;
};

export type BusinessFull = BusinessCard & {
  category_id: number; parent_category_name: string | null; parent_category_slug: string | null;
  county_id: number; county_slug: string; locality_id: number | null; locality_slug: string | null;
  address_line1: string | null; address_line2: string | null; eircode: string | null; show_address: boolean;
  phone: string | null; public_email: string | null; website: string | null; website_domain: string | null;
  socials: Record<string, string>; cro_number: string | null; rating_dist: number[]; last_review_at: Date | null;
  source: string; created_at: Date; updated_at: Date; is_test_data: boolean;
};

const testFilter = () => (isProduction() ? sql`and b.is_test_data = false` : sql``);

const cardColumns = sql`b.id, b.slug, b.name, b.description, b.logo_id, c.name category_name, c.slug category_slug,
  co.name county_name, l.name locality_name, b.rating_count, b.rating_avg::text, b.ownership_verified_at, b.status`;

export async function getBusinessBySlug(slug: string): Promise<{ business: BusinessFull | null; redirectTo?: string }> {
  const [b] = await sql<BusinessFull[]>`
    select ${cardColumns}, b.category_id, pc.name parent_category_name, pc.slug parent_category_slug,
      b.county_id, co.slug county_slug, b.locality_id, l.slug locality_slug, b.address_line1, b.address_line2, b.eircode,
      b.show_address, b.phone, b.public_email, b.website, b.website_domain, b.socials, b.cro_number, b.rating_dist,
      b.last_review_at, b.source, b.created_at, b.updated_at, b.is_test_data
    from businesses b join categories c on c.id = b.category_id left join categories pc on pc.id = c.parent_id
      join counties co on co.id = b.county_id left join localities l on l.id = b.locality_id
    where b.slug = ${slug} ${testFilter()}`;
  if (b) return { business: b };
  const [h] = await sql<{ slug: string }[]>`select b.slug from business_slug_history h join businesses b on b.id = h.business_id where h.slug = ${slug}`;
  return { business: null, redirectTo: h?.slug };
}

export type SearchParams = { q?: string; category?: string; county?: string; where?: string; page?: number };

export async function searchBusinesses(p: SearchParams): Promise<{ results: BusinessCard[]; total: number; matchedCategory: string | null }> {
  const page = Math.max(1, Math.min(50, p.page ?? 1));
  const perPage = 20;
  const q = (p.q ?? '').trim().slice(0, 80);
  const where = (p.where ?? '').trim().slice(0, 60);
  const eircodeKey = /^[A-Za-z][0-9][0-9Ww]\b/.test(where.replace(/\s/g, '').slice(0, 3)) && where.replace(/\s/g, '').length <= 7
    ? where.replace(/\s/g, '').slice(0, 3).toUpperCase() : null;

  // Text matching: business name (fuzzy, accent-insensitive) OR category name.
  const textCond = q
    ? sql`and (
        rateme.norm(b.name) like '%' || rateme.norm(${q}) || '%'
        or word_similarity(rateme.norm(${q}), rateme.norm(b.name)) >= 0.45
        or b.category_id in (select id from categories where word_similarity(rateme.norm(${q}), rateme.norm(name)) >= 0.5
                              or parent_id in (select id from categories where word_similarity(rateme.norm(${q}), rateme.norm(name)) >= 0.5))
      )`
    : sql``;
  const catCond = p.category
    ? sql`and (c.slug = ${p.category} or c.parent_id = (select id from categories where slug = ${p.category}))`
    : sql``;
  const countyCond = p.county ? sql`and co.slug = ${p.county}` : sql``;
  const whereCond = where
    ? eircodeKey
      ? sql`and left(b.eircode, 3) = ${eircodeKey}`
      : sql`and (rateme.norm(co.name) = rateme.norm(${where.replace(/^(co\.?|county)\s+/i, '')})
                 or word_similarity(rateme.norm(${where}), rateme.norm(coalesce(l.name, ''))) >= 0.6
                 or rateme.norm(coalesce(l.name, '')) like rateme.norm(${where}) || '%')`
    : sql``;
  const order = q
    ? sql`order by greatest(similarity(rateme.norm(b.name), rateme.norm(${q})), word_similarity(rateme.norm(${q}), rateme.norm(b.name))) desc, b.rating_count desc, b.name`
    : sql`order by b.rating_count desc, b.name`;

  const rows = await sql<(BusinessCard & { total: number })[]>`
    select ${cardColumns}, count(*) over ()::int total
    from businesses b join categories c on c.id = b.category_id join counties co on co.id = b.county_id
      left join localities l on l.id = b.locality_id
    where b.status = 'published' ${testFilter()} ${textCond} ${catCond} ${countyCond} ${whereCond}
    ${order} limit ${perPage} offset ${(page - 1) * perPage}`;

  let matchedCategory: string | null = null;
  if (q) {
    const [mc] = await sql<{ name: string }[]>`select name from categories where active and word_similarity(rateme.norm(${q}), rateme.norm(name)) >= 0.5
                                                order by word_similarity(rateme.norm(${q}), rateme.norm(name)) desc limit 1`;
    matchedCategory = mc?.name ?? null;
  }
  return { results: rows, total: rows[0]?.total ?? 0, matchedCategory };
}

export async function listBusinesses(filter: { categorySlug?: string; countySlug?: string; limit?: number }) {
  return sql<BusinessCard[]>`
    select ${cardColumns}
    from businesses b join categories c on c.id = b.category_id join counties co on co.id = b.county_id
      left join localities l on l.id = b.locality_id
    where b.status = 'published' ${testFilter()}
      ${filter.categorySlug ? sql`and (c.slug = ${filter.categorySlug} or c.parent_id = (select id from categories where slug = ${filter.categorySlug}))` : sql``}
      ${filter.countySlug ? sql`and co.slug = ${filter.countySlug}` : sql``}
    order by b.rating_count desc, b.last_review_at desc nulls last, b.name
    limit ${filter.limit ?? 60}`;
}

export async function recentlyReviewed(limit = 6) {
  return sql<BusinessCard[]>`
    select ${cardColumns}
    from businesses b join categories c on c.id = b.category_id join counties co on co.id = b.county_id
      left join localities l on l.id = b.locality_id
    where b.status = 'published' and b.rating_count > 0 ${testFilter()}
    order by b.last_review_at desc nulls last limit ${limit}`;
}

export async function platformCounts() {
  const [r] = await sql<{ businesses: number; reviews: number }[]>`
    select (select count(*)::int from businesses b where status = 'published' ${testFilter()}) businesses,
           (select count(*)::int from reviews r join businesses b on b.id = r.business_id where r.status = 'published' ${testFilter()}) reviews`;
  return r;
}

export type PublicReview = {
  id: string; rating: number; title: string | null; body: string | null; experience_type: string | null;
  experience_month: Date; reviewer_name: string; published_at: Date; source: string;
  response_body: string | null; response_at: Date | null;
};

export async function publishedReviews(businessId: string, opts: { limit?: number; offset?: number; rating?: number } = {}) {
  return sql<PublicReview[]>`
    select r.id, r.rating, r.title, r.body, r.experience_type, r.experience_month, r.reviewer_name, r.published_at, r.source,
           rr.body response_body, rr.updated_at response_at
    from reviews r left join review_responses rr on rr.review_id = r.id and rr.status = 'published'
    where r.business_id = ${businessId} and r.status = 'published'
      ${opts.rating ? sql`and r.rating = ${opts.rating}` : sql``}
    order by r.published_at desc limit ${opts.limit ?? 20} offset ${opts.offset ?? 0}`;
}

/** Duplicate detection before creating a listing: similar names in the same county. */
export async function similarBusinesses(name: string, countyId: number) {
  return sql<{ id: string; slug: string; name: string; locality_name: string | null; status: string }[]>`
    select b.id, b.slug, b.name, l.name locality_name, b.status
    from businesses b left join localities l on l.id = b.locality_id
    where b.county_id = ${countyId} and b.status in ('published','pending')
      and (similarity(rateme.norm(b.name), rateme.norm(${name})) >= 0.5 or rateme.norm(b.name) = rateme.norm(${name}))
    order by similarity(rateme.norm(b.name), rateme.norm(${name})) desc limit 5`;
}

export async function uniqueSlug(base: string): Promise<string> {
  const root = base || 'business';
  for (let i = 0; i < 50; i++) {
    const candidate = i === 0 ? root : `${root}-${i + 1}`;
    const [taken] = await sql`select 1 from businesses where slug = ${candidate} union select 1 from business_slug_history where slug = ${candidate}`;
    if (!taken) return candidate;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function bumpStat(businessId: string, field: 'profile_views' | 'qr_scans' | 'review_starts') {
  const col = sql(field);
  await sql`insert into business_daily_stats (business_id, day, ${col}) values (${businessId}, (now() at time zone 'Europe/Dublin')::date, 1)
            on conflict (business_id, day) do update set ${col} = business_daily_stats.${col} + 1`;
}
