// Unit tests for the Founders' Record server functions. Run: node --test scripts/te/
import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import { verifyStripeSignature, formEncode, escapeHtml } from '../../api/_te/lib.mjs';
import { handleWebhook } from '../../api/te-stripe-webhook.mjs';
import { handleCheckout } from '../../api/te-checkout.mjs';
import { inject, describe } from '../../api/te-render.mjs';
import { build } from '../../api/te-sitemap.mjs';

const SECRET = 'whsec_test_secret';
const sign = (body, t = Math.floor(Date.now() / 1000), secret = SECRET) =>
  `t=${t},v1=${crypto.createHmac('sha256', secret).update(`${t}.${body}`).digest('hex')}`;

function mockReq({ method = 'POST', headers = {}, body = '' } = {}) {
  return { method, headers, rawBody: body, url: '/' };
}
function mockRes() {
  return { statusCode: 0, headers: {}, body: '', setHeader(k, v) { this.headers[k.toLowerCase()] = v; }, end(b) { this.body = b || ''; } };
}

test('signature: valid, tampered, stale, wrong secret, garbage', () => {
  const body = '{"id":"evt_1"}';
  assert.equal(verifyStripeSignature(body, sign(body), SECRET), true);
  assert.equal(verifyStripeSignature(body + ' ', sign(body), SECRET), false);
  assert.equal(verifyStripeSignature(body, sign(body, Math.floor(Date.now() / 1000) - 3600), SECRET), false);
  assert.equal(verifyStripeSignature(body, sign(body, undefined, 'whsec_other'), SECRET), false);
  assert.equal(verifyStripeSignature(body, 't=abc,v1=zz', SECRET), false);
  assert.equal(verifyStripeSignature(body, undefined, SECRET), false);
  // multiple v1 signatures (secret rotation): any match passes
  const t = Math.floor(Date.now() / 1000);
  const good = sign(body, t).split('v1=')[1];
  assert.equal(verifyStripeSignature(body, `t=${t},v1=${'0'.repeat(64)},v1=${good}`, SECRET), true);
});

test('webhook rejects unsigned and bad requests before touching the database', async () => {
  let called = 0; const rpc = async () => { called++; return {}; };
  const body = JSON.stringify({ id: 'evt_x', type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'paid', amount_total: 1900, currency: 'eur' } } });
  let res = mockRes(); await handleWebhook(mockReq({ body, headers: {} }), res, { secret: SECRET, rpc });
  assert.equal(res.statusCode, 400); assert.equal(called, 0);
  res = mockRes(); await handleWebhook(mockReq({ method: 'GET' }), res, { secret: SECRET, rpc });
  assert.equal(res.statusCode, 405);
  res = mockRes(); await handleWebhook(mockReq({ body }), res, { secret: '', rpc });
  assert.equal(res.statusCode, 503);
});

test('webhook: paid session finalizes; unpaid does not; expiry and refund routed', async () => {
  const calls = []; const rpc = async (fn, args) => { calls.push([fn, args]); return { result: fn === 'te_finalize_payment' ? 'created' : 'ok', entry_number: 1 }; };
  const send = async (event) => {
    const body = JSON.stringify(event); const res = mockRes();
    await handleWebhook(mockReq({ body, headers: { 'stripe-signature': sign(body) } }), res, { secret: SECRET, rpc });
    return res;
  };
  let r = await send({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'paid', payment_intent: 'pi_1', amount_total: 1900, currency: 'eur' } } });
  assert.equal(r.statusCode, 200);
  assert.deepEqual(calls[0], ['te_finalize_payment', { p_event_id: 'evt_1', p_session: 'cs_1', p_payment_intent: 'pi_1', p_amount: 1900, p_currency: 'eur' }]);
  r = await send({ id: 'evt_2', type: 'checkout.session.completed', data: { object: { id: 'cs_2', payment_status: 'unpaid' } } });
  assert.equal(JSON.parse(r.body).result, 'awaiting_payment'); assert.equal(calls.length, 1);
  await send({ id: 'evt_3', type: 'checkout.session.expired', data: { object: { id: 'cs_3' } } });
  assert.equal(calls[1][0], 'te_mark_session'); assert.equal(calls[1][1].p_status, 'expired');
  await send({ id: 'evt_4', type: 'checkout.session.async_payment_failed', data: { object: { id: 'cs_4' } } });
  assert.equal(calls[2][1].p_status, 'failed');
  await send({ id: 'evt_5', type: 'charge.refunded', data: { object: { payment_intent: 'pi_1', refunded: true } } });
  assert.equal(calls[3][0], 'te_record_refund');
  r = await send({ id: 'evt_6', type: 'charge.refunded', data: { object: { payment_intent: 'pi_1', refunded: false } } });
  assert.equal(JSON.parse(r.body).result, 'partial_refund_ignored');
});

test('webhook returns 500 on database failure so Stripe retries', async () => {
  const body = JSON.stringify({ id: 'evt_1', type: 'checkout.session.completed', data: { object: { id: 'cs_1', payment_status: 'paid' } } });
  const res = mockRes();
  await handleWebhook(mockReq({ body, headers: { 'stripe-signature': sign(body) } }), res, { secret: SECRET, rpc: async () => { throw new Error('db down'); } });
  assert.equal(res.statusCode, 500);
});

test('checkout: refuses when payments are not configured, wrong origin, bad input', async () => {
  const draft = '0b7e8d8e-8a7f-4d6e-9d8c-1a2b3c4d5e6f';
  const req = (h = {}, b = { draft_id: draft }) => mockReq({ headers: { 'content-type': 'application/json', ...h }, body: JSON.stringify(b) });
  let res = mockRes(); await handleCheckout(req(), res, { paymentsConfigured: () => false });
  assert.equal(res.statusCode, 503); assert.equal(JSON.parse(res.body).error, 'PAYMENTS_DISABLED');
  res = mockRes(); await handleCheckout(req({ origin: 'https://evil.example' }), res, { paymentsConfigured: () => true });
  assert.equal(res.statusCode, 403);
  res = mockRes(); await handleCheckout(req({}, { draft_id: 'nope' }), res, { paymentsConfigured: () => true });
  assert.equal(res.statusCode, 400);
  res = mockRes(); await handleCheckout(mockReq({ headers: { 'content-type': 'text/plain' }, body: '{}' }), res, { paymentsConfigured: () => true });
  assert.equal(res.statusCode, 415);
  // database flag off → 503 even when env is configured
  res = mockRes();
  await handleCheckout(req(), res, { paymentsConfigured: () => true, rpc: async () => { throw Object.assign(new Error('PAYMENTS_DISABLED'), { code: 'PAYMENTS_DISABLED' }); } });
  assert.equal(res.statusCode, 503);
});

test('checkout: price comes from the database draft, idempotency key per attempt', async () => {
  const draft = '0b7e8d8e-8a7f-4d6e-9d8c-1a2b3c4d5e6f'; let stripeArgs, stripeOpts; const rpcCalls = [];
  const res = mockRes();
  await handleCheckout(mockReq({ headers: { 'content-type': 'application/json', origin: 'https://www.trillioneuro.com' }, body: JSON.stringify({ draft_id: draft, price_cents: 1 }) }), res, {
    paymentsConfigured: () => true,
    rpc: async (fn, a) => { rpcCalls.push([fn, a]); return fn === 'te_service_checkout_draft' ? { draft_id: draft, email: 'a@b.co', price_cents: 1900, currency: 'eur', attempt: 2 } : null; },
    stripe: async (path, args, opts) => { stripeArgs = args; stripeOpts = opts; return { id: 'cs_test_1', url: 'https://checkout.stripe.com/c/pay/cs_test_1' }; },
  });
  assert.equal(res.statusCode, 200);
  assert.equal(stripeArgs.line_items[0].price_data.unit_amount, 1900);
  assert.equal(stripeOpts.idempotencyKey, `te-${draft}-2`);
  assert.deepEqual(rpcCalls[1], ['te_service_attach_session', { p_id: draft, p_session: 'cs_test_1' }]);
  assert.match(formEncode(stripeArgs), /line_items%5B0%5D%5Bprice_data%5D%5Bunit_amount%5D=1900/);
});

test('render: meta is escaped, private fields never used, noindex until approved', async () => {
  const tpl = '<title>x</title><meta name="description" content="d"><meta name="robots" content="noindex, nofollow"><meta property="og:title" content="t"><meta property="og:description" content="d"><meta property="og:url" content="u">';
  const rpc = async () => ({ entry_number: 7, nickname: '<script>alert(1)</script>', country_name: 'Ireland', message: '"quoted" & <b>', indexable: false, email: 'secret@x.y', real_name: null });
  const m = await describe('entry', '7', rpc);
  const html = inject(tpl, m);
  assert.ok(!html.includes('<script>alert'));
  assert.ok(html.includes('&lt;script&gt;'));
  assert.ok(!html.includes('secret@x.y'));
  assert.ok(html.includes('noindex'));
  const approved = inject(tpl, await describe('entry', '7', async () => ({ entry_number: 7, nickname: 'Z', country_name: 'Ireland', indexable: true })));
  assert.ok(approved.includes('rel="canonical" href="https://www.trillioneuro.com/record/7"'));
  assert.equal(await describe('entry', '7; drop', rpc), null);
  assert.equal(await describe('journal', '../etc', rpc), null);
});

test('sitemap escapes and includes only what the database marks public', () => {
  const xml = build({ entries: [{ n: 1, at: '2026-10-14T00:00:00Z' }], countries: ['IE'], journal: [{ slug: 'a-b', at: '2026-10-14' }] });
  assert.match(xml, /\/record\/1<\/loc><lastmod>2026-10-14/);
  assert.match(xml, /\/countries\/IE/);
  assert.equal(build(null).includes('/record/'), false);
  assert.equal(escapeHtml('<"&\'>'), '&lt;&quot;&amp;&#39;&gt;');
});
