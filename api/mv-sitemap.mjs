// GET /sitemap.xml — static pages plus one URL per country that has at least one real contributor.
// (Empty country pages stay out of the index: they would be thin content.)
import { rpc, SITE, escapeHtml } from './_mv.mjs';

const STATIC = ['/', '/countries', '/join', '/about', '/faq', '/contact', '/privacy', '/terms', '/cookies'];

export function build(slugs = []) {
  const url = (loc) => `  <url><loc>${escapeHtml(SITE + loc)}</loc></url>`;
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [...STATIC.map(url), ...slugs.filter((s) => /^[a-z0-9-]{2,60}$/.test(s)).map((s) => url('/countries/' + s))].join('\n') + '\n</urlset>\n';
}

export default async function handler(req, res, deps = {}) {
  let slugs = [];
  try { slugs = await rpc('mv_sitemap', {}, deps.fetch || fetch); } catch { /* the static part is still useful */ }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
  res.end(build(slugs));
}
