// GET /countries/:slug (rewritten here by vercel.json).
// Serves the static country template with per-country <title>, description, canonical, Open Graph / Twitter tags,
// JSON-LD and a server-rendered summary of the real numbers — so crawlers and link previews see accurate content
// without running JavaScript. Public aggregates only: the same data the browser reads.
import { readFile } from 'node:fs/promises';
import { rpc, escapeHtml as esc, SITE } from './_mv.mjs';

// Static `new URL(…, import.meta.url)` lets Vercel's file tracer bundle the template.
const TEMPLATE = new URL('../country.html', import.meta.url);
let tpl = null;
async function template(origin, fetchImpl) {
  if (tpl) return tpl;
  try { tpl = await readFile(TEMPLATE, 'utf8'); }
  catch {
    const r = await fetchImpl(origin + '/country.html', { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error('template ' + r.status);
    tpl = await r.text();
  }
  return tpl;
}

const plural = (n, a, b) => (n === 1 ? a : b);

export function describe(c) {
  const n = c.contributors, url = `${SITE}/countries/${c.slug}`;
  const title = n > 0
    ? `${c.name} — ${n.toLocaleString('en-IE')} ${plural(n, 'contributor', 'contributors')} on Trillion Euro`
    : `${c.name} on Trillion Euro — be the first to join`;
  const description = n > 0
    ? `${n.toLocaleString('en-IE')} ${plural(n, 'person', 'people')} from ${c.name} ${plural(n, 'has', 'have')} joined the free Trillion Euro movement` + (c.rank ? `, ranked #${c.rank} of ${c.countries_with_contributors} countries.` : '.') + ' Join your country’s community and vote on what we tackle first.'
    : `No one has joined Trillion Euro from ${c.name} yet. Be the first — it’s free — and help choose what the movement tackles first.`;
  return { title, description, url, index: n > 0 };
}

export function inject(html, c, m) {
  const ssr = `<section class="page-hero"><div class="wrap"><span class="kicker">Country community${c.region ? ' · ' + esc(c.region) : ''}</span><h1 style="margin-top:22px">${esc(c.name)}</h1>` +
    `<p class="lede">${esc(m.description)}</p><p><a class="btn btn-gold" href="/join?country=${esc(c.code)}#join">Join from ${esc(c.name)}</a></p></div></section>`;
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'WebPage', '@id': m.url, url: m.url, name: m.title, description: m.description, isPartOf: { '@id': SITE + '/#site' }, about: { '@type': 'Country', name: c.name } },
    { '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Trillion Euro', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Countries', item: SITE + '/countries' },
      { '@type': 'ListItem', position: 3, name: c.name, item: m.url }] }] };
  const robots = m.index ? `<link rel="canonical" href="${esc(m.url)}">` : `<link rel="canonical" href="${esc(m.url)}"><meta name="robots" content="noindex, follow">`;
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(m.description)}">`)
    .replace(/<meta name="robots" content="[^"]*">/, robots)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(m.title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(m.description)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${esc(m.url)}">`)
    .replace(/<meta name="twitter:title" content="[^"]*">/, `<meta name="twitter:title" content="${esc(m.title)}">`)
    .replace(/<meta name="twitter:description" content="[^"]*">/, `<meta name="twitter:description" content="${esc(m.description)}">`)
    .replace('</head>', `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>\n</head>`)
    .replace('<!--SSR-->', ssr + `<script type="application/json" id="country-data">${JSON.stringify(c).replace(/</g, '\\u003c')}</script>`);
}

export default async function handler(req, res, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const u = new URL(req.url, 'https://x');
  const raw = (u.searchParams.get('slug') || '').trim();
  if (!/^[A-Za-z0-9-]{2,60}$/.test(raw)) { res.statusCode = 404; return res.end('Not found'); }
  let c = null, failed = false;
  try {
    c = await rpc('mv_country', { p_slug: raw.toLowerCase() }, fetchImpl);
    if (!c && /^[A-Za-z]{2}$/.test(raw)) {                       // legacy /countries/IE links → canonical slug
      const board = await rpc('mv_country_board', {}, fetchImpl);
      const hit = board.find((r) => r.code === raw.toUpperCase());
      if (hit) { res.statusCode = 308; res.setHeader('Location', `/countries/${hit.slug}`); return res.end(); }
    }
  } catch { failed = true; /* serve the generic template: the browser can still load the data itself */ }
  const origin = deps.origin || (req.headers && req.headers.host ? `${req.headers['x-forwarded-proto'] || 'https'}://${req.headers.host}` : SITE);
  let html;
  try { html = await template(origin, fetchImpl); } catch { res.statusCode = 502; return res.end('Temporarily unavailable'); }
  if (!c) {
    res.statusCode = failed ? 200 : 404;            // unknown country → real 404 (template is noindex and says "not found")
    res.setHeader('Cache-Control', failed ? 'no-store' : 'public, max-age=0, s-maxage=60');
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    return res.end(html);
  } else {
    if (raw !== c.slug) { res.statusCode = 308; res.setHeader('Location', `/countries/${c.slug}`); return res.end(); }
    html = inject(html, c, describe(c));
    res.statusCode = 200;
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=300, stale-while-revalidate=600');
  res.end(html);
}
