// Plays every early-years game to the end in Chromium under the production CSP, at phone
// and desktop sizes, answering wrong first where the mechanic allows (hint, narrow,
// reveal) and checking console errors, horizontal scroll and the completion screen.
// Needs: node scripts/dev-rtt.mjs (port 4321).
// Run: PLAYWRIGHT_MODULE=$(npm root -g)/playwright/index.mjs node scripts/early-games-e2e.mjs [screenshot-dir]
import assert from 'node:assert/strict';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { ACTIVITIES, BANDS } from '../redteddytutor/early/games/content.js';
import { opt } from '../redteddytutor/early/games/engine.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const BASE = process.env.BASE || 'http://localhost:4321';
const SHOTS = process.argv[2] || null;
const ONLY = process.env.ONLY;
const browser = await chromium.launch();
const failures = [];

async function open(path, viewport) {
  const ctx = await browser.newContext({ viewport, hasTouch: viewport.width < 600 });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
  await page.goto(BASE + path);
  return { ctx, page, errors };
}
const noHScroll = async (page, where) => {
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  assert.ok(sw <= cw + 1, `${where}: horizontal scroll ${sw} > ${cw}`);
};
const clickNext = (page) => page.click('.actions .next');
const sel = (id) => `[data-id="${String(id).replace(/"/g, '\\"')}"]`;

async function play(page, a) {
  await page.click('#go');
  if (a.kind === 'explore') {
    const n = await page.locator('.card').count();
    assert.equal(n, a.items.length);
    for (let i = 0; i < n; i++) await page.locator('.card').nth(i).click();
    assert.equal(await page.locator('.cap:visible').count(), n, 'every card names itself');
    await clickNext(page);
  } else if (a.kind === 'choose') {
    for (let i = 0; i < a.questions.length; i++) {
      const ids = await page.locator('.opt').evaluateAll((els) => els.map((e) => e.dataset.id));
      const q = a.questions[Number(await page.getAttribute('#game', 'data-q'))];
      assert.deepEqual(ids.slice().sort(), q.options.map((o) => opt(o).id).sort(), 'options on screen match the question');
      assert.ok(q, `${a.id}: could not identify question ${i}`);
      if (i === 0) {
        const wrong = ids.find((x) => x !== String(q.answer));
        await page.click(`.opt${sel(wrong)}`);
        assert.ok(await page.locator(`.opt${sel(wrong)}.is-wrong`).count(), 'wrong answer marked');
        if (a.forgiving) { assert.ok(await page.locator('.opt.is-shown').count(), 'forgiving shows the answer'); await clickNext(page); continue; }
        assert.ok((await page.locator('#bubble-text').textContent()).includes(q.hint), 'hint after a miss');
        await page.click('.actions .hint');
      }
      await page.click(`.opt${sel(q.answer)}`);
      assert.ok(await page.locator(`.opt${sel(q.answer)}.is-right .mark`).textContent() === '✓', 'tick, not color alone');
      await clickNext(page);
    }
  } else if (a.kind === 'count') {
    for (const [ri, r] of a.rounds.entries()) {
      assert.equal(await page.locator('.cnt').count(), r.n);
      if (ri === 0) { await page.click(`.opt[data-id="${r.n + 1}"]`); assert.ok((await page.locator('#bubble-text').textContent()).includes('count again')); }
      for (let k = 0; k < r.n; k++) await page.locator('.cnt').nth(k).click();
      assert.equal(await page.locator('.cnt.is-counted').count(), r.n);
      await page.click(`.opt[data-id="${r.n}"]`);
      await clickNext(page);
    }
  } else if (a.kind === 'match') {
    for (const [ri, r] of a.rounds.entries()) {
      if (ri === 0) { await page.click('.m-l[data-k="0"]'); await page.click('.m-r[data-k="1"]'); assert.ok((await page.locator('#bubble-text').textContent()).length > 0); }
      for (let k = 0; k < r.length; k++) { await page.click(`.m-l[data-k="${k}"]`); await page.click(`.m-r[data-k="${k}"]`); }
      assert.equal(await page.locator('.is-paired').count(), r.length * 2);
      await clickNext(page);
    }
  } else if (a.kind === 'memory') {
    for (const r of a.rounds) {
      if (a.preview) { assert.equal(await page.locator('.mem.is-up').count(), r.length * 2, 'preview shows all'); await clickNext(page); }
      const cards = await page.locator('.mem').evaluateAll((els) => els.map((e) => e.dataset.id));
      let missed = false;
      for (const id of r) {
        const [x, y] = cards.flatMap((c, k) => (c === id ? [k] : []));
        if (!missed) { const other = cards.findIndex((c) => c !== id); await page.locator('.mem').nth(x).click(); await page.locator('.mem').nth(other).click(); missed = true; }
        await page.locator('.mem').nth(x).click(); await page.locator('.mem').nth(y).click();
      }
      assert.equal(await page.locator('.mem.is-found').count(), r.length * 2);
      await clickNext(page);
    }
  } else if (a.kind === 'sort') {
    for (const [ri, r] of a.rounds.entries()) {
      const n = r.items.length;
      for (let k = 0; k < n; k++) {
        const item = page.locator('.pool .s-item').first();
        const bin = await item.getAttribute('data-bin');
        await item.click();
        if (ri === 0 && k === 0) { const wrongBin = r.bins.find((b) => b.id !== bin).id; await page.click(`.bin[data-bin="${wrongBin}"]`); assert.equal(await page.locator('.pool .s-item').count(), n, 'wrong bin keeps the item'); }
        await page.click(`.bin[data-bin="${bin}"]`);
      }
      assert.equal(await page.locator('.bin-in .s-placed').count(), n);
      await clickNext(page);
    }
  } else if (a.kind === 'sequence') {
    for (const [ri, r] of a.rounds.entries()) {
      const ids = r.steps.map((s) => opt(s).id);
      if (ri === 0) { await page.click(`.pool .q-card${sel(ids[1])}`); assert.equal(await page.locator('.slot-in .q-card').count(), 0, 'out-of-order card is not placed'); }
      for (const id of ids) await page.click(`.pool .q-card${sel(id)}`);
      assert.equal(await page.locator('.slot-in .q-card').count(), ids.length);
      await clickNext(page);
    }
  } else if (a.kind === 'parent') {
    await page.locator('.tried').first().click();
    assert.equal(await page.locator('.tried[aria-pressed=true]').count(), 1);
    await clickNext(page);
  }
  await page.waitForSelector('.done h2');
  const back = await page.getAttribute('.done a.btn-line', 'href');
  assert.equal(back, `/early-years/games#${BANDS.find((b) => b.band === a.band).slug}`);
}

const sizes = [{ name: 'phone', width: 390, height: 844 }, { name: 'desktop', width: 1280, height: 900 }];
for (const vp of sizes) {
  // Hub
  const hub = await open('/early-years/games', vp);
  assert.equal(await hub.page.locator('.g-card').count(), ACTIVITIES.length);
  await noHScroll(hub.page, `hub ${vp.name}`);
  if (SHOTS) await hub.page.screenshot({ path: join(SHOTS, `hub-${vp.name}.png`), fullPage: false });
  assert.deepEqual(hub.errors, [], `hub errors ${hub.errors}`);
  await hub.ctx.close();
  for (const a of ACTIVITIES) {
    if (ONLY && !a.id.startsWith(ONLY)) continue;
    const { ctx, page, errors } = await open(`/early-years/games/play?a=${a.id}&seed=7`, vp);
    try {
      await noHScroll(page, `${a.id} intro ${vp.name}`);
      await play(page, a);
      await noHScroll(page, `${a.id} done ${vp.name}`);
      assert.deepEqual(errors, [], `console: ${errors.join(' | ')}`);
    } catch (e) {
      failures.push(`${vp.name} ${a.id}: ${e.message.split('\n')[0]}`);
      if (SHOTS) await page.screenshot({ path: join(SHOTS, `FAIL-${vp.name}-${a.id}.png`), fullPage: true });
    }
    await ctx.close();
  }
}
// Mid-game screenshots of each mechanic at phone size.
if (SHOTS) {
  for (const id of ['lw-meet-animals', 'lw-find-object', 'ed-sort', 'lp-count-5', 'lp-letters', 'lp-where', 'rs-add', 'rs-routines', 'rs-memory', 'ed-puzzle', 'rs-feelings', 'rs-bonds']) {
    const { ctx, page } = await open(`/early-years/games/play?a=${id}&seed=7`, sizes[0]);
    await page.click('#go');
    await page.screenshot({ path: join(SHOTS, `game-${id}.png`), fullPage: true });
    await ctx.close();
  }
}
// Keyboard: start and answer with Tab/Enter only.
{
  const { ctx, page } = await open('/early-years/games/play?a=lw-find-object&seed=3', sizes[1]);
  await page.keyboard.press('Enter');
  assert.ok(await page.locator('.opt').count(), 'Enter on the focused start button begins the game');
  await page.locator('.opt').first().focus();
  await page.keyboard.press('Enter');
  assert.ok(await page.locator('.actions .next').count(), 'Enter answers');
  await ctx.close();
}
// Unknown activity and broken image fallback.
{
  const { ctx, page } = await open('/early-years/games/play?a=nope', sizes[0]);
  assert.match(await page.locator('#game').textContent(), /does not exist/);
  await ctx.close();
}
await browser.close();
if (failures.length) { console.error(failures.join('\n')); process.exit(1); }
console.log(`early games e2e: ${ACTIVITIES.length} activities x ${sizes.length} sizes played to the end, hub, keyboard and not-found checks passed`);
