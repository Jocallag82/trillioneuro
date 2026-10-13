// Tests for the learning framework, generated practice and the learner model.
// Run: node --test scripts/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OBJECTIVES, BANDS, validateFramework, ladder, objectivesFor, allPrereqs } from '../redteddytutor/learn/js/curriculum/framework.js';
import { GENERATORS, generateStep, practiceActivity } from '../redteddytutor/learn/js/curriculum/generators.js';
import { MISCONCEPTIONS } from '../redteddytutor/learn/js/curriculum/misconceptions.js';
import { LOCALES, pickLocale, localise, stageName } from '../redteddytutor/learn/js/curriculum/locales.js';
import { validateActivity, startSession, submit, respond, grade, placeItem, placeCard } from '../redteddytutor/learn/js/engine.js';
import {
  mastery, stateOf, credit, misconceptionsOf, retentionOf, objectiveReport, plan, nextDifficulty, rampFor,
  startDiagnostic, diagnosticItem, answerDiagnostic, diagnosticResult,
} from '../redteddytutor/learn/js/learner.js';
import { emptyState, recordStep, normalize, updateSettings } from '../redteddytutor/learn/js/progress.js';
import { mulberry32 } from '../redteddytutor/learn/game/js/rng.js';

const DAY = 86400000;
const NOW = Date.UTC(2026, 9, 12, 12);

test('framework is consistent: subjects, strands, bands, prerequisites, no cycles', () => {
  assert.deepEqual(validateFramework(), []);
});

test('every objective has a generator and every band has objectives in maths and reading', () => {
  for (const id of Object.keys(OBJECTIVES)) assert.ok(GENERATORS[id], `${id} has no generator`);
  for (const band of BANDS) {
    const ids = objectivesFor(band);
    assert.ok(ids.some((id) => OBJECTIVES[id].subject === 'maths'), `${band} has no maths`);
    if (band !== '2-3') assert.ok(ids.some((id) => OBJECTIVES[id].subject === 'literacy'), `${band} has no reading`);
  }
});

test('prerequisites are taught no later than what depends on them', () => {
  const first = (id) => Math.min(...OBJECTIVES[id].bands.map((b) => BANDS.indexOf(b)));
  for (const [id, o] of Object.entries(OBJECTIVES)) {
    for (const p of o.prereqs) assert.ok(first(p) <= first(id), `${p} starts after ${id}`);
  }
  assert.ok(allPrereqs('add-2digit').has('count-to-5'));
});

// Independent re-computation of answers from what the child sees.
function checkAnswer(step) {
  const p = step.prompt;
  let m;
  const ans = step.kind === 'numberline' ? step.target : step.kind === 'build' ? step.target : step.answer;
  if ((m = p.match(/^(\d+) ([+−×÷]) (\d+) = \?$/))) {
    const [a, op, b] = [Number(m[1]), m[2], Number(m[3])];
    const v = op === '+' ? a + b : op === '−' ? a - b : op === '×' ? a * b : a / b;
    assert.equal(Number(ans), v, p);
  } else if ((m = p.match(/^(\d+) \+ \? = (\d+)$/))) {
    assert.equal(Number(m[1]) + Number(ans), Number(m[2]), p);
  } else if ((m = p.match(/^What comes next\? ([-\d, ]+), …$/))) {
    const seq = m[1].split(', ').map(Number);
    const d1 = seq[1] - seq[0];
    const additive = seq.every((x, i) => i === 0 || x - seq[i - 1] === d1);
    assert.equal(Number(ans), additive ? seq[3] + d1 : seq[3] * 2, p);
  } else if (step.visual?.kind === 'dots' && /How many dots/.test(p)) {
    assert.equal(Number(ans), step.visual.count, p);
  } else if (step.visual?.kind === 'tenframe') {
    assert.equal(Number(ans), step.visual.filled);
  } else if (step.visual?.kind === 'blocks') {
    assert.equal(Number(ans), step.visual.tens * 10 + step.visual.ones);
  } else if (step.visual?.kind === 'groups') {
    assert.equal(Number(ans), step.visual.groups * step.visual.each);
  } else if (step.visual?.kind === 'ruler') {
    assert.equal(Number(ans), step.visual.length);
  } else if (step.visual?.kind === 'fraction') {
    assert.equal(ans, `1/${step.visual.parts}`);
  } else if ((m = p.match(/^Which is bigger: (\d+)\/(\d+) or (\d+)\/(\d+)\?$/))) {
    const [a, b, c, d] = m.slice(1).map(Number);
    assert.equal(ans, a / b > c / d ? `${a}/${b}` : `${c}/${d}`, p);
  } else if ((m = p.match(/^Which number is (bigger|smaller): (\d+) or (\d+)\?$/))) {
    const [x, y] = [Number(m[2]), Number(m[3])];
    assert.equal(Number(ans), m[1] === 'bigger' ? Math.max(x, y) : Math.min(x, y));
  } else if ((m = p.match(/^(\d+) tens and (\d+) ones/))) {
    assert.equal(Number(ans), Number(m[1]) * 10 + Number(m[2]));
  } else if ((m = p.match(/^How many tens are in (\d+)\?$/))) {
    assert.equal(Number(ans), Math.floor(Number(m[1]) / 10));
  } else if ((m = p.match(/^Put the marker on (\d+)\/(\d+)\.$/))) {
    assert.equal(step.target, Number(m[1]));
    assert.equal(step.max, Number(m[2]));
  } else if ((m = p.match(/^Put the marker on (\d+)\.$/))) {
    assert.equal(step.target, Number(m[1]));
  } else if ((m = p.match(/^There are (\d+) counters\. Add more to make 10\.$/))) {
    assert.equal(step.start, Number(m[1]));
    assert.equal(step.target, 10);
  } else if ((m = p.match(/^Build the word “(\w+)”\.$/))) {
    assert.equal(step.accept[0].replace(/ /g, ''), m[1]);
  } else if (step.visual?.kind === 'clock') {
    const { h, m: mins } = step.visual;
    assert.equal(ans, `${h}:${String(mins).padStart(2, '0')}`, p);
  } else if (step.visual?.kind === 'grid') {
    const { w, h } = step.visual;
    assert.equal(Number(ans), /perimeter/.test(p) ? 2 * (w + h) : w * h, p);
  } else if (step.visual?.kind === 'bars') {
    const val = Object.fromEntries(step.visual.items.map((b) => [b.label, b.value]));
    if ((m = p.match(/^How many more (\w+) than (\w+)\?$/))) assert.equal(Number(ans), val[m[1]] - val[m[2]], p);
    else if ((m = p.match(/how many for (\w+)\?$/))) assert.equal(Number(ans), val[m[1]], p);
    else if (/which has the most\?$/.test(p)) assert.equal(val[ans], Math.max(...Object.values(val)), p);
    else assert.fail(`unchecked bar question: ${p}`);
  } else if ((m = p.match(/^Which is bigger: (\d+\.\d+) or (\d+\.\d+)\?$/))) {
    assert.equal(ans, Number(m[1]) > Number(m[2]) ? m[1] : m[2], p);
  } else if ((m = p.match(/^Which decimal is the same as (\d+)\/(\d+)\?$/))) {
    assert.equal(Number(ans), Number(m[1]) / Number(m[2]), p);
  } else if (p === 'Put the decimals in order, smallest first.') {
    const vals = step.accept[0].split(' ').map(Number);
    assert.ok(vals.every((v, i) => i === 0 || v > vals[i - 1]), p);
  } else if (step.visual?.kind === 'passage' && step.visual.title === 'The clues') {
    assert.equal(ans, solveLogic(`${step.visual.text.replace(/\n/g, ' ')} ${p}`), p);
  }
}

// Solves an ordering puzzle from its clues alone, by trying every order.
function solveLogic(p) {
  const MORE = { taller: 1, older: 1, faster: 1, shorter: -1, younger: -1, slower: -1 };
  const clues = [...p.matchAll(/(\w+) is (\w+) than (\w+)\./g)].map(([, a, rel, b]) => (MORE[rel] > 0 ? [a, b] : [b, a]));
  const names = [...new Set(clues.flat())];
  const perms = (xs) => (xs.length <= 1 ? [xs] : xs.flatMap((x, i) => perms([...xs.slice(0, i), ...xs.slice(i + 1)]).map((r) => [x, ...r])));
  const fits = perms(names).filter((o) => clues.every(([hi, lo]) => o.indexOf(hi) < o.indexOf(lo)));
  assert.equal(fits.length, 1, `puzzle has ${fits.length} solutions: ${p}`);
  const [order] = fits;
  if (/Who is the second \w+\?$/.test(p)) return order[1];
  if (/Who is in the middle\?$/.test(p)) return order[1];
  if (/Who is the (shortest|youngest|slowest)\?$/.test(p)) return order[order.length - 1];
  return order[0];
}

test('new 7-11 skills: mistakes tagged on the right wrong answers', () => {
  const rand = mulberry32(99);
  for (let i = 0; i < 300; i++) {
    const t = generateStep('tell-time', 3, rand);
    const swap = t.options.find((o) => o.misconception === 'clock-hands-swap');
    if (swap) {
      const { h, m } = t.visual;
      assert.equal(swap.id, `${m === 0 ? 12 : m / 5}:${String((h * 5) % 60).padStart(2, '0')}`);
    }
    const a = generateStep('area-perimeter', 3, rand);
    const { w, h } = a.visual;
    if (w * h !== 2 * (w + h)) assert.equal(a.wrong[String(w * h)], 'area-perimeter-mix');
    assert.equal(a.wrong[String(w + h)], 'perimeter-two-sides');
    const d = generateStep('decimals', 1, rand);
    const tagged = d.options.find((o) => o.misconception === 'decimal-longer-bigger');
    if (tagged) assert.ok(tagged.id.length > d.answer.length && Number(tagged.id) < Number(d.answer));
    const w2 = generateStep('word-problems', 2, rand);
    const [x, y] = w2.prompt.match(/\d+/g).map(Number);
    assert.equal(w2.wrong[String(x + y)], 'one-step-only');
  }
});

test('generated practice is valid and every answer re-computes, across thousands of seeds', () => {
  let items = 0;
  for (const id of Object.keys(GENERATORS)) {
    for (const d of [1, 2, 3]) {
      for (let seed = 1; seed <= 60; seed++) {
        const a = practiceActivity(id, d, seed * 7919 + d, 5);
        assert.deepEqual(validateActivity(a), [], `${id} d${d} seed ${seed}`);
        for (const s of a.steps) {
          checkAnswer(s);
          if (s.options) {
            assert.ok(s.options.length >= 2, `${id}: fewer than two options`);
            assert.ok(!s.options.find((o) => o.id === s.answer).misconception);
          }
          if (s.wrong) assert.ok(!Object.hasOwn(s.wrong, s.answer ?? String(s.target)), `${id}: answer tagged as a mistake`);
          items++;
        }
      }
    }
  }
  assert.ok(items > 10000);
});

test('mistake-tagged options really are the mistake', () => {
  const rand = mulberry32(42);
  for (let i = 0; i < 400; i++) {
    const s = generateStep('add-2digit', 2, rand);
    const [a, b] = s.prompt.match(/\d+/g).map(Number);
    for (const [v, code] of Object.entries(s.wrong)) {
      if (code === 'no-regroup') {
        const tens = Math.floor(a / 10) + Math.floor(b / 10);
        const ones = (a % 10) + (b % 10);
        assert.ok([`${tens}${ones}`, String(tens * 10 + (ones % 10))].includes(v), `${s.prompt} ${v}`);
      }
    }
    const t = generateStep('subtract-2digit', 2, rand);
    const [x, y] = t.prompt.match(/\d+/g).map(Number);
    const flip = Object.entries(t.wrong).find(([, c]) => c === 'smaller-from-larger');
    assert.ok(flip, t.prompt);
    const tens = Math.abs(Math.floor(x / 10) - Math.floor(y / 10));
    const ones = Math.abs((x % 10) - (y % 10));
    assert.equal(flip[0], String(Number(`${tens}${ones}`)));
  }
});

test('respond: typed, number line, ordering and ten-frame answers', () => {
  const act = {
    id: 'mix', title: 'Mix', domain: 'Addition & subtraction', band: '5-7', level: 2, skill: 'add-within-20', instruction: 'Go.',
    steps: [
      { kind: 'input', prompt: '8 + 7 = ?', answer: '15', wrong: { 1: 'wrong-operation', 16: 'off-by-one' }, hints: ['a', 'b'] },
      { kind: 'numberline', prompt: 'Put the marker on 6.', min: 0, max: 10, target: 6, wrong: { 5: 'number-line-ticks' }, hints: ['a'] },
      { kind: 'order', prompt: 'Order', tiles: [{ id: 'a', label: 'c' }, { id: 'b', label: 'a' }, { id: 'c', label: 't' }], accept: ['c a t'], answer: 'c a t', misconception: 'sound-order', hints: ['a'] },
      { kind: 'build', prompt: 'Make 10', target: 10, start: 6, capacity: 10, hints: ['a'] },
    ],
  };
  assert.deepEqual(validateActivity(act), []);
  let s = startSession(act);
  let r = respond(s, act, '');
  assert.equal(r.outcome.kind, 'invalid');
  assert.equal(r.session, s);
  r = respond(s, act, ' 16 ');
  assert.equal(r.outcome.kind, 'retry');
  assert.equal(r.outcome.misconception, 'off-by-one');
  r = respond(r.session, act, '015');
  assert.equal(r.outcome.kind, 'correct');
  assert.equal(r.outcome.firstTry, false);
  assert.equal(r.session.results[0].misconception, 'off-by-one');
  assert.equal(r.session.results[0].difficulty, 2);
  r = respond(r.session, act, 5);
  r = respond(r.session, act, 4);
  r = respond(r.session, act, 3);
  assert.equal(r.outcome.kind, 'reveal');
  assert.equal(r.outcome.answer, '6');
  assert.equal(r.session.results[1].misconception, 'number-line-ticks');
  assert.equal(respond(r.session, act, ['a', 'a', 'b']).outcome.kind, 'invalid');
  r = respond(r.session, act, ['b', 'a', 'c']);
  assert.equal(r.outcome.misconception, 'sound-order');
  r = respond(r.session, act, ['a', 'b', 'c']);
  assert.equal(r.outcome.kind, 'correct');
  assert.equal(respond(r.session, act, 11).outcome.kind, 'invalid');
  r = respond(r.session, act, 10);
  assert.equal(r.outcome.activityDone, true);
  assert.throws(() => submit(startSession(act), act, 'x'));
  assert.equal(grade(act.steps[2], ['a', 'b', 'c']).shown, 'c a t');
});

test('choice: a tagged wrong option records its mistake', () => {
  const a = practiceActivity('compare-numbers', 1, 3, 1);
  a.steps[0].options.find((o) => o.id !== a.steps[0].answer).misconception = 'off-by-one';
  const wrong = a.steps[0].options.find((o) => o.id !== a.steps[0].answer).id;
  let r = submit(startSession(a), a, wrong);
  assert.equal(r.outcome.misconception, 'off-by-one');
  r = submit(r.session, a, a.steps[0].answer);
  assert.equal(r.session.results[0].misconception, 'off-by-one');
});

const steps = (list, skill = 'add-within-20') => list.map(([firstTry, daysAgo, extra = {}]) => ({
  activityId: 'x', skill, firstTry, at: NOW - daysAgo * DAY, correct: true, difficulty: 2, ...extra,
}));

test('mastery: little evidence is not reportable; firsts beat helped answers; recent counts more', () => {
  const two = mastery(steps([[true, 1], [true, 0]]));
  assert.equal(two.reportable, false);
  assert.equal(stateOf(two), 'getting-started');
  const firsts = mastery(steps([[true, 5], [true, 4], [true, 3], [true, 2], [true, 1]]));
  const helped = mastery(steps([[false, 5, { hints: 1 }], [false, 4, { hints: 1 }], [false, 3, { hints: 1 }], [false, 2, { hints: 1 }], [false, 1, { hints: 1 }]]));
  assert.ok(firsts.level > helped.level);
  assert.equal(stateOf(firsts), 'secure');
  const turned = mastery(steps([[false, 9, { correct: false }], [false, 8, { correct: false }], [false, 7, { correct: false }], [true, 3], [true, 2], [true, 1]]));
  const slipped = mastery(steps([[true, 9], [true, 8], [true, 7], [false, 3, { correct: false }], [false, 2, { correct: false }], [false, 1, { correct: false }]]));
  assert.ok(turned.level > slipped.level);
  assert.equal(credit({ firstTry: false }), 0, 'old records without an outcome earn nothing');
});

test('misconceptions: active after two, resolved after three clean answers', () => {
  const mc = (x) => ({ correct: false, misconception: x });
  const active = misconceptionsOf(steps([[false, 3, mc('no-regroup')], [true, 2], [false, 1, mc('no-regroup')]]));
  assert.equal(active[0].active, true);
  const fixed = misconceptionsOf(steps([[false, 6, mc('no-regroup')], [false, 5, mc('no-regroup')], [true, 3], [true, 2], [true, 1]]));
  assert.equal(fixed[0].active, false);
  assert.equal(fixed[0].resolved, true);
});

test('retention: review intervals grow with good days, and remembering after a gap is noticed', () => {
  const one = retentionOf(steps([[true, 2]]), NOW);
  assert.equal(one.intervalDays, 1);
  assert.equal(one.due, true);
  const daily = retentionOf(steps([[true, 3], [true, 2], [true, 1]]), NOW);
  assert.equal(daily.intervalDays, 3, 'daily practice alone does not earn a long interval');
  const spread = retentionOf(steps([[true, 20], [true, 19], [true, 13], [true, 6], [true, 0]]), NOW);
  assert.equal(spread.intervalDays, 14);
  const forgot = retentionOf(steps([[true, 20], [true, 19], [true, 13], [false, 2]]), NOW);
  assert.equal(forgot.intervalDays, 1);
  assert.equal(spread.due, false);
  assert.equal(spread.rememberedAfterDays, 7);
});

function stateWith(list, settings = {}) {
  let s = updateSettings(emptyState(), { band: '5-7', ...settings });
  for (const x of list) s = recordStep(s, x.activityId, x.skill, x.firstTry, x.at, x);
  return s;
}

test('plan: new learners get foundations first; prerequisites gate new work', () => {
  const p = plan(stateWith([]), NOW);
  assert.ok(p.length >= 3);
  for (const item of p) {
    for (const pre of OBJECTIVES[item.objective].prereqs) assert.fail(`${item.objective} needs ${pre} first`);
  }
});

test('plan: a due review and a struggling area come first, with reasons', () => {
  const good = steps([[true, 12], [true, 11], [true, 11], [true, 10], [true, 10]], 'count-to-10');
  const weak = steps([[false, 1, { correct: false, misconception: 'off-by-one' }], [false, 1, { correct: false, misconception: 'off-by-one' }], [false, 1, { correct: false }], [false, 0, { correct: false }]], 'bonds-to-10');
  const base = steps([[true, 1], [true, 1], [true, 1], [true, 1], [true, 1]], 'subitise');
  const p = plan(stateWith([...good, ...weak, ...base]), NOW);
  assert.equal(p[0].kind, 'review');
  assert.equal(p[0].objective, 'count-to-10');
  assert.equal(p[1].kind, 'support');
  assert.equal(p[1].objective, 'bonds-to-10');
  assert.match(p[1].reason, /mix-up/);
  assert.equal(nextDifficulty(objectiveReport(stateWith(weak), 'bonds-to-10', NOW), '5-7'), 1);
  assert.deepEqual(rampFor(2), [1, 2, 2, 2, 3]);
});

test('plan respects the subject focus and a placement starting point', () => {
  const p = plan(stateWith([], { focus: 'literacy' }), NOW);
  assert.ok(p.every((x) => OBJECTIVES[x.objective].subject === 'literacy'));
  const placed = plan(stateWith([], { band: '7-9', focus: 'maths', placement: { maths: 'add-2digit' }, assumed: [...allPrereqs('add-2digit')] }), NOW);
  assert.equal(placed[0].objective, 'add-2digit');
  assert.match(placed[0].reason, /starting point/);
});

test('diagnostic finds the edge in a few questions and assumes only what lies below it', () => {
  const rungs = ladder('maths');
  const knowsUpTo = rungs.indexOf('add-within-20');
  let d = startDiagnostic('maths', '7-9');
  const rand = mulberry32(5);
  while (!d.done) {
    const item = diagnosticItem(d, rand);
    assert.ok(!['drop', 'memory'].includes(item.step.kind));
    d = answerDiagnostic(d, rungs.indexOf(item.objective) <= knowsUpTo);
  }
  assert.ok(d.asked <= 7);
  const r = diagnosticResult(d);
  assert.ok(rungs.indexOf(r.start) > knowsUpTo - 3, r.start);
  for (const id of r.assumed) assert.ok(rungs.indexOf(id) < rungs.indexOf(r.highestShown));
  assert.ok(!r.assumed.includes(r.start));
});

test('assumed objectives are never reported as secure', () => {
  const s = stateWith([], { assumed: ['count-to-10'] });
  const r = objectiveReport(s, 'count-to-10', NOW);
  assert.equal(r.state, 'assumed');
  assert.equal(r.mastery.attempts, 0);
});

test('progress keeps evidence detail and drops anything malformed', () => {
  const s = normalize({ v: 1, settings: { band: '9-11', locale: 'en-US', placement: { maths: 'nope', literacy: 'vocabulary' }, assumed: ['letters', 'x'] },
    steps: [{ activityId: 'a', skill: 'letters', firstTry: false, at: 1, correct: true, hints: 1, difficulty: 3, misconception: 'letter-reversal', source: 'diagnostic' },
      { activityId: 'a', skill: 'letters', firstTry: true, at: 2, misconception: 'made-up', difficulty: 9, source: 'hack' }], sessions: [] });
  assert.equal(s.settings.band, '9-11');
  assert.equal(s.settings.locale, 'en-US');
  assert.deepEqual(s.settings.placement, { literacy: 'vocabulary' });
  assert.deepEqual(s.settings.assumed, ['letters']);
  assert.equal(s.steps[0].misconception, 'letter-reversal');
  assert.equal(s.steps[0].source, 'diagnostic');
  assert.equal(s.steps[1].misconception, undefined);
  assert.equal(s.steps[1].difficulty, undefined);
});

test('locales: picked from browser preferences, words and stage names localised', () => {
  assert.equal(pickLocale(['en-US', 'en']), 'en-US');
  assert.equal(pickLocale(['fr-IE']), 'en-IE');
  assert.equal(pickLocale(['de-DE']), 'en-US', 'the US is the default market');
  assert.equal(localise('Maths and colours', 'en-US'), 'Math and colors');
  assert.match(stageName('5-7', 'en-US'), /Kindergarten/);
  for (const l of Object.values(LOCALES)) for (const b of BANDS) assert.ok(l.stages[b]);
  assert.ok(Object.keys(MISCONCEPTIONS).length >= 10);
});
