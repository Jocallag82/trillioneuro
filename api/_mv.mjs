// Shared server helpers for the movement pages. The browser's publishable key is public by design; everything this
// code reads goes through the same public mv_* RPCs as the browser, so no personal data can reach it.
export const SUPABASE_URL = 'https://kxzywyflylkcqoidiqmo.supabase.co';
export const PUBLISHABLE_KEY = 'sb_publishable_37yXvakYMXdpz2e3Hf_zng__oGOVC-g';
export const SITE = (process.env.MV_SITE_URL || 'https://www.trillioneuro.com').replace(/\/$/, '');

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

export async function rpc(fn, args = {}, fetchImpl = fetch) {
  const r = await fetchImpl(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: { apikey: PUBLISHABLE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify(args), signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw Object.assign(new Error(`rpc ${fn} ${r.status}`), { status: r.status });
  return r.json();
}
