// Browser tests of the learner app and parent view, in Chromium under the production CSP.
// Run: PLAYWRIGHT_MODULE=/path/to/node_modules/playwright/index.mjs node scripts/learn-e2e.mjs [screenshot-dir]
// Supabase and the AI gateway are never contacted: signed-in journeys use a faked
// Supabase REST API, and the tutor endpoint is the real handler with the network mocked.
import { createServer } from 'node:http';
import { readFile, mkdir } from 'node:fs/promises';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', 'redteddytutor');
const SHOTS = process.argv[2] || null;
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.mp3': 'audio/mpeg', '.json': 'application/json' };
const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const vercel = JSON.parse(await readFile(join(HERE, '..', 'vercel.json'), 'utf8'));
const CSP = vercel.routes.find((r) => r.headers?.['Content-Security-Policy'])?.headers['Content-Security-Policy'];

const server = createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (p === '/api/rtt-tutor') {
    // The deployed function is exercised in scripts/tutor.test.mjs; here the browser
    // side is tested against fixed replies so the UI can be checked deterministically.
    let body = '';
    for await (const c of req) body += c;
    const auth = req.headers.authorization || '';
    res.writeHead(auth ? 200 : 401, { 'content-type': 'application/json' });
    if (!auth) return res.end(JSON.stringify({ ok: false, reason: 'signed-out' }));
    const data = JSON.parse(body);
    if (data.mode === 'check') return res.end(JSON.stringify({ ok: true, type: 'question', reply: 'Good. One more to be sure:', followUp: 'What is 6 + 7?' }));
    return res.end(JSON.stringify({ ok: true, type: 'hint', reply: `Think about the ones first. (${data.mode})`, followUp: null }));
  }
  if (p === '/') p = '/index.html';
  if (p.endsWith('/')) p += 'index.html';
  try {
    const body = await readFile(join(ROOT, normalize(p.replace(/^\/+/, '/'))));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream', 'Content-Security-Policy': CSP });
    res.end(body);
  } catch { res.writeHead(404); res.end('not found'); }
});
await new Promise((r) => server.listen(0, r));
const BASE = `http://localhost:${server.address().port}`;
if (SHOTS) await mkdir(SHOTS, { recursive: true });

const browser = await chromium.launch();
const results = [];
async function check(name, fn) {
  try { await fn(); results.push([true, name]); console.log(`PASS ${name}`); }
  catch (e) { results.push([false, name]); console.log(`FAIL ${name}\n     ${e.message.split('\n').slice(0, 6).join('\n     ')}`); }
}

async function open(path, { viewport = { width: 1280, height: 900 }, storage = null, signedIn = false, colorScheme = 'light' } = {}) {
  const ctx = await browser.newContext({ viewport, colorScheme, locale: 'en-GB' });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/favicon|ERR_FAILED|401/.test(m.text())) errors.push(m.text()); });
  if (storage) await ctx.addInitScript((s) => { if (!sessionStorage.getItem('seeded')) { localStorage.setItem('rtt.learn.v1', s); sessionStorage.setItem('seeded', '1'); } }, JSON.stringify(storage));
  const db = { attempts: [], sessions: [], patches: [] };
  if (signedIn) {
    await ctx.addInitScript(() => {
      localStorage.setItem('rtt.auth.v1', JSON.stringify({ access_token: 'tok', refresh_token: 'r', expires_at: Date.now() + 3600e3, user: { id: 'u1', email: 'p@example.com' } }));
      localStorage.setItem('rtt.activeProfile.v1', JSON.stringify('3f1c2a4e-1111-4222-8333-444455556666'));
    });
    await page.route('https://kxzywyflylkcqoidiqmo.supabase.co/**', async (route) => {
      const url = new URL(route.request().url());
      const method = route.request().method();
      const json = (d, s = 200) => route.fulfill({ status: s, contentType: 'application/json', body: JSON.stringify(d) });
      if (url.pathname.endsWith('/rtt_profiles') && method === 'GET') return json([{ id: '3f1c2a4e-1111-4222-8333-444455556666', nickname: 'Sam', age_band: '7-9', locale: 'en-IE', settings: { onboarded: true, focus: 'maths' } }]);
      if (url.pathname.endsWith('/rtt_profiles') && method === 'PATCH') { db.patches.push(JSON.parse(route.request().postData())); return route.fulfill({ status: 204 }); }
      if (url.pathname.endsWith('/rtt_attempts') && method === 'GET') return json(db.attempts);
      if (url.pathname.endsWith('/rtt_sessions') && method === 'GET') return json(db.sessions);
      if (url.pathname.endsWith('/rtt_attempts') && method === 'POST') { db.attempts.push({ ...JSON.parse(route.request().postData()), created_at: new Date().toISOString() }); return route.fulfill({ status: 201 }); }
      if (url.pathname.endsWith('/rtt_sessions') && method === 'POST') { db.sessions.push({ ...JSON.parse(route.request().postData()), created_at: new Date().toISOString() }); return route.fulfill({ status: 201 }); }
      return json({ message: 'unexpected' }, 404);
    });
  }
  await page.goto(`${BASE}${path}`);
  return { ctx, page, errors, db };
}

const readState = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('rtt.learn.v1') || 'null'));
const noHScroll = async (page) => {
  const [sw, cw] = await page.evaluate(() => [document.documentElement.scrollWidth, document.documentElement.clientWidth]);
  assert.ok(sw <= cw + 1, `horizontal scroll: ${sw} > ${cw}`);
};
const shot = async (page, name, full = true) => { if (SHOTS) await page.screenshot({ path: join(SHOTS, `${name}.png`), fullPage: full }); };

// Works out the right answer from what is on screen, for the step kinds used below.
async function solve(page) {
  const prompt = (await page.locator('.prompt').textContent()).trim();
  let m;
  if (await page.locator('.line-slider').count()) {
    m = prompt.match(/marker on (\d+)(?:\/(\d+))?/);
    const slider = page.locator('.line-slider');
    await slider.focus();
    await page.keyboard.press('Home');
    for (let i = 0; i < Number(m[1]); i++) await page.keyboard.press('ArrowRight');
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    return;
  }
  if (await page.locator('.build-wrap').count()) {
    m = prompt.match(/(?:Put (\d+) counters)|(?:There are (\d+) counters)/);
    const target = m[1] ? Number(m[1]) : 10;
    const now = Number(await page.locator('.line-value').textContent());
    for (let i = now; i < target; i++) await page.locator('.build-plus').click();
    await page.getByRole('button', { name: 'Check', exact: true }).click();
    return;
  }
  if (await page.locator('.order-wrap').count()) {
    const word = prompt.match(/Build the word “(\w+)”/)?.[1];
    const tiles = await page.locator('.order-tray .tile-btn').allTextContents();
    const order = word ? word.split('') : [...tiles].map(Number).sort((a, b) => (/biggest/.test(prompt) ? b - a : a - b)).map(String);
    for (const label of order) await page.locator('.order-tray .tile-btn', { hasText: new RegExp(`^${label}$`) }).first().click();
    await page.locator('#order-check').click();
    return;
  }
  if ((m = prompt.match(/^(\d+) ([+−]) (\d+) = \?$/))) {
    const v = m[2] === '+' ? Number(m[1]) + Number(m[3]) : Number(m[1]) - Number(m[3]);
    if (await page.locator('#answer').count()) { await page.fill('#answer', String(v)); await page.getByRole('button', { name: 'Check', exact: true }).click(); }
    else await page.locator(`.option[data-option="${v}"]`).click();
    return;
  }
  if ((m = prompt.match(/^(\d+) \+ \? = (\d+)$/))) {
    const v = Number(m[2]) - Number(m[1]);
    if (await page.locator('#answer').count()) { await page.fill('#answer', String(v)); await page.getByRole('button', { name: 'Check', exact: true }).click(); }
    else await page.locator(`.option[data-option="${v}"]`).click();
    return;
  }
  throw new Error(`no solver for: ${prompt}`);
}

// ---------------------------------------------------------------------------
await check('first visit: age, focus and the quick check lead to a plan with a starting point', async () => {
  const { page, errors, ctx } = await open('/learn/');
  await page.waitForSelector('.band-card');
  await shot(page, 'setup-desktop');
  await page.locator('.band-card', { hasText: 'Age 7–9' }).click();
  await page.locator('.focus-card').first().click();
  await page.getByRole('button', { name: 'Start the quick check' }).click();
  let asked = 0;
  while (await page.locator('.step-count').count() && asked < 10) {
    asked++;
    await page.waitForSelector('.prompt');
    const count = await page.locator('.step-count').textContent();
    assert.match(count, /of up to 7/);
    if (asked === 1) await shot(page, 'check-question');
    // Answer whatever is shown: the first option, a typed 1, or the current marker.
    if (await page.locator('.option').count()) await page.locator('.option').first().click();
    else if (await page.locator('#answer').count()) { await page.fill('#answer', '1'); await page.getByRole('button', { name: 'Check', exact: true }).click(); }
    else if (await page.locator('#order-check').count()) { for (const t of await page.locator('.order-tray .tile-btn').all()) await page.locator('.order-tray .tile-btn').first().click(); await page.locator('#order-check').click(); }
    else await page.getByRole('button', { name: 'Check', exact: true }).click();
    await page.waitForSelector('.fb-neutral');
    assert.equal(await page.locator('.fb-correct, .fb-retry').count(), 0, 'the check does not mark answers');
    await page.waitForFunction(() => !document.querySelector('.fb-neutral'), null, { timeout: 4000 });
  }
  assert.ok(asked >= 2 && asked <= 7, `asked ${asked}`);
  await page.waitForSelector('.result-list');
  assert.match(await page.locator('.result-list').textContent(), /Maths\s*Starting with/);
  await shot(page, 'check-result');
  const st = await readState(page);
  assert.equal(st.settings.band, '7-9');
  assert.ok(st.settings.placement.maths);
  assert.ok(st.steps.every((s) => s.source === 'diagnostic' && s.difficulty === 2));
  await page.getByRole('button', { name: 'See today’s plan' }).click();
  await page.waitForSelector('.plan-item');
  assert.ok(await page.locator('.plan-item').count() >= 2);
  await shot(page, 'home-primary');
  assert.deepEqual(errors, []);
  await ctx.close();
});

const PRIMARY = { v: 1, settings: { band: '5-7', audio: false, volume: 1, showAll: false, onboarded: true, focus: 'maths', placement: {}, assumed: [] }, steps: [], sessions: [] };

await check('practice: number line, ten frame, sums and tiles are solved; evidence is recorded per answer', async () => {
  const { page, errors, ctx } = await open('/learn/?practise=number-line-20', { storage: PRIMARY });
  for (const obj of ['number-line-20', 'bonds-to-10', 'add-within-20', 'sequencing']) {
    if (obj !== 'number-line-20') await page.goto(`${BASE}/learn/?practise=${obj}`);
    for (let i = 0; i < 5; i++) {
      await page.waitForSelector('.prompt');
      if (obj === 'number-line-20' && i === 0) await shot(page, 'numberline');
      if (obj === 'bonds-to-10' && i === 0) await shot(page, 'tenframe');
      await solve(page);
      await page.waitForSelector('.fb-correct');
      assert.match(await page.locator('.fb-correct').textContent(), /first time/);
      await page.locator('#feedback .btn-red').click();
    }
    await page.waitForSelector('.complete');
    assert.match(await page.locator('.complete').textContent(), /5 of 5 right first time/);
  }
  await shot(page, 'complete');
  const st = await readState(page);
  const practice = st.steps.filter((s) => s.source === 'practice');
  assert.equal(practice.length, 20);
  assert.ok(practice.every((s) => s.firstTry && s.correct && [1, 2, 3].includes(s.difficulty)));
  assert.equal(st.sessions.length, 4);
  assert.deepEqual(errors, []);
  await ctx.close();
});

await check('mistakes: a tagged wrong answer gives a targeted hint, records the mistake, and the third miss reveals', async () => {
  const { page, errors, ctx } = await open('/learn/?practise=add-2digit', { storage: { ...PRIMARY, settings: { ...PRIMARY.settings, band: '7-9' } } });
  await page.waitForSelector('#answer');
  const prompt = (await page.locator('.prompt').textContent()).trim();
  const [a, b] = prompt.match(/\d+/g).map(Number);
  const tens = Math.floor(a / 10) + Math.floor(b / 10);
  const ones = (a % 10) + (b % 10);
  const wrong = ones >= 10 ? `${tens}${ones}` : String(Math.abs(a - b));
  await page.fill('#answer', wrong);
  await page.keyboard.press('Enter');
  await page.waitForSelector('.hint');
  const hint = await page.locator('.hint').textContent();
  assert.match(hint, ones >= 10 ? /new ten|Carry/i : /sign/i);
  await shot(page, 'mistake-hint');
  await page.fill('#answer', '1');
  await page.keyboard.press('Enter');
  await page.fill('#answer', '2');
  await page.keyboard.press('Enter');
  await page.waitForSelector('.fb-reveal');
  assert.match(await page.locator('.fb-reveal').textContent(), new RegExp(`answer is ${a + b}`));
  assert.equal(await page.locator('#answer').inputValue(), String(a + b));
  const st = await readState(page);
  assert.equal(st.steps.length, 1);
  assert.equal(st.steps[0].correct, false);
  assert.equal(st.steps[0].hints, 3);
  assert.equal(st.steps[0].misconception, ones >= 10 ? 'no-regroup' : 'wrong-operation');
  assert.deepEqual(errors, []);
  await ctx.close();
});

await check('Teddy signed out: asking for help explains why and gives the authored hint instead', async () => {
  const { page, errors, ctx } = await open('/learn/?practise=add-within-20', { storage: PRIMARY });
  await page.waitForSelector('.help');
  await page.getByRole('button', { name: 'Give me a clue' }).click();
  await page.waitForSelector('.help-msg.note');
  assert.match(await page.locator('.help-msg.note').textContent(), /sign in.*Hint:/is);
  await shot(page, 'help-signed-out', false);
  assert.deepEqual(errors, []);
  await ctx.close();
});

await check('signed in: progress syncs with evidence, settings come from the profile, Teddy replies are labelled as AI', async () => {
  const { page, errors, ctx, db } = await open('/learn/?practise=add-within-20', { signedIn: true });
  await page.waitForSelector('.help');
  await page.getByRole('button', { name: 'Explain it another way' }).click();
  await page.waitForSelector('.help-msg.tutor');
  assert.match(await page.locator('.help-msg.tutor').textContent(), /Teddy \(AI helper\).*ones first/s);
  await page.fill('#help-text', 'why do I add the ones first?');
  await page.getByRole('button', { name: 'Ask', exact: true }).click();
  await page.waitForFunction(() => document.querySelectorAll('.help-msg.tutor').length === 2);
  await solve(page);
  await page.waitForSelector('.fb-correct');
  await page.getByRole('button', { name: 'Check I’ve got it' }).click();
  await page.waitForSelector('.help-follow');
  assert.match(await page.locator('.help-follow').textContent(), /6 \+ 7/);
  await shot(page, 'help-signed-in');
  await page.waitForFunction(() => true);
  await page.waitForTimeout(300);
  assert.equal(db.attempts.length, 1);
  assert.equal(db.attempts[0].profile_id, '3f1c2a4e-1111-4222-8333-444455556666');
  assert.equal(db.attempts[0].source, 'practice');
  assert.equal(db.attempts[0].correct, true);
  assert.ok([1, 2, 3].includes(db.attempts[0].difficulty));
  assert.equal(await page.evaluate(() => document.body.dataset.stage), 'primary', 'band 7-9 from the profile');
  assert.deepEqual(errors, []);
  await ctx.close();
});

function seededHistory(now) {
  const day = 86400000;
  const steps = [];
  const add = (skill, firstTry, daysAgo, extra = {}) => steps.push({ activityId: `pr-${skill}`, skill, firstTry, correct: firstTry || extra.correct !== false, at: now - daysAgo * day, difficulty: 2, source: 'practice', ...extra });
  for (const d of [20, 19, 13, 6]) for (let i = 0; i < 3; i++) add('count-to-10', true, d);
  for (let i = 0; i < 4; i++) add('add-within-20', i > 1, 3, i <= 1 ? { correct: false, misconception: 'off-by-one', hints: 2 } : {});
  for (let i = 0; i < 2; i++) add('bonds-to-10', true, 1);
  return { ...PRIMARY, settings: { ...PRIMARY.settings, focus: 'all', assumed: ['count-to-5'] }, steps,
    sessions: [{ activityId: 'pr-count-to-10', at: now - 6 * day, total: 5, correctFirst: 5, hintsUsed: 0 }] };
}

await check('parent view: support, secure, assumed and review states come from the recorded answers', async () => {
  const { page, errors, ctx } = await open('/learn/parent.html', { storage: seededHistory(Date.now()) });
  await page.waitForSelector('.glance');
  const text = await page.locator('#parent-app').textContent();
  assert.match(text, /Where support would help.*Adding within 20.*one more or one less/s);
  assert.match(text, /Counting to 10.*Secure/s);
  assert.match(text, /Counting to 5.*Probably known/s);
  assert.match(text, /Number bonds to 10.*Getting started.*Too few answers/s);
  assert.match(text, /Remembered after 7 days/);
  assert.match(text, /nothing your child types to Teddy, and nothing Teddy says, is stored/i);
  await shot(page, 'parent-desktop');
  assert.deepEqual(errors, []);
  await ctx.close();
});

await check('parent view with nothing recorded shows a clear empty state', async () => {
  const { page, errors, ctx } = await open('/learn/parent.html', { storage: PRIMARY });
  await page.waitForSelector('#parent-app h2');
  assert.match(await page.locator('#parent-app').textContent(), /Nothing recorded yet/);
  assert.deepEqual(errors, []);
  await ctx.close();
});

await check('early years: age 2–3 skips the check and shows picture activities; an authored activity still plays', async () => {
  const { page, errors, ctx } = await open('/learn/');
  await page.locator('.band-card', { hasText: 'Age 2–3' }).click();
  await page.waitForSelector('.plan-item');
  assert.equal(await page.evaluate(() => document.body.dataset.stage), 'early');
  assert.ok(await page.locator('.library .card').count() >= 3);
  assert.equal(await page.locator('.help').count(), 0);
  await shot(page, 'home-early');
  await page.goto(`${BASE}/learn/?activity=count-dots-3`);
  await page.locator('.option[data-option="3"]').click();
  await page.waitForSelector('.fb-correct');
  assert.equal(await page.locator('.help').count(), 0, 'no AI help panel for the youngest');
  assert.deepEqual(errors, []);
  await ctx.close();
});

for (const [w, h] of [[375, 812], [768, 1024], [1024, 768], [1440, 900]]) {
  await check(`layout at ${w}×${h}: home, activity and parent view fit without sideways scrolling`, async () => {
    const { page, errors, ctx } = await open('/learn/', { viewport: { width: w, height: h }, storage: seededHistory(Date.now()) });
    await page.waitForSelector('.plan-item');
    await noHScroll(page);
    if (w === 375) await shot(page, 'home-375');
    for (const obj of ['number-line-20', 'build-sentences', 'unit-fractions', 'measure-length']) {
      await page.goto(`${BASE}/learn/?practise=${obj}`);
      await page.waitForSelector('.prompt');
      await noHScroll(page);
      if (w === 375) await shot(page, `${obj}-375`);
    }
    await page.goto(`${BASE}/learn/parent.html`);
    await page.waitForSelector('.glance');
    await noHScroll(page);
    if (w === 375) await shot(page, 'parent-375');
    assert.deepEqual(errors, []);
    await ctx.close();
  });
}

await check('dark mode renders the activity with readable contrast', async () => {
  const { page, errors, ctx } = await open('/learn/?practise=bonds-to-10', { storage: PRIMARY, colorScheme: 'dark' });
  await page.waitForSelector('.build-wrap');
  await shot(page, 'dark-tenframe');
  const [fg, bg] = await page.evaluate(() => { const s = getComputedStyle(document.querySelector('.prompt')); return [s.color, getComputedStyle(document.body).backgroundColor]; });
  assert.notEqual(fg, bg);
  assert.deepEqual(errors, []);
  await ctx.close();
});

await check('keyboard only: a number line question can be answered without a pointer', async () => {
  const { page, ctx } = await open('/learn/?practise=number-line-20', { storage: PRIMARY });
  await page.waitForSelector('.line-slider');
  const target = Number((await page.locator('.prompt').textContent()).match(/\d+/)[0]);
  await page.locator('.line-slider').focus();
  for (let i = 0; i < target; i++) await page.keyboard.press('ArrowRight');
  assert.equal(await page.locator('.line-slider').getAttribute('aria-valuenow'), String(target));
  await page.keyboard.press('Enter');
  await page.waitForSelector('.fb-correct');
  await ctx.close();
});

await browser.close();
server.close();
const passed = results.filter(([ok]) => ok).length;
console.log(`\n${passed}/${results.length} passed`);
process.exit(passed === results.length ? 0 : 1);
