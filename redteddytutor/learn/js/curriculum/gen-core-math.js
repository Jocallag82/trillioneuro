// National core build-out (October 2026): K-8 mathematics skills that close the
// standards gaps found by the coverage report (curriculum/standards/coverage.js).
//
// Every item is computed from the numbers the learner sees. Wrong options carry a
// mistake code only when they are built from that mistake. scripts/core.test.mjs
// re-solves every prompt independently, from its text alone.
import { int, pick, choice, input } from './kit.js';

const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
const lcm = (a, b) => (a * b) / gcd(a, b);
const fmt = (n) => n.toLocaleString('en-US');
const money = (c) => `$${(c / 100).toFixed(2)}`;
const neg = (n) => (n < 0 ? `−${-n}` : String(n));

// ---------- Kindergarten - Grade 2 ----------
function addWithin10(d, rand) {
  if (d === 3) {
    // Two steps within 10: some arrive, then some leave.
    const a = int(rand, 2, 6); const b = int(rand, 1, 10 - a); const c = int(rand, 1, a + b - 1);
    return input(`${a} ducks are on a pond. ${b} more swim over. Then ${c} fly away. How many ducks are on the pond now?`, a + b - c,
      [`First find how many after ${b} more swim over.`, `Then take away the ${c} that fly away.`], { [a + b + c]: 'wrong-operation', [a + b]: 'one-step-only' });
  }
  const minus = d === 2 && rand() < 0.5;
  const a = int(rand, d === 1 ? 1 : 3, d === 1 ? 5 : 10);
  const b = minus ? int(rand, 1, a) : int(rand, 0, Math.min(d === 1 ? 5 : 10, 10 - a));
  const ans = minus ? a - b : a + b;
  const story = minus ? `There are ${a} apples. ${b} are eaten. How many are left?` : `There are ${a} red balls and ${b} blue balls. How many balls altogether?`;
  return choice(rand, {
    prompt: story, answer: ans, min: 0, max: 20,
    wrong: [{ value: minus ? a + b : Math.abs(a - b), misconception: 'wrong-operation' }, { value: ans + 1, misconception: 'off-by-one' }, { value: ans - 1, misconception: 'off-by-one' }],
    hints: [minus ? 'Start with ' + a + ' and take away ' + b + '.' : 'Start with ' + a + ' and count on ' + b + ' more.', 'Draw dots for the story and count them.'],
  });
}

function countTo120(d, rand) {
  const step = d === 3 ? 10 : 1;
  const start = d === 1 ? int(rand, 10, 40) : d === 2 ? int(rand, 40, 115) : int(rand, 1, 9) + 10 * int(rand, 0, 7);
  const seq = [0, 1, 2, 3].map((i) => start + i * step);
  const answer = seq[3];
  const shown = seq.slice(0, 3).join(', ');
  return choice(rand, {
    prompt: d === 3 ? `Count by tens: ${shown}, ?` : `What number comes next? ${shown}, ?`, answer, min: 1, max: 130,
    wrong: [{ value: answer + 1, misconception: 'off-by-one' }, { value: answer - 1, misconception: 'off-by-one' }, { value: d === 3 ? seq[2] + 1 : answer + 10, misconception: 'place-value-swap' }],
    hints: [d === 3 ? 'Counting by tens changes the tens digit each time. The ones digit stays the same.' : 'Say the numbers aloud and keep going.', `The last number was ${seq[2]}. What is ${step} more?`],
  });
}

// Unknown-change stories ("some more came; how many?"), distinct from bare facts.
const MA_STORY = [['Mia', 'stickers'], ['Leo', 'marbles'], ['Ava', 'shells'], ['Sam', 'stamps'], ['Zoe', 'beads']];
function missingAddend(d, rand) {
  const total = d === 1 ? int(rand, 6, 10) : d === 2 ? int(rand, 11, 20) : int(rand, 21, 100);
  const a = int(rand, 1, total - 1);
  const b = total - a;
  const [who, what] = pick(rand, MA_STORY);
  const prompt = d === 3 && rand() < 0.5
    ? `${who} had some ${what}. Then ${who} got ${a} more and now has ${total}. How many ${what} did ${who} have at first?`
    : `${who} has ${a} ${what} and gets some more. Now ${who} has ${total}. How many more did ${who} get?`;
  return input(prompt, b, [`Think: ${a} + ? = ${total}. Count on from ${a} to ${total}.`, `Or subtract: ${total} − ${a}.`], { [total + a]: 'wrong-operation', [b + 1]: 'off-by-one', [b - 1]: 'off-by-one' });
}

function compareLengths(d, rand) {
  const things = ['pencil', 'crayon', 'ribbon', 'stick', 'straw', 'rope'];
  const a = pick(rand, things); const others = things.filter((t) => t !== a); const b = pick(rand, others); const c = pick(rand, others.filter((t) => t !== b));
  if (d === 3) {
    const la = int(rand, 5, 15); const lb = la + int(rand, 2, 9);
    return input(`The ${a} is ${la} cubes long. The ${b} is ${lb} cubes long. How many cubes longer is the ${b}?`, lb - la,
      ['Compare: how many more cubes does the longer one have?', `Count on from ${la} to ${lb}.`], { [la + lb]: 'wrong-operation' });
  }
  const lens = [int(rand, 2, 6), int(rand, 7, 11), int(rand, 12, 18)];
  const [x, y, z] = [lens[0], lens[1], lens[2]];
  const names = { [a]: x, [b]: y, [c]: z };
  const ask = d === 1 || rand() < 0.5 ? 'longest' : 'shortest';
  const ans = ask === 'longest' ? c : a;
  return choice(rand, {
    prompt: `The ${a} is ${x} cubes long, the ${b} is ${y} cubes long and the ${c} is ${z} cubes long. Which is the ${ask}?`,
    answer: ans, wrong: Object.keys(names).filter((n) => n !== ans).map((value) => ({ value })), size: 3,
    hints: ['More cubes means longer.', `Find the ${ask === 'longest' ? 'biggest' : 'smallest'} number of cubes.`],
  });
}

function countMoney(d, rand) {
  const coins = d === 1 ? [[int(rand, 1, 4), 10, 'dimes'], [int(rand, 1, 5), 1, 'pennies']]
    : d === 2 ? [[int(rand, 1, 3), 25, 'quarters'], [int(rand, 1, 4), 10, 'dimes'], [int(rand, 1, 3), 5, 'nickels']]
      : [[int(rand, 1, 3), 100, 'dollar bills'], [int(rand, 1, 3), 25, 'quarters'], [int(rand, 0, 4), 10, 'dimes'], [int(rand, 1, 4), 1, 'pennies']];
  const used = coins.filter(([n]) => n > 0);
  const total = used.reduce((s, [n, v]) => s + n * v, 0);
  const desc = used.map(([n, , name]) => `${n} ${n === 1 ? name.replace(/ies$/, 'y').replace(/s$/, '') : name}`).join(', ');
  const countOnly = used.reduce((s, [n]) => s + n, 0);
  return choice(rand, {
    prompt: `How much money is ${desc}?`, answer: money(total),
    wrong: [{ value: money(countOnly), misconception: 'count-skip' }, { value: money(total + 5) }, { value: money(total - 1) }, { value: money(total + 10) }],
    hints: ['Start with the coins worth the most, then count on.', 'Quarter = 25¢, dime = 10¢, nickel = 5¢, penny = 1¢, dollar = 100¢.'],
  });
}

function skipCount100s(d, rand) {
  const step = d === 1 ? 5 : d === 2 ? 10 : 100;
  const start = step * int(rand, 1, d === 3 ? 6 : 15);
  const seq = [0, 1, 2, 3].map((i) => start + i * step);
  return choice(rand, {
    prompt: `Skip-count by ${step}s: ${seq.slice(0, 3).join(', ')}, ?`, answer: seq[3], min: 0,
    wrong: [{ value: seq[2] + 1, misconception: 'sequence-rule' }, { value: seq[3] + step }, { value: seq[3] - 1, misconception: 'off-by-one' }],
    hints: [`Each number is ${step} more than the one before.`, `Add ${step} to ${seq[2]}.`],
  });
}

function evenOdd(d, rand) {
  const n = d === 1 ? int(rand, 1, 20) : d === 2 ? int(rand, 21, 99) : int(rand, 100, 999);
  const ans = n % 2 === 0 ? 'Even' : 'Odd';
  return choice(rand, {
    prompt: `Is ${n} even or odd?`, answer: ans, wrong: [{ value: ans === 'Even' ? 'Odd' : 'Even' }], size: 2,
    hints: ['Even numbers can be split into two equal groups, or into pairs with none left over.', 'Only the ones digit matters: 0, 2, 4, 6, 8 are even.'],
  });
}

// ---------- Grades 3-5 ----------
function roundNumbers(d, rand) {
  const to = d === 1 ? 10 : d === 2 ? 100 : pick(rand, [10, 100]);
  let n = d === 1 ? int(rand, 11, 99) : int(rand, 101, 999);
  if (n % to === 0) n += 3;
  const ans = Math.round(n / to) * to; // .5 rounds up; Math.round does the same for positives
  const down = Math.floor(n / to) * to; const up = down + to;
  return choice(rand, {
    prompt: `Round ${n} to the nearest ${to}.`, answer: ans, min: 0,
    wrong: [{ value: ans === up ? down : up, misconception: 'place-value-swap' }, { value: to === 10 ? Math.round(n / 100) * 100 : Math.round(n / 10) * 10 }, { value: ans + to }],
    hints: [`Which two multiples of ${to} is ${n} between?`, `Look at the ${to === 10 ? 'ones' : 'tens'} digit: 5 or more rounds up, 4 or less rounds down.`],
  });
}

function addSubtract1000(d, rand) {
  const sub = d >= 2 && rand() < 0.5;
  if (sub) {
    const a = int(rand, 300, 999); const b = int(rand, 101, a - 50);
    const noBorrow = Number(String(a).padStart(3, '0').split('').map((x, i) => Math.abs(Number(x) - Number(String(b).padStart(3, '0')[i]))).join(''));
    return input(`${a} − ${b} = ?`, a - b, ['Subtract the ones, then the tens, then the hundreds.', 'If the top digit is smaller, regroup: take one from the next column.'], { [noBorrow]: 'smaller-from-larger', [a + b]: 'wrong-operation' });
  }
  const a = int(rand, 100, d === 1 ? 499 : 699); const b = int(rand, 100, 999 - a);
  const noCarry = Number(String(a).split('').map((x, i) => (Number(x) + Number(String(b)[i])) % 10).join(''));
  return input(`${a} + ${b} = ?`, a + b, ['Add the ones, then the tens, then the hundreds.', 'If a column makes 10 or more, carry the ten into the next column.'], { [noCarry]: 'no-regroup' });
}

function multiplyTens(d, rand) {
  const a = int(rand, 2, 9); const t = int(rand, 2, 9) * (d === 3 ? 100 : 10);
  return input(`${a} × ${t} = ?`, a * t, [`${t} is ${t / (d === 3 ? 100 : 10)} ${d === 3 ? 'hundreds' : 'tens'}.`, `So ${a} × ${t} = ${a} × ${t / (d === 3 ? 100 : 10)} ${d === 3 ? 'hundreds' : 'tens'}.`], { [a * t / 10]: 'count-zeros', [a + t]: 'times-as-add' });
}

function elapsedTime(d, rand) {
  const h = int(rand, 7, 10); const m = d === 1 ? 0 : 5 * int(rand, 0, 11);
  const add = d === 1 ? 30 : d === 2 ? 5 * int(rand, 3, 9) : 5 * int(rand, 10, 20);
  const end = h * 60 + m + add;
  const t = (x) => `${Math.floor(x / 60) > 12 ? Math.floor(x / 60) - 12 : Math.floor(x / 60)}:${String(x % 60).padStart(2, '0')}`;
  return choice(rand, {
    prompt: `A lesson starts at ${t(h * 60 + m)} a.m. and lasts ${add} minutes. What time does it end?`, answer: t(end),
    wrong: [{ value: t(end + 60), misconception: 'clock-hour-next' }, { value: t(end - 10) }, { value: t(end + 10) }, { value: t(end - 60) }],
    hints: ['Count on to the next hour first, then add the minutes that are left.', 'There are 60 minutes in an hour.'],
  });
}

function massVolume(d, rand) {
  const unit = pick(rand, [['bag of flour', 'grams', 'g'], ['jug of juice', 'liters', 'L'], ['box of apples', 'kilograms', 'kg']]);
  const a = int(rand, 3, d === 1 ? 20 : 60); const b = int(rand, 2, d === 1 ? 20 : 40);
  if (d === 3) {
    const n = int(rand, 3, 8); const each = int(rand, 2, 12);
    return input(`One ${unit[0]} holds ${each} ${unit[1]}. How many ${unit[1]} do ${n} of them hold?`, n * each, ['Each one holds the same amount, so multiply.', `${n} groups of ${each}.`], { [n + each]: 'times-as-add' });
  }
  return input(`One ${unit[0]} has ${a} ${unit[1]}. Another has ${b} ${unit[1]}. How many ${unit[1]} altogether?`, a + b, ['Altogether means add.', `${a} + ${b}.`], { [Math.abs(a - b)]: 'wrong-operation' });
}

function factorsMultiples(d, rand) {
  if (d === 1) {
    const n = pick(rand, [12, 15, 16, 18, 20, 24, 28, 30, 36]);
    const facs = Array.from({ length: n }, (_, i) => i + 1).filter((x) => n % x === 0 && x > 1 && x < n);
    const yes = pick(rand, facs);
    const nots = Array.from({ length: 11 }, (_, i) => i + 2).filter((x) => n % x !== 0);
    return choice(rand, { prompt: `Which number is a factor of ${n}?`, answer: yes, wrong: nots.map((value) => ({ value })), hints: [`A factor divides ${n} with nothing left over.`, 'Try each choice: does it go into ' + n + ' exactly?'] });
  }
  if (d === 2) {
    const n = int(rand, 3, 9); const k = int(rand, 3, 12);
    const m = n * k;
    return choice(rand, { prompt: `Which number is a multiple of ${n}?`, answer: m, wrong: [m + 1, m - 1, m + Math.ceil(n / 2) === m + n ? m + 2 : m + Math.ceil(n / 2)].filter((x) => x % n !== 0).map((value) => ({ value })), hints: [`Multiples of ${n} are in the ${n} times table.`, `Divide each choice by ${n}. Which has no remainder?`] });
  }
  const n = pick(rand, [2, 3, 5, 7, 11, 13, 17, 19, 23, 29, 31, 37, 41, 43, 47, 4, 6, 8, 9, 10, 12, 14, 15, 21, 25, 27, 33, 35, 39, 49, 51]);
  const isPrime = n > 1 && Array.from({ length: n - 2 }, (_, i) => i + 2).every((x) => n % x !== 0);
  const ans = isPrime ? 'Prime' : 'Composite';
  return choice(rand, { prompt: `Is ${n} prime or composite?`, answer: ans, wrong: [{ value: isPrime ? 'Composite' : 'Prime' }], size: 2, hints: ['A prime number has exactly two factors: 1 and itself.', `Try dividing ${n} by 2, 3, 5 and 7.`] });
}

function placeValueMillions(d, rand) {
  if (d === 1) {
    const n = int(rand, 100000, 999999); const s = String(n);
    const pos = int(rand, 0, 2); const names = ['hundred thousands', 'ten thousands', 'thousands'];
    const digit = Number(s[pos]);
    return input(`What is the value of the digit in the ${names[pos]} place of ${fmt(n)}?`, digit * 10 ** (5 - pos), ['Name each place from the right: ones, tens, hundreds, thousands, ten thousands, hundred thousands.', 'The value is the digit times the place.'], { [digit]: 'place-value-swap' });
  }
  if (d === 2) {
    const a = int(rand, 1000000, 9999999); let b = a + pick(rand, [-1, 1]) * int(rand, 1, 9) * 10 ** int(rand, 2, 5);
    if (b === a) b += 1000;
    const ans = a > b ? fmt(a) : fmt(b);
    return choice(rand, { prompt: `Which number is greater: ${fmt(a)} or ${fmt(b)}?`, answer: ans, wrong: [{ value: ans === fmt(a) ? fmt(b) : fmt(a) }], size: 2, hints: ['Compare the digits from the left.', 'The first place where the digits differ decides.'] });
  }
  const n = int(rand, 10000, 999999); const to = pick(rand, [1000, 10000]);
  const ans = Math.round(n / to) * to;
  return choice(rand, { prompt: `Round ${fmt(n)} to the nearest ${fmt(to)}.`, answer: fmt(ans), wrong: [{ value: fmt(ans === Math.floor(n / to) * to ? ans + to : ans - to), misconception: 'place-value-swap' }, { value: fmt(Math.round(n / (to * 10)) * to * 10) }, { value: fmt(Math.round(n / (to / 10)) * (to / 10)) }], hints: [`Find the two multiples of ${fmt(to)} on either side.`, 'Look at the digit to the right of the rounding place.'] });
}

function equivalentFractions(d, rand) {
  const den = d === 1 ? pick(rand, [2, 3, 4]) : pick(rand, [3, 4, 5, 6, 8]);
  const num = int(rand, 1, den - 1);
  const k = int(rand, 2, d === 3 ? 6 : 4);
  if (d === 3) {
    // Simplify a fraction.
    const g = gcd(num, den); const n0 = num / g; const d0 = den / g;
    return choice(rand, { prompt: `Write ${num * k}/${den * k} in simplest form.`, answer: `${n0}/${d0}`, wrong: [{ value: `${num * k / 2 | 0}/${den * k / 2 | 0}` }, { value: `${n0 + 1}/${d0}` }, { value: `${d0}/${n0}` }, { value: `${n0}/${d0 + 1}` }].filter((w) => !w.value.endsWith('/0') && w.value !== `${n0}/${d0}`), hints: ['Divide the top and bottom by the same number.', `Both ${num * k} and ${den * k} can be divided by ${k * g}.`] });
  }
  return input(`${num}/${den} = ?/${den * k}`, num * k, [`The bottom was multiplied by ${k}.`, `Do the same to the top: ${num} × ${k}.`], { [num + (den * k - den)]: 'additive-scaling' });
}

const SINGULAR = { feet: 'foot', yards: 'yard', hours: 'hour', meters: 'meter', kilograms: 'kilogram', pounds: 'pound', gallons: 'gallon', kilometers: 'kilometer', days: 'day', liters: 'liter' };
function measurementConversion(d, rand) {
  const pairs = d === 1 ? [['feet', 'inches', 12], ['yards', 'feet', 3], ['hours', 'minutes', 60]]
    : d === 2 ? [['meters', 'centimeters', 100], ['kilograms', 'grams', 1000], ['pounds', 'ounces', 16], ['gallons', 'quarts', 4]]
      : [['kilometers', 'meters', 1000], ['days', 'hours', 24], ['liters', 'milliliters', 1000], ['feet', 'inches', 12]];
  const [big, small, f] = pick(rand, pairs);
  const n = int(rand, 2, 9);
  return input(`${n} ${big} = ? ${small}`, n * f, [`1 ${SINGULAR[big]} = ${f} ${small}.`, `Going to a smaller unit means more of them, so multiply.`], { [Math.round(n / f * 100) / 100]: 'inverse-operation', [n + f]: 'times-as-add' });
}

function angles(d, rand) {
  if (d === 1) {
    const a = pick(rand, [30, 45, 60, 90, 100, 120, 135, 150, 170]);
    const ans = a < 90 ? 'Acute' : a === 90 ? 'Right' : 'Obtuse';
    return choice(rand, { prompt: `An angle measures ${a}°. What kind of angle is it?`, answer: ans, wrong: ['Acute', 'Right', 'Obtuse'].filter((x) => x !== ans).map((value) => ({ value })), size: 3, hints: ['A right angle is exactly 90°.', 'Acute is less than 90°; obtuse is between 90° and 180°.'] });
  }
  const total = d === 2 ? 90 : pick(rand, [90, 180]);
  const a = 5 * int(rand, 2, total / 5 - 2);
  return input(`Two angles together make a ${total === 90 ? 'right angle (90°)' : 'straight line (180°)'}. One is ${a}°. What is the other, in degrees?`, total - a, [`The two angles add to ${total}°.`, `${total} − ${a}.`], { [(total === 90 ? 180 : 90) - a]: 'inverse-operation' });
}

function decimalOperations(d, rand) {
  const c = (x) => Math.round(x * 100) / 100;
  if (d === 1) {
    const a = c(int(rand, 11, 99) / 10); const b = c(int(rand, 11, 99) / 10);
    return input(`${a} + ${b} = ?`, c(a + b), ['Line up the decimal points.', 'Add the tenths, then the ones.'], {});
  }
  if (d === 2) {
    const a = c(int(rand, 100, 999) / 100); const b = c(int(rand, 10, Math.floor(a * 100) - 1) / 100);
    return input(`${a.toFixed(2)} − ${b.toFixed(2)} = ?`, c(a - b), ['Line up the decimal points, then subtract as with whole numbers.', 'Regroup if a digit on top is smaller.'], { [c(a + b)]: 'wrong-operation' });
  }
  const a = c(int(rand, 2, 9) / 10 + int(rand, 1, 9)); const b = int(rand, 2, 9);
  return input(`${a} × ${b} = ?`, c(a * b), [`Multiply as if there were no decimal point: ${Math.round(a * 10)} × ${b}.`, 'Then put back one decimal place.'], { [Math.round(a * 10) * b]: 'decimal-fraction-digits' });
}

function powersOfTen(d, rand) {
  const n = d === 1 ? int(rand, 13, 99) : c3(int(rand, 11, 999) / 10);
  const p = int(rand, 1, d === 3 ? 3 : 2);
  const mul = d === 3 ? rand() < 0.5 : true;
  const ans = mul ? c3(n * 10 ** p) : c3(n / 10 ** p);
  const sym = mul ? '×' : '÷';
  return input(`${n} ${sym} ${10 ** p} = ?`, ans, [`${sym === '×' ? 'Multiplying' : 'Dividing'} by ${10 ** p} moves every digit ${p} place${p > 1 ? 's' : ''} to the ${mul ? 'left' : 'right'}.`, `Count the zeros in ${10 ** p}: there ${p > 1 ? 'are' : 'is'} ${p}.`], { [mul ? c3(n / 10 ** p) : c3(n * 10 ** p)]: 'inverse-operation' });
}
function c3(x) { return Math.round(x * 1000) / 1000; }

function coordinatePlane(d, rand) {
  if (d === 3) {
    const x = int(rand, -9, 9) || 4; const y1 = int(rand, -9, 9); let y2 = int(rand, -9, 9); if (y2 === y1) y2 = y1 + 3;
    return input(`What is the distance between (${neg(x)}, ${neg(y1)}) and (${neg(x)}, ${neg(y2)})?`, Math.abs(y1 - y2), ['The x-coordinates match, so the points are on a vertical line.', 'Distance is the difference of the y-coordinates (always positive). If they have opposite signs, add their distances from 0.'], { [Math.abs(Math.abs(y1) - Math.abs(y2))]: 'integer-sign' });
  }
  const x = d === 1 ? int(rand, 1, 9) : pick(rand, [-1, 1]) * int(rand, 1, 9); const y = d === 1 ? int(rand, 1, 9) : pick(rand, [-1, 1]) * int(rand, 1, 9);
  const xs = neg(x); const ys = neg(y);
  if (d === 2 && rand() < 0.5) {
    const q = x > 0 && y > 0 ? 'Quadrant I' : x < 0 && y > 0 ? 'Quadrant II' : x < 0 ? 'Quadrant III' : 'Quadrant IV';
    return choice(rand, { prompt: `In which quadrant is the point (${xs}, ${ys})?`, answer: q, wrong: ['Quadrant I', 'Quadrant II', 'Quadrant III', 'Quadrant IV'].filter((v) => v !== q).map((value) => ({ value })), hints: ['Quadrant I is top right (+, +). Number the others counterclockwise.', 'The first number tells left/right; the second tells up/down.'] });
  }
  return choice(rand, {
    prompt: `Start at the origin. Move ${Math.abs(x)} ${x < 0 ? 'left' : 'right'} and ${Math.abs(y)} ${y < 0 ? 'down' : 'up'}. Which point are you at?`,
    answer: `(${xs}, ${ys})`, wrong: [{ value: `(${ys}, ${xs})`, misconception: 'clock-hands-swap' }, { value: `(${neg(-x)}, ${ys})` }, { value: `(${xs}, ${neg(-y)})` }],
    hints: ['The first coordinate is how far across (x); the second is how far up or down (y).', 'Across first, then up: "along the corridor, then up the stairs".'],
  });
}

// ---------- Grades 6-8 ----------
function gcfLcm(d, rand) {
  const k = int(rand, 2, d === 1 ? 6 : 12); const a = k * int(rand, 1, 6); let b = k * int(rand, 2, 7); if (b === a) b += k;
  if (d === 3) {
    const x = int(rand, 3, 12); const y = int(rand, 4, 15);
    return input(`Buns come in packs of ${x} and rolls in packs of ${y}. What is the smallest number of each you can buy to have the same number of buns and rolls?`, lcm(x, y), ['You need a number that is a multiple of both.', 'List multiples of the larger number until one is also a multiple of the other.'], { [x * y === lcm(x, y) ? -1 : x * y]: 'times-as-add' });
  }
  const ask = d === 1 ? 'greatest common factor' : pick(rand, ['greatest common factor', 'least common multiple']);
  const ans = ask === 'greatest common factor' ? gcd(a, b) : lcm(a, b);
  return input(`Find the ${ask} of ${a} and ${b}.`, ans, [ask === 'greatest common factor' ? 'List the factors of each number and find the biggest they share.' : 'List multiples of each number and find the first they share.', ask === 'greatest common factor' ? `It must divide both ${a} and ${b}.` : `It must be divisible by both ${a} and ${b}.`], { [ask === 'greatest common factor' ? lcm(a, b) : gcd(a, b)]: 'inverse-operation' });
}

function multiDigitDivision(d, rand) {
  const b = d === 1 ? int(rand, 13, 25) : int(rand, 13, 48); const q = d === 3 ? int(rand, 21, 99) : int(rand, 6, 40);
  return input(`${b * q} ÷ ${b} = ?`, q, [`Estimate: about how many ${b}s are in ${b * q}?`, `Check by multiplying your answer by ${b}.`], {});
}

function absoluteValue(d, rand) {
  if (d === 1) { const n = int(rand, -40, 40) || -7; return input(`|${neg(n)}| = ?`, Math.abs(n), ['Absolute value is distance from zero.', 'Distance is never negative.'], { [-Math.abs(n)]: 'integer-sign' }); }
  if (d === 2) {
    const a = -int(rand, 2, 30); const b = -int(rand, 2, 30); if (a === b) return absoluteValue(1, rand);
    const ans = neg(Math.min(a, b));
    return choice(rand, { prompt: `Which is less: ${neg(a)} or ${neg(b)}?`, answer: ans, wrong: [{ value: neg(Math.max(a, b)), misconception: 'integer-sign' }], size: 2, hints: ['On a number line, numbers further left are less.', 'For negatives, the bigger the distance from 0, the smaller the number.'] });
  }
  const a = int(rand, -20, -1); const b = int(rand, 1, 20);
  return input(`The temperature was ${neg(a)}°F in the morning and ${b}°F in the afternoon. How many degrees did it rise?`, b - a, ['Find the distance from the morning temperature up to 0, then from 0 up to the afternoon.', `${Math.abs(a)} + ${b}.`], { [b + a]: 'integer-sign' });
}

function evaluateExpressions(d, rand) {
  const x = int(rand, 2, 9);
  if (d === 1) { const a = int(rand, 2, 9); const b = int(rand, 1, 20); return input(`Evaluate ${a}x + ${b} when x = ${x}.`, a * x + b, [`${a}x means ${a} × x.`, `Replace x with ${x}: ${a} × ${x} + ${b}.`], { [Number(`${a}${x}`) + b]: 'times-as-add' }); }
  if (d === 2) { const a = int(rand, 2, 5); return input(`Evaluate x² + ${a}x when x = ${x}.`, x * x + a * x, ['x² means x × x, not x × 2.', `Do the powers and products first, then add.`], { [2 * x + a * x]: 'power-as-product' }); }
  const a = int(rand, 2, 6); const b = int(rand, 2, 9);
  return choice(rand, { prompt: `Which expression is equivalent to ${a}(x + ${b})?`, answer: `${a}x + ${a * b}`, wrong: [{ value: `${a}x + ${b}`, misconception: 'distribution-error' }, { value: `x + ${a * b}` }, { value: `${a + b}x` }], hints: ['The number outside multiplies everything inside.', `${a} × x and ${a} × ${b}.`] });
}

function inequalities(d, rand) {
  if (d === 1) {
    const a = int(rand, 3, 15); const sym = pick(rand, ['>', '<']);
    const cands = [a - 2, a, a + 2]; const ans = sym === '>' ? a + 2 : a - 2;
    return choice(rand, { prompt: `Which value is a solution of x ${sym} ${a}?`, answer: ans, wrong: cands.filter((c) => c !== ans).map((value) => ({ value, ...(value === a ? { misconception: 'off-by-one' } : {}) })), size: 3, hints: [`x ${sym} ${a} means x is ${sym === '>' ? 'more' : 'less'} than ${a}.`, `${a} itself is not ${sym === '>' ? 'more' : 'less'} than ${a}.`] });
  }
  const a = int(rand, 2, 6); const x = int(rand, 2, 9); const b = int(rand, 1, 12); const sym = pick(rand, ['>', '<']);
  if (d === 2) return choice(rand, { prompt: `Solve: x + ${b} ${sym} ${x + b}`, answer: `x ${sym} ${x}`, wrong: [{ value: `x ${sym === '>' ? '<' : '>'} ${x}` }, { value: `x ${sym} ${x + 2 * b}`, misconception: 'inverse-operation' }, { value: `x = ${x}` }], hints: ['Solve it like an equation: undo the + ' + b + '.', 'Subtract ' + b + ' from both sides; the sign stays the same.'] });
  const flip = sym === '>' ? '<' : '>';
  return choice(rand, { prompt: `Solve: −${a}x ${sym} ${-a * x < 0 ? '−' + a * x : a * x}`, answer: `x ${flip} ${x}`, wrong: [{ value: `x ${sym} ${x}`, misconception: 'integer-sign' }, { value: `x ${flip} −${x}` }, { value: `x ${sym} −${x}` }], hints: [`Divide both sides by −${a}.`, 'Dividing or multiplying by a negative number reverses the inequality sign.'] });
}

function proportional(d, rand) {
  const k = int(rand, 2, 9); const x = int(rand, 2, 12);
  if (d === 1) return input(`3 notebooks cost $${3 * k}. At the same price, how many dollars do ${x} notebooks cost?`, k * x, ['Find the cost of one notebook first (the unit rate).', `Then multiply by ${x}.`], { [3 * k + x]: 'additive-scaling' });
  if (d === 2) {
    const x2 = x + int(rand, 1, 5);
    return input(`y is proportional to x. When x = ${x}, y = ${k * x}. What is the constant of proportionality?`, k, ['In a proportional relationship y = kx.', `k = y ÷ x = ${k * x} ÷ ${x}.`], { [k * x - x]: 'additive-scaling', [x2]: null });
  }
  const p = int(rand, 2, 6); const q = p + int(rand, 1, 4);
  const okRow = [[1, k], [2, 2 * k], [4, 4 * k]];
  const badRow = [[1, k], [2, 2 * k + 1], [4, 4 * k + 3]];
  const addRow = [[1, k], [2, k + p], [4, k + 3 * p]];
  const fmtT = (r) => r.map(([a, b]) => `(${a}, ${b})`).join(' ');
  void q;
  return choice(rand, { prompt: 'Which table shows a proportional relationship between x and y?', answer: fmtT(okRow), wrong: [{ value: fmtT(addRow), misconception: 'additive-scaling' }, { value: fmtT(badRow) }], size: 3, hints: ['In a proportional table, y ÷ x is the same for every pair.', 'Check each pair: is y always the same multiple of x?'] });
}

function angleRelationships(d, rand) {
  const a = 5 * int(rand, 4, 30);
  if (d === 1) return input(`Two angles are supplementary. One measures ${a}°. What is the other?`, 180 - a, ['Supplementary angles add to 180°.', `180 − ${a}.`], { [90 - a]: 'inverse-operation' });
  if (d === 2) {
    const b = 5 * int(rand, 4, 12);
    return input(`Two vertical angles are formed by crossing lines. One measures ${b}°. What is the angle vertical to it?`, b, ['Vertical angles are opposite each other where two lines cross.', 'Vertical angles are equal.'], { [180 - b]: null });
  }
  const p = 5 * int(rand, 6, 16); const q = 5 * int(rand, 6, 16);
  if (p + q >= 175) return angleRelationships(1, rand);
  return input(`A triangle has angles of ${p}° and ${q}°. What is the third angle?`, 180 - p - q, ['The angles in a triangle add to 180°.', `180 − ${p} − ${q}.`], { [360 - p - q]: null });
}

function surfaceArea(d, rand) {
  if (d === 1) { const s = int(rand, 2, 9); return input(`A cube has edges of ${s} cm. What is its surface area, in cm²?`, 6 * s * s, ['A cube has 6 square faces.', `Each face is ${s} × ${s}.`], { [s ** 3]: 'volume-surface-mix' }); }
  const l = int(rand, 2, 9); const w = int(rand, 2, 9); const h = int(rand, 2, 9);
  return input(`A rectangular prism is ${l} cm long, ${w} cm wide and ${h} cm tall. What is its surface area, in cm²?`, 2 * (l * w + l * h + w * h), ['There are three pairs of matching faces.', `2 × (${l}×${w} + ${l}×${h} + ${w}×${h}).`], { [l * w * h]: 'volume-surface-mix', [l * w + l * h + w * h]: 'perimeter-two-sides' });
}

function sampling(d, rand) {
  const n = pick(rand, [20, 25, 40, 50]); const k = int(rand, 2, n / 2 - 1); const pop = n * pick(rand, [10, 20, 30, 50]);
  if (d === 1) return choice(rand, { prompt: 'Which sample is most likely to represent all students in a school?', answer: '50 students chosen at random from the school list', wrong: [{ value: 'The 50 students on the basketball team' }, { value: 'The first 50 students who arrive at the library' }, { value: 'Students in one class who volunteer' }], hints: ['A good sample gives every student the same chance of being chosen.', 'Which choice could leave out whole groups of students?'] });
  return input(`In a random sample of ${n} students, ${k} walk to school. About how many of the ${pop} students in the school walk to school?`, (k * pop) / n, [`What fraction of the sample walk? ${k}/${n}.`, `Apply the same fraction to ${pop}.`], { [k * (pop / 100)]: null });
}

function compoundProbability(d, rand) {
  if (d === 1) { const s = pick(rand, [2, 3, 4, 5, 6]); return choice(rand, { prompt: `You flip a coin and roll a number cube (1–6). What is the probability of heads and a ${s}?`, answer: '1/12', wrong: [{ value: '1/8', misconception: 'add-denominators' }, { value: '2/12' }, { value: '1/6' }], hints: ['There are 2 × 6 = 12 equally likely outcomes.', 'Only one of them is heads with a ' + s + '.'] }); }
  const a = int(rand, 1, 3); const b = int(rand, 1, 4); const tot = a + b + int(rand, 1, 3);
  // With replacement: P(red then red).
  const num = a * a; const den = tot * tot; const g = gcd(num, den);
  return choice(rand, { prompt: `A bag has ${tot} marbles; ${a} are red. You pick one, put it back, then pick again. What is the probability both are red?`, answer: `${num / g}/${den / g}`, wrong: [{ value: (() => { const g2 = gcd(2 * a, tot); return `${2 * a / g2}/${tot / g2}`; })(), misconception: 'add-denominators' }, { value: (() => { const g3 = gcd(a, tot); return `${a / g3}/${tot / g3}`; })() }, { value: `${a}/${2 * tot}` }].filter((w) => w.value !== `${num / g}/${den / g}`), hints: ['Both picks are independent because the marble goes back.', `Multiply: ${a}/${tot} × ${a}/${tot}.`] });
}

function squareRoots(d, rand) {
  if (d === 1) { const r = int(rand, 2, 15); return input(`√${r * r} = ?`, r, ['Which number times itself makes ' + r * r + '?', 'A square root undoes squaring.'], { [r * r / 2]: 'power-as-product' }); }
  if (d === 2) {
    const n = pick(rand, [2, 3, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15, 17, 18, 19, 20, 21, 22, 23, 24]);
    const lo = Math.floor(Math.sqrt(n));
    return choice(rand, { prompt: `√${n} lies between which two whole numbers?`, answer: `${lo} and ${lo + 1}`, wrong: [{ value: `${lo - 1} and ${lo}` }, { value: `${lo + 1} and ${lo + 2}` }, { value: `${Math.floor(n / 2)} and ${Math.floor(n / 2) + 1}`, misconception: 'power-as-product' }].filter((w) => w.value !== `${lo} and ${lo + 1}` && !w.value.startsWith('0 and 1') && !w.value.startsWith('-')), hints: ['Find the perfect squares just below and just above ' + n + '.', `${lo}² = ${lo * lo} and ${lo + 1}² = ${(lo + 1) ** 2}.`] });
  }
  const pool = [['√49', 'Rational'], ['√2', 'Irrational'], ['0.75', 'Rational'], ['π', 'Irrational'], ['√16', 'Rational'], ['√10', 'Irrational'], ['2/3', 'Rational'], ['√5', 'Irrational'], ['0.333…', 'Rational']];
  const [v, ans] = pick(rand, pool);
  return choice(rand, { prompt: `Is ${v} rational or irrational?`, answer: ans, wrong: [{ value: ans === 'Rational' ? 'Irrational' : 'Rational' }], size: 2, hints: ['A rational number can be written as a fraction of two integers.', 'Square roots of perfect squares are whole numbers; repeating decimals are rational.'] });
}

function transformations(d, rand) {
  const x = int(rand, -8, 8) || 3; const y = int(rand, -8, 8) || -2;
  const P = (a, b) => `(${neg(a)}, ${neg(b)})`;
  if (d === 1) {
    const dx = int(rand, -6, 6) || 2; const dy = int(rand, -6, 6) || -3;
    return choice(rand, { prompt: `Translate ${P(x, y)} by ${Math.abs(dx)} ${dx < 0 ? 'left' : 'right'} and ${Math.abs(dy)} ${dy < 0 ? 'down' : 'up'}. Where does it land?`, answer: P(x + dx, y + dy), wrong: [{ value: P(x + dy, y + dx) }, { value: P(x - dx, y - dy), misconception: 'integer-sign' }, { value: P(x + dx, y - dy) }], hints: ['Left/right changes x; up/down changes y.', `x: ${neg(x)} ${dx < 0 ? '−' : '+'} ${Math.abs(dx)}. y: ${neg(y)} ${dy < 0 ? '−' : '+'} ${Math.abs(dy)}.`] });
  }
  if (d === 2) {
    const axis = pick(rand, ['x-axis', 'y-axis']);
    const ans = axis === 'x-axis' ? P(x, -y) : P(-x, y);
    return choice(rand, { prompt: `Reflect ${P(x, y)} across the ${axis}. Where does it land?`, answer: ans, wrong: [{ value: axis === 'x-axis' ? P(-x, y) : P(x, -y), misconception: 'clock-hands-swap' }, { value: P(-x, -y) }, { value: P(y, x) }].filter((w) => w.value !== ans), hints: [`Reflecting across the ${axis} keeps the ${axis === 'x-axis' ? 'x' : 'y'}-coordinate.`, `It flips the sign of the ${axis === 'x-axis' ? 'y' : 'x'}-coordinate.`] });
  }
  const turn = pick(rand, [90, 180]);
  const ans = turn === 180 ? P(-x, -y) : P(-y, x);
  return choice(rand, { prompt: `Rotate ${P(x, y)} ${turn}° counterclockwise about the origin. Where does it land?`, answer: ans, wrong: [{ value: turn === 180 ? P(-y, x) : P(y, -x) }, { value: turn === 180 ? P(x, -y) : P(-x, -y) }, { value: P(y, x) }].filter((w) => w.value !== ans), hints: [turn === 180 ? 'A half turn flips both signs: (x, y) → (−x, −y).' : 'A quarter turn counterclockwise: (x, y) → (−y, x).', 'Sketch it: which quadrant should the point end up in?'] });
}

function twoWayTables(d, rand) {
  const a = int(rand, 5, 30); const b = int(rand, 5, 30); const c = int(rand, 5, 30); const e = int(rand, 5, 30);
  const tab = `Grade 7: ${a} like soccer, ${b} do not. Grade 8: ${c} like soccer, ${e} do not.`;
  if (d === 1) return input(`${tab} How many students were surveyed altogether?`, a + b + c + e, ['Add every cell of the table.', `${a} + ${b} + ${c} + ${e}.`], { [a + c]: null });
  if (d === 2) return input(`${tab} How many students like soccer?`, a + c, ['Add the "like soccer" cells from both grades.', `${a} + ${c}.`], { [a + b]: null });
  const g = gcd(a, a + b);
  return choice(rand, { prompt: `${tab} What fraction of grade 7 students like soccer?`, answer: `${a / g}/${(a + b) / g}`, wrong: [{ value: (() => { const h = gcd(a, a + c); return `${a / h}/${(a + c) / h}`; })(), misconception: 'part-to-part' }, { value: (() => { const h = gcd(a, b); return `${a / h}/${b / h}`; })(), misconception: 'part-to-part' }].filter((w) => w.value !== `${a / g}/${(a + b) / g}`), hints: ['The question is about grade 7 only, so the total is the grade 7 row.', `${a} out of ${a} + ${b}.`] });
}

function distanceMidpoint(d, rand) {
  const triples = [[3, 4, 5], [6, 8, 10], [5, 12, 13], [8, 15, 17], [9, 12, 15]];
  const x1 = int(rand, -5, 5); const y1 = int(rand, -5, 5);
  if (d === 3) {
    const x2 = x1 + 2 * int(rand, -5, 5); const y2 = y1 + 2 * int(rand, -5, 5);
    return choice(rand, { prompt: `Find the midpoint of (${neg(x1)}, ${neg(y1)}) and (${neg(x2)}, ${neg(y2)}).`, answer: `(${neg((x1 + x2) / 2)}, ${neg((y1 + y2) / 2)})`, wrong: [{ value: `(${neg(x2 - x1)}, ${neg(y2 - y1)})` }, { value: `(${neg(x1 + x2)}, ${neg(y1 + y2)})`, misconception: 'triangle-no-half' }, { value: `(${neg((y1 + y2) / 2)}, ${neg((x1 + x2) / 2)})` }].filter((w) => w.value !== `(${neg((x1 + x2) / 2)}, ${neg((y1 + y2) / 2)})`), hints: ['The midpoint is the average of the x-coordinates and of the y-coordinates.', '((x₁ + x₂)/2, (y₁ + y₂)/2).'] });
  }
  const [a, b, c] = pick(rand, d === 1 ? triples.slice(0, 2) : triples);
  const sx = pick(rand, [1, -1]); const sy = pick(rand, [1, -1]);
  return input(`What is the distance between (${neg(x1)}, ${neg(y1)}) and (${neg(x1 + sx * a)}, ${neg(y1 + sy * b)})?`, c, ['Make a right triangle: the legs are the change in x and the change in y.', 'Use a² + b² = c², then take the square root.'], { [a + b]: 'pythagorean-no-square' });
}

function scaleDrawings(d, rand) {
  const s = pick(rand, [2, 5, 10, 20, 25]); const cm = int(rand, 2, 12);
  if (d === 3) return input(`On a map, 1 cm represents ${s} km. Two towns are ${cm * s} km apart. How far apart are they on the map, in cm?`, cm, ['Each map centimeter stands for ' + s + ' km.', `${cm * s} ÷ ${s}.`], { [cm * s * s]: 'inverse-operation' });
  return input(`On a map, 1 cm represents ${s} km. Two towns are ${cm} cm apart on the map. How far apart are they really, in km?`, cm * s, ['Each map centimeter stands for ' + s + ' km.', `${cm} × ${s}.`], { [cm + s]: 'times-as-add' });
}

function unitRateFractions(d, rand) {
  const den = pick(rand, [2, 3, 4]); const rate = int(rand, 2, 12);
  return input(`A snail crawls ${rate}/${den} of a meter in 1/${den} of an hour. What is its speed in meters per hour?`, rate, [`How many 1/${den}-hours make one hour? ${den}.`, `So multiply the distance by ${den}.`], { [Math.round(rate / den / den * 100) / 100]: 'inverse-operation' });
}

export const CORE_MATH_GENERATORS = {
  'add-within-10': addWithin10,
  'count-to-120': countTo120,
  'missing-addend': missingAddend,
  'compare-lengths': compareLengths,
  'count-money': countMoney,
  'skip-counting': skipCount100s,
  'even-odd': evenOdd,
  'rounding': roundNumbers,
  'add-subtract-1000': addSubtract1000,
  'multiply-by-tens': multiplyTens,
  'elapsed-time': elapsedTime,
  'mass-and-volume': massVolume,
  'factors-multiples': factorsMultiples,
  'place-value-millions': placeValueMillions,
  'equivalent-fractions': equivalentFractions,
  'unit-conversion': measurementConversion,
  'angles': angles,
  'decimal-operations': decimalOperations,
  'powers-of-ten': powersOfTen,
  'coordinate-plane': coordinatePlane,
  'gcf-lcm': gcfLcm,
  'multi-digit-division': multiDigitDivision,
  'absolute-value': absoluteValue,
  'expressions': evaluateExpressions,
  'inequalities': inequalities,
  'proportional-relationships': proportional,
  'angle-relationships': angleRelationships,
  'surface-area': surfaceArea,
  'sampling': sampling,
  'compound-probability': compoundProbability,
  'square-roots': squareRoots,
  'transformations': transformations,
  'two-way-tables': twoWayTables,
  'distance-midpoint': distanceMidpoint,
  'scale-drawings': scaleDrawings,
  'unit-rate-fractions': unitRateFractions,
};
