// Shared server helpers for the Founders' Record (Beat Elon).
// No secret is hard-coded. Secrets come from Vercel env:
//   SUPABASE_SECRET_KEY    service-role/secret key (server only)
//   STRIPE_SECRET_KEY      sk_test_… / sk_live_…
//   STRIPE_WEBHOOK_SECRET  whsec_…
//   TE_PAYMENTS_LIVE       must be "true" — second gate beside the DB flag
import crypto from 'node:crypto';

export const SUPABASE_URL = 'https://kxzywyflylkcqoidiqmo.supabase.co';
export const PUBLISHABLE_KEY = 'sb_publishable_37yXvakYMXdpz2e3Hf_zng__oGOVC-g';
export const SITE = (process.env.TE_SITE_URL || 'https://www.trillioneuro.com').replace(/\/$/, '');

export function send(res, status, body, extraHeaders = {}) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  for (const [k, v] of Object.entries(extraHeaders)) res.setHeader(k, v);
  res.end(JSON.stringify(body));
}

export async function readRaw(req, limit = 64 * 1024) {
  if (typeof req.rawBody === 'string') return req.rawBody;
  const chunks = []; let size = 0;
  for await (const c of req) {
    size += c.length;
    if (size > limit) throw Object.assign(new Error('body too large'), { status: 413 });
    chunks.push(typeof c === 'string' ? Buffer.from(c) : c);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function supabaseHeaders(key) {
  const h = { apikey: key, 'Content-Type': 'application/json' };
  // legacy JWT keys also go in Authorization; new sb_secret_/sb_publishable_ keys must not
  if (key.startsWith('eyJ')) h.Authorization = `Bearer ${key}`;
  return h;
}

export async function rpc(fn, args, { service = false, fetchImpl = fetch } = {}) {
  const key = service ? process.env.SUPABASE_SECRET_KEY : PUBLISHABLE_KEY;
  if (!key) throw Object.assign(new Error('server not configured'), { status: 503, code: 'NOT_CONFIGURED' });
  const r = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: supabaseHeaders(key), body: JSON.stringify(args || {}),
    signal: AbortSignal.timeout(8000),
  });
  const text = await r.text();
  let data = null; try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) {
    const msg = (data && data.message) || `rpc ${fn} failed`;
    throw Object.assign(new Error(msg), { status: r.status, code: String(msg).split(':')[0] });
  }
  return data;
}

// ── Stripe ───────────────────────────────────────────────────────────
export function paymentsConfigured() {
  return process.env.TE_PAYMENTS_LIVE === 'true' && !!process.env.STRIPE_SECRET_KEY
    && !!process.env.STRIPE_WEBHOOK_SECRET && !!process.env.SUPABASE_SECRET_KEY;
}

export function formEncode(obj, prefix = '', out = []) {
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    const key = prefix ? `${prefix}[${k}]` : k;
    if (typeof v === 'object') formEncode(v, key, out);
    else out.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(v))}`);
  }
  return out.join('&');
}

export async function stripe(path, params, { idempotencyKey, fetchImpl = fetch } = {}) {
  const headers = {
    Authorization: `Bearer ${process.env.STRIPE_SECRET_KEY}`,
    'Content-Type': 'application/x-www-form-urlencoded',
    'Stripe-Version': '2024-06-20',
  };
  if (idempotencyKey) headers['Idempotency-Key'] = idempotencyKey;
  const r = await fetchImpl(`https://api.stripe.com/v1/${path}`, {
    method: 'POST', headers, body: formEncode(params), signal: AbortSignal.timeout(10000),
  });
  const data = await r.json().catch(() => ({}));
  if (!r.ok) throw Object.assign(new Error(data?.error?.message || 'stripe error'), { status: 502 });
  return data;
}

// Stripe-Signature: t=…,v1=…[,v1=…]. HMAC-SHA256 over `${t}.${rawBody}`.
export function verifyStripeSignature(rawBody, header, secret, toleranceSec = 300, nowSec = Math.floor(Date.now() / 1000)) {
  if (!header || !secret) return false;
  const parts = Object.create(null); const v1 = [];
  for (const p of String(header).split(',')) {
    const i = p.indexOf('='); if (i < 0) continue;
    const k = p.slice(0, i).trim(), v = p.slice(i + 1).trim();
    if (k === 'v1') v1.push(v); else parts[k] = v;
  }
  const t = Number(parts.t);
  if (!Number.isFinite(t) || !v1.length) return false;
  if (Math.abs(nowSec - t) > toleranceSec) return false;
  const expected = crypto.createHmac('sha256', secret).update(`${t}.${rawBody}`, 'utf8').digest('hex');
  const eb = Buffer.from(expected, 'hex');
  return v1.some((sig) => {
    if (!/^[0-9a-f]{64}$/i.test(sig)) return false;
    const sb = Buffer.from(sig, 'hex');
    return sb.length === eb.length && crypto.timingSafeEqual(sb, eb);
  });
}

export const isUuid = (s) => typeof s === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export function escapeHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// Logs carry ids and outcomes only — never emails, names or messages.
export function log(event, data = {}) {
  console.log(JSON.stringify({ at: new Date().toISOString(), event, ...data }));
}
