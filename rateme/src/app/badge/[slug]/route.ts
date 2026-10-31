import { sql } from '@/lib/db';
import { isProduction } from '@/lib/env';
import { renderBadge, BADGE_STYLES, type BadgeStyle } from '@/lib/badge';

// Public, cacheable badge image. Figures come straight from the trigger-maintained aggregates.
export async function GET(req: Request, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const styleParam = new URL(req.url).searchParams.get('style') ?? 'light';
  const style: BadgeStyle = styleParam in BADGE_STYLES ? (styleParam as BadgeStyle) : 'light';
  if (!/^[a-z0-9-]{1,120}$/.test(slug)) return new Response('Not found', { status: 404 });
  const [b] = await sql<{ rating_count: number; rating_avg: string | null; is_test_data: boolean }[]>`
    select rating_count, rating_avg::text, is_test_data from businesses where slug = ${slug} and status = 'published'`;
  if (!b || (isProduction() && b.is_test_data)) return new Response('Not found', { status: 404 });
  const svg = renderBadge(style, b.rating_count, b.rating_avg == null ? null : Number(b.rating_avg));
  return new Response(svg, { headers: {
    'Content-Type': 'image/svg+xml; charset=utf-8', 'Cache-Control': 'public, max-age=900, s-maxage=3600, stale-while-revalidate=86400',
    'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "default-src 'none'; style-src 'unsafe-inline'", 'Access-Control-Allow-Origin': '*',
  } });
}
