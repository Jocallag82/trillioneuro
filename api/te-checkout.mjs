// POST /api/te-checkout {draft_id} — creates a Stripe Checkout Session for a draft entry.
// Refuses unless BOTH the database flag (te_settings.payments_enabled) and the server
// env gate (TE_PAYMENTS_LIVE=true + Stripe/Supabase keys) are on. The price comes from
// the draft row in the database, never from the browser.
import { send, readRaw, rpc, stripe, paymentsConfigured, isUuid, SITE, log } from './_te/lib.mjs';

const ALLOWED_ORIGINS = new Set([SITE, 'https://www.trillioneuro.com', 'https://trillioneuro.com']);

export async function handleCheckout(req, res, deps = {}) {
  if (req.method !== 'POST') return send(res, 405, { error: 'METHOD' }, { Allow: 'POST' });
  const origin = req.headers.origin;
  if (origin && !ALLOWED_ORIGINS.has(origin) && !(deps.allowOrigin && deps.allowOrigin(origin))) {
    return send(res, 403, { error: 'ORIGIN' });
  }
  if (!String(req.headers['content-type'] || '').includes('application/json')) return send(res, 415, { error: 'CONTENT_TYPE' });
  if (!(deps.paymentsConfigured || paymentsConfigured)()) {
    return send(res, 503, { error: 'PAYMENTS_DISABLED', message: 'Payments are not enabled yet. Join the waitlist instead.' });
  }
  let body;
  try { body = JSON.parse(await readRaw(req, 4096)); } catch { return send(res, 400, { error: 'BAD_JSON' }); }
  if (!isUuid(body?.draft_id)) return send(res, 400, { error: 'BAD_DRAFT' });

  const call = deps.rpc || rpc; const stripeCall = deps.stripe || stripe;
  let draft;
  try { draft = await call('te_service_checkout_draft', { p_id: body.draft_id }, { service: true }); }
  catch (e) {
    const code = e.code || 'ERROR';
    const status = code === 'PAYMENTS_DISABLED' ? 503 : code === 'TOO_MANY_ATTEMPTS' ? 429 : 400;
    return send(res, status, { error: code });
  }
  try {
    const session = await stripeCall('checkout/sessions', {
      mode: 'payment',
      customer_email: draft.email,
      client_reference_id: draft.draft_id,
      metadata: { draft_id: draft.draft_id },
      payment_intent_data: { metadata: { draft_id: draft.draft_id }, description: "Founders' Record entry — TrillionEuro.com" },
      line_items: { 0: { quantity: 1, price_data: {
        currency: draft.currency, unit_amount: draft.price_cents,
        product_data: { name: "Founders' Record entry — Beat Elon",
          description: 'A numbered, permanent public entry and certificate. Not an investment; no financial return.' } } } },
      success_url: `${SITE}/join/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${SITE}/join/cancelled?draft=${draft.draft_id}`,
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      locale: 'auto',
    }, { idempotencyKey: `te-${draft.draft_id}-${draft.attempt}` });
    await call('te_service_attach_session', { p_id: draft.draft_id, p_session: session.id }, { service: true });
    log('te_checkout_created', { draft: draft.draft_id, session: session.id });
    return send(res, 200, { url: session.url });
  } catch (e) {
    log('te_checkout_failed', { draft: draft.draft_id, error: e.message });
    return send(res, 502, { error: 'CHECKOUT_FAILED', message: 'The payment page could not be opened. Nothing was charged.' });
  }
}

export default (req, res) => handleCheckout(req, res);
