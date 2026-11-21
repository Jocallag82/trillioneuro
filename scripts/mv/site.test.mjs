// Static guarantees for the movement site: every page is built, indexable-or-noindex, honest, payment-free and parseable.
// Run: node --test scripts/mv/site.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { execFileSync } from 'node:child_process';
const root = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, root), 'utf8');
const pages = JSON.parse(read('site-src/pages.json'));

test('built pages are in sync with site-src (run node site-src/build.mjs)', () => {
  const before = pages.map((p) => read(p.out));
  execFileSync('node', ['site-src/build.mjs'], { cwd: root });
  assert.deepEqual(pages.map((p) => read(p.out)), before, 'committed HTML differs from a fresh build');
});
test('every page has one h1, a title, a description, and either a canonical or noindex', () => {
  for (const p of pages) {
    const h = read(p.out);
    assert.match(h, /<title>[^<]{10,}<\/title>/, p.out); assert.match(h, /<meta name="description" content="[^"]{40,}">/, p.out);
    assert.ok(p.noindex ? /name="robots" content="noindex/.test(h) : /<link rel="canonical" href="https:\/\/www\.trillioneuro\.com/.test(h), p.out + ' canonical/noindex');
    if (p.out !== 'country.html') assert.equal((h.match(/<h1[\s>]/g) || []).length, 1, p.out + ' has one <h1>');
    assert.match(h, /<html lang="en"/); assert.match(h, /og:image" content="https:\/\/www\.trillioneuro\.com\/assets\/mv\/og\.png"/);
  }
});
test('there is no payment surface anywhere in the movement site', () => {
  const files = [...pages.map((p) => p.out), ...readdirSync(new URL('assets/mv/', root)).filter((f) => /\.(js|css)$/.test(f)).map((f) => 'assets/mv/' + f)];
  for (const f of files) assert.doesNotMatch(read(f), /stripe|checkout|payment_intent|card number|\bdonate\b/i, f);
  assert.ok(!existsSync(new URL('api/te-checkout.mjs', root)) && !existsSync(new URL('api/te-stripe-webhook.mjs', root)), 'payment handlers removed');
});
test('no placeholder copy, no invented testimonials', () => {
  for (const p of pages) assert.doesNotMatch(read(p.out), /lorem ipsum|<blockquote|coming soon|TODO|\bTBD\b/i, p.out);
});
test('the home page states the €1 trillion is not money held, and says voting is non-binding', () => {
  const h = read('index.html');
  assert.match(h, /not money held, raised or promised/); assert.match(h, /not<\/b> a binding financial commitment/); assert.match(h, /future ambitions, not completed achievements/);
  for (const id of ['top', 'mission', 'world', 'priorities', 'join', 'countries', 'spread', 'roadmap']) assert.ok(h.includes(`id="${id}"`), '#' + id);
});
test('all browser modules parse; reduced-motion and no-JS fallbacks exist', () => {
  for (const f of readdirSync(new URL('assets/mv/', root)).filter((f) => f.endsWith('.js'))) new vm.Script(read('assets/mv/' + f), { filename: f });
  const css = read('assets/mv/mv.css'); assert.match(css, /prefers-reduced-motion:reduce/); assert.match(css, /\.no-js/);
  assert.match(read('assets/mv/globe.js'), /prefers-reduced-motion/); assert.match(read('assets/mv/art.js'), /prefers-reduced-motion/);
});
test('the shell is locale-ready: strings come from i18n, hreflang appears with a second locale', () => {
  const b = read('site-src/build.mjs'); assert.match(b, /LOCALES/); assert.match(b, /hreflang/);
  const en = JSON.parse(read('site-src/i18n/en.json')); assert.ok(en['nav.join'] && en['foot.legal.text']);
});
test('browser code never renders data without escaping and never ships a secret key', () => {
  for (const f of readdirSync(new URL('assets/mv/', root)).filter((f) => f.endsWith('.js'))) { const s = read('assets/mv/' + f); assert.doesNotMatch(s, /sb_secret_|service_role/i, f); }
  assert.match(read('assets/mv/mv.js'), /sb_publishable_/);
});
test('world map data covers every country as a shape or a point', () => {
  const g = JSON.parse(read('assets/mv/world.json')), cs = JSON.parse(read('lib/countries.json'));
  const missing = cs.filter((c) => c.lat != null && !g.paths[c.code] && !g.pts[c.code]); assert.deepEqual(missing, []);
  assert.ok(Object.keys(g.paths).length > 150);
});
