// Tests for the Red Teddy Tutor learning engine (no DOM).
// Run: node --test scripts/
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ACTIVITIES, BANDS, DOMAINS, SKILLS } from '../redteddytutor/learn/js/content.js';
import { validateActivity, validateLibrary, startSession, submit, MAX_MISSES } from '../redteddytutor/learn/js/engine.js';
import {
  emptyState, normalize, readState, writeState, clearState, recordStep, recordCompletion,
  trendOf, summarise, recommend, updateSettings, STORAGE_KEY,
} from '../redteddytutor/learn/js/progress.js';

const byId = (id) => ACTIVITIES.find((a) => a.id === id);

function memoryStorage() {
  const m = new Map();
  return {
    getItem: (k) => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => m.set(k, String(v)),
    removeItem: (k) => m.delete(k),
  };
}

const brokenStorage = {
  getItem() { throw new Error('blocked'); },
  setItem() { throw new Error('blocked'); },
  removeItem() { throw new Error('blocked'); },
};

// ---- Library ----

test('starter library is valid', () => {
  assert.deepEqual(validateLibrary(ACTIVITIES), []);
});

test('every age band and domain has content', () => {
  for (const band of BANDS) {
    assert.ok(ACTIVITIES.filter((a) => a.band === band).length >= 3, `band ${band} needs at least 3 activities`);
  }
  for (const domain of DOMAINS) {
    assert.ok(ACTIVITIES.some((a) => a.domain === domain), `domain ${domain} has no activity`);
  }
});

test('every skill used by an activity is defined and every skill is taught', () => {
  for (const a of ACTIVITIES) assert.ok(SKILLS[a.skill], `${a.id} uses unknown skill ${a.skill}`);
  for (const skill of Object.keys(SKILLS)) {
    assert.ok(ACTIVITIES.some((a) => a.skill === skill), `skill ${skill} has no activity`);
  }
});

test('answers are pre-authored options, never empty', () => {
  for (const a of ACTIVITIES) {
    for (const s of a.steps) {
      assert.ok(s.options.some((o) => o.id === s.answer), `${a.id}: answer not an option`);
    }
  }
});

test('validator rejects a wrong answer, bad band, duplicate options and missing hints', () => {
  const base = byId('count-dots-3');
  const clone = (patch) => structuredClone({ ...base, ...patch });

  assert.ok(validateActivity(clone({ steps: [{ ...base.steps[0], answer: '99' }] })).length > 0);
  assert.ok(validateActivity(clone({ band: '9-10' })).length > 0);
  assert.ok(validateActivity(clone({ steps: [{ ...base.steps[0], options: [{ id: 'a', label: 'a' }, { id: 'a', label: 'b' }] }] })).length > 0);
  assert.ok(validateActivity(clone({ steps: [{ ...base.steps[0], hints: [] }] })).length > 0);
  assert.ok(validateActivity(clone({ skill: 'colours' })).length > 0, 'skill from another domain');
  assert.ok(validateActivity(clone({ steps: [{ ...base.steps[0], visual: { kind: 'dots', count: 99 } }] })).length > 0);
  assert.deepEqual(validateActivity(clone({})), []);
});

// ---- Answer handling ----

test('correct first tap counts as first try and moves the activity on', () => {
  const a = byId('count-dots-ten');
  let s = startSession(a);
  const r = submit(s, a, '8');
  assert.equal(r.outcome.kind, 'correct');
  assert.equal(r.session.results[0].firstTry, true);
  assert.equal(r.session.index, 1);
  assert.equal(r.session.done, false);
  s = submit(r.session, a, '10').session;
  assert.equal(s.done, true);
  assert.equal(s.results.length, 2);
  assert.throws(() => submit(s, a, '10'), /already complete/);
});

test('wrong tap gives the first hint, then a correct retry is not a first try', () => {
  const a = byId('number-two');
  const wrong = submit(startSession(a), a, '3');
  assert.equal(wrong.outcome.kind, 'retry');
  assert.equal(wrong.outcome.hint, a.steps[0].hints[0]);
  assert.equal(wrong.session.index, 0, 'still on the same question');

  const right = submit(wrong.session, a, '2');
  assert.equal(right.outcome.kind, 'correct');
  assert.equal(right.session.results[0].firstTry, false);
  assert.equal(right.session.results[0].misses, 1);
});

test('second miss shows the second hint; third miss reveals the answer and moves on', () => {
  const a = byId('number-two');
  let s = startSession(a);
  let r = submit(s, a, '1');
  r = submit(r.session, a, '1');
  assert.equal(r.outcome.hint, a.steps[0].hints[1]);
  assert.equal(MAX_MISSES, 3);
  r = submit(r.session, a, '3');
  assert.equal(r.outcome.kind, 'reveal');
  assert.equal(r.outcome.answer, '2');
  assert.equal(r.outcome.correct, false);
  assert.equal(r.session.index, 1, 'moves to the next step, no penalty');
  assert.equal(r.session.results[0].firstTry, false);
});

test('a step with a single hint keeps showing that hint on repeated misses', () => {
  const a = byId('letters-find-b');
  const r1 = submit(startSession(a), a, 'p');
  const r2 = submit(r1.session, a, 'd');
  assert.equal(r2.outcome.hint, a.steps[0].hints[1]);
});

// ---- Storage ----

test('state round-trips through storage and bad data falls back to defaults', () => {
  const store = memoryStorage();
  const s = recordStep(emptyState(), 'count-dots-3', 'count-to-5', true, 1000);
  assert.equal(writeState(store, s), true);
  assert.equal(readState(store).steps.length, 1);

  store.setItem(STORAGE_KEY, '{not json');
  assert.deepEqual(readState(store), emptyState());
  store.setItem(STORAGE_KEY, JSON.stringify({ v: 1, steps: [{ activityId: 5 }], settings: { band: 'x', volume: 9 } }));
  const cleaned = readState(store);
  assert.equal(cleaned.steps.length, 0);
  assert.equal(cleaned.settings.band, '3-5');
  assert.equal(cleaned.settings.volume, 1);
});

test('blocked storage never throws; the app keeps working without it', () => {
  assert.deepEqual(readState(brokenStorage), emptyState());
  assert.equal(writeState(brokenStorage, emptyState()), false);
  assert.equal(clearState(brokenStorage), false);
});

test('clearing removes stored progress', () => {
  const store = memoryStorage();
  writeState(store, recordStep(emptyState(), 'x', 'colours', true, 1));
  clearState(store);
  assert.deepEqual(readState(store), emptyState());
});

// ---- Progress and recommendations ----

test('trend: improving needs enough attempts and a real rise; struggling is flagged as practice', () => {
  assert.equal(trendOf([false, false, false, true, true, true]), 'improving');
  assert.equal(trendOf([true, false, false, false]), 'practice');
  assert.equal(trendOf([true, true, true]), 'steady');
  assert.equal(trendOf([]), 'new');
});

test('summary reports observed first-try accuracy, not invented results', () => {
  let s = emptyState();
  s = recordStep(s, 'count-dots-3', 'count-to-5', true, 1);
  s = recordStep(s, 'count-dots-3', 'count-to-5', false, 2);
  s = recordCompletion(s, 'count-dots-3', { total: 2, correctFirst: 1, hintsUsed: 1 }, 3);
  const sum = summarise(s);
  assert.equal(sum.completed, 1);
  assert.equal(sum.sessionCount, 1);
  assert.equal(sum.stepCount, 2);
  assert.equal(sum.firstTryAccuracy, 0.5);
  assert.equal(sum.skills[0].label, 'Counting to 5');
  assert.equal(sum.recent[0].activityId, 'count-dots-3');
});

test('recommendations stay in the chosen age band unless "show all" is on', () => {
  let s = updateSettings(emptyState(), { band: '2-3' });
  const inBand = recommend(s, ACTIVITIES);
  assert.ok(inBand.length > 0);
  assert.ok(inBand.every((r) => r.activity.band === '2-3'));

  s = updateSettings(s, { showAll: true });
  assert.ok(recommend(s, ACTIVITIES, 10).some((r) => r.activity.band !== '2-3'));
});

test('a struggling skill is recommended before new skills', () => {
  let s = updateSettings(emptyState(), { band: '3-5' });
  for (let i = 0; i < 4; i++) s = recordStep(s, 'x', 'patterns', false, i);
  const top = recommend(s, ACTIVITIES)[0];
  assert.equal(top.activity.skill, 'patterns');
  assert.match(top.reason, /More practice: Patterns/);
});

test('completed activities are not recommended as new', () => {
  let s = updateSettings(emptyState(), { band: '2-3' });
  s = recordCompletion(s, 'count-dots-3', { total: 1, correctFirst: 1, hintsUsed: 0 }, 1);
  assert.ok(!recommend(s, ACTIVITIES).some((r) => r.activity.id === 'count-dots-3'));
});

test('normalize keeps only recognised fields', () => {
  const s = normalize({ v: 1, settings: { band: '3-5', audio: 'yes' }, steps: [], sessions: [{ activityId: 'x', at: 1, total: 1, correctFirst: 1, hintsUsed: 0 }] });
  assert.equal(s.settings.audio, true, 'non-boolean audio falls back to default');
  assert.equal(s.sessions.length, 1);
  assert.deepEqual(normalize(null), emptyState());
});
