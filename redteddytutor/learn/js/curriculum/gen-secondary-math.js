// Generated practice for middle and high school math (grades 6 to 12).
//
// Same rules as generators.js: every answer is computed here from the numbers the
// learner sees, and only wrong answers that genuinely show a known mistake carry its
// code. scripts/curriculum.test.mjs re-solves these items independently.
import { int, pick, shuffled, choice, input } from './kit.js';

// Typed negative numbers use a real minus sign on screen; the engine accepts - or −.
export const signed = (n) => (n < 0 ? `−${-n}` : String(n));
const paren = (n) => (n < 0 ? `(${signed(n)})` : String(n));
const SUP = { 0: '⁰', 1: '¹', 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷', 8: '⁸', 9: '⁹' };
export const sup = (n) => String(n).split('').map((d) => SUP[d]).join('');
const nonZero = (rand, lo, hi) => { let v = 0; while (v === 0) v = int(rand, lo, hi); return v; };
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const frac = (n, d) => `${n}/${d}`;

// ---------- Grades 6-8 ----------
function integers(d, rand) {
  const a = nonZero(rand, -12, 12);
  const b = nonZero(rand, -12, 12);
  let prompt; let ans;
  if (d === 1) { prompt = `${paren(a)} + ${paren(b)} = ?`; ans = a + b; }
  else if (d === 2) { prompt = `${paren(a)} − ${paren(b)} = ?`; ans = a - b; }
  else { prompt = `${paren(a)} × ${paren(b)} = ?`; ans = a * b; }
  const wrong = ans !== 0 ? { [-ans]: 'integer-sign' } : {};
  return input(prompt, ans, [
    d === 3 ? 'Multiply the sizes first. Then: same signs give a positive answer, different signs give a negative one.'
      : 'Picture a number line. Adding a negative moves left; subtracting a negative moves right.',
    d === 2 ? 'Subtracting a number is the same as adding its opposite: a − (−b) = a + b.' : 'Work out the size of the answer first, then decide its sign.',
  ], wrong);
}

const RATE_CONTEXTS = [
  ['A car travels {t} miles in {n} hours. How many miles does it travel per hour?', 'miles per hour'],
  ['A printer prints {t} pages in {n} minutes. How many pages does it print per minute?', 'pages per minute'],
  ['{n} tickets cost ${t}. How many dollars does one ticket cost?', 'dollars per ticket'],
  ['A pump fills {t} gallons in {n} minutes. How many gallons per minute?', 'gallons per minute'],
];
function ratiosRates(d, rand) {
  if (d === 3) {
    const pA = int(rand, 2, 9); const pB = pA + pick(rand, [-1, 1, 2]);
    if (pB < 1 || pB === pA) return ratiosRates(2, rand);
    const nA = int(rand, 3, 8); const nB = int(rand, 3, 8);
    const better = pA < pB ? 'Store A' : 'Store B';
    return {
      prompt: `Store A sells ${nA} notebooks for $${nA * pA}. Store B sells ${nB} notebooks for $${nB * pB}. Which store has the better price per notebook?`,
      answer: better, options: [{ id: 'Store A', label: 'Store A' }, { id: 'Store B', label: 'Store B' }],
      hints: ['Find the unit price at each store: total cost ÷ number of notebooks.', 'The lower price per notebook is the better buy.'],
    };
  }
  if (d === 2) {
    const a = int(rand, 2, 6); const b = int(rand, 2, 6); const k = int(rand, 2, 5);
    return input(`A recipe uses ${a} cups of flour for every ${b} batches of cookies. How many cups of flour are needed for ${b * k} batches?`, a * k,
      [`How many times bigger is ${b * k} than ${b}?`, 'Multiply both parts of the ratio by that same number.'],
      { [a + (b * k - b)]: 'additive-scaling' });
  }
  const [tmpl] = pick(rand, RATE_CONTEXTS);
  const n = int(rand, 2, 9); const u = int(rand, 3, 15); const t = n * u;
  return input(tmpl.replace('{t}', t).replace('{n}', n), u,
    ['A unit rate is the amount for one: divide the total by the number of units.', `Work out ${t} ÷ ${n}.`],
    { [t * n]: 'wrong-operation' });
}

function meanMedian(d, rand) {
  if (d === 1) {
    let vals;
    do { vals = Array.from({ length: 5 }, () => int(rand, 1, 30)); } while (new Set(vals).size < 5);
    const sorted = [...vals].sort((x, y) => x - y);
    const wrong = vals[2] !== sorted[2] ? { [vals[2]]: 'median-unsorted' } : {};
    return input(`Find the median of: ${vals.join(', ')}`, sorted[2],
      ['Put the numbers in order from smallest to largest.', 'The median is the middle number once they are in order.'], wrong);
  }
  if (d === 2) {
    const n = pick(rand, [4, 5, 6]);
    const mean = int(rand, 4, 20);
    const vals = Array.from({ length: n - 1 }, () => int(rand, Math.max(1, mean - 8), mean + 8));
    const last = mean * n - vals.reduce((s, v) => s + v, 0);
    if (last < 1 || last > 60) return meanMedian(2, rand);
    vals.push(last);
    return input(`Find the mean of: ${shuffled(vals, rand).join(', ')}`, mean,
      ['Add all the numbers together.', `Then divide the total by how many numbers there are (${n}).`]);
  }
  const vals = Array.from({ length: 6 }, () => int(rand, 2, 60));
  const range = Math.max(...vals) - Math.min(...vals);
  return input(`Find the range of: ${vals.join(', ')}`, range,
    ['The range is the largest value minus the smallest value.', 'Find the largest and the smallest first.'], { [Math.max(...vals)]: 'one-step-only' });
}

function percent(d, rand) {
  if (d === 3) {
    const price = 20 * int(rand, 2, 15);
    const p = pick(rand, [10, 15, 20, 25, 30, 40, 50]);
    const off = (price * p) / 100;
    return input(`A jacket costs $${price}. It is on sale for ${p}% off. What is the sale price, in dollars?`, price - off,
      [`First find ${p}% of $${price}.`, 'Then take that discount away from the original price.'],
      { [off]: 'one-step-only', [price + off]: 'wrong-operation' });
  }
  const p = d === 1 ? pick(rand, [10, 25, 50, 20]) : 5 * int(rand, 1, 19);
  const base = d === 1 ? 20 * int(rand, 1, 10) : 20 * int(rand, 1, 15);
  const ans = (base * p) / 100;
  if (!Number.isInteger(ans)) return percent(d, rand);
  return input(`What is ${p}% of ${base}?`, ans,
    [`${p}% means ${p} out of every 100.`, p % 10 === 0 ? `Find 10% of ${base} first, then scale it.` : `Find 1% of ${base}, or 5%, then build up to ${p}%.`]);
}

function exponents(d, rand) {
  if (d === 1) {
    const b = int(rand, 2, 5); const n = int(rand, 2, b === 2 ? 6 : 4);
    return input(`${b}${sup(n)} = ?`, b ** n, [`${b}${sup(n)} means ${Array(n).fill(b).join(' × ')}.`, 'Multiply one step at a time.'],
      b * n !== b ** n ? { [b * n]: 'power-as-product' } : {});
  }
  const m = int(rand, 2, 6); const n = int(rand, 2, 6);
  if (d === 2 || rand() < 0.5) {
    return input(`x${sup(m)} · x${sup(n)} = xⁿ. What is n?`, m + n,
      ['Write out the factors: how many x’s are multiplied altogether?', 'Same base multiplied: add the exponents.'],
      m * n !== m + n ? { [m * n]: 'exponent-law-mix' } : {});
  }
  return input(`(x${sup(m)})${sup(n)} = xᵏ. What is k?`, m * n,
    [`(x${sup(m)})${sup(n)} means x${sup(m)} multiplied by itself ${n} times.`, 'A power of a power: multiply the exponents.'],
    m * n !== m + n ? { [m + n]: 'exponent-law-mix' } : {});
}

function probability(d, rand) {
  const r = int(rand, 1, 6); const b = int(rand, 1, 6); const g = d === 1 ? 0 : int(rand, 1, 5);
  const total = r + b + g;
  const bag = [`${r} red`, `${b} blue`, g ? `${g} green` : null].filter(Boolean).join(', ');
  const want = d === 3 ? total - r : r;
  const prompt = d === 3
    ? `A bag has ${bag} marbles. One is picked without looking. What is the probability that it is NOT red?`
    : `A bag has ${bag} marbles. One is picked without looking. What is the probability that it is red?`;
  const answer = frac(want, total);
  const other = total - want;
  const wrong = [];
  if (other > 0 && want / other !== want / total) wrong.push({ value: frac(want, other), misconception: 'part-to-part' });
  wrong.push({ value: frac(other, total) });
  wrong.push({ value: frac(want, total + 1) });
  wrong.push({ value: frac(1, total) });
  // Two fractions with the same value would both be right, so keep only distinct values.
  const seen = new Set([want / total]);
  const distinct = wrong.filter((w) => { const [n, dd] = w.value.split('/').map(Number); const v = n / dd; if (seen.has(v)) return false; seen.add(v); return true; });
  return choice(rand, {
    prompt, answer, wrong: distinct, size: 4,
    hints: [`Count all the marbles: there are ${total}.`, d === 3 ? 'How many marbles are not red? Put that over the total.' : 'Put the number of red marbles over the total number of marbles.'],
  });
}

function equationsTwoStep(d, rand) {
  const x = d === 3 ? nonZero(rand, -9, 12) : int(rand, 1, 12);
  if (d === 1) {
    if (rand() < 0.5) {
      const q = int(rand, 3, 25);
      return input(`Solve for x: x + ${q} = ${x + q}`, x, [`What number plus ${q} makes ${x + q}?`, `Subtract ${q} from both sides.`], { [x + 2 * q]: 'inverse-operation' });
    }
    const p = int(rand, 2, 9);
    return input(`Solve for x: ${p}x = ${p * x}`, x, [`${p}x means ${p} times x.`, `Divide both sides by ${p}.`], { [p * x - p]: 'inverse-operation' });
  }
  const p = int(rand, 2, 9);
  const q = nonZero(rand, -20, 20);
  const rhs = p * x + q;
  const op = q < 0 ? `− ${-q}` : `+ ${q}`;
  const wrong = {};
  const addInstead = (rhs + q) / p;
  if (Number.isInteger(addInstead) && addInstead !== x) wrong[addInstead] = 'inverse-operation';
  return input(`Solve for x: ${p}x ${op} = ${signed(rhs)}`, x,
    [q < 0 ? `First undo the − ${-q}: add ${-q} to both sides.` : `First undo the + ${q}: subtract ${q} from both sides.`, `Then divide both sides by ${p}. Check by substituting your answer back in.`],
    wrong);
}

const TRIPLES = [[3, 4, 5], [5, 12, 13], [8, 15, 17], [7, 24, 25], [6, 8, 10], [9, 12, 15], [20, 21, 29], [12, 16, 20]];
function pythagorean(d, rand) {
  const [a, b, c] = pick(rand, d === 1 ? TRIPLES.slice(0, 2).concat([[6, 8, 10]]) : TRIPLES);
  if (d === 3) {
    return input(`A right triangle has a hypotenuse of ${c} and one leg of ${a}. How long is the other leg?`, b,
      ['The hypotenuse is the longest side: c² = a² + b², so b² = c² − a².', `Work out ${c}² − ${a}², then take the square root.`],
      { [c - a]: 'pythagorean-no-square' }, { kind: 'rtri', a: String(a), b: '?', c: String(c) });
  }
  return input(`The legs of a right triangle are ${a} and ${b}. How long is the hypotenuse?`, c,
    ['Square each leg and add: a² + b².', 'The hypotenuse is the square root of that total.'],
    { [a + b]: 'pythagorean-no-square' }, { kind: 'rtri', a: String(a), b: String(b), c: '?' });
}

function slope(d, rand) {
  const x1 = int(rand, -5, 5); const y1 = int(rand, -5, 5);
  if (d === 3) {
    let rise; let run;
    do { rise = nonZero(rand, -6, 6); run = int(rand, 2, 7); } while (gcd(rise, run) !== 1);
    const x2 = x1 + run; const y2 = y1 + rise;
    const answer = rise < 0 ? `−${frac(-rise, run)}` : frac(rise, run);
    const inv = rise < 0 ? `−${frac(run, -rise)}` : frac(run, rise);
    const flip = rise < 0 ? frac(-rise, run) : `−${frac(rise, run)}`;
    return choice(rand, {
      prompt: `What is the slope of the line through (${signed(x1)}, ${signed(y1)}) and (${signed(x2)}, ${signed(y2)})?`,
      answer, size: 3, wrong: [{ value: inv, misconception: 'slope-inverted' }, { value: flip, misconception: 'integer-sign' }],
      hints: ['Slope = change in y ÷ change in x.', `Change in y: ${signed(y2)} − ${paren(y1)}. Change in x: ${signed(x2)} − ${paren(x1)}.`],
    });
  }
  const m = d === 1 ? int(rand, 1, 5) : nonZero(rand, -5, 5) * (rand() < 0.6 ? -1 : 1);
  const run = int(rand, 1, 4);
  const x2 = x1 + run; const y2 = y1 + m * run;
  const wrong = { [-m]: 'integer-sign' };
  return input(`What is the slope of the line through (${signed(x1)}, ${signed(y1)}) and (${signed(x2)}, ${signed(y2)})?`, m,
    ['Slope = rise ÷ run = (y₂ − y₁) ÷ (x₂ − x₁).', 'Subtract in the same order for both: second point minus first point.'], m !== -m ? wrong : {});
}

// ---------- Grades 9-12 ----------
function multiStep(d, rand) {
  const x = d === 3 ? nonZero(rand, -8, 10) : int(rand, 1, 10);
  let a; let c;
  do { a = int(rand, 2, 7); c = int(rand, 1, 6); } while (a === c);
  if (d === 1) {
    const b = int(rand, 1, 15);
    const dd = a * x + b - c * x;
    return input(`Solve for x: ${a}x + ${b} = ${c}x ${dd < 0 ? `− ${-dd}` : `+ ${dd}`}`, x,
      [`Get the x terms on one side: subtract ${c}x from both sides.`, 'Then undo the constant and divide.']);
  }
  const b = nonZero(rand, -6, 8);
  const dd = a * (x + b) - c * x;
  const inside = b < 0 ? `x − ${-b}` : `x + ${b}`;
  const wrong = {};
  const noDistribute = (dd - b) / (a - c);
  if (Number.isInteger(noDistribute) && noDistribute !== x) wrong[noDistribute] = 'distribution-error';
  return input(`Solve for x: ${a}(${inside}) = ${c}x ${dd < 0 ? `− ${-dd}` : `+ ${dd}`}`, x,
    [`Distribute first: ${a}(${inside}) = ${a}x ${b < 0 ? `− ${-a * b}` : `+ ${a * b}`}.`, `Then collect the x terms on one side and solve.`], wrong);
}

function functionNotation(d, rand) {
  if (d === 3) {
    const a = int(rand, 2, 6); const b = nonZero(rand, -9, 9); const x = int(rand, -5, 9);
    const y = a * x + b;
    return input(`f(x) = ${a}x ${b < 0 ? `− ${-b}` : `+ ${b}`}. For which value of x is f(x) = ${signed(y)}?`, x,
      [`Set ${a}x ${b < 0 ? `− ${-b}` : `+ ${b}`} equal to ${signed(y)}.`, 'Solve that equation for x.']);
  }
  if (d === 1) {
    const a = int(rand, 2, 9); const b = int(rand, -9, 9); const k = int(rand, 1, 8);
    return input(`f(x) = ${a}x ${b < 0 ? `− ${-b}` : `+ ${b}`}. Find f(${k}).`, a * k + b,
      [`Replace x with ${k}.`, `Work out ${a} × ${k}, then ${b < 0 ? 'subtract' : 'add'} ${Math.abs(b)}.`]);
  }
  const b = int(rand, -6, 6); const c = int(rand, -9, 9); const k = nonZero(rand, -5, 5);
  const ans = k * k + b * k + c;
  const wrong = k < 0 ? { [-(k * k) + b * k + c]: 'integer-sign' } : {};
  const bTerm = b === 0 ? '' : b < 0 ? ` − ${-b === 1 ? '' : -b}x` : ` + ${b === 1 ? '' : b}x`;
  const cTerm = c === 0 ? '' : c < 0 ? ` − ${-c}` : ` + ${c}`;
  return input(`f(x) = x²${bTerm}${cTerm}. Find f(${signed(k)}).`, ans,
    [`Replace every x with (${signed(k)}).`, 'Square first: a negative number squared is positive.'], wrong);
}

function systems(d, rand) {
  const x = nonZero(rand, -6, 8); const y = nonZero(rand, -6, 8);
  let a1; let b1; let a2; let b2;
  if (d === 1) { a1 = 1; b1 = 1; a2 = 1; b2 = -1; }
  else {
    do { a1 = int(rand, 1, 5); b1 = nonZero(rand, -4, 4); a2 = nonZero(rand, -4, 4); b2 = int(rand, 1, 5); } while (a1 * b2 - a2 * b1 === 0);
  }
  const term = (coef, v, first) => {
    if (coef === 0) return '';
    const mag = Math.abs(coef) === 1 ? v : `${Math.abs(coef)}${v}`;
    if (first) return coef < 0 ? `−${mag}` : mag;
    return coef < 0 ? ` − ${mag}` : ` + ${mag}`;
  };
  const eq = (a, b) => `${term(a, 'x', true)}${term(b, 'y', false)} = ${signed(a * x + b * y)}`;
  const askY = d === 3;
  return input(`Solve the system: ${eq(a1, b1)} and ${eq(a2, b2)}. What is ${askY ? 'y' : 'x'}?`, askY ? y : x,
    [d === 1 ? 'Add the two equations: the y terms cancel.' : 'Multiply one or both equations so one variable has opposite coefficients, then add.',
      'Solve for one variable, then substitute back to check both equations.']);
}

function quadratics(d, rand) {
  let r1; let r2;
  do {
    r1 = d === 1 ? int(rand, 1, 9) : nonZero(rand, -9, 9);
    r2 = d === 1 ? int(rand, 1, 9) : nonZero(rand, -9, 9);
  } while (r1 === r2 || (d === 3 && r1 > 0 && r2 > 0));
  const [lo, hi] = [Math.min(r1, r2), Math.max(r1, r2)];
  const b = -(r1 + r2); const c = r1 * r2;
  const bTerm = b === 0 ? '' : b < 0 ? ` − ${-b === 1 ? '' : -b}x` : ` + ${b === 1 ? '' : b}x`;
  const cTerm = c < 0 ? ` − ${-c}` : ` + ${c}`;
  const pair = (p, q) => `x = ${signed(Math.min(p, q))} or x = ${signed(Math.max(p, q))}`;
  const wrong = [{ value: pair(-r1, -r2), misconception: 'factor-sign' }];
  if (r1 * r2 !== 0) wrong.push({ value: pair(lo, -hi) === pair(lo, hi) ? pair(lo + 1, hi) : pair(-lo, hi) });
  wrong.push({ value: pair(lo - 1, hi + 1) });
  return choice(rand, {
    prompt: `Solve: x²${bTerm}${cTerm} = 0`, answer: pair(lo, hi), size: 3, wrong,
    hints: [`Find two numbers that multiply to ${signed(c)} and add to ${signed(b)}.`, 'Write the factors, then set each one equal to zero.'],
  });
}

function trigRatios(d, rand) {
  const [a, b, c] = pick(rand, TRIPLES);
  const fn = d === 1 ? 'sin' : d === 2 ? 'cos' : pick(rand, ['sin', 'cos', 'tan']);
  // The angle θ is opposite side a and next to side b.
  const value = { sin: frac(a, c), cos: frac(b, c), tan: frac(a, b) };
  const others = Object.entries(value).filter(([k]) => k !== fn).map(([, v]) => ({ value: v, misconception: 'trig-ratio-mix' }));
  others.push({ value: frac(c, fn === 'tan' ? a : c === b ? a : b) });
  return choice(rand, {
    prompt: `In the right triangle, the side opposite angle θ is ${a}, the side next to θ is ${b} and the hypotenuse is ${c}. What is ${fn} θ?`,
    answer: value[fn], size: 3, wrong: others,
    visual: { kind: 'rtri', a: String(a), b: String(b), c: String(c), angle: true },
    hints: ['SOH CAH TOA: sin = opposite/hypotenuse, cos = adjacent/hypotenuse, tan = opposite/adjacent.', 'Find which sides are opposite and adjacent to θ, not to the right angle.'],
  });
}

const SUB = { 2: '₂', 3: '₃', 4: '₄', 5: '₅', 10: '₁₀' };
function logarithms(d, rand) {
  const base = d === 1 ? 2 : pick(rand, [2, 3, 5, 10]);
  const k = d === 3 && rand() < 0.3 ? 0 : int(rand, 1, base === 10 ? 4 : base === 2 ? 6 : 4);
  if (d === 3 && rand() < 0.5) {
    return input(`If log${SUB[base]} x = ${k}, what is x?`, base ** k,
      [`log${SUB[base]} x = ${k} means ${base} to the power ${k} is x.`, `Work out ${base}${sup(k)}.`]);
  }
  return input(`log${SUB[base]} ${base ** k} = ?`, k,
    [`Ask: ${base} to what power gives ${base ** k}?`, k === 0 ? 'Any base to the power 0 is 1.' : `Count how many ${base}s multiply to make ${base ** k}.`]);
}

function derivatives(d, rand) {
  if (d === 1) {
    const a = int(rand, 2, 9); const n = int(rand, 2, 6);
    return input(`f(x) = ${a}x${sup(n)}. f′(x) = kx${sup(n - 1)}. What is k?`, a * n,
      ['Power rule: the derivative of axⁿ is n·a·xⁿ⁻¹.', `Multiply the coefficient ${a} by the exponent ${n}.`], { [a]: 'one-step-only' });
  }
  const a = int(rand, 1, 4); const b = int(rand, -6, 6); const c = int(rand, -9, 9); const k = int(rand, -3, 4);
  const val = 3 * a * k * k + 2 * b * k + c;
  const bTerm = b === 0 ? '' : b < 0 ? ` − ${-b}x²` : ` + ${b}x²`;
  const cTerm = c === 0 ? '' : c < 0 ? ` − ${-c}x` : ` + ${c}x`;
  return input(`f(x) = ${a === 1 ? '' : a}x³${bTerm}${cTerm} + 5. ${d === 3 ? `What is the slope of the tangent line at x = ${signed(k)}?` : `Find f′(${signed(k)}).`}`, val,
    ['Differentiate term by term with the power rule. The constant’s derivative is 0.', `f′(x) = ${3 * a}x² ${2 * b < 0 ? `− ${-2 * b}` : `+ ${2 * b}`}x ${c < 0 ? `− ${-c}` : `+ ${c}`}. Now substitute x = ${signed(k)}.`]);
}

export const SECONDARY_MATH = {
  'integers': integers,
  'ratios-rates': ratiosRates,
  'mean-median': meanMedian,
  'percent': percent,
  'exponents': exponents,
  'probability': probability,
  'equations-two-step': equationsTwoStep,
  'pythagorean': pythagorean,
  'slope': slope,
  'multi-step-equations': multiStep,
  'function-notation': functionNotation,
  'systems': systems,
  'quadratics': quadratics,
  'trig-ratios': trigRatios,
  'logarithms': logarithms,
  'derivatives': derivatives,
};
