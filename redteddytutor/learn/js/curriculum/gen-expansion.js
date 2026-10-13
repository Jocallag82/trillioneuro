// Curriculum expansion (October 2026): the gaps found by the coverage inventory.
//
// Grades 4-12 maths that the earlier sets skipped (multi-digit multiplication, long
// division, fraction operations, volume, order of operations, equations, circles,
// scientific notation, linear and exponential functions, polynomials, sequences,
// statistics, the unit circle), plus English, science, social studies and computer
// science skills that turn "planned" courses into real ones.
//
// Same rules as the other generator files: computed answers come from the numbers the
// learner sees; wrong answers carry a mistake code only when they genuinely show that
// mistake; authored items have exactly one right answer. scripts/expansion.test.mjs
// re-solves every computed item independently and checks every authored bank.
import { int, pick, shuffled, choice, input } from './kit.js';
import { signed, sup } from './gen-secondary-math.js';

const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const simplify = (n, d) => { const g = gcd(n, d) || 1; return [n / g, d / g]; };
const fracLabel = (n, d) => (d === 1 ? String(n) : `${n}/${d}`);
const term = (k, first = false) => (first ? signed(k) : k < 0 ? ` − ${-k}` : ` + ${k}`);

// A choice between fractions. Drops any distractor equal in value to the answer, so a
// learner who gives an equivalent but unsimplified fraction is never marked wrong.
function fractionChoice(rand, prompt, [an, ad], wrong, hints) {
  const val = an / ad;
  const seen = new Set([val]);
  const keep = [];
  for (const w of wrong) {
    const [n, d] = w.value;
    if (d <= 0 || n < 0) continue;
    const v = n / d;
    if (seen.has(v)) continue;
    seen.add(v);
    keep.push({ value: fracLabel(...simplify(n, d)), ...(w.misconception ? { misconception: w.misconception } : {}) });
  }
  return choice(rand, { prompt, answer: fracLabel(an, ad), wrong: keep, hints, size: Math.min(4, keep.length + 1) });
}

// ================= Grades 4-5 =================
function multiplyMultidigit(d, rand) {
  if (d === 3) {
    const a = int(rand, 12, 99); const b = int(rand, 12, 49);
    const forgotZero = a * Math.floor(b / 10) + a * (b % 10);
    return input(`${a} × ${b} = ?`, a * b,
      [`Split ${b} into ${Math.floor(b / 10) * 10} and ${b % 10}. Multiply ${a} by each part.`, `${a} × ${Math.floor(b / 10) * 10} has a zero on the end. Add the two partial products.`],
      { [forgotZero]: 'partial-product-place' });
  }
  const a = d === 1 ? int(rand, 12, 99) : int(rand, 102, 989);
  const b = int(rand, 3, 9);
  const ones = (a % 10) * b;
  // Forgetting the carried ten: the ones digit is written, the carry is dropped.
  const noCarry = ones >= 10 ? (Math.floor(a / 10) * b) * 10 + (ones % 10) : null;
  return input(`${a} × ${b} = ?`, a * b,
    ['Multiply the ones first, then the tens' + (d === 2 ? ', then the hundreds.' : '.'), 'When a column makes 10 or more, carry the tens into the next column and add them after multiplying.'],
    noCarry ? { [noCarry]: 'no-regroup' } : {});
}

function longDivision(d, rand) {
  const b = int(rand, 2, 9);
  if (d === 3) {
    const q = int(rand, 12, 99); const r = int(rand, 1, b - 1);
    const a = b * q + r;
    return input(`What is the remainder when ${a} is divided by ${b}?`, r,
      [`Find the biggest multiple of ${b} that is not more than ${a}.`, `Subtract it from ${a}. The remainder is always less than ${b}.`],
      { [q]: 'wrong-operation' });
  }
  const q = d === 1 ? int(rand, 11, Math.floor(99 / b)) : int(rand, Math.ceil(100 / b), Math.floor(999 / b));
  const a = b * q;
  return input(`${a} ÷ ${b} = ?`, q,
    [`Divide one place at a time, starting from the left: how many ${b}s go into the first digit (or first two digits)?`, `Check by multiplying your answer by ${b}. You should get ${a}.`]);
}

function fractionAddSubtract(d, rand) {
  if (d === 1) {
    const den = int(rand, 5, 12); const a = int(rand, 1, den - 2); const b = int(rand, 1, den - 1 - a);
    const sub = rand() < 0.4 && a !== b;
    const [x, y] = sub ? [Math.max(a, b), Math.min(a, b)] : [a, b];
    const n = sub ? x - y : x + y;
    return fractionChoice(rand, `${x}/${den} ${sub ? '−' : '+'} ${y}/${den} = ?`, simplify(n, den), [
      ...(sub ? [] : [{ value: [x + y, den * 2], misconception: 'add-denominators' }]),
      { value: [n + 1, den] }, { value: [Math.max(1, n - 1), den] }, { value: [n, den + 1] },
    ], ['The denominators match, so the pieces are the same size.', `${sub ? 'Subtract' : 'Add'} the numerators and keep the denominator.`]);
  }
  if (d === 2) {
    const small = pick(rand, [2, 3, 4, 5]); const k = pick(rand, [2, 3]); const big = small * k;
    const a = int(rand, 1, small - 1); const b = int(rand, 1, big - 1);
    const sub = a * k > b && rand() < 0.5;
    const n = sub ? a * k - b : a * k + b;
    const [sn, sd] = simplify(n, big);
    return fractionChoice(rand, `${a}/${small} ${sub ? '−' : '+'} ${b}/${big} = ?`, [sn, sd], [
      ...(sub ? [] : [{ value: [a + b, small + big], misconception: 'add-denominators' }]),
      { value: [sub ? Math.abs(a - b) : a + b, big] }, { value: [n + 1, big] },
    ], [`Rewrite ${a}/${small} with denominator ${big}: multiply top and bottom by ${k}.`, `Now ${sub ? 'subtract' : 'add'} the numerators and simplify if you can.`]);
  }
  let p; let q;
  do { p = int(rand, 2, 7); q = int(rand, 3, 9); } while (p === q || gcd(p, q) !== 1);
  const a = int(rand, 1, p - 1); const b = int(rand, 1, q - 1);
  const [n, den] = simplify(a * q + b * p, p * q);
  return fractionChoice(rand, `${a}/${p} + ${b}/${q} = ?`, [n, den], [
    { value: [a + b, p + q], misconception: 'add-denominators' }, { value: [a + b, p * q] }, { value: [a * b, p * q] },
  ], [`Find a common denominator: ${p} × ${q} = ${p * q} works.`, `Rename both fractions out of ${p * q}, then add the numerators.`]);
}

function multiplyFractions(d, rand) {
  if (d === 1) {
    const den = int(rand, 2, 8); const k = int(rand, 2, 9);
    return input(`What is 1/${den} of ${den * k}?`, k,
      [`1/${den} of a number means dividing it into ${den} equal parts.`, `Work out ${den * k} ÷ ${den}.`], { [den * k * den]: 'wrong-operation' });
  }
  if (d === 2) {
    const den = int(rand, 3, 8); const num = int(rand, 2, den - 1); const k = int(rand, 2, 6);
    return input(`${num}/${den} × ${den * k} = ?`, num * k,
      [`Find 1/${den} of ${den * k} first: ${den * k} ÷ ${den}.`, `Then multiply by ${num}.`], { [k]: 'one-step-only' });
  }
  const a = int(rand, 1, 5); const b = int(rand, a + 1, 9); const c = int(rand, 1, 5); const e = int(rand, c + 1, 9);
  return fractionChoice(rand, `${a}/${b} × ${c}/${e} = ?`, simplify(a * c, b * e), [
    { value: [a * e, b * c], misconception: 'wrong-operation' }, { value: [a + c, b + e] }, { value: [a * c, b + e] }, { value: [a * c + 1, b * e] },
  ], ['Multiply the numerators together and the denominators together.', 'Then simplify by dividing top and bottom by any common factor.']);
}

function volume(d, rand) {
  const l = int(rand, 2, d === 1 ? 5 : 12); const w = int(rand, 2, d === 1 ? 4 : 9); const h = int(rand, 2, d === 1 ? 4 : 10);
  if (d === 1) {
    return input(`A box is filled with unit cubes. It is ${l} cubes long, ${w} cubes wide and ${h} cubes tall. How many cubes fill it?`, l * w * h,
      [`One layer is ${l} × ${w} cubes.`, `There are ${h} layers. Multiply the layer by ${h}.`], { [l + w + h]: 'wrong-operation' });
  }
  if (d === 2) {
    return input(`A rectangular prism is ${l} cm long, ${w} cm wide and ${h} cm tall. What is its volume in cm³?`, l * w * h,
      ['Volume = length × width × height.', `Multiply ${l} × ${w} first, then multiply by ${h}.`],
      { [l + w + h]: 'wrong-operation', [2 * (l * w + l * h + w * h)]: 'volume-surface-mix' });
  }
  return input(`A rectangular prism has a volume of ${l * w * h} cm³. It is ${l} cm long and ${w} cm wide. How tall is it, in cm?`, h,
    [`Volume = length × width × height, so height = volume ÷ (length × width).`, `Work out ${l} × ${w} = ${l * w}, then ${l * w * h} ÷ ${l * w}.`]);
}

// Strictly left-to-right: the answer a learner gets by ignoring precedence.
function leftToRight(tokens) {
  let v = tokens[0];
  for (let i = 1; i < tokens.length; i += 2) {
    const [op, n] = [tokens[i], tokens[i + 1]];
    v = op === '+' ? v + n : op === '−' ? v - n : op === '×' ? v * n : v / n;
  }
  return v;
}
function orderOfOperations(d, rand) {
  if (d === 1) {
    const a = int(rand, 2, 20); const b = int(rand, 2, 9); const c = int(rand, 2, 9);
    const op = rand() < 0.5 ? '+' : '−';
    const ans = op === '+' ? a + b * c : a - b * c;
    if (ans < 0) return orderOfOperations(1, rand);
    return input(`${a} ${op} ${b} × ${c} = ?`, ans,
      ['Multiplication and division come before addition and subtraction.', `Work out ${b} × ${c} first.`],
      { [leftToRight([a, op, b, '×', c])]: 'left-to-right' });
  }
  if (d === 2) {
    const a = int(rand, 2, 12); const b = int(rand, 2, 9); const c = int(rand, 2, 6); const e = int(rand, 1, 9);
    const ans = (a + b) * c - e;
    return input(`(${a} + ${b}) × ${c} − ${e} = ?`, ans,
      ['Parentheses first.', `Then multiply by ${c}, and subtract ${e} last.`],
      { [a + b * c - e]: 'left-to-right' });
  }
  const b = int(rand, 2, 6); const c = int(rand, 2, 5); const a = int(rand, 1, 20); const q = int(rand, 2, 4);
  const top = b * b * c;
  if (top % q) return orderOfOperations(3, rand);
  const ans = a + top / q;
  return input(`${a} + ${b}² × ${c} ÷ ${q} = ?`, ans,
    ['Order: parentheses, exponents, then multiply and divide from left to right, then add and subtract.', `Start with ${b}² = ${b * b}.`],
    { [((a + b * b) * c) / q]: 'left-to-right', [a + (2 * b * c) / q]: 'power-as-product' });
}

// ================= Grades 6-8 =================
function divideFractions(d, rand) {
  if (d === 1) {
    const den = int(rand, 2, 8); const whole = int(rand, 2, 6);
    return input(`How many 1/${den}s are there in ${whole}?`, whole * den,
      [`Each whole holds ${den} pieces of size 1/${den}.`, `So ${whole} wholes hold ${whole} × ${den}.`]);
  }
  if (d === 2) {
    const a = int(rand, 1, 6); const b = int(rand, a + 1, 9); const k = int(rand, 2, 5);
    return fractionChoice(rand, `${a}/${b} ÷ ${k} = ?`, simplify(a, b * k), [
      { value: [a * k, b], misconception: 'wrong-operation' }, { value: [b * k, a], misconception: 'flip-wrong-fraction' }, { value: [a, b + k] },
    ], [`Dividing by ${k} is the same as multiplying by 1/${k}.`, `${a}/${b} × 1/${k}: multiply the denominators.`]);
  }
  const a = int(rand, 1, 7); const b = int(rand, 2, 9); const c = int(rand, 1, 7); const e = int(rand, 2, 9);
  if (a >= b || c >= e || a * e === b * c) return divideFractions(3, rand);
  return fractionChoice(rand, `${a}/${b} ÷ ${c}/${e} = ?`, simplify(a * e, b * c), [
    { value: [a * c, b * e], misconception: 'wrong-operation' }, { value: [b * c, a * e], misconception: 'flip-wrong-fraction' }, { value: [a * e + 1, b * c] },
  ], ['Keep the first fraction, change ÷ to ×, and flip the second fraction.', `So ${a}/${b} × ${e}/${c}. Multiply, then simplify.`]);
}

function oneStepEquations(d, rand) {
  if (d === 1) {
    const x = int(rand, 2, 30); const a = int(rand, 2, 20);
    if (rand() < 0.5) return input(`Solve for x: x + ${a} = ${x + a}`, x, [`Undo + ${a} by subtracting ${a} from both sides.`, `${x + a} − ${a} = ?`], { [x + 2 * a]: 'inverse-operation' });
    return input(`Solve for x: x − ${a} = ${x}`, x + a, [`Undo − ${a} by adding ${a} to both sides.`, `${x} + ${a} = ?`], { [x - a]: 'inverse-operation' });
  }
  if (d === 2) {
    const x = int(rand, 2, 15); const a = int(rand, 2, 9);
    if (rand() < 0.5) return input(`Solve for x: ${a}x = ${a * x}`, x, [`${a}x means ${a} × x. Undo it by dividing both sides by ${a}.`, `${a * x} ÷ ${a} = ?`], { [a * x * a]: 'inverse-operation' });
    return input(`Solve for x: x/${a} = ${x}`, x * a, [`x/${a} means x ÷ ${a}. Undo it by multiplying both sides by ${a}.`, `${x} × ${a} = ?`]);
  }
  const x = int(rand, -12, 12) || 4; const a = int(rand, -9, 9) || -3;
  if (rand() < 0.5) return input(`Solve for x: x + ${a < 0 ? `(${signed(a)})` : a} = ${signed(x + a)}`, x, ['Subtract the same number from both sides.', `Take ${signed(a)} away from ${signed(x + a)}.`], { [x + 2 * a]: 'inverse-operation' });
  return input(`Solve for x: ${signed(a)}x = ${signed(a * x)}`, x, [`Divide both sides by ${signed(a)}.`, 'Same signs give a positive answer; different signs give a negative one.'], { [-x]: 'integer-sign' });
}

function areaTriangles(d, rand) {
  if (d === 1) {
    const b = int(rand, 2, 14); const h = 2 * int(rand, 1, 7);
    return input(`A triangle has a base of ${b} cm and a height of ${h} cm. What is its area in cm²?`, (b * h) / 2,
      ['Area of a triangle = ½ × base × height.', `A triangle is half of a ${b} by ${h} rectangle.`], { [b * h]: 'triangle-no-half' });
  }
  if (d === 2) {
    const a = int(rand, 3, 12); const b = a + 2 * int(rand, 1, 4); const h = int(rand, 2, 10);
    return input(`A trapezoid has parallel sides of ${a} cm and ${b} cm, and a height of ${h} cm. What is its area in cm²?`, ((a + b) / 2) * h,
      ['Area of a trapezoid = ½ × (sum of the parallel sides) × height.', `Average the parallel sides: (${a} + ${b}) ÷ 2. Multiply by ${h}.`], { [(a + b) * h]: 'triangle-no-half' });
  }
  const w = int(rand, 3, 10); const h = int(rand, 2, 8); const th = 2 * int(rand, 1, 4);
  return input(`A shape is a ${w} cm by ${h} cm rectangle with a triangle on top. The triangle’s base is the ${w} cm side and its height is ${th} cm. What is the total area in cm²?`, w * h + (w * th) / 2,
    ['Split the shape: find the rectangle and the triangle separately, then add.', `Rectangle: ${w} × ${h}. Triangle: ½ × ${w} × ${th}.`], { [w * h + w * th]: 'triangle-no-half' });
}

function circles(d, rand) {
  if (d === 1) {
    const r = int(rand, 2, 15);
    return input(`A circle has a radius of ${r} cm. Its circumference is kπ cm. What is k?`, 2 * r,
      ['Circumference = 2πr (or π × diameter).', `The diameter is 2 × ${r}.`], { [r * r]: 'circle-area-circumference', [r]: 'radius-diameter' });
  }
  if (d === 2) {
    const r = int(rand, 2, 12);
    return input(`A circle has a radius of ${r} m. Its area is kπ m². What is k?`, r * r,
      ['Area = πr².', `Square the radius: ${r} × ${r}.`], { [2 * r]: 'circle-area-circumference' });
  }
  const r = int(rand, 2, 10); const dia = 2 * r;
  return input(`A circle has a diameter of ${dia} in. Its area is kπ in². What is k?`, r * r,
    ['Area = πr², and the radius is half the diameter.', `The radius is ${dia} ÷ 2 = ${r}. Square it.`], { [dia * dia]: 'radius-diameter', [dia]: 'circle-area-circumference' });
}

const SUPNEG = (n) => (n < 0 ? `⁻${sup(-n)}` : sup(n));
function scientificNotation(d, rand) {
  if (d === 1) {
    const m = pick(rand, [11, 12, 15, 18, 23, 25, 34, 36, 45, 47, 52, 68, 72, 85, 91]); const n = int(rand, 3, 8);
    const value = m * 10 ** (n - 1);
    return input(`${value.toLocaleString('en-US')} = ${(m / 10).toFixed(1)} × 10ⁿ. What is n?`, n,
      ['Count how many places the decimal point moves left to give a number between 1 and 10.', `${(m / 10).toFixed(1)} × 10 × 10 … must get back to ${value.toLocaleString('en-US')}.`],
      { [n - 1]: 'count-zeros' });
  }
  if (d === 2) {
    const m = pick(rand, [11, 13, 24, 27, 36, 42, 58, 63, 75, 89]); const n = int(rand, 2, 6);
    const value = (m / 10 ** (n + 1)).toFixed(n + 1);
    return input(`${value} = ${(m / 10).toFixed(1)} × 10ⁿ. What is n?`, -n,
      ['Small numbers have a negative exponent.', 'Count how many places the decimal point moves right to give a number between 1 and 10.'],
      { [n]: 'integer-sign' });
  }
  const a = int(rand, 1, 4); const b = int(rand, 2, Math.floor(9 / a)); const p = int(rand, 2, 8); const q = int(rand, -5, 9) || 3;
  return input(`(${a} × 10${SUPNEG(p)}) × (${b} × 10${SUPNEG(q)}) = ${a * b} × 10ⁿ. What is n?`, p + q,
    ['Multiply the numbers in front, then deal with the powers of 10.', 'Same base multiplied: add the exponents.'],
    { [p * q]: 'exponent-law-mix' });
}

function linearFunctions(d, rand) {
  if (d === 1) {
    const m = pick(rand, [-6, -5, -4, -3, -2, 2, 3, 4, 5, 6]); const b = int(rand, -10, 10); const x = int(rand, -5, 8);
    return input(`y = ${signed(m)}x${b ? term(b) : ''}. What is y when x = ${signed(x)}?`, m * x + b,
      [`Replace x with ${signed(x)}.`, `Multiply ${signed(m)} × ${signed(x)} first, then ${b < 0 ? 'subtract' : 'add'} ${Math.abs(b)}.`]);
  }
  if (d === 2) {
    const m = int(rand, -5, 5) || 3; const b = int(rand, -12, 12); const x = int(rand, 1, 6);
    return input(`A line has slope ${signed(m)} and passes through (${x}, ${signed(m * x + b)}). What is its y-intercept?`, b,
      ['Use y = mx + b, and put in the slope and the point.', `${signed(m * x + b)} = ${signed(m)} × ${x} + b. Solve for b.`], { [m * x + b]: 'one-step-only' });
  }
  const fee = pick(rand, [10, 15, 20, 25, 30, 40]); const rate = pick(rand, [8, 12, 15, 20, 25]); const n = int(rand, 2, 12);
  if (rand() < 0.5) {
    return input(`A gym charges a $${fee} sign-up fee plus $${rate} per month. What is the total cost, in dollars, for ${n} months?`, fee + rate * n,
      [`Write it as C = ${rate}m + ${fee}.`, `Put in m = ${n}.`], { [(fee + rate) * n]: 'wrong-operation' });
  }
  return input(`A gym charges a $${fee} sign-up fee plus $${rate} per month. After how many months will the total cost be $${fee + rate * n}?`, n,
    [`Write it as ${fee + rate * n} = ${rate}m + ${fee}.`, `Subtract the fee, then divide by ${rate}.`], { [(fee + rate * n) / rate]: 'one-step-only' });
}

function volumeSolids(d, rand) {
  if (d === 1) {
    const r = int(rand, 1, 8); const h = int(rand, 2, 12);
    return input(`A cylinder has radius ${r} cm and height ${h} cm. Its volume is kπ cm³. What is k?`, r * r * h,
      ['Volume of a cylinder = πr²h (area of the circle × height).', `${r}² × ${h} = ?`], { [2 * r * h]: 'circle-area-circumference' });
  }
  if (d === 2) {
    const r = int(rand, 1, 8); const h = 3 * int(rand, 1, 5);
    return input(`A cone has radius ${r} cm and height ${h} cm. Its volume is kπ cm³. What is k?`, (r * r * h) / 3,
      ['Volume of a cone = ⅓πr²h: one third of the cylinder with the same base and height.', `${r}² × ${h} ÷ 3 = ?`], { [r * r * h]: 'cone-no-third' });
  }
  const r = pick(rand, [3, 6, 9]);
  return input(`A sphere has radius ${r} cm. Its volume is kπ cm³. What is k?`, (4 * r ** 3) / 3,
    ['Volume of a sphere = ⁴⁄₃πr³.', `${r}³ = ${r ** 3}. Multiply by 4, then divide by 3.`], { [r ** 3]: 'one-step-only', [4 * r * r]: 'power-as-product' });
}

// ================= High school =================
function exponentialFunctions(d, rand) {
  if (d === 1) {
    const a = int(rand, 2, 6); const b = int(rand, 2, 4); const x = int(rand, 0, 4);
    return input(`f(x) = ${a} · ${b}ˣ. Find f(${x}).`, a * b ** x,
      [`Work out the power first: ${b}${sup(x)}.`, `Then multiply by ${a}.`], { [(a * b) ** x]: 'exponent-law-mix', [a * b * x]: 'power-as-product' });
  }
  if (d === 2) {
    const start = pick(rand, [50, 100, 120, 200, 250, 300]); const f = pick(rand, [2, 3]); const n = int(rand, 2, 5);
    return input(`A colony of ${start} bacteria ${f === 2 ? 'doubles' : 'triples'} every hour. How many bacteria are there after ${n} hours?`, start * f ** n,
      [`Each hour multiplies the amount by ${f}.`, `${start} × ${f}${sup(n)}.`], { [start * f * n]: 'linear-vs-exponential', [start + start * (f - 1) * n]: 'linear-vs-exponential' });
  }
  const start = pick(rand, [800, 1600, 3200, 6400]); const n = int(rand, 2, 4);
  return input(`A car worth $${start} loses half of its value every year. What is it worth, in dollars, after ${n} years?`, start / 2 ** n,
    ['Halving each year means multiplying by ½ each year.', `${start} × (½)${sup(n)}.`]);
}

function polynomials(d, rand) {
  const a = int(rand, -9, 9) || 2; const b = int(rand, -9, 9) || -3;
  const fac = (k) => (k < 0 ? `(x − ${-k})` : `(x + ${k})`);
  if (d === 1) {
    return input(`Expand ${fac(a)}${fac(b)} = x² + bx + c. What is c?`, a * b,
      ['c comes from multiplying the two constant terms.', `${signed(a)} × ${signed(b)} = ?`], { [a + b]: 'distribution-error' });
  }
  if (d === 2) {
    return input(`Expand ${fac(a)}${fac(b)} = x² + bx + c. What is b?`, a + b,
      ['The x-terms come from x × (second number) and (first number) × x.', `Add ${signed(a)} and ${signed(b)}.`], { [a * b]: 'distribution-error' });
  }
  const p = int(rand, 2, 5); const q = int(rand, 1, 4);
  const pf = `(${p}x${term(a)})`; const qf = `(${q === 1 ? '' : q}x${term(b)})`;
  return input(`Expand ${pf}${qf} = Ax² + Bx + C. What is B?`, p * b + q * a,
    ['Use FOIL: the Outer and Inner products give the x-terms.', `Outer: ${p}x × ${signed(b)}. Inner: ${signed(a)} × ${q === 1 ? '' : q}x. Add them.`], { [a + b]: 'distribution-error', [p * q]: 'distribution-error' });
}

function sequences(d, rand) {
  if (d === 1) {
    const a = int(rand, -5, 12); const k = int(rand, 2, 9); const n = int(rand, 10, 30);
    const shown = [0, 1, 2, 3].map((i) => signed(a + i * k)).join(', ');
    return input(`${shown}, … This sequence goes up by the same amount each time. What is term ${n}?`, a + (n - 1) * k,
      [`Term n = first term + (n − 1) × the common difference.`, `${signed(a)} + (${n} − 1) × ${k}.`], { [a + n * k]: 'off-by-one' });
  }
  if (d === 2) {
    const a = int(rand, 1, 5); const r = pick(rand, [2, 3]); const n = int(rand, 5, 7);
    const shown = [0, 1, 2, 3].map((i) => a * r ** i).join(', ');
    return input(`${shown}, … Each term is multiplied by the same number. What is term ${n}?`, a * r ** (n - 1),
      [`Term n = first term × r^(n − 1). Here r = ${r}.`, `${a} × ${r}${sup(n - 1)}.`], { [a * r ** n]: 'off-by-one' });
  }
  const a = int(rand, -10, 10); const k = int(rand, 2, 8); const i = int(rand, 3, 6); const j = i + int(rand, 2, 5);
  return input(`In an arithmetic sequence, term ${i} is ${signed(a + (i - 1) * k)} and term ${j} is ${signed(a + (j - 1) * k)}. What is term 1?`, a,
    [`From term ${i} to term ${j} is ${j - i} steps. Divide the change by ${j - i} to find the common difference.`, `Then step back from term ${i} to term 1: subtract the difference ${i - 1} times.`]);
}

// Quartiles by the exclusive-median method (the one most US courses and calculators use):
// split the sorted data at the median, leaving the median out, and take the median of each half.
export const median = (v) => { const s = [...v].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
export function quartiles(values) {
  const s = [...values].sort((x, y) => x - y);
  const h = s.length >> 1;
  return { q1: median(s.slice(0, h)), q3: median(s.slice(s.length % 2 ? h + 1 : h)) };
}
function dataSpread(d, rand) {
  const make = () => { let v; do { v = Array.from({ length: 7 }, () => int(rand, 2, 40)); } while (new Set(v).size < 7); return v; };
  if (d === 1) {
    const v = make(); const { q1 } = quartiles(v);
    return input(`Find the lower quartile (Q1) of: ${v.join(', ')}`, q1,
      ['Order the data. The median splits it into a lower half and an upper half (leave the median out).', 'Q1 is the median of the lower half.'], { [v[1]]: 'median-unsorted' });
  }
  if (d === 2) {
    const v = make(); const { q1, q3 } = quartiles(v);
    return input(`Find the interquartile range (IQR) of: ${v.join(', ')}`, q3 - q1,
      ['IQR = Q3 − Q1. Order the data first.', 'Find the median, then the median of each half.'], { [Math.max(...v) - Math.min(...v)]: 'iqr-range-mix' });
  }
  for (;;) {
    const base = int(rand, 10, 30);
    const v = Array.from({ length: 6 }, () => base + int(rand, -6, 6));
    const out = base + pick(rand, [-1, 1]) * int(rand, 25, 40);
    if (out < 0 || new Set([...v, out]).size < 7) continue;
    const all = [...v, out];
    const { q1, q3 } = quartiles(all); const iqr = q3 - q1;
    const flagged = all.filter((x) => x < q1 - 1.5 * iqr || x > q3 + 1.5 * iqr);
    if (flagged.length !== 1 || flagged[0] !== out) continue;
    const others = shuffled(v, rand).slice(0, 3);
    return choice(rand, {
      prompt: `Data: ${shuffled(all, rand).join(', ')}. Using the 1.5 × IQR rule, which value is an outlier?`,
      answer: out, wrong: others.map((x) => ({ value: x })),
      hints: ['Find Q1, Q3 and IQR. The fences are Q1 − 1.5 × IQR and Q3 + 1.5 × IQR.', 'A value outside the fences is an outlier.'],
    });
  }
}

// Exact values on the unit circle. Reference angle -> [sin, cos] as labels and numbers.
const EXACT = {
  0: [['0', 0], ['1', 1]], 30: [['1/2', 0.5], ['√3/2', Math.sqrt(3) / 2]], 45: [['√2/2', Math.SQRT1_2], ['√2/2', Math.SQRT1_2]],
  60: [['√3/2', Math.sqrt(3) / 2], ['1/2', 0.5]], 90: [['1', 1], ['0', 0]],
};
const TAN = { 0: '0', 30: '√3/3', 45: '1', 60: '√3' };
const RAD = { 0: '0', 30: 'π/6', 45: 'π/4', 60: 'π/3', 90: 'π/2', 120: '2π/3', 135: '3π/4', 150: '5π/6', 180: 'π', 210: '7π/6', 225: '5π/4', 240: '4π/3', 270: '3π/2', 300: '5π/3', 315: '7π/4', 330: '11π/6' };
const neg = (l) => (l === '0' ? '0' : l.startsWith('−') ? l.slice(1) : `−${l}`);
export function exactTrig(fn, deg) {
  const ref = deg <= 90 ? deg : deg <= 180 ? 180 - deg : deg <= 270 ? deg - 180 : 360 - deg;
  const sSign = deg > 180 ? -1 : 1; const cSign = deg > 90 && deg < 270 ? -1 : 1;
  if (fn === 'tan') { const l = TAN[ref]; return sSign * cSign < 0 ? neg(l) : l; }
  const [label] = EXACT[ref][fn === 'sin' ? 0 : 1];
  return (fn === 'sin' ? sSign : cSign) < 0 ? neg(label) : label;
}
function unitCircle(d, rand) {
  const pool = d === 1 ? [0, 30, 45, 60, 90] : [120, 135, 150, 210, 225, 240, 300, 315, 330];
  const deg = pick(rand, pool);
  const fn = pick(rand, deg % 90 === 0 ? ['sin', 'cos'] : ['sin', 'cos', 'tan']);
  const ans = exactTrig(fn, deg);
  const angle = d === 3 ? RAD[deg] : `${deg}°`;
  const other = fn === 'sin' ? 'cos' : 'sin';
  const wrongs = [exactTrig(other, deg), neg(ans), ...['1/2', '√3/2', '√2/2', '−1/2', '−√3/2', '−√2/2', '√3', '1', '0'].filter((x) => x !== ans)];
  return choice(rand, {
    prompt: `What is the exact value of ${fn}(${angle})?`, answer: ans,
    wrong: wrongs.map((value, i) => ({ value, ...(i === 0 && value !== ans ? { misconception: 'trig-ratio-mix' } : {}) })),
    hints: [d === 1 ? 'Picture the 30-60-90 and 45-45-90 triangles: sides 1, √3, 2 and 1, 1, √2.' : 'Find the reference angle, then use the quadrant to choose the sign (All Students Take Calculus).',
      'On the unit circle, cos is the x-coordinate and sin is the y-coordinate.'],
  });
}

// ================= English (authored) =================
// Short original passages. Each item: [title, passage, question, answer, [wrong], hint].
const MAIN_IDEA = [
  [
    ['Busy Beavers', 'Beavers cut down trees with their strong front teeth. They drag the branches into streams and pack them with mud. Slowly, the branches and mud become a dam. The dam makes a quiet pond where the beavers build their home.', 'What is the main idea?', 'Beavers build dams to make ponds for their homes.', ['Beavers have strong front teeth.', 'Streams are full of mud.'], 'The main idea is what the whole paragraph is about, not one detail.'],
    ['The School Garden', 'Room 12 planted a garden in the spring. They watered the beans every morning and pulled weeds on Fridays. By June the beans were taller than the fence. The class picked enough beans to share with the whole school.', 'What is the main idea?', 'Room 12’s care helped their garden grow well.', ['Weeds were pulled on Fridays.', 'The fence was very short.'], 'Which sentence would fit as a title for every part?'],
    ['Why Cats Purr', 'Cats often purr when they are relaxed and happy. But scientists have noticed that cats also purr when they are hurt or scared. Some think purring helps a cat calm itself down. Purring may mean more than just “I am happy.”', 'What is the main idea?', 'Cats purr for more reasons than happiness.', ['Cats are always happy when they purr.', 'Scientists study cats.'], 'Look at the last sentence. Does it sum up the paragraph?'],
  ],
  [
    ['The Lighthouse', 'Before radio and satellites, ships relied on lighthouses. A lighthouse keeper climbed the tower every evening to light the lamp. On foggy nights, the keeper also sounded a horn. Many sailors owed their lives to keepers who never missed a night.', 'Which sentence best states the main idea?', 'Lighthouse keepers played a vital role in keeping sailors safe.', ['Lighthouses are tall towers.', 'Fog makes it hard to see at night.'], 'Find the idea that the details about the lamp, the horn and the sailors all support.'],
    ['Recess Matters', 'Some schools have cut recess to make time for lessons. Yet studies show children pay better attention after a break. Recess also gives children time to make friends and solve problems on their own. Taking away recess may hurt learning instead of helping it.', 'Which sentence best states the main idea?', 'Recess supports learning and should not be cut.', ['Children make friends at recess.', 'Some schools have longer lessons.'], 'What is the author trying to convince you of?'],
    ['Desert Survivors', 'The desert seems empty, but many animals live there. Kangaroo rats get almost all their water from seeds. Fennec foxes lose heat through their huge ears. Many desert animals sleep during the hot day and hunt at night.', 'Which sentence best states the main idea?', 'Desert animals have special ways of surviving the heat and dryness.', ['Fennec foxes have huge ears.', 'Deserts are completely empty.'], 'Each example is one animal. What do the examples have in common?'],
  ],
  [
    ['The Price of Speed', 'Fast fashion lets shoppers buy new styles cheaply and often. But clothes made quickly are often worn only a few times before being thrown away. Making them uses large amounts of water and energy, and many end up in landfills. The low price at the register hides a much higher cost to the planet.', 'Which statement best expresses the central idea?', 'Cheap, fast-made clothing has hidden environmental costs.', ['Shoppers like to buy new styles.', 'Clothes are made with water and energy.', 'Landfills are getting full.'], 'A central idea connects all the details, including the final sentence.'],
    ['A Library Without Books', 'When the town library added laptops, maker kits and job workshops, some residents complained that it was no longer a “real” library. Yet visits doubled within a year. Teenagers came to build robots, and adults came to write résumés. The library had not abandoned its mission; it had found new ways to help people learn.', 'Which statement best expresses the central idea?', 'The library’s changes kept its purpose of helping people learn.', ['Teenagers like building robots.', 'Some residents complained about laptops.', 'Libraries should only lend books.'], 'Notice the word “Yet”. The writer turns from the complaint to the main point.'],
    ['Sleep and Memory', 'Students often stay up late to study before a test. However, research suggests sleep is when the brain sorts and stores what was learned during the day. A student who studies for an hour and then sleeps well may remember more than one who studies for three hours and sleeps little.', 'Which statement best expresses the central idea?', 'Sleep plays an important part in remembering what you study.', ['Students study the night before tests.', 'Studying for three hours is always best.', 'The brain is active during the day.'], 'Which statement would the research in the passage support?'],
  ],
];
const TEXT_STRUCTURE = [
  [
    ['How is this paragraph organized? “First, crack two eggs into a bowl. Next, whisk them with a fork. Then pour them into a hot pan. Finally, stir until they are set.”', 'Sequence (steps in order)', ['Compare and contrast', 'Problem and solution'], 'Look for the words first, next, then and finally.'],
    ['How is this paragraph organized? “Frogs and toads are both amphibians. Frogs have smooth, wet skin, while toads have dry, bumpy skin. Frogs have long legs for jumping, but toads have short legs for walking.”', 'Compare and contrast', ['Sequence (steps in order)', 'Cause and effect'], 'Words like “both”, “while” and “but” show likenesses and differences.'],
    ['How is this paragraph organized? “Heavy rain fell for three days. Because the ground could not soak up any more water, the river rose. As a result, the low roads flooded.”', 'Cause and effect', ['Compare and contrast', 'Description'], '“Because” and “as a result” connect a cause to what it led to.'],
  ],
  [
    ['How is this paragraph organized? “Our school’s lunch line was so long that some students had only five minutes to eat. The student council suggested opening a second serving window. Now every student has at least twenty minutes to eat.”', 'Problem and solution', ['Cause and effect', 'Sequence (steps in order)'], 'Is something wrong at the start, and is it fixed by the end?'],
    ['How is this paragraph organized? “The monarch butterfly has orange wings with black veins. White dots line the edges of its wings. Its body is black with small white spots.”', 'Description', ['Problem and solution', 'Compare and contrast'], 'Does the paragraph tell events, causes, or just what something is like?'],
    ['How is this paragraph organized? “In 1903 the Wright brothers flew for 12 seconds. By 1927 Charles Lindbergh had flown alone across the Atlantic. In 1969 astronauts landed on the moon.”', 'Chronological order', ['Description', 'Compare and contrast'], 'Look at the dates. Do they go in time order?'],
  ],
  [
    ['A writer explains why the Dust Bowl happened: years of drought, over-plowed soil and strong winds. Which structure fits this purpose best?', 'Cause and effect', ['Chronological order', 'Description', 'Compare and contrast'], 'The writer wants to explain WHY something happened.'],
    ['A writer wants to help readers choose between renting and buying a bike. Which structure fits this purpose best?', 'Compare and contrast', ['Cause and effect', 'Chronological order', 'Description'], 'Two options are being weighed against each other.'],
    ['A writer describes how plastic waste harms ocean animals and then proposes a city-wide ban on plastic straws. Which structure fits this purpose best?', 'Problem and solution', ['Description', 'Chronological order', 'Compare and contrast'], 'The text names something harmful and then suggests a fix.'],
  ],
];
const PUNCTUATION = [
  [
    ['Which sentence uses commas correctly?', 'We bought apples, bananas, and pears.', ['We bought apples bananas, and pears.', 'We bought, apples, bananas and pears.'], 'Commas separate items in a list.'],
    ['Which sentence is written correctly?', 'Sam’s dog likes to play fetch.', ['Sams dog likes to play fetch.', 'Sams’ dog likes to play fetch.'], 'One owner (Sam) takes ’s.'],
    ['Which sentence is written correctly?', 'Where is my backpack?', ['Where is my backpack.', 'Where is my backpack!'], 'A question ends with a question mark.'],
    ['Which sentence uses a comma correctly?', 'Yes, I would like some juice.', ['Yes I, would like some juice.', 'Yes I would, like some juice.'], 'Put a comma after an introductory word like yes or no.'],
  ],
  [
    ['Which sentence punctuates the dialogue correctly?', '“Let’s go to the park,” said Mia.', ['“Let’s go to the park” said Mia.', '“Let’s go to the park”, said Mia.'], 'In American English the comma goes inside the closing quotation mark.'],
    ['Which sentence is written correctly?', 'The girls’ team won the game.', ['The girl’s team won the game.', 'The girls team won the game.'], 'More than one girl owns the team. A plural ending in s takes just an apostrophe.'],
    ['Which sentence uses commas correctly?', 'After the game ended, we went home.', ['After the game, ended we went home.', 'After the game ended we, went home.'], 'Put a comma after an introductory clause.'],
    ['Which sentence is written correctly?', 'It’s time for the dog to eat its dinner.', ['Its time for the dog to eat it’s dinner.', 'It’s time for the dog to eat it’s dinner.'], 'It’s = it is. Its = belonging to it.'],
  ],
  [
    ['Which sentence uses a semicolon correctly?', 'The storm was fierce; the power went out for hours.', ['The storm was fierce; and the power went out.', 'The storm; was fierce, the power went out for hours.'], 'A semicolon joins two complete sentences without a joining word.'],
    ['Which sentence uses a colon correctly?', 'Bring three things: a pencil, a ruler, and an eraser.', ['Bring: a pencil, a ruler, and an eraser.', 'Bring three things a pencil: a ruler, and an eraser.'], 'A colon follows a complete sentence and introduces a list.'],
    ['Which sentence avoids a comma splice?', 'I studied all night, so I was tired in the morning.', ['I studied all night, I was tired in the morning.', 'I studied all night I was tired in the morning.'], 'Two complete sentences need a period, a semicolon, or a comma plus a joining word.'],
    ['Which sentence uses commas correctly with a non-essential clause?', 'My brother, who lives in Ohio, is visiting.', ['My brother who lives in Ohio, is visiting.', 'My brother, who lives in Ohio is visiting.'], 'Extra information in the middle of a sentence needs a comma on both sides.'],
  ],
];
const RHETORIC = [
  [
    ['“As a doctor with twenty years of experience, I can tell you this treatment works.” Which appeal is this?', 'Ethos (credibility)', ['Pathos (emotion)', 'Logos (logic)'], 'The speaker points to their own expertise.'],
    ['“Imagine a child shivering alone in the cold tonight.” Which appeal is this?', 'Pathos (emotion)', ['Logos (logic)', 'Ethos (credibility)'], 'Which feeling is the writer trying to stir in you?'],
    ['“Schools that added a later start time saw attendance rise by 8 percent.” Which appeal is this?', 'Logos (logic)', ['Pathos (emotion)', 'Ethos (credibility)'], 'Data and reasoning are appeals to logic.'],
  ],
  [
    ['“How much longer will we ignore this problem?” What device is the speaker using?', 'Rhetorical question', ['Anaphora', 'Understatement'], 'Does the speaker expect an actual answer?'],
    ['“We will not tire. We will not falter. We will not fail.” What device is this?', 'Anaphora (repetition at the start of clauses)', ['Rhetorical question', 'Analogy'], 'Look at how each sentence begins.'],
    ['“Some will say the plan costs too much. They are right that it is expensive, but doing nothing will cost far more.” What is the writer doing?', 'Addressing a counterclaim', ['Using an analogy', 'Appealing to authority'], 'The writer admits an opposing point before answering it.'],
  ],
  [
    ['A senator says, “Either we pass this bill or our cities will collapse.” Which weakness does this argument have?', 'False dilemma (only two options offered)', ['Appeal to authority', 'Strong statistical evidence', 'Ad hominem'], 'Are there really only two possible outcomes?'],
    ['“My opponent’s plan can’t be trusted; he can’t even keep his own lawn tidy.” Which fallacy is this?', 'Ad hominem (attacking the person)', ['False dilemma', 'Hasty generalization', 'Appeal to emotion'], 'Does the speaker discuss the plan, or the person?'],
    ['“I met two rude tourists, so all tourists are rude.” Which fallacy is this?', 'Hasty generalization', ['Ad hominem', 'False dilemma', 'Circular reasoning'], 'Is two examples enough to judge everyone?'],
  ],
];
function passageItem(rand, bank) {
  const [title, text, prompt, answer, wrong, hint] = pick(rand, bank);
  return choice(rand, { prompt, visual: { kind: 'passage', title, text }, answer, size: Math.min(4, wrong.length + 1), wrong: wrong.map((value) => ({ value })),
    hints: [hint, 'Check each choice against the whole passage, not just one sentence.'] });
}
function bankItem(rand, bank) {
  const [prompt, answer, wrong, hint] = pick(rand, bank);
  return choice(rand, { prompt, answer, size: Math.min(4, wrong.length + 1), wrong: wrong.map((value) => ({ value })), hints: [hint, 'Rule out the answers you are sure are wrong, then compare what is left.'] });
}

// ================= Science =================
const WATER_WEATHER = [
  [
    ['When the sun warms a lake, some water turns into water vapor and rises. What is this called?', 'Evaporation', ['Condensation', 'Precipitation'], 'Liquid water becoming a gas.'],
    ['Water vapor cools high in the sky and forms tiny droplets that make clouds. What is this called?', 'Condensation', ['Evaporation', 'Runoff'], 'A gas turning back into a liquid.'],
    ['Rain, snow, sleet and hail are all kinds of what?', 'Precipitation', ['Evaporation', 'Condensation'], 'Water falling from clouds to the ground.'],
    ['What is the main source of energy that drives the water cycle?', 'The sun', ['The moon', 'Earth’s core'], 'What heats the water so it can evaporate?'],
  ],
  [
    ['Water that flows over the ground into streams and rivers is called what?', 'Runoff', ['Groundwater', 'Transpiration'], 'It runs off the surface.'],
    ['Plants release water vapor through tiny holes in their leaves. What is this called?', 'Transpiration', ['Condensation', 'Precipitation'], 'It is like evaporation, but from plants.'],
    ['What pulls rain down from clouds and makes rivers flow downhill?', 'Gravity', ['Wind', 'Sunlight'], 'Which force pulls everything toward Earth?'],
    ['Cold, dense air pushes under warm air and forces it upward. Clouds and storms often form. What is this boundary called?', 'A cold front', ['A warm front', 'A high-pressure system'], 'Name the boundary by the air mass that is advancing.'],
  ],
  [
    ['Why do coastal cities often have milder winters than inland cities at the same latitude?', 'Water heats and cools more slowly than land.', ['Ocean air contains no water vapor.', 'Coastal cities are closer to the sun.'], 'Think about how quickly water changes temperature compared with land.'],
    ['Air rises up the side of a mountain, cools and drops its moisture. What is usually found on the far side?', 'A dry area (a rain shadow)', ['A rainforest', 'A glacier'], 'By the time the air comes down the other side, much of its water has fallen.'],
    ['Weather and climate differ how?', 'Weather is short-term conditions; climate is the long-term pattern.', ['Weather is only about rain; climate is only about temperature.', 'They mean the same thing.'], 'One is about today, the other about decades.'],
  ],
];
const PLATES = [
  [
    ['Earth’s outer layer is broken into large moving pieces. What are they called?', 'Tectonic plates', ['Fault lines', 'Continents'], 'They carry both continents and ocean floor.'],
    ['Where do most earthquakes and volcanoes happen?', 'Near the edges of tectonic plates', ['In the middle of plates', 'Only near the equator'], 'Where do plates push, pull and slide past each other?'],
    ['What is the name for melted rock beneath Earth’s surface?', 'Magma', ['Lava', 'Sediment'], 'It gets a different name once it reaches the surface.'],
  ],
  [
    ['At which kind of boundary do two plates move apart?', 'Divergent', ['Convergent', 'Transform'], 'Diverge means to move in different directions.'],
    ['The San Andreas Fault, where two plates slide past each other, is which kind of boundary?', 'Transform', ['Divergent', 'Convergent'], 'The plates move sideways past one another.'],
    ['Two continental plates collide and push the land upward. What forms?', 'Mountain ranges', ['Mid-ocean ridges', 'Rift valleys'], 'The Himalayas formed this way.'],
  ],
  [
    ['Fossils of the same land reptile are found in both South America and Africa. What does this best support?', 'The continents were once joined.', ['The reptile could swim across the Atlantic.', 'The fossils were carried by wind.'], 'This is evidence for continental drift.'],
    ['At a mid-ocean ridge, how does the age of the sea-floor rock change moving away from the ridge?', 'It gets older.', ['It gets younger.', 'It stays the same age.'], 'New crust forms at the ridge and spreads outward.'],
    ['What is thought to be the main force that moves tectonic plates?', 'Convection and gravity in the mantle', ['Ocean tides', 'Earth’s magnetic field'], 'Heat from deep inside Earth makes rock slowly flow.'],
  ],
];
function energy(d, rand) {
  if (d === 1) {
    const m = int(rand, 1, 20); const h = int(rand, 2, 30);
    return input(`A ${m} kg box sits on a shelf ${h} m high. Using g = 10 N/kg, what is its gravitational potential energy in joules?`, m * 10 * h,
      ['Gravitational potential energy = mass × g × height.', `${m} × 10 × ${h}.`], { [m * h]: 'one-step-only' });
  }
  if (d === 2) {
    const m = 2 * int(rand, 1, 10); const v = int(rand, 2, 12);
    return input(`A ${m} kg cart moves at ${v} m/s. What is its kinetic energy in joules?`, (m * v * v) / 2,
      ['Kinetic energy = ½ × mass × speed².', `Square the speed first: ${v}² = ${v * v}.`], { [m * v * v]: 'ke-no-half', [(m * v) / 2]: 'power-as-product' });
  }
  const m = int(rand, 1, 10); const h = int(rand, 2, 20);
  return input(`A ${m} kg ball is dropped from ${h} m. Ignoring air resistance and using g = 10 N/kg, how much kinetic energy (in J) does it have just before it hits the ground?`, m * 10 * h,
    ['Energy is conserved: the potential energy at the top becomes kinetic energy at the bottom.', `Potential energy at the top = ${m} × 10 × ${h}.`]);
}
// Common, stable isotopes: [symbol, name, atomic number, mass number of the most common isotope].
export const ELEMENTS = [
  ['H', 'hydrogen', 1, 1], ['He', 'helium', 2, 4], ['Li', 'lithium', 3, 7], ['C', 'carbon', 6, 12], ['N', 'nitrogen', 7, 14],
  ['O', 'oxygen', 8, 16], ['F', 'fluorine', 9, 19], ['Ne', 'neon', 10, 20], ['Na', 'sodium', 11, 23], ['Mg', 'magnesium', 12, 24],
  ['Al', 'aluminum', 13, 27], ['Si', 'silicon', 14, 28], ['P', 'phosphorus', 15, 31], ['S', 'sulfur', 16, 32], ['Cl', 'chlorine', 17, 35],
  ['K', 'potassium', 19, 39], ['Ca', 'calcium', 20, 40], ['Fe', 'iron', 26, 56], ['Cu', 'copper', 29, 63], ['Zn', 'zinc', 30, 64],
];
// Common monatomic ions and their charges.
export const IONS = [['Na', 1], ['K', 1], ['Mg', 2], ['Ca', 2], ['Al', 3], ['Cl', -1], ['F', -1], ['O', -2], ['S', -2]];
function atoms(d, rand) {
  if (d === 3) {
    const [sym, charge] = pick(rand, IONS);
    const [, nameOf, z] = ELEMENTS.find((e) => e[0] === sym);
    const c = `${Math.abs(charge) === 1 ? '' : Math.abs(charge)}${charge > 0 ? '+' : '−'}`;
    return input(`A ${nameOf} ion has a charge of ${c}. ${nameOf[0].toUpperCase() + nameOf.slice(1)} has atomic number ${z}. How many electrons does the ion have?`, z - charge,
      ['A neutral atom has as many electrons as protons. A positive ion has lost electrons; a negative ion has gained them.', `Start from ${z} electrons and adjust for the charge.`], { [z + charge]: 'ion-charge-sign' });
  }
  const [sym, nameOf, z, a] = pick(rand, ELEMENTS);
  if (d === 1) {
    return input(`An atom of ${nameOf} (${sym}) has atomic number ${z} and mass number ${a}. How many protons does it have?`, z,
      ['The atomic number is the number of protons.', 'The mass number counts protons and neutrons together.'], { [a]: 'protons-neutrons-mix', [a - z]: 'protons-neutrons-mix' });
  }
  if (a === z) return atoms(1, rand);
  return input(`An atom of ${nameOf} (${sym}) has atomic number ${z} and mass number ${a}. How many neutrons does it have?`, a - z,
    ['Mass number = protons + neutrons.', `Neutrons = ${a} − ${z}.`], { [z]: 'protons-neutrons-mix', [a + z]: 'wrong-operation' });
}

// ================= Social studies =================
const MAP_BANK = [
  [
    ['On a map, which direction is usually at the top?', 'North', ['South', 'East'], 'Look for the compass rose. N is usually at the top.'],
    ['If you face north, which direction is on your right?', 'East', ['West', 'South'], 'Never Eat Soggy Waffles: N, E, S, W going clockwise.'],
    ['What part of a map explains what its symbols mean?', 'The key (legend)', ['The compass rose', 'The scale'], 'It unlocks the meaning of the symbols.'],
    ['Which direction is halfway between north and west?', 'Northwest', ['Northeast', 'Southwest'], 'Combine the two directions.'],
  ],
  [],
  [
    ['What is the line of latitude at 0°?', 'The equator', ['The prime meridian', 'The Tropic of Cancer'], 'Latitude lines run east–west and measure north–south.'],
    ['Lines of longitude measure distance east or west of which line?', 'The prime meridian', ['The equator', 'The Arctic Circle'], 'It runs through Greenwich, England.'],
    ['The United States lies in which two hemispheres?', 'Northern and Western', ['Southern and Eastern', 'Northern and Eastern'], 'It is north of the equator and west of the prime meridian.'],
    ['A place at 40° N, 75° W is in which hemispheres?', 'Northern and Western', ['Southern and Western', 'Northern and Eastern'], 'N tells you north of the equator; W tells you west of the prime meridian.'],
  ],
];
function mapSkills(d, rand) {
  if (d !== 2) return bankItem(rand, MAP_BANK[d - 1]);
  const per = pick(rand, [5, 10, 20, 25, 50, 100]); const n = int(rand, 2, 9);
  return input(`On a map, 1 inch stands for ${per} miles. Two towns are ${n} inches apart on the map. How many miles apart are they?`, per * n,
    ['Each inch on the map is the same real distance.', `${n} inches × ${per} miles per inch.`], { [per + n]: 'wrong-operation' });
}
const WORLD_HISTORY = [
  [
    ['Along which river did ancient Egyptian civilization develop?', 'The Nile', ['The Amazon', 'The Mississippi'], 'Its yearly floods made the land fertile.'],
    ['The ancient Sumerians of Mesopotamia developed one of the earliest writing systems. What is it called?', 'Cuneiform', ['Hieroglyphics', 'The Latin alphabet'], 'Wedge-shaped marks pressed into clay.'],
    ['Which ancient city-state is known as an early birthplace of democracy?', 'Athens', ['Sparta', 'Babylon'], 'Citizens there voted directly on laws.'],
    ['The Code of Hammurabi, an early written set of laws, came from which empire?', 'Babylon', ['Rome', 'China'], 'Hammurabi was a king in Mesopotamia.'],
  ],
  [
    ['Which empire built a large network of roads and aqueducts across Europe and the Mediterranean?', 'The Roman Empire', ['The Mongol Empire', 'The Aztec Empire'], 'Its capital was Rome.'],
    ['The Silk Road connected China with which regions?', 'Central Asia, the Middle East and Europe', ['North and South America', 'Australia and Antarctica'], 'It was a trade route across Asia.'],
    ['In 1215, English nobles forced King John to accept a document limiting his power. What was it?', 'The Magna Carta', ['The Declaration of Independence', 'The Treaty of Versailles'], 'It is Latin for “Great Charter”.'],
    ['Around 1440, Johannes Gutenberg developed which invention in Europe?', 'A movable-type printing press', ['The telescope', 'The steam engine'], 'It made books far cheaper to produce.'],
  ],
  [
    ['In which country did the Industrial Revolution begin in the late 1700s?', 'Great Britain', ['Japan', 'Brazil'], 'Its coal, iron and textile mills led the way.'],
    ['Which event in 1914 is often named as the spark for World War I?', 'The assassination of Archduke Franz Ferdinand', ['The bombing of Pearl Harbor', 'The fall of the Berlin Wall'], 'He was heir to the Austro-Hungarian throne.'],
    ['The Cold War was a long rivalry mainly between which two powers?', 'The United States and the Soviet Union', ['Britain and France', 'China and Japan'], 'It lasted from the late 1940s to 1991.'],
    ['In which city did the Renaissance first flourish in the 1400s?', 'Florence', ['London', 'Moscow'], 'It is in Italy, and the Medici family were patrons there.'],
  ],
];
function budgeting(d, rand) {
  if (d === 1) {
    const pay = pick(rand, [1200, 1500, 1800, 2000, 2400]); const rent = pick(rand, [500, 600, 700, 800]); const food = pick(rand, [200, 250, 300]); const other = pick(rand, [100, 150, 200]);
    return input(`You earn $${pay} a month. You spend $${rent} on rent, $${food} on food and $${other} on other bills. How many dollars are left to save?`, pay - rent - food - other,
      ['Add up all the spending.', 'Take the total spending away from what you earn.'], { [rent + food + other]: 'one-step-only' });
  }
  if (d === 2) {
    const wage = pick(rand, [12, 14, 15, 16, 18, 20]); const hrs = pick(rand, [10, 15, 20, 25]); const tax = pick(rand, [10, 20]);
    const gross = wage * hrs;
    return input(`You earn $${wage} an hour and work ${hrs} hours a week. ${tax}% is withheld for taxes. What is your take-home pay, in dollars, for one week?`, gross - (gross * tax) / 100,
      [`Gross pay = $${wage} × ${hrs}.`, `Take away ${tax}% of the gross pay.`], { [(gross * tax) / 100]: 'one-step-only', [gross]: 'one-step-only' });
  }
  const pay = pick(rand, [2000, 2500, 3000, 3200, 4000]);
  const [label, pct] = pick(rand, [['needs', 50], ['wants', 30], ['savings', 20]]);
  return input(`The 50/30/20 budget rule puts 50% of take-home pay toward needs, 30% toward wants and 20% toward savings. With $${pay} take-home pay, how many dollars go to ${label}?`, (pay * pct) / 100,
    [`${label[0].toUpperCase() + label.slice(1)} get ${pct}%.`, `${pct}% of $${pay} = ${pay} × ${pct} ÷ 100.`]);
}

// ================= Computer science =================
function binary(d, rand) {
  if (d === 1) {
    const n = int(rand, 1, 15); const bits = n.toString(2).padStart(4, '0');
    return input(`What is the binary number ${bits} in decimal?`, n,
      ['From the right, the place values are 1, 2, 4, 8.', 'Add the place values that have a 1.'], {});
  }
  if (d === 2) {
    const n = int(rand, 16, 255); const bits = n.toString(2).padStart(8, '0');
    const near = [n ^ 1, n ^ 2, n ^ 16].filter((x) => x !== n);
    return choice(rand, {
      prompt: `Which binary number equals ${n} in decimal?`, answer: bits, wrong: near.map((x) => ({ value: x.toString(2).padStart(8, '0') })),
      hints: ['Place values from the right: 1, 2, 4, 8, 16, 32, 64, 128.', `Start with the biggest place value that fits in ${n}, subtract it, and repeat.`],
    });
  }
  const b = int(rand, 2, 10);
  return input(`How many different values can be stored using ${b} bits?`, 2 ** b,
    ['Each bit doubles the number of possible patterns.', `2 × 2 × … (${b} times) = 2${sup(b)}.`], { [2 * b]: 'power-as-product', [2 ** b - 1]: 'off-by-one' });
}
const pyBool = (v) => (v ? 'True' : 'False');
function booleanLogic(d, rand) {
  if (d === 3) {
    const x = int(rand, 1, 20); const lo = int(rand, 1, 12); const m = pick(rand, [2, 3, 5]);
    const val = (x > lo && x % m === 0) || x === 7;
    const code = `x = ${x}\nresult = (x > ${lo} and x % ${m} == 0) or x == 7\nprint(result)`;
    return choice(rand, { prompt: 'What does this program print?', visual: { kind: 'code', text: code }, answer: pyBool(val), wrong: [{ value: pyBool(!val) }],
      hints: [`Work out each comparison with x = ${x}: is x > ${lo}? Is x % ${m} == 0 (no remainder)?`, '“and” needs both sides True; “or” needs at least one side True.'] });
  }
  const a = rand() < 0.5; const b = rand() < 0.5; const c = rand() < 0.5;
  const [expr, val] = d === 1
    ? pick(rand, [[`a and b`, a && b], [`a or b`, a || b], [`not a`, !a], [`not b`, !b]])
    : pick(rand, [[`(a and not b) or c`, (a && !b) || c], [`not (a or b)`, !(a || b)], [`a and (b or c)`, a && (b || c)], [`(not a) or (b and c)`, !a || (b && c)]]);
  const vars = d === 1 ? `a = ${pyBool(a)}, b = ${pyBool(b)}` : `a = ${pyBool(a)}, b = ${pyBool(b)}, c = ${pyBool(c)}`;
  return choice(rand, { prompt: `${vars}. What is the value of: ${expr}?`, answer: pyBool(val), wrong: [{ value: pyBool(!val) }],
    hints: ['Work inside the parentheses first, and apply “not” before “and”, and “and” before “or”.', '“and” is True only when both sides are True; “or” is True when at least one side is True.'] });
}

export const EXPANSION_BANKS = { MAIN_IDEA, TEXT_STRUCTURE, PUNCTUATION, RHETORIC, WATER_WEATHER, PLATES, WORLD_HISTORY, MAP_BANK };

export const EXPANSION_GENERATORS = {
  'multiply-multidigit': multiplyMultidigit,
  'long-division': longDivision,
  'fraction-add-subtract': fractionAddSubtract,
  'multiply-fractions': multiplyFractions,
  'volume': volume,
  'order-of-operations': orderOfOperations,
  'divide-fractions': divideFractions,
  'one-step-equations': oneStepEquations,
  'area-triangles': areaTriangles,
  'circles': circles,
  'scientific-notation': scientificNotation,
  'linear-functions': linearFunctions,
  'volume-solids': volumeSolids,
  'exponential-functions': exponentialFunctions,
  'polynomials': polynomials,
  'sequences': sequences,
  'data-spread': dataSpread,
  'unit-circle': unitCircle,
  'main-idea': (d, rand) => passageItem(rand, MAIN_IDEA[d - 1]),
  'text-structure': (d, rand) => bankItem(rand, TEXT_STRUCTURE[d - 1]),
  'punctuation': (d, rand) => bankItem(rand, PUNCTUATION[d - 1]),
  'rhetoric': (d, rand) => bankItem(rand, RHETORIC[d - 1]),
  'water-cycle-weather': (d, rand) => bankItem(rand, WATER_WEATHER[d - 1]),
  'plate-tectonics': (d, rand) => bankItem(rand, PLATES[d - 1]),
  'energy': energy,
  'atoms': atoms,
  'map-skills': mapSkills,
  'world-history': (d, rand) => bankItem(rand, WORLD_HISTORY[d - 1]),
  'budgeting': budgeting,
  'binary': binary,
  'boolean-logic': booleanLogic,
};
