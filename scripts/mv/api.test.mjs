// Unit tests for the server-side country page renderer and sitemap (no network, no database).
// Run: node --test scripts/mv/api.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import handler, { describe, inject } from '../../api/mv-render.mjs';
import sitemap, { build } from '../../api/mv-sitemap.mjs';

const ie = { code: 'IE', slug: 'ireland', name: 'Ireland', region: 'Europe', contributors: 1250, rank: 3, countries_with_contributors: 40, lat: 53, lng: -8 };
const res = () => { const r = { headers: {}, statusCode: 0, body: '' }; r.setHeader = (k, v) => { r.headers[k.toLowerCase()] = v; }; r.end = (b = '') => { r.body = b; }; return r; };
const fakeFetch = (map) => async (url) => {
  const fn = String(url).split('/').pop();
  if (!(fn in map)) throw new Error('unexpected ' + fn);
  const v = typeof map[fn] === 'function' ? map[fn]() : map[fn];
  return new Response(JSON.stringify(v), { status: 200 });
};

test('describe: real numbers, plural-aware, indexable only when the country has contributors', () => {
  assert.equal(describe(ie).title, 'Ireland — 1,250 contributors on Trillion Euro'); assert.equal(describe(ie).index, true);
  assert.match(describe(ie).description, /ranked #3 of 40 countries/);
  assert.match(describe({ ...ie, contributors: 1, rank: 1, countries_with_contributors: 1 }).title, /1 contributor on/);
  const z = describe({ ...ie, contributors: 0, rank: null }); assert.equal(z.index, false); assert.match(z.title, /be the first to join/); assert.ok(!/ranked/.test(z.description));
});
test('inject: meta, canonical, JSON-LD and server-rendered summary; hostile names are escaped', () => {
  const tpl = '<head><title>x</title><meta name="description" content="x"><meta name="robots" content="noindex, nofollow"><meta property="og:title" content="x"><meta property="og:description" content="x"><meta property="og:url" content="x"><meta name="twitter:title" content="x"><meta name="twitter:description" content="x"></head><body><!--SSR--></body>';
  const out = inject(tpl, ie, describe(ie));
  assert.match(out, /<link rel="canonical" href="https:\/\/www\.trillioneuro\.com\/countries\/ireland">/); assert.ok(!/noindex/.test(out));
  assert.match(out, /application\/ld\+json/); assert.match(out, /id="country-data"/); assert.match(out, /<h1[^>]*>Ireland<\/h1>/);
  const evil = inject(tpl, { ...ie, name: '</script><img src=x onerror=alert(1)>' }, describe({ ...ie, name: '</script><img src=x onerror=alert(1)>' }));
  assert.ok(!evil.includes('<img src=x'), 'no raw HTML from data'); assert.ok(!/<\/script><img/.test(evil));
  assert.match(inject(tpl, { ...ie, contributors: 0, rank: null }, describe({ ...ie, contributors: 0, rank: null })), /noindex, follow/);
});
test('handler: 200 with data, 308 to canonical slug, 404 unknown, graceful when the database is down', async () => {
  const deps = (m) => ({ fetch: fakeFetch(m), origin: 'http://x' });
  let r = res(); await handler({ url: '/api/mv-render?slug=ireland', headers: {} }, r, deps({ mv_country: ie })); assert.equal(r.statusCode, 200); assert.match(r.body, /1,250 contributors/); assert.match(r.headers['cache-control'], /s-maxage/);
  r = res(); await handler({ url: '/api/mv-render?slug=Ireland', headers: {} }, r, deps({ mv_country: ie })); assert.equal(r.statusCode, 308); assert.equal(r.headers.location, '/countries/ireland');
  r = res(); await handler({ url: '/api/mv-render?slug=IE', headers: {} }, r, deps({ mv_country: null, mv_country_board: [{ code: 'IE', slug: 'ireland' }] })); assert.equal(r.statusCode, 308); assert.equal(r.headers.location, '/countries/ireland');
  r = res(); await handler({ url: '/api/mv-render?slug=atlantis', headers: {} }, r, deps({ mv_country: null })); assert.equal(r.statusCode, 404);
  r = res(); await handler({ url: '/api/mv-render?slug=ireland', headers: {} }, r, { fetch: async () => { throw new Error('down'); }, origin: 'http://x' }); assert.equal(r.statusCode, 200); assert.equal(r.headers['cache-control'], 'no-store');
  r = res(); await handler({ url: '/api/mv-render?slug=../etc', headers: {} }, r, deps({})); assert.equal(r.statusCode, 404);
});
test('sitemap: static pages + only countries with contributors; junk slugs dropped', async () => {
  const x = build(['ireland', 'bad slug!', 'united-kingdom']); assert.match(x, /\/countries\/ireland/); assert.match(x, /\/countries\/united-kingdom/); assert.ok(!x.includes('bad slug'));
  assert.match(x, /<loc>https:\/\/www\.trillioneuro\.com\/<\/loc>/); assert.ok(!/\/dashboard/.test(x));
  const r = res(); await sitemap({}, r, { fetch: async () => { throw new Error('down'); } }); assert.equal(r.statusCode, 200); assert.match(r.body, /<urlset/);
});
