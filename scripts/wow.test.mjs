// Animation layers for trillioneuro.com and quadrillioneuro.com: wired in, parse, and degrade.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');

const sites = [
  { name: 'trillioneuro', html: 'index.html', js: 'assets/te/wow.js', css: 'assets/te/wow.css', jsUrl: '/assets/te/wow.js', cssUrl: '/assets/te/wow.css', ids: ['gl', 'fx', 'curtain', 'climb', 'c-num', 'c-cap', 'stats', 'preview', 'world', 'price'] },
  { name: 'quadrillioneuro', html: 'quadrillioneuro/index.html', js: 'quadrillioneuro/wow.js', css: 'quadrillioneuro/wow.css', jsUrl: '/wow.js', cssUrl: '/wow.css', ids: ['gl', 'stars', 'curtain', 'ascent', 'asc-cap', 'ai-out', 'ev-out', 'en-out', 'm-out', 'clock-out'] },
];
for (const s of sites) {
  test(`${s.name}: layer is loaded, parses, and has a no-JS / reduced-motion path`, () => {
    const html = read(s.html), js = read(s.js), css = read(s.css);
    assert.ok(html.includes(s.cssUrl + '?'), 'stylesheet linked');
    assert.ok(html.includes(s.jsUrl + '?'), 'script linked');
    for (const id of s.ids) assert.ok(html.includes(`id="${id}"`), `#${id} present`);
    new vm.Script(js, { filename: s.js });                       // syntax check
    assert.match(js, /prefers-reduced-motion: reduce/);
    assert.match(css, /@media \(prefers-reduced-motion:reduce\)/);
    assert.match(css, /html:not\(\.w\)/, 'static fallback when JS is off');
    assert.match(html, /window\.__wow/, 'curtain watchdog so a failed script can never trap the page');
  });
}
test('trillioneuro: data hooks the animation layer must not break are intact', () => {
  const html = read('index.html');
  for (const k of ['entries', 'countries', 'started', 'networth']) assert.ok(html.includes(`data-k="${k}"`));
  assert.ok(html.includes('id="dist-fill"'));
  assert.ok(html.includes('assets/te/home.js'));
});
test('quadrillioneuro: scenario module and every slider are untouched', () => {
  const html = read('quadrillioneuro/index.html');
  assert.ok(html.includes("from '/lib/scenario.js'"));
  for (const id of ['ai-g', 'ai-y', 'ev-g', 'en-g', 'm-pop', 'm-gdp', 'q-g']) assert.ok(html.includes(`id="${id}"`));
});
