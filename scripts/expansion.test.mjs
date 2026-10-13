// Independent checks for the October 2026 curriculum expansion (gen-expansion.js).
// Every computed answer is re-solved here from what the learner sees; authored banks
// are checked for one right answer. Run: node --test scripts/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OBJECTIVES } from '../redteddytutor/learn/js/curriculum/framework.js';
import { practiceActivity, generateStep } from '../redteddytutor/learn/js/curriculum/generators.js';
import { EXPANSION_GENERATORS, EXPANSION_BANKS, ELEMENTS } from '../redteddytutor/learn/js/curriculum/gen-expansion.js';
import { validateActivity, grade } from '../redteddytutor/learn/js/engine.js';
import { LESSONS } from '../redteddytutor/learn/js/curriculum/lessons.js';
import { US_CATALOGUE } from '../redteddytutor/learn/js/curriculum/catalogues/us.js';
import { MISCONCEPTIONS } from '../redteddytutor/learn/js/curriculum/misconceptions.js';
import { mulberry32 } from '../redteddytutor/learn/game/js/rng.js';

const IDS = Object.keys(EXPANSION_GENERATORS);
const SUP = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
const unsup = (s) => { const neg = s.startsWith('⁻'); const v = Number([...s.replace('⁻', '')].map((c) => SUP[c]).join('')); return neg ? -v : v; };
const num = (s) => Number(String(s).replace(/−/g, '-').replace(/,/g, ''));
const nums = (s) => (String(s).replace(/−/g, '-').match(/-?\d+(\.\d+)?/g) || []).map(Number);
const fracVal = (t) => { const m = String(t).replace(/−/g, '-').match(/^(-?\d+)(?:\/(\d+))?$/); return m ? Number(m[1]) / Number(m[2] || 1) : NaN; };
const label = (s) => s.options.find((o) => o.id === s.answer).label;
const js = (e) => e.replace(/−/g, '-').replace(/×/g, '*').replace(/÷/g, '/').replace(/(\d)²/g, '($1**2)');
const evalJs = (e) => Function(`return (${e});`)(); // eslint-disable-line no-new-func
function quartiles(v) {
  const s = [...v].sort((a, b) => a - b); const med = (a) => (a.length % 2 ? a[a.length >> 1] : (a[a.length / 2 - 1] + a[a.length / 2]) / 2);
  const h = s.length >> 1; return [med(s.slice(0, h)), med(s.slice(s.length % 2 ? h + 1 : h))];
}
const EXACT = (fn, deg) => { const r = (deg * Math.PI) / 180; return { sin: Math.sin(r), cos: Math.cos(r), tan: Math.tan(r) }[fn]; };
const RAD = (t) => { const m = t.match(/^(\d*)π(?:\/(\d+))?$/); return ((Number(m[1] || 1) / Number(m[2] || 1)) * 180); };
const surd = (t) => evalJs(t.replace(/−/g, '-').replace(/√(\d)/g, 'Math.sqrt($1)'));

// Returns the expected answer (number or string), or throws if the prompt is unknown.
const SOLVERS = [
  [/^(\d+) × (\d+) = \?$/, (m) => m[1] * m[2]],
  [/^(\d+) ÷ (\d+) = \?$/, (m) => m[1] / m[2]],
  [/remainder when (\d+) is divided by (\d+)/, (m) => m[1] % m[2]],
  [/^What is 1\/(\d+) of (\d+)\?$/, (m) => m[2] / m[1]],
  [/^(\d+)\/(\d+) × (\d+) = \?$/, (m) => (m[1] * m[3]) / m[2]],
  [/(\d+) cubes long, (\d+) cubes wide and (\d+) cubes tall/, (m) => m[1] * m[2] * m[3]],
  [/prism is (\d+) cm long, (\d+) cm wide and (\d+) cm tall/, (m) => m[1] * m[2] * m[3]],
  [/volume of (\d+) cm³\. It is (\d+) cm long and (\d+) cm wide/, (m) => m[1] / (m[2] * m[3])],
  [/^([\d +−×÷()²]+) = \?$/, (m) => evalJs(js(m[1]))],
  [/^How many 1\/(\d+)s are there in (\d+)\?$/, (m) => m[1] * m[2]],
  [/^Solve for x: (.+) = (.+)$/, (m, s) => {
    const x = num(s.answer);
    const f = (e) => evalJs(js(e).replace(/(\d)x/g, '$1*x').replace(/x/g, `(${x})`));
    assert.equal(f(m[1]), f(m[2]), s.prompt); return x;
  }],
  [/triangle has a base of (\d+) cm and a height of (\d+) cm/, (m) => (m[1] * m[2]) / 2],
  [/parallel sides of (\d+) cm and (\d+) cm, and a height of (\d+) cm/, (m) => ((Number(m[1]) + Number(m[2])) * m[3]) / 2],
  [/a (\d+) cm by (\d+) cm rectangle with a triangle .* height is (\d+) cm/, (m) => m[1] * m[2] + (m[1] * m[3]) / 2],
  [/radius of (\d+) cm\. Its circumference is kπ/, (m) => 2 * m[1]],
  [/radius of (\d+) m\. Its area is kπ/, (m) => m[1] ** 2],
  [/diameter of (\d+) in\. Its area is kπ/, (m) => (m[1] / 2) ** 2],
  [/^([\d,.]+) = (\d\.\d) × 10ⁿ/, (m) => Math.round(Math.log10(num(m[1]) / Number(m[2])))],
  [/^\((\d) × 10([⁻⁰-⁹]+)\) × \((\d) × 10([⁻⁰-⁹]+)\) = (\d+) × 10ⁿ/, (m) => { assert.equal(m[1] * m[3], Number(m[5])); return unsup(m[2]) + unsup(m[4]); }],
  [/^y = (.+)\. What is y when x = (.+)\?$/, (m) => evalJs(js(m[1]).replace(/(\d)x/g, `$1*(${num(m[2])})`))],
  [/slope (.+) and passes through \((\d+), (.+)\)\. What is its y-intercept/, (m) => num(m[3]) - num(m[1]) * num(m[2])],
  [/\$(\d+) sign-up fee plus \$(\d+) per month\. What is the total cost, in dollars, for (\d+) months/, (m) => Number(m[1]) + m[2] * m[3]],
  [/\$(\d+) sign-up fee plus \$(\d+) per month\. After how many months will the total cost be \$(\d+)/, (m) => (m[3] - m[1]) / m[2]],
  [/cylinder has radius (\d+) cm and height (\d+) cm/, (m) => m[1] ** 2 * m[2]],
  [/cone has radius (\d+) cm and height (\d+) cm/, (m) => (m[1] ** 2 * m[2]) / 3],
  [/sphere has radius (\d+) cm/, (m) => (4 * m[1] ** 3) / 3],
  [/^f\(x\) = (\d+) · (\d+)ˣ\. Find f\((\d+)\)\.$/, (m) => m[1] * m[2] ** m[3]],
  [/colony of (\d+) bacteria (doubles|triples) every hour\. .* after (\d+) hours/, (m) => m[1] * (m[2] === 'doubles' ? 2 : 3) ** m[3]],
  [/car worth \$(\d+) loses half .* after (\d+) years/, (m) => m[1] / 2 ** m[2]],
  [/^Expand (.+) = (?:x² \+ bx \+ c|Ax² \+ Bx \+ C)\. What is ([bcB])\?$/, (m) => {
    const f = (x) => evalJs(js(m[1]).replace(/(\d)x/g, '$1*x').replace(/\)\(/g, ')*(').replace(/x/g, `(${x})`));
    return m[2] === 'c' ? f(0) : (f(1) - f(-1)) / 2;
  }],
  [/^(.+), … This sequence goes up by the same amount each time\. What is term (\d+)\?$/, (m) => { const v = nums(m[1]); const d = v[1] - v[0]; v.forEach((x, i) => assert.equal(x, v[0] + i * d)); return v[0] + (m[2] - 1) * d; }],
  [/^(.+), … Each term is multiplied by the same number\. What is term (\d+)\?$/, (m) => { const v = nums(m[1]); const r = v[1] / v[0]; return v[0] * r ** (m[2] - 1); }],
  [/term (\d+) is (\S+) and term (\d+) is (\S+)\. What is term 1/, (m) => { const d = (num(m[4]) - num(m[2])) / (m[3] - m[1]); return num(m[2]) - (m[1] - 1) * d; }],
  [/^Find the lower quartile \(Q1\) of: (.+)$/, (m) => quartiles(nums(m[1]))[0]],
  [/^Find the interquartile range \(IQR\) of: (.+)$/, (m) => { const [a, b] = quartiles(nums(m[1])); return b - a; }],
  [/^Data: (.+)\. Using the 1\.5 × IQR rule/, (m) => { const v = nums(m[1]); const [a, b] = quartiles(v); const out = v.filter((x) => x < a - 1.5 * (b - a) || x > b + 1.5 * (b - a)); assert.equal(out.length, 1); return out[0]; }],
  [/box sits on a shelf (\d+) m high/, (m, s) => nums(s.prompt)[0] * 10 * m[1]],
  [/A (\d+) kg cart moves at (\d+) m\/s/, (m) => (m[1] * m[2] ** 2) / 2],
  [/A (\d+) kg ball is dropped from (\d+) m/, (m) => m[1] * 10 * m[2]],
  [/atom of (\w+) \((\w+)\) has atomic number (\d+) and mass number (\d+)\. How many (protons|neutrons)/, (m) => {
    const e = ELEMENTS.find((x) => x[0] === m[2]); assert.ok(e && e[2] === Number(m[3]) && e[3] === Number(m[4]));
    return m[5] === 'protons' ? Number(m[3]) : m[4] - m[3];
  }],
  [/ion has a charge of (\d?)([+−])\. .* atomic number (\d+)\. How many electrons/, (m) => Number(m[3]) - (m[2] === '+' ? 1 : -1) * Number(m[1] || 1)],
  [/1 inch stands for (\d+) miles\. Two towns are (\d+) inches apart/, (m) => m[1] * m[2]],
  [/You earn \$(\d+) a month\. You spend \$(\d+) on rent, \$(\d+) on food and \$(\d+)/, (m) => m[1] - m[2] - m[3] - m[4]],
  [/earn \$(\d+) an hour and work (\d+) hours a week\. (\d+)% is withheld/, (m) => m[1] * m[2] * (1 - m[3] / 100)],
  [/With \$(\d+) take-home pay, how many dollars go to (\w+)\?/, (m) => (m[1] * { needs: 50, wants: 30, savings: 20 }[m[2]]) / 100],
  [/binary number (\d+) in decimal/, (m) => parseInt(m[1], 2)],
  [/Which binary number equals (\d+) in decimal/, (m) => Number(m[1]).toString(2).padStart(8, '0')],
  [/different values can be stored using (\d+) bits/, (m) => 2 ** m[1]],
  [/^(a = .+)\. What is the value of: (.+)\?$/, (m) => {
    const vars = Object.fromEntries(m[1].split(', ').map((p) => p.split(' = ')).map(([k, v]) => [k, v === 'True']));
    const e = m[2].replace(/\bnot\b/g, '!').replace(/\band\b/g, '&&').replace(/\bor\b/g, '||');
    return Function(...Object.keys(vars), `return (${e});`)(...Object.values(vars)) ? 'True' : 'False'; // eslint-disable-line no-new-func
  }],
  [/^What is the exact value of (sin|cos|tan)\((.+)\)\?$/, (m, s) => {
    const deg = m[2].endsWith('°') ? Number(m[2].slice(0, -1)) : RAD(m[2]);
    const want = EXACT(m[1], deg);
    for (const o of s.options) {
      const same = Math.abs(surd(o.label) - want) < 1e-9;
      assert.equal(same, o.id === s.answer, `${s.prompt}: option ${o.label}`);
    }
    return label(s);
  }],
];

function solve(s) {
  if (s.visual?.kind === 'code') {
    const [, x] = s.visual.text.match(/x = (\d+)/) || [];
    const e = s.visual.text.split('\n')[1].replace('result = ', '').replace(/\band\b/g, '&&').replace(/\bor\b/g, '||').replace(/==/g, '===');
    return Function('x', `return (${e});`)(Number(x)) ? 'True' : 'False'; // eslint-disable-line no-new-func
  }
  for (const [re, fn] of SOLVERS) {
    const m = s.prompt.match(re);
    if (m) return fn(m, s);
  }
  return undefined;
}

test('expansion: every computed item re-solves from the prompt, with one right option', () => {
  let checked = 0;
  for (const id of IDS) {
    for (const d of [1, 2, 3]) {
      for (let seed = 1; seed <= 150; seed++) {
        const a = practiceActivity(id, d, seed * 7919 + d, 5);
        assert.deepEqual(validateActivity(a), [], `${id} d${d} seed ${seed}`);
        for (const s of a.steps) {
          const want = solve(s);
          if (want === undefined) continue;
          checked++;
          if (s.options) {
            const got = label(s);
            if (typeof want === 'number') {
              assert.ok(Math.abs(fracVal(got) - want) < 1e-9, `${id}: ${s.prompt} -> ${got}, want ${want}`);
              const equal = s.options.filter((o) => Math.abs(fracVal(o.label) - want) < 1e-9);
              assert.equal(equal.length, 1, `${id}: two options equal the answer in ${s.prompt}`);
            } else assert.equal(got, want, `${id}: ${s.prompt}`);
          } else {
            assert.equal(num(s.answer), Number(want), `${id}: ${s.prompt}`);
            assert.equal(grade(s, String(want)).correct, true);
          }
        }
      }
    }
  }
  assert.ok(checked > 30000, `only ${checked} items re-solved`);
});

test('expansion: fraction items with no prompt solver are checked by value', () => {
  const rand = mulberry32(3);
  for (let i = 0; i < 3000; i++) {
    for (const id of ['fraction-add-subtract', 'multiply-fractions', 'divide-fractions']) {
      const s = generateStep(id, 1 + (i % 3), rand);
      if (!s.options) continue;
      const m = s.prompt.match(/^(\d+)\/(\d+) ([+−×÷]) (\d+)(?:\/(\d+))? = \?$/);
      assert.ok(m, s.prompt);
      const a = m[1] / m[2]; const b = m[4] / (m[5] || 1);
      const want = { '+': a + b, '−': a - b, '×': a * b, '÷': a / b }[m[3]];
      const right = s.options.filter((o) => Math.abs(fracVal(o.label) - want) < 1e-9);
      assert.equal(right.length, 1, `${s.prompt}: ${s.options.map((o) => o.label)}`);
      assert.equal(right[0].id, s.answer);
      const [n, dd] = right[0].label.split('/').map(Number);
      if (dd) assert.equal(gcdT(n, dd), 1, `${s.prompt}: answer ${right[0].label} not in simplest form`);
    }
  }
});
const gcdT = (a, b) => (b ? gcdT(b, a % b) : a);

test('expansion: every mistake code names the mistake it shows', () => {
  const rand = mulberry32(8);
  for (let i = 0; i < 2000; i++) {
    const d = 1 + (i % 3);
    const m = generateStep('multiply-multidigit', 3, rand);
    const [a, b] = nums(m.prompt);
    for (const [v, code] of Object.entries(m.wrong)) if (code === 'partial-product-place') assert.equal(Number(v), a * Math.floor(b / 10) + a * (b % 10));
    const t = generateStep('area-triangles', 1, rand);
    const [base, h] = nums(t.prompt);
    assert.equal(t.wrong[String(base * h)], 'triangle-no-half');
    const c = generateStep('volume-solids', 2, rand);
    const [r, hh] = nums(c.prompt);
    assert.equal(c.wrong[String(r * r * hh)], 'cone-no-third');
    const o = generateStep('order-of-operations', 1, rand);
    const [x, op, y, , z] = o.prompt.split(' ');
    const ltr = (op === '+' ? Number(x) + Number(y) : Number(x) - Number(y)) * Number(z);
    if (o.wrong[String(ltr)]) assert.equal(o.wrong[String(ltr)], 'left-to-right');
    const f = generateStep('fraction-add-subtract', d, rand);
    for (const opt of f.options) if (opt.misconception === 'add-denominators') {
      const [p1, q1, p2, q2] = nums(f.prompt);
      const sign = f.prompt.includes('−') ? -1 : 1;
      assert.equal(fracVal(opt.label), (p1 + sign * p2) / (q1 + sign * q2), f.prompt);
    }
    const at = generateStep('atoms', 3, rand);
    for (const [v, code] of Object.entries(at.wrong)) if (code === 'ion-charge-sign') assert.notEqual(Number(v), Number(at.answer));
  }
});

test('expansion: authored banks have one right answer, distinct options and hints', () => {
  for (const [name, bank] of Object.entries(EXPANSION_BANKS)) {
    for (const level of bank) {
      if (name === 'MAP_BANK' && level.length === 0) continue; // level 2 is computed (map scale)
      assert.ok(level.length >= 3, `${name}: at least three items per level`);
      for (const item of level) {
        const [q, answer, wrong, hint] = name === 'MAIN_IDEA' ? [item[2] + item[1], item[3], item[4], item[5]] : item;
        assert.ok(q.length > 10 && answer && hint, `${name}: ${q}`);
        assert.ok(!wrong.includes(answer), `${name}: answer repeated in "${q}"`);
        assert.equal(new Set(wrong).size, wrong.length, `${name}: duplicate options in "${q}"`);
        assert.ok(wrong.length >= 2, `${name}: needs two wrong options`);
        if (name === 'MAIN_IDEA') assert.ok(item[1].length >= 40 && item[1].length <= 900 && item[0].length <= 60);
      }
    }
  }
});

test('expansion: every new skill has an objective, a lesson, a US placement and valid mistake codes', () => {
  for (const id of IDS) {
    assert.ok(OBJECTIVES[id], `${id} has no objective`);
    assert.ok(LESSONS[id], `${id} has no lesson`);
    assert.ok(US_CATALOGUE.placement[id], `${id} has no US placement`);
    for (const p of OBJECTIVES[id].prereqs) assert.ok(OBJECTIVES[p], `${id}: unknown prerequisite ${p}`);
  }
  for (const code of Object.keys(MISCONCEPTIONS)) assert.ok(MISCONCEPTIONS[code].label && MISCONCEPTIONS[code].parent && MISCONCEPTIONS[code].tip, code);
});

test('prerequisite graph has no cycles', () => {
  const state = {};
  const visit = (id, path) => {
    if (state[id] === 2) return;
    assert.notEqual(state[id], 1, `cycle: ${[...path, id].join(' -> ')}`);
    state[id] = 1;
    for (const p of OBJECTIVES[id].prereqs) visit(p, [...path, id]);
    state[id] = 2;
  };
  for (const id of Object.keys(OBJECTIVES)) visit(id, []);
});

test('typed numbers are marked by value: 0.50 = 0.5, 1,200 = 1200', () => {
  const step = { kind: 'input', prompt: 'x', answer: '0.5', hints: ['h'] };
  assert.equal(grade(step, '0.50').correct, true);
  assert.equal(grade(step, '.5').correct, true);
  assert.equal(grade(step, '5').correct, false);
  const big = { kind: 'input', prompt: 'x', answer: '1200', hints: ['h'] };
  assert.equal(grade(big, '1,200').correct, true);
  assert.equal(grade(big, '12,00').correct, false);
  assert.equal(grade({ kind: 'input', prompt: 'x', answer: '3/8', hints: ['h'] }, '3/8').correct, true);
});
