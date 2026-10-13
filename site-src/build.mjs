/* Builds the TrillionEuro HTML pages from site-src/pages/*.html into the repo root.
   Run: node site-src/build.mjs   (outputs are committed; Vercel serves them as static files —
   there is still no build step on deploy.)

   Each page file starts with a meta line:
   <!--meta {"out":"faq.html","path":"/faq","title":"…","description":"…","nav":"faq","noindex":false,"scripts":["home"]} -->
*/
import { readFileSync, writeFileSync, readdirSync } from 'node:fs';

const SITE = 'https://www.trillioneuro.com';
const root = new URL('../', import.meta.url);
const pagesDir = new URL('./pages/', import.meta.url);
const ASSET_V = '20261014';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const NAV = [
  ['record', '/record', 'The Record'],
  ['countries', '/countries', 'Countries'],
  ['journal', '/journal', 'Journal'],
  ['challenge', '/challenge', 'The Challenge'],
  ['faq', '/faq', 'FAQ'],
];

function header(active) {
  return `<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <div class="wrap">
    <a class="brand" href="/" aria-label="TrillionEuro.com — home"><span class="brand-mark">Trillion<b>€</b>uro</span><span class="brand-sub">Beat Elon</span></a>
    <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="site-nav">Menu</button>
    <nav class="nav" id="site-nav" aria-label="Main">
      ${NAV.map(([k, h, l]) => `<a href="${h}"${k === active ? ' aria-current="page"' : ''}>${l}</a>`).join('\n      ')}
      <a class="btn btn-gold btn-sm" href="/join">Join the Record</a>
    </nav>
  </div>
</header>`;
}

const footer = `<footer class="site-foot">
  <div class="wrap">
    <div class="foot-grid">
      <div>
        <a class="brand" href="/"><span class="brand-mark">Trillion<b>€</b>uro</span></a>
        <p style="margin-top:14px;max-width:38ch">One founder’s public attempt to build a €1 trillion personal fortune — and the permanent record of the people who joined the story.</p>
      </div>
      <div><h4>Explore</h4><ul>
        <li><a href="/record">The Founders’ Record</a></li><li><a href="/countries">Countries</a></li>
        <li><a href="/journal">Journal</a></li><li><a href="/challenge">The Challenge</a></li><li><a href="/join">Join</a></li></ul></div>
      <div><h4>About</h4><ul>
        <li><a href="/about">About &amp; disclosure</a></li><li><a href="/faq">FAQ</a></li>
        <li><a href="/contact">Contact</a></li><li><a href="/report">Report content</a></li><li><a href="/manage">Manage your entry</a></li></ul></div>
      <div><h4>Legal</h4><ul>
        <li><a href="/terms">Terms</a></li><li><a href="/privacy">Privacy</a></li>
        <li><a href="/refunds">Refunds</a></li><li><a href="/cookies">Cookies</a></li></ul></div>
    </div>
    <p class="foot-legal">An entry in the Founders’ Record is a digital product: a numbered public entry and certificate. It is not an investment, a share, a loan, a donation or a charitable gift, and it carries no right to any part of the founder’s wealth or any financial return. The challenge may not succeed. “Beat Elon” names the founder’s own ambition; TrillionEuro.com has no affiliation with, and no endorsement from, Elon Musk or any of his companies.</p>
  </div>
</footer>`;

function page(meta, body) {
  const url = SITE + meta.path;
  const title = meta.title.includes('TrillionEuro') ? meta.title : `${meta.title} — TrillionEuro.com`;
  const scripts = (meta.scripts || []).map((s) => s.startsWith('http')
    ? `<script src="${s}" crossorigin="anonymous"${s.includes('supabase-js') ? ' integrity="' + meta.sri + '"' : ''}></script>`
    : `<script defer src="/assets/te/${s}.js?v=${ASSET_V}"></script>`).join('\n');
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(meta.description)}">
${meta.noindex ? '<meta name="robots" content="noindex, nofollow">' : `<link rel="canonical" href="${url}">`}
<meta name="theme-color" content="#0a0a0c">
<meta property="og:site_name" content="TrillionEuro.com">
<meta property="og:type" content="${meta.ogType || 'website'}">
<meta property="og:title" content="${esc(meta.ogTitle || title)}">
<meta property="og:description" content="${esc(meta.description)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${SITE}/assets/te/og-beat-elon.png">
<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">
<meta property="og:image:alt" content="BEAT ELON. One impossible ambition. A place in the story. — TrillionEuro.com">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" href="/assets/te/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/assets/te/apple-touch-icon.png">
<link rel="preload" href="/assets/te/fonts/fraunces-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/te/fonts/inter-tight-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/te/te.css?v=${ASSET_V}">
${meta.jsonld ? `<script type="application/ld+json">${JSON.stringify(meta.jsonld)}</script>` : ''}
<script defer src="/_vercel/insights/script.js"></script>
<script defer src="/_vercel/speed-insights/script.js"></script>
</head>
<body data-page="${meta.nav || ''}">
${header(meta.nav)}
<main id="main">
${body.trim()}
</main>
${footer}
<script defer src="/assets/te/core.js?v=${ASSET_V}"></script>
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
  writeFileSync(new URL(meta.out, root), page(meta, src.slice(m[0].length)));
  built.push(meta);
}
writeFileSync(new URL('./pages.json', import.meta.url), JSON.stringify(built.map(({ out, path, noindex }) => ({ out, path, noindex: !!noindex })), null, 1));
console.log(`built ${built.length} pages`);
