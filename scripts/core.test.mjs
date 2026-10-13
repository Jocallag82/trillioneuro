// Independent checks for the national core build-out (gen-core-math.js,
// gen-core-subjects.js, core-spec.js, lessons-core.js, standards/registry.js).
// Every computed answer is re-solved here from the prompt the learner sees.
// Run: node --test scripts/*.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { OBJECTIVES } from '../redteddytutor/learn/js/curriculum/framework.js';
import { generateStep, practiceActivity } from '../redteddytutor/learn/js/curriculum/generators.js';
import { CORE_MATH_GENERATORS } from '../redteddytutor/learn/js/curriculum/gen-core-math.js';
import { CORE_HS_GENERATORS, CORE_HS_BANKS } from '../redteddytutor/learn/js/curriculum/gen-core-hs.js';
import { CORE_SUBJECT_GENERATORS, CORE_BANKS as SUBJECT_BANKS, REACTIONS } from '../redteddytutor/learn/js/curriculum/gen-core-subjects.js';
import { CORE_SPEC } from '../redteddytutor/learn/js/curriculum/core-spec.js';
import { LESSONS } from '../redteddytutor/learn/js/curriculum/lessons.js';
import { US_CATALOGUE } from '../redteddytutor/learn/js/curriculum/catalogues/us.js';
import { MISCONCEPTIONS } from '../redteddytutor/learn/js/curriculum/misconceptions.js';
import { STANDARDS, SOURCES, standardOf } from '../redteddytutor/learn/js/curriculum/standards/registry.js';
import { standardsCoverage } from '../redteddytutor/learn/js/curriculum/standards/coverage.js';
import { validateActivity, grade } from '../redteddytutor/learn/js/engine.js';
import { mulberry32 } from '../redteddytutor/learn/game/js/rng.js';

const CORE_BANKS = { ...SUBJECT_BANKS, ...CORE_HS_BANKS };
const SUPV = { '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6 };
const num = (s) => Number(String(s).replace(/−/g, '-').replace(/,/g, '').replace(/^\$/, ''));
const nums = (s) => (String(s).replace(/−/g, '-').replace(/(\d),(\d{3})/g, '$1$2').match(/-?\d+(\.\d+)?/g) || []).map(Number);
const label = (s) => (s.options ? s.options.find((o) => o.id === s.answer).label : s.answer);
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const frac = (n, d) => { const g = gcd(n, d); return `${n / g}/${d / g}`; };
const P = (x, y) => `(${x < 0 ? '−' + -x : x}, ${y < 0 ? '−' + -y : y})`;
const close = (a, b) => Math.abs(a - b) < 1e-9;
const COIN = { dollar: 100, 'dollar bill': 100, 'dollar bills': 100, quarter: 25, quarters: 25, dime: 10, dimes: 10, nickel: 5, nickels: 5, penny: 1, pennies: 1 };
const fmtT = (x) => `${Math.floor(x / 60) > 12 ? Math.floor(x / 60) - 12 : Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`;
const NOTE = { 'whole note': 4, 'half note': 2, 'quarter note': 1, 'eighth note': 0.5 };
const isPrime = (n) => n > 1 && Array.from({ length: n - 2 }, (_, i) => i + 2).every((x) => n % x !== 0);

// [regex, solve(match, step) -> expected label] per skill. Anything unmatched fails.
const SOLVERS = {
  'add-within-10': [
    [/^(\d+) ducks are on a pond\. (\d+) more swim over\. Then (\d+) fly away/, (m) => +m[1] + +m[2] - m[3]],
    [/There are (\d+) apples\. (\d+) are eaten/, (m) => m[1] - m[2]],
    [/There are (\d+) red balls and (\d+) blue balls/, (m) => Number(m[1]) + Number(m[2])],
  ],
  'count-to-120': [[/(\d+), (\d+), (\d+), \?$/, (m) => { const d = m[2] - m[1]; assert.equal(m[3] - m[2], d); return Number(m[3]) + d; }]],
  'missing-addend': [[/has (\d+) \w+ and gets some more\. Now \w+ has (\d+)\./, (m) => m[2] - m[1]], [/got (\d+) more and now has (\d+)\./, (m) => m[2] - m[1]]],
  'compare-lengths': [
    [/The (\w+) is (\d+) cubes long\. The (\w+) is (\d+) cubes long\. How many/, (m) => m[4] - m[2]],
    [/The (\w+) is (\d+) cubes long, the (\w+) is (\d+) cubes long and the (\w+) is (\d+) cubes long\. Which is the (\w+)\?/, (m) => {
      const items = [[m[1], +m[2]], [m[3], +m[4]], [m[5], +m[6]]].sort((a, b) => a[1] - b[1]);
      return m[7] === 'longest' ? items[2][0] : items[0][0];
    }],
  ],
  'count-money': [[/^How much money is (.+)\?$/, (m) => {
    const c = m[1].split(', ').reduce((s, part) => { const [n, ...w] = part.split(' '); return s + Number(n) * COIN[w.join(' ')]; }, 0);
    return `$${(c / 100).toFixed(2)}`;
  }]],
  'skip-counting': [[/by (\d+)s: (\d+), (\d+), (\d+), \?$/, (m) => { assert.equal(m[3] - m[2], Number(m[1])); return Number(m[4]) + Number(m[1]); }]],
  'even-odd': [[/^Is (\d+) even or odd\?$/, (m) => (m[1] % 2 ? 'Odd' : 'Even')]],
  'rounding': [[/^Round (\d+) to the nearest (\d+)\.$/, (m) => Math.floor(m[1] / m[2] + 0.5) * m[2]]],
  'add-subtract-1000': [[/^(\d+) \+ (\d+) = \?$/, (m) => +m[1] + +m[2]], [/^(\d+) − (\d+) = \?$/, (m) => m[1] - m[2]]],
  'multiply-by-tens': [[/^(\d+) × (\d+) = \?$/, (m) => m[1] * m[2]]],
  'elapsed-time': [[/starts at (\d+):(\d+) a\.m\. and lasts (\d+) minutes/, (m) => fmtT(m[1] * 60 + +m[2] + +m[3])]],
  'mass-and-volume': [
    [/holds (\d+) \w+\. How many \w+ do (\d+) of them hold/, (m) => m[1] * m[2]],
    [/has (\d+) \w+\. Another has (\d+) \w+\. How many/, (m) => +m[1] + +m[2]],
  ],
  'factors-multiples': [
    [/^Which number is a factor of (\d+)\?$/, (m, s) => { const ok = s.options.filter((o) => m[1] % Number(o.label) === 0); assert.equal(ok.length, 1, s.prompt); return ok[0].label; }],
    [/^Which number is a multiple of (\d+)\?$/, (m, s) => { const ok = s.options.filter((o) => Number(o.label) % m[1] === 0); assert.equal(ok.length, 1, s.prompt); return ok[0].label; }],
    [/^Is (\d+) prime or composite\?$/, (m) => (isPrime(+m[1]) ? 'Prime' : 'Composite')],
  ],
  'place-value-millions': [
    [/digit in the (hundred thousands|ten thousands|thousands) place of ([\d,]+)/, (m) => { const s = String(num(m[2])); const pos = { 'hundred thousands': 0, 'ten thousands': 1, thousands: 2 }[m[1]]; return Number(s[pos]) * 10 ** (5 - pos); }],
    [/greater: ([\d,]+) or ([\d,]+)\?/, (m) => (num(m[1]) > num(m[2]) ? m[1] : m[2])],
    [/^Round ([\d,]+) to the nearest ([\d,]+)\.$/, (m) => (Math.floor(num(m[1]) / num(m[2]) + 0.5) * num(m[2])).toLocaleString('en-US')],
  ],
  'equivalent-fractions': [
    [/^(\d+)\/(\d+) = \?\/(\d+)$/, (m) => (m[1] * m[3]) / m[2]],
    [/^Write (\d+)\/(\d+) in simplest form\.$/, (m) => frac(+m[1], +m[2])],
  ],
  'unit-conversion': [[/^(\d+) (\w+) = \? (\w+)$/, (m) => m[1] * { 'feet inches': 12, 'yards feet': 3, 'hours minutes': 60, 'meters centimeters': 100, 'kilograms grams': 1000, 'pounds ounces': 16, 'gallons quarts': 4, 'kilometers meters': 1000, 'days hours': 24, 'liters milliliters': 1000 }[`${m[2]} ${m[3]}`]]],
  'angles': [
    [/measures (\d+)°\. What kind/, (m) => (m[1] < 90 ? 'Acute' : +m[1] === 90 ? 'Right' : 'Obtuse')],
    [/make a (?:right angle \(90°\)|straight line \(180°\))\. One is (\d+)°/, (m, s) => (s.prompt.includes('90°)') ? 90 : 180) - m[1]],
  ],
  'decimal-operations': [[/^([\d.]+) ([+−×]) ([\d.]+) = \?$/, (m) => { const a = +m[1]; const b = +m[3]; return Math.round((m[2] === '+' ? a + b : m[2] === '−' ? a - b : a * b) * 100) / 100; }]],
  'powers-of-ten': [[/^([\d.]+) ([×÷]) (\d+) = \?$/, (m) => Math.round((m[2] === '×' ? m[1] * m[3] : m[1] / m[3]) * 1000) / 1000]],
  'coordinate-plane': [
    [/distance between \((.+), (.+)\) and \((.+), (.+)\)\?/, (m) => { assert.equal(num(m[1]), num(m[3])); return Math.abs(num(m[2]) - num(m[4])); }],
    [/quadrant is the point \((.+), (.+)\)\?/, (m) => { const x = num(m[1]); const y = num(m[2]); return x > 0 && y > 0 ? 'Quadrant I' : x < 0 && y > 0 ? 'Quadrant II' : x < 0 ? 'Quadrant III' : 'Quadrant IV'; }],
    [/Move (\d+) (left|right) and (\d+) (down|up)/, (m) => P(m[2] === 'left' ? -m[1] : +m[1], m[4] === 'down' ? -m[3] : +m[3])],
  ],
  'gcf-lcm': [
    [/greatest common factor of (\d+) and (\d+)/, (m) => gcd(+m[1], +m[2])],
    [/least common multiple of (\d+) and (\d+)/, (m) => (m[1] * m[2]) / gcd(+m[1], +m[2])],
    [/packs of (\d+) and rolls in packs of (\d+)/, (m) => (m[1] * m[2]) / gcd(+m[1], +m[2])],
  ],
  'multi-digit-division': [[/^(\d+) ÷ (\d+) = \?$/, (m) => { assert.equal(m[1] % m[2], 0); return m[1] / m[2]; }]],
  'absolute-value': [
    [/^\|(.+)\| = \?$/, (m) => Math.abs(num(m[1]))],
    [/^Which is less: (.+) or (.+)\?$/, (m) => (num(m[1]) < num(m[2]) ? m[1] : m[2])],
    [/was (.+)°F in the morning and (\d+)°F/, (m) => +m[2] - num(m[1])],
  ],
  'expressions': [
    [/^Evaluate (\d+)x \+ (\d+) when x = (\d+)\.$/, (m) => m[1] * m[3] + +m[2]],
    [/^Evaluate x² \+ (\d+)x when x = (\d+)\.$/, (m) => m[2] * m[2] + m[1] * m[2]],
    [/equivalent to (\d+)\(x \+ (\d+)\)\?/, (m) => `${m[1]}x + ${m[1] * m[2]}`],
  ],
  'inequalities': [
    [/solution of x ([<>]) (\d+)\?/, (m, s) => { const ok = s.options.filter((o) => (m[1] === '>' ? +o.label > +m[2] : +o.label < +m[2])); assert.equal(ok.length, 1); return ok[0].label; }],
    [/^Solve: x \+ (\d+) ([<>]) (\d+)$/, (m) => `x ${m[2]} ${m[3] - m[1]}`],
    [/^Solve: −(\d+)x ([<>]) (.+)$/, (m) => `x ${m[2] === '>' ? '<' : '>'} ${num(m[3]) / -m[1]}`],
  ],
  'proportional-relationships': [
    [/^3 notebooks cost \$(\d+)\. .* how many dollars do (\d+) notebooks/, (m) => (m[1] / 3) * m[2]],
    [/When x = (\d+), y = (\d+)\. What is the constant/, (m) => m[2] / m[1]],
    [/^Which table shows a proportional relationship/, (m, s) => {
      const ok = s.options.filter((o) => { const pairs = [...o.label.matchAll(/\((\d+), (\d+)\)/g)].map((p) => p[2] / p[1]); return pairs.every((r) => r === pairs[0]); });
      assert.equal(ok.length, 1); return ok[0].label;
    }],
  ],
  'angle-relationships': [
    [/supplementary\. One measures (\d+)°/, (m) => 180 - m[1]],
    [/One measures (\d+)°\. What is the angle vertical/, (m) => +m[1]],
    [/triangle has angles of (\d+)° and (\d+)°/, (m) => 180 - m[1] - m[2]],
  ],
  'surface-area': [
    [/cube has edges of (\d+) cm/, (m) => 6 * m[1] ** 2],
    [/prism is (\d+) cm long, (\d+) cm wide and (\d+) cm tall/, (m) => 2 * (m[1] * m[2] + m[1] * m[3] + m[2] * m[3])],
  ],
  'sampling': [
    [/^Which sample is most likely/, () => '50 students chosen at random from the school list'],
    [/sample of (\d+) students, (\d+) walk .* of the (\d+) students/, (m) => (m[2] * m[3]) / m[1]],
  ],
  'compound-probability': [
    [/flip a coin and roll a number cube/, () => '1/12'],
    [/bag has (\d+) marbles; (\d+) are red\. You pick one, put it back/, (m) => frac(m[2] * m[2], m[1] * m[1])],
  ],
  'square-roots': [
    [/^√(\d+) = \?$/, (m) => Math.sqrt(+m[1])],
    [/^√(\d+) lies between/, (m) => { const lo = Math.floor(Math.sqrt(+m[1])); assert.ok(lo * lo !== +m[1]); return `${lo} and ${lo + 1}`; }],
    [/^Is (.+) rational or irrational\?$/, (m) => ({ '√49': 'Rational', '√2': 'Irrational', '0.75': 'Rational', 'π': 'Irrational', '√16': 'Rational', '√10': 'Irrational', '2/3': 'Rational', '√5': 'Irrational', '0.333…': 'Rational' })[m[1]]],
  ],
  'transformations': [
    [/^Translate \((.+), (.+)\) by (\d+) (left|right) and (\d+) (down|up)/, (m) => P(num(m[1]) + (m[4] === 'left' ? -m[3] : +m[3]), num(m[2]) + (m[6] === 'down' ? -m[5] : +m[5]))],
    [/^Reflect \((.+), (.+)\) across the (x|y)-axis/, (m) => (m[3] === 'x' ? P(num(m[1]), -num(m[2])) : P(-num(m[1]), num(m[2])))],
    [/^Rotate \((.+), (.+)\) (90|180)° counterclockwise/, (m) => (m[3] === '180' ? P(-num(m[1]), -num(m[2])) : P(-num(m[2]), num(m[1])))],
  ],
  'two-way-tables': [
    [/Grade 7: (\d+) like soccer, (\d+) do not\. Grade 8: (\d+) like soccer, (\d+) do not\. (.+)$/, (m) => {
      const [a, b, c, e] = [+m[1], +m[2], +m[3], +m[4]];
      if (/altogether/.test(m[5])) return a + b + c + e;
      if (/How many students like soccer/.test(m[5])) return a + c;
      return frac(a, a + b);
    }],
  ],
  'distance-midpoint': [
    [/^Find the midpoint of \((.+), (.+)\) and \((.+), (.+)\)\.$/, (m) => P((num(m[1]) + num(m[3])) / 2, (num(m[2]) + num(m[4])) / 2)],
    [/distance between \((.+), (.+)\) and \((.+), (.+)\)\?/, (m) => Math.hypot(num(m[3]) - num(m[1]), num(m[4]) - num(m[2]))],
  ],
  'scale-drawings': [
    [/represents (\d+) km\. Two towns are (\d+) km apart/, (m) => m[2] / m[1]],
    [/represents (\d+) km\. Two towns are (\d+) cm apart/, (m) => m[1] * m[2]],
  ],
  'unit-rate-fractions': [[/crawls (\d+)\/(\d+) of a meter in 1\/(\d+) of an hour/, (m) => { assert.equal(m[2], m[3]); return +m[1]; }]],
  // ---- Computed items in gen-core-subjects.js ----
  'waves': [
    [/frequency of (\d+) Hz and a wavelength of (\d+) m/, (m) => m[1] * m[2]],
    [/travels at (\d+) m\/s with a frequency of (\d+) Hz/, (m) => m[1] / m[2]],
  ],
  'chemical-reactions': [[/^Fill in the coefficient to balance the equation: (.+)$/, (m) => {
    const r = REACTIONS.find((x) => x[0] === m[1]);
    assert.ok(r, m[1]);
    const count = (side) => side.reduce((acc, [n, f]) => { for (const [el, k] of Object.entries(f)) acc[el] = (acc[el] || 0) + n * k; return acc; }, {});
    assert.deepEqual(count(r[2]), count(r[3]), `${m[1]} does not balance`);
    return r[1];
  }]],
  'credit-interest': [[/save \$(\d+) at (\d+)% interest compounded once a year\. .* after (\d+) years/, (m) => {
    let b = +m[1]; for (let i = 0; i < +m[3]; i++) b += (b * m[2]) / 100; return Math.round(b);
  }]],
  'loops': [[/^What does this program print\?$/, (m, s) => {
    const code = s.visual.text;
    let mm;
    if ((mm = code.match(/^total = (\d+)\nfor i in range\((\d+)\):\n {4}total = total \+ (\d+)\nprint\(total\)$/))) return +mm[1] + mm[2] * mm[3];
    if ((mm = code.match(/^x = (\d+)\ncount = 0\nwhile x < (\d+):\n {4}x = x \+ (\d+)\n {4}count = count \+ 1\nprint\(count\)$/))) { let x = +mm[1]; let c = 0; while (x < +mm[2]) { x += +mm[3]; c++; } return c; }
    throw new Error(`unknown program ${code}`);
  }]],
  'data-representation': [
    [/different values can (\d+) bits?/, (m) => 2 ** m[1]],
    [/bits are in (\d+) bytes/, (m) => m[1] * 8],
    [/file is (\d+) MB/, (m) => m[1] * 1000],
  ],
  'search-sort': [
    [/linear search check in a list of (\d+)/, (m) => +m[1]],
    [/sorted list of (\d+) items with each check/, (m) => Math.log2(+m[1])],
  ],
  'similarity': [
    [/scale factor of (\d+)\. The smaller has an area of (\d+) cm²/, (m) => m[2] * m[1] ** 2],
    [/AB = (\d+), BC = (\d+) and DE = (\d+)\. What is EF/, (m) => (m[2] * m[3]) / m[1]],
  ],
  'circle-geometry': [
    [/central angle measures (\d+)°\. What is the measure of an inscribed angle/, (m) => m[1] / 2],
    [/radius (\d+) cm\. An arc has a central angle of (\d+)°/, (m) => (2 * m[1] * m[2]) / 360],
    [/radius (\d+) cm\. A sector has a central angle of (\d+)°/, (m) => (m[1] ** 2 * m[2]) / 360],
  ],
  'normal-distribution': [
    [/mean (\d+) and standard deviation (\d+)\. What is the z-score of (\d+)/, (m) => (m[3] - m[1]) / m[2]],
    [/mean (\d+) cm and standard deviation (\d+) cm\. About what percent lie between (\d+) and (\d+)/, (m) => { const k = (m[4] - m[1]) / m[2]; assert.equal((m[1] - m[3]) / m[2], k); return `${{ 1: 68, 2: 95, 3: 99.7 }[k]}%`; }],
  ],
  'integrals': [
    [/^Find an antiderivative of (\d+)x([²³⁴⁵⁶]?)\.$/, (m) => { const n = m[2] ? SUPV[m[2]] : 1; const c = m[1] / (n + 1); const e = n + 1; return `${c}x${e === 1 ? '' : Object.keys(SUPV).find((k) => SUPV[k] === e)} + C`; }],
    [/definite integral of (\d+)x([²³]?) from x = 0 to x = (\d+)/, (m) => { const n = m[2] ? SUPV[m[2]] : 1; return (m[1] * m[3] ** (n + 1)) / (n + 1); }],
  ],
  'momentum': [
    [/^A (\d+) kg cart moves at (\d+) m\/s\. What is its momentum/, (m) => m[1] * m[2]],
    [/A (\d+) kg cart moving at (\d+) m\/s hits a (\d+) kg cart at rest/, (m) => (m[1] * m[2]) / (+m[1] + +m[3])],
    [/acts on a (\d+) kg object for (\d+) s and changes its velocity by (\d+) m\/s/, (m) => (m[1] * m[3]) / m[2]],
  ],
  'algorithm-efficiency': [
    [/runs once for each of (\d+) items/, (m) => +m[1]],
    [/both run over the same (\d+) items/, (m) => m[1] * m[1]],
  ],
  'music-rhythm': [
    [/how many beats does a (\w+ note) get/, (m) => NOTE[m[1]]],
    [/how many beats do (\d+) (\w+ note)s? and one (\w+ note) last/, (m) => m[1] * NOTE[m[2]] + NOTE[m[3]]],
  ],
};

const COMPUTED = Object.keys(SOLVERS);

function expected(id, step) {
  for (const [re, fn] of SOLVERS[id]) {
    const m = step.prompt.match(re);
    if (m) return fn(m, step);
  }
  // Mixed generators fall back to an authored tier (checked by the bank test below).
  if (step.options && !step.kind) return null;
  throw new Error(`${id}: no solver for "${step.prompt}"`);
}

test('core: every computed item re-solves to its answer key, 600 seeds × 3 levels', () => {
  for (const id of COMPUTED) {
    const rand = mulberry32(id.length * 7919);
    for (let i = 0; i < 600; i++) for (const d of [1, 2, 3]) {
      const s = generateStep(id, d, rand);
      const want = expected(id, s);
      if (want === null) continue;
      const got = label(s);
      if (typeof want === 'number') assert.ok(close(num(got), want), `${id} d${d}: "${s.prompt}" key ${got}, expected ${want}`);
      else assert.equal(String(got), String(want), `${id} d${d}: "${s.prompt}"`);
      // The engine marks the key right and every other option wrong.
      if (s.kind === 'input') assert.equal(grade(s, s.answer).correct, true, `${id}: key not accepted`);
      for (const w of Object.keys(s.wrong || {})) assert.equal(grade(s, w).correct, false, `${id}: tagged wrong value ${w} marked right in "${s.prompt}"`);
      // Choices: exactly one option carries the key, and no distractor has the key's value.
      if (s.options) {
        assert.equal(s.options.filter((o) => o.id === s.answer).length, 1, `${id}: key missing in "${s.prompt}"`);
        if (typeof want === 'number') assert.ok(s.options.filter((o) => close(num(o.label), want)).length === 1, `${id}: two options equal the answer in "${s.prompt}"`);
      }
    }
  }
});

test('core: every generator yields valid, varied practice sets with real mistake codes', () => {
  for (const id of [...Object.keys(CORE_MATH_GENERATORS), ...Object.keys(CORE_SUBJECT_GENERATORS), ...Object.keys(CORE_HS_GENERATORS)]) {
    const prompts = new Set();
    for (let seed = 1; seed <= 40; seed++) {
      const a = practiceActivity(id, [1, 2, 3, 2, 3], seed);
      assert.deepEqual(validateActivity(a), [], `${id} seed ${seed}`);
      for (const s of a.steps) {
        prompts.add(s.prompt + (s.visual?.text || ''));
        for (const o of s.options || []) if (o.misconception) assert.ok(MISCONCEPTIONS[o.misconception], `${id}: unknown code ${o.misconception}`);
        for (const c of Object.values(s.wrong || {})) assert.ok(MISCONCEPTIONS[c], `${id}: unknown code ${c}`);
        assert.ok(!s.options?.find((o) => o.id === s.answer)?.misconception, `${id}: right answer tagged as a mistake`);
      }
    }
    // Not "hundreds of trivial variations" of one item, nor a single repeated item.
    assert.ok(prompts.size >= 9, `${id}: only ${prompts.size} distinct items across 40 sets`);
  }
});

test('core: authored banks have one right answer, distinct options, a hint and three tiers', () => {
  let items = 0;
  for (const [name, tiers] of Object.entries(CORE_BANKS)) {
    assert.equal(tiers.length, 3, `${name} needs three difficulty tiers`);
    const seen = new Set();
    for (const tier of tiers) {
      assert.ok(tier.length >= 3, `${name}: a tier has fewer than 3 items`);
      for (const [q, a, wrong, hint] of tier) {
        items++;
        assert.ok(q && a && hint, `${name}: incomplete item ${q}`);
        assert.ok(wrong.length >= 1 && !wrong.includes(a), `${name}: answer repeated among distractors in ${q}`);
        assert.equal(new Set(wrong).size, wrong.length, `${name}: duplicate distractor in ${q}`);
        assert.ok(!seen.has(q), `${name}: duplicate question ${q}`);
        seen.add(q);
        // A hint that contains the full answer gives it away.
        if (a.length > 4) assert.ok(!hint.toLowerCase().includes(a.toLowerCase()), `${name}: hint reveals the answer in ${q}`);
      }
    }
  }
  assert.ok(items >= 435, `only ${items} authored items`);
});

test('core: no question is duplicated across all banks', () => {
  const all = Object.values(CORE_BANKS).flat(2).map((it) => it[0]);
  assert.equal(new Set(all).size, all.length);
});

test('core: every new skill has objective, lesson with two worked examples, placement and in-range prerequisites', () => {
  for (const [id, r] of Object.entries(CORE_SPEC)) {
    assert.ok(OBJECTIVES[id], id);
    const l = LESSONS[id];
    assert.ok(l, `${id} has no lesson`);
    assert.ok(l.ideas.length >= 3 && l.intro && l.watch, `${id}: thin lesson`);
    assert.ok([l.example, ...(l.more || [])].length >= 2, `${id}: fewer than two worked examples`);
    for (const ex of [l.example, ...l.more]) assert.ok(ex.problem && ex.steps.length && ex.answer, `${id}: incomplete example`);
    const p = US_CATALOGUE.placement[id];
    assert.deepEqual(p.grades, r.grades);
    assert.ok(US_CATALOGUE.courses.some((c) => c.id === p.course), `${id}: unknown course ${p.course}`);
    for (const s of p.standards) assert.ok(SOURCES[s.framework], `${id}: unknown framework ${s.framework}`);
  }
});

test('core: computed worked examples in lessons are right', () => {
  const checks = {
    'missing-addend': [[13 - 8, 5], [15 - 6, 9]], 'add-subtract-1000': [[458 + 276, 734], [512 - 238, 274]],
    'multi-digit-division': [[672 / 21, 32], [936 / 24, 39]], 'surface-area': [[6 * 16, 96], [2 * (15 + 10 + 6), 62]],
    'distance-midpoint': [[Math.hypot(3, 4), 5]], 'credit-interest': [[100 * 1.1 * 1.1, 121], [200 * 1.5 * 1.5, 450]],
    'waves': [[5 * 4, 20], [340 / 170, 2]], 'similarity': [[7 * 3, 21], [5 * 9, 45]], 'momentum': [[4 * 6, 24], [24 / 8, 3]], 'integrals': [[2 * 2 ** 2, 8]], 'algorithm-efficiency': [[30 * 30, 900]], 'sampling': [[(8 / 40) * 600, 120]], 'multiply-by-tens': [[7 * 500, 3500], [6 * 40, 240]],
  };
  for (const [id, pairs] of Object.entries(checks)) {
    const answers = [LESSONS[id].example, ...LESSONS[id].more].map((e) => nums(e.answer)[0]);
    for (const [calc, shown] of pairs) {
      assert.ok(close(calc, shown), `${id}: arithmetic ${calc} ≠ ${shown}`);
      assert.ok(answers.some((a) => close(a, shown)), `${id}: lesson does not show ${shown}`);
    }
  }
});

test('standards registry: counts match the published totals and codes are unique', () => {
  const by = {};
  for (const s of STANDARDS) by[s.framework] = (by[s.framework] || 0) + 1;
  for (const [fw, src] of Object.entries(SOURCES)) assert.equal(by[fw], src.publishedTotal, fw);
  const keys = STANDARDS.map((s) => `${s.framework}:${s.code}`);
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(standardOf('CCSS-M', '3.NF.A.3.D'), '3.NF.A.3');
  assert.equal(standardOf('CCSS-ELA', 'RF.K.1.D'), 'RF.K.1');
});

test('standards coverage: every K-8 mapped code exists in the registry, and taught ⊆ mapped, fully ⊆ assessed', () => {
  const c = standardsCoverage(US_CATALOGUE);
  assert.deepEqual(c.unknownCodes, [], 'mapped codes that are not in the registry');
  for (const f of Object.values(c.byFramework)) {
    assert.ok(f.mapped <= f.total && f.taught <= f.mapped && f.assessed <= f.mapped && f.full <= f.assessed && f.reviewed === 0);
  }
  assert.equal(c.overall.total, 810);
});

test('quality module shown on /curriculum matches the published skills', async () => {
  const { QUALITY } = await import('../redteddytutor/learn/js/curriculum/quality.js');
  assert.deepEqual(Object.keys(QUALITY.pass).sort(), Object.keys(OBJECTIVES).sort(), 'run node scripts/quality-gate.mjs');
  assert.equal(QUALITY.passing, Object.values(QUALITY.pass).filter(Boolean).length);
});

test('state layer: 50 states + DC, none verified, national baseline never reported as aligned', async () => {
  const { STATES, allStateStatus } = await import('../redteddytutor/learn/js/curriculum/standards/states.js');
  assert.equal(Object.keys(STATES).length, 51);
  for (const s of allStateStatus()) {
    assert.equal(s.verifiedSkills, 0);
    for (const k of ['math', 'ela', 'science']) assert.ok(!/aligned|(^|-)verified$/.test(s[k]), `${s.code} ${k}: ${s[k]}`);
  }
});

test('planner: no quick-check outcome leaves a learner with fewer than two things to do', async () => {
  const L = await import('../redteddytutor/learn/js/learner.js');
  for (const subject of ['maths', 'literacy', 'science']) for (const band of ['5-7', '7-9', '9-11', '11-14', '14-18']) {
    for (let bits = 0; bits < 128; bits++) {
      let d = L.startDiagnostic(subject, band);
      if (!d) continue;
      const steps = []; let i = 0;
      while (!d.done) { const c = Boolean((bits >> i++) & 1); steps.push({ activityId: `dx-${subject}`, skill: d.rungs[d.pos], firstTry: c, at: 1e12, correct: c, hints: 0, difficulty: 2, source: 'diagnostic' }); d = L.answerDiagnostic(d, c); }
      const r = L.diagnosticResult(d);
      const p = L.plan({ v: 1, settings: { band, focus: subject, placement: { [subject]: r.start }, assumed: r.assumed, onboarded: true }, steps, sessions: [] }, 1e12 + 1000);
      assert.ok(p.length >= 2, `${subject} ${band} pattern ${bits.toString(2)}: plan ${JSON.stringify(p.map((x) => x.objective))}`);
    }
  }
});
