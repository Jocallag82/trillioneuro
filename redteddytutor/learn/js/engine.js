// Pure activity logic: validation, answer checking, hints and retries.
// No DOM or storage access, so it runs in the browser and under node:test alike.
// Step kinds: 'choice' (default; tap one option), 'drop' (place each item on its target),
// 'memory' (turn cards over to find pairs), and four answered with `respond`:
// 'input' (type a number), 'numberline' (place a marker), 'order' (arrange tiles)
// and 'build' (fill a ten frame).
//
// Every finished step records what was observed: right first time or not, how many
// misses, the item's difficulty, and a mistake code only when the chosen wrong answer
// was built from that mistake. Nothing here infers more than the answer shows.
import { BANDS, DOMAINS, SKILLS } from './content.js';
import { isMisconception } from './curriculum/misconceptions.js';

const VISUAL_KINDS = ['dots', 'shape', 'swatch', 'text', 'sequence', 'tenframe', 'blocks', 'groups', 'fraction', 'ruler', 'clock', 'bars', 'grid', 'passage'];
const RESPOND_KINDS = ['input', 'numberline', 'order', 'build'];
const isInt = (n, lo, hi) => Number.isInteger(n) && n >= lo && n <= hi;
const SHAPES = ['circle', 'square', 'triangle', 'rectangle'];

export const MAX_MISSES = 3; // the third miss on a choice reveals the answer, gently

export function stepsOf(activity) {
  return activity.steps;
}

function validVisual(v, allowSequence = true) {
  if (!v || !VISUAL_KINDS.includes(v.kind)) return false;
  if (v.kind === 'dots') return Number.isInteger(v.count) && v.count >= 1 && v.count <= 10;
  if (v.kind === 'shape') {
    return SHAPES.includes(v.shape) && (v.outline === undefined || typeof v.outline === 'boolean')
      && (v.rotate === undefined || isInt(v.rotate, 0, 359));
  }
  if (v.kind === 'tenframe') return isInt(v.filled, 0, 10);
  if (v.kind === 'blocks') return isInt(v.tens, 0, 9) && isInt(v.ones, 0, 19);
  if (v.kind === 'groups') return isInt(v.groups, 1, 12) && isInt(v.each, 1, 12);
  if (v.kind === 'fraction') return isInt(v.parts, 2, 12) && isInt(v.shaded, 0, v.parts) && (v.unequal === undefined || typeof v.unequal === 'boolean');
  if (v.kind === 'ruler') return isInt(v.start, 0, 10) && isInt(v.length, 1, 15) && v.start + v.length <= 20;
  if (v.kind === 'swatch') return typeof v.label === 'string' && /^#[0-9a-f]{6}$/i.test(v.hex);
  if (v.kind === 'text') return typeof v.text === 'string' && v.text.length > 0 && v.text.length <= 6;
  if (v.kind === 'clock') return isInt(v.h, 1, 12) && isInt(v.m, 0, 59);
  if (v.kind === 'grid') return isInt(v.w, 1, 12) && isInt(v.h, 1, 12) && typeof v.labels === 'boolean';
  if (v.kind === 'passage') return typeof v.title === 'string' && v.title.length <= 60 && typeof v.text === 'string' && v.text.length >= 40 && v.text.length <= 900;
  if (v.kind === 'bars') {
    return typeof v.title === 'string' && [1, 2, 5, 10].includes(v.step) && isInt(v.max, v.step, 100) && v.max % v.step === 0
      && Array.isArray(v.items) && v.items.length >= 2 && v.items.length <= 6
      && v.items.every((b) => typeof b.label === 'string' && b.label.length <= 14 && isInt(b.value, 0, v.max));
  }
  if (v.kind === 'sequence') {
    return allowSequence && Array.isArray(v.items) && v.items.length >= 2 && v.items.length <= 6
      && v.items.every((item) => item === null || validVisual(item, false))
      && v.items.filter((item) => item === null).length === 1;
  }
  return false;
}

const isLabelled = (x) => typeof x.label === 'string' && x.label.trim().length > 0;
const tagOk = (code) => code === undefined || code === null || isMisconception(code);
const hintsOk = (h) => Array.isArray(h) && h.length >= 1 && h.length <= 2 && h.every((x) => typeof x === 'string' && x.trim());

function validateDrop(s, at, bad) {
  if (!Array.isArray(s.items) || s.items.length < 2 || s.items.length > 4) bad(`${at} needs 2 to 4 items`);
  if (!Array.isArray(s.targets) || s.targets.length < 2 || s.targets.length > 4) bad(`${at} needs 2 to 4 targets`);
  if (!Array.isArray(s.items) || !Array.isArray(s.targets)) return;
  const itemIds = s.items.map((i) => i.id);
  const targetIds = s.targets.map((t) => t.id);
  if (new Set(itemIds).size !== itemIds.length || new Set(targetIds).size !== targetIds.length) bad(`${at} has duplicate ids`);
  s.items.forEach((i) => {
    if (!isLabelled(i)) bad(`${at} item "${i.id}" has no label`);
    if (i.visual !== undefined && !validVisual(i.visual, false)) bad(`${at} item "${i.id}" has an invalid visual`);
  });
  s.targets.forEach((t) => {
    if (!isLabelled(t)) bad(`${at} target "${t.id}" has no label`);
    if (t.visual !== undefined && !validVisual(t.visual, false)) bad(`${at} target "${t.id}" has an invalid visual`);
  });
  const pairKeys = Object.keys(s.pairs || {});
  if (pairKeys.length !== itemIds.length || !itemIds.every((id) => pairKeys.includes(id))) {
    bad(`${at} every item needs exactly one correct target`);
  } else if (!pairKeys.every((k) => targetIds.includes(s.pairs[k]))) {
    bad(`${at} pairs point at an unknown target`);
  }
  if (!hintsOk(s.hints)) bad(`${at} needs one or two non-empty hints`);
}

function validateMemory(s, at, bad) {
  if (!Array.isArray(s.cards) || s.cards.length < 4 || s.cards.length > 8 || s.cards.length % 2 !== 0) {
    bad(`${at} needs an even number of cards, 4 to 8`);
    return;
  }
  const ids = s.cards.map((c) => c.id);
  if (new Set(ids).size !== ids.length) bad(`${at} has duplicate card ids`);
  const counts = {};
  s.cards.forEach((c) => {
    counts[c.pairId] = (counts[c.pairId] || 0) + 1;
    if (!isLabelled(c)) bad(`${at} card "${c.id}" has no label`);
    if (c.visual !== undefined && !validVisual(c.visual, false)) bad(`${at} card "${c.id}" has an invalid visual`);
  });
  if (!Object.values(counts).every((n) => n === 2)) bad(`${at} every pair needs exactly two cards`);
  if (!hintsOk(s.hints)) bad(`${at} needs one or two non-empty hints`);
}

function validateRespond(s, at, bad) {
  if (!hintsOk(s.hints)) bad(`${at} needs one or two non-empty hints`);
  const wrongOk = (w) => w === undefined || (typeof w === 'object' && Object.values(w).every((c) => isMisconception(c)));
  if (!wrongOk(s.wrong)) bad(`${at} has an unknown mistake code`);
  if (s.kind === 'input') {
    if (typeof s.answer !== 'string' || !s.answer.trim() || s.answer.length > 12) bad(`${at} needs a short answer`);
    if (s.wrong && Object.hasOwn(s.wrong, s.answer)) bad(`${at} the answer cannot carry a mistake code`);
  }
  if (s.kind === 'numberline') {
    if (!Number.isInteger(s.min) || !Number.isInteger(s.max) || s.max - s.min < 2 || s.max - s.min > 20) bad(`${at} needs a line of 2 to 20 jumps`);
    if (!Number.isInteger(s.target) || s.target < s.min || s.target > s.max) bad(`${at} target is off the line`);
    if (s.denominator !== undefined && !(isInt(s.denominator, 2, 12) && s.max - s.min === s.denominator)) bad(`${at} fraction line must have one jump per part`);
    if (s.wrong && Object.hasOwn(s.wrong, String(s.target))) bad(`${at} the answer cannot carry a mistake code`);
  }
  if (s.kind === 'order') {
    if (!Array.isArray(s.tiles) || s.tiles.length < 2 || s.tiles.length > 10) bad(`${at} needs 2 to 10 tiles`);
    else {
      if (new Set(s.tiles.map((t) => t.id)).size !== s.tiles.length) bad(`${at} has duplicate tile ids`);
      if (!s.tiles.every(isLabelled)) bad(`${at} has an unlabelled tile`);
      const sorted = (x) => [...x].sort().join('\u0000');
      const labels = s.tiles.map((t) => t.label);
      if (!Array.isArray(s.accept) || !s.accept.length || !s.accept.every((x) => typeof x === 'string' && sorted(x.split(' ')) === sorted(labels))) {
        bad(`${at} accepted answers must use exactly the tiles`);
      }
    }
    if (!tagOk(s.misconception)) bad(`${at} has an unknown mistake code`);
  }
  if (s.kind === 'build') {
    if (!isInt(s.capacity, 5, 20) || !isInt(s.target, 1, s.capacity) || !isInt(s.start, 0, s.target)) bad(`${at} has an impossible frame`);
  }
}

// Returns a list of problems. An empty list means the activity can be published.
export function validateActivity(a) {
  const errors = [];
  const id = a && a.id;
  const bad = (msg) => errors.push(`${id || '(no id)'}: ${msg}`);
  if (!a || typeof a.id !== 'string' || !/^[a-z0-9-]+$/.test(a.id) || a.id.length > 60) return ['activity has no valid id'];
  if (typeof a.title !== 'string' || !a.title.trim()) bad('missing title');
  if (!DOMAINS.includes(a.domain)) bad(`unknown domain "${a.domain}"`);
  if (!BANDS.includes(a.band)) bad(`unknown age band "${a.band}"`);
  if (![1, 2, 3].includes(a.level)) bad('level must be 1, 2 or 3');
  if (!SKILLS[a.skill]) bad(`unknown skill "${a.skill}"`);
  else if (SKILLS[a.skill].domain !== a.domain) bad(`skill "${a.skill}" belongs to another domain`);
  if (typeof a.instruction !== 'string' || !a.instruction.trim()) bad('missing instruction');
  if (!Array.isArray(a.steps) || a.steps.length === 0 || a.steps.length > 5) {
    bad('needs 1 to 5 steps');
    return errors;
  }
  a.steps.forEach((s, i) => {
    const at = `step ${i + 1}`;
    if (typeof s.prompt !== 'string' || !s.prompt.trim()) bad(`${at} missing prompt`);
    if (s.visual !== undefined && !validVisual(s.visual)) bad(`${at} has an invalid visual`);
    if (s.kind === 'drop') {
      validateDrop(s, at, bad);
      return;
    }
    if (s.kind === 'memory') {
      validateMemory(s, at, bad);
      return;
    }
    if (RESPOND_KINDS.includes(s.kind)) {
      validateRespond(s, at, bad);
      return;
    }
    if (s.kind !== undefined && s.kind !== 'choice') {
      bad(`${at} has unknown kind "${s.kind}"`);
      return;
    }
    if (!Array.isArray(s.options) || s.options.length < 2 || s.options.length > 4) {
      bad(`${at} needs 2 to 4 options`);
      return;
    }
    const optionIds = s.options.map((o) => o.id);
    if (new Set(optionIds).size !== optionIds.length) bad(`${at} has duplicate option ids`);
    s.options.forEach((o) => {
      if (!isLabelled(o)) bad(`${at} option "${o.id}" has no label`);
      if (!tagOk(o.misconception)) bad(`${at} option "${o.id}" has an unknown mistake code`);
      if (o.misconception && o.id === s.answer) bad(`${at} the answer cannot carry a mistake code`);
      if (o.visual !== undefined && !validVisual(o.visual, false)) bad(`${at} option "${o.id}" has an invalid visual`);
    });
    if (!optionIds.includes(s.answer)) bad(`${at} answer "${s.answer}" is not one of the options`);
    if (!hintsOk(s.hints)) bad(`${at} needs one or two non-empty hints`);
  });
  return errors;
}

export function validateLibrary(list) {
  const errors = [];
  const seen = new Set();
  for (const a of list) {
    if (seen.has(a.id)) errors.push(`duplicate activity id ${a.id}`);
    seen.add(a.id);
    errors.push(...validateActivity(a));
  }
  return errors;
}

// Fisher-Yates shuffle. `rand` is injectable so tests can make it deterministic.
export function shuffle(list, rand = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// `order` holds each memory step's card layout, shuffled once per attempt so that
// re-rendering after a flip never moves the cards.
export function startSession(activity, rand = Math.random) {
  const order = activity.steps.map((s) => (s.kind === 'memory' ? shuffle(s.cards.map((c) => c.id), rand) : null));
  return { activityId: activity.id, index: 0, misses: 0, hintsUsed: 0, drop: null, memory: null, mistakes: [], order, results: [], done: false };
}

// Choice steps: tap one option. Returns { session, outcome } without mutating the input.
// outcome.kind: 'correct' | 'retry' | 'reveal'
//   correct -> step passed first time or after retries (firstTry tells which)
//   retry   -> wrong; outcome.hint is shown and the child tries again
//   reveal  -> third miss; outcome.answer is shown and the step moves on
export function submit(session, activity, optionId) {
  if (session.done) throw new Error('session already complete');
  const step = stepsOf(activity)[session.index];
  if (step.kind === 'drop' || step.kind === 'memory') throw new Error('use placeItem or placeCard for this step');
  if (RESPOND_KINDS.includes(step.kind)) throw new Error('use respond for this step');
  if (!step.options.some((o) => o.id === optionId)) throw new Error(`unknown option ${optionId}`);
  const misconception = step.options.find((o) => o.id === optionId).misconception || null;
  return judge(session, activity, optionId === step.answer, misconception, step.answer);
}

// Shared by choice and respond steps: right, try again with a hint, or reveal on
// the third miss. A mistake code is kept only from the answers that show it.
function judge(session, activity, correct, misconception, answer) {
  const step = stepsOf(activity)[session.index];
  if (correct) {
    return advance(session, activity, { kind: 'correct', correct: true, firstTry: session.misses === 0 });
  }
  const misses = session.misses + 1;
  const mistakes = misconception ? [...(session.mistakes || []), misconception] : (session.mistakes || []);
  if (misses < MAX_MISSES) {
    const hint = step.hints[Math.min(misses - 1, step.hints.length - 1)];
    return {
      session: { ...session, misses, mistakes, hintsUsed: session.hintsUsed + 1 },
      outcome: { kind: 'retry', correct: false, hint, answer: null, misconception },
    };
  }
  return advance(
    { ...session, misses, mistakes },
    activity,
    { kind: 'reveal', correct: false, firstTry: false, answer, misconception },
  );
}

// Grades a response for the 'input', 'numberline', 'order' and 'build' kinds.
// Pure, so the tutor service and tests can use it too.
export function grade(step, response) {
  if (step.kind === 'input') {
    const value = String(response ?? '').trim().replace(/\s+/g, '').replace(/^\+/, '');
    const norm = (x) => (/^-?\d+$/.test(x) ? String(Number(x)) : x.toLowerCase());
    const v = norm(value);
    if (!value) return { valid: false };
    return { valid: true, correct: v === norm(step.answer), misconception: step.wrong?.[v] || null, shown: value };
  }
  if (step.kind === 'numberline' || step.kind === 'build') {
    const n = Number(response);
    const lo = step.kind === 'build' ? 0 : step.min;
    const hi = step.kind === 'build' ? step.capacity : step.max;
    if (!Number.isInteger(n) || n < lo || n > hi) return { valid: false };
    const target = step.kind === 'build' ? step.target : step.target;
    return { valid: true, correct: n === target, misconception: step.kind === 'numberline' ? (step.wrong?.[String(n)] || null) : null, shown: String(n) };
  }
  if (step.kind === 'order') {
    if (!Array.isArray(response) || response.length !== step.tiles.length) return { valid: false };
    const byId = Object.fromEntries(step.tiles.map((t) => [t.id, t.label]));
    if (!response.every((id) => byId[id] !== undefined) || new Set(response).size !== response.length) return { valid: false };
    const text = response.map((id) => byId[id]).join(' ');
    return { valid: true, correct: step.accept.includes(text), misconception: step.misconception || null, shown: text };
  }
  throw new Error(`grade does not handle ${step.kind}`);
}

// Answers an 'input', 'numberline', 'order' or 'build' step. An invalid response
// (empty, off the line) is not a miss: it returns kind 'invalid' and changes nothing.
export function respond(session, activity, response) {
  if (session.done) throw new Error('session already complete');
  const step = stepsOf(activity)[session.index];
  if (!RESPOND_KINDS.includes(step.kind)) throw new Error('respond is for input, numberline, order and build steps');
  const g = grade(step, response);
  if (!g.valid) return { session, outcome: { kind: 'invalid', correct: false, hint: null, answer: null } };
  return judge(session, activity, g.correct, g.correct ? null : g.misconception, step.answer ?? String(step.target));
}

// Drop steps: place one item on one target. Wrong placements never move the item
// away and never end the step; they only give a hint. The step is first-try only
// if every placement in it was correct.
//   outcome.kind: 'placed' (correct, step may continue) | 'retry' (wrong target, hint)
export function placeItem(session, activity, itemId, targetId) {
  if (session.done) throw new Error('session already complete');
  const step = stepsOf(activity)[session.index];
  if (step.kind !== 'drop') throw new Error('placeItem is for drop steps');
  if (!step.items.some((i) => i.id === itemId)) throw new Error(`unknown item ${itemId}`);
  if (!step.targets.some((t) => t.id === targetId)) throw new Error(`unknown target ${targetId}`);
  const drop = session.drop || { placed: {}, wrong: 0 };
  if (drop.placed[itemId]) throw new Error(`${itemId} is already placed`);

  if (step.pairs[itemId] !== targetId) {
    const wrong = drop.wrong + 1;
    const hint = step.hints[Math.min(wrong - 1, step.hints.length - 1)];
    return {
      session: { ...session, drop: { ...drop, wrong }, hintsUsed: session.hintsUsed + 1 },
      outcome: { kind: 'retry', correct: false, hint, itemId, targetId, stepDone: false, activityDone: false },
    };
  }

  const placed = { ...drop.placed, [itemId]: targetId };
  const allPlaced = step.items.every((i) => placed[i.id]);
  if (!allPlaced) {
    return {
      session: { ...session, drop: { placed, wrong: drop.wrong } },
      outcome: { kind: 'placed', correct: true, firstTry: false, itemId, targetId, stepDone: false, activityDone: false, hint: null, answer: null },
    };
  }
  return advance({ ...session, misses: drop.wrong, drop: null }, activity, {
    kind: 'correct', correct: true, firstTry: drop.wrong === 0, itemId, targetId,
  });
}

// Memory steps: turn over one card, then a second. Matching pairs stay face up.
// A mismatch shows both cards and a hint; the next tap turns them back over.
//   outcome.kind: 'flip' | 'match' | 'retry' (mismatch, hint) | 'correct' (step done)
export function placeCard(session, activity, cardId) {
  if (session.done) throw new Error('session already complete');
  const step = stepsOf(activity)[session.index];
  if (step.kind !== 'memory') throw new Error('placeCard is for memory steps');
  const card = step.cards.find((c) => c.id === cardId);
  if (!card) throw new Error(`unknown card ${cardId}`);
  const mem = session.memory || { flipped: [], matched: [], wrong: 0 };
  if (mem.matched.includes(cardId)) throw new Error(`${cardId} is already matched`);

  const open = mem.flipped.length === 2 ? [] : mem.flipped;
  if (open.includes(cardId)) throw new Error(`${cardId} is already face up`);
  const base = { correct: true, stepDone: false, activityDone: false, hint: null, answer: null, cardId };

  if (open.length === 0) {
    return {
      session: { ...session, memory: { ...mem, flipped: [cardId] } },
      outcome: { ...base, kind: 'flip' },
    };
  }

  const first = step.cards.find((c) => c.id === open[0]);
  if (first.pairId === card.pairId) {
    const matched = [...mem.matched, first.id, card.id];
    const memory = { flipped: [], matched, wrong: mem.wrong };
    if (matched.length < step.cards.length) {
      return { session: { ...session, memory }, outcome: { ...base, kind: 'match' } };
    }
    return advance({ ...session, misses: mem.wrong, memory: null }, activity, {
      kind: 'correct', correct: true, firstTry: mem.wrong === 0,
    });
  }

  const wrong = mem.wrong + 1;
  const hint = step.hints[Math.min(wrong - 1, step.hints.length - 1)];
  return {
    session: {
      ...session,
      memory: { flipped: [first.id, card.id], matched: mem.matched, wrong },
      hintsUsed: session.hintsUsed + 1,
    },
    outcome: { ...base, kind: 'retry', correct: false, hint },
  };
}

function advance(session, activity, outcome) {
  const step = stepsOf(activity)[session.index];
  const mistakes = session.mistakes || [];
  const result = {
    skill: activity.skill,
    stepIndex: session.index,
    correct: outcome.correct,
    firstTry: outcome.firstTry,
    misses: session.misses,
    difficulty: step.difficulty || activity.level,
    // The first mistake seen on this step, if the answer showed one.
    misconception: mistakes[0] || null,
    prompt: step.prompt,
  };
  const results = [...session.results, result];
  const nextIndex = session.index + 1;
  const done = nextIndex >= stepsOf(activity).length;
  const next = {
    activityId: session.activityId,
    index: nextIndex,
    misses: 0,
    hintsUsed: session.hintsUsed,
    drop: null,
    memory: null,
    mistakes: [],
    order: session.order,
    results,
    done,
  };
  return { session: next, outcome: { ...outcome, hint: null, answer: outcome.answer ?? null, stepDone: true, activityDone: done } };
}

export function summarySession(session) {
  const total = session.results.length;
  const correctFirst = session.results.filter((r) => r.firstTry).length;
  return { total, correctFirst, hintsUsed: session.hintsUsed };
}
