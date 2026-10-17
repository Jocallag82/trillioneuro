import { test, expect } from '@playwright/test';

for (const p of ['/', '/search?q=bakery', '/business/nolans-e2e-bakery', '/business/nolans-e2e-bakery/review', '/for-business', '/privacy', '/register', '/categories']) {
  test(`mobile layout has no horizontal scroll: ${p}`, async ({ page }) => {
    await page.goto(p);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('mobile menu opens and navigates', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name: 'For businesses' }).click();
  await expect(page).toHaveURL(/\/for-business/);
});
