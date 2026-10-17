import { test, expect } from '@playwright/test';
import { db, emailLink, login } from './helpers';

test.describe.configure({ mode: 'serial' });
let garageId = '';
test.beforeAll(async () => { [{ id: garageId }] = await db`select id from businesses where slug = 'murphy-e2e-garage'`; });

async function dispute(page: import('@playwright/test').Page, title: string, reason: string, text: string) {
  await login(page, 'owner@e2e-garage.ie', 'garage-owner-pass-1');
  await page.goto(`/dashboard/b/${garageId}/reviews`);
  const card = page.locator('article', { hasText: title });
  await card.getByText('Dispute this review').click();
  await card.getByLabel('Reason').selectOption(reason);
  await card.getByLabel('Explanation').fill(text);
  await card.getByRole('button', { name: 'Submit dispute' }).click();
  await expect(page.getByText(/asked the reviewer to reconfirm/)).toBeVisible();
}

async function reconfirmByEmail(page: import('@playwright/test').Page, email: string) {
  await page.context().clearCookies();
  await page.goto(await emailLink(email, 'review_reconfirm'));
  await page.getByRole('checkbox', { name: /I confirm this review describes/ }).check();
  await page.getByRole('button', { name: /keep my review published/ }).click();
  await expect(page.getByText('your review is published')).toBeVisible();
}

test('dispute → reviewer reconfirms → review stays and cannot be disputed again (no moderator)', async ({ page }) => {
  await dispute(page, 'Fine but slow', 'not_a_customer', 'We have no booking under this name in September.');
  const [d] = await db`select d.review_id, r.status from disputes d join reviews r on r.id = d.review_id where d.status = 'open' and d.source = 'business'`;
  expect(d.status).toBe('published'); // nothing removed while waiting
  await reconfirmByEmail(page, 'grainne@example.ie');
  const [after] = await db`select r.status, d.status dstatus from reviews r join disputes d on d.review_id = r.id where r.id = ${d.review_id}`;
  expect(after).toMatchObject({ status: 'published', dstatus: 'rejected' });
  await login(page, 'owner@e2e-garage.ie', 'garage-owner-pass-1');
  await page.goto(`/dashboard/b/${garageId}/reviews`);
  await expect(page.getByText('The reviewer reconfirmed this review, so it stays.')).toBeVisible();
});

test('dispute → no reconfirmation by the deadline → removed by the daily job → reviewer can restore', async ({ page, request }) => {
  const [rv] = await db`insert into reviews (business_id, rating, title, experience_month, reviewer_name, reviewer_email, reviewer_email_hash, declaration_at, status, published_at, confirmed_at)
    values (${garageId}, 1, 'Never again', '2026-09-01', 'Ann', 'ann@example.ie', 'annhash', now(), 'published', now(), now()) returning id`;
  await dispute(page, 'Never again', 'conflict', 'We believe this was posted by a competitor.');
  await db`update disputes set deadline_at = now() - interval '1 minute' where review_id = ${rv.id} and status = 'open'`;
  const cron = await request.get('/api/cron/maintenance', { headers: { authorization: 'Bearer e2e-cron' } });
  expect((await cron.json()).autoRemoved).toBeGreaterThanOrEqual(1);
  const [gone] = await db`select status from reviews where id = ${rv.id}`;
  expect(gone.status).toBe('removed');
  expect(await (await request.get('/business/murphy-e2e-garage')).text()).not.toContain('Never again');
  await reconfirmByEmail(page, 'ann@example.ie');
  const [back] = await db`select status from reviews where id = ${rv.id}`;
  expect(back.status).toBe('published');
});

test('three independent visitor reports trigger the automatic reconfirmation', async ({ page }) => {
  const [rv] = await db`select r.id from reviews r join businesses b on b.id = r.business_id where b.slug = 'nolans-e2e-bakery' and r.reviewer_email = 'ciaran@example.ie'`;
  for (const ip of ['198.51.100.1', '198.51.100.2', '198.51.100.3']) {
    await page.setExtraHTTPHeaders({ 'x-forwarded-for': ip });
    await page.goto(`/business/nolans-e2e-bakery/report?review=${rv.id}`);
    await page.getByLabel('Not based on a genuine experience').check();
    await page.waitForTimeout(2600);
    await page.getByRole('button', { name: 'Send report' }).click();
    await expect(page.getByText('your report has been recorded')).toBeVisible();
  }
  const [d] = await db`select source, status from disputes where review_id = ${rv.id}`;
  expect(d).toMatchObject({ source: 'reports', status: 'open' });
  const [m] = await db`select 1 from email_outbox where to_email = 'ciaran@example.ie' and template = 'review_reconfirm'`;
  expect(m).toBeTruthy();
});
