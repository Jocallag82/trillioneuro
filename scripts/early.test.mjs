// Early-years pages (ages 1 to kindergarten): content integrity, links and build freshness.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { STAGES, TOPICS, LOOK_CARDS, CARDS_PER_SITTING } from '../redteddytutor/early/data.js';
import { ART } from '../redteddytutor/early/art.js';
import { ACTIVITIES } from '../redteddytutor/learn/js/content.js';

const rd = (p) => readFileSync(new URL(`../redteddytutor/${p}`, import.meta.url), 'utf8');
const all = STAGES.flatMap((s) => s.activities);

test('every activity is complete and ids are unique', () => {
  assert.equal(new Set(all.map((a) => a.id)).size, all.length);
  for (const a of all) {
    for (const k of ['title', 'area', 'objective', 'extend']) assert.ok(a[k]?.length > 3, `${a.id}.${k}`);
    assert.ok(['offline', 'screen', 'both'].includes(a.where), a.id);
    assert.ok(a.minutes > 0 && a.minutes <= 20, a.id);
    assert.ok(a.steps.length >= 2 && a.talk.length >= 2 && a.materials.length >= 1, a.id);
    if (a.where !== 'offline') assert.ok(a.play, `${a.id} is on-screen but has no link`);
  }
});

test('every play link opens a real activity of the right age', () => {
  const byId = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a]));
  for (const s of STAGES) for (const a of s.activities) {
    if (!a.play) continue;
    if (a.play === '/little-world/play') continue;
    const id = new URL(a.play, 'https://x').searchParams.get('activity');
    assert.ok(byId[id], `${a.id} -> ${id} does not exist`);
    if (s.band === '2-3') assert.equal(byId[id].band, '2-3', a.id);
  }
});

test('standards codes are well-formed kindergarten codes', () => {
  for (const a of all) for (const c of a.standards || []) assert.match(c, /^(K\.(CC|OA|G|MD|NBT)\.[A-C]\.\d|R[FLI]\.K\.\d+(\.[a-d])?|SL\.K\.\d)$/, c);
});

test('every ages 1-2 activity is shared, and screen time is capped', () => {
  const lw = STAGES[0].activities;
  assert.ok(lw.filter((a) => a.where === 'offline').length >= lw.length - 1);
  assert.ok(CARDS_PER_SITTING <= 6);
  for (const c of LOOK_CARDS) assert.ok(ART[c.art], c.id);
});

test('built pages are current and have SEO basics', () => {
  const before = STAGES.map((s) => rd(`early/${s.slug}.html`));
  execFileSync(process.execPath, [new URL('build-early.mjs', import.meta.url).pathname]);
  STAGES.forEach((s, i) => assert.equal(rd(`early/${s.slug}.html`), before[i], `${s.slug}.html is stale: run node scripts/build-early.mjs`));
  const titles = new Set();
  for (const s of STAGES) {
    const h = rd(`early/${s.slug}.html`);
    assert.match(h, new RegExp(`<link rel="canonical" href="https://www.redteddytutor.com/${s.slug}">`));
    assert.match(h, /<meta name="robots" content="index, follow">/);
    assert.equal((h.match(/<h1[ >]/g) || []).length, 1);
    assert.match(h, /BreadcrumbList/);
    titles.add(h.match(/<title>(.*)<\/title>/)[1]);
    for (const a of s.activities) assert.ok(h.includes(`id="${a.id}"`), a.id);
  }
  assert.equal(titles.size, STAGES.length);
  assert.match(rd('early/little-world-play.html'), /noindex, follow/);
  const map = rd('sitemap.xml');
  for (const s of ['early-years', ...STAGES.map((x) => x.slug)]) assert.ok(map.includes(`/${s}</loc>`), s);
});

test('free early-years code makes no network calls', () => {
  for (const f of ['early/look.js', 'early/print.js', 'early/art.js', 'early/data.js']) {
    assert.doesNotMatch(rd(f), /fetch\(|XMLHttpRequest|\/api\/|supabase|localStorage/i, f);
  }
});

test('topic pages reference real activities and are built, indexable and in the sitemap', () => {
  const ids = new Set(all.map((a) => a.id));
  const map = rd('sitemap.xml');
  const titles = new Set();
  for (const t of TOPICS) {
    assert.ok(t.ids.length >= 4 && t.stages.length >= 2 && t.tips.length >= 3 && t.intro.length > 150, t.slug);
    for (const id of t.ids) assert.ok(ids.has(id), `${t.slug}: ${id}`);
    const h = rd(`early/${t.slug}.html`);
    assert.match(h, new RegExp(`canonical" href="https://www.redteddytutor.com/${t.slug}"`));
    for (const id of t.ids) assert.ok(h.includes(`id="${id}"`), `${t.slug} missing ${id}`);
    assert.ok(map.includes(`/${t.slug}</loc>`), t.slug);
    titles.add(t.metaTitle);
  }
  assert.equal(titles.size, TOPICS.length);
  const routes = readFileSync(new URL('../vercel.json', import.meta.url), 'utf8');
  for (const t of TOPICS) assert.ok(routes.includes(t.slug), `route for ${t.slug}`);
});

test('every age has a printable PDF pack, linked from its page', () => {
  for (const s of STAGES) {
    const pdf = readFileSync(new URL(`../redteddytutor/early/printables/${s.slug}.pdf`, import.meta.url));
    assert.equal(pdf.subarray(0, 5).toString(), '%PDF-');
    assert.ok(pdf.length < 600_000, `${s.slug}.pdf too large`);
    assert.ok(rd(`early/${s.slug}.html`).includes(`/early/printables/${s.slug}.pdf`));
  }
});
