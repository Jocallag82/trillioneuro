import { test, expect } from '@playwright/test';
import jsQR from 'jsqr';
import { PNG } from 'pngjs';
import { db, emailLink, sendWebhook } from './helpers';

test.describe.configure({ mode: 'serial' });
const OWNER = 'owner@e2e-garage.ie';
const PASSWORD = 'garage-owner-pass-1';
let businessId = '';

test('register, verify email, create listing, verify ownership, pay, use QR, edit', async ({ page, request }) => {
  // 1. Register
  await page.goto('/for-business');
  await page.getByRole('link', { name: 'Create a business account' }).click();
  await page.getByLabel('Your name').fill('Declan Murphy');
  await page.getByLabel('Email').fill(OWNER);
  await page.getByLabel('Password').fill(PASSWORD);
  await page.getByRole('checkbox', { name: /I agree to the/ }).check();
  await page.waitForTimeout(2600);
  await page.getByRole('button', { name: 'Create account' }).click();
  await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible();

  // Unverified accounts can't reach the dashboard
  await page.goto('/dashboard');
  await expect(page).toHaveURL(/\/verify-email/);

  // 2. Verify email
  await page.goto(await emailLink(OWNER, 'verify_email'));
  await page.getByRole('button', { name: 'Confirm my email' }).click();
  await expect(page.getByText('Your email is confirmed')).toBeVisible();

  // 3/4. Search, then create a new listing
  await page.getByRole('link', { name: 'Find or add your business' }).click();
  await page.getByLabel('Business name', { exact: true }).first().fill('Murphy E2E Garage');
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page.getByText('No matching listing')).toBeVisible();
  const form = page.locator('form', { has: page.getByRole('button', { name: 'Create listing and verify' }) });
  await form.getByLabel('Business name', { exact: true }).fill('Murphy E2E Garage');
  await form.getByLabel('Category').selectOption({ label: 'Garages & mechanics' });
  await form.getByLabel(/^County/).selectOption({ label: 'Co. Cork' });
  await form.getByLabel(/Town or area/).selectOption({ label: 'Mallow' });
  await form.getByLabel(/Eircode/).fill('p51 x2y3');
  await form.getByLabel(/^Website/).fill('e2e-garage.ie');
  await form.getByLabel(/Public phone/).fill('022 12345');
  await form.getByRole('checkbox', { name: /I own or am authorised/ }).check();
  await form.getByRole('button', { name: 'Create listing and verify' }).click();

  // 5/6. Ownership verification via matching business email domain
  await expect(page.getByRole('heading', { name: /Verify that you own or manage/ })).toBeVisible();
  businessId = page.url().split('/b/')[1].split('/')[0];
  const [pending] = await db`select status from businesses where id = ${businessId}`;
  expect(pending.status).toBe('pending'); // not public before verification
  const anon = await request.get('/business/murphy-e2e-garage');
  expect(anon.status()).toBe(404);
  await page.getByRole('button', { name: 'Verify with my account email' }).click();
  await expect(page.getByText(/Ownership verified — your listing is live/)).toBeVisible();

  // 7/8. Membership: checkout is attempted against Stripe (unreachable here) and fails safely.
  await page.getByRole('checkbox', { name: /I agree to the membership terms/ }).check();
  await page.getByRole('button', { name: 'Continue to secure payment' }).click();
  await expect(page.getByText(/couldn’t start checkout/)).toBeVisible();
  // The success redirect alone grants nothing
  await page.goto(`/dashboard/b/${businessId}/membership?checkout=success`);
  await expect(page.getByText(/waiting for confirmation from our payment provider/)).toBeVisible();
  await expect(page.getByText('No membership yet')).toBeVisible();

  // Authoritative, signed provider events activate membership
  const now = Math.floor(Date.now() / 1000);
  const completed = { id: 'evt_e2e_1', type: 'checkout.session.completed', created: now, data: { object: {
    id: 'cs_e2e_1', mode: 'subscription', payment_status: 'paid', subscription: 'sub_e2e_1', customer: 'cus_e2e_1', amount_total: 4999, currency: 'eur',
    metadata: { business_id: businessId, plan_id: '1' } } } };
  expect((await sendWebhook(request, completed)).status()).toBe(200);
  const dup = await sendWebhook(request, completed);
  expect((await dup.json()).result).toBe('duplicate');
  await sendWebhook(request, { id: 'evt_e2e_2', type: 'customer.subscription.created', created: now + 1, data: { object: {
    id: 'sub_e2e_1', customer: 'cus_e2e_1', status: 'active', cancel_at_period_end: false, metadata: { business_id: businessId },
    items: { data: [{ current_period_end: now + 365 * 86400, price: { unit_amount: 4999, currency: 'eur' } }] } } } });
  await page.reload();
  await expect(page.getByRole('paragraph').filter({ hasText: /^Active$/ })).toBeVisible();
  await expect(page.getByText(/Renews on/)).toBeVisible();

  // 9/10. QR code: download, decode, scan
  await page.getByRole('link', { name: 'QR code', exact: true }).click();
  await expect(page.getByRole('link', { name: /Download PNG/ })).toBeVisible();
  const png = await page.request.get(`/api/qr/${businessId}?format=png`);
  expect(png.status()).toBe(200);
  expect(png.headers()['content-type']).toBe('image/png');
  const img = PNG.sync.read(await png.body());
  const decoded = jsQR(new Uint8ClampedArray(img.data), img.width, img.height);
  expect(decoded?.data).toMatch(/^http:\/\/localhost:3200\/r\/[A-Za-z0-9]{8}$/);
  const svg = await page.request.get(`/api/qr/${businessId}?format=svg`);
  expect(await svg.text()).toContain('<svg');
  const scanned = new URL(decoded!.data).pathname;
  await page.goto(scanned);
  await expect(page).toHaveURL(/\/business\/murphy-e2e-garage\/review\?src=qr/);
  await expect(page.getByText('You’re rating')).toBeVisible();
  const [stat] = await db`select qr_scans from business_daily_stats where business_id = ${businessId}`;
  expect(stat.qr_scans).toBeGreaterThanOrEqual(1);
  // printable poster
  await page.goto(`/dashboard/b/${businessId}/poster`);
  await expect(page.getByText('How did we do?')).toBeVisible();

  // 11. Edit authorised business information
  await page.goto(`/dashboard/b/${businessId}/edit`);
  await page.getByLabel(/Description/).fill('Family garage in Mallow. NCT preparation, servicing and repairs.');
  await page.getByRole('button', { name: 'Save changes' }).click();
  await expect(page.getByText('Saved.')).toBeVisible();
  await page.goto('/business/murphy-e2e-garage');
  await expect(page.getByText('NCT preparation, servicing and repairs')).toBeVisible();
  await expect(page.getByText('Owner verified')).toBeVisible();
  await expect(page.getByText('Paid member')).toBeVisible();
  // Address is private by default (home-based traders)
  await expect(page.locator('body')).not.toContainText('P51 X2Y3');
});

test('owner can respond publicly to a review', async ({ page }) => {
  await db`insert into reviews (business_id, rating, title, body, experience_month, reviewer_name, reviewer_email, reviewer_email_hash, declaration_at, status, published_at, confirmed_at)
           values (${businessId}, 3, 'Fine but slow', 'Took longer than quoted.', '2026-09-01', 'Gráinne', 'grainne@example.ie', 'gh1', now(), 'published', now(), now())`;
  const { login } = await import('./helpers');
  await login(page, OWNER, PASSWORD);
  await page.goto(`/dashboard/b/${businessId}/reviews`);
  await page.getByText('Respond publicly').click();
  await page.getByLabel('Your response').fill('Thanks Gráinne — sorry for the delay, we have added a second mechanic on Saturdays.');
  await page.getByRole('button', { name: 'Publish response' }).click();
  await expect(page.getByText('Response published.')).toBeVisible();
  // Responses with personal contact details are refused
  await page.getByText('Edit response').click();
  await page.getByLabel('Your response').fill('Ring me on 087 765 4321 to discuss');
  await page.getByRole('button', { name: 'Publish response' }).click();
  await expect(page.getByText(/remove phone numbers or email addresses/)).toBeVisible();
  await page.goto('/business/murphy-e2e-garage');
  await expect(page.getByText('Response from Murphy E2E Garage')).toBeVisible();
  await expect(page.getByText(/added a second mechanic/)).toBeVisible();
});

test('owner reviewing their own business is held as a conflict of interest', async ({ page }) => {
  const { fillReview } = await import('./helpers');
  await page.goto('/business/murphy-e2e-garage/review');
  await fillReview(page, { stars: 5, title: 'Best garage', name: 'Declan', email: 'someone@e2e-garage.ie' });
  await page.goto(await emailLink('someone@e2e-garage.ie', 'review_confirm'));
  await page.getByRole('button', { name: 'Yes, publish my review' }).click();
  await expect(page.getByText(/moderator is checking it/)).toBeVisible();
  const [r] = await db`select status, hold_reasons from reviews where reviewer_email = 'someone@e2e-garage.ie'`;
  expect(r.status).toBe('held');
  expect(r.hold_reasons).toContain('possible_conflict');
});

test('cancellation and expiry keep the profile and reviews public', async ({ page, request }) => {
  const now = Math.floor(Date.now() / 1000);
  const sub = (status: string, extra = {}) => ({ id: 'sub_e2e_1', customer: 'cus_e2e_1', status, cancel_at_period_end: false, metadata: { business_id: businessId },
    items: { data: [{ current_period_end: now + 365 * 86400, price: { unit_amount: 4999, currency: 'eur' } }] }, ...extra });
  await sendWebhook(request, { id: 'evt_e2e_3', type: 'customer.subscription.updated', created: now + 10, data: { object: sub('active', { cancel_at_period_end: true }) } });
  const { login } = await import('./helpers');
  await login(page, OWNER, PASSWORD);
  await page.goto(`/dashboard/b/${businessId}/membership`);
  await expect(page.getByRole('paragraph').filter({ hasText: /^Active — won’t renew$/ })).toBeVisible();
  await sendWebhook(request, { id: 'evt_e2e_4', type: 'customer.subscription.deleted', created: now + 20, data: { object: sub('canceled', { ended_at: now }) } });
  await page.reload();
  await expect(page.getByRole('paragraph').filter({ hasText: /^Expired$/ })).toBeVisible();
  expect((await page.request.get(`/api/qr/${businessId}?format=png`)).status()).toBe(402);
  await page.goto(`/dashboard/b/${businessId}/edit`);
  await expect(page.getByText(/Editing your profile is a member feature/)).toBeVisible();
  const pub = await request.get('/business/murphy-e2e-garage');
  expect(pub.status()).toBe(200);
  expect(await pub.text()).toContain('Fine but slow');
  // printed QR codes still resolve
  const [q] = await db`select code from qr_codes where business_id = ${businessId}`;
  const r = await request.get(`/r/${q.code}`, { maxRedirects: 0 });
  expect(r.status()).toBe(302);
  expect(r.headers().location).toContain('/business/murphy-e2e-garage/review');
});
