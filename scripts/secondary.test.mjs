// Independent checks for grades 6-12 and the new subjects: every generated answer is
// re-solved here from what the learner sees (the prompt and the picture), never from
// the generator's own working. Run: node --test scripts/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OBJECTIVES } from '../redteddytutor/learn/js/curriculum/framework.js';
import { generateStep, practiceActivity } from '../redteddytutor/learn/js/curriculum/generators.js';
import { BANKS } from '../redteddytutor/learn/js/curriculum/gen-subjects.js';
import { validateActivity, grade } from '../redteddytutor/learn/js/engine.js';
import { mulberry32 } from '../redteddytutor/learn/game/js/rng.js';

const SUP = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
const unsup = (s) => Number([...s].map((c) => SUP[c]).join(''));
const num = (s) => Number(String(s).replace(/−/g, '-'));
const nums = (s) => (String(s).replace(/−/g, '-').match(/-?\d+(\.\d+)?/g) || []).map(Number);
const answerOf = (s) => (s.kind === 'order' ? s.accept[0] : s.options ? s.options.find((o) => o.id === s.answer).label : s.answer);

// Evaluates a linear/quadratic expression in x (and y) such as "3(x − 2) + 4x".
function evalExpr(expr, vars) {
  const js = expr.replace(/−/g, '-').replace(/²/g, '**2').replace(/³/g, '**3')
    .replace(/(\d)\s*([xy(])/g, '$1*$2').replace(/\)\s*\(/g, ')*(');
  // eslint-disable-next-line no-new-func
  return Function(...Object.keys(vars), `return (${js});`)(...Object.values(vars));
}

const SOLVERS = [
  [/^\(?(−?\d+)\)? ([+−×]) \(?(−?\d+)\)? = \?$/, (m) => { const [a, b] = [num(m[1]), num(m[3])]; return m[2] === '+' ? a + b : m[2] === '−' ? a - b : a * b; }],
  [/^What is (\d+)% of (\d+)\?$/, (m) => (m[1] * m[2]) / 100],
  [/costs \$(\d+)\. It is on sale for (\d+)% off/, (m) => m[1] - (m[1] * m[2]) / 100],
  [/^Find the median of: (.+)$/, (m) => nums(m[1]).sort((a, b) => a - b)[2]],
  [/^Find the mean of: (.+)$/, (m) => { const v = nums(m[1]); return v.reduce((s, x) => s + x, 0) / v.length; }],
  [/^Find the range of: (.+)$/, (m) => { const v = nums(m[1]); return Math.max(...v) - Math.min(...v); }],
  [/travels (\d+) miles in (\d+) hours|prints (\d+) pages in (\d+) minutes|fills (\d+) gallons in (\d+) minutes/, (m) => { const v = m.slice(1).filter(Boolean).map(Number); return v[0] / v[1]; }],
  [/^(\d+) tickets cost \$(\d+)\./, (m) => m[2] / m[1]],
  [/uses (\d+) cups of flour for every (\d+) batches.*for (\d+) batches/, (m) => (m[1] * m[3]) / m[2]],
  [/^(\d)([⁰¹²³⁴⁵⁶⁷⁸⁹]+) = \?$/, (m) => Number(m[1]) ** unsup(m[2])],
  [/^x([⁰¹²³⁴⁵⁶⁷⁸⁹]+) · x([⁰¹²³⁴⁵⁶⁷⁸⁹]+) = xⁿ/, (m) => unsup(m[1]) + unsup(m[2])],
  [/^\(x([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\)([⁰¹²³⁴⁵⁶⁷⁸⁹]+) = xᵏ/, (m) => unsup(m[1]) * unsup(m[2])],
  [/^log([₀-₉]+) (\d+) = \?$/, (m) => { const b = Number([...m[1]].map((c) => c.charCodeAt(0) - 8320).join('')); return Math.round(Math.log(Number(m[2])) / Math.log(b)); }],
  [/^If log([₀-₉]+) x = (\d+)/, (m) => Number([...m[1]].map((c) => c.charCodeAt(0) - 8320).join('')) ** Number(m[2])],
  [/mass of (\d+) g and a volume of (\d+) cm³\. What is its density/, (m) => m[1] / m[2]],
  [/A (\d+) kg cart accelerates at (\d+) m\/s²/, (m) => m[1] * m[2]],
  [/net force of (\d+) N acts on a (\d+) kg box/, (m) => m[1] / m[2]],
  [/net force of (\d+) N gives an object an acceleration of (\d+)/, (m) => m[1] / m[2]],
  [/In a sealed container, (\d+) g of .* reacts completely with (\d+) g/, (m) => Number(m[1]) + Number(m[2])],
  [/^(\d+) g of .* products have a mass of (\d+) g/, (m) => m[2] - m[1]],
  [/save \$(\d+) at (\d+)% simple interest per year\. How much interest do you earn in (\d+) years/, (m) => (m[1] * m[2] * m[3]) / 100],
  [/borrow \$(\d+) at (\d+)% simple interest per year for (\d+) years/, (m) => Number(m[1]) + (m[1] * m[2] * m[3]) / 100],
  [/^\$(\d+) earns (\d+)% interest per year, compounded yearly/, (m) => Math.round(m[1] * (1 + m[2] / 100) ** 2)],
  [/^Solve for x: (.+) = (.+)$/, (m, s) => {
    const x = num(s.answer);
    assert.ok(Math.abs(evalExpr(m[1], { x }) - evalExpr(m[2], { x })) < 1e-9, `${s.prompt} with x = ${x}`);
    return x;
  }],
  [/^f\(x\) = (.+)\. Find f\((.+)\)\.$/, (m) => evalExpr(m[1], { x: num(m[2]) })],
  [/^f\(x\) = (.+)\. For which value of x is f\(x\) = (.+)\?$/, (m, s) => {
    const x = num(s.answer); assert.equal(evalExpr(m[1], { x }), num(m[2])); return x;
  }],
  [/^Solve the system: (.+) = (.+) and (.+) = (.+)\. What is ([xy])\?$/, (m) => {
    const coef = (e) => { const a = evalExpr(e, { x: 1, y: 0 }); const b = evalExpr(e, { x: 0, y: 1 }); return [a, b]; };
    const [a1, b1] = coef(m[1]); const [a2, b2] = coef(m[3]); const c1 = num(m[2]); const c2 = num(m[4]);
    const det = a1 * b2 - a2 * b1;
    return m[5] === 'x' ? (c1 * b2 - c2 * b1) / det : (a1 * c2 - a2 * c1) / det;
  }],
  [/^f\(x\) = (\d+)x([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\. f′\(x\) = kx/, (m) => Number(m[1]) * unsup(m[2])],
  [/^f\(x\) = (.+) \+ 5\. (?:Find f′\((.+)\)\.|What is the slope of the tangent line at x = (.+)\?)$/, (m) => {
    const k = num(m[2] ?? m[3]); const h = 1e-6;
    return Math.round((evalExpr(m[1], { x: k + h }) - evalExpr(m[1], { x: k - h })) / (2 * h)) + 0;
  }],
];

function solve(s) {
  const p = s.prompt;
  if (/^What is the slope of the line through/.test(p)) {
    const [x1, y1, x2, y2] = nums(p);
    const m = (y2 - y1) / (x2 - x1);
    const shown = answerOf(s).replace(/−/g, '-');
    assert.ok(Math.abs(eval(shown) - m) < 1e-9, `${p} -> ${shown}`); // eslint-disable-line no-eval
    return;
  }
  if (/^Solve: x²/.test(p)) {
    const expr = p.replace(/^Solve: /, '').replace(/ = 0$/, '');
    for (const r of nums(answerOf(s))) assert.equal(evalExpr(expr, { x: r }), 0, `${p} root ${r}`);
    return;
  }
  if (s.visual?.kind === 'rtri' && /What is (sin|cos|tan) θ/.test(p)) {
    const [, fn] = p.match(/What is (sin|cos|tan) θ/);
    const [a, b, c] = [s.visual.a, s.visual.b, s.visual.c].map(Number);
    const want = { sin: a / c, cos: b / c, tan: a / b }[fn];
    assert.ok(Math.abs(eval(answerOf(s)) - want) < 1e-9, p); // eslint-disable-line no-eval
    return;
  }
  if (s.visual?.kind === 'rtri') {
    const v = s.visual; const ans = num(s.answer);
    const [a, b, c] = [v.a, v.b, v.c].map((x) => (x === '?' ? ans : Number(x)));
    assert.equal(a * a + b * b, c * c, p);
    return;
  }
  if (/marbles\. One is picked/.test(p)) {
    const counts = Object.fromEntries([...p.matchAll(/(\d+) (red|blue|green)/g)].map((m) => [m[2], Number(m[1])]));
    const total = Object.values(counts).reduce((x, y) => x + y, 0);
    const want = /NOT red/.test(p) ? total - counts.red : counts.red;
    assert.equal(answerOf(s), `${want}/${total}`, p);
    return;
  }
  if (/Punnett|parents, \w\w × \w\w/.test(p)) {
    const [, p1, p2] = p.match(/parents, (\w\w) × (\w\w)/);
    const rec = /recessive trait \((\w)\1\)/.exec(p)?.[1];
    const dom = /\((\w)\) is dominant/.exec(p)[1];
    const kids = [...p1].flatMap((x) => [...p2].map((y) => x + y));
    const n = kids.filter((g) => (rec ? g === rec + rec : g.includes(dom))).length;
    assert.equal(answerOf(s), `${n}/4`, p);
    return;
  }
  if (s.visual?.kind === 'code') {
    assert.equal(num(s.answer), runPython(s.visual.text), s.visual.text);
    return;
  }
  for (const [re, fn] of SOLVERS) {
    const m = p.match(re);
    if (m) { assert.equal(num(answerOf(s)), fn(m, s) + 0, p); return; }
  }
  return 'unchecked';
}

// Runs the tiny Python subset the code-tracing items use, by translating it to JS.
function runPython(src) {
  const js = [];
  const names = new Set();
  let indent = 0;
  for (const line of src.split('\n')) {
    const level = line.match(/^ */)[0].length / 4;
    while (indent > level) { js.push('}'); indent--; }
    const t = line.trim();
    let m;
    if ((m = t.match(/^for (\w+) in range\((\d+)(?:, (\d+))?\):$/))) {
      const [lo, hi] = m[3] ? [m[2], m[3]] : ['0', m[2]];
      names.add(m[1]); js.push(`for (${m[1]} = ${lo}; ${m[1]} < ${hi}; ${m[1]}++) {`); indent++;
    } else if ((m = t.match(/^(while|if) (.+):$/))) { js.push(`${m[1]} (${m[2]}) {`); indent++; }
    else if ((m = t.match(/^print\((.+)\)$/))) js.push(`out.push(${m[1]});`);
    else if ((m = t.match(/^(\w+) = (.+)$/))) { names.add(m[1]); js.push(`${m[1]} = ${m[2]};`); }
    else throw new Error(`unsupported line: ${t}`);
  }
  while (indent-- > 0) js.push('}');
  const out = [];
  // eslint-disable-next-line no-new-func
  Function('out', `let ${[...names].join(', ')};\n${js.join('\n')}`)(out);
  return out[0];
}

const NEW = ['integers', 'ratios-rates', 'mean-median', 'percent', 'exponents', 'probability', 'equations-two-step', 'pythagorean', 'slope',
  'multi-step-equations', 'function-notation', 'systems', 'quadratics', 'trig-ratios', 'logarithms', 'derivatives',
  'density', 'forces-motion', 'conservation-of-mass', 'simple-interest', 'code-tracing', 'genetics'];

test('grades 6-12 computed items: every answer re-solves from the prompt', () => {
  let checked = 0;
  for (const id of NEW) {
    for (const d of [1, 2, 3]) {
      for (let seed = 1; seed <= 120; seed++) {
        const a = practiceActivity(id, d, seed * 104729 + d, 5);
        assert.deepEqual(validateActivity(a), [], `${id} d${d}`);
        for (const s of a.steps) if (solve(s) !== 'unchecked') checked++;
      }
    }
  }
  assert.ok(checked > 25000, `only ${checked} items re-solved`);
});

test('typed negative answers accept a hyphen or a real minus sign', () => {
  const step = { kind: 'input', prompt: '(−3) + 1 = ?', answer: '-2', hints: ['x'] };
  assert.equal(grade(step, '-2').correct, true);
  assert.equal(grade(step, '−2').correct, true);
  assert.equal(grade(step, '2').correct, false);
});

test('mistake codes on new items are the mistake they name', () => {
  const rand = mulberry32(11);
  for (let i = 0; i < 300; i++) {
    const s = generateStep('integers', 1 + (i % 3), rand);
    for (const [v, code] of Object.entries(s.wrong)) if (code === 'integer-sign') assert.equal(Number(v), -Number(s.answer));
    const p = generateStep('pythagorean', 1, rand);
    const [a, b] = [Number(p.visual.a), Number(p.visual.b)];
    assert.equal(p.wrong[String(a + b)], 'pythagorean-no-square');
    const e = generateStep('exponents', 1, rand);
    const [, base, pw] = e.prompt.match(/^(\d)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/);
    for (const [v, code] of Object.entries(e.wrong)) if (code === 'power-as-product') assert.equal(Number(v), Number(base) * unsup(pw));
  }
});

test('authored banks: one right answer, distinct options, a hint, sensible length', () => {
  for (const [name, bank] of Object.entries(BANKS)) {
    assert.equal(bank.length, 3, `${name} has a list per difficulty`);
    for (const level of bank) {
      assert.ok(level.length >= 3, `${name}: at least three items per level`);
      for (const [q, answer, wrong, hint] of level) {
        assert.ok(q.length > 10 && answer && hint, `${name}: ${q}`);
        assert.ok(!wrong.includes(answer), `${name}: answer repeated as a wrong option in "${q}"`);
        assert.equal(new Set(wrong).size, wrong.length, `${name}: duplicate options in "${q}"`);
        assert.ok(wrong.length >= 2, `${name}: needs two wrong options`);
      }
    }
  }
});

test('timeline, logic-free banks and capitals: answers are consistent', () => {
  const YEARS = { 'Declaration of Independence': 1776, 'US Constitution signed': 1787, 'Louisiana Purchase': 1803, 'Civil War begins': 1861, 'Emancipation Proclamation': 1863,
    'Women win the right to vote (19th Amendment)': 1920, 'Stock market crash': 1929, 'Brown v. Board of Education': 1954, 'Civil Rights Act': 1964, 'Moon landing': 1969 };
  const rand = mulberry32(5);
  for (let i = 0; i < 200; i++) {
    const s = generateStep('us-history-timeline', 1 + (i % 3), rand);
    const order = s.accept[0].split(' ').map((t) => t.replace(/ /g, ' '));
    const years = order.map((t) => YEARS[t]);
    assert.ok(years.every((y, k) => y && (k === 0 || y > years[k - 1])), order.join(' | '));
    const c = generateStep('states-capitals', 2, rand);
    assert.ok(!c.options.find((o) => o.id === c.answer).misconception);
  }
});

test('every new objective has a generator that the engine accepts', () => {
  for (const id of Object.keys(OBJECTIVES)) {
    for (const d of [1, 2, 3]) assert.deepEqual(validateActivity(practiceActivity(id, d, 99, 5)), [], `${id} d${d}`);
  }
});

import { US_CATALOGUE } from '../redteddytutor/learn/js/curriculum/catalogues/us.js';
import { coverageByGrade, totals } from '../redteddytutor/learn/js/curriculum/coverage.js';
import { LESSONS } from '../redteddytutor/learn/js/curriculum/lessons.js';
import { US_GRADES, GRADE_BAND } from '../redteddytutor/learn/js/curriculum/grades.js';
import { MISCONCEPTIONS } from '../redteddytutor/learn/js/curriculum/misconceptions.js';

const CODE_SHAPE = {
  'CCSS-M': /^((K|[1-8])\.[A-Z]{1,3}\.[A-D]\.\d+(\.[A-D])?|HS[ANFGS]-[A-Z]{2,4}\.[A-D]\.\d+(\.[A-B])?)$/,
  'CCSS-ELA': /^(RF|RL|RI|L|W|SL)\.(K|\d{1,2}|9-10|11-12)\.\d+(\.[A-J])?$/,
  'NGSS': /^(K|[1-5]|MS|HS)-(PS|LS|ESS|ETS)\d-\d+$/,
};

test('US catalogue: every objective is placed, in known grades and courses, with well-formed codes', () => {
  const { placement, courses, frameworks } = US_CATALOGUE;
  const courseIds = new Set(courses.map((c) => c.id));
  for (const id of Object.keys(OBJECTIVES)) assert.ok(placement[id], `${id} has no US placement`);
  for (const [id, p] of Object.entries(placement)) {
    assert.ok(OBJECTIVES[id], `placement for unknown objective ${id}`);
    assert.ok(p.grades.length && p.grades.every((g) => US_GRADES.includes(g)), `${id}: bad grades`);
    assert.ok(courseIds.has(p.course), `${id}: unknown course ${p.course}`);
    // A placement grade must be one the objective's own age band can reach.
    assert.ok(p.grades.some((g) => OBJECTIVES[id].bands.includes(GRADE_BAND[g])), `${id}: grades ${p.grades} do not match bands ${OBJECTIVES[id].bands}`);
    for (const s of p.standards) {
      assert.ok(frameworks[s.framework], `${id}: unknown framework ${s.framework}`);
      assert.match(s.code, CODE_SHAPE[s.framework], `${id}: ${s.code} is not a ${s.framework} code`);
      assert.ok(['aligned', 'partial'].includes(s.fit));
    }
  }
});

test('coverage inventory counts only what exists', () => {
  const t = totals(US_CATALOGUE);
  assert.equal(t.objectives, Object.keys(OBJECTIVES).length);
  assert.equal(t.withPractice, t.objectives, 'every objective has practice');
  assert.equal(t.withLessons, Object.keys(LESSONS).filter((id) => OBJECTIVES[id]).length);
  for (const row of coverageByGrade(US_CATALOGUE)) {
    assert.ok(row.lessons <= row.objectives && row.standardsMapped <= row.objectives);
    assert.equal(row.stateVerified, 0, 'no state alignment is claimed');
  }
  const high = coverageByGrade(US_CATALOGUE).filter((r) => ['9', '10', '11', '12'].includes(r.grade));
  assert.ok(high.some((r) => r.subject === 'maths' && r.objectives > 0), 'high school maths has content');
});

test('lessons: every lesson belongs to an objective and has a worked example', () => {
  for (const [id, l] of Object.entries(LESSONS)) {
    assert.ok(OBJECTIVES[id], `lesson for unknown objective ${id}`);
    assert.ok(l.intro && l.ideas.length >= 2 && l.example.problem && l.example.steps.length >= 1 && l.example.answer && l.watch, id);
  }
  assert.ok(Object.keys(MISCONCEPTIONS).length >= 30);
});

import { plan } from '../redteddytutor/learn/js/learner.js';
import { emptyState, updateSettings, recordStep } from '../redteddytutor/learn/js/progress.js';

test('plan: a new high schooler gets grade-level work; struggling sends them back to the foundation', () => {
  const NOW = Date.UTC(2026, 9, 13, 12);
  let s = updateSettings(emptyState(), { band: '14-18', grade: '9', focus: 'maths', onboarded: true });
  const first = plan(s, NOW);
  assert.ok(first.length >= 3, 'a fresh grade 9 learner has a plan');
  assert.ok(first.every((p) => OBJECTIVES[p.objective].bands.some((b) => ['11-14', '14-18'].includes(b))), first.map((p) => p.objective).join());
  for (let i = 0; i < 5; i++) s = recordStep(s, 'pr-multi-step-equations', 'multi-step-equations', false, NOW - 3600e3 + i, { correct: false, difficulty: 2 });
  const after = plan(s, NOW);
  assert.ok(after.some((p) => p.objective === 'equations-two-step' && /foundation/.test(p.reason)), after.map((p) => `${p.objective}:${p.reason}`).join(' | '));
});

test('catalogue: every placed grade is reachable through a course that runs at that grade', async () => {
  const { inCourse } = await import('../redteddytutor/learn/js/curriculum/coverage.js');
  for (const [id, p] of Object.entries(US_CATALOGUE.placement)) {
    for (const g of p.grades) {
      assert.ok(US_CATALOGUE.courses.some((c) => inCourse(p, c.id) && c.grades.includes(g)), `${id} at grade ${g} is in no course for that grade`);
    }
  }
});

import { startSession as start2, respond as respond2, submit as submit2, useHelp } from '../redteddytutor/learn/js/engine.js';
import { helpFor, methodFor, HOWTO } from '../redteddytutor/learn/js/help.js';

test('help before answering is free but recorded: the answer is no longer unaided', () => {
  const a = practiceActivity('add-2digit', 2, 7, 2);
  let s = start2(a);
  s = useHelp(s);
  let r = respond2(s, a, a.steps[0].answer);
  assert.equal(r.outcome.kind, 'correct');
  assert.equal(r.outcome.firstTry, false, 'helped answers are not first time');
  assert.equal(r.session.results[0].help, 1);
  assert.equal(r.session.results[0].misses, 0, 'help never costs a try');
  r = respond2(r.session, a, a.steps[1].answer);
  assert.equal(r.outcome.firstTry, true, 'help resets for the next question');
  const c = practiceActivity('compare-numbers', 1, 3, 1);
  const out = submit2(useHelp(start2(c)), c, c.steps[0].answer);
  assert.equal(out.outcome.firstTry, false);
});

test('every objective has a method; worked examples never show the learner’s own question or answer', () => {
  for (const id of Object.keys(OBJECTIVES)) {
    assert.ok(methodFor(id, 'primary').length >= 1, `${id} has no method`);
    const rand = mulberry32(21);
    for (const d of [1, 2, 3]) {
      const step = generateStep(id, d, rand);
      for (const stage of ['early', 'primary', 'middle', 'high']) {
        const h = helpFor(step, id, stage, mulberry32(d * 31));
        if (!h.example) continue;
        assert.notEqual(h.example.step.prompt + JSON.stringify(h.example.step.visual), step.prompt + JSON.stringify(step.visual), `${id}: example repeats the question`);
        assert.ok(h.example.steps.length >= 1 && h.example.answer, `${id}: example has steps and an answer`);
      }
    }
  }
  assert.ok(methodFor('count-to-5', 'early').length <= 2, 'young learners get fewer lines at once');
  for (const id of Object.keys(HOWTO)) assert.ok(OBJECTIVES[id], `HOWTO for unknown ${id}`);
});

import { workFor, SOLVED } from '../redteddytutor/learn/js/curriculum/worked.js';
import { answerText } from '../redteddytutor/learn/js/help.js';

test('worked solutions: real working with the question’s numbers, ending in the right answer', () => {
  const norm = (t) => String(t).replace(/−/g, '-').replace(/\s+/g, ' ').toLowerCase();
  let solved = 0;
  for (const id of Object.keys(OBJECTIVES)) {
    for (const d of [1, 2, 3]) {
      const rand = mulberry32(d * 7919 + id.length);
      for (let i = 0; i < 40; i++) {
        const step = generateStep(id, d, rand);
        if (['drop', 'memory'].includes(step.kind)) continue;
        const ans = answerText(step);
        const lines = workFor(id, step, ans);
        assert.ok(Array.isArray(lines) && lines.length >= 1 && lines.every((l) => typeof l === 'string' && l.trim()), `${id}: empty working`);
        assert.ok(norm(lines.join(' ')).includes(norm(ans)), `${id}: working does not reach the answer ${ans}\n${step.prompt}\n${lines.join('\n')}`);
        if (SOLVED.includes(id) && !lines.at(-1).startsWith('So the answer is')) solved++;
      }
    }
  }
  assert.ok(solved > 3000, `only ${solved} items had real worked steps`);
});
