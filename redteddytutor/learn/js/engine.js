// Pure activity logic: validation, answer checking, hints and retries.
// No DOM or storage access, so it runs in the browser and under node:test alike.
// Step kinds: 'choice' (default; tap one option), 'drop' (place each item on its target)
// and 'memory' (turn cards over to find pairs).
import { BANDS, DOMAINS, SKILLS } from './content.js';

const VISUAL_KINDS = ['dots', 'shape', 'swatch', 'text', 'sequence'];
const SHAPES = ['circle', 'square', 'triangle', 'rectangle'];

export const MAX_MISSES = 3; // the third miss on a choice reveals the answer, gently

export function stepsOf(activity) {
  return activity.steps;
}

function validVisual(v, allowSequence = true) {
  if (!v || !VISUAL_KINDS.includes(v.kind)) return false;
  if (v.kind === 'dots') return Number.isInteger(v.count) && v.count >= 1 && v.count <= 10;
  if (v.kind === 'shape') return SHAPES.includes(v.shape) && (v.outline === undefined || typeof v.outline === 'boolean');
  if (v.kind === 'swatch') return typeof v.label === 'string' && /^#[0-9a-f]{6}$/i.test(v.hex);
  if (v.kind === 'text') return typeof v.text === 'string' && v.text.length > 0 && v.text.length <= 6;
  if (v.kind === 'sequence') {
    return allowSequence && Array.isArray(v.items) && v.items.length >= 2 && v.items.length <= 6
      && v.items.every((item) => item === null || validVisual(item, false))
      && v.items.filter((item) => item === null).length === 1;
  }
  return false;
}

const isLabelled = (x) => typeof x.label === 'string' && x.label.trim().length > 0;
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

// Returns a list of problems. An empty list means the activity can be published.
export function validateActivity(a) {
  const errors = [];
  const id = a && a.id;
  const bad = (msg) => errors.push(`${id || '(no id)'}: ${msg}`);
  if (!a || typeof a.id !== 'string' || !/^[a-z0-9-]+$/.test(a.id)) return ['activity has no valid id'];
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
  return { activityId: activity.id, index: 0, misses: 0, hintsUsed: 0, drop: null, memory: null, order, results: [], done: false };
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
  if (!step.options.some((o) => o.id === optionId)) throw new Error(`unknown option ${optionId}`);

  if (optionId === step.answer) {
    return advance(session, activity, { kind: 'correct', correct: true, firstTry: session.misses === 0 });
  }

  const misses = session.misses + 1;
  if (misses < MAX_MISSES) {
    const hint = step.hints[Math.min(misses - 1, step.hints.length - 1)];
    return {
      session: { ...session, misses, hintsUsed: session.hintsUsed + 1 },
      outcome: { kind: 'retry', correct: false, hint, answer: null },
    };
  }
  return advance(
    { ...session, misses },
    activity,
    { kind: 'reveal', correct: false, firstTry: false, answer: step.answer },
  );
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
  const result = {
    skill: activity.skill,
    stepIndex: session.index,
    correct: outcome.correct,
    firstTry: outcome.firstTry,
    misses: session.misses,
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
