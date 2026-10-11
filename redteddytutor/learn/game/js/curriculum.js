// Bakery curriculum: learning objectives, round generators and answer checking.
// Pure logic (no DOM, no Phaser) so every answer rule is unit tested.
//
// A round: { skill, tier, kind, prompt, hints[2], answer, options[], data }
//   kind 'count'   data.count            answer: number as string
//   kind 'compare' data.left, data.right answer: 'left' | 'right'
//   kind 'shape'   data.shape            answer: shape id (drag to matching hole)
//   kind 'pattern' data.seq, data.gap    answer: item id for the gap
import { mulberry32 } from './rng.js';

export const PASS_MARK = 3; // first-try correct answers needed out of ROUNDS_PER_LEVEL
export const ROUNDS_PER_LEVEL = 5;
export const BOSS_ROUNDS = 6;

export const LEVELS = [
  {
    id: 'bakery-counting', order: 1, title: 'Counting Cakes', skill: 'count-to-10', kind: 'count',
    objective: 'Count the cakes and choose the matching number.',
    intro: 'Customers are waiting! Count each cake on the tray.',
  },
  {
    id: 'bakery-numbers', order: 2, title: 'The Number Shop', skill: 'number-names', kind: 'compare',
    objective: 'Find which tray has more.',
    intro: 'Two trays of cakes. Which tray has more?',
  },
  {
    id: 'bakery-shapes', order: 3, title: 'Shape Delivery', skill: 'shapes', kind: 'shape',
    objective: 'Match each shape cake to its matching hole.',
    intro: 'The van needs cakes delivered to the right shaped holes.',
  },
  {
    id: 'bakery-patterns', order: 4, title: 'Pattern Oven', skill: 'patterns', kind: 'pattern',
    objective: 'Find the piece that comes next in the pattern.',
    intro: 'The oven makes patterns. Which piece fills the gap?',
  },
];

export const BOSS = { id: 'bakery-grand-opening', title: 'Grand Opening', order: 5 };

export const SHAPE_IDS = ['circle', 'square', 'triangle', 'rectangle'];
const PATTERN_ITEMS = ['red', 'blue', 'yellow'];

const SHAPE_HINTS = [
  'Look at the corners. Round shapes have none.',
  'Match the outline exactly, edge by edge.',
];
const COUNT_HINTS = [
  'Touch each cake once as you count: 1, 2, 3...',
  'Count from one. The last number you say is how many cakes there are.',
];
const COMPARE_HINTS = [
  'Count each tray. Which one has the bigger number?',
  'Look for the tray with more cakes on it.',
];
const PATTERN_HINTS = [
  'Look for the two pieces that take turns.',
  'Look at the piece just before the gap, then what came after it last time.',
];

const pick = (rng, list) => list[Math.floor(rng() * list.length)];
const shuffle = (rng, list) => {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const range = (rng, lo, hi) => lo + Math.floor(rng() * (hi - lo + 1));

// Makes one round of `kind` at difficulty tier 1 (easiest) to 3.
export function makeRound(kind, tier, rng = Math.random) {
  if (kind === 'count') return makeCount(tier, rng);
  if (kind === 'compare') return makeCompare(tier, rng);
  if (kind === 'shape') return makeShape(tier, rng);
  if (kind === 'pattern') return makePattern(tier, rng);
  throw new Error(`unknown round kind ${kind}`);
}

function makeCount(tier, rng) {
  const [lo, hi] = tier === 1 ? [1, 3] : tier === 2 ? [3, 6] : [5, 9];
  const count = range(rng, lo, hi);
  const distractors = new Set();
  while (distractors.size < (tier === 1 ? 1 : 2)) {
    const d = count + pick(rng, [-2, -1, 1, 2]);
    if (d >= 1 && d !== count) distractors.add(d);
  }
  const options = shuffle(rng, [count, ...distractors]).map(String);
  return {
    skill: 'count-to-10', tier, kind: 'count', prompt: 'How many cakes are on the tray?',
    data: { count }, answer: String(count), options, hints: COUNT_HINTS,
  };
}

function makeCompare(tier, rng) {
  const max = tier === 1 ? 5 : tier === 2 ? 9 : 10;
  let left = range(rng, 1, max);
  let right = range(rng, 1, max);
  while (right === left) right = range(rng, 1, max);
  const answer = left > right ? 'left' : 'right';
  return {
    skill: 'number-names', tier, kind: 'compare', prompt: 'Which tray has MORE cakes?',
    data: { left, right }, answer, options: ['left', 'right'], hints: COMPARE_HINTS,
  };
}

function makeShape(tier, rng) {
  const pool = tier === 1 ? ['circle', 'square', 'triangle'] : SHAPE_IDS;
  const shape = pick(rng, pool);
  return {
    skill: 'shapes', tier, kind: 'shape', prompt: `Deliver the ${shape} cake to the ${shape} hole.`,
    data: { shape, holes: pool }, answer: shape, options: pool, hints: SHAPE_HINTS,
  };
}

function makePattern(tier, rng) {
  // ABAB for tier 1-2 (two items), ABCABC for tier 3 (three items).
  const items = tier === 3 ? PATTERN_ITEMS : shuffle(rng, PATTERN_ITEMS).slice(0, 2);
  const cycle = items.length;
  const length = tier === 3 ? 6 : 4;
  const seq = Array.from({ length }, (_, i) => items[i % cycle]);
  const gap = length - 1 - (tier === 1 ? 0 : range(rng, 0, 1));
  const answer = seq[gap];
  const options = tier === 1 ? items : PATTERN_ITEMS;
  return {
    skill: 'patterns', tier, kind: 'pattern', prompt: 'What piece fills the gap?',
    data: { seq, gap }, answer, options: shuffle(rng, options), hints: PATTERN_HINTS,
  };
}

// Builds the round list for one attempt at a level. `tierFn(index)` gives the
// adaptive difficulty for each round.
export function buildLevelRounds(level, tierFn, seed = Date.now()) {
  const rng = mulberry32(seed);
  return Array.from({ length: ROUNDS_PER_LEVEL }, (_, i) => makeRound(level.kind, tierFn(i), rng));
}

// Boss rounds mix every skill so the child practises switching between ideas.
export function buildBossRounds(tierFor, seed = Date.now()) {
  const rng = mulberry32(seed);
  const kinds = ['count', 'compare', 'shape', 'pattern'];
  return Array.from({ length: BOSS_ROUNDS }, (_, i) => {
    const kind = kinds[i % kinds.length];
    const skill = LEVELS.find((l) => l.kind === kind).skill;
    return makeRound(kind, tierFor(skill), rng);
  });
}

// Pure answer check. Returns true when the child's choice matches the answer.
export function checkAnswer(round, choice) {
  if (round.options && !round.options.includes(String(choice))) return false;
  return String(choice) === String(round.answer);
}

export function levelById(id) {
  return LEVELS.find((l) => l.id === id) || (id === BOSS.id ? BOSS : null);
}
