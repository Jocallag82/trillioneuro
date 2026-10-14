// Browser journeys for the free early years, in Chromium under the production CSP.
// Needs the preview server: node scripts/dev-rtt.mjs (port 4321).
// Run: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/early-e2e.mjs [screenshot-dir]
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ACTIVITIES } from '../redteddytutor/learn/js/content.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const BASE = process.env.BASE || 'http://localhost:4321';
const SHOTS = process.argv[2] || null;
const browser = await chromium.launch();

async function open(path, opts = {}) {
  const ctx = await browser.newContext(opts);
  const page = await ctx.newPage();
  const errors = [], requests = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('requestfailed', (r) => { if (!/fonts\.(googleapis|gstatic)/.test(r.url())) errors.push(`failed ${r.url()}`); });
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  page.on('request', (r) => requests.push(r.url()));
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '' }));
  await page.goto(BASE + path);
  return { ctx, page, errors, requests };
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: true }); };
const noHScroll = async (page) => {
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  assert.ok(sw <= cw + 1, `horizontal scroll: ${sw} > ${cw}`);
};
const noAI = (requests) => assert.ok(!requests.some((u) => /\/api\/|supabase|anthropic|openai|gateway/i.test(u)), 'free pages made an API call');
let n = 0;
const step = async (name, fn) => { await fn(); n++; console.log(`ok ${n} - ${name}`); };

await step('home -> age picker -> toddler page -> free activity, completed without an account (phone)', async () => {
  const { ctx, page, errors, requests } = await open('/', { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await shot(page, 'home-mobile');
  await noHScroll(page);
  await page.locator('.age-pick a', { hasText: 'Ages 2–3' }).click();
  await page.waitForURL(/\/toddler-activities$/);
  await noHScroll(page);
  await shot(page, 'toddler-mobile');
  await page.locator('#ed-find-color .ey-play').click();
  await page.waitForURL(/activity=colours-find/);
  const act = ACTIVITIES.find((a) => a.id === 'colours-find');
  for (const [i, s] of act.steps.entries()) {
    await page.waitForSelector('.option');
    const wrong = s.options.find((o) => o.id !== s.answer).id;
    if (i === 0) {
      await page.locator(`.option[data-option="${wrong}"]`).click();
      await page.waitForSelector('.fb-retry');
      assert.match(await page.locator('.fb-retry').textContent(), /\S/);
    }
    await page.locator(`.option[data-option="${s.answer}"]`).click();
    await page.waitForSelector('.fb-correct');
    const next = page.getByRole('button', { name: /^(Next|Finish|See how)/ });
    if (await next.count()) await next.first().click();
  }
  await noHScroll(page);
  assert.ok(!page.url().includes('account'), 'never sent to sign-in');
  noAI(requests);
  assert.deepEqual(errors, []);
  await ctx.close();
});

await step('every early-years page loads clean, with one h1, canonical and working anchors', async () => {
  for (const p of ['/early-years', '/little-world', '/toddler-activities', '/preschool-activities', '/pre-k-kindergarten-readiness', '/learning-colors-for-toddlers', '/counting-activities-for-preschoolers', '/letter-sounds-activities', '/shapes-activities-for-toddlers', '/rhyming-activities-for-kids', '/first-words-activities-for-babies']) {
    {
      const r = await fetch(`${BASE}/early/printables/little-world.pdf`); assert.equal(r.status, 200);
    }
    const { ctx, page, errors, requests } = await open(p);
    assert.equal(await page.locator('h1').count(), 1, p);
    assert.equal(await page.locator('link[rel=canonical]').getAttribute('href'), `https://www.redteddytutor.com${p}`);
    await page.evaluate(() => Promise.all([...document.images].map((i) => { i.loading = 'eager'; return i.complete ? 0 : new Promise((r) => { i.onload = i.onerror = r; }); })));
    for (const img of await page.locator('img').all()) assert.ok(await img.evaluate((i) => i.complete && i.naturalWidth > 0), `${p} broken image`);
    for (const a of await page.locator('a[href^="#"]').all()) {
      const id = (await a.getAttribute('href')).slice(1);
      if (id) assert.equal(await page.locator(`[id="${id}"]`).count(), 1, `${p} #${id}`);
    }
    noAI(requests);
    assert.deepEqual(errors, [], p);
    await shot(page, p.slice(1));
    await ctx.close();
  }
});

await step('Little World cards: keyboard only, six pictures, then off-screen play; reduced motion respected', async () => {
  const { ctx, page, errors, requests } = await open('/little-world/play', { reducedMotion: 'reduce', viewport: { width: 768, height: 1024 } });
  await page.waitForSelector('.look-card');
  for (let i = 0; i < 6; i++) {
    await page.locator('.look-card').focus();
    await page.keyboard.press('Enter');
    await page.waitForSelector('.look-word:not([hidden])');
    assert.equal(await page.locator('.look-art').evaluate((e) => getComputedStyle(e).animationName), 'none');
    await page.locator('.look-next').focus();
    await page.keyboard.press('Enter');
  }
  await page.waitForSelector('.look-done');
  assert.match(await page.locator('.look-done').textContent(), /play for real/);
  await shot(page, 'little-world-done');
  noAI(requests);
  assert.deepEqual(errors, []);
  await ctx.close();
});

await step('school-age journey and plans still reachable from the home page', async () => {
  const { ctx, page, errors } = await open('/');
  await page.locator('.age-pick a', { hasText: 'Grades K–12' }).click();
  await page.waitForURL(/\/learn\/$/);
  await page.waitForSelector('.grade-card, .band-card');
  await page.goto(BASE + '/');
  await page.locator('a[href="#plans"]').first().click();
  assert.ok(await page.locator('#plans').isVisible());
  assert.deepEqual(errors.filter((e) => !/\/api\//.test(e)), []);
  await ctx.close();
});

await browser.close();
console.log(`${n} early-years journeys passed`);
