// GET /sitemap.xml on ripestream.com — static pages plus the community
// directory and each community that is indexable (see rs-community.mjs).
import { rpc } from './_te/lib.mjs';
import { SITE, indexable } from './rs-community.mjs';

const STATIC = [['/', null], ['/communities', null], ['/privacy', '2026-10-17'], ['/terms', '2026-10-17']];

export function build(cs) {
  const x = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const url = (loc, lastmod) => `  <url><loc>${x(SITE + loc)}</loc>${lastmod ? `<lastmod>${x(String(lastmod).slice(0, 10))}</lastmod>` : ''}</url>`;
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    [...STATIC.map(([p, d]) => url(p, d)),
      ...(cs || []).filter(indexable).map((c) => url(`/c/${c.slug}`, c.active))].join('\n') + '\n</urlset>\n';
}

export default async function handler(req, res) {
  let cs = null;
  try { cs = await rpc('rsp_public_communities', {}); } catch { /* static part still useful */ }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=3600');
  res.end(build(cs));
}
