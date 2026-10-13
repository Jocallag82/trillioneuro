// POST /api/te-stripe-webhook — Stripe events. The signature is verified against the raw
// body before anything is trusted. Entries are created only here, only for paid sessions,
// and idempotently (event id + session id) inside one database transaction.
import { send, readRaw, rpc, verifyStripeSignature, log } from './_te/lib.mjs';

export async function handleWebhook(req, res, deps = {}) {
  if (req.method !== 'POST') return send(res, 405, { error: 'METHOD' }, { Allow: 'POST' });
  const secret = deps.secret ?? process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) return send(res, 503, { error: 'NOT_CONFIGURED' });
  let raw;
  try { raw = await readRaw(req, 512 * 1024); } catch { return send(res, 413, { error: 'TOO_LARGE' }); }
  if (!verifyStripeSignature(raw, req.headers['stripe-signature'], secret, 300, deps.now)) {
    log('te_webhook_bad_signature');
    return send(res, 400, { error: 'BAD_SIGNATURE' });
  }
  let event; try { event = JSON.parse(raw); } catch { return send(res, 400, { error: 'BAD_JSON' }); }
  const call = deps.rpc || rpc;
  const obj = event?.data?.object || {};
  try {
    let result = { result: 'ignored' };
    switch (event.type) {
      case 'checkout.session.completed':
      case 'checkout.session.async_payment_succeeded':
        if (obj.payment_status === 'paid') {
          result = await call('te_finalize_payment', {
            p_event_id: event.id, p_session: obj.id, p_payment_intent: obj.payment_intent || null,
            p_amount: obj.amount_total, p_currency: obj.currency,
          }, { service: true });
        } else result = { result: 'awaiting_payment' };
        break;
      case 'checkout.session.expired':
        result = await call('te_mark_session', { p_event_id: event.id, p_session: obj.id, p_status: 'expired' }, { service: true });
        break;
      case 'checkout.session.async_payment_failed':
        result = await call('te_mark_session', { p_event_id: event.id, p_session: obj.id, p_status: 'failed' }, { service: true });
        break;
      case 'charge.refunded':
        if (obj.payment_intent && obj.refunded) {
          result = await call('te_record_refund', { p_event_id: event.id, p_payment_intent: obj.payment_intent }, { service: true });
        } else result = { result: 'partial_refund_ignored' };
        break;
      default: break;
    }
    log('te_webhook', { id: event.id, type: event.type, result: result?.result, entry: result?.entry_number });
    return send(res, 200, { received: true, result: result?.result });
  } catch (e) {
    // 500 makes Stripe retry; finalization is idempotent so retries are safe.
    log('te_webhook_error', { id: event.id, type: event.type, error: e.message });
    return send(res, 500, { error: 'PROCESSING_FAILED' });
  }
}

export default (req, res) => handleWebhook(req, res);
