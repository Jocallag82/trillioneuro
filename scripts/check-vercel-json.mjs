/* Guards against the class of mistake that broke deployment
   e383f6e: Vercel validates vercel.json against a strict schema and rejects
   unknown properties, so a "//" comment key inside a route object fails the
   whole deployment BEFORE the build starts — which is why that failure
   produced no build logs at all and was invisible from the log view.

   JSON has no comments. Route reasoning belongs in README.md.

   Run: node scripts/check-vercel-json.mjs */
import { readFileSync } from 'node:fs';

// The documented legacy `routes` properties.
const ALLOWED_ROUTE_KEYS = new Set([
  'src', 'dest', 'headers', 'methods', 'continue', 'caseSensitive',
  'check', 'status', 'has', 'missing', 'locale', 'middlewarePath',
  'mitigate', 'transforms',
]);
// `routes` cannot be combined with any of these.
const CONFLICTS_WITH_ROUTES = ['rewrites', 'redirects', 'headers', 'cleanUrls', 'trailingSlash'];

const raw = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
let cfg;
try { cfg = JSON.parse(raw); }
catch (e) { console.error('FAIL: vercel.json is not valid JSON —', e.message); process.exit(1); }

const problems = [];

if (Array.isArray(cfg.routes)) {
  for (const k of CONFLICTS_WITH_ROUTES) {
    if (k in cfg) problems.push(`top-level "${k}" cannot be combined with "routes"`);
  }
  cfg.routes.forEach((r, i) => {
    for (const key of Object.keys(r)) {
      if (!ALLOWED_ROUTE_KEYS.has(key)) {
        problems.push(`routes[${i}] has disallowed property "${key}" (this fails the deployment at schema validation)`);
      }
    }
    if (!('src' in r)) problems.push(`routes[${i}] is missing "src"`);
    if ('status' in r && r.status >= 300 && r.status < 400 && !(r.headers && r.headers.Location)) {
      problems.push(`routes[${i}] is a ${r.status} redirect with no Location header`);
    }
    if ('src' in r) { try { new RegExp(r.src); } catch { problems.push(`routes[${i}] src is not a valid regex: ${r.src}`); } }
  });
}

if (problems.length) {
  console.error('vercel.json FAILED validation:');
  problems.forEach(p => console.error('  - ' + p));
  process.exit(1);
}
console.log(`vercel.json ok — ${cfg.routes?.length ?? 0} routes, no disallowed properties`);
