// Local full-stack preview of trillioneuro.com for end-to-end tests.
//  • replays vercel.json routes for host www.trillioneuro.com (same order/semantics as check-routes)
//  • runs the real /api handlers
//  • emulates PostgREST /rest/v1/rpc/* against a local Postgres via psql (roles + request.headers)
//  • TE_FAKE_STRIPE=1 answers Stripe API calls locally (no network)
// Run: PGHOST=… PGPORT=… PGUSER=postgres PGDATABASE=te_test node scripts/te/dev-server.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = Number(process.argv[2] || process.env.PORT || 4400);
const HOST = 'www.trillioneuro.com';
const SB = 'https://kxzywyflylkcqoidiqmo.supabase.co';
const ADMIN_TOKEN = 'dev-admin-token', USER_TOKEN = 'dev-user-token';
const ADMIN_UID = '11111111-1111-1111-1111-111111111111', USER_UID = '22222222-2222-2222-2222-222222222222';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg', '.webm': 'video/webm', '.mp4': 'video/mp4' };
const cfg = JSON.parse(await readFile(join(ROOT, 'vercel.json'), 'utf8'));

process.env.SUPABASE_SECRET_KEY ||= 'sb_secret_dev';
process.env.TE_SITE_URL ||= `http://localhost:${PORT}`;
if (process.env.TE_FAKE_STRIPE) {
  process.env.STRIPE_SECRET_KEY ||= 'sk_test_dev';
  process.env.STRIPE_WEBHOOK_SECRET ||= 'whsec_dev';
  process.env.TE_PAYMENTS_LIVE ||= 'true';
}

// ── PostgREST emulation ──────────────────────────────────────────────
const lit = (v) => v === null || v === undefined ? 'NULL'
  : Array.isArray(v) ? `'{${v.map((x) => '"' + String(x).replace(/["\\]/g, '\\$&') + '"').join(',')}}'`
  : typeof v === 'object' ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb`
  : `'${String(v).replace(/'/g, "''")}'`;
export function pgrpc(fn, args, { role = 'anon', sub = '', ip = '127.0.0.1' } = {}) {
  if (!/^te_[a-z_]+$/.test(fn)) return Promise.resolve({ status: 404, body: { message: 'not found' } });
  const named = Object.entries(args || {}).map(([k, v]) => {
    if (!/^p_[a-z_]+$/.test(k)) throw new Error('bad arg');
    // jsonb params (settings) must stay jsonb even for scalars
    if (fn === 'te_admin_set_setting' && k === 'p_value') return `${k} => '${JSON.stringify(v ?? null).replace(/'/g, "''")}'::jsonb`;
    return `${k} => ${lit(v)}`;
  }).join(', ');
  const sql = `set role ${role}; select set_config('request.headers', '${JSON.stringify({ 'x-forwarded-for': ip }).replace(/'/g, "''")}', false);
select set_config('request.jwt.claim.sub', '${sub}', false); select coalesce(to_jsonb(public.${fn}(${named}))::text, 'null');`;
  return new Promise((resolve) => {
    execFile('psql', ['-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql], { maxBuffer: 1 << 24 }, (err, out, stderr) => {
      if (err) {
        const msg = (String(stderr).match(/ERROR:\s+(.*)/) || [])[1] || 'error';
        const status = /permission denied/.test(msg) ? 401 : /FORBIDDEN/.test(msg) ? 403 : 400;
        return resolve({ status, body: { message: msg.replace(/^permission denied.*/, 'permission denied for function ' + fn) } });
      }
      const lines = out.trim().split('\n');
      resolve({ status: 200, body: JSON.parse(lines[lines.length - 1]) });
    });
  });
}
function roleFor(headers) {
  const auth = String(headers.authorization || '').replace(/^Bearer /, '');
  if (auth === ADMIN_TOKEN) return { role: 'authenticated', sub: ADMIN_UID };
  if (auth === USER_TOKEN) return { role: 'authenticated', sub: USER_UID };
  if (headers.apikey === process.env.SUPABASE_SECRET_KEY) return { role: 'service_role', sub: '' };
  return { role: 'anon', sub: '' };
}

// Server-side fetch: Supabase → emulator, Stripe → fake.
const realFetch = globalThis.fetch;
export const stripeCalls = [];
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.startsWith(SB + '/rest/v1/rpc/')) {
    const fn = u.split('/').pop();
    const r = await pgrpc(fn, JSON.parse(opts.body || '{}'), { ...roleFor(lower(opts.headers)), ip: '10.0.0.1' });
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  }
  if (u.startsWith('https://api.stripe.com/') && process.env.TE_FAKE_STRIPE) {
    const params = new URLSearchParams(opts.body);
    stripeCalls.push(Object.fromEntries(params));
    const id = 'cs_test_' + Math.random().toString(36).slice(2, 14);
    return new Response(JSON.stringify({ id, url: 'https://checkout.stripe.com/c/pay/' + id, amount_total: Number(params.get('line_items[0][price_data][unit_amount]')), currency: params.get('line_items[0][price_data][currency]') }), { status: 200 });
  }
  if (u.startsWith(`http://localhost:${PORT}`) || u.startsWith('https://' + HOST)) {
    return realFetch(u.replace('https://' + HOST, `http://localhost:${PORT}`), opts);
  }
  return realFetch(url, opts);
};
function lower(h = {}) { const o = {}; for (const [k, v] of Object.entries(h)) o[k.toLowerCase()] = v; return o; }

// ── vercel.json routing ──────────────────────────────────────────────
function hostOk(r) {
  const h = r.has?.find((x) => x.type === 'host'); if (!h) return true;
  const v = h.value; return typeof v === 'string' ? v === HOST : v.eq ? v.eq === HOST : v.inc.includes(HOST);
}
function route(path) {
  let cur = path; const headers = {};
  for (const r of cfg.routes) {
    if (!hostOk(r)) continue;
    const m = cur.match(new RegExp('^' + r.src + '$')); if (!m) continue;
    const sub = (s) => m.slice(1).reduce((a, g, i) => a.split('$' + (i + 1)).join(g ?? ''), s);
    if (r.status >= 300 && r.status < 400) return { redirect: sub(r.headers.Location), status: r.status };
    if (r.headers) for (const [k, v] of Object.entries(r.headers)) headers[k] = v;
    if (r.dest) { cur = sub(r.dest); if (!r.continue) break; }
  }
  return { path: cur, headers };
}

const apiCache = new Map();
async function api(name) {
  if (!apiCache.has(name)) apiCache.set(name, (await import(pathToFileURL(join(ROOT, 'api', name + '.mjs')).href)).default);
  return apiCache.get(name);
}

createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  // PostgREST emulation for the browser (Playwright reroutes the Supabase origin here)
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    let body = ''; for await (const c of req) body += c;
    const r = await pgrpc(url.pathname.split('/').pop(), JSON.parse(body || '{}'), { ...roleFor(req.headers), ip: String(req.headers['x-test-ip'] || '127.0.0.1') });
    res.writeHead(r.status, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
    return res.end(JSON.stringify(r.body));
  }
  if (url.pathname.startsWith('/_vercel/')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(''); }
  req.headers['x-forwarded-proto'] = 'http';
  const r = route(url.pathname);
  if (r.redirect) { res.writeHead(r.status, { location: r.redirect }); return res.end(); }
  for (const [k, v] of Object.entries(r.headers)) if (k !== 'Location') res.setHeader(k, v);
  const [p, q] = r.path.split('?');
  if (p.startsWith('/api/')) {
    req.url = p + '?' + [q, url.search.slice(1)].filter(Boolean).join('&');
    try { return await (await api(p.slice(5)))(req, res); }
    catch (e) { console.error(e); res.statusCode = 500; return res.end('api error'); }
  }
  let file = p === '/' ? '/index.html' : p;
  try {
    const body = await readFile(join(ROOT, decodeURIComponent(file)));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); }
}).listen(PORT, () => console.log(`trillioneuro dev on http://localhost:${PORT}`));
