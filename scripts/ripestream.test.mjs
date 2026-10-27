/* RipeStream landing: membership messaging, CTAs, metadata, sitemap.
   Run: node --test scripts/ripestream.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from '../api/rs-sitemap.mjs';

const read = (f) => readFileSync(new URL('../ripestream/' + f, import.meta.url), 'utf8');
const html = read('index.html');
const body = html.slice(html.indexOf('<body'));

test('every phase-dependent element has a matching pair, closed copy hidden by default', () => {
  const open = body.match(/data-when="open"/g).length;
  const closed = body.match(/data-when="closed"/g).length;
  assert.ok(open >= 8);
  assert.equal(closed, open + 1); // + the closed-only "No invitation?" note
  for (const m of body.matchAll(/<[^>]*data-when="closed"[^>]*>/g)) assert.match(m[0], /\shidden[\s>]/, m[0]);
  for (const m of body.matchAll(/<[^>]*data-when="open"[^>]*>/g)) assert.doesNotMatch(m[0], /\shidden[\s>]/, m[0]);
});

test('open-phase copy never asks for an invitation or says founding is closed', () => {
  const visible = body.replace(/<[^>]*data-when="closed"[^>]*>[\s\S]*?<\/(p|span)>/g, '');
  assert.doesNotMatch(visible, /places are taken|founding (membership|places?) (is |are )?closed/i);
  assert.match(visible, /no invitation needed/i);
});

test('join CTAs point at an existing #join form', () => {
  assert.match(body, /<section[^>]+id="join"/);
  for (const m of body.matchAll(/<a[^>]*data-focus-form[^>]*>/g)) assert.match(m[0], /href="#join"/);
  for (const id of [...body.matchAll(/href="#([a-z-]+)"/g)].map((m) => m[1])) assert.match(body, new RegExp(`id="${id}"`), id);
});

test('form fine print matches the privacy policy on email use', () => {
  assert.doesNotMatch(body, /only email you about your RipeStream account/);
  assert.match(read('privacy.html'), /tell you about RipeStream/);
  assert.match(read('privacy.html'), /Gmail/);
});

test('metadata: positioning, canonicals, robots', () => {
  assert.match(html, /<title>RipeStream — Social, but actually yours\./);
  assert.match(html, /<link rel="canonical" href="https:\/\/www\.ripestream\.com\/">/);
  for (const [f, path, noindex] of [['privacy.html', '/privacy'], ['terms.html', '/terms'], ['member.html', '/member', 1], ['stream.html', '/app', 1]]) {
    const h = read(f);
    assert.match(h, new RegExp(`rel="canonical" href="https://www\\.ripestream\\.com${path}"`), f);
    assert.equal(/name="robots" content="noindex"/.test(h), !!noindex, f);
  }
});

test('structured data parses and states no fabricated metrics', () => {
  const ld = JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);
  const s = JSON.stringify(ld);
  assert.doesNotMatch(s, /aggregateRating|review|numberOfEmployees|interactionStatistic/i);
  assert.deepEqual(ld['@graph'].map((n) => n['@type']).sort(), ['Organization', 'WebSite']);
});

test('sitemap lists public pages only', () => {
  const xml = build([]);
  for (const p of ['/', '/communities', '/privacy', '/terms']) assert.ok(xml.includes(`<loc>https://www.ripestream.com${p}</loc>`), p);
  assert.doesNotMatch(xml, /\/member|\/app</);
});
