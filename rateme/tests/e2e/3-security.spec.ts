import { test, expect } from '@playwright/test';
import { db, createUser, login, sendWebhook } from './helpers';

test.describe.configure({ mode: 'serial' });
let garageId = '';
let bakeryReviewId = '';

test.beforeAll(async () => {
  [{ id: garageId }] = await db`select id from businesses where slug = 'murphy-e2e-garage'`;
  [{ id: bakeryReviewId }] = await db`select r.id from reviews r join businesses b on b.id = r.business_id where b.slug = 'nolans-e2e-bakery' and r.status = 'published' limit 1`;
  await createUser('intruder@example.ie', 'intruder-password-1');
  await createUser('mod@e2e.rateme.test', 'moderator-password-1', 'moderator', 'E2E Moderator');
  await createUser('admin@e2e.rateme.test', 'admin-password-1', 'admin', 'E2E Admin');
});

test('anonymous users are sent to sign in for private areas', async ({ page }) => {
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/login\?next=%2Fdashboard/);
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/login/);
});

test('a member cannot access another business’s dashboard, QR or data', async ({ page }) => {
  await login(page, 'intruder@example.ie', 'intruder-password-1');
  for (const p of ['', '/edit', '/membership', '/qr', '/reviews', '/verify', '/poster']) {
    const r = await page.goto(`/dashboard/b/${garageId}${p}`);
    expect(r?.status(), p).toBe(404);
  }
  expect((await page.request.get(`/api/qr/${garageId}?format=png`)).status()).toBe(404);
  const exp = await page.request.get('/api/account/export');
  expect(await exp.text()).not.toContain('owner@e2e-garage.ie');
});

test('an unauthorised user cannot self-verify a business that already has a verified owner', async ({ page }) => {
  await login(page, 'intruder@example.ie', 'intruder-password-1');
  await page.goto('/dashboard/claim?business=murphy-e2e-garage');
  await page.getByRole('button', { name: 'Request access' }).click();
  await expect(page.getByText(/already has a verified owner/)).toBeVisible();
  await expect(page.getByRole('button', { name: /Verify with my account email/ })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Check now' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Request manual verification' })).toBeVisible();
  // A pending claim exposes nothing beyond the verification step (no billing, stats or tools)
  for (const p of ['', '/edit', '/membership', '/qr', '/reviews', '/poster']) {
    await page.goto(`/dashboard/b/${garageId}${p}`);
    await expect(page, p).toHaveURL(new RegExp(`/dashboard/b/${garageId}/verify`));
  }
  await expect(page.locator('body')).not.toContainText('Renews on');
  expect((await page.request.get(`/api/qr/${garageId}?format=png`)).status()).toBe(404);
});

test('ordinary members cannot use admin; moderators cannot use admin-only tools', async ({ page }) => {
  await login(page, 'intruder@example.ie', 'intruder-password-1');
  await page.goto('/admin');
  await expect(page).toHaveURL(/\/dashboard\?denied=1/);
  await page.goto('/admin/reviews');
  await expect(page).toHaveURL(/\/dashboard\?denied=1/);
  await page.context().clearCookies();
  await login(page, 'mod@e2e.rateme.test', 'moderator-password-1');
  await page.goto('/admin');
  await expect(page.getByRole('heading', { name: 'Overview' })).toBeVisible();
  await page.goto('/admin/pricing');
  await expect(page).toHaveURL(/\/dashboard\?denied=1/);
});

test('forged form fields cannot touch another business’s reviews (IDOR)', async ({ page }) => {
  await login(page, 'owner@e2e-garage.ie', 'garage-owner-pass-1');
  // re-activate membership so the respond form renders
  const now = Math.floor(Date.now() / 1000);
  await sendWebhook(page.request, { id: 'evt_sec_1', type: 'customer.subscription.created', created: now + 100, data: { object: {
    id: 'sub_e2e_2', customer: 'cus_e2e_1', status: 'active', metadata: { business_id: garageId },
    items: { data: [{ current_period_end: now + 365 * 86400, price: { unit_amount: 4999, currency: 'eur' } }] } } } });
  await page.goto(`/dashboard/b/${garageId}/reviews`);
  await page.getByText(/Respond publicly|Edit response/).first().click();
  await page.locator('input[name="review_id"]').first().evaluate((el, id) => { (el as HTMLInputElement).value = id; }, bakeryReviewId);
  await page.getByLabel('Your response').first().fill('Forged response attempt');
  await page.getByRole('button', { name: 'Publish response' }).first().click();
  await expect(page.getByText('Review not found.')).toBeVisible();
  const rows = await db`select 1 from review_responses where review_id = ${bakeryReviewId}`;
  expect(rows.length).toBe(0);
});

test('webhooks without a valid signature are rejected', async ({ request }) => {
  const r = await request.post('/api/stripe/webhook', { data: JSON.stringify({ id: 'evt_forged', type: 'checkout.session.completed', data: { object: {} } }), headers: { 'stripe-signature': 't=1,v1=abc' } });
  expect(r.status()).toBe(400);
  const r2 = await request.post('/api/stripe/webhook', { data: '{}' });
  expect(r2.status()).toBe(400);
});

test('private pages are not indexable; previews block all crawlers', async ({ request }) => {
  for (const p of ['/dashboard', '/admin', '/login', '/register', '/review/confirm']) {
    const r = await request.get(p, { maxRedirects: 0 });
    expect(r.headers()['x-robots-tag'], p).toContain('noindex');
  }
  const robots = await (await request.get('/robots.txt')).text();
  expect(robots).toMatch(/Disallow: \//);
  const home = await request.get('/');
  expect(home.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(home.headers()['x-powered-by']).toBeUndefined();
});

test('admin can change pricing centrally', async ({ page }) => {
  await login(page, 'admin@e2e.rateme.test', 'admin-password-1');
  await page.goto('/admin/pricing');
  const founding = page.locator('form', { hasText: 'founding-annual' });
  await founding.getByLabel(/Price/).fill('54.99');
  await founding.getByRole('button', { name: 'Save plan' }).click();
  await expect(page.getByText(/Plan saved/)).toBeVisible();
  await page.goto('/for-business');
  await expect(page.getByText('€54.99').first()).toBeVisible();
  await db`update plans set amount_cents = 4999 where code = 'founding-annual'`;
  const [a] = await db`select 1 from audit_events where action = 'pricing.plan_updated'`;
  expect(a).toBeTruthy();
});

test('login is rate limited per account', async ({ page }) => {
  for (let i = 0; i < 9; i++) {
    await page.goto('/login');
    await page.getByLabel('Email').fill('victim@example.ie');
    await page.getByLabel('Password').fill(`wrong-password-${i}`);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForLoadState('networkidle');
  }
  await expect(page.getByText(/Too many sign-in attempts/)).toBeVisible();
});
