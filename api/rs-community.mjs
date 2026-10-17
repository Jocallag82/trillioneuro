// Public RipeStream community pages: GET /communities and /c/<slug> on
// ripestream.com. Server-rendered so search engines and link previews see
// them. They show community metadata and aggregate counts only — never posts,
// replies or member identities, which stay inside the members-only app.
// A community is indexable once it has INDEX_MIN members; until then the page
// is noindex so empty communities don't become thin search results.
import { rpc } from './_te/lib.mjs';

export const SITE = 'https://www.ripestream.com';
export const INDEX_MIN = 3;
const x = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const n = (v) => Number(v || 0).toLocaleString('en-GB');
export const indexable = (c) => c.members >= INDEX_MIN && !!c.description;

function page({ title, desc, path, robots, body, ld }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${x(title)}</title>
<meta name="description" content="${x(desc)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:type" content="website"><meta property="og:site_name" content="RipeStream">
<meta property="og:url" content="${SITE}${path}"><meta property="og:title" content="${x(title)}">
<meta property="og:description" content="${x(desc)}"><meta property="og:image" content="${SITE}/og-image.png">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0c0a09">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<script defer src="/_vercel/insights/script.js"></script>
<link rel="preload" href="/fonts/bricolage-grotesque.woff2" as="font" type="font/woff2" crossorigin>
${ld ? `<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>` : ''}
<style>
@font-face{font-family:'Bricolage Grotesque';font-weight:200 800;font-display:swap;src:url(/fonts/bricolage-grotesque.woff2) format('woff2')}
@font-face{font-family:Inter;font-weight:100 900;font-display:swap;src:url(/fonts/inter.woff2) format('woff2')}
*,*::before,*::after{margin:0;padding:0;box-sizing:border-box}
:root{--ink:#0c0a09;--ink2:#161312;--cream:#f3eee6;--mute:#a8a096;--line:rgba(243,238,230,.1);--ripe:#ff5b1f;--lime:#c8f55a}
body{font-family:Inter,ui-sans-serif,system-ui,sans-serif;background:var(--ink);color:var(--cream);-webkit-font-smoothing:antialiased;line-height:1.6}
a{color:var(--cream)}
:focus-visible{outline:3px solid var(--lime);outline-offset:3px;border-radius:4px}
.bar,main,footer{max-width:880px;margin:0 auto;padding-left:clamp(16px,5vw,32px);padding-right:clamp(16px,5vw,32px)}
.bar{display:flex;justify-content:space-between;align-items:center;padding-top:22px;padding-bottom:22px}
.logo{font-family:'Bricolage Grotesque',sans-serif;font-weight:700;font-size:20px;letter-spacing:-.03em;text-decoration:none;display:inline-flex;gap:10px;align-items:center}
.logo img{width:28px;height:28px}
.btn{display:inline-flex;align-items:center;height:52px;padding:0 24px;border-radius:999px;background:var(--ripe);color:var(--ink);font-weight:600;font-size:15px;letter-spacing:.05em;text-transform:uppercase;text-decoration:none}
.btn.sm{height:40px;padding:0 16px;font-size:13px}
.ghost{color:var(--mute);font-size:14px}
main{padding-top:clamp(24px,5vw,56px);padding-bottom:80px}
.eyebrow{font-size:12px;font-weight:700;letter-spacing:.14em;text-transform:uppercase;color:var(--lime)}
h1{font-family:'Bricolage Grotesque',sans-serif;font-size:clamp(40px,7vw,72px);letter-spacing:-.04em;line-height:1;margin:14px 0 18px}
h2{font-family:'Bricolage Grotesque',sans-serif;font-size:26px;letter-spacing:-.02em;margin:48px 0 12px}
.lede{font-size:clamp(17px,1.8vw,20px);color:#cfc8bd;max-width:640px}
.stats{display:flex;gap:28px;flex-wrap:wrap;margin:26px 0;color:var(--mute);font-size:15px}
.stats b{display:block;font-family:'Bricolage Grotesque',sans-serif;font-size:30px;color:var(--cream)}
.list{list-style:none;display:grid;gap:12px;margin-top:20px}
.card{display:block;background:var(--ink2);border:1px solid var(--line);border-radius:20px;padding:18px 20px;text-decoration:none}
.card:hover{border-color:rgba(255,91,31,.5)}
.card b{font-size:18px}.card p{color:var(--mute);font-size:15px;margin-top:4px}
.points{margin:12px 0 0 20px;display:grid;gap:8px;color:#cfc8bd}
.cta{margin-top:28px;display:flex;gap:16px;align-items:center;flex-wrap:wrap}
footer{border-top:1px solid var(--line);padding-top:28px;padding-bottom:48px;display:flex;justify-content:space-between;gap:16px;flex-wrap:wrap;font-size:14px;color:var(--mute)}
footer nav{display:flex;gap:20px}footer a{color:var(--mute);text-decoration:none}
</style>
</head>
<body>
<header class="bar"><a class="logo" href="/"><img src="/favicon.svg" alt="" width="28" height="28">RipeStream</a><a class="btn sm" href="/?utm_source=community#join">Join</a></header>
<main>
${body}
</main>
<footer><span>© ${new Date().getFullYear()} RipeStream</span><nav aria-label="Footer"><a href="/">Home</a><a href="/communities">Communities</a><a href="/privacy">Privacy</a><a href="/terms">Terms</a></nav></footer>
</body>
</html>`;
}

const WHY = `<h2>How RipeStream works</h2>
<ul class="points">
<li>Your feed is newest first. You choose its sources — people you follow, communities you join, or everyone.</li>
<li>Mute words and people quietly. Every post says why it’s in your feed.</li>
<li>No ads ranking what you see. Membership is free; RipeStream is in early beta and joining is by email or invitation.</li>
</ul>`;

export function renderIndex(cs) {
  const items = cs.map((c) => `<li><a class="card" href="/c/${x(c.slug)}"><b>${x(c.name)}</b><p>${x(c.description || 'A RipeStream community.')} · ${n(c.members)} ${c.members === 1 ? 'member' : 'members'}</p></a></li>`).join('');
  return page({
    title: 'Communities on RipeStream',
    desc: 'Browse RipeStream communities — interest and local groups on a social network where you control your own feed.',
    path: '/communities', robots: 'index,follow',
    body: `<p class="eyebrow">Communities</p><h1>Find your people.</h1>
<p class="lede">Communities on RipeStream are built around interests and places. Join the ones you care about and set your feed to show only them. Posts are visible to members.</p>
<ul class="list">${items || '<li class="card"><p>No communities yet.</p></li>'}</ul>
<div class="cta"><a class="btn" href="/?utm_source=communities#join">Join RipeStream</a><a class="ghost" href="/app#/communities">Already a member? Open the app</a></div>
${WHY}`,
  });
}

export function renderCommunity(c) {
  const title = `${c.name} — a RipeStream community`;
  const desc = (c.description || `${c.name} on RipeStream.`) + ` ${n(c.members)} ${c.members === 1 ? 'member' : 'members'}.`;
  const active = c.active ? new Date(c.active).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  return page({
    title, desc, path: `/c/${c.slug}`, robots: indexable(c) ? 'index,follow' : 'noindex,follow',
    ld: { '@context': 'https://schema.org', '@type': 'WebPage', name: title, description: desc, url: `${SITE}/c/${c.slug}`,
      isPartOf: { '@type': 'WebSite', name: 'RipeStream', url: `${SITE}/` } },
    body: `<p class="eyebrow">Community</p><h1>${x(c.name)}</h1>
<p class="lede">${x(c.description || 'A community on RipeStream.')}</p>
<div class="stats"><span><b>${n(c.members)}</b>${c.members === 1 ? 'member' : 'members'}</span><span><b>${n(c.posts_30d)}</b>posts in the last 30 days</span>${active ? `<span><b>${x(active)}</b>last post</span>` : ''}</div>
<p class="lede">Posts and conversations here are for RipeStream members. Join free, then join ${x(c.name)}.</p>
<div class="cta"><a class="btn" href="/?utm_source=community&amp;utm_content=${encodeURIComponent(c.slug)}#join">Join RipeStream</a><a class="ghost" href="/app#/c/${x(c.slug)}">Already a member? Open ${x(c.name)}</a></div>
${WHY}
<p style="margin-top:40px"><a href="/communities">All communities</a></p>`,
  });
}

export default async function handler(req, res) {
  const url = new URL(req.url, SITE);
  const slug = url.searchParams.get('slug');
  let cs;
  try { cs = await rpc('rsp_public_communities', {}); } catch {
    res.statusCode = 503; res.setHeader('Retry-After', '60'); res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    return res.end('RipeStream is briefly unavailable. Try again in a minute.');
  }
  let html;
  if (slug) {
    const c = cs.find((v) => v.slug === slug.toLowerCase());
    if (!c) {
      res.statusCode = 404;
      html = page({ title: 'Community not found — RipeStream', desc: 'That community does not exist.', path: '/communities', robots: 'noindex',
        body: '<h1>Not found.</h1><p class="lede">That community doesn’t exist. <a href="/communities">Browse communities</a>.</p>' });
    } else { res.statusCode = 200; html = renderCommunity(c); }
  } else { res.statusCode = 200; html = renderIndex(cs); }
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=600, stale-while-revalidate=3600');
  res.end(html);
}
