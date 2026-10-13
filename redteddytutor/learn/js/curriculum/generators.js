// Practice items, made from rules rather than written one by one.
//
// Every item's answer is computed here, and every wrong option that shows a known
// mistake carries that mistake's code (see misconceptions.js). Nothing is produced
// by a language model. scripts/curriculum.test.mjs re-checks every generated answer
// independently across thousands of seeds.
//
// generateStep(objective, difficulty, rand) -> one step in the engine's format
// practiceActivity(objective, difficulty, seed, count) -> a full activity
import { OBJECTIVES } from './framework.js';
import { mulberry32 } from '../../game/js/rng.js';

const int = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
const pick = (rand, list) => list[Math.floor(rand() * list.length)];

function shuffled(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Builds a choice step from the right value and candidate wrong values.
// Wrong values equal to the answer, duplicates and out-of-range values are dropped.
function choice(rand, { prompt, visual, answer, wrong, hints, label = String, visualFor, listen, min = -Infinity, max = Infinity, size = 4 }) {
  const seen = new Set([String(answer)]);
  const distractors = [];
  for (const w of wrong) {
    const key = String(w.value);
    if (seen.has(key) || (typeof w.value === 'number' && (w.value < min || w.value > max))) continue;
    seen.add(key);
    distractors.push(w);
  }
  const chosen = [{ value: answer }, ...distractors.slice(0, size - 1)];
  const options = shuffled(chosen, rand).map((w) => ({
    id: String(w.value),
    label: label(w.value),
    ...(visualFor ? { visual: visualFor(w.value) } : {}),
    ...(w.misconception ? { misconception: w.misconception } : {}),
  }));
  return { prompt, ...(visual ? { visual } : {}), ...(listen ? { listen: true } : {}), options, answer: String(answer), hints };
}

// Typed numeric answer. `wrong` maps a wrong value to the mistake it shows.
function input(prompt, answer, hints, wrong = {}, visual) {
  const map = {};
  for (const [k, v] of Object.entries(wrong)) if (Number(k) !== answer && v) map[String(k)] = v;
  return { kind: 'input', prompt, ...(visual ? { visual } : {}), answer: String(answer), wrong: map, hints };
}

const dots = (count) => ({ kind: 'dots', count });
const text = (t) => ({ kind: 'text', text: String(t) });

// ---------- Maths ----------
const RANGES = {
  'count-to-5': [[1, 3], [2, 4], [3, 5]],
  'count-to-10': [[4, 6], [5, 8], [7, 10]],
};

function counting(id, d, rand) {
  const [lo, hi] = RANGES[id][d - 1];
  const n = int(rand, lo, hi);
  if (id === 'count-to-10' && d === 3 && rand() < 0.5) {
    return {
      kind: 'build', prompt: `Put ${n} counters in the frame.`, target: n, start: 0, capacity: 10,
      hints: ['Count each counter as you put it in.', `Stop when you say ${n}.`],
    };
  }
  return choice(rand, {
    prompt: 'How many dots are there?', visual: dots(n), answer: n, min: 1, max: 10,
    wrong: [{ value: n - 1, misconception: 'count-skip' }, { value: n + 1, misconception: 'count-double' }, { value: n + 2 }],
    hints: ['Touch each dot as you count.', 'Count once more, one dot at a time, without skipping any.'],
  });
}

function numberNames(d, rand) {
  const n = int(rand, d === 1 ? 1 : 3, d === 1 ? 5 : d === 2 ? 8 : 10);
  return choice(rand, {
    prompt: `Which picture shows ${n}?`, visual: text(n), answer: n, min: 1, max: 10, visualFor: dots,
    label: (v) => `${v} ${v === 1 ? 'dot' : 'dots'}`,
    wrong: [{ value: n - 1, misconception: 'count-skip' }, { value: n + 1, misconception: 'count-double' }, { value: n + 2 }],
    hints: [`Count the dots in each picture. Which one stops at ${n}?`, 'Touch each dot as you count.'],
  });
}

function subitise(d, rand) {
  const n = int(rand, d === 1 ? 1 : d === 2 ? 4 : 6, d === 1 ? 5 : d === 2 ? 8 : 10);
  return choice(rand, {
    prompt: 'How many counters are in the frame? Try to see it without counting each one.',
    visual: { kind: 'tenframe', filled: n }, answer: n, min: 1, max: 10,
    wrong: [{ value: n - 1, misconception: 'count-skip' }, { value: n + 1, misconception: 'count-double' }, { value: 10 - n }],
    hints: ['A full row has 5. Start from 5 if the top row is full.', 'Look at the empty squares too. The whole frame holds 10.'],
  });
}

function compare(d, rand) {
  const max = d === 1 ? 10 : 20;
  const a = int(rand, 1, max);
  let b = int(rand, 1, max);
  while (b === a) b = int(rand, 1, max);
  const fewer = d === 3 && rand() < 0.5;
  const answer = fewer ? Math.min(a, b) : Math.max(a, b);
  const other = answer === a ? b : a;
  const step = choice(rand, {
    prompt: fewer ? `Which number is smaller: ${a} or ${b}?` : `Which number is bigger: ${a} or ${b}?`,
    answer, wrong: [{ value: other }], size: 2,
    ...(d === 1 ? { visualFor: dots, label: String } : {}),
    hints: ['Think of counting up. Which number do you say later?', 'Picture a number line. Bigger numbers are further along.'],
  });
  if (d === 1) step.options.forEach((o) => { o.visual = dots(Number(o.id)); });
  return step;
}

function numberLine(d, rand) {
  const max = d === 1 ? 10 : 20;
  const target = int(rand, 1, max - 1);
  return {
    kind: 'numberline', prompt: `Put the marker on ${target}.`, min: 0, max, target,
    labelEvery: d === 3 ? 5 : d === 2 ? 2 : 1,
    wrong: { [target - 1]: 'number-line-ticks', [target + 1]: 'number-line-ticks' },
    hints: ['Start at 0 and count the jumps along the line.', `Find the nearest labelled number, then count on or back to ${target}.`],
  };
}

function placeValue100(d, rand) {
  const tens = int(rand, 2, 9);
  let ones = int(rand, 1, 9);
  if (ones === tens) ones = ones === 9 ? 1 : ones + 1;
  const n = tens * 10 + ones;
  if (d === 1) {
    return choice(rand, {
      prompt: `How many tens are in ${n}?`, answer: tens, size: 3,
      wrong: [{ value: ones, misconception: 'place-value-swap' }, { value: n }],
      hints: ['The left digit tells you the tens.', `${n} is ${tens} tens and some ones.`],
    });
  }
  if (d === 2) {
    return choice(rand, {
      prompt: 'What number do these blocks make?', visual: { kind: 'blocks', tens, ones }, answer: n, size: 3,
      wrong: [{ value: ones * 10 + tens, misconception: 'place-value-swap' }, { value: tens + ones }],
      hints: ['Count the long sticks in tens: 10, 20, 30…', 'Then count on the small cubes as ones.'],
    });
  }
  const extra = int(rand, 11, 15);
  const total = tens * 10 + extra;
  if (total > 99) return placeValue100(2, rand);
  return input(`${tens} tens and ${extra} ones. What number is that?`, total,
    ['Ten ones make one more ten.', `${extra} ones is 1 ten and ${extra - 10} ones.`],
    { [Number(`${tens}${extra}`)]: 'no-regroup', [tens * 10 + (extra - 10)]: null });
}

function placeValue1000(d, rand) {
  const h = int(rand, 1, 9);
  const t = d === 1 ? int(rand, 1, 9) : int(rand, 0, 9);
  const o = int(rand, 1, 9);
  const n = h * 100 + t * 10 + o;
  if (d === 1) {
    return choice(rand, {
      prompt: `In ${n}, what is the ${t} worth?`, answer: t * 10, size: 3,
      wrong: [{ value: t }, { value: t * 100, misconception: 'place-value-swap' }],
      hints: ['Name each column: hundreds, tens, ones.', `The ${t} is in the tens column.`],
    });
  }
  const tensWord = t === 0 ? 'no tens' : `${t} ${t === 1 ? 'ten' : 'tens'}`;
  return input(`${h} hundreds, ${tensWord} and ${o} ones. Write the number.`, n,
    ['Write a digit for every column, even when it is 0.', 'Hundreds first, then tens, then ones.'],
    t === 0 ? { [h * 10 + o]: 'place-value-swap' } : { [o * 100 + t * 10 + h]: 'place-value-swap' });
}

function bonds(d, rand) {
  const given = int(rand, d === 1 ? 5 : 1, 9);
  const need = 10 - given;
  if (d < 3) {
    return {
      kind: 'build', prompt: `There are ${given} counters. Add more to make 10.`, target: 10, start: given, capacity: 10,
      hints: ['A full frame is 10.', `Count the empty squares. That is how many ${given} needs to make 10.`],
    };
  }
  return choice(rand, {
    prompt: `${given} + ? = 10`, answer: need, min: 0,
    wrong: [{ value: need + 1, misconception: 'off-by-one' }, { value: need - 1, misconception: 'off-by-one' }, { value: 10 + given, misconception: 'wrong-operation' }],
    hints: ['Picture a ten frame with that many counters. How many squares are empty?', `Count on from ${given} to 10.`],
  });
}

function addWithin20(d, rand) {
  let a; let b;
  if (d === 1) { a = int(rand, 1, 6); b = int(rand, 1, 10 - a); }
  else { a = int(rand, 5, 9); b = int(rand, 11 - a, 9); }
  const sum = a + b;
  const wrong = [{ value: sum - 1, misconception: 'off-by-one' }, { value: sum + 1, misconception: 'off-by-one' }];
  if (a !== b) wrong.push({ value: Math.abs(a - b), misconception: 'wrong-operation' });
  if (d === 3) {
    return input(`${a} + ? = ${sum}`, b, ['Count on from the first number to the total.', `What do you add to ${a} to make ${sum}?`],
      { [sum + a]: 'wrong-operation', [b + 1]: 'off-by-one', [b - 1]: 'off-by-one' });
  }
  return choice(rand, {
    prompt: `${a} + ${b} = ?`, answer: sum, min: 0, wrong,
    hints: d === 2 ? [`Make 10 first: how much does ${a} need to make 10?`, 'Then add what is left over.'] : [`Start at ${a} and count on ${b}.`, 'Use your fingers or picture dots.'],
  });
}

function subtractWithin20(d, rand) {
  let a; let b;
  if (d === 1) { a = int(rand, 3, 10); b = int(rand, 1, a - 1); }
  else { a = int(rand, 11, 18); b = int(rand, a - 9, 9); }
  const diff = a - b;
  const wrong = [
    { value: a + b, misconception: 'wrong-operation' },
    { value: diff + 1, misconception: 'off-by-one' },
    { value: diff - 1, misconception: 'off-by-one' },
  ];
  if (d === 3) {
    return input(`${a} − ${b} = ?`, diff, [`Count back ${b} from ${a}, or count up from ${b} to ${a}.`, 'Go back to 10 first, then the rest.'],
      { [a + b]: 'wrong-operation', [diff + 1]: 'off-by-one', [diff - 1]: 'off-by-one' });
  }
  return choice(rand, {
    prompt: `${a} − ${b} = ?`, answer: diff, min: 0, wrong,
    hints: [`Start at ${a} and count back ${b}.`, `Or count up from ${b} to ${a}. How many jumps?`],
  });
}

const digits = (n) => String(n).split('').map(Number);

function add2(d, rand) {
  let a; let b;
  if (d === 1) { do { a = int(rand, 11, 79); b = int(rand, 11, 89 - a); } while ((a % 10) + (b % 10) >= 10 || b < 11); }
  else if (d === 2) { do { a = int(rand, 15, 69); b = int(rand, 15, 89 - a); } while ((a % 10) + (b % 10) < 10 || b < 11); }
  else { do { a = int(rand, 45, 89); b = int(rand, 35, 89); } while ((a % 10) + (b % 10) < 10 || a + b < 100); }
  const sum = a + b;
  const [at, ao] = [Math.floor(a / 10), a % 10];
  const [bt, bo] = [Math.floor(b / 10), b % 10];
  const wrong = { [a - b > 0 ? a - b : b - a]: 'wrong-operation' };
  if (ao + bo >= 10) {
    wrong[Number(`${at + bt}${ao + bo}`)] = 'no-regroup';
    wrong[(at + bt) * 10 + ((ao + bo) % 10)] = 'no-regroup';
  }
  return input(`${a} + ${b} = ?`, sum, ['Add the ones first. Do they make a new ten?', 'Then add the tens, including any new ten.'], wrong);
}

function sub2(d, rand) {
  let a; let b;
  if (d === 1) { do { a = int(rand, 35, 99); b = int(rand, 11, a - 10); } while (b % 10 > a % 10); }
  else { do { a = int(rand, d === 2 ? 31 : 51, 99); b = int(rand, 12, a - 10); } while (b % 10 <= a % 10); }
  const diff = a - b;
  const [ad, bd] = [digits(a), digits(b).length === 1 ? [0, b] : digits(b)];
  const flipped = Number(ad.map((x, i) => Math.abs(x - bd[i])).join(''));
  const wrong = { [a + b]: 'wrong-operation' };
  if (b % 10 > a % 10) wrong[flipped] = 'smaller-from-larger';
  return input(`${a} − ${b} = ?`, diff,
    ['Start with the ones. Is the top ones digit big enough to take away from?', 'If not, exchange one ten for ten ones.'], wrong);
}

function times(id, d, rand) {
  const tables = id === 'times-2-5-10' ? [2, 5, 10] : null;
  const a = tables ? pick(rand, tables) : int(rand, 2, d === 1 ? 5 : d === 2 ? 9 : 12);
  const b = int(rand, 2, tables ? (d === 1 ? 5 : 10) : (d === 1 ? 6 : d === 2 ? 9 : 12));
  const product = a * b;
  if (id === 'times-2-5-10' && d === 1) {
    return choice(rand, {
      prompt: `${b} groups of ${a}. How many altogether?`, visual: { kind: 'groups', groups: b, each: a }, answer: product,
      wrong: [{ value: a + b, misconception: 'times-as-add' }, { value: product + a }, { value: product - a }], min: 1,
      hints: [`Count in ${a}s, one group at a time.`, `${b} groups of ${a} is ${b} × ${a}.`],
    });
  }
  if (d === 2) {
    return choice(rand, {
      prompt: `${a} × ${b} = ?`, answer: product, min: 1,
      wrong: [{ value: a + b, misconception: 'times-as-add' }, { value: a * (b + 1) }, { value: a * (b - 1) }],
      hints: [`Count in ${a}s, ${b} times.`, `Use a fact you know, like ${a} × 2 or ${a} × 10, and build from it.`],
    });
  }
  return input(`${a} × ${b} = ?`, product, [`Count in ${a}s, ${b} times.`, `${a} × ${b} is the same as ${b} × ${a}. Use whichever you know better.`],
    { [a + b]: 'times-as-add' });
}

function division(d, rand) {
  const a = int(rand, 2, d === 1 ? 5 : d === 2 ? 9 : 12);
  const q = int(rand, 2, d === 1 ? 5 : 12);
  const c = a * q;
  return input(`${c} ÷ ${a} = ?`, q, [`How many ${a}s make ${c}?`, `Think: ${a} × ? = ${c}.`], { [c - a]: 'wrong-operation', [c * a]: 'wrong-operation' });
}

const frac = (n, d) => `${n}/${d}`;

function unitFractions(d, rand) {
  const parts = int(rand, 2, d === 1 ? 4 : d === 2 ? 6 : 8);
  if (d === 3 && rand() < 0.5) {
    const target = pick(rand, [2, 3, 4]);
    const name = { 2: 'one half', 3: 'one third', 4: 'one quarter' }[target];
    const opts = shuffled([
      { id: 'equal', label: `${target} equal parts, 1 shaded`, visual: { kind: 'fraction', parts: target, shaded: 1 } },
      { id: 'unequal', label: `${target} unequal parts, 1 shaded`, visual: { kind: 'fraction', parts: target, shaded: 1, unequal: true }, misconception: 'fraction-count-parts' },
      { id: 'more', label: `${target + 1} equal parts, 1 shaded`, visual: { kind: 'fraction', parts: target + 1, shaded: 1 } },
    ], rand);
    return { prompt: `Which picture shows ${name} shaded?`, options: opts, answer: 'equal',
      hints: ['The parts must be the same size.', `Look for ${target} equal parts with one shaded.`] };
  }
  return choice(rand, {
    prompt: 'What fraction of the bar is shaded?', visual: { kind: 'fraction', parts, shaded: 1 }, answer: frac(1, parts), size: 3,
    wrong: [{ value: frac(1, parts - 1), misconception: 'fraction-count-parts' }, { value: frac(1, parts + 1) }, { value: frac(parts, 1) }],
    hints: ['Count all the equal parts. That is the bottom number.', 'One part is shaded, so the top number is 1.'],
  });
}

function fractionsCompare(d, rand) {
  if (d === 2) {
    const den = pick(rand, [2, 3, 4, 5, 6, 8]);
    const num = int(rand, 1, den - 1);
    return {
      kind: 'numberline', prompt: `Put the marker on ${frac(num, den)}.`, min: 0, max: den, target: num, denominator: den, labelEvery: den,
      wrong: { [num - 1]: 'number-line-ticks', [num + 1]: 'number-line-ticks' },
      hints: [`The line from 0 to 1 is cut into ${den} equal jumps.`, `Count ${num} ${num === 1 ? 'jump' : 'jumps'} from 0.`],
    };
  }
  let a; let b;
  if (d === 1) {
    a = int(rand, 2, 8); b = int(rand, 2, 8);
    while (b === a) b = int(rand, 2, 8);
    const bigger = Math.min(a, b);
    return choice(rand, {
      prompt: `Which is bigger: ${frac(1, a)} or ${frac(1, b)}?`, answer: frac(1, bigger), size: 2,
      wrong: [{ value: frac(1, Math.max(a, b)), misconception: 'fraction-bigger-denominator' }],
      hints: ['Picture the same bar cut into each number of parts.', 'More parts means each part is smaller.'],
    });
  }
  const pairs = [[2, 3, 3, 4], [1, 2, 2, 5], [3, 4, 2, 3], [2, 5, 1, 3], [3, 8, 1, 2], [5, 6, 3, 4], [2, 3, 5, 8]];
  const [n1, d1, n2, d2] = pick(rand, pairs);
  const bigger = n1 / d1 > n2 / d2 ? frac(n1, d1) : frac(n2, d2);
  const smaller = bigger === frac(n1, d1) ? frac(n2, d2) : frac(n1, d1);
  return choice(rand, {
    prompt: `Which is bigger: ${frac(n1, d1)} or ${frac(n2, d2)}?`, answer: bigger, size: 2, wrong: [{ value: smaller }],
    hints: ['Compare each one with a half.', 'Or turn both into fractions with the same bottom number.'],
  });
}

const SHAPE_LIST = ['circle', 'square', 'triangle', 'rectangle'];

function shapes(d, rand) {
  const target = pick(rand, SHAPE_LIST);
  const pool = shuffled(SHAPE_LIST.filter((s) => s !== target), rand).slice(0, d === 1 ? 1 : 3);
  const rotate = d === 3 ? pick(rand, [30, 45, 60, 90, 180]) : 0;
  const options = shuffled([target, ...pool], rand).map((s) => ({
    id: s, label: s, visual: { kind: 'shape', shape: s, ...(s === target && rotate ? { rotate } : {}) },
  }));
  return { prompt: `Which one is the ${target}?`, options, answer: target,
    hints: [`A ${target} ${{ circle: 'is round with no corners', square: 'has four equal sides', triangle: 'has three sides', rectangle: 'has two long sides and two short sides' }[target]}.`,
      'Shapes keep their name when they are turned.'] };
}

function shapeWords(d, rand) {
  const target = pick(rand, SHAPE_LIST);
  return choice(rand, {
    prompt: 'What is this shape called?', visual: { kind: 'shape', shape: target }, answer: target, size: d === 1 ? 2 : 4,
    wrong: shuffled(SHAPE_LIST, rand).map((v) => ({ value: v })),
    hints: ['Count the sides and corners.', 'Say each word aloud and check it against the shape.'],
  });
}

function measure(d, rand) {
  const length = int(rand, 2, d === 1 ? 8 : 12);
  const start = d === 3 ? int(rand, 1, 4) : 0;
  const wrong = [{ value: length + 1, misconception: 'ruler-start' }, { value: length - 1 }];
  if (start) wrong.unshift({ value: start + length, misconception: 'ruler-start' });
  return choice(rand, {
    prompt: start ? 'The pencil does not start at 0. How long is it?' : 'How long is the pencil?',
    visual: { kind: 'ruler', start, length }, answer: length, min: 1, label: (v) => `${v} cm`, wrong,
    hints: start ? [`Count the centimetres from ${start}, not from 0.`, `Take ${start} away from where it ends.`] : ['Read the number at the end of the pencil.', 'Count the spaces between the marks, not the marks.'],
  });
}

// ---------- Reading and words ----------
const LETTER_PAIRS = [['b', 'd'], ['p', 'q'], ['m', 'w'], ['n', 'u']];
const LETTERS = 'abcdefghijklmnoprstuvwyz'.split('');

function letters(d, rand) {
  if (d >= 2) {
    const [x, y] = pick(rand, LETTER_PAIRS);
    const target = rand() < 0.5 ? x : y;
    const other = target === x ? y : x;
    return choice(rand, {
      prompt: `Find the letter ${target}.`, answer: target, size: 3, visualFor: text,
      wrong: [{ value: other, misconception: ['b', 'd', 'p', 'q'].includes(target) ? 'letter-reversal' : undefined }, { value: pick(rand, LETTERS.filter((l) => l !== target && l !== other)) }],
      hints: [{ b: 'b has its tummy on the right.', d: 'd has its tummy on the left.' }[target] || 'Look closely at which way the letter faces.', 'Trace the letter in the air with your finger.'],
    });
  }
  const target = pick(rand, LETTERS);
  return choice(rand, {
    prompt: `Find the letter ${target}.`, answer: target, size: 3, visualFor: text,
    wrong: shuffled(LETTERS, rand).map((value) => ({ value })),
    hints: ['Say the letter name and look at each one.', 'Trace it in the air with your finger.'],
  });
}

const SOUNDS = [
  ['m', 'moon'], ['s', 'sun'], ['t', 'tap'], ['p', 'pig'], ['b', 'bed'], ['d', 'dog'], ['f', 'fish'],
  ['h', 'hat'], ['l', 'leg'], ['n', 'net'], ['r', 'red'], ['c', 'cat'],
];
function letterSounds(d, rand) {
  const [target, word] = pick(rand, SOUNDS);
  const pool = SOUNDS.map(([l]) => l).filter((l) => l !== target);
  const wrong = shuffled(pool, rand).map((value) => ({ value }));
  if (d >= 2 && (target === 'b' || target === 'd')) wrong.unshift({ value: target === 'b' ? 'd' : 'b', misconception: 'letter-reversal' });
  return choice(rand, {
    prompt: `Which letter does “${word}” start with?`, answer: target, size: d === 1 ? 2 : 3, visualFor: text, listen: true,
    wrong, hints: [`Say “${word}” slowly. Listen to the very first sound.`, `“${word}” starts with the same sound as “${target}${target}${target}”.`],
  });
}

const RHYMES = [
  ['cat', ['hat', 'mat', 'bat'], ['cup', 'dog', 'sun']], ['pig', ['wig', 'dig', 'big'], ['pen', 'cat', 'top']],
  ['sun', ['bun', 'run', 'fun'], ['sit', 'bed', 'map']], ['bed', ['red', 'fed', 'shed'], ['bus', 'pin', 'log']],
  ['dog', ['log', 'fog', 'frog'], ['dig', 'cup', 'net']], ['cake', ['lake', 'bake', 'snake'], ['cook', 'kite', 'cup']],
  ['night', ['light', 'kite', 'bite'], ['nose', 'nut', 'boat']], ['tree', ['bee', 'sea', 'key'], ['top', 'train', 'tin']],
];
function rhyme(d, rand) {
  const [word, yes, no] = pick(rand, RHYMES);
  return choice(rand, {
    prompt: `Which word rhymes with “${word}”?`, answer: pick(rand, yes), size: d === 1 ? 2 : 3, listen: true,
    wrong: shuffled(no, rand).map((value) => ({ value })),
    hints: ['Rhyming words sound the same at the end.', `Say each word after “${word}”. Which one ends the same way?`],
  });
}

const WORDS = [
  ['cat', 'dog', 'sun', 'pig', 'hat', 'bed', 'cup', 'map', 'red', 'fox', 'bus', 'pen'],
  ['ship', 'frog', 'fish', 'duck', 'milk', 'tent', 'drum', 'chip', 'crab', 'nest'],
  ['plant', 'train', 'sheep', 'brush', 'stamp', 'cloud', 'crisp', 'shell'],
];
function order(prompt, tokens, accept, rand, hints, misconception, extra = {}) {
  const tiles = tokens.map((label, i) => ({ id: `t${i}`, label }));
  let order = shuffled(tiles, rand);
  if (order.map((t) => t.label).join(' ') === accept[0]) order = [...order.slice(1), order[0]];
  return { kind: 'order', prompt, tiles: order, accept, answer: accept[0], hints, misconception, ...extra };
}
function buildWords(d, rand) {
  const word = pick(rand, WORDS[d - 1]);
  return order(`Build the word “${word}”.`, word.split(''), [word.split('').join(' ')], rand,
    [`Say “${word}” slowly. Which sound comes first?`, `It starts with ${word[0]} and ends with ${word[word.length - 1]}.`],
    'sound-order', { listen: true, say: word, joiner: '' });
}

const SENTENCES = [
  ['The cat sat on the mat.', 'I can see a red bus.', 'We like to play.', 'The dog is big.'],
  ['My friend has a blue kite.', 'The bird sang in the tree.', 'We went to the park today.', 'Sam put the cup on the table.'],
  ['After lunch we read a story together.', 'The little boat sailed across the lake.', 'My grandad grows tomatoes in his garden.'],
];
function buildSentences(d, rand) {
  const sentence = pick(rand, SENTENCES[d - 1]);
  const words = sentence.split(' ');
  return order('Put the words in order to make a sentence.', words, [words.join(' ')], rand,
    ['A sentence starts with a capital letter.', 'It ends with a full stop. Read it aloud to check it makes sense.'], null);
}

const VOCAB = [
  [['big', 'large', ['tiny', 'quick']], ['happy', 'glad', ['sad', 'slow']], ['fast', 'quick', ['slow', 'quiet']], ['hot', 'cold', ['warm', 'wet'], 'opposite'], ['up', 'down', ['over', 'in'], 'opposite']],
  [['ancient', 'very old', ['very new', 'very big']], ['brave', 'fearless', ['scared', 'tired']], ['enormous', 'huge', ['little', 'heavy']], ['generous', 'selfish', ['kind', 'rich'], 'opposite'], ['ancient', 'modern', ['old', 'broken'], 'opposite']],
  [['reluctant', 'unwilling', ['eager', 'unable']], ['fragile', 'easily broken', ['very strong', 'very heavy']], ['vast', 'tiny', ['wide', 'deep'], 'opposite'], ['cautious', 'careful', ['careless', 'clever']], ['scarce', 'plentiful', ['rare', 'small'], 'opposite']],
];
function vocabulary(d, rand) {
  const [word, answer, others, mode] = pick(rand, VOCAB[d - 1]);
  return choice(rand, {
    prompt: mode === 'opposite' ? `Which word means the opposite of “${word}”?` : `Which word means the same as “${word}”?`,
    answer, size: 3, wrong: others.map((value) => ({ value })),
    hints: [`Put each choice into a sentence instead of “${word}”.`, mode === 'opposite' ? 'An opposite means the reverse, not just different.' : 'Words with the same meaning can swap places in a sentence.'],
  });
}

const WORD_PARTS = [
  ['unhappy', 'not happy', ['very happy', 'happy again']], ['redo', 'do again', ['not do', 'do badly']],
  ['helpful', 'full of help', ['without help', 'help again']], ['careless', 'without care', ['full of care', 'care again']],
  ['unlock', 'undo the lock', ['lock again', 'very locked']], ['hopeful', 'full of hope', ['without hope', 'not hoping']],
  ['rebuild', 'build again', ['not build', 'build badly']], ['fearless', 'without fear', ['full of fear', 'fear again']],
];
function wordParts(d, rand) {
  const [word, answer, others] = pick(rand, WORD_PARTS);
  return choice(rand, {
    prompt: `What does “${word}” mean?`, answer, size: 3, wrong: others.map((value) => ({ value })),
    hints: ['Split the word into its root and the extra part.', 'un- means not, re- means again, -ful means full of, -less means without.'],
  });
}

// ---------- Thinking skills ----------
const COLOURS = [['red', '#c8353d'], ['blue', '#2f6fb3'], ['yellow', '#f2c230'], ['green', '#3c9a5f'], ['orange', '#ee8a2b'], ['purple', '#7a4fb3']];
function colours(d, rand) {
  const [name, hex] = pick(rand, COLOURS);
  const others = shuffled(COLOURS.filter(([n]) => n !== name), rand).slice(0, d === 1 ? 1 : 3);
  const options = shuffled([[name, hex], ...others], rand).map(([n, h]) => ({ id: n, label: n, visual: { kind: 'swatch', label: n, hex: h } }));
  return { prompt: `Find ${name}.`, options, answer: name, hints: [`Look for the ${name} one.`, 'Point to each colour and say its name.'] };
}

function sorting(d, rand) {
  const byColour = d !== 2;
  const [c1, c2] = shuffled(COLOURS, rand).slice(0, 2);
  const [s1, s2] = shuffled(SHAPE_LIST, rand).slice(0, 2);
  const items = [];
  const pairs = {};
  const n = d === 1 ? 2 : 4;
  for (let i = 0; i < n; i++) {
    const colour = i % 2 === 0 ? c1 : c2;
    const shape = (byColour ? i < n / 2 : i % 2 === 0) ? s1 : s2;
    const id = `i${i}`;
    items.push({ id, label: `${colour[0]} ${shape}`, visual: { kind: 'swatch', label: colour[0], hex: colour[1] } });
    if (!byColour) items[i].visual = { kind: 'shape', shape };
    pairs[id] = byColour ? (colour === c1 ? 'a' : 'b') : (shape === s1 ? 'a' : 'b');
  }
  const targets = byColour
    ? [{ id: 'a', label: `${c1[0]} things` }, { id: 'b', label: `${c2[0]} things` }]
    : [{ id: 'a', label: `${s1}s`, visual: { kind: 'shape', shape: s1, outline: true } }, { id: 'b', label: `${s2}s`, visual: { kind: 'shape', shape: s2, outline: true } }];
  return { kind: 'drop', prompt: byColour ? 'Sort them by colour.' : 'Sort them by shape.', items, targets, pairs,
    hints: [byColour ? 'Look only at the colour.' : 'Look only at the shape.', 'Put each one in the group that matches it.'] };
}

function observation(d, rand) {
  const shape = pick(rand, SHAPE_LIST);
  const odd = pick(rand, SHAPE_LIST.filter((s) => s !== shape));
  const count = d === 1 ? 3 : 4;
  const oddAt = int(rand, 0, count - 1);
  const options = Array.from({ length: count }, (_, i) => ({
    id: `o${i}`, label: i === oddAt ? odd : shape, visual: { kind: 'shape', shape: i === oddAt ? odd : shape, ...(d === 3 && i !== oddAt ? { rotate: 90 * (i % 2) } : {}) },
  }));
  return { prompt: 'Which one is different?', options, answer: `o${oddAt}`, hints: ['Look at each one in turn.', 'Three are the same shape. Find the one that is not.'] };
}

function patterns(d, rand) {
  const units = d === 1 ? [[0, 1]] : d === 2 ? [[0, 0, 1], [0, 1, 1]] : [[0, 1, 2], [0, 0, 1, 1]];
  const unit = pick(rand, units);
  const palette = shuffled(COLOURS, rand).slice(0, 3);
  const length = Math.min(6, unit.length * 2 + 1);
  const seq = Array.from({ length }, (_, i) => unit[i % unit.length]);
  const blank = length - 1;
  const answerIdx = seq[blank];
  const sw = (i) => ({ kind: 'swatch', label: palette[i][0], hex: palette[i][1] });
  const items = seq.map((v, i) => (i === blank ? null : sw(v)));
  const used = [...new Set(unit)];
  const options = shuffled(used, rand).map((i) => ({ id: palette[i][0], label: palette[i][0], visual: sw(i), ...(i !== answerIdx ? { misconception: 'pattern-unit' } : {}) }));
  return { prompt: 'What comes next?', visual: { kind: 'sequence', items }, options, answer: palette[answerIdx][0],
    hints: ['Say the pattern aloud from the start.', 'Find the part that repeats, then say what comes next.'] };
}

function sequencing(d, rand) {
  const count = d === 1 ? 4 : 5;
  const start = int(rand, 1, d === 1 ? 5 : 20);
  const gap = d === 1 ? 1 : int(rand, 2, 5);
  const nums = Array.from({ length: count }, (_, i) => start + i * gap);
  const desc = d === 3;
  const ordered = desc ? [...nums].reverse() : nums;
  return order(desc ? 'Put the numbers in order, biggest first.' : 'Put the numbers in order, smallest first.',
    nums.map(String), [ordered.join(' ')], rand,
    [desc ? 'Find the biggest number first.' : 'Find the smallest number first.', 'Then find the next one, and keep going.'], null);
}

function memory(d, rand) {
  const pairs = d === 1 ? 2 : d === 2 ? 3 : 4;
  const values = shuffled([1, 2, 3, 4, 5, 6, 7, 8, 9], rand).slice(0, pairs);
  const cards = values.flatMap((v) => [
    { id: `d${v}`, pairId: `p${v}`, label: `${v} dots`, visual: dots(v) },
    { id: `n${v}`, pairId: `p${v}`, label: String(v), visual: text(v) },
  ]);
  return { kind: 'memory', prompt: 'Match each number to its dots.', cards, hints: ['Count the dots, then find that number.', 'Try to remember where each card was.'] };
}

function numberPatterns(d, rand) {
  let seq; let next; let rule;
  if (d === 3 && rand() < 0.5) {
    const s = int(rand, 1, 5);
    seq = [s, s * 2, s * 4, s * 8]; next = s * 16; rule = 'doubles';
  } else {
    const step = d === 1 ? pick(rand, [2, 5, 10]) : int(rand, 3, d === 2 ? 6 : 9) * (d === 3 && rand() < 0.5 ? -1 : 1);
    const start = step < 0 ? int(rand, 60, 99) : int(rand, 1, 30);
    seq = Array.from({ length: 4 }, (_, i) => start + i * step); next = start + 4 * step; rule = step;
  }
  const last = seq[seq.length - 1];
  const wrong = typeof rule === 'number' ? { [last + rule + 1]: 'sequence-rule', [last + rule - 1]: 'sequence-rule' } : { [last + seq[1] - seq[0]]: 'sequence-rule' };
  return input(`What comes next? ${seq.join(', ')}, …`, next,
    ['Work out the jump between each pair of numbers.', typeof rule === 'number' ? 'Is the jump the same every time? Add it once more.' : 'Is it adding the same amount, or doing something else each time?'],
    wrong);
}

// ---------- Registry ----------
export const GENERATORS = {
  'count-to-5': (d, r) => counting('count-to-5', d, r),
  'count-to-10': (d, r) => counting('count-to-10', d, r),
  'number-names': numberNames,
  'subitise': subitise,
  'compare-numbers': compare,
  'number-line-20': numberLine,
  'place-value-100': placeValue100,
  'place-value-1000': placeValue1000,
  'bonds-to-10': bonds,
  'add-within-20': addWithin20,
  'subtract-within-20': subtractWithin20,
  'add-2digit': add2,
  'subtract-2digit': sub2,
  'times-2-5-10': (d, r) => times('times-2-5-10', d, r),
  'times-tables': (d, r) => times('times-tables', d, r),
  'division-facts': division,
  'unit-fractions': unitFractions,
  'fractions-compare': fractionsCompare,
  'shapes': shapes,
  'shape-words': shapeWords,
  'measure-length': measure,
  'letters': letters,
  'letter-sounds': letterSounds,
  'rhyme': rhyme,
  'build-words': buildWords,
  'vocabulary': vocabulary,
  'build-sentences': buildSentences,
  'word-parts': wordParts,
  'colours': colours,
  'sorting': sorting,
  'observation': observation,
  'patterns': patterns,
  'sequencing': sequencing,
  'memory': memory,
  'number-patterns': numberPatterns,
};

export function generateStep(objective, difficulty, rand) {
  const gen = GENERATORS[objective];
  if (!gen) throw new Error(`no generator for ${objective}`);
  const d = Math.min(3, Math.max(1, Math.round(difficulty)));
  return { ...gen(d, rand), difficulty: d };
}

const INSTRUCTIONS = {
  maths: 'Take your time. Hints are there if you need them.',
  literacy: 'Say the words aloud if it helps.',
  thinking: 'Look carefully before you choose.',
};

// A practice set for one objective. `difficulties` may vary per item, so a set can
// start easier and build up. `seed` makes the set repeatable.
export function practiceActivity(objective, difficulty, seed, count = 5, purpose = 'practice') {
  const o = OBJECTIVES[objective];
  if (!o) throw new Error(`unknown objective ${objective}`);
  const rand = mulberry32(seed);
  const levels = Array.isArray(difficulty) ? difficulty : Array.from({ length: count }, () => difficulty);
  const steps = [];
  const prompts = new Set();
  for (const d of levels) {
    let step = generateStep(objective, d, rand);
    for (let tries = 0; tries < 6 && prompts.has(signature(step)); tries++) step = generateStep(objective, d, rand);
    prompts.add(signature(step));
    steps.push(step);
  }
  const level = Math.round(levels.reduce((s, x) => s + x, 0) / levels.length);
  return {
    id: `${purpose === 'review' ? 'rv' : 'pr'}-${objective}`,
    title: o.label, domain: o.domain, band: o.bands[0], level: Math.min(3, Math.max(1, level)), skill: objective,
    instruction: INSTRUCTIONS[o.subject], steps, generated: true, purpose, seed,
  };
}

function signature(step) {
  return JSON.stringify([step.prompt, step.visual, step.options?.map((x) => x.id), step.target, step.answer]);
}
