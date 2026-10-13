// Parent dashboard conclusions: observed facts and estimates, each with its evidence.
// Run: node --test scripts/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evidenceOf, independent, uncertain, recurringMistakes, trend, TREND_MIN } from '../redteddytutor/learn/js/insights.js';
import { learnerReport } from '../redteddytutor/learn/js/learner.js';
import { emptyState, updateSettings, readState, writeState, storeKey, clearProfileCaches, STORAGE_KEY, PROFILE_PREFIX } from '../redteddytutor/learn/js/progress.js';
import { rowsToState } from '../redteddytutor/learn/js/api.js';

const DAY = 864e5;
const NOW = Date.UTC(2026, 9, 13, 12);
const step = (skill, firstTry, daysAgo, extra = {}) => ({ activityId: `pr-${skill}`, skill, firstTry, correct: true, at: NOW - daysAgo * DAY, difficulty: 2, source: 'practice', ...extra });
const withSteps = (steps) => ({ ...updateSettings(emptyState(), { band: '7-9' }), steps });

test('evidence is described in words and never overstated', () => {
  assert.equal(evidenceOf([]).level, 'none');
  assert.equal(evidenceOf([step('x', true, 0)]).level, 'little');
  assert.equal(evidenceOf(Array.from({ length: 12 }, () => step('x', true, 0))).level, 'some', 'many answers on one day is not strong');
  assert.equal(evidenceOf([0, 1, 2, 3].flatMap((d) => [1, 2, 3].map(() => step('x', true, d)))).level, 'strong');
});

test('independent: only secure skills, with what was observed', () => {
  const s = withSteps([...[9, 6, 3, 1].flatMap((d) => [1, 2, 3].map(() => step('times-tables', true, d))), step('division-facts', true, 0)]);
  const can = independent(s, learnerReport(s, NOW));
  assert.deepEqual(can.map((c) => c.id), ['times-tables']);
  assert.match(can[0].observed, /10 of the last 10/);
  assert.match(can[0].remembered, /3-day break/);
});

test('uncertain: says why, with the observed counts, and keeps assumptions separate', () => {
  const s = { ...withSteps([step('add-within-20', false, 1, { misconception: 'off-by-one', correct: false }), step('add-within-20', false, 1, { misconception: 'off-by-one', correct: false }), step('add-within-20', true, 1), step('add-within-20', true, 0), step('bonds-to-10', true, 0)]) };
  s.settings = { ...s.settings, assumed: ['count-to-5'] };
  const u = uncertain(s, learnerReport(s, NOW));
  const by = Object.fromEntries(u.map((x) => [x.id, x]));
  assert.match(by['add-within-20'].why, /^2 of 4 answers right first time/);
  assert.equal(by['bonds-to-10'].kind, 'too-early');
  assert.equal(by['count-to-5'].kind, 'assumed');
  assert.equal(by['count-to-5'].evidence.level, 'none');
  assert.ok(!u.some((x) => /mostly/i.test(x.why)));
});

test('recurring mistakes: counted across skills, only when seen twice in 30 days', () => {
  const s = withSteps([
    step('add-within-20', false, 2, { misconception: 'off-by-one' }), step('subtract-within-20', false, 1, { misconception: 'off-by-one' }),
    step('add-2digit', false, 1, { misconception: 'no-regroup' }), step('add-2digit', false, 40, { misconception: 'no-regroup' }),
  ]);
  const r = recurringMistakes(s, learnerReport(s, NOW), NOW);
  assert.equal(r.length, 1);
  assert.equal(r[0].code, 'off-by-one');
  assert.equal(r[0].count, 2);
  assert.equal(r[0].skills.length, 2);
});

test('trend: like-for-like skills only, and "too early" without enough answers', () => {
  assert.equal(trend(withSteps([step('times-tables', true, 1)]), NOW).direction, 'unknown');
  const earlier = Array.from({ length: TREND_MIN }, (_, i) => step('times-tables', i < 3, 20));
  const recent = Array.from({ length: TREND_MIN }, (_, i) => step('times-tables', i < 7, 2));
  const up = trend(withSteps([...earlier, ...recent]), NOW);
  assert.equal(up.direction, 'up');
  assert.match(up.text, /7 of 8 recently, against 3 of 8 before/);
  // A new, harder skill in the recent fortnight is not counted against the child.
  const other = Array.from({ length: 20 }, () => step('long-division', false, 1));
  assert.equal(trend(withSteps([...earlier, ...recent, ...other]), NOW).recent.answers, TREND_MIN);
});

function fakeStorage() {
  const m = new Map();
  return { get length() { return m.size; }, key: (i) => [...m.keys()][i], getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}

test('device storage: a synced child never overwrites the device’s own progress, and is removed on sign-out', () => {
  const st = fakeStorage();
  const anon = withSteps([step('count-to-10', true, 1)]);
  assert.equal(storeKey(st), STORAGE_KEY);
  writeState(st, anon);
  st.setItem('rtt.activeProfile.v1', JSON.stringify('kid-1'));
  assert.equal(storeKey(st), `${PROFILE_PREFIX}kid-1`);
  assert.equal(readState(st).steps.length, 0, 'the child starts from their own copy');
  writeState(st, withSteps([step('times-tables', true, 1), step('times-tables', true, 0)]));
  st.removeItem('rtt.activeProfile.v1');
  assert.equal(readState(st).steps[0].skill, 'count-to-10', 'device progress untouched');
  clearProfileCaches(st);
  assert.equal(st.getItem(`${PROFILE_PREFIX}kid-1`), null);
  assert.ok(st.getItem(STORAGE_KEY));
});

test('a child’s US grade survives the round trip through their profile', () => {
  const s = rowsToState({ age_band: '11-14', locale: 'en-US', settings: { grade: '7', onboarded: true } }, { attempts: [], sessions: [] });
  assert.equal(s.settings.grade, '7');
});

import { plan, startDiagnostic, answerDiagnostic, diagnosticResult } from '../redteddytutor/learn/js/learner.js';
test('a quick check with every answer wrong still gives a plan that starts at the foundation', () => {
  for (const band of ['5-7', '7-9', '9-11']) {
    let d = startDiagnostic('maths', band);
    while (!d.done) d = answerDiagnostic(d, false);
    const r = diagnosticResult(d);
    const s = updateSettings(emptyState(), { band, focus: 'maths', onboarded: true, placement: { maths: r.start } });
    const p = plan(s, NOW);
    assert.ok(p.length >= 1, `${band}: empty plan`);
    assert.ok(p[0].objective === r.start || /starting point/.test(p[0].reason), `${band}: ${p[0].objective} ${p[0].reason}`);
  }
});
