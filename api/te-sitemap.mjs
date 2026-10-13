// GET /sitemap.xml on trillioneuro.com — static pages plus approved entries,
// countries with entries and published journal posts. Unapproved entries are excluded.
import { rpc, SITE } from './_te/lib.mjs';

const STATIC = ['/', '/record', '/countries', '/journal', '/challenge', '/join', '/about', '/faq', '/contact', '/privacy', '/terms', '/refunds', '/cookies', '/report'];

export function build(data) {
  const x = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const url = (loc, lastmod) => `  <url><loc>${x(SITE + loc)}</loc>${lastmod ? `<lastmod>${x(String(lastmod).slice(0, 10))}</lastmod>` : ''}</url>`;
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [...STATIC.map((p) => url(p)),
      ...(data?.entries || []).map((e) => url(`/record/${e.n}`, e.at)),
      ...(data?.countries || []).map((c) => url(`/countries/${c}`)),
      ...(data?.journal || []).map((j) => url(`/journal/${j.slug}`, j.at))].join('\n') + '\n</urlset>\n';
}

export default async function handler(req, res) {
  let data = null;
  try { data = await rpc('te_sitemap', {}); } catch { /* static part still useful */ }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
  res.end(build(data));
}
