// Early-years games: content audit, answer keys, asset manifest and the shared rules.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { ACTIVITIES, BANDS, STRANDS } from '../redteddytutor/early/games/content.js';
import * as E from '../redteddytutor/early/games/engine.js';
import M from '../redteddytutor/early/games/manifest.js';

const root = new URL('../redteddytutor/', import.meta.url);
const json = JSON.parse(readFileSync(new URL('early/games/manifest.json', root), 'utf8'));
const photos = new Set(json.photos.map((p) => p.id));
const sounds = new Set(json.sounds.map((s) => s.id));

test('every activity passes validation (answer keys, options, assets, sounds)', () => {
  const problems = ACTIVITIES.flatMap((a) => E.validate(a, { photos, sounds }));
  assert.deepEqual(problems, []);
});

test('ids are unique and every band and strand is covered', () => {
  assert.equal(new Set(ACTIVITIES.map((a) => a.id)).size, ACTIVITIES.length);
  const per = Object.fromEntries(BANDS.map((b) => [b.band, ACTIVITIES.filter((a) => a.band === b.band)]));
  assert.ok(per['1-2'].length >= 10 && per['2-3'].length >= 12 && per['3-4'].length >= 14, 'brief minimums');
  for (const s of Object.keys(STRANDS)) assert.ok(per['4-6'].filter((a) => a.strand === s).length >= 4, s);
  for (const a of per['4-6']) assert.ok(STRANDS[a.strand], `${a.id} strand`);
});

test('every mechanic is used', () => {
  const kinds = new Set(ACTIVITIES.map((a) => a.kind));
  for (const k of ['explore', 'choose', 'count', 'match', 'memory', 'sort', 'sequence', 'parent']) assert.ok(kinds.has(k), k);
});

test('ages 1-2: forgiving, two big choices, parent-led', () => {
  for (const a of ACTIVITIES.filter((x) => x.band === '1-2' && x.kind !== 'parent')) assert.ok(a.forgiving, a.id);
});

test('no question appears twice anywhere (same prompt, picture and options)', () => {
  const seen = new Map();
  for (const a of ACTIVITIES) for (const q of a.questions || []) {
    const k = q.prompt + JSON.stringify(q.show || '') + q.options.map((o) => JSON.stringify(o)).sort().join();
    assert.ok(!seen.has(k), `${a.id} repeats ${seen.get(k)}`);
    seen.set(k, a.id);
  }
});

test('computed math answers are right', () => {
  const byId = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a]));
  for (const q of byId['rs-add'].questions) assert.equal(Number(q.answer), q.show.a + q.show.b);
  for (const q of byId['rs-subtract'].questions) assert.equal(Number(q.answer), q.show.a - q.show.b);
  for (const q of byId['rs-bonds'].questions) assert.equal(Number(q.answer), q.show.total - q.show.have);
  for (const q of byId['rs-subitise'].questions) assert.equal(Number(q.answer), q.show.n);
  for (const r of byId['rs-order'].rounds) { const v = r.steps.map((s) => s.numeral); assert.deepEqual(v, v.slice().sort((x, y) => x - y)); }
  for (const a of ['lp-count-5', 'rs-count-touch']) for (const r of byId[a].rounds) assert.ok(r.n <= (a === 'lp-count-5' ? 5 : 12));
  for (const r of byId['lp-count-10'].rounds) assert.ok(r.n >= 6 && r.n <= 10);
  for (const q of byId['lp-more-fewer'].questions) {
    const [x, y] = q.options;
    const more = x.n > y.n ? x.id : y.id; const fewer = x.n < y.n ? x.id : y.id;
    assert.equal(q.answer, q.prompt.includes('more') ? more : fewer);
  }
  for (const q of byId['rs-compare'].questions.filter((x) => x.show)) {
    const { a, b } = q.show;
    const want = a.n === b.n ? 'the same' : a.n > b.n ? `more ${a.asset === 'bus' ? 'buses' : a.asset + 's'}` : `more ${b.asset === 'bus' ? 'buses' : b.asset + 's'}`;
    assert.equal(q.answer, want);
  }
});

test('rhymes and sounds are consistent with the words', () => {
  const byId = Object.fromEntries(ACTIVITIES.map((a) => [a.id, a]));
  for (const q of byId['lp-first-sounds'].questions) {
    const letter = q.prompt.match(/“(\w+)”/)[1];
    assert.ok(q.answer.startsWith(letter), `${q.answer} starts with ${letter}`);
    for (const o of q.options) if (o !== q.answer) assert.ok(!o.startsWith(letter), `${o} also starts with ${letter}`);
  }
  for (const q of byId['rs-end-sounds'].questions) {
    const end = q.prompt.match(/“(\w+)”/)[1];
    assert.ok(q.answer.endsWith(end));
    for (const o of q.options) if (o !== q.answer) assert.ok(!o.endsWith(end), `${o} also ends with ${end}`);
  }
  for (const q of byId['rs-letter-sounds'].questions) assert.ok(q.show.id.startsWith(q.answer), q.show.id);
  for (const r of byId['lp-letters'].rounds) for (const [l, w] of r) assert.ok(w.startsWith(l.text.toLowerCase()), w);
  for (const q of byId['rs-blend'].questions) assert.equal(q.prompt.replace(/ – /g, ''), q.answer);
});

test('manifest: JSON and generated JS agree; every entry has licence fields; ready entries exist on disk', () => {
  assert.deepEqual(M, json);
  for (const e of [...json.photos, ...json.sounds]) {
    for (const k of ['id', 'subject', 'status', 'search', 'sourceUrl', 'creator', 'licence', 'licenceUrl', 'attribution', 'checked']) assert.ok(k in e, `${e.id}.${k}`);
    if (e.status === 'ready') {
      for (const k of ['sourceUrl', 'licence', 'licenceUrl', 'checked', 'path']) assert.ok(e[k], `${e.id} ready but no ${k}`);
      assert.ok(existsSync(new URL(e.path.slice(1).replace(/^early\//, 'early/'), root)), `${e.id} file missing`);
      if (json.photos.includes(e)) assert.ok(e.alt && e.width && e.height, `${e.id} alt/size`);
    } else assert.equal(e.status, 'needed');
  }
  for (const p of json.photos) assert.ok(p.emoji, `${p.id} needs a symbol fallback`);
});

test('rules: seeded shuffle is repeatable and keeps every item', () => {
  const a = E.shuffle([1, 2, 3, 4, 5, 6], E.rng(42));
  assert.deepEqual(a, E.shuffle([1, 2, 3, 4, 5, 6], E.rng(42)));
  assert.deepEqual(a.slice().sort(), [1, 2, 3, 4, 5, 6]);
});

test('rules: hint, narrow, reveal; forgiving reveals at once; correct ends', () => {
  let s = E.fresh();
  s = E.attempt(s, false); assert.equal(s.result, 'hint'); assert.ok(!s.done);
  s = E.attempt(s, false); assert.equal(s.result, 'narrow');
  s = E.attempt(s, false); assert.equal(s.result, 'reveal'); assert.ok(s.done);
  assert.equal(E.attempt(E.fresh(), false, { forgiving: true }).result, 'reveal');
  assert.equal(E.attempt(E.fresh(), true).result, 'correct');
});

test('rules: option normalisation, answer checks, sequence and match helpers', () => {
  assert.deepEqual(E.opt('dog'), { id: 'dog', asset: 'dog', label: 'dog' });
  assert.equal(E.opt({ numeral: 4 }).id, '4');
  assert.equal(E.opt({ text: 'the' }).id, 'the');
  assert.ok(E.isCorrect({ answer: '4' }, 4));
  const round = { steps: ['egg', 'chick', 'chicken'] };
  assert.ok(E.nextInSequence(round, [], 'egg'));
  assert.ok(!E.nextInSequence(round, [], 'chick'));
  assert.ok(E.nextInSequence(round, ['egg'], 'chick'));
  assert.ok(E.isPair([], 1, 1) && !E.isPair([], 1, 2));
  assert.deepEqual(E.tally([0], 0), [0]);
  assert.equal(E.stepsOf(ACTIVITIES.find((a) => a.kind === 'choose')), ACTIVITIES.find((a) => a.kind === 'choose').questions.length);
});

test('validator catches broken content', () => {
  const bad = { id: 'x', band: '3-4', title: 'X', area: 'X', kind: 'choose', objective: 'x x', practising: 'x x', intro: 'x x', together: 'x x', offline: 'x x',
    questions: [{ prompt: 'p', hint: 'h', options: ['dog', 'dog'], answer: 'cat' }, { prompt: 'p', hint: 'h', options: ['unicorn', 'dog'], answer: 'dog' }] };
  const e = E.validate(bad, { photos, sounds });
  assert.ok(e.some((m) => /duplicate options/.test(m)));
  assert.ok(e.some((m) => /not exactly once/.test(m)));
  assert.ok(e.some((m) => /unknown photo unicorn/.test(m)));
  assert.ok(e.some((m) => /4\+ questions/.test(m)));
});

test('built pages are fresh and list every activity; no third-party calls in the game code', () => {
  const hub = readFileSync(new URL('early/games/games.html', root), 'utf8');
  for (const a of ACTIVITIES) assert.ok(hub.includes(`play?a=${a.id}"`), a.id);
  for (const f of ['player.js', 'media.js', 'engine.js', 'content.js', 'visuals.js']) {
    const src = readFileSync(new URL(`early/games/${f}`, root), 'utf8');
    assert.ok(!/fetch\(|https?:\/\/(?!www\.redteddytutor)/.test(src.replace(/xmlns="http:\/\/www\.w3\.org\/2000\/svg"/g, '')), `${f} makes no network calls`);
  }
  const vercel = readFileSync(new URL('../vercel.json', root), 'utf8');
  assert.ok(vercel.includes('/redteddytutor/early/games/games.html') && vercel.includes('/redteddytutor/early/games/play.html'));
});
