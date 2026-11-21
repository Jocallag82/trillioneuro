/* Builds the Trillion Euro HTML pages from site-src/pages/*.html into the repo root.
   Run: node site-src/build.mjs   (outputs are committed; Vercel serves them as static files — there is no build step on deploy.)

   Each page file starts with a meta line:
   <!--meta {"out":"faq.html","path":"/faq","title":"…","description":"…","nav":"faq","noindex":false,"scripts":["home"],"jsonld":{…}} -->

   Internationalisation: LOCALES lists the languages the site is built for. Today it is ['en']. The shell (nav, footer,
   head, hreflang) already reads its strings from site-src/i18n/<locale>.json and emits <html lang>, hreflang alternates
   and locale-prefixed canonicals when a second locale is added. Page bodies are English until their copy is moved
   into the i18n files; the browser-side strings use MV.t() and window.MV_STR (see assets/mv/mv.js). */
import { readFileSync, writeFileSync, readdirSync, existsSync } from 'node:fs';

const SITE = 'https://www.trillioneuro.com';
const LOCALES = ['en'];
const root = new URL('../', import.meta.url);
const pagesDir = new URL('./pages/', import.meta.url);
const ASSET_V = '20261121';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const i18n = Object.fromEntries(LOCALES.map((l) => [l, JSON.parse(readFileSync(new URL(`./i18n/${l}.json`, import.meta.url), 'utf8'))]));
const T = (l, k) => i18n[l][k] ?? i18n.en[k] ?? k;

const MARK = `<svg class="brand-mark" viewBox="0 0 32 32" aria-hidden="true"><defs><linearGradient id="bm" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f3d894"/><stop offset="1" stop-color="#6cc3ff"/></linearGradient></defs><circle cx="16" cy="16" r="13.5" fill="none" stroke="url(#bm)" stroke-width="1.6"/><ellipse cx="16" cy="16" rx="6" ry="13.5" fill="none" stroke="url(#bm)" stroke-width="1.1" opacity=".7"/><path d="M3 16h26M5.5 9.500h21M5.500 22.500h21" stroke="url(#bm)" stroke-width="1" opacity=".55"/><circle cx="22.500" cy="10.500" r="2.200" fill="#f3d894"/></svg>`;

function header(l, active) {
  const nav = [['mission', '/#mission', 'nav.mission'], ['countries', '/countries', 'nav.countries'], ['priorities', '/#priorities', 'nav.priorities'], ['roadmap', '/#roadmap', 'nav.roadmap'], ['faq', '/faq', 'nav.faq']];
  return `<a class="skip" href="#main">${T(l, 'skip')}</a>
<header class="site-head">
  <div class="wrap">
    <a class="brand" href="/" aria-label="Trillion Euro — home">${MARK}<span class="brand-name">Trillion<b>€</b>uro</span></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">${T(l, 'nav.menu')}</button>
    <nav class="nav" id="site-nav" aria-label="Main">
      ${nav.map(([k, h, key]) => `<a href="${h}"${k === active ? ' aria-current="page"' : ''}>${T(l, key)}</a>`).join('\n      ')}
      <a class="btn btn-gold btn-sm" href="/join" data-auth-cta>${T(l, 'nav.join')}</a>
    </nav>
  </div>
</header>`;
}

const footer = (l) => `<footer class="site-foot">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <a class="brand" href="/">${MARK}<span class="brand-name">Trillion<b>€</b>uro</span></a>
        <p style="margin-top:16px;max-width:42ch">${T(l, 'foot.tag')}</p>
      </div>
      <div><h4>${T(l, 'foot.movement')}</h4><ul>
        <li><a href="/#mission">${T(l, 'nav.mission')}</a></li><li><a href="/countries">${T(l, 'nav.countries')}</a></li>
        <li><a href="/#priorities">${T(l, 'nav.priorities')}</a></li><li><a href="/#roadmap">${T(l, 'nav.roadmap')}</a></li><li><a href="/join">${T(l, 'nav.join')}</a></li></ul></div>
      <div><h4>${T(l, 'foot.about')}</h4><ul>
        <li><a href="/about">${T(l, 'foot.honesty')}</a></li><li><a href="/faq">${T(l, 'nav.faq')}</a></li><li><a href="/contact">${T(l, 'foot.contact')}</a></li><li><a href="/dashboard">${T(l, 'foot.dash')}</a></li></ul></div>
      <div><h4>${T(l, 'foot.legal')}</h4><ul>
        <li><a href="/terms">${T(l, 'foot.terms')}</a></li><li><a href="/privacy">${T(l, 'foot.privacy')}</a></li><li><a href="/cookies">${T(l, 'foot.cookies')}</a></li></ul></div>
    </div>
    <p class="foot-legal">${T(l, 'foot.legal.text')}</p>
  </div>
</footer>`;

function page(meta, body, l) {
  const prefix = l === 'en' ? '' : `/${l}`;
  const url = SITE + prefix + meta.path;
  const title = meta.title.includes('Trillion Euro') ? meta.title : `${meta.title} — Trillion Euro`;
  const scripts = ['mv', ...(meta.scripts || [])].map((s) => `<script defer src="/assets/mv/${s}.js?v=${ASSET_V}"></script>`).join('\n');
  const alt = LOCALES.length > 1 && !meta.noindex
    ? LOCALES.map((x) => `<link rel="alternate" hreflang="${x}" href="${SITE}${x === 'en' ? '' : '/' + x}${meta.path}">`).join('\n') + `\n<link rel="alternate" hreflang="x-default" href="${SITE}${meta.path}">\n` : '';
  const og = `${SITE}${meta.ogImage || '/assets/mv/og.png'}`;
  return `<!doctype html>
<html lang="${l}" class="no-js">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(meta.description)}">
${meta.noindex ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="${url}">`}
${alt}<meta name="theme-color" content="#02040b">
<meta property="og:site_name" content="Trillion Euro">
<meta property="og:type" content="${meta.ogType || 'website'}">
<meta property="og:locale" content="${l === 'en' ? 'en_IE' : l}">
<meta property="og:title" content="${esc(meta.ogTitle || title)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${og}">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="Trillion Euro — One trillion. One world. A better future.">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(meta.ogTitle || title)}">
<meta name="twitter:description" content="${esc(meta.description)}">
<meta name="twitter:image" content="${og}">
<link rel="icon" href="/assets/mv/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/mv/apple-touch-icon.png">
<link rel="preload" href="/assets/mv/fonts/fraunces-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/mv/fonts/inter-tight-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/mv/mv.css?v=${ASSET_V}">
<script>document.documentElement.className='js'</script>
${meta.jsonld ? `<script type="application/ld+json">${JSON.stringify(meta.jsonld)}</script>` : ''}
<script defer src="/_vercel/insights/script.js"></script>
<script defer src="/_vercel/speed-insights/script.js"></script>
</head>
<body data-page="${meta.nav || ''}">
${header(l, meta.nav)}
<main id="main">
<noscript><div class="noscript-note">${T(l, 'noscript')}</div></noscript>
${body.trim()}
</main>
${footer(l)}
${scripts}
</body>
</html>
`;
}

const built = [];
for (const f of readdirSync(pagesDir).filter((f) => f.endsWith('.html')).sort()) {
  const src = readFileSync(new URL(f, pagesDir), 'utf8');
  const m = src.match(/^<!--meta (\{.*?\}) -->\n/s);
  if (!m) throw new Error(`${f}: missing meta line`);
  const meta = JSON.parse(m[1]);
  for (const l of LOCALES) {
    const out = l === 'en' ? meta.out : `${l}/${meta.out}`;
    writeFileSync(new URL(out, root), page(meta, src.slice(m[0].length), l));
  }
  built.push(meta);
}
writeFileSync(new URL('./pages.json', import.meta.url), JSON.stringify(built.map(({ out, path, noindex }) => ({ out, path, noindex: !!noindex })), null, 1));
console.log(`built ${built.length} pages × ${LOCALES.length} locale(s)`);
