// Browser test of Teddy's Bakery. Drives the real game in Chromium.
// Run: PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs node scripts/game-e2e.mjs
// (Playwright must be installed separately; this repository does not depend on it.)
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'redteddytutor');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.mp3': 'audio/mpeg' };
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');

// Game logic, imported so the test knows each round's correct answer.
const G = pathToFileURL(join(ROOT, 'learn/game/js')).href;
const { LEVELS, BOSS, PASS_MARK, makeRound } = await import(`${G}/curriculum.js`);
const { mulberry32 } = await import(`${G}/rng.js`);
const { tierForSkill, adjustForSession } = await import(`${G}/mastery.js`);

// The same Content-Security-Policy that production serves, so the game is tested under it.
const vercel = JSON.parse(await readFile(join(ROOT, '..', 'vercel.json'), 'utf8'));
const CSP = vercel.routes.find((r) => r.headers?.['Content-Security-Policy'])?.headers['Content-Security-Policy'];

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p.endsWith('/')) p += 'index.html';
  try {
    const body = await readFile(join(ROOT, normalize(p.replace(/^\/+/, '/'))));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream', 'Content-Security-Policy': CSP });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;

// The rounds a session will show, given what the child did. behaviour: 'ok' | 'wrong-then-ok' | 'reveal'.
function plannedSession(plan, seed, startSteps, behaviours) {
  const rng = mulberry32(seed);
  const steps = [...startSteps];
  let consecutive = 0;
  return behaviours.map((behaviour, i) => {
    const kind = plan[i];
    const skill = LEVELS.find((l) => l.kind === kind)?.skill ?? 'number-names';
    const tier = adjustForSession(tierForSkill(steps, skill), consecutive);
    const round = makeRound(kind, tier, rng);
    const firstTry = behaviour === 'ok';
    steps.push({ skill, firstTry });
    consecutive = firstTry ? 0 : consecutive + 1;
    return { round, behaviour };
  });
}

async function openGame(browser, { viewport, reducedMotion = 'no-preference', seed = 12345, storage = null } = {}) {
  const ctx = await browser.newContext({ viewport: viewport ?? { width: 1280, height: 860 }, reducedMotion });
  // Web fonts are cosmetic and outside the app; serve them empty so tests run offline.
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/GL Driver|ERR_FAILED/.test(m.text())) errors.push(m.text()); });
  if (storage) await ctx.addInitScript((s) => { if (!localStorage.getItem('rtt.learn.v1')) localStorage.setItem('rtt.learn.v1', s); }, storage);
  await page.goto(`${BASE}/learn/game/?seed=${seed}`);
  await page.waitForSelector('#g-stage canvas', { timeout: 15000 });
  await page.waitForSelector('#g-choices button, #g-actions button');
  return { ctx, page, errors };
}

const readSteps = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('rtt.learn.v1') || '{"steps":[],"sessions":[]}'));
const view = (page) => page.locator('#game-root').getAttribute('data-view');
const choiceFor = (page, value) => page.locator(`#g-choices button[data-choice="${value}"]`);

// Answers one round the way the scripted behaviour says.
async function playRound(page, planned, index) {
  const { round, behaviour } = planned;
  await page.waitForFunction((i) => document.querySelector('#game-root').dataset.index === String(i), index);
  const wrong = round.options.filter((o) => String(o) !== String(round.answer));
  if (behaviour === 'wrong-then-ok') {
    await choiceFor(page, wrong[0]).click();
    await page.waitForSelector('.g-hint:not(:empty)');
    const hintText = await page.locator('#g-hint-text').textContent();
    assert.match(hintText, /^Hint: /, 'a wrong answer shows a hint');
  }
  if (behaviour === 'reveal') {
    for (let k = 0; k < 3; k++) {
      await choiceFor(page, wrong[k % wrong.length]).click();
      await page.waitForTimeout(120);
    }
    await page.waitForFunction(() => /The answer is/.test(document.querySelector('#g-feedback').textContent));
    return;
  }
  await choiceFor(page, round.answer).click();
  await page.waitForFunction(() => /right|Well done|Nice work/.test(document.querySelector('#g-feedback').textContent));
}

// Plays one whole level with the given behaviours, from the game's own round sequence.
async function playLevel(page, level, behaviours, seed) {
  const start = await readSteps(page);
  const plan = Array.from({ length: behaviours.length }, () => level.kind);
  const planned = plannedSession(plan, seed, start.steps, behaviours);
  await choiceFor(page, level.id).click().catch(async () => {
    await page.locator(`#g-actions button[data-action="map"]`).click();
    await choiceFor(page, level.id).click();
  });
  for (let i = 0; i < planned.length; i++) {
    if (level.kind === 'shape' && planned[i].behaviour === 'ok' && i === 0) {
      await dragShape(page, planned[i].round);
    } else {
      await playRound(page, planned[i], i);
    }
    if (i < planned.length - 1) await page.waitForFunction((n) => document.querySelector('#game-root').dataset.index === String(n), i + 1, { timeout: 6000 });
  }
  await page.waitForFunction(() => ['result', 'ending'].includes(document.querySelector('#game-root').dataset.view), null, { timeout: 8000 });
  return planned;
}

// Drags the cake to the matching hole on the canvas.
async function dragShape(page, round) {
  const box = await page.locator('#g-stage canvas').boundingBox();
  const sx = (gx) => box.x + (gx * box.width) / 960;
  const sy = (gy) => box.y + (gy * box.height) / 600;
  const holes = round.data.holes;
  // Same layout as BakeryScene.drawShape.
  const spacing = 680 / holes.length;
  const startX = 250 + spacing / 2;
  const idx = holes.indexOf(round.answer);
  const hx = startX + idx * spacing;
  await page.mouse.move(sx(585), sy(468));
  await page.mouse.down();
  await page.mouse.move(sx(hx), sy(230), { steps: 12 });
  await page.mouse.up();
}

const results = [];
const check = async (name, fn) => {
  try { await fn(); results.push(['PASS', name]); }
  catch (e) { results.push(['FAIL', name, e.message.split('\n')[0]]); }
};

const browser = await chromium.launch({ args: ['--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const SEED = 12345;

// ---- 1. Full game: every level, retries, hints, pass gates, boss and ending ----
let fullRun;
await check('first visit shows the map with only the first sign open', async () => {
  fullRun = await openGame(browser, { seed: SEED });
  const labels = await fullRun.page.locator('#g-choices button').allTextContents();
  assert.deepEqual(labels, ['Counting Cakes']);
  assert.equal(await view(fullRun.page), 'map');
});

await check('level 1: wrong answer gives a hint and the child can retry; pass with 4 of 5 first time', async () => {
  const { page } = fullRun;
  await playLevel(page, LEVELS[0], ['wrong-then-ok', 'ok', 'ok', 'ok', 'ok'], SEED);
  assert.equal(await view(page), 'result');
  assert.match(await page.locator('#g-prompt').textContent(), /Sign finished|Next up/);
  const steps = (await readSteps(page)).sessions.find((s) => s.activityId === LEVELS[0].id);
  assert.equal(steps.correctFirst, 4);
});

await check('level 2 unlocks after the pass and can be played', async () => {
  const { page } = fullRun;
  await page.locator('#g-actions button[data-action="map"]').click();
  assert.ok(await choiceFor(page, LEVELS[1].id).count(), 'level 2 is now on the map');
  await playLevel(page, LEVELS[1], ['ok', 'ok', 'ok', 'ok', 'ok'], SEED);
  const s = (await readSteps(page)).sessions.find((x) => x.activityId === LEVELS[1].id);
  assert.equal(s.correctFirst, 5);
});

await check('level 3 (shape delivery): drag to a wrong hole, then to the right one', async () => {
  const { page } = fullRun;
  await page.locator('#g-actions button[data-action="map"]').click();
  await choiceFor(page, LEVELS[2].id).click();
  await page.waitForFunction(() => document.querySelector('#game-root').dataset.view === 'round');
  const start = await readSteps(page);
  const planned = plannedSession(Array(5).fill('shape'), SEED, start.steps, ['ok', 'ok', 'ok', 'ok', 'ok']);
  const round = planned[0].round;
  // A wrong drop first: the first hole that is not the answer.
  const wrongHole = round.data.holes.find((h) => h !== round.answer);
  if (wrongHole) {
    const box = await page.locator('#g-stage canvas').boundingBox();
    const holes = round.data.holes;
    const spacing = 680 / holes.length;
    const startX = 250 + spacing / 2;
    const hx = startX + holes.indexOf(wrongHole) * spacing;
    await page.mouse.move(box.x + (585 * box.width) / 960, box.y + (468 * box.height) / 600);
    await page.mouse.down();
    await page.mouse.move(box.x + (hx * box.width) / 960, box.y + (230 * box.height) / 600, { steps: 10 });
    await page.mouse.up();
    await page.waitForSelector('.g-hint:not(:empty)', { timeout: 5000 });
  }
  await dragShape(page, round);
  await page.waitForFunction(() => /right|Well done|Nice work/.test(document.querySelector('#g-feedback').textContent), null, { timeout: 5000 });
  // The rest of the level by the DOM buttons, which are the same answers.
  for (let i = 1; i < planned.length; i++) {
    await page.waitForFunction((n) => document.querySelector('#game-root').dataset.index === String(n), i, { timeout: 6000 });
    await choiceFor(page, planned[i].round.answer).click();
    await page.waitForFunction(() => /right|Well done|Nice work/.test(document.querySelector('#g-feedback').textContent));
  }
  await page.waitForFunction(() => document.querySelector('#game-root').dataset.view === 'result', null, { timeout: 8000 });
});

await check('level 4 (pattern oven) plays through', async () => {
  const { page } = fullRun;
  await page.locator('#g-actions button[data-action="map"]').click();
  await playLevel(page, LEVELS[3], ['ok', 'ok', 'ok', 'ok', 'ok'], SEED);
});

await check('grand opening unlocks after all four signs and ends with a summary', async () => {
  const { page, errors } = fullRun;
  await page.locator('#g-actions button[data-action="map"]').click();
  await choiceFor(page, BOSS.id).click();
  await page.waitForFunction(() => document.querySelector('#game-root').dataset.view === 'round');
  const start = await readSteps(page);
  const plan = ['count', 'compare', 'shape', 'pattern', 'count', 'compare'];
  const planned = plannedSession(plan, SEED, start.steps, Array(6).fill('ok'));
  for (let i = 0; i < 6; i++) {
    await page.waitForFunction((n) => document.querySelector('#game-root').dataset.index === String(n), i, { timeout: 6000 });
    const r = planned[i].round;
    if (r.kind === 'shape') await dragShape(page, r);
    else await choiceFor(page, r.answer).click();
    await page.waitForFunction(() => /right|Well done|Nice work/.test(document.querySelector('#g-feedback').textContent), null, { timeout: 6000 });
  }
  await page.waitForFunction(() => document.querySelector('#game-root').dataset.view === 'ending', null, { timeout: 8000 });
  assert.match(await page.locator('#g-prompt').textContent(), /bakery is open/);
  assert.deepEqual(errors, [], 'no page errors during the full run');
});

await check('progress persists: after reload the map shows every sign with stars', async () => {
  const { page, ctx } = fullRun;
  const saved = await readSteps(page);
  assert.equal(saved.sessions.length, 5, 'four signs and the grand opening are recorded');
  assert.equal(saved.steps.length, 5 + 5 + 5 + 5 + 6, 'one step per round, no duplicates');
  await page.reload();
  await page.waitForSelector('#g-stage canvas');
  await page.waitForSelector('#g-choices button');
  assert.ok((await page.locator('#g-choices button').allTextContents()).includes('Grand Opening'));
  await ctx.close();
});

// ---- 2. Failure, retry and recovery ----
await check('failure: three rounds revealed gives a gentle try-again state, then a pass on retry', async () => {
  const run = await openGame(browser, { seed: 777 });
  const { page, ctx } = run;
  await playLevel(page, LEVELS[0], ['reveal', 'reveal', 'reveal', 'ok', 'ok'], 777);
  assert.equal(await view(page), 'result');
  assert.match(await page.locator('#g-prompt').textContent(), /try this sign again/);
  assert.ok(await page.locator('#g-actions button', { hasText: 'Try again' }).count(), 'a retry button is offered');
  await page.locator('#g-actions button', { hasText: 'Try again' }).click();
  await page.waitForFunction(() => document.querySelector('#game-root').dataset.view === 'round');
  const steps = await readSteps(page);
  const planned = plannedSession(Array(5).fill('count'), 777, steps.steps, ['ok', 'ok', 'ok', 'ok', 'ok']);
  for (let i = 0; i < 5; i++) {
    await page.waitForFunction((n) => document.querySelector('#game-root').dataset.index === String(n), i, { timeout: 6000 });
    await choiceFor(page, planned[i].round.answer).click();
    await page.waitForFunction(() => /right|Well done|Nice work/.test(document.querySelector('#g-feedback').textContent), null, { timeout: 6000 });
  }
  await page.waitForFunction(() => document.querySelector('#game-root').dataset.view === 'result', null, { timeout: 8000 });
  assert.match(await page.locator('#g-prompt').textContent(), /Sign finished|Next up/);
  await ctx.close();
});

await check('the boss sign stays locked until every sign is passed', async () => {
  const run = await openGame(browser, { seed: 9 });
  assert.ok(!(await run.page.locator('#g-choices button', { hasText: 'Grand Opening' }).count()));
  await run.ctx.close();
});

// ---- 3. Mobile, tablet and reduced motion ----
for (const [name, vp] of [['phone 390x844', { width: 390, height: 844 }], ['tablet 834x1112', { width: 834, height: 1112 }]]) {
  await check(`layout fits without horizontal scroll on ${name}`, async () => {
    const { page, ctx } = await openGame(browser, { viewport: vp });
    const scroll = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth);
    assert.equal(scroll, false);
    const canvasBox = await page.locator('#g-stage canvas').boundingBox();
    assert.ok(canvasBox.width > 300, 'the scene scales to the screen');
    const btn = await page.locator('#g-choices button').first().boundingBox();
    assert.ok(btn.height >= 56, 'answer buttons are large enough to tap');
    await ctx.close();
  });
}

await check('reduced motion starts with calm motion on and still plays', async () => {
  const { page, ctx, errors } = await openGame(browser, { reducedMotion: 'reduce' });
  assert.equal(await page.locator('#g-calm').isChecked(), true);
  await choiceFor(page, LEVELS[0].id).click();
  await page.waitForFunction(() => document.querySelector('#game-root').dataset.view === 'round');
  assert.deepEqual(errors, []);
  await ctx.close();
});

await check('sound can be switched off and the choice is remembered', async () => {
  const { page, ctx } = await openGame(browser);
  await page.locator('#g-sound').click();
  assert.equal(await page.locator('#g-sound').getAttribute('aria-pressed'), 'false');
  const saved = await readSteps(page);
  assert.equal(saved.settings.audio, false);
  await ctx.close();
});

// ---- 4. Error handling ----
await check('if the game engine fails to load, the page says so instead of breaking', async () => {
  const ctx = await browser.newContext({ viewport: { width: 1000, height: 800 } });
  // Web fonts are cosmetic and outside the app; serve them empty so tests run offline.
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  const page = await ctx.newPage();
  await page.route('**/vendor/phaser-3.90.0.min.js', (r) => r.abort());
  await page.goto(`${BASE}/learn/game/`);
  await page.waitForFunction(() => document.querySelector('#g-notice').textContent.length > 0, null, { timeout: 8000 });
  assert.match(await page.locator('#g-notice').textContent(), /engine did not load/);
  await ctx.close();
});

await check('leaving the page releases the canvas and listeners (no stacked canvases on revisit)', async () => {
  const { page, ctx } = await openGame(browser);
  assert.equal(await page.locator('#g-stage canvas').count(), 1);
  await page.goto(`${BASE}/learn/game/?seed=1`);
  await page.waitForSelector('#g-stage canvas');
  assert.equal(await page.locator('#g-stage canvas').count(), 1);
  await ctx.close();
});

await browser.close();
server.close();
for (const [s, n, e] of results) console.log(s, n, e ? `(${e})` : '');
const passed = results.filter((r) => r[0] === 'PASS').length;
console.log(`${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
