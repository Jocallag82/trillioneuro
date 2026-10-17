import type { MetadataRoute } from 'next';
import { siteUrl, PUBLIC_INDEXING } from '@/lib/site';

export const dynamic = 'force-dynamic';

export default function robots(): MetadataRoute.Robots {
  // Preview/staging deployments must never be indexed.
  if (!PUBLIC_INDEXING()) return { rules: [{ userAgent: '*', disallow: '/' }] };
  return {
    rules: [{ userAgent: '*', allow: '/', disallow: ['/dashboard', '/admin', '/api/', '/review/', '/r/', '/login', '/register', '/verify-email', '/forgot-password', '/reset-password', '/search?', '/*/report', '/*/correction'] }],
    sitemap: `${siteUrl()}/sitemap.xml`,
    host: siteUrl(),
  };
}
