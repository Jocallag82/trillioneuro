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
import { int, pick, shuffled, choice, input, dots, text, order } from './kit.js';
import { SECONDARY_MATH } from './gen-secondary-math.js';
import { SUBJECT_GENERATORS } from './gen-subjects.js';
import { EXPANSION_GENERATORS } from './gen-expansion.js';
import { CORE_MATH_GENERATORS } from './gen-core-math.js';
import { CORE_SUBJECT_GENERATORS } from './gen-core-subjects.js';
import { CORE_HS_GENERATORS } from './gen-core-hs.js';

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

// ---------- Older learners (7 to 11) ----------

// Telling the time. The clock is drawn from { h, m }; options are digital times.
const fmtTime = (h, m) => `${h}:${String(m).padStart(2, '0')}`;
const nextHour = (h) => (h % 12) + 1;
function tellTime(d, rand) {
  const h = int(rand, 1, 12);
  const m = d === 1 ? pick(rand, [0, 30]) : d === 2 ? pick(rand, [0, 15, 30, 45]) : 5 * int(rand, 1, 11);
  const answer = fmtTime(h, m);
  const wrong = [];
  const swapH = m === 0 ? 12 : m / 5;
  const swapM = (h * 5) % 60;
  wrong.push({ value: fmtTime(swapH, swapM), misconception: 'clock-hands-swap' });
  if (m >= 30) wrong.push({ value: fmtTime(nextHour(h), m), misconception: 'clock-hour-next' });
  wrong.push({ value: fmtTime(h, (m + 30) % 60) });
  wrong.push({ value: fmtTime(nextHour(h), (m + 15) % 60) });
  wrong.push({ value: fmtTime(h === 1 ? 12 : h - 1, m) });
  return choice(rand, {
    prompt: 'What time does the clock show?', visual: { kind: 'clock', h, m }, answer, wrong, size: 4,
    hints: ['Find the short hand first. It shows the hour it has just passed.', m ? 'Now the long hand: count in 5s from the 12 to where it points.' : 'The long hand is on 12, so it is exactly on the hour.'],
  });
}

// Bar charts with a scale. Values sit on or halfway between grid lines.
const CHARTS = [
  ['Favourite fruit', ['Apples', 'Bananas', 'Grapes', 'Pears']],
  ['Pets in our class', ['Dogs', 'Cats', 'Fish', 'Rabbits']],
  ['How we get to school', ['Walk', 'Car', 'Bus', 'Bike']],
  ['Books read this week', ['Mon', 'Tue', 'Wed', 'Thu', 'Fri']],
  ['Birds in the garden', ['Robins', 'Sparrows', 'Blackbirds', 'Finches']],
];
function barCharts(d, rand) {
  const [title, labels] = pick(rand, CHARTS);
  const step = d === 1 ? 1 : d === 2 ? pick(rand, [2, 5]) : pick(rand, [2, 5, 10]);
  const top = step * 10;
  const values = [];
  while (values.length < labels.length) {
    const v = step === 1 ? int(rand, 1, 10) : step * int(rand, 1, 9) + (rand() < 0.4 ? step / 2 : 0);
    if (!values.includes(v) && Number.isInteger(v)) values.push(v);
  }
  const chart = { kind: 'bars', title, step, max: top, items: labels.map((label, i) => ({ label, value: values[i] })) };
  const i = int(rand, 0, labels.length - 1);
  let j = int(rand, 0, labels.length - 1);
  while (j === i) j = int(rand, 0, labels.length - 1);
  if (d === 1 && rand() < 0.5) {
    const most = values.indexOf(Math.max(...values));
    return {
      prompt: `${title}: which has the most?`, visual: chart, answer: labels[most],
      options: shuffled([labels[most], ...shuffled(labels.filter((l) => l !== labels[most]), rand).slice(0, 3)], rand).map((l) => ({ id: l, label: l })),
      hints: ['Find the tallest bar.', 'Follow the top of each bar across to the numbers.'],
    };
  }
  if (d === 3) {
    const [a, b] = values[i] >= values[j] ? [i, j] : [j, i];
    if (values[a] === values[b]) return barCharts(2, rand);
    return input(`How many more ${labels[a]} than ${labels[b]}?`, values[a] - values[b],
      [`Read the ${labels[a]} bar, then the ${labels[b]} bar.`, 'How many more means find the difference: take the smaller from the bigger.'],
      { [values[a] + values[b]]: 'wrong-operation' }, chart);
  }
  const v = values[i];
  return input(`${title}: how many for ${labels[i]}?`, v,
    [`Each line on the side goes up in ${step}${step === 1 ? '' : 's'}.`, step > 1 ? `If the bar stops between two lines, it is halfway: add ${step / 2}.` : 'Follow the top of the bar across to the numbers.'],
    {}, chart);
}

// Story problems. Names are varied; nothing refers to gender.
const NAMES = ['Ava', 'Sam', 'Noah', 'Mia', 'Leo', 'Zara', 'Ravi', 'Aoife', 'Kofi', 'Lena', 'Tom', 'Priya'];
function wordProblems(d, rand) {
  const n = pick(rand, NAMES);
  if (d === 1) {
    if (rand() < 0.5) {
      const a = int(rand, 18, 64); const b = int(rand, 11, 35);
      return input(`${n} had ${a} stickers and was given ${b} more. How many stickers does ${n} have now?`, a + b,
        ['Is the number of stickers getting bigger or smaller?', 'Given more means add.'], { [a - b]: 'wrong-operation' });
    }
    const a = int(rand, 40, 95); const b = int(rand, 12, a - 10);
    return input(`A box held ${a} apples. ${b} apples were eaten. How many apples are left?`, a - b,
      ['Are there more apples or fewer at the end?', 'Eaten means take away.'], { [a + b]: 'wrong-operation' });
  }
  if (d === 2) {
    const a = int(rand, 20, 60); const b = int(rand, 10, 30); const c = int(rand, 5, a + b - 5);
    return input(`${n} had ${a} marbles, won ${b} more, then gave ${c} to a friend. How many marbles does ${n} have now?`, a + b - c,
      ['There are two things that happen. Do the first one, then the second.', `First add the ${b} won. Then take away the ${c} given.`],
      { [a + b]: 'one-step-only', [a + b + c]: 'wrong-operation' });
  }
  if (rand() < 0.5) {
    const p = int(rand, 4, 12); const k = int(rand, 3, 9); const g = int(rand, 5, p * k - 2);
    return input(`Pencils come in packs of ${p}. A teacher buys ${k} packs and gives out ${g} pencils. How many pencils are left?`, p * k - g,
      ['Step 1: how many pencils are there in all the packs?', `Step 2: take away the ${g} given out.`],
      { [p * k]: 'one-step-only', [p + k - g]: 'times-as-add' });
  }
  const r = int(rand, 3, 9); const rows = int(rand, 3, 9); const x = int(rand, 2, 6);
  const t = r * rows;
  return input(`${t} chairs are put in rows of ${r}. Then ${x} more rows are added. How many rows are there now?`, rows + x,
    [`Step 1: how many rows of ${r} make ${t}?`, `Step 2: add the ${x} new rows.`],
    { [rows]: 'one-step-only', [t - r + x]: 'wrong-operation' });
}

// Area and perimeter of a rectangle on squared paper.
function areaPerimeter(d, rand) {
  const w = int(rand, 2, d === 1 ? 5 : 9);
  let h = int(rand, 2, d === 1 ? 4 : 8);
  if (h === w) h = w === 2 ? 3 : w - 1;
  const area = w * h;
  const per = 2 * (w + h);
  if (d === 1) {
    return input('Each square is 1 square centimetre. What is the area of the shaded rectangle, in square centimetres?', area,
      ['Area is how many squares are inside.', `Count one row, then count the rows. ${w} in each row.`],
      { [per]: 'area-perimeter-mix' }, { kind: 'grid', w, h, labels: false });
  }
  if (d === 2) {
    return input(`The rectangle is ${w} cm long and ${h} cm wide. What is its area, in square centimetres?`, area,
      ['Area of a rectangle: length times width.', `Think: ${h} rows of ${w}.`],
      { [per]: 'area-perimeter-mix', [w + h]: 'times-as-add' }, { kind: 'grid', w, h, labels: true });
  }
  return input(`The rectangle is ${w} cm long and ${h} cm wide. What is its perimeter, in centimetres?`, per,
    ['Perimeter is the distance all the way round.', `There are two sides of ${w} cm and two sides of ${h} cm.`],
    { [area]: 'area-perimeter-mix', [w + h]: 'perimeter-two-sides' }, { kind: 'grid', w, h, labels: true });
}

// Decimals. Strings are compared by value, never by length.
const dec = (n, places) => (n / 10 ** places).toFixed(places);
function decimals(d, rand) {
  if (d === 1) {
    const t = int(rand, 2, 9);
    const trap = rand() < 0.65; // the longer number is the smaller one
    const a = dec(t, 1);
    const b = trap ? dec((t - 1) * 10 + int(rand, 1, 9), 2) : dec(t * 10 + int(rand, 1, 9), 2);
    const bigger = Number(a) > Number(b) ? a : b;
    const smaller = bigger === a ? b : a;
    return choice(rand, {
      prompt: `Which is bigger: ${a} or ${b}?`, answer: bigger, size: 2,
      wrong: [{ value: smaller, misconception: trap ? 'decimal-longer-bigger' : undefined }],
      hints: ['Compare the tenths first: the first digit after the point.', 'If the tenths are the same, then compare the hundredths.'],
    });
  }
  if (d === 2) {
    const hund = rand() < 0.5;
    const n = hund ? int(rand, 11, 99) : int(rand, 1, 9);
    const den = hund ? 100 : 10;
    const answer = hund ? dec(n, 2) : dec(n, 1);
    const wrong = [{ value: `${n}.${den}`, misconception: 'decimal-fraction-digits' }];
    wrong.push({ value: hund ? dec(n, 1) : dec(n, 2) });
    wrong.push({ value: hund ? dec(n, 3) : `${n}.0` });
    return choice(rand, {
      prompt: `Which decimal is the same as ${n}/${den}?`, answer, size: 3, wrong,
      hints: [hund ? 'Hundredths fill two places after the point.' : 'Tenths go in the first place after the point.', `${n}/${den} means ${n} ${hund ? 'hundredths' : 'tenths'}.`],
    });
  }
  const vals = new Set();
  const out = [];
  while (out.length < 4) {
    const places = pick(rand, [1, 2, 2]);
    const v = places === 1 ? dec(int(rand, 1, 9), 1) : dec(int(rand, 1, 99), 2);
    if (v.endsWith('0') && places === 2) continue;
    if (vals.has(Number(v))) continue;
    vals.add(Number(v)); out.push(v);
  }
  const ordered = [...out].sort((x, y) => Number(x) - Number(y));
  return order('Put the decimals in order, smallest first.', out, [ordered.join(' ')], rand,
    ['Line them up by the point and compare the tenths first.', 'A number with more digits is not always bigger: 0.4 is more than 0.35.'], null);
}

// Spelling in context: one correct spelling among common misspellings.
const SPELLINGS = [
  [['The puppy hid ___ it was scared.', 'because', ['becuase', 'becos', 'beacause']],
    ['My best ___ lives next door.', 'friend', ['freind', 'frend', 'friennd']],
    ['Lots of ___ came to the fair.', 'people', ['peeple', 'poeple', 'pepole']],
    ['Can we play that game ___?', 'again', ['agian', 'agen', 'agane']],
    ['I ___ like a glass of water.', 'would', ['wood', 'wuold', 'whould']],
    ['She ___ hello to the new teacher.', 'said', ['sed', 'siad', 'sayed']]],
  [['We ___ the bus by one minute.', 'caught', ['cort', 'cawt', 'caugt']],
    ['I ___ you can do it.', 'believe', ['beleive', 'belive', 'beleave']],
    ['Our class went on a trip to the ___.', 'library', ['libary', 'liberry', 'librery']],
    ['We had a ___ party for Grandad.', 'surprise', ['suprise', 'surprize', 'serprise']],
    ['Please write your answer in the ___ box.', 'separate', ['seperate', 'separete', 'seprate']],
    ['My birthday is in ___.', 'February', ['Febuary', 'Februray', 'Febrary']]],
  [['I will ___ remember to bring my coat.', 'definitely', ['definately', 'definitly', 'defanitely']],
    ['Plants need a healthy ___ to grow.', 'environment', ['enviroment', 'envirnment', 'environmant']],
    ['It is ___ to wear a helmet on a bike.', 'necessary', ['neccessary', 'necesary', 'nessecary']],
    ['The music had a strong ___.', 'rhythm', ['rythm', 'rhythem', 'rhytm']],
    ['Our school has a new ___ room.', 'committee', ['commitee', 'comittee', 'comitee']],
    ['Watch the rabbit ___ into the hat.', 'disappear', ['dissapear', 'disapear', 'disappeer']]],
];
function spelling(d, rand) {
  const [sentence, answer, others] = pick(rand, SPELLINGS[d - 1]);
  return choice(rand, {
    prompt: `Which spelling is correct? “${sentence}”`, answer, size: d === 1 ? 3 : 4, wrong: others.map((value) => ({ value })),
    hints: ['Say each one slowly in your head. Which looks right?', 'Look at the tricky part of the word: the part you cannot hear clearly.'],
  });
}

// Reading comprehension: original short texts. Retrieval (1), inference (2), word choice (3).
const PASSAGES = [
  {
    title: 'The Night Garden',
    text: 'Every evening, Mo crept out to the bottom of the garden with a torch and a notebook. For two weeks nothing came. Then, on a still night in June, a hedgehog shuffled out from under the shed, sniffed the air and began to eat the slugs by the lettuces. Mo wrote down the time, 9:42, and did not move a muscle until it had gone.',
    q: [
      ['What did Mo take into the garden?', 'A torch and a notebook', ['A torch and a camera', 'A blanket and a book', 'Some food for the hedgehog'], 'Look at the first sentence.'],
      ['Why did Mo not move a muscle?', 'So the hedgehog would not be scared away', ['Because Mo was asleep', 'Because Mo was cold', 'Because the torch had gone out'], 'Think about what might happen if Mo moved.'],
      ['The hedgehog “shuffled” out. What does this tell you about how it moved?', 'Slowly, with small steps', ['Very quickly', 'By jumping', 'By flying'], 'Try acting out the word shuffled.'],
    ],
  },
  {
    title: 'Bridge Builders',
    text: 'The class had one job: build a bridge from paper and tape that could hold a tin of beans. Priya’s team rolled the paper into tight tubes. Leo’s team folded it flat, like a fan. When the tin went on, the flat bridge sagged and slid to the floor. The tube bridge creaked, but it held. Leo grinned anyway and said, “Next time, tubes.”',
    q: [
      ['What did Priya’s team do with the paper?', 'Rolled it into tight tubes', ['Folded it like a fan', 'Cut it into strips', 'Screwed it into a ball'], 'Find Priya’s name in the text.'],
      ['How do you think Leo felt at the end?', 'Cheerful, and ready to learn from it', ['Angry with Priya', 'Upset and wanting to give up', 'Bored of the task'], 'Look at what Leo did and said at the end.'],
      ['The bridge “sagged”. Which word is closest in meaning?', 'Drooped', ['Snapped', 'Grew', 'Shone'], 'Picture a bridge that sags in the middle.'],
    ],
  },
  {
    title: 'Why Leaves Change in Autumn',
    text: 'In summer, leaves are full of a green substance called chlorophyll, which helps the tree make food from sunlight. As autumn days get shorter, the tree stops making chlorophyll. The green fades, and yellow and orange colours that were hidden underneath can be seen at last. Some trees also make new red colours in autumn. Soon the leaves fall, and the tree rests until spring.',
    q: [
      ['What does chlorophyll help the tree do?', 'Make food from sunlight', ['Drop its leaves', 'Turn red', 'Grow taller in winter'], 'Find the sentence with the word chlorophyll.'],
      ['Why can we see yellow and orange in autumn?', 'The green fades and the colours underneath show', ['The tree paints the leaves', 'The rain washes the green off', 'Sunlight turns them orange'], 'Look at what happens to the green.'],
      ['What is the main purpose of this text?', 'To explain why leaves change colour', ['To tell a story about a tree', 'To persuade you to plant trees', 'To give instructions for collecting leaves'], 'Look at the title and what each sentence does.'],
    ],
  },
  {
    title: 'The Lost Library Book',
    text: 'Kofi searched his bag, under his bed and behind the sofa, but the library book had vanished. It was due back on Friday. On Thursday night his little sister wandered in holding something behind her back. “I was reading it to my bear,” she whispered. Kofi laughed so much he forgot to be cross.',
    q: [
      ['When was the book due back?', 'Friday', ['Thursday', 'Monday', 'Saturday'], 'Look for a day of the week.'],
      ['Why was his sister holding something behind her back?', 'She had the book and felt a bit guilty', ['She had a present for Kofi', 'She was hiding her bear', 'She was playing a game of tag'], 'What was missing in the story?'],
      ['The book had “vanished”. What does vanished mean here?', 'Disappeared', ['Been torn', 'Been read', 'Been returned'], 'What had Kofi been doing to find it?'],
    ],
  },
  {
    title: 'How to Grow Cress',
    text: 'You will need: an empty eggshell, cotton wool, water and cress seeds. First, wet the cotton wool and push it gently into the eggshell. Next, sprinkle a pinch of seeds over the top. Put the shell on a sunny windowsill and keep the cotton wool damp. In about a week, you will have tiny green shoots to snip and eat.',
    q: [
      ['Where should you put the eggshell?', 'On a sunny windowsill', ['In a dark cupboard', 'In the fridge', 'Outside in the rain'], 'Find the sentence that starts with “Put”.'],
      ['Why must the cotton wool be kept damp?', 'The seeds need water to grow', ['So the shell does not break', 'To keep the cress cold', 'So birds do not eat it'], 'Think about what plants need.'],
      ['What type of text is this?', 'Instructions', ['A poem', 'A letter', 'A story'], 'Look at the words First and Next, and the list at the start.'],
    ],
  },
  {
    title: 'The Lighthouse Keeper',
    text: 'For forty years, Nan climbed the hundred and twelve steps of the lighthouse every evening to light the great lamp. Ships far out at sea saw its beam and steered away from the rocks. Now the lamp switches on by itself. Nan still lives in the cottage below, and some nights, out of habit, she glances up at the tower to check it is shining.',
    q: [
      ['How many steps did Nan climb?', 'One hundred and twelve', ['Forty', 'One hundred', 'Twelve'], 'Look for a number that goes with steps.'],
      ['Why did ships need the lighthouse?', 'To help them stay away from the rocks', ['To find the cottage', 'To see Nan', 'To know what time it was'], 'What did ships do when they saw the beam?'],
      ['Nan glances up “out of habit”. What does this tell us?', 'She did it for so long that she still does it without thinking', ['She is worried the lamp is broken', 'She wants to climb it again', 'She has never seen it before'], 'Think about how long Nan did the job.'],
    ],
  },
];
function comprehension(d, rand) {
  const p = pick(rand, PASSAGES);
  const [q, answer, wrong, hint] = p.q[d - 1];
  return choice(rand, {
    prompt: q, visual: { kind: 'passage', title: p.title, text: p.text }, answer, size: 4,
    wrong: wrong.map((value) => ({ value })),
    hints: [hint, d === 1 ? 'The answer is written in the text. Find the exact words.' : 'The text does not say it straight out. Use clues in the words.'],
  });
}

// Logic: put people in order from clues, then answer one question about the order.
const TRAITS = [
  ['taller', 'tallest', 'shortest'], ['older', 'oldest', 'youngest'], ['faster', 'fastest', 'slowest'],
];
const OPPOSITE = { taller: 'shorter', older: 'younger', faster: 'slower' };
function logicPuzzles(d, rand) {
  const count = d === 3 ? 4 : 3;
  const people = shuffled(NAMES, rand).slice(0, count); // people[0] is the most
  const [more, most, least] = pick(rand, TRAITS);
  const clues = [];
  for (let i = 0; i < count - 1; i++) {
    const flip = d >= 2 && rand() < 0.5;
    clues.push(flip ? `${people[i + 1]} is ${OPPOSITE[more]} than ${people[i]}.` : `${people[i]} is ${more} than ${people[i + 1]}.`);
  }
  const shown = shuffled(clues, rand);
  let question; let answer;
  if (d === 1) { question = `Who is the ${most}?`; answer = people[0]; }
  else if (d === 2) { const low = rand() < 0.5; question = low ? `Who is the ${least}?` : `Who is in the middle?`; answer = low ? people[count - 1] : people[1]; }
  else { question = `Who is the second ${most}?`; answer = people[1]; }
  return {
    prompt: question, visual: { kind: 'passage', title: 'The clues', text: shown.join('\n') }, answer,
    options: shuffled(people, rand).map((p) => ({ id: p, label: p })),
    hints: ['Write the names in a line, using one clue at a time.', `Check your line against every clue. Is anyone ${more} than your answer?`],
  };
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
  'logic-puzzles': logicPuzzles,
  'tell-time': tellTime,
  'bar-charts': barCharts,
  'word-problems': wordProblems,
  'area-perimeter': areaPerimeter,
  'decimals': decimals,
  'spelling': spelling,
  'comprehension': comprehension,
  ...SECONDARY_MATH,
  ...SUBJECT_GENERATORS,
  ...EXPANSION_GENERATORS,
  ...CORE_MATH_GENERATORS,
  ...CORE_SUBJECT_GENERATORS,
  ...CORE_HS_GENERATORS,
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
  science: 'Think about what you know, then check each choice against it.',
  social: 'Read each choice carefully. Hints are there if you need them.',
  computing: 'Trace the program one line at a time and keep track of each variable.',
  enrichment: 'Read each choice carefully. Hints are there if you need them.',
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
