// GET /record/:n, /countries/:cc, /journal/:slug (rewritten here by vercel.json).
// Serves the static page template with per-page <title>, description, canonical,
// Open Graph tags and robots directives set on the server, so link previews and
// crawlers see accurate, consented, public-only data. Private fields never reach
// this function: it reads through the same public RPCs as the browser.
import { readFile } from 'node:fs/promises';
import { rpc, escapeHtml as esc, SITE, log } from './_te/lib.mjs';

const TEMPLATES = { entry: '/entry.html', country: '/country.html', journal: '/journal-entry.html' };
// Static `new URL(…, import.meta.url)` references let Vercel's file tracer bundle the templates.
const FILES = {
  entry: new URL('../entry.html', import.meta.url),
  country: new URL('../country.html', import.meta.url),
  journal: new URL('../journal-entry.html', import.meta.url),
};
const tplCache = new Map();

async function template(kind, origin, fetchImpl) {
  if (tplCache.has(kind)) return tplCache.get(kind);
  let html;
  try { html = await readFile(FILES[kind], 'utf8'); }
  catch {
    const r = await fetchImpl(origin + TEMPLATES[kind], { signal: AbortSignal.timeout(5000) });
    if (!r.ok) throw new Error('template ' + r.status);
    html = await r.text();
  }
  tplCache.set(kind, html);
  return html;
}

export function inject(html, m) {
  const robots = m.index ? `<link rel="canonical" href="${esc(m.url)}">` : '<meta name="robots" content="noindex, nofollow">';
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${esc(m.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*">/, `<meta name="description" content="${esc(m.description)}">`)
    .replace(/<meta name="robots" content="[^"]*">/, robots)
    .replace(/<meta property="og:title" content="[^"]*">/, `<meta property="og:title" content="${esc(m.title)}">`)
    .replace(/<meta property="og:description" content="[^"]*">/, `<meta property="og:description" content="${esc(m.description)}">`)
    .replace(/<meta property="og:url" content="[^"]*">/, `<meta property="og:url" content="${esc(m.url)}">`);
}

const clip = (s, n) => { const a = Array.from(String(s || '')); return a.length > n ? a.slice(0, n - 1).join('') + '…' : a.join(''); };
const pad = (n) => String(n).padStart(6, '0');

export async function describe(kind, id, call = rpc) {
  if (kind === 'entry') {
    if (!/^\d{1,12}$/.test(id)) return null;
    const e = await call('te_entry', { p_number: Number(id) });
    if (!e) return null;
    return {
      title: `Nº ${pad(e.entry_number)} · ${clip(e.nickname, 40)} — The Founders’ Record`,
      description: `${clip(e.nickname, 40)} (${e.country_name}) joined the Beat Elon challenge as entry Nº ${pad(e.entry_number)}.` + (e.message ? ` “${clip(e.message, 120)}”` : ''),
      url: `${SITE}/record/${e.entry_number}`, index: !!e.indexable,
    };
  }
  if (kind === 'country') {
    if (!/^[A-Za-z]{2}$/.test(id)) return null;
    const rows = await call('te_country_stats', {});
    const c = rows.find((r) => r.code === id.toUpperCase());
    if (!c) return null;
    return {
      title: `${c.name} in the Founders’ Record — Beat Elon`,
      description: `${c.entries} verified ${c.entries === 1 ? 'entry' : 'entries'} from ${c.name}` + (c.rank ? `, ranked #${c.rank} by country.` : '. No entries yet — the first one puts it on the board.'),
      url: `${SITE}/countries/${c.code}`, index: c.entries > 0, // thin empty country pages stay out of search
    };
  }
  if (kind === 'journal') {
    if (!/^[a-z0-9-]{1,80}$/.test(id)) return null;
    const p = await call('te_journal_get', { p_slug: id });
    if (!p) return null;
    return { title: `${clip(p.title, 90)} — Beat Elon journal`, description: clip(p.excerpt || p.body, 180), url: `${SITE}/journal/${p.slug}`, index: true };
  }
  return null;
}

export default async function handler(req, res, deps = {}) {
  const fetchImpl = deps.fetch || fetch;
  const u = new URL(req.url, 'https://x');
  const kind = u.searchParams.get('kind'), id = u.searchParams.get('id') || '';
  if (!TEMPLATES[kind]) { res.statusCode = 404; return res.end('Not found'); }
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').replace(/[^a-z0-9.:-]/gi, '');
  const proto = req.headers['x-forwarded-proto'] === 'http' && /^localhost(:\d+)?$/.test(host) ? 'http' : 'https';
  const origin = `${proto}://${host || 'www.trillioneuro.com'}`;
  let meta = null, html;
  try {
    html = await template(kind, origin, fetchImpl);
    meta = await describe(kind, id, deps.rpc || rpc);
  } catch (e) {
    log('te_render_error', { kind, error: e.message });
    if (!html) { res.statusCode = 503; res.setHeader('Retry-After', '30'); return res.end('Temporarily unavailable'); }
  }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=300');
  if (!meta) {
    res.statusCode = 404;
    return res.end(inject(html, { title: 'Not found — TrillionEuro.com', description: 'This page is not on the record.', url: SITE, index: false }));
  }
  res.statusCode = 200;
  return res.end(inject(html, meta));
}
