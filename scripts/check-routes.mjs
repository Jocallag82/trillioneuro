/* Replays vercel.json's `routes` the way Vercel does — in order, honouring
   `continue`, `has` host conditions and `status` — then asserts what each
   important URL on each host resolves to.
   Run: node scripts/check-routes.mjs */
import { readFileSync, existsSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const root = new URL('../', import.meta.url);

// `has.value` is either a plain string (exact) or a Vercel MatchableValue.
function hostMatches(v, host) {
  if (typeof v === 'string') return v === host;
  if (v.eq !== undefined) return v.eq === host;
  if (v.inc) return v.inc.includes(host);
  throw new Error('check-routes: unsupported host matcher ' + JSON.stringify(v));
}

function resolve(host, path) {
  let current = path;
  for (const r of cfg.routes) {
    if (r.has) {
      const hostRule = r.has.find(h => h.type === 'host');
      if (hostRule && !hostMatches(hostRule.value, host)) continue;
    }
    const re = new RegExp('^' + r.src + '$');
    const m = current.match(re);
    if (!m) continue;

    if (r.status >= 300 && r.status < 400) {
      let loc = r.headers.Location;
      m.slice(1).forEach((g, i) => { loc = loc.split('$' + (i + 1)).join(g ?? ''); });
      return { kind: 'redirect', status: r.status, to: loc };
    }
    if (r.dest) {
      let dest = r.dest;
      m.slice(1).forEach((g, i) => { dest = dest.split('$' + (i + 1)).join(g ?? ''); });
      current = dest;
      if (!r.continue) return { kind: 'serve', file: current };
    }
    // headers-only rule with continue:true — keep going
  }
  return { kind: 'serve', file: current };
}

const T = 'trillioneuro.com', Q = 'quadrillioneuro.com', R = 'ripestream.com', RW = 'www.ripestream.com';
const cases = [
  // [host, path, expected kind, expected target]
  [T, '/',              'serve',    '/'],
  [T, '/record',        'serve',    '/record.html'],
  [T, '/privacy',       'serve',    '/privacy.html'],
  [T, '/terms',         'serve',    '/terms.html'],
  [T, '/record.html',   'redirect', '/record'],
  [T, '/claim',         'redirect', '/join'],
  [T, '/claim.html',    'redirect', '/join'],
  [T, '/join',          'serve',    '/join.html'],
  [T, '/join/success',  'serve',    '/join-success.html'],
  [T, '/join/cancelled','serve',    '/join-cancelled.html'],
  [T, '/record/42',     'serve',    '/api/te-render?kind=entry&id=42'],
  [T, '/countries',     'serve',    '/countries.html'],
  [T, '/countries/ie',  'serve',    '/api/te-render?kind=country&id=ie'],
  [T, '/journal',       'serve',    '/journal.html'],
  [T, '/journal/first-update', 'serve', '/api/te-render?kind=journal&id=first-update'],
  [T, '/challenge',     'serve',    '/challenge.html'],
  [T, '/about',         'serve',    '/about.html'],
  [T, '/faq',           'serve',    '/faq.html'],
  [T, '/contact',       'serve',    '/contact.html'],
  [T, '/refunds',       'serve',    '/refunds.html'],
  [T, '/cookies',       'serve',    '/cookies.html'],
  [T, '/report',        'serve',    '/report.html'],
  [T, '/manage',        'serve',    '/manage.html'],
  [T, '/admin',         'serve',    '/admin.html'],
  [T, '/early-record',  'serve',    '/early-record.html'],
  [T, '/faq.html',      'redirect', '/faq'],
  [T, '/entry.html',    'serve',    '/entry.html'],
  [T, '/api/te-checkout', 'serve',  '/api/te-checkout'],
  [T, '/api/te-stripe-webhook', 'serve', '/api/te-stripe-webhook'],
  [T, '/assets/te/core.js', 'serve', '/assets/te/core.js'],
  [T, '/lib/scale.js',  'serve',    '/lib/scale.js'],
  [T, '/index.html',    'redirect', '/'],
  [T, '/sitemap.xml',   'serve',    '/api/te-sitemap'],
  [T, '/robots.txt',    'serve',    '/robots.txt'],
  [T, '/og-image.png',  'serve',    '/og-image.png'],
  [T, '/_vercel/insights/script.js', 'serve', '/_vercel/insights/script.js'],
  [T, '/quadrillioneuro/',          'redirect', 'https://quadrillioneuro.com/'],
  [T, '/quadrillioneuro/auction.html','redirect','https://quadrillioneuro.com/auction.html'],

  // apex -> www is a Vercel domain redirect (outside vercel.json); www serves directly
  ['www.trillioneuro.com',     '/record', 'serve', '/record.html'],
  ['www.quadrillioneuro.com',  '/auction','serve', '/quadrillioneuro/auction.html'],

  [Q, '/',             'serve', '/quadrillioneuro/index.html'],
  [Q, '/auction',      'serve', '/quadrillioneuro/auction.html'],
  [Q, '/seats',        'serve', '/quadrillioneuro/seats.html'],
  [Q, '/seats.html',   'redirect', '/seats'],
  [Q, '/lib/scenario.js', 'serve', '/quadrillioneuro/lib/scenario.js'],
  [Q, '/privacy',      'serve', '/quadrillioneuro/privacy.html'],
  [Q, '/terms',        'serve', '/quadrillioneuro/terms.html'],
  [Q, '/sitemap.xml',  'serve', '/quadrillioneuro/sitemap.xml'],
  [Q, '/robots.txt',   'serve', '/quadrillioneuro/robots.txt'],
  [Q, '/og-image.png', 'serve', '/quadrillioneuro/og-image.png'],
  [Q, '/hero-bg.webm', 'serve', '/quadrillioneuro/hero-bg.webm'],
  [Q, '/_vercel/insights/script.js', 'serve', '/_vercel/insights/script.js'],
  [Q, '/auction.html', 'redirect', '/auction'],
  [Q, '/index.html',   'redirect', '/'],
  [Q, '/privacy.html', 'redirect', '/privacy'],
  [Q, '/terms.html',   'redirect', '/terms'],

  [R,  '/',              'serve',    '/ripestream/index.html'],
  [RW, '/',              'serve',    '/ripestream/index.html'],
  [R,  '/privacy',       'serve',    '/ripestream/privacy.html'],
  [RW, '/terms',         'serve',    '/ripestream/terms.html'],
  [R,  '/privacy.html',  'redirect', '/privacy'],
  [R,  '/member',        'serve',    '/ripestream/member.html'],
  [RW, '/member/',       'serve',    '/ripestream/member.html'],
  [R,  '/member.html',   'redirect', '/member'],
  [R,  '/member.js',     'serve',    '/ripestream/member.js'],
  [R,  '/index.html',    'redirect', '/'],
  [R,  '/app.js',        'serve',    '/ripestream/app.js'],
  [R,  '/favicon.svg',   'serve',    '/ripestream/favicon.svg'],
  [RW, '/og-image.png',  'serve',    '/ripestream/og-image.png'],
  [R,  '/apple-touch-icon.png', 'serve', '/ripestream/apple-touch-icon.png'],
  [R,  '/sitemap.xml',   'serve',    '/ripestream/sitemap.xml'],
  [R,  '/robots.txt',    'serve',    '/ripestream/robots.txt'],
  [R,  '/_vercel/insights/script.js', 'serve', '/_vercel/insights/script.js'],
  [T,  '/ripestream/',   'redirect', 'https://ripestream.com/'],
  [T,  '/ripestream/terms.html', 'redirect', 'https://ripestream.com/terms.html'],
  [T,  '/privacy',       'serve',    '/privacy.html'],

  ['redteddytutor.com',     '/',              'serve',    '/redteddytutor/index.html'],
  ['www.redteddytutor.com', '/',              'serve',    '/redteddytutor/index.html'],
  ['redteddytutor.com',     '/hero.webp',     'serve',    '/redteddytutor/hero.webp'],
  ['redteddytutor.com',     '/og-image.jpg',  'serve',    '/redteddytutor/og-image.jpg'],
  ['redteddytutor.com',     '/index.html',    'redirect', '/'],
  ['redteddytutor.com',     '/sitemap.xml',   'serve',    '/redteddytutor/sitemap.xml'],
  ['redteddytutor.com',     '/learn/',       'serve',    '/redteddytutor/learn/index.html'],
  ['redteddytutor.com',     '/learn',        'serve',    '/redteddytutor/learn/index.html'],
  ['redteddytutor.com',     '/learn/parent', 'serve',    '/redteddytutor/learn/parent.html'],
  ['redteddytutor.com',     '/learn/game/', 'serve',    '/redteddytutor/learn/game/index.html'],
  ['redteddytutor.com',     '/privacy',      'serve',    '/redteddytutor/privacy.html'],
  ['redteddytutor.com',     '/curriculum',   'serve',    '/redteddytutor/curriculum.html'],
  ['redteddytutor.com',     '/welcome-video.js', 'serve', '/redteddytutor/welcome-video.js'],
  ['redteddytutor.com',     '/media/red-teddy-welcome-v1.mp4', 'serve', '/redteddytutor/media/red-teddy-welcome-v1.mp4'],
  ['redteddytutor.com',     '/media/red-teddy-welcome-poster-640.webp', 'serve', '/redteddytutor/media/red-teddy-welcome-poster-640.webp'],
  ['redteddytutor.com',     '/curriculum.html', 'redirect', '/curriculum'],
  ['redteddytutor.com',     '/home.js',      'serve',    '/redteddytutor/home.js'],
  ['redteddytutor.com',     '/privacy.html', 'redirect', '/privacy'],
  ['redteddytutor.com',     '/learn/game/js/main.js', 'serve', '/redteddytutor/learn/game/js/main.js'],
  ['redteddytutor.com',     '/learn/vendor/phaser-3.90.0.min.js', 'serve', '/redteddytutor/learn/vendor/phaser-3.90.0.min.js'],
  ['redteddytutor.com',     '/learn/js/player.js', 'serve', '/redteddytutor/learn/js/player.js'],
  ['redteddytutor.com',     '/learn/learn.css',    'serve', '/redteddytutor/learn/learn.css'],
  ['redteddytutor.com',     '/learn/js/curriculum/framework.js', 'serve', '/redteddytutor/learn/js/curriculum/framework.js'],
  ['redteddytutor.com',     '/early-years',  'serve',    '/redteddytutor/early/early-years.html'],
  ['www.redteddytutor.com', '/little-world', 'serve',    '/redteddytutor/early/little-world.html'],
  ['redteddytutor.com',     '/little-world/play', 'serve', '/redteddytutor/early/little-world-play.html'],
  ['redteddytutor.com',     '/toddler-activities/', 'serve', '/redteddytutor/early/toddler-activities.html'],
  ['redteddytutor.com',     '/preschool-activities', 'serve', '/redteddytutor/early/preschool-activities.html'],
  ['redteddytutor.com',     '/pre-k-kindergarten-readiness', 'serve', '/redteddytutor/early/pre-k-kindergarten-readiness.html'],
  ['redteddytutor.com',     '/early/little-world.html', 'redirect', '/little-world'],
  ['redteddytutor.com',     '/learning-colors-for-toddlers', 'serve', '/redteddytutor/early/learning-colors-for-toddlers.html'],
  ['redteddytutor.com',     '/early/printables/little-world.pdf', 'serve', '/redteddytutor/early/printables/little-world.pdf'],
  ['redteddytutor.com',     '/early/look.js', 'serve', '/redteddytutor/early/look.js'],
  ['redteddytutor.com',     '/early/early.css', 'serve', '/redteddytutor/early/early.css'],
  ['redteddytutor.com',     '/api/rtt-tutor',      'serve', '/api/rtt-tutor'],
];

let bad = 0;
for (const [host, path, kind, target] of cases) {
  const got = resolve(host, path);
  const gotTarget = got.kind === 'redirect' ? got.to : got.file;
  const ok = got.kind === kind && gotTarget === target;
  if (!ok) bad++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} ${host.padEnd(24)} ${path.padEnd(34)} -> ${got.kind} ${gotTarget}`
    + (ok ? '' : `   EXPECTED ${kind} ${target}`));
}

// Anything served must actually exist on disk (catches a rewrite to nothing).
console.log('\n-- served targets exist on disk --');
for (const [host, path] of cases) {
  const got = resolve(host, path);
  if (got.kind !== 'serve') continue;
  if (got.file.startsWith('/_vercel/')) continue;         // Vercel-internal
  let rel = got.file === '/' ? 'index.html' : got.file.replace(/^\//, '').split('?')[0];
  if (rel.startsWith('api/')) rel += '.mjs';               // serverless function
  const exists = existsSync(new URL(rel, root));
  if (!exists) { bad++; console.log(`FAIL missing file: ${host}${path} -> ${got.file}`); }
}
console.log(bad ? `\n${bad} routing problem(s)` : 'all routing assertions pass, all targets exist');
process.exit(bad ? 1 : 0);
