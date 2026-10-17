import type { MetadataRoute } from 'next';
import { sql } from '@/lib/db';
import { siteUrl } from '@/lib/site';
import { MIN_LISTING_FOR_INDEX } from '@/lib/seo';

export const dynamic = 'force-dynamic';

// Only pages with genuine value: static content, published real businesses, and
// category/county pages that already list enough real businesses.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const staticPages = ['', '/search', '/categories', '/counties', '/for-business', '/how-it-works', '/review-policy', '/add-business', '/privacy', '/terms', '/cookies', '/membership-terms', '/contact']
    .map((p) => ({ url: `${base}${p}`, changeFrequency: 'weekly' as const }));
  const [biz, cats, counties] = await Promise.all([
    sql<{ slug: string; updated_at: Date }[]>`select slug, greatest(updated_at, coalesce(last_review_at, updated_at)) updated_at from businesses where status = 'published' and not is_test_data limit 45000`,
    sql<{ slug: string }[]>`select c.slug from categories c join businesses b on (b.category_id = c.id or b.category_id in (select id from categories s where s.parent_id = c.id))
                            where c.active and b.status = 'published' and not b.is_test_data group by c.slug having count(distinct b.id) >= ${MIN_LISTING_FOR_INDEX}`,
    sql<{ slug: string }[]>`select co.slug from counties co join businesses b on b.county_id = co.id where b.status = 'published' and not b.is_test_data group by co.slug having count(*) >= ${MIN_LISTING_FOR_INDEX}`,
  ]);
  return [
    ...staticPages,
    ...biz.map((b) => ({ url: `${base}/business/${b.slug}`, lastModified: b.updated_at })),
    ...cats.map((c) => ({ url: `${base}/categories/${c.slug}` })),
    ...counties.map((c) => ({ url: `${base}/county/${c.slug}` })),
  ];
}
