// End-to-end tests for the complete Founders' Record lifecycle against the local
// full stack (dev-server.mjs + local Postgres + fake Stripe). Real browser, real pages,
// real API handlers, real database functions.
//
//   PLAYWRIGHT=/path/to/node_modules/playwright AXE=/path/to/axe.min.js \
//   PGHOST=… PGPORT=… PGUSER=postgres PGDATABASE=te_e2e node scripts/te/e2e.mjs
import { execFileSync, spawn } from 'node:child_process';
import { readFileSync, mkdirSync } from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const pwMod = await import(process.env.PLAYWRIGHT || 'playwright');
const chromium = pwMod.chromium || pwMod.default.chromium;
const PORT = 4411, BASE = `http://localhost:${PORT}`;
const SHOTS = process.env.SHOTS || '/tmp/te-shots';
mkdirSync(SHOTS, { recursive: true });
const sql = (q) => execFileSync('psql', ['-v', 'ON_ERROR_STOP=1', '-qAt', '-c', q]).toString().trim();
const results = []; let failed = 0;
async function step(name, fn) {
  try { await Promise.race([fn(), new Promise((_, rej) => setTimeout(() => rej(new Error('step timed out')), 120000))]); results.push(['PASS', name]); console.log('PASS', name); }
  catch (e) { failed++; results.push(['FAIL', name, e.message]); console.log('FAIL', name, '\n   ', e.message.split('\n').slice(0, 6).join('\n    ')); }
}

// fresh state
sql(`update te_settings set value='false' where key='payments_enabled';
update te_settings set value='null' where key in ('operator_name','operator_address');
truncate te_referral_clicks, te_payment_events, te_waitlist, te_reports, te_privacy_requests, te_messages, te_audit_log, rate_limits restart identity cascade;
delete from te_entries; delete from te_drafts; update te_counter set last=0; delete from te_journal; delete from te_milestones; delete from te_metrics;
insert into te_admins (user_id,email) values ('11111111-1111-1111-1111-111111111111','admin@example.com') on conflict do nothing;`);

const server = spawn('node', ['scripts/te/dev-server.mjs', String(PORT)], { env: { ...process.env, TE_FAKE_STRIPE: '1' }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((r) => server.stdout.once('data', r));

const browser = await chromium.launch();
async function ctx(opts = {}) {
  const c = await browser.newContext({ viewport: { width: 390, height: 844 }, ...opts });
  c.setDefaultTimeout(15000);
  // the browser's Supabase origin is served by the local PostgREST emulator
  await c.route('https://kxzywyflylkcqoidiqmo.supabase.co/**', async (route) => {
    const u = new URL(route.request().url());
    const r = await fetch(BASE + u.pathname, { method: 'POST', headers: route.request().headers(), body: route.request().postData() });
    await route.fulfill({ status: r.status, body: await r.text(), headers: { 'content-type': 'application/json' } });
  });
  return c;
}
const consoleErrors = [];
function watch(page) {
  page.on('pageerror', (e) => consoleErrors.push(page.url() + ' ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource: the server responded with a status of (400|404)/.test(m.text())) consoleErrors.push(page.url() + ' ' + m.text()); });
  return page;
}

const WH = 'whsec_dev';
async function webhook(event) {
  const body = JSON.stringify(event), t = Math.floor(Date.now() / 1000);
  const sig = crypto.createHmac('sha256', WH).update(`${t}.${body}`).digest('hex');
  const r = await fetch(BASE + '/api/te-stripe-webhook', { method: 'POST', headers: { 'stripe-signature': `t=${t},v1=${sig}`, 'content-type': 'application/json' }, body });
  return { status: r.status, body: await r.json() };
}

async function fillEntry(page, { nick, real, showReal, country, msg, email }) {
  await page.goto(BASE + '/join');
  await page.click('#next');                                   // 1 → 2
  await page.fill('#nickname', nick); await page.click('#next');
  if (real) await page.fill('#real_name', real);
  if (showReal) await page.check('#show_real_name');
  await page.click('#next');
  await page.selectOption('#country', country); await page.click('#next');
  if (msg) await page.fill('#message', msg);
  await page.click('#next');                                   // → 6 preview
  await page.click('#next');                                   // → 7 terms
  await page.fill('#email', email);
}
async function acks(page) { await page.check('#ack_invest'); await page.check('#ack_terms'); await page.check('#ack_supply'); }

let refCode = null, manageUrl = null;

await step('1. visitor explores the challenge (all public pages render, no JS errors)', async () => {
  const c = await ctx(); const p = watch(await c.newPage());
  for (const path of ['/', '/record', '/countries', '/journal', '/challenge', '/about', '/faq', '/contact', '/privacy', '/terms', '/refunds', '/cookies', '/report', '/manage', '/join']) {
    const r = await p.goto(BASE + path); assert.equal(r.status(), 200, path);
    await p.waitForLoadState('networkidle');
    assert.ok((await p.title()).length > 5, 'title ' + path);
  }
  await p.goto(BASE + '/');
  await p.waitForSelector('[data-k="entries"]:not(:has(.skeleton))');
  assert.equal(await p.textContent('[data-k="entries"]'), '0');
  assert.match(await p.textContent('[data-k="networth"]'), /Not yet published/);
  assert.match(await p.textContent('[data-k="started"]'), /to be published/);
  assert.match(await p.textContent('#preview, .empty'), /Nº\s000001/);
  // every nav link resolves
  const links = await p.$$eval('a[href^="/"]', (as) => [...new Set(as.map((a) => a.getAttribute('href').split('#')[0].split('?')[0]))]);
  for (const l of links) { const r = await fetch(BASE + l, { redirect: 'manual' }); assert.ok(r.status < 400, `link ${l} → ${r.status}`); }
  await c.close();
});

await step('2+3. entry preview shows exact price, privacy choices and live certificate', async () => {
  const c = await ctx(); const p = watch(await c.newPage());
  await fillEntry(p, { nick: 'Zoë 🚀', real: 'Zoë Ní Bhriain', showReal: false, country: 'IE', msg: 'Ar aghaidh! 🇮🇪', email: 'zoe@example.com' });
  assert.match(await p.textContent('#price'), /€19\.00/);
  assert.match(await p.textContent('[data-step="7"] .notice'), /Private:.*your real name/s);
  assert.ok(!(await p.textContent('#live-cert')).includes('Ní Bhriain'), 'real name hidden on preview cert');
  assert.match(await p.textContent('#live-cert'), /PREVIEW/);
  await p.screenshot({ path: `${SHOTS}/join-step7-mobile.png`, fullPage: true });
  // acknowledgements are required
  await p.click('#next'); assert.match(await p.textContent('#ack-err'), /confirm all three/);
  await c.close();
});

await step('4. payments disabled: no purchase possible, honest waitlist, nothing created', async () => {
  const c = await ctx(); const p = watch(await c.newPage());
  await fillEntry(p, { nick: 'Waiter', country: 'FR', email: 'wait@example.com' });
  await acks(p); await p.click('#next');
  await p.waitForSelector('#done:not([hidden])');
  assert.match(await p.textContent('#done'), /No payment was taken and no entry number has been assigned/);
  await p.click('#wl'); await p.waitForSelector('#wl-msg .notice');
  assert.equal(sql('select count(*) from te_entries'), '0');
  assert.equal(sql('select count(*) from te_waitlist'), '1');
  const draft = sql("select id from te_drafts where email='wait@example.com'");
  const r = await fetch(BASE + '/api/te-checkout', { method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://www.trillioneuro.com' }, body: JSON.stringify({ draft_id: draft }) });
  assert.equal(r.status, 503, 'checkout refused while DB flag off');
  await c.close();
});

sql(`update te_settings set value='"Test Operator Ltd"' where key='operator_name';
update te_settings set value='"1 Test Street, Dublin, Ireland"' where key='operator_address';
update te_settings set value='true' where key='payments_enabled';`);

async function purchase(c, entry, { complete = true } = {}) {
  const p = watch(await c.newPage());
  let session = null;
  await c.route('https://checkout.stripe.com/**', async (route) => {
    session = route.request().url().split('/').pop();
    await route.fulfill({ status: 200, contentType: 'text/html', body: '<h1>Stripe test checkout</h1>' });
  });
  await fillEntry(p, entry); await acks(p);
  assert.match(await p.textContent('#next'), /Pay €19\.00 securely/);
  await p.click('#next');
  await p.waitForURL(/checkout\.stripe\.com/);
  assert.ok(session, 'redirected to Stripe');
  return { p, session };
}

await step('5+7. test payment: verified webhook issues exactly one entry; duplicates are no-ops', async () => {
  const c = await ctx(); const { p, session } = await purchase(c, { nick: 'Zoë 🚀', real: 'Zoë Ní Bhriain', showReal: false, country: 'IE', msg: 'Ar aghaidh! 🇮🇪 <b>bold?</b>', email: 'zoe@example.com' });
  // client-side "success" before the webhook proves nothing
  await p.goto(`${BASE}/join/success?session_id=${session}`);
  await p.waitForTimeout(1500);
  assert.equal(sql('select count(*) from te_entries'), '0', 'no entry from redirect alone');
  const ev = { id: 'evt_' + session, type: 'checkout.session.completed', data: { object: { id: session, payment_status: 'paid', payment_intent: 'pi_' + session, amount_total: 1900, currency: 'eur' } } };
  const w1 = await webhook(ev); assert.equal(w1.body.result, 'created');
  const w2 = await webhook(ev); assert.equal(w2.status, 200);
  const w3 = await webhook({ ...ev, id: ev.id + '_retry' }); assert.equal(w3.status, 200);
  assert.equal(sql('select count(*) from te_entries'), '1');
  await p.waitForSelector('text=You’re Nº 000001', { timeout: 15000 });
  manageUrl = await p.inputValue('#mk');
  refCode = (await p.inputValue('input[aria-label="Your referral link"]')).split('ref=')[1];
  assert.match(refCode, /^[0-9a-f]{10}$/);
  await p.screenshot({ path: `${SHOTS}/success-mobile.png`, fullPage: true });
  // forged webhook is rejected
  const forged = await fetch(BASE + '/api/te-stripe-webhook', { method: 'POST', headers: { 'stripe-signature': 't=1,v1=' + 'a'.repeat(64) }, body: JSON.stringify(ev) });
  assert.equal(forged.status, 400);
  await c.close();
});

await step('6. cancelled / expired / failed payment creates no entry', async () => {
  const c = await ctx(); const { p, session } = await purchase(c, { nick: 'Quitter', country: 'DE', email: 'quit@example.com' });
  await webhook({ id: 'evt_exp_' + session, type: 'checkout.session.expired', data: { object: { id: session } } });
  await p.goto(`${BASE}/join/cancelled?draft=x`);
  assert.match(await p.textContent('h1'), /Nothing was charged/);
  await p.goto(`${BASE}/join/success?session_id=${session}`);
  await p.waitForSelector('text=No entry was created', { timeout: 10000 });
  // a wrong-amount "paid" event for the same session is refused
  const w = await webhook({ id: 'evt_bad_' + session, type: 'checkout.session.completed', data: { object: { id: session, payment_status: 'paid', amount_total: 1, currency: 'eur' } } });
  assert.equal(w.body.result, 'amount_mismatch');
  assert.equal(sql('select count(*) from te_entries'), '1');
  await c.close();
});

await step('8. entry appears in the archive; private name hidden; unapproved entry noindex', async () => {
  const c = await ctx(); const p = watch(await c.newPage());
  await p.goto(BASE + '/record'); await p.waitForSelector('.entry-nick');
  assert.equal(await p.textContent('.entry-nick'), 'Zoë 🚀');
  assert.ok(!(await p.content()).includes('Ní Bhriain'));
  await p.goto(BASE + '/record/1'); await p.waitForSelector('#cert');
  assert.match(await p.textContent('#entry'), /Nº\s000001/);
  assert.ok(!(await p.textContent('#entry')).includes('Ní Bhriain'));
  const html = await (await fetch(BASE + '/record/1')).text();
  assert.match(html, /<meta name="robots" content="noindex/);
  assert.match(html, /<title>Nº 000001 · Zoë 🚀/);
  assert.equal((await fetch(BASE + '/record/999')).status, 404);
  await p.screenshot({ path: `${SHOTS}/entry-mobile.png`, fullPage: true });
  // certificate PNG downloads
  const [dl] = await Promise.all([p.waitForEvent('download'), p.click('#dl')]);
  assert.match(dl.suggestedFilename(), /founders-record-000001\.png/);
  await c.close();
});

await step('9. search, country rankings and referral attribution update', async () => {
  const c = await ctx({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Version/17.0 Mobile Safari/604.1' });
  const p = watch(await c.newPage());
  await p.goto(`${BASE}/?ref=${refCode}`); await p.waitForLoadState('networkidle');
  assert.equal(sql('select count(*) from te_referral_clicks where valid'), '1');
  assert.ok(!p.url().includes('ref='), 'ref param stripped from URL');
  await c.unroute('https://checkout.stripe.com/**').catch(() => {});
  const { session } = await purchase(c, { nick: 'Friend', country: 'FR', msg: 'Allez', email: 'friend@example.com' });
  await webhook({ id: 'evt_' + session, type: 'checkout.session.completed', data: { object: { id: session, payment_status: 'paid', payment_intent: 'pi_' + session, amount_total: 1900, currency: 'eur' } } });
  assert.equal(sql("select r.entry_number from te_entries e join te_entries r on e.referred_by=r.id where e.nickname='Friend'"), '1');
  const p2 = watch(await c.newPage());
  await p2.goto(BASE + '/record?q=frie'); await p2.waitForSelector('.entry-nick');
  assert.equal(await p2.$$eval('.entry-nick', (e) => e.length), 1);
  await p2.goto(BASE + '/record?q=%23000001'); await p2.waitForSelector('.entry-nick');
  assert.equal(await p2.textContent('.entry-nick'), 'Zoë 🚀');
  await p2.goto(BASE + '/record?q=nobody-here'); await p2.waitForSelector('text=No entries match');
  await p2.goto(BASE + '/countries'); await p2.waitForSelector('#ctable tbody tr td a');
  const rows = await p2.$$eval('#ctable tbody tr', (trs) => trs.map((t) => t.innerText.replace(/\s+/g, ' ')));
  assert.equal(rows.length, 2); assert.match(rows.join('|'), /France/); assert.match(rows.join('|'), /Ireland/);
  await p2.selectOption('#cshow', 'all'); assert.ok((await p2.$$('#ctable tbody tr')).length > 200, 'large leaderboard renders');
  await p2.fill('#cq', 'zzzz'); await p2.waitForSelector('text=No country matches');
  await p2.goto(BASE + '/countries/fr'); await p2.waitForSelector('.entry-nick');
  assert.match(await p2.textContent('#country-head'), /France/);
  await p2.goto(BASE + '/record/1'); await p2.waitForSelector('#cert');
  assert.match(await p2.textContent('#entry'), /Ally/);
  await p2.screenshot({ path: `${SHOTS}/countries-mobile.png`, fullPage: false });
  await c.close();
});

await step('10. unauthorised users cannot reach admin functions', async () => {
  for (const [token, expect] of [[null, 401], ['dev-user-token', 403]]) {
    const r = await fetch(BASE + '/rest/v1/rpc/te_admin_overview', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: '{}' });
    assert.equal(r.status, expect, 'admin overview with ' + token);
    const w = await fetch(BASE + '/rest/v1/rpc/te_admin_set_setting', { method: 'POST', headers: { 'content-type': 'application/json', ...(token ? { authorization: 'Bearer ' + token } : {}) }, body: JSON.stringify({ p_key: 'payments_enabled', p_value: false }) });
    assert.ok(w.status === 401 || w.status === 403);
  }
  const f = await fetch(BASE + '/rest/v1/rpc/te_finalize_payment', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ p_event_id: 'x', p_session: 'x', p_payment_intent: 'x', p_amount: 1900, p_currency: 'eur' }) });
  assert.equal(f.status, 401, 'anon cannot finalize');
  const c = await ctx(); const p = watch(await c.newPage());
  await p.goto(BASE + '/admin'); await p.waitForSelector('#login:not([hidden])');
  assert.equal(await p.isHidden('#app'), true);
  const r = await fetch(BASE + '/admin'); assert.equal(r.headers.get('x-robots-tag'), 'noindex, nofollow');
  await c.close();
});

await step('10b. administrator dashboard works for an admin session', async () => {
  const c = await ctx(); const p = watch(await c.newPage());
  const session = { access_token: 'dev-admin-token', refresh_token: 'x', token_type: 'bearer', expires_in: 3600, expires_at: Math.floor(Date.now() / 1000) + 3600, user: { id: '11111111-1111-1111-1111-111111111111', email: 'admin@example.com', aud: 'authenticated', role: 'authenticated' } };
  await p.addInitScript((s) => localStorage.setItem('te-admin-auth', JSON.stringify(s)), session);
  await p.goto(BASE + '/admin'); await p.waitForSelector('#app:not([hidden])', { timeout: 10000 });
  await p.waitForSelector('text=Active entries');
  await p.click('[data-t="entries"]'); await p.waitForSelector('[data-a="approve"]');
  await p.click('[data-a="approve"][data-n="1"]'); await p.waitForTimeout(500);
  assert.equal(sql('select moderation from te_entries where entry_number=1'), 'approved');
  const html = await (await fetch(BASE + '/record/1')).text();
  assert.match(html, /rel="canonical" href="[^"]+\/record\/1"/, 'approved entry indexable');
  await p.click('[data-t="journal"]'); await p.click('#jn');
  await p.fill('#jt', 'Day one: the record opens'); await p.fill('#jb', 'First paragraph.\n\nSecond with **bold**.');
  await p.selectOption('#jst', 'published'); await p.click('#jf button[type=submit]'); await p.waitForTimeout(600);
  assert.equal(sql("select status from te_journal where slug='day-one-the-record-opens'"), 'published');
  await p.click('[data-t="metrics"]'); await p.click('#xn');
  await p.fill('#xl', 'Founder personal net worth'); await p.fill('#xa', '250000'); await p.fill('#xd', '2026-10-01');
  await p.fill('#xs', 'Personal balance sheet, accountant-reviewed'); await p.fill('#xm', 'Personal assets minus liabilities; company shares at cost.');
  await p.check('#xp'); await p.click('#xf button[type=submit]'); await p.waitForTimeout(600);
  assert.equal(sql("select count(*) from te_audit_log where action in ('journal_save','metric_save','moderate:approve')"), '3');
  const pub = watch(await c.newPage()); await pub.goto(BASE + '/'); await pub.waitForSelector('[data-k="networth"]:not(:has(.skeleton))');
  assert.match(await pub.textContent('[data-k="networth"]'), /€250(\.00)?K|€250,000/);
  await pub.goto(BASE + '/journal/day-one-the-record-opens'); await pub.waitForSelector('.article-body strong');
  await c.close();
});

await step('11. participant can change visibility and request correction/removal', async () => {
  const c = await ctx(); const p = watch(await c.newPage());
  await p.goto(manageUrl.replace('https://www.trillioneuro.com', BASE).replace(/^http:\/\/localhost:\d+/, BASE));
  await p.waitForSelector('#mf'); await p.check('#m-real'); await p.click('#mf button'); await p.waitForTimeout(500);
  assert.equal(sql('select show_real_name from te_entries where entry_number=1'), 't');
  await p.uncheck('#m-real'); await p.click('#mf button'); await p.waitForTimeout(500);
  assert.equal(sql('select show_real_name from te_entries where entry_number=1'), 'f');
  await p.fill('#r-email', 'zoe@example.com'); await p.fill('#r-entry', '1'); await p.selectOption('#r-kind', 'removal');
  await p.fill('#r-details', 'Please remove my entry.'); await p.click('#req button'); await p.waitForSelector('text=Request received');
  assert.equal(sql("select kind from te_privacy_requests where entry_number=1"), 'removal');
  await p.goto(BASE + '/manage#k=' + 'f'.repeat(48)); await p.waitForSelector('.notice.warn');
  await c.close();
});

await step('12. social sharing and metadata never leak private details', async () => {
  for (const path of ['/record/1', '/record/2', '/countries/ie', '/journal/day-one-the-record-opens', '/sitemap.xml']) {
    const html = await (await fetch(BASE + path)).text();
    for (const secret of ['zoe@example.com', 'friend@example.com', 'Ní Bhriain', 'pi_cs_']) assert.ok(!html.includes(secret), `${path} leaks ${secret}`);
  }
  const sm = await (await fetch(BASE + '/sitemap.xml')).text();
  assert.match(sm, /\/record\/1</); assert.ok(!sm.includes('/record/2<'), 'unapproved entry excluded from sitemap');
  const c = await ctx(); const p = watch(await c.newPage());
  await p.goto(BASE + '/record/1'); await p.waitForSelector('#share');
  const hrefs = await p.$$eval('#share a', (as) => as.map((a) => a.href).join(' '));
  assert.ok(!hrefs.includes('zoe%40example') && !hrefs.includes('Bhriain'));
  await c.close();
});

await step('report flow, contact flow and rate limiting', async () => {
  const c = await ctx(); const p = watch(await c.newPage());
  await p.goto(BASE + '/report?entry=1'); await p.selectOption('#rp-reason', 'spam'); await p.click('#report button'); await p.waitForSelector('text=A person will review');
  await p.goto(BASE + '/contact'); await p.fill('#ct-email', 'q@example.com'); await p.fill('#ct-body', 'Hello there, a question.'); await p.click('#contact button'); await p.waitForSelector('text=Message received');
  let limited = false;
  for (let i = 0; i < 8 && !limited; i++) {
    const r = await fetch(BASE + '/rest/v1/rpc/te_contact', { method: 'POST', headers: { 'content-type': 'application/json', 'x-test-ip': '198.51.100.5' }, body: JSON.stringify({ p_email: 'spam@example.com', p_topic: 'general', p_body: 'spam spam spam' }) });
    if (r.status === 400 && /RATE_LIMIT/.test(await r.text())) limited = true;
  }
  assert.ok(limited, 'contact form rate-limited');
  await c.close();
});

await step('long nicknames, emoji and hostile input render safely', async () => {
  sql(`insert into te_drafts (id,nickname,country,email,price_cents,currency,terms_version,stripe_session_id,status,message)
       values ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','WWWWWWWWWWWWWWWWWWWWWWWWWWWWWWWW','JP','long@example.com',1900,'eur','t','cs_test_long','checkout', repeat('🔥長い', 70));`);
  await webhook({ id: 'evt_long', type: 'checkout.session.completed', data: { object: { id: 'cs_test_long', payment_status: 'paid', payment_intent: 'pi_long', amount_total: 1900, currency: 'eur' } } });
  sql(`insert into te_drafts (id,nickname,country,email,price_cents,currency,terms_version,stripe_session_id,status,message)
       values ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','"onmouseover=alert(1)','US','x@example.com',1900,'eur','t','cs_test_xss','checkout','javascript:alert(1) &amp; \\u003c');`);
  await webhook({ id: 'evt_xss', type: 'checkout.session.completed', data: { object: { id: 'cs_test_xss', payment_status: 'paid', payment_intent: 'pi_xss', amount_total: 1900, currency: 'eur' } } });
  const c = await ctx({ viewport: { width: 320, height: 640 } }); const p = watch(await c.newPage());
  let dialog = false; p.on('dialog', (d) => { dialog = true; d.dismiss(); });
  await p.goto(BASE + '/record'); await p.waitForSelector('.entry-nick');
  await p.hover('.entry-nick');
  const overflow = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
  assert.equal(overflow, false, 'no horizontal scroll at 320px');
  await p.goto(BASE + '/record/3'); await p.waitForSelector('#cert');
  assert.equal(await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1), false, 'entry page fits 320px');
  await p.screenshot({ path: `${SHOTS}/long-entry-320.png`, fullPage: true });
  await p.goto(BASE + '/record/4'); await p.waitForSelector('#cert'); await p.hover('h1');
  assert.equal(dialog, false, 'no script execution');
  await c.close();
});

await step('refund removes the entry from the public record; number stays retired', async () => {
  const pi = sql("select stripe_payment_intent from te_entries where nickname='Friend'");
  await webhook({ id: 'evt_refund', type: 'charge.refunded', data: { object: { payment_intent: pi, refunded: true } } });
  assert.equal((await fetch(BASE + '/record/2')).status, 404);
  assert.equal(sql('select last from te_counter'), '4');
});

await step('accessibility: axe WCAG 2.2 AA scan on key pages (desktop + mobile)', async () => {
  const axe = readFileSync(process.env.AXE, 'utf8');
  const problems = [];
  for (const vp of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
    const c = await ctx({ viewport: vp }); const p = await c.newPage();
    for (const path of ['/', '/record', '/record/1', '/countries', '/join', '/faq', '/journal', '/manage', '/admin', '/contact', '/privacy']) {
      await p.goto(BASE + path); await p.waitForLoadState('networkidle'); await p.waitForTimeout(300);
      await p.addScriptTag({ content: axe });
      const v = await p.evaluate(async () => (await window.axe.run(document, { runOnly: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] })).violations
        .map((x) => `${x.id} (${x.impact}) ×${x.nodes.length}: ${x.nodes[0].target.join(' ')}`));
      v.forEach((x) => problems.push(`${vp.width} ${path}: ${x}`));
      if (vp.width === 1440 && ['/', '/record', '/join', '/countries', '/record/1'].includes(path)) await p.screenshot({ path: `${SHOTS}/desktop${path.replace(/\//g, '_') || '_home'}.png`, fullPage: true });
    }
    await c.close();
  }
  assert.equal(problems.length, 0, problems.join('\n'));
});

await step('keyboard: skip link, menu and join flow operable without a mouse; reduced motion respected', async () => {
  const c = await ctx({ reducedMotion: 'reduce' }); const p = await c.newPage();
  await p.goto(BASE + '/'); await p.keyboard.press('Tab');
  assert.equal(await p.evaluate(() => document.activeElement.className), 'skip');
  await p.click('.nav-toggle'); assert.equal(await p.getAttribute('.nav-toggle', 'aria-expanded'), 'true');
  const op = await p.evaluate(() => getComputedStyle(document.querySelector('.reveal') || document.body).opacity);
  assert.equal(op, '1');
  await p.goto(BASE + '/join'); await p.focus('#next'); await p.keyboard.press('Enter');
  await p.keyboard.type('KeyUser'); await p.keyboard.press('Enter');
  assert.match(await p.textContent('#step-label'), /Step 3/);
  await c.close();
});

await step('no uncaught JS errors across the run', async () => {
  assert.equal(consoleErrors.length, 0, consoleErrors.slice(0, 8).join('\n'));
});

await browser.close(); server.kill();
console.log(`\n${results.filter((r) => r[0] === 'PASS').length} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
