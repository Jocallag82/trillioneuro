// POST /api/rtt-tutor — one tutor turn for a signed-in parent's child profile.
//
// Flow: validate the body -> safety screen -> reserve a turn in Supabase with the
// caller's own access token (rtt_tutor_begin checks they own the profile and enforces
// the daily and per-minute limits) -> call the model through the Vercel AI Gateway ->
// validate the reply -> record token use (a failed call refunds the turn).
//
// No secret is held here: Supabase is called with the user's own token and the
// publishable key, and the AI Gateway authenticates this deployment with Vercel's
// OIDC token (or AI_GATEWAY_API_KEY if one is configured). Nothing the child types
// and nothing the tutor says is stored.
import {
  parseRequest, needsAdult, SAFETY_REPLY, buildSystemPrompt, buildMessages, parseReply,
} from './_rtt/tutor-core.mjs';

const SUPABASE_URL = 'https://kxzywyflylkcqoidiqmo.supabase.co';
const PUBLISHABLE_KEY = 'sb_publishable_37yXvakYMXdpz2e3Hf_zng__oGOVC-g';
const GATEWAY = 'https://ai-gateway.vercel.sh/v1/messages';
// A fast, low-cost model is right for short guided hints. The fallback is used only
// when the gateway rejects the primary id (not enabled, renamed).
const MODEL = process.env.RTT_TUTOR_MODEL?.trim() || 'anthropic/claude-haiku-4.5';
const FALLBACK_MODEL = process.env.RTT_TUTOR_FALLBACK_MODEL?.trim() || 'anthropic/claude-sonnet-4.6';
const TIMEOUT_MS = 12000;

const rpc = (token, fn, args) => fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
  method: 'POST',
  headers: { apikey: PUBLISHABLE_KEY, Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify(args),
  signal: AbortSignal.timeout(6000),
});

async function callModel(credential, model, system, messages) {
  const res = await fetch(GATEWAY, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${credential}`, 'x-api-key': credential,
      'anthropic-version': '2023-06-01', 'content-type': 'application/json',
    },
    body: JSON.stringify({ model, system, messages, max_tokens: 600, temperature: 0.4 }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  if (!res.ok) return { ok: false, status: res.status };
  const data = await res.json();
  const text = Array.isArray(data?.content) ? data.content.filter((b) => b?.type === 'text').map((b) => b.text).join('') : '';
  return { ok: true, text, input: data?.usage?.input_tokens || 0, output: data?.usage?.output_tokens || 0 };
}

const send = (res, status, body) => {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(body));
};

async function readJson(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 8000) return null;
  }
  try { return JSON.parse(raw); } catch { return null; }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return send(res, 405, { ok: false, reason: 'method' });
  const token = /^Bearer (.+)$/.exec(req.headers.authorization || '')?.[1];
  if (!token) return send(res, 401, { ok: false, reason: 'signed-out' });

  const parsed = parseRequest(await readJson(req));
  if (!parsed.ok) return send(res, 400, { ok: false, reason: parsed.error });
  const body = parsed.value;

  if (needsAdult([body.message, body.item.learnerAnswer, ...body.history.filter((h) => h.role === 'learner').map((h) => h.text)])) {
    return send(res, 200, { ok: true, type: 'safety', reply: SAFETY_REPLY, followUp: null });
  }

  let begin;
  try {
    const r = await rpc(token, 'rtt_tutor_begin', { p_profile: body.profileId });
    if (r.status === 401 || r.status === 403) return send(res, 401, { ok: false, reason: 'signed-out' });
    if (!r.ok) return send(res, 503, { ok: false, reason: 'unavailable' });
    begin = await r.json();
  } catch {
    return send(res, 503, { ok: false, reason: 'unavailable' });
  }
  if (!begin.allowed) {
    const status = begin.reason === 'signed-out' ? 401 : begin.reason === 'no-profile' ? 403 : 429;
    return send(res, status, { ok: false, reason: begin.reason, remaining: begin.remaining ?? 0, limit: begin.limit });
  }

  const credential = process.env.AI_GATEWAY_API_KEY || req.headers['x-vercel-oidc-token'] || process.env.VERCEL_OIDC_TOKEN;
  const finish = (input, output, ok) => rpc(token, 'rtt_tutor_finish', { p_input: input, p_output: output, p_ok: ok }).catch(() => {});
  if (!credential) {
    await finish(0, 0, false);
    return send(res, 503, { ok: false, reason: 'unavailable' });
  }

  const system = buildSystemPrompt({ objective: body.objective, band: begin.band, mode: body.mode });
  const messages = buildMessages(body);
  let result;
  try {
    result = await callModel(credential, MODEL, system, messages);
    if (!result.ok && [400, 403, 404].includes(result.status) && FALLBACK_MODEL !== MODEL) {
      console.warn(`[rtt-tutor] ${MODEL} rejected (${result.status}); trying ${FALLBACK_MODEL}`);
      result = await callModel(credential, FALLBACK_MODEL, system, messages);
    }
  } catch (e) {
    result = { ok: false, status: e?.name === 'TimeoutError' ? 504 : 502 };
  }
  if (!result.ok) {
    console.warn(`[rtt-tutor] model call failed (${result.status})`);
    await finish(0, 0, false);
    return send(res, 503, { ok: false, reason: 'unavailable' });
  }

  const reply = parseReply(result.text, body);
  await finish(result.input, result.output, Boolean(reply));
  if (!reply) return send(res, 200, { ok: false, reason: 'fallback' });
  return send(res, 200, { ok: true, ...reply, remaining: begin.remaining, limit: begin.limit });
}
