import { test, expect } from '@playwright/test';

for (const p of ['/how-it-works', '/', '/search?q=bakery', '/business/nolans-e2e-bakery', '/business/nolans-e2e-bakery/review', '/for-business', '/privacy', '/register', '/categories']) {
  test(`mobile layout has no horizontal scroll: ${p}`, async ({ page }) => {
    await page.goto(p);
    // Compare with the device width: on mobile emulation innerWidth grows to fit overflowing content.
    const width = page.viewportSize()!.width;
    const overflow = await page.evaluate((w) => document.documentElement.scrollWidth - w, width);
    expect(overflow).toBeLessThanOrEqual(0);
  });
}

test('mobile menu opens and navigates', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('navigation', { name: 'Mobile' }).getByRole('link', { name: 'For businesses' }).click();
  await expect(page).toHaveURL(/\/for-business/);
});
