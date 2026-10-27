/* RipeStream landing: membership messaging, CTAs, metadata, sitemap.
   Run: node --test scripts/ripestream.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { build } from '../api/rs-sitemap.mjs';

const read = (f) => readFileSync(new URL('../ripestream/' + f, import.meta.url), 'utf8');
const html = read('index.html');
const body = html.slice(html.indexOf('<body'));

test('static default is the honest unknown state; open/closed copy hidden until the server answers', () => {
  const count = (w) => (body.match(new RegExp(`data-when="${w}"`, 'g')) || []).length;
  assert.ok(count('unknown') >= 10);
  assert.equal(count('open'), count('unknown'));
  assert.equal(count('closed'), count('open') + 1); // + the closed-only "No invitation?" note
  for (const w of ['open', 'closed']) for (const m of body.matchAll(new RegExp(`<[^>]*data-when="${w}"[^>]*>`, 'g'))) assert.match(m[0], /\shidden[\s>]/, m[0]);
  for (const m of body.matchAll(/<[^>]*data-when="unknown"[^>]*>/g)) assert.doesNotMatch(m[0], /\shidden[\s>]/, m[0]);
});

test('default (pre-status / no-JS) copy makes no claim about the current phase', () => {
  const visible = body.replace(/<([a-z0-9]+)[^>]*data-when="(open|closed)"[^>]*>[\s\S]*?<\/\1>/g, '').replace(/data-label-[a-z]+="[^"]*"/g, '');
  assert.doesNotMatch(visible, /places are (open|taken)|no invitation needed|Claim (a|my|your) founding place/i);
  assert.match(body, /data-label-unknown="Join RipeStream"[^>]*>Join RipeStream</);
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
