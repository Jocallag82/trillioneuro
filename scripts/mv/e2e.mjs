// End-to-end test of the movement site against a real local Postgres (migrations applied, triggers live):
// registration with email confirmation, sign-in, dashboard, voting, idea submission, referral attribution, country pages,
// sharing, profile changes, data export/erasure, SEO endpoints, legacy redirects and responsive layouts.
// Run (Postgres on localhost, Playwright installed):
//   PGHOST=localhost PGUSER=postgres PGPASSWORD=… node scripts/mv/e2e.mjs
import { chromium } from 'playwright';
import { spawn, execFileSync } from 'node:child_process';
import { mkdirSync } from 'node:fs';
import assert from 'node:assert/strict';

const PORT = 4410, BASE = `http://localhost:${PORT}`, SB = 'https://kxzywyflylkcqoidiqmo.supabase.co';
const SHOTS = process.env.SHOTS || '';
const sql = (q) => execFileSync('psql', ['-d', 'mv_e2e', '-qAt', '-c', q], { encoding: 'utf8' }).trim();
execFileSync('sh', ['scripts/mv/setup-db.sh', 'mv_e2e'], { stdio: 'inherit' });
const srv = spawn('node', ['scripts/mv/dev-server.mjs', String(PORT)], { env: { ...process.env, PGDATABASE: 'mv_e2e', AUTH_CONFIRM: '1' }, stdio: ['ignore', 'inherit', 'inherit'] });
await new Promise((r) => setTimeout(r, 1500));

let pass = 0; const ok = (name) => { pass++; console.log('  ✓', name); };
const browser = await chromium.launch();
async function ctxWith(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'], ...opts });
  await ctx.route(SB + '/**', async (route) => {
    const r = route.request(), u = new URL(r.url());
    const cors = { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*', 'access-control-allow-methods': '*' };
    if (r.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    const res = await fetch(BASE + u.pathname + u.search, { method: r.method(), headers: r.headers(), body: r.method() === 'GET' ? undefined : r.postData() });
    route.fulfill({ status: res.status, headers: { ...cors, 'content-type': 'application/json' }, body: await res.text() });
  });
  return ctx;
}
const errors = [];
async function page(ctx) { const p = await ctx.newPage(); p.on('pageerror', (e) => errors.push(p.url() + ' ' + e.message)); return p; }
const confirm = (email) => fetch(BASE + '/__confirm', { method: 'POST', body: JSON.stringify({ email }) });

try {
  /* ── 1. Homepage with an empty database: zeros, never invented figures ── */
  const anon = await ctxWith(); let p = await page(anon);
  await p.goto(BASE + '/', { waitUntil: 'networkidle' }); await p.waitForTimeout(2600);
  for (const k of ['contributors', 'countries', 'ideas', 'votes']) assert.equal(await p.locator(`[data-stat="${k}"]`).innerText(), '0', k + ' starts at 0');
  assert.match(await p.locator('#live-note-t').innerText(), /no one has registered yet/i);
  assert.match(await p.locator('.board-empty').first().innerText(), /board is empty/i);
  assert.equal(await p.locator('h1').count(), 1);
  assert.equal(await p.locator('#priorities-root .vcard').count(), 8, '7 priorities + other-ideas card');
  assert.ok(await p.locator('#priorities-root a:has-text("Join to vote")').count() >= 7, 'signed-out voters are sent to join');
  assert.ok((await p.locator('.live-note').innerText()).includes('not money held'), 'honesty statement is visible');
  ok('empty launch state shows zeros and honest messaging');

  /* ── 2. Registration (email confirmation required) ── */
  await p.locator('#joinbox').scrollIntoViewIfNeeded();
  await p.click('#go'); // empty submit → validation
  assert.ok(await p.locator('#f-fn.bad').count(), 'name validation'); assert.ok(await p.locator('#f-co.bad').count(), 'country validation');
  assert.ok(await p.locator('#e-terms').isVisible(), 'terms validation');
  await p.fill('#fn', 'Ana Byrne'); await p.fill('#dn', 'Ana'); await p.fill('#em', 'ana@example.com'); await p.selectOption('#co', 'IE'); await p.fill('#pw', 'short');
  await p.click('#go'); assert.ok(await p.locator('#f-pw.bad').count(), 'password length validation');
  await p.fill('#pw', 'a-long-password-1'); await p.check('#terms'); await p.check('#mk'); await p.click('#go');
  await p.waitForSelector('text=Check your inbox');
  assert.match(sql("select country_code||'|'||marketing_consent||'|'||(confirmed_at is null) from mv_profiles"), /^IE\|true\|true$/);
  assert.equal(sql('select value from mv_counters where key=\'contributors\''), '0', 'unconfirmed sign-up is not counted');
  ok('registration creates an unconfirmed profile with consent recorded; nothing counted yet');

  // honeypot: a bot filling the hidden field never reaches the server
  const bot = await page(await ctxWith()); await bot.goto(BASE + '/join'); await bot.waitForSelector('#jf');
  await bot.fill('#fn', 'Bot'); await bot.fill('#em', 'bot@example.com'); await bot.selectOption('#co', 'US'); await bot.fill('#pw', 'a-long-password-1'); await bot.check('#terms');
  await bot.evaluate(() => { document.querySelector('#hp').value = 'http://spam'; }); await bot.click('#go'); await bot.waitForTimeout(500);
  assert.equal(sql("select count(*) from auth.users where email='bot@example.com'"), '0'); ok('honeypot stops bot registrations');

  /* ── 3. Sign-in is refused until the email is confirmed, then works ── */
  const s = await page(await ctxWith());
  await s.goto(BASE + '/join?mode=signin'); await s.fill('#em', 'ana@example.com'); await s.fill('#pw', 'a-long-password-1'); await s.click('#go');
  await s.waitForSelector('.msg.err.show'); assert.match(await s.locator('#msg').innerText(), /confirm your email/i);
  await s.fill('#pw', 'wrong-password'); await s.click('#go'); await s.waitForTimeout(300);
  await confirm('ana@example.com');
  await s.fill('#pw', 'wrong-password'); await s.click('#go'); await s.waitForSelector('.msg.err.show'); assert.match(await s.locator('#msg').innerText(), /do not match/i);
  await s.fill('#pw', 'a-long-password-1'); await s.click('#go'); await s.waitForURL('**/dashboard');
  await s.waitForSelector('.seal-no');
  assert.equal(await s.locator('.seal-no').innerText(), 'Nº 000001');
  assert.match(await s.locator('.status .kicker').innerText(), /Founding Contributor/i);
  assert.match(await s.locator('body').innerText(), /Ireland/);
  const refLink = await s.locator('#ref-link').inputValue(); assert.match(refLink, /\/\?ref=[0-9a-f]{10}$/);
  ok('sign-in gated by confirmation; dashboard shows founding Nº 000001, country and referral link');

  /* ── 4. Voting: one vote per round ── */
  await s.goto(BASE + '/#priorities'); await s.waitForSelector('[data-vote]');
  await s.locator('[data-vote]').first().click(); await s.waitForSelector('.vcard.mine');
  await s.waitForFunction(() => document.querySelector('.vcard.mine .vmeta .num').innerText === '1');
  assert.match(await s.locator('.vcard.mine .btn').innerText(), /✓ your vote/i);
  assert.equal(await s.locator('[data-vote]').count(), 0, 'no further vote buttons after voting');
  await s.reload({ waitUntil: 'networkidle' }); await s.waitForSelector('.vcard.mine'); ok('vote counted, persisted across reload, further voting disabled');
  const forged = await s.evaluate(async () => { const t = MV.session().access_token; const r = await fetch('https://kxzywyflylkcqoidiqmo.supabase.co/rest/v1/rpc/mv_cast_vote', { method: 'POST', headers: { apikey: 'x', Authorization: 'Bearer ' + t, 'content-type': 'application/json' }, body: JSON.stringify({ p_idea_id: 2 }) }); return [r.status, (await r.json()).message]; });
  assert.match(forged[1], /ALREADY_VOTED/); assert.equal(sql('select count(*) from mv_votes'), '1'); ok('a forged second vote straight at the API is rejected by the database');

  /* ── 5. Idea submission ── */
  const form = s.locator('#idea-form'); await form.scrollIntoViewIfNeeded();
  await s.fill('#idea-title', 'Clean cooking for every home'); await s.fill('#idea-sum', 'Replace open fires with clean stoves to protect health and forests.'); await form.locator('button').click();
  await s.waitForSelector('#idea-msg.ok'); assert.equal(sql("select status from mv_ideas where kind='community'"), 'pending');
  await s.fill('#idea-title', 'Spam idea title'); await s.fill('#idea-sum', 'Buy cheap things at https://spam.example now please'); await form.locator('button').click();
  await s.waitForSelector('#idea-msg.err'); assert.match(await s.locator('#idea-msg').innerText(), /links are not accepted/i);
  assert.equal(await s.locator('#priorities-root .idea').count(), 0, 'pending ideas are not public'); ok('ideas are validated and held for review');

  /* ── 6. Referral: Bob arrives through Ana's link ── */
  const bobCtx = await ctxWith(); const b = await page(bobCtx);
  await b.goto(refLink, { waitUntil: 'networkidle' }); await b.waitForSelector('#invited.show');
  assert.match(await b.locator('#invited').innerText(), /Ana.*from Ireland.*invited you/);
  assert.ok(!b.url().includes('ref='), 'ref param is removed from the URL');
  await b.fill('#fn', 'Bob Smith'); await b.fill('#em', 'bob@example.com'); await b.selectOption('#co', 'GB'); await b.fill('#pw', 'another-long-pass-2'); await b.check('#terms'); await b.click('#go');
  await b.waitForSelector('text=Check your inbox'); await confirm('bob@example.com');
  assert.equal(sql("select count(*) from mv_referrals r join mv_profiles p on p.user_id = r.referred_id where p.country_code='GB'"), '1'); ok('referral attributed by the database at sign-up');
  await s.goto(BASE + '/dashboard'); await s.waitForSelector('.refstats');
  assert.equal(await s.locator('.refstats > div').nth(1).locator('b').innerText(), '1'); assert.match(await s.locator('#invite').innerText(), /United Kingdom/); ok('Ana sees 1 successful referral from the United Kingdom');

  /* ── 7. Public numbers, leaderboard, map ── */
  const pub = await page(await ctxWith()); await pub.goto(BASE + '/', { waitUntil: 'networkidle' }); await pub.waitForTimeout(2600);
  assert.equal(await pub.locator('[data-stat="contributors"]').innerText(), '2'); assert.equal(await pub.locator('[data-stat="countries"]').innerText(), '2');
  assert.equal(await pub.locator('[data-stat="votes"]').innerText(), '1'); assert.equal(await pub.locator('[data-stat="ideas"]').innerText(), '1');
  await pub.locator('#map').scrollIntoViewIfNeeded(); await pub.waitForSelector('#map path[data-c="IE"].on');
  await pub.locator('#map path[data-c="IE"]').click({ force: true }); assert.match(await pub.locator('#cpanel').innerText(), /Ireland[\s\S]*1[\s\S]*#1[\s\S]*50%/);
  await pub.fill('#find', 'Malta'); await pub.dispatchEvent('#find', 'change'); assert.match(await pub.locator('#cpanel').innerText(), /No one has joined from Malta/);
  await pub.locator('[data-board] .lrow').first().scrollIntoViewIfNeeded(); await pub.waitForTimeout(1800);
  assert.equal(await pub.locator('[data-board] .lrow').count(), 2); assert.match(await pub.locator('[data-board] .lrow').first().innerText(), /Ireland/);
  ok('home counters, map, country search and leaderboard use real data');

  /* ── 8. Country page + SEO ── */
  const cp = await page(await ctxWith()); const resp = await cp.goto(BASE + '/countries/ireland', { waitUntil: 'networkidle' });
  assert.equal(resp.status(), 200);
  const html = await (await fetch(BASE + '/countries/ireland')).text();
  assert.match(html, /<title>Ireland — 1 contributor on Trillion Euro<\/title>/); assert.match(html, /<link rel="canonical" href="[^"]*\/countries\/ireland">/);
  assert.ok(!/noindex/.test(html), 'country with contributors is indexable'); assert.match(html, /BreadcrumbList/); assert.ok(!html.includes('ana@example.com') && !html.includes('Byrne'), 'no personal data in HTML');
  await cp.waitForSelector('.cflag'); assert.match(await cp.locator('h1').innerText(), /ireland/i); assert.match(await cp.locator('.page-hero').innerText(), /#1/);
  assert.ok(await cp.locator('#c-share a[href*="wa.me"]').count() && await cp.locator('#c-share a[href*="facebook.com"]').count() && await cp.locator('#c-share a[href*="linkedin.com"]').count() && await cp.locator('#c-share a[href*="twitter.com"]').count());
  await cp.waitForSelector('#c-card canvas'); await cp.click('#c-copy'); assert.match(await cp.evaluate(() => navigator.clipboard.readText()), /\/countries\/ireland$/); ok('country page: server-rendered meta, live stats, share links, share graphic, copy link');
  const empty = await (await fetch(BASE + '/countries/malta')).text(); assert.match(empty, /be the first to join/); assert.match(empty, /noindex/); ok('empty country pages are noindex');
  assert.equal((await fetch(BASE + '/countries/atlantis')).status, 404);
  const r308 = await fetch(BASE + '/countries/IE', { redirect: 'manual' }); assert.equal(r308.status, 308); assert.equal(r308.headers.get('location'), '/countries/ireland');
  const sm = await (await fetch(BASE + '/sitemap.xml')).text(); assert.match(sm, /\/countries\/ireland/); assert.ok(!sm.includes('/countries/malta'), 'sitemap lists only countries with contributors');
  for (const [from, to] of [['/record', '/countries'], ['/record/42', '/countries'], ['/challenge', '/'], ['/journal', '/'], ['/claim', '/join'], ['/join/success', '/'], ['/refunds', '/']]) { const r = await fetch(BASE + from, { redirect: 'manual' }); assert.equal(r.status, 308, from); assert.equal(r.headers.get('location'), to, from); }
  assert.equal((await fetch(BASE + '/api/te-checkout')).status, 404, 'the old checkout endpoint is gone'); ok('sitemap, canonical redirects and retired Beat Elon URLs');

  /* ── 9. Share panel for a signed-in contributor ── */
  await s.goto(BASE + '/#spread', { waitUntil: 'networkidle' }); await s.waitForSelector('#ref-signed:not([hidden])');
  assert.equal(await s.locator('#ref-link').inputValue(), refLink); assert.ok(await s.locator('#share-btns a[href*="wa.me"]').getAttribute('href').then((h) => decodeURIComponent(h).includes(refLink)));
  await s.locator('#share-btns [data-sh="x"]').evaluate((a) => a.addEventListener('click', (e) => e.preventDefault())); await s.locator('#share-btns [data-sh="x"]').click(); await s.waitForTimeout(500);
  assert.equal(sql('select count(*) from mv_invites'), '1', 'a share click is recorded privately'); await s.waitForSelector('#card-canvas'); ok('share links carry the personal referral URL; share clicks counted privately');

  /* ── 10. Settings: change country; export; erase ── */
  await s.goto(BASE + '/dashboard'); await s.waitForSelector('#settings'); await s.selectOption('#s-co', 'AU'); await s.uncheck('#s-mk'); await s.click('#settings button[type=submit]');
  await s.waitForFunction(() => /^Australia$/.test(document.querySelector('.dcard.w4 .display').innerText)); assert.equal(sql("select country_code||'|'||marketing_consent from mv_profiles where full_name='Ana Byrne'"), 'AU|false');
  assert.equal(sql("select n from mv_country_counts where country_code='AU'"), '1'); assert.equal(sql("select n from mv_country_counts where country_code='IE'"), '0'); ok('profile update moves the country counters');
  const [dl] = await Promise.all([s.waitForEvent('download'), s.click('#export')]); assert.equal(dl.suggestedFilename(), 'trillion-euro-my-data.json');
  await s.fill('#d-c', 'nope'); await s.click('#delete'); assert.match(await s.locator('#dmsg').innerText(), /Type DELETE/);
  await s.fill('#d-c', 'DELETE'); await s.click('#delete'); await s.waitForURL('**/?deleted=1');
  assert.equal(sql("select count(*) from auth.users where email='ana@example.com'"), '0'); assert.equal(sql('select value from mv_counters where key=\'contributors\''), '1'); assert.equal(sql('select count(*) from mv_votes'), '0'); ok('data export and permanent account deletion work; counts update');

  /* ── 11. Responsive layouts, reduced motion, structure ── */
  if (SHOTS) mkdirSync(SHOTS, { recursive: true });
  for (const [w, h, name] of [[360, 740, 'phone'], [768, 1024, 'tablet'], [1440, 900, 'desktop']]) {
    const c = await ctxWith({ viewport: { width: w, height: h } }); const q = await page(c);
    for (const path of ['/', '/countries', '/join', '/faq', '/countries/ireland', '/privacy']) {
      await q.goto(BASE + path, { waitUntil: 'networkidle' }); await q.waitForTimeout(700);
      const o = await q.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth, h1: document.querySelectorAll('h1').length }));
      assert.ok(o.sw <= o.cw, `${name} ${path}: horizontal overflow ${o.sw} > ${o.cw}`); assert.equal(o.h1, 1, `${name} ${path}: one h1`);
      if (SHOTS && path === '/') await q.screenshot({ path: `${SHOTS}/${name}-home.png` });
    }
    await c.close();
  }
  ok('no horizontal overflow and one <h1> on phone, tablet and desktop');
  const rm = await page(await ctxWith({ reducedMotion: 'reduce' })); await rm.goto(BASE + '/', { waitUntil: 'networkidle' });
  assert.equal(await rm.locator('.hero h1 .ln > span').first().evaluate((e) => getComputedStyle(e).transform), 'none'); assert.equal(await rm.locator('.hero .lede').evaluate((e) => getComputedStyle(e).opacity), '1'); ok('reduced motion: hero is static and fully visible');
  const nojs = await (await browser.newContext({ javaScriptEnabled: false })).newPage(); await nojs.goto(BASE + '/'); assert.match(await nojs.locator('h1').innerText(), /ONE TRILLION/i); assert.match(await nojs.locator('body').innerText(), /not money held, raised or promised/); ok('page content is readable without JavaScript');

  /* ── 12. Password reset ── */
  const rp = await page(await ctxWith()); await rp.goto(BASE + '/join?mode=signin'); await rp.click('#forgot'); await rp.fill('#em', 'bob@example.com'); await rp.click('#go'); await rp.waitForSelector('.msg.ok.show');
  const rec = await (await fetch(BASE + '/__recovery?email=bob@example.com')).json(); await rp.goto(BASE + '/join' + rec.hash); await rp.waitForSelector('#nf'); await rp.fill('#pw', 'brand-new-password-3'); await rp.click('#go'); await rp.waitForURL('**/dashboard'); await rp.waitForSelector('.seal-no');
  assert.equal(await rp.locator('.seal-no').innerText(), 'Nº 000002'); ok('password reset link → new password → signed in');

  assert.deepEqual(errors, [], 'no uncaught page errors: ' + errors.join('\n'));
  console.log(`\nE2E passed: ${pass} scenarios`);
} catch (e) { console.error('\nE2E FAILED:', e.message); process.exitCode = 1; }
finally { await browser.close(); srv.kill(); }
