// Local full-stack preview of trillioneuro.com for end-to-end tests.
//  • replays vercel.json routes for host www.trillioneuro.com (same order/semantics as check-routes)
//  • runs the real /api handlers
//  • emulates PostgREST /rest/v1/rpc/mv_* against a local Postgres via psql (roles + request.headers)
//  • emulates the Supabase Auth (GoTrue) endpoints the site uses, writing real rows to auth.users so the
//    database triggers (profile creation, referral attribution, confirmation) run exactly as in production
//  • AUTH_CONFIRM=1 → sign-ups need email confirmation (POST /__confirm {email}), like production defaults
// Run: PGHOST=… PGUSER=postgres PGDATABASE=mv_test node scripts/mv/dev-server.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const PORT = Number(process.argv[2] || process.env.PORT || 4400);
const HOST = 'www.trillioneuro.com';
export const SB = 'https://kxzywyflylkcqoidiqmo.supabase.co';
const CONFIRM = process.env.AUTH_CONFIRM === '1';
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml', '.woff2': 'font/woff2', '.jpg': 'image/jpeg' };
const cfg = JSON.parse(await readFile(join(ROOT, 'vercel.json'), 'utf8'));
process.env.MV_SITE_URL ||= `http://localhost:${PORT}`;

// ── psql helpers ─────────────────────────────────────────────────────
const q = (v) => v === null || v === undefined ? 'NULL' : typeof v === 'object' ? `'${JSON.stringify(v).replace(/'/g, "''")}'::jsonb` : `'${String(v).replace(/'/g, "''")}'`;
const psql = (sql) => new Promise((resolve, reject) => execFile('psql', ['-v', 'ON_ERROR_STOP=1', '-qAt', '-c', sql], { maxBuffer: 1 << 24 }, (err, out, stderr) => err ? reject(Object.assign(new Error(stderr), { stderr: String(stderr) })) : resolve(out)));

export function pgrpc(fn, args, { role = 'anon', sub = '', ip = '127.0.0.1' } = {}) {
  if (!/^mv_[a-z_]+$/.test(fn)) return Promise.resolve({ status: 404, body: { message: 'not found' } });
  const named = Object.entries(args || {}).map(([k, v]) => { if (!/^p_[a-z_]+$/.test(k)) throw new Error('bad arg'); return `${k} => ${q(v)}`; }).join(', ');
  const sql = `set role ${role}; select set_config('request.headers', ${q(JSON.stringify({ 'x-forwarded-for': ip }))}, false);
select set_config('request.jwt.claim.sub', ${q(sub)}, false); select coalesce(to_jsonb(public.${fn}(${named}))::text, 'null');`;
  return psql(sql).then((out) => {
    const lines = out.trim().split('\n'); return { status: 200, body: JSON.parse(lines[lines.length - 1]) };
  }, (err) => {
    const msg = (String(err.stderr).match(/ERROR:\s+(.*)/) || [])[1] || 'error';
    const status = /permission denied/.test(msg) ? 401 : /FORBIDDEN|AUTH_REQUIRED|CONFIRM_REQUIRED/.test(msg) ? 403 : /RATE_LIMIT|LIMIT/.test(msg) ? 429 : 400;
    return { status, body: { message: msg.replace(/^permission denied.*/, 'permission denied for function ' + fn) } };
  });
}

// ── GoTrue emulation ─────────────────────────────────────────────────
const users = new Map();      // email → { id, password }
const access = new Map();     // access token → uid
const refresh = new Map();    // refresh token → uid
const recovery = new Map();   // email → token
const session = (u) => {
  const a = 'at_' + randomUUID(), r = 'rt_' + randomUUID(); access.set(a, u.id); refresh.set(r, u.id);
  return { access_token: a, refresh_token: r, token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: u.id, email: u.email } };
};
const bearer = (h) => String(h.authorization || '').replace(/^Bearer /, '');
async function confirmed(email) { return (await psql(`select email_confirmed_at is not null from auth.users where email = ${q(email)}`)).trim() === 't'; }

export async function auth(method, path, query, headers, body) {
  const j = (status, b) => ({ status, body: b });
  if (path === '/auth/v1/signup') {
    const { email, password, data } = body;
    if (!email || !/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(email)) return j(400, { error_code: 'validation_failed', msg: 'Unable to validate email address: invalid format' });
    if (!password || password.length < 6) return j(422, { error_code: 'weak_password', msg: 'Password should be at least 6 characters.' });
    if (users.has(email)) return CONFIRM ? j(200, { id: randomUUID(), email, identities: [] }) : j(422, { error_code: 'user_already_exists', msg: 'User already registered' });
    const id = randomUUID();
    try { await psql(`insert into auth.users (id, email, raw_user_meta_data, email_confirmed_at) values (${q(id)}, ${q(email)}, ${q(data || {})}, ${CONFIRM ? 'null' : 'now()'})`); }
    catch (e) { return j(500, { error_code: 'unexpected_failure', msg: 'Database error saving new user' }); }
    users.set(email, { id, password, email }); return CONFIRM ? j(200, { id, email }) : j(200, session({ id, email }));
  }
  if (path === '/auth/v1/token') {
    if (query.get('grant_type') === 'refresh_token') { const id = refresh.get(body.refresh_token); if (!id) return j(400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' }); refresh.delete(body.refresh_token); const u = [...users.values()].find((x) => x.id === id); return j(200, session(u || { id, email: '' })); }
    const u = users.get(body.email);
    if (!u || u.password !== body.password) return j(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
    if (!(await confirmed(u.email))) return j(400, { error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
    return j(200, session(u));
  }
  if (path === '/auth/v1/logout') { access.delete(bearer(headers)); return j(204, null); }
  if (path === '/auth/v1/recover') { if (users.has(body.email)) { const t = 'at_' + randomUUID(); recovery.set(body.email, t); access.set(t, users.get(body.email).id); } return j(200, {}); }
  if (path === '/auth/v1/user' && method === 'PUT') { const id = access.get(bearer(headers)); const u = [...users.values()].find((x) => x.id === id); if (!u) return j(401, { msg: 'invalid JWT' }); u.password = body.password; return j(200, { id }); }
  return j(404, { msg: 'not found' });
}
function roleFor(headers) { const id = access.get(bearer(headers)); return id ? { role: 'authenticated', sub: id } : { role: 'anon', sub: '' }; }

// ── routing (vercel.json replay) ─────────────────────────────────────
function hostOk(r) { const h = r.has?.find((x) => x.type === 'host'); if (!h) return true; const v = h.value; return typeof v === 'string' ? v === HOST : v.eq ? v.eq === HOST : v.inc.includes(HOST); }
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
async function api(name) { if (!apiCache.has(name)) apiCache.set(name, (await import(pathToFileURL(join(ROOT, 'api', name + '.mjs')).href)).default); return apiCache.get(name); }

// Server-side fetch from /api handlers → the emulators above
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, opts = {}) => {
  const u = String(url);
  if (u.startsWith(SB + '/rest/v1/rpc/')) {
    const r = await pgrpc(u.split('/').pop(), JSON.parse(opts.body || '{}'), { role: 'anon', ip: '10.0.0.1' });
    return new Response(JSON.stringify(r.body), { status: r.status, headers: { 'content-type': 'application/json' } });
  }
  if (u.startsWith('https://' + HOST)) return realFetch(u.replace('https://' + HOST, `http://localhost:${PORT}`), opts);
  return realFetch(url, opts);
};

const CORS = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': 'GET,POST,PUT,OPTIONS' };
async function readBody(req) { let b = ''; for await (const c of req) b += c; return b; }

if (process.argv[1] === fileURLToPath(import.meta.url)) createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  const send = (status, body, extra = {}) => { res.writeHead(status, { 'content-type': 'application/json', ...CORS, ...extra }); res.end(body === null ? '' : JSON.stringify(body)); };
  if (url.pathname.startsWith('/rest/v1/rpc/')) {
    const r = await pgrpc(url.pathname.split('/').pop(), JSON.parse((await readBody(req)) || '{}'), { ...roleFor(req.headers), ip: String(req.headers['x-test-ip'] || '127.0.0.1') });
    return send(r.status, r.body);
  }
  if (url.pathname.startsWith('/auth/v1/')) { const r = await auth(req.method, url.pathname, url.searchParams, req.headers, JSON.parse((await readBody(req)) || '{}')); return send(r.status, r.body); }
  if (url.pathname === '/__confirm' && req.method === 'POST') { const { email } = JSON.parse(await readBody(req)); await psql(`update auth.users set email_confirmed_at = now() where email = ${q(email)}`); return send(200, { ok: true }); }
  if (url.pathname === '/__recovery') { const t = recovery.get(url.searchParams.get('email')); return send(t ? 200 : 404, { hash: t ? `#access_token=${t}&refresh_token=x&expires_in=3600&type=recovery` : null, token: t }); }
  if (url.pathname.startsWith('/_vercel/')) { res.writeHead(200, { 'content-type': 'text/javascript' }); return res.end(''); }
  req.headers['x-forwarded-proto'] = 'http';
  const r = route(url.pathname);
  if (r.redirect) { res.writeHead(r.status, { location: r.redirect }); return res.end(); }
  for (const [k, v] of Object.entries(r.headers)) if (k !== 'Location') res.setHeader(k, v);
  const [p, qs] = r.path.split('?');
  if (p.startsWith('/api/')) {
    req.url = p + '?' + [qs, url.search.slice(1)].filter(Boolean).join('&');
    try { return await (await api(p.slice(5)))(req, res); } catch (e) { if (e.code === 'ERR_MODULE_NOT_FOUND') { res.statusCode = 404; return res.end('not found'); } console.error(e); res.statusCode = 500; return res.end('api error'); }
  }
  const file = p === '/' ? '/index.html' : p;
  try {
    const body = await readFile(join(ROOT, decodeURIComponent(file)));
    res.writeHead(200, { 'content-type': TYPES[extname(file)] || 'application/octet-stream', 'cache-control': 'no-store' }); res.end(body);
  } catch { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); }
}).listen(PORT, () => console.log(`trillioneuro dev on http://localhost:${PORT}`));
