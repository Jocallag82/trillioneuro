/* Replays vercel.json's `routes` the way Vercel does — in order, honouring
   `continue`, `has` host conditions and `status` — then asserts what each
   important URL on each host resolves to.
   Run: node scripts/check-routes.mjs */
import { readFileSync, existsSync } from 'node:fs';

const cfg = JSON.parse(readFileSync(new URL('../vercel.json', import.meta.url), 'utf8'));
const root = new URL('../', import.meta.url);

function resolve(host, path) {
  let current = path;
  for (const r of cfg.routes) {
    if (r.has) {
      const hostRule = r.has.find(h => h.type === 'host');
      if (hostRule && hostRule.value !== host) continue;
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

const T = 'trillioneuro.com', Q = 'quadrillioneuro.com';
const cases = [
  // [host, path, expected kind, expected target]
  [T, '/',              'serve',    '/'],
  [T, '/record',        'serve',    '/record.html'],
  [T, '/privacy',       'serve',    '/privacy.html'],
  [T, '/terms',         'serve',    '/terms.html'],
  [T, '/record.html',   'redirect', '/record'],
  [T, '/claim',         'serve',    '/claim.html'],
  [T, '/claim.html',    'redirect', '/claim'],
  [T, '/lib/scale.js',  'serve',    '/lib/scale.js'],
  [T, '/index.html',    'redirect', '/'],
  [T, '/sitemap.xml',   'serve',    '/sitemap.xml'],
  [T, '/robots.txt',    'serve',    '/robots.txt'],
  [T, '/og-image.png',  'serve',    '/og-image.png'],
  [T, '/_vercel/insights/script.js', 'serve', '/_vercel/insights/script.js'],
  [T, '/quadrillioneuro/',          'redirect', 'https://quadrillioneuro.com/'],
  [T, '/quadrillioneuro/auction.html','redirect','https://quadrillioneuro.com/auction.html'],

  ['www.trillioneuro.com',     '/record', 'redirect', 'https://trillioneuro.com/record'],
  ['www.quadrillioneuro.com',  '/auction','redirect', 'https://quadrillioneuro.com/auction'],

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
  const rel = got.file === '/' ? 'index.html' : got.file.replace(/^\//, '');
  const exists = existsSync(new URL(rel, root));
  if (!exists) { bad++; console.log(`FAIL missing file: ${host}${path} -> ${got.file}`); }
}
console.log(bad ? `\n${bad} routing problem(s)` : 'all routing assertions pass, all targets exist');
process.exit(bad ? 1 : 0);
