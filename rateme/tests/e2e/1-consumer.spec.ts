import { test, expect } from '@playwright/test';
import { db, emailLink, fillReview, publishedBusiness } from './helpers';

test.describe.configure({ mode: 'serial' });
let bakeryId = '';

test.beforeAll(async () => { bakeryId = await publishedBusiness('Nolan’s E2E Bakery', 'nolans-e2e-bakery'); });

test('find a business, rate it, confirm by email and see it published', async ({ page }) => {
  await page.goto('/');
  await page.getByPlaceholder(/Business name or service/).fill('nolans bakery'); // no apostrophe, approximate
  await page.getByRole('button', { name: 'Search' }).click();
  await expect(page).toHaveURL(/\/search\?/);
  await page.getByRole('link', { name: /Nolan’s E2E Bakery/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Nolan’s E2E Bakery');
  await expect(page.getByText('No published ratings yet')).toBeVisible();
  await expect(page.getByText('Unclaimed listing')).toBeVisible();

  await page.getByRole('link', { name: 'Rate your experience' }).click();
  await expect(page.getByText('You’re rating')).toBeVisible();
  // No default rating: submitting without stars is rejected
  await expect(page.getByRole('radio', { checked: true })).toHaveCount(0);
  await fillReview(page, { stars: 4, title: 'Great sourdough', body: 'Lovely bread and friendly staff. Queue was long on Saturday.', name: 'Aoife B.', email: 'aoife@example.ie' });
  await expect(page.getByRole('heading', { name: /Check your email/ })).toBeVisible();

  // Not public until confirmed
  await page.goto('/business/nolans-e2e-bakery');
  await expect(page.getByText('Great sourdough')).toHaveCount(0);

  const link = await emailLink('aoife@example.ie', 'review_confirm');
  await page.goto(link);
  await page.getByRole('button', { name: 'Yes, publish my review' }).click();
  await expect(page.getByText('your review is now published')).toBeVisible();
  await page.getByRole('link', { name: 'View the business' }).click();
  await expect(page.getByText('Great sourdough')).toBeVisible();
  await expect(page.getByText('4.0').first()).toBeVisible();
  await expect(page.getByText('1 published rating')).toBeVisible();
  // email never shown
  await expect(page.locator('body')).not.toContainText('aoife@example.ie');
  // confirmation link is single-use
  await page.goto(link);
  await page.getByRole('button', { name: 'Yes, publish my review' }).click();
  await expect(page.getByText(/expired or has already been used/)).toBeVisible();
});

test('negative reviews follow exactly the same path (no review gating)', async ({ page }) => {
  await page.goto('/business/nolans-e2e-bakery/review');
  await fillReview(page, { stars: 1, title: 'Burnt and overpriced', body: 'My order was burnt and they would not replace it.', name: 'Ciarán', email: 'ciaran@example.ie' });
  await expect(page.getByRole('heading', { name: /Check your email/ })).toBeVisible();
  await page.goto(await emailLink('ciaran@example.ie', 'review_confirm'));
  await page.getByRole('button', { name: 'Yes, publish my review' }).click();
  await expect(page.getByText('your review is now published')).toBeVisible();
  await page.goto('/business/nolans-e2e-bakery');
  await expect(page.getByText('Burnt and overpriced')).toBeVisible();
  await expect(page.getByText('2.5').first()).toBeVisible();
  const [b] = await db`select rating_count, rating_avg::text from businesses where id = ${bakeryId}`;
  expect(b).toMatchObject({ rating_count: 2, rating_avg: '2.50' });
});

test('one review per person per business', async ({ page }) => {
  await page.goto('/business/nolans-e2e-bakery/review');
  await fillReview(page, { stars: 5, name: 'Aoife again', email: 'AOIFE@example.ie' });
  await expect(page.getByText(/already reviewed this business/)).toBeVisible();
});

test('reviews containing personal information are held for a moderator', async ({ page }) => {
  await page.goto('/business/nolans-e2e-bakery/review');
  await fillReview(page, { stars: 5, title: 'Ask for Mary', body: 'Call Mary on 087 123 4567, she is great', name: 'Pat', email: 'pat@example.ie' });
  await page.goto(await emailLink('pat@example.ie', 'review_confirm'));
  await page.getByRole('button', { name: 'Yes, publish my review' }).click();
  await expect(page.getByText(/moderator is checking it/)).toBeVisible();
  await page.goto('/business/nolans-e2e-bakery');
  await expect(page.getByText('Ask for Mary')).toHaveCount(0);
  const [r] = await db`select status, hold_reasons from reviews where reviewer_email = 'pat@example.ie'`;
  expect(r.status).toBe('held');
  expect(r.hold_reasons).toContain('contact_details');
});

test('reviewer can manage and withdraw their review', async ({ page }) => {
  await page.goto(await emailLink('pat@example.ie', 'review_status'));
  await expect(page.getByText('Being checked by a moderator')).toBeVisible();
  await page.getByRole('button', { name: 'Withdraw review' }).click();
  await expect(page.getByText('has been withdrawn')).toBeVisible();
});

test('report a problematic review', async ({ page }) => {
  await page.goto('/business/nolans-e2e-bakery');
  await page.getByRole('link', { name: 'Report this review' }).first().click();
  await expect(page.getByRole('heading', { name: 'Report a review' })).toBeVisible();
  await page.getByLabel('Contains personal or private information').check();
  await page.getByLabel(/Details/).fill('Mentions a staff member by full name.');
  await page.waitForTimeout(2600);
  await page.getByRole('button', { name: 'Send report' }).click();
  await expect(page.getByText('your report has been sent')).toBeVisible();
  const [r] = await db`select count(*)::int n from reports where kind = 'review' and reason = 'personal_info'`;
  expect(r.n).toBe(1);
  // Reporting does not remove the review
  const [{ n }] = await db`select count(*)::int n from reviews where business_id = ${bakeryId} and status = 'published'`;
  expect(n).toBe(2);
});

test('suggest a missing business (goes to moderation, not live)', async ({ page }) => {
  await page.goto('/search?q=zzz-no-such-place');
  await expect(page.getByText('We couldn’t find that business yet')).toBeVisible();
  await page.goto('/add-business');
  await page.getByLabel('Business name').fill('Hypothetical Hardware Kilkenny');
  await page.getByLabel('Category').selectOption({ label: 'Hardware & DIY' });
  await page.getByLabel(/^County/).selectOption({ label: 'Co. Kilkenny' });
  await page.waitForTimeout(2600);
  await page.getByRole('button', { name: 'Suggest this business' }).click();
  await expect(page.getByText('Thanks — we’ll check it')).toBeVisible();
  const [b] = await db`select status, source from businesses where name = 'Hypothetical Hardware Kilkenny'`;
  expect(b).toMatchObject({ status: 'pending', source: 'community' });
});
