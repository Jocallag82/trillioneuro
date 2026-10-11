// Pure activity logic: validation, answer checking, hints and retries.
// No DOM or storage access, so it runs in the browser and under node:test alike.
import { BANDS, DOMAINS, SKILLS } from './content.js';

const VISUAL_KINDS = ['dots', 'shape', 'swatch', 'text', 'sequence'];
const SHAPES = ['circle', 'square', 'triangle', 'rectangle'];

export const MAX_MISSES = 3; // the third miss reveals the answer, gently

export function stepsOf(activity) {
  return activity.steps;
}

function validVisual(v, allowSequence = true) {
  if (!v || !VISUAL_KINDS.includes(v.kind)) return false;
  if (v.kind === 'dots') return Number.isInteger(v.count) && v.count >= 1 && v.count <= 10;
  if (v.kind === 'shape') return SHAPES.includes(v.shape);
  if (v.kind === 'swatch') return typeof v.label === 'string' && /^#[0-9a-f]{6}$/i.test(v.hex);
  if (v.kind === 'text') return typeof v.text === 'string' && v.text.length > 0 && v.text.length <= 6;
  if (v.kind === 'sequence') {
    return allowSequence && Array.isArray(v.items) && v.items.length >= 2 && v.items.length <= 6
      && v.items.every((item) => item === null || validVisual(item, false))
      && v.items.filter((item) => item === null).length === 1;
  }
  return false;
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
    if (!Array.isArray(s.options) || s.options.length < 2 || s.options.length > 4) {
      bad(`${at} needs 2 to 4 options`);
      return;
    }
    const optionIds = s.options.map((o) => o.id);
    if (new Set(optionIds).size !== optionIds.length) bad(`${at} has duplicate option ids`);
    s.options.forEach((o) => {
      if (typeof o.label !== 'string' || !o.label.trim()) bad(`${at} option "${o.id}" has no label`);
      if (o.visual !== undefined && !validVisual(o.visual, false)) bad(`${at} option "${o.id}" has an invalid visual`);
    });
    if (!optionIds.includes(s.answer)) bad(`${at} answer "${s.answer}" is not one of the options`);
    if (!Array.isArray(s.hints) || s.hints.length < 1 || s.hints.length > 2 || s.hints.some((h) => typeof h !== 'string' || !h.trim())) {
      bad(`${at} needs one or two non-empty hints`);
    }
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

export function startSession(activity) {
  return { activityId: activity.id, index: 0, misses: 0, hintsUsed: 0, results: [], done: false };
}

// Applies one tap. Returns { session, outcome } without mutating the input.
// outcome.kind: 'correct' | 'retry' | 'reveal'
//   correct -> step passed first time or after retries (firstTry tells which)
//   retry   -> wrong; outcome.hint is shown and the child tries again
//   reveal  -> third miss; outcome.answer is shown and the step moves on
export function submit(session, activity, optionId) {
  if (session.done) throw new Error('session already complete');
  const steps = stepsOf(activity);
  const step = steps[session.index];
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
