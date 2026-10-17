import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const PUBLIC = ['/', '/search?q=bakery', '/categories', '/categories/restaurants-cafes', '/counties', '/county/kilkenny', '/business/nolans-e2e-bakery',
  '/business/nolans-e2e-bakery/review', '/for-business', '/how-it-works', '/review-policy', '/privacy', '/terms', '/cookies', '/membership-terms',
  '/contact', '/data-request', '/add-business', '/login', '/register'];

test('no serious accessibility violations on public pages', async ({ page }) => {
  const problems: string[] = [];
  for (const p of PUBLIC) {
    await page.goto(p);
    const r = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze();
    for (const v of r.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')) problems.push(`${p}: ${v.id} (${v.nodes.length}) ${v.nodes[0]?.target}`);
  }
  expect(problems).toEqual([]);
});

test('no browser console errors on public pages', async ({ page }) => {
  const errors: string[] = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`${page.url()}: ${m.text()}`); });
  page.on('pageerror', (e) => errors.push(`${page.url()}: ${e.message}`));
  for (const p of PUBLIC) await page.goto(p, { waitUntil: 'networkidle' });
  expect(errors).toEqual([]);
});

test('no broken internal links from public pages', async ({ page, request }) => {
  const seen = new Set<string>();
  for (const p of PUBLIC) {
    await page.goto(p);
    const hrefs = await page.$$eval('a[href^="/"]', (as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href')!));
    hrefs.forEach((h) => seen.add(h.split('#')[0]));
  }
  const broken: string[] = [];
  for (const h of seen) {
    if (!h || h.startsWith('/api/')) continue;
    const r = await request.get(h, { maxRedirects: 5 });
    if (r.status() >= 400) broken.push(`${h} → ${r.status()}`);
  }
  expect(broken).toEqual([]);
});

test('SEO metadata: unique titles, canonicals, structured data only with real ratings', async ({ page, request }) => {
  const titles = new Map<string, string>();
  for (const p of ['/', '/categories', '/for-business', '/how-it-works', '/business/nolans-e2e-bakery', '/business/murphy-e2e-garage']) {
    await page.goto(p);
    const t = await page.title();
    expect(titles.has(t), `duplicate title ${t}`).toBe(false);
    titles.set(t, p);
    expect(await page.locator('meta[name="description"]').getAttribute('content')).toBeTruthy();
    expect(await page.locator('link[rel="canonical"]').getAttribute('href')).toBeTruthy();
  }
  await page.goto('/business/nolans-e2e-bakery');
  const ld = JSON.parse((await page.locator('script[type="application/ld+json"]').textContent())!);
  expect(ld['@type']).toBe('LocalBusiness');
  expect(ld.aggregateRating.reviewCount).toBe(2);
  const sitemap = await (await request.get('/sitemap.xml')).text();
  expect(sitemap).toContain('/business/nolans-e2e-bakery');
  expect(sitemap).not.toContain('/dashboard');
  expect(sitemap).not.toContain('hypothetical-hardware'); // pending listings excluded
  // thin category pages are noindex
  await page.goto('/categories/automotive');
  expect(await page.locator('meta[name="robots"]').getAttribute('content')).toContain('noindex');
  // unknown pages return a real 404
  expect((await request.get('/business/does-not-exist')).status()).toBe(404);
});

