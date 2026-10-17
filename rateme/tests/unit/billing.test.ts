// Integration tests: Stripe webhook processing against a real Postgres test database.
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { execSync } from 'node:child_process';
import Stripe from 'stripe';
import { sql } from '@/lib/db';
import { processStripeEvent } from '@/lib/billing';
import { getEntitlement } from '@/lib/membership';
import { verifyWebhook } from '@/lib/stripe';

let businessId = '';
let userId = '';
const SUB = 'sub_test_123';
const CUS = 'cus_test_123';
let n = 0;
const ev = (type: string, object: Record<string, unknown>, created = 1_800_000_000 + n) => ({ id: `evt_${type}_${++n}`, type, created, data: { object } });
const sub = (status: string, extra: Record<string, unknown> = {}) => ({
  id: SUB, object: 'subscription', customer: CUS, status, cancel_at_period_end: false, canceled_at: null, ended_at: null,
  metadata: { business_id: businessId, plan_id: '1', user_id: userId },
  items: { data: [{ current_period_end: Math.floor(Date.now() / 1000) + 365 * 86400, price: { unit_amount: 4999, currency: 'eur' } }] }, ...extra,
});

beforeAll(async () => {
  execSync('node scripts/migrate.mjs', { env: { ...process.env }, stdio: 'ignore' });
  await sql`truncate rateme.stripe_events, rateme.subscriptions, rateme.invoices, rateme.checkout_sessions, rateme.qr_codes, rateme.audit_events, rateme.email_outbox cascade`;
  const [u] = await sql<{ id: string }[]>`insert into users (email, password_hash, display_name, email_verified_at) values ('billing-test@example.ie', 'x', 'Billing Test', now())
    on conflict (email) do update set display_name = excluded.display_name returning id`;
  userId = u.id;
  const [b] = await sql<{ id: string }[]>`
    insert into businesses (slug, name, category_id, county_id, status, source, is_test_data)
    select 'billing-test-biz', 'Billing Test Biz', (select id from categories where slug = 'plumbers'), (select id from counties where slug = 'cork'), 'published', 'admin', true
    on conflict (slug) do update set name = excluded.name returning id`;
  businessId = b.id;
  await sql`insert into checkout_sessions (stripe_session_id, business_id, user_id, plan_id) values ('cs_test_1', ${businessId}, ${userId}, 1) on conflict do nothing`;
});
afterAll(async () => { await sql.end(); });

describe('Stripe webhook lifecycle', () => {
  it('rejects bad signatures and accepts valid ones', () => {
    const payload = JSON.stringify(ev('ping', {}));
    expect(() => verifyWebhook(payload, 't=1,v1=deadbeef')).toThrow();
    expect(() => verifyWebhook(payload, null)).toThrow();
    const header = Stripe.webhooks.generateTestHeaderString({ payload, secret: 'whsec_unit_test' });
    expect(verifyWebhook(payload, header).type).toBe('ping');
  });

  it('no membership before payment is confirmed', async () => {
    expect((await getEntitlement(businessId)).active).toBe(false);
  });

  it('ignores an unpaid checkout completion (async payment pending)', async () => {
    const r = await processStripeEvent(ev('checkout.session.completed', { id: 'cs_test_1', mode: 'subscription', payment_status: 'unpaid', subscription: SUB, customer: CUS }));
    expect(r).toBe('ignored');
    expect((await getEntitlement(businessId)).active).toBe(false);
  });

  it('activates on paid checkout and issues a QR code', async () => {
    const e = ev('checkout.session.completed', { id: 'cs_test_1', mode: 'subscription', payment_status: 'paid', subscription: SUB, customer: CUS, amount_total: 4999, currency: 'eur' });
    expect(await processStripeEvent(e)).toBe('processed');
    expect((await getEntitlement(businessId)).active).toBe(true);
    const [q] = await sql`select code from qr_codes where business_id = ${businessId} and revoked_at is null`;
    expect(q.code).toMatch(/^[A-Za-z0-9]{8}$/);
    // duplicate delivery is a no-op
    expect(await processStripeEvent(e)).toBe('duplicate');
    const [{ c }] = await sql<{ c: number }[]>`select count(*)::int c from subscriptions where business_id = ${businessId}`;
    expect(c).toBe(1);
  });

  it('records the period end from subscription.created', async () => {
    await processStripeEvent(ev('customer.subscription.created', sub('active')));
    const e = await getEntitlement(businessId);
    expect(e.state).toBe('active');
    expect(e.renewsOrEndsAt!.getTime()).toBeGreaterThan(Date.now() + 300 * 86400000);
  });

  it('records a paid invoice (renewal)', async () => {
    const end = Math.floor(Date.now() / 1000) + 730 * 86400;
    await processStripeEvent(ev('invoice.paid', { id: 'in_1', subscription: SUB, charge: 'ch_1', amount_paid: 4999, currency: 'eur', hosted_invoice_url: 'https://invoice.stripe.com/x', lines: { data: [{ period: { start: 1, end } }] } }));
    const [i] = await sql`select status, amount_paid from invoices where stripe_invoice_id = 'in_1'`;
    expect(i).toMatchObject({ status: 'paid', amount_paid: 4999 });
    const [s] = await sql<{ current_period_end: Date }[]>`select current_period_end from subscriptions where stripe_subscription_id = ${SUB}`;
    expect(Math.round(s.current_period_end.getTime() / 1000)).toBe(end);
  });

  it('failed payment → past_due keeps access during grace and emails the purchaser', async () => {
    await processStripeEvent(ev('invoice.payment_failed', { id: 'in_2', subscription: SUB, currency: 'eur' }));
    await processStripeEvent(ev('customer.subscription.updated', sub('past_due')));
    const e = await getEntitlement(businessId);
    expect(e).toMatchObject({ active: true, state: 'grace' });
    const [m] = await sql`select 1 from email_outbox where template = 'payment_failed' and to_email = 'billing-test@example.ie'`;
    expect(m).toBeTruthy();
  });

  it('ignores out-of-order (older) subscription events', async () => {
    const r = await processStripeEvent(ev('customer.subscription.updated', sub('canceled'), 1_000_000_000));
    expect(r).toBe('ignored');
    expect((await getEntitlement(businessId)).state).toBe('grace');
  });

  it('cancel at period end stays active, then deletion expires it', async () => {
    await processStripeEvent(ev('customer.subscription.updated', sub('active', { cancel_at_period_end: true })));
    expect((await getEntitlement(businessId)).state).toBe('cancelling');
    await processStripeEvent(ev('customer.subscription.deleted', sub('canceled', { ended_at: Math.floor(Date.now() / 1000) })));
    expect((await getEntitlement(businessId))).toMatchObject({ active: false, state: 'expired' });
    // the QR code survives expiry so printed codes keep working
    const [q] = await sql`select 1 from qr_codes where business_id = ${businessId} and revoked_at is null`;
    expect(q).toBeTruthy();
  });

  it('refund and dispute suspend access; a won dispute restores it', async () => {
    await processStripeEvent(ev('customer.subscription.updated', sub('active')));
    expect((await getEntitlement(businessId)).active).toBe(true);
    await processStripeEvent(ev('charge.dispute.created', { id: 'dp_1', charge: 'ch_1', status: 'needs_response' }));
    expect((await getEntitlement(businessId)).state).toBe('suspended');
    await processStripeEvent(ev('charge.dispute.closed', { id: 'dp_1', charge: 'ch_1', status: 'won' }));
    expect((await getEntitlement(businessId)).active).toBe(true);
    await processStripeEvent(ev('charge.refunded', { id: 'ch_1', customer: CUS, refunded: false }));
    expect((await getEntitlement(businessId)).active).toBe(true); // partial refund doesn't end membership
    await processStripeEvent(ev('charge.refunded', { id: 'ch_1', customer: CUS, refunded: true }));
    expect((await getEntitlement(businessId)).state).toBe('suspended');
  });

  it('a failing event is not marked processed, so Stripe can retry', async () => {
    const bad = ev('customer.subscription.created', { ...sub('active'), id: 'sub_bad', metadata: { business_id: '00000000-0000-0000-0000-000000000000' } });
    await expect(processStripeEvent(bad)).rejects.toThrow();
    const rows = await sql`select 1 from stripe_events where id = ${bad.id}`;
    expect(rows.length).toBe(0);
  });
});

describe('rating integrity', () => {
  it('aggregates come only from published reviews', async () => {
    const mk = (rating: number, status: string, i: number) => sql`insert into reviews (business_id, rating, experience_month, reviewer_name, reviewer_email, reviewer_email_hash, declaration_at, status, published_at, is_test_data)
      values (${businessId}, ${rating}, '2026-09-01', 'T', ${`r${i}@x.ie`}, ${`h${i}`}, now(), ${status}, now(), true)`;
    await sql`delete from reviews where business_id = ${businessId}`;
    await mk(5, 'published', 1); await mk(1, 'published', 2); await mk(5, 'held', 3); await mk(5, 'rejected', 4); await mk(5, 'pending_confirmation', 5);
    const [b] = await sql<{ rating_count: number; rating_avg: string; rating_dist: number[] }[]>`select rating_count, rating_avg::text, rating_dist from businesses where id = ${businessId}`;
    expect(b).toMatchObject({ rating_count: 2, rating_avg: '3.00', rating_dist: [1, 0, 0, 0, 1] });
  });
  it('one live review per reviewer per business', async () => {
    await expect(sql`insert into reviews (business_id, rating, experience_month, reviewer_name, reviewer_email, reviewer_email_hash, declaration_at, status)
      values (${businessId}, 4, '2026-09-01', 'T', 'r1@x.ie', 'h1', now(), 'pending_confirmation')`).rejects.toThrow(/reviews_one_per_reviewer/);
  });
  it('rating must be 1–5', async () => {
    await expect(sql`insert into reviews (business_id, rating, experience_month, reviewer_name, reviewer_email, reviewer_email_hash, declaration_at)
      values (${businessId}, 6, '2026-09-01', 'T', 'z@x.ie', 'hz', now())`).rejects.toThrow();
  });
});
