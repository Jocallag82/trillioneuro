// The learner model: what a child has shown, what we infer from it, and what to do next.
// Pure functions over recorded steps. No storage, DOM or network, so the same numbers
// come out in the browser, in tests and anywhere else that reads the same records.
//
// Adapted from the GradeA / ExplainIt mastery engine (checkireland-rent,
// lib/explainit/mastery.ts): evidence weighted by difficulty, independence and
// recency, with a confidence figure that stops a few answers being shown as a
// measurement. Changed for younger children: a wrong try here is an answer, not a
// hint request, and most items are multiple choice, so a correct answer after a
// miss earns much less credit than an unaided one.
//
// Three different things, kept apart everywhere they are shown:
//   demonstrated  answers the child actually gave (counts, first-try rate)
//   estimate      the mastery level computed from them, with its confidence
//   assumed       objectives a placement check suggested are already known, with no
//                 answers behind them. Never shown as mastered.
import { OBJECTIVES, BANDS, SUBJECTS, objectivesFor, allPrereqs, ladder, bandIndex } from './curriculum/framework.js';
import { GENERATORS, generateStep } from './curriculum/generators.js';
import { MISCONCEPTIONS } from './curriculum/misconceptions.js';
import { mulberry32 } from '../game/js/rng.js';

const DAY = 86400000;
const DIFFICULTY_WEIGHT = { 1: 1, 2: 1.8, 3: 3 };
const RECENCY_DECAY = 0.85;
// Slower than GradeA's 5: most items here are multiple choice, so a lucky guess is
// likelier and more answers are needed before a level means anything.
const CONFIDENCE_HALF_LIFE = 8;
export const MIN_CONFIDENCE = 0.35;
export const SECURE_AT = 80;
export const SECURE_CONFIDENCE = 0.5;
export const SUPPORT_BELOW = 50;
// Days before a review is due, by how many separate days the child has got it right.
export const REVIEW_INTERVALS = [1, 3, 7, 14, 30, 60];

// Credit for one answered step. Unaided is full credit. After one miss the child
// had fewer options left, so it is weaker evidence; after two it says little.
export function credit(step) {
  if (step.firstTry) return 1;
  if (step.correct === false) return 0;
  if (step.correct === undefined) return 0; // older records: outcome after a miss is unknown
  const misses = step.hints ?? 1;
  return misses <= 1 ? 0.5 : 0.25;
}

const dayKey = (t) => Math.floor(t / DAY);

export function mastery(steps) {
  const ordered = [...steps].sort((a, b) => a.at - b.at);
  if (!ordered.length) return { level: 0, confidence: 0, attempts: 0, firstTry: 0, lastAt: null, reportable: false };
  let got = 0; let total = 0; let evidence = 0;
  ordered.forEach((s, i) => {
    const w = DIFFICULTY_WEIGHT[s.difficulty || 1];
    const r = Math.pow(RECENCY_DECAY, ordered.length - 1 - i);
    total += w * r;
    got += w * r * credit(s);
    evidence += w;
  });
  const confidence = 1 - Math.pow(0.5, evidence / CONFIDENCE_HALF_LIFE);
  return {
    level: Math.round((got / total) * 100),
    confidence: Number(confidence.toFixed(3)),
    attempts: ordered.length,
    firstTry: ordered.filter((s) => s.firstTry).length,
    lastAt: ordered[ordered.length - 1].at,
    reportable: confidence >= MIN_CONFIDENCE,
  };
}

export const STATE_LABEL = {
  'not-started': 'Not started',
  'assumed': 'Probably known (from check)',
  'getting-started': 'Getting started',
  'needs-support': 'Needs support',
  'developing': 'Coming along',
  'secure': 'Secure',
};

export function stateOf(m, assumed = false) {
  if (m.attempts === 0) return assumed ? 'assumed' : 'not-started';
  if (!m.reportable) return 'getting-started';
  if (m.level < SUPPORT_BELOW) return 'needs-support';
  if (m.level >= SECURE_AT && m.confidence >= SECURE_CONFIDENCE) return 'secure';
  return 'developing';
}

// Mistake codes seen recently. "Active" means seen at least twice in the last
// twelve answers and not since followed by three first-try answers in a row.
export function misconceptionsOf(steps) {
  const recent = [...steps].sort((a, b) => a.at - b.at).slice(-12);
  const counts = {};
  recent.forEach((s, i) => {
    if (!s.misconception) return;
    counts[s.misconception] = counts[s.misconception] || { code: s.misconception, count: 0, lastIndex: -1 };
    counts[s.misconception].count += 1;
    counts[s.misconception].lastIndex = i;
  });
  return Object.values(counts).map((c) => {
    const after = recent.slice(c.lastIndex + 1);
    const resolved = after.length >= 3 && after.slice(-3).every((s) => s.firstTry);
    return { code: c.code, label: MISCONCEPTIONS[c.code].label, count: c.count, active: c.count >= 2 && !resolved, resolved };
  }).sort((a, b) => b.count - a.count);
}

// Spaced review. The interval only grows when the child answers first time after
// waiting at least the current interval, so practising every day for a week earns a
// short interval, and remembering after a real gap earns a longer one. A miss after
// a gap drops the interval back to the start. "Remembered" is the longest gap after
// which the child still answered first time: evidence of retention, not practice.
export function retentionOf(steps, now) {
  const ordered = [...steps].sort((a, b) => a.at - b.at);
  if (!ordered.length) return { intervalDays: null, dueAt: null, due: false, rememberedAfterDays: 0 };
  let level = -1;
  let lastCounted = null;
  for (const s of ordered) {
    const gapDays = lastCounted === null ? Infinity : dayKey(s.at) - dayKey(lastCounted);
    const interval = level < 0 ? 0 : REVIEW_INTERVALS[level];
    if (s.firstTry && gapDays >= interval) {
      level = Math.min(level + 1, REVIEW_INTERVALS.length - 1);
      lastCounted = s.at;
    } else if (!s.firstTry && level >= 0 && gapDays >= interval) {
      level = 0;
      lastCounted = s.at;
    }
  }
  const goodDays = level + 1;
  const intervalDays = REVIEW_INTERVALS[Math.max(level, 0)];
  const lastAt = ordered[ordered.length - 1].at;
  let rememberedAfterDays = 0;
  for (let i = 1; i < ordered.length; i++) {
    const gap = Math.floor((ordered[i].at - ordered[i - 1].at) / DAY);
    if (gap >= 2 && ordered[i].firstTry) rememberedAfterDays = Math.max(rememberedAfterDays, gap);
  }
  const dueAt = lastAt + intervalDays * DAY;
  return { intervalDays, dueAt, due: goodDays > 0 && now >= dueAt, rememberedAfterDays };
}

// One objective, everything about it.
export function objectiveReport(state, id, now = Date.now()) {
  const steps = state.steps.filter((s) => s.skill === id);
  const m = mastery(steps);
  const assumed = (state.settings.assumed || []).includes(id);
  const st = stateOf(m, assumed);
  const retention = retentionOf(steps, now);
  return {
    id,
    label: OBJECTIVES[id].label,
    subject: OBJECTIVES[id].subject,
    strand: OBJECTIVES[id].strand,
    goal: OBJECTIVES[id].goal,
    state: st,
    mastery: m,
    retention: { ...retention, due: retention.due && (st === 'secure' || st === 'developing') },
    misconceptions: misconceptionsOf(steps),
    fromDiagnostic: steps.filter((s) => s.source === 'diagnostic').length,
  };
}

export function learnerReport(state, now = Date.now()) {
  const ids = Object.keys(OBJECTIVES);
  return Object.fromEntries(ids.map((id) => [id, objectiveReport(state, id, now)]));
}

const MET = new Set(['assumed', 'developing', 'secure']);
export const isMet = (report) => MET.has(report.state);
export const isReady = (reports, id) => OBJECTIVES[id].prereqs.every((p) => isMet(reports[p]));

// Difficulty for the next item, nudged one step at a time and only on evidence.
export function nextDifficulty(report, band) {
  const m = report.mastery;
  if (!m.reportable) return bandIndex(band) >= 3 && report.state !== 'not-started' ? 2 : (report.state === 'assumed' ? 2 : 1);
  if (m.level < 40) return 1;
  if (m.level >= SECURE_AT) return 3;
  return 2;
}

// A five-item ramp around a difficulty: starts a step easier, ends a step harder.
export function rampFor(d, count = 5) {
  const ramp = [Math.max(1, d - 1), d, d, d, Math.min(3, d + 1)];
  return count === 5 ? ramp : Array.from({ length: count }, (_, i) => ramp[Math.min(i, 4)]);
}

// Lower-cases a label for use mid-sentence, keeping proper nouns such as Pythagorean.
export const mid = (label) => (/^[A-Z][a-z]+ [A-Z]/.test(label) || /Pythagorean|Newton|Punnett|Bill of Rights|US |Earth/.test(label) ? label.replace(/^The /, 'the ') : label.toLowerCase());
const days = (ms) => Math.max(1, Math.round(ms / DAY));

// The plan for today: a short, ordered list of objectives with a reason for each.
// Order: one review that is due, one area that needs support, things in progress,
// then new objectives whose foundations are in place. Suggestions, not a diagnosis.
export function plan(state, now = Date.now(), limit = 4) {
  const { band, focus } = state.settings;
  const reports = learnerReport(state, now);
  const inFocus = (id) => (focus === 'all' || OBJECTIVES[id].subject === focus) && GENERATORS[id];
  const placement = state.settings.placement || {};
  // The quick check's starting points are always plannable, even when the check found
  // the child needs to start below their age band (otherwise the plan would be empty).
  const near = [...new Set([...objectivesFor(band, 1), ...Object.values(placement)])].filter(inFocus);
  const here = new Set(objectivesFor(band, 0));
  // For planning only: a prerequisite usually met in an earlier age band, with no
  // answers either way, is taken as known. A learner in grade 9 is not asked to prove
  // counting first. As soon as answers show a gap, it is no longer taken as known,
  // and the plan steps back to it. Nothing here is recorded as mastery.
  const bi = bandIndex(band);
  const below = (p) => Math.max(...OBJECTIVES[p].bands.map(bandIndex)) < bi;
  // Only from middle school up: younger children build foundations first.
  const metForPlan = (p) => isMet(reports[p]) || (bi >= 5 && reports[p].state === 'not-started' && below(p));
  const isReady = (_reports, id) => OBJECTIVES[id].prereqs.every(metForPlan);
  const out = [];
  const add = (id, kind, reason) => {
    if (out.some((x) => x.objective === id)) return;
    out.push({ objective: id, kind, reason, difficulty: nextDifficulty(reports[id], band), label: OBJECTIVES[id].label });
  };

  const due = near.map((id) => reports[id]).filter((r) => r.retention.due)
    .sort((a, b) => a.retention.dueAt - b.retention.dueAt);
  if (due[0]) add(due[0].id, 'review', `Last practised ${days(now - due[0].mastery.lastAt)} days ago. A quick review helps it stick.`);

  const support = near.map((id) => reports[id])
    .filter((r) => isReady(reports, r.id) && (r.state === 'needs-support' || r.misconceptions.some((m) => m.active)))
    .sort((a, b) => a.mastery.level - b.mastery.level);
  if (support[0]) {
    const mc = support[0].misconceptions.find((m) => m.active);
    // Struggling with a skill whose foundation has no evidence yet: check the foundation first.
    const gap = OBJECTIVES[support[0].id].prereqs.find((p) => !isMet(reports[p]) && GENERATORS[p]);
    if (gap) add(gap, 'support', `Builds the foundation for ${mid(OBJECTIVES[support[0].id].label)}, which has been tricky so far.`);
    add(support[0].id, 'support', mc
      ? `Working on a common mix-up: ${mc.label.toLowerCase()}.`
      : `${support[0].mastery.firstTry} of ${support[0].mastery.attempts} answers right first time so far. More practice will help.`);
  }

  near.map((id) => reports[id])
    .filter((r) => (r.state === 'getting-started' || r.state === 'developing') && isReady(reports, r.id))
    .sort((a, b) => b.mastery.lastAt - a.mastery.lastAt)
    .forEach((r) => add(r.id, 'continue', r.state === 'developing'
      ? 'Coming along well. A few more answers will show if it is secure.'
      : `Just started: ${r.mastery.attempts} ${r.mastery.attempts === 1 ? 'answer' : 'answers'} so far.`));

  const fresh = near.filter((id) => reports[id].state === 'not-started' && isReady(reports, id))
    .sort((a, b) => {
      const placed = (id) => (Object.values(placement).includes(id) ? 0 : 1);
      return placed(a) - placed(b) || (here.has(b) - here.has(a)) || OBJECTIVES[a].order - OBJECTIVES[b].order;
    });
  // A starting point whose own foundation is not yet shown (a short check can stop
  // before reaching it): start from the deepest missing foundation instead.
  const foundation = (id, seen = new Set()) => {
    if (seen.has(id)) return id;
    seen.add(id);
    const gap = OBJECTIVES[id].prereqs.find((p) => !metForPlan(p) && GENERATORS[p]);
    return gap ? foundation(gap, seen) : id;
  };
  Object.values(placement).filter((id) => inFocus(id) && reports[id].state === 'not-started' && !isReady(reports, id)).forEach((id) => {
    const f = foundation(id);
    if (f !== id && reports[f].state === 'not-started') add(f, 'new', `Builds the foundation for ${mid(OBJECTIVES[id].label)}, your starting point from the quick check.`);
  });
  fresh.forEach((id) => {
    const after = OBJECTIVES[id].prereqs.map((p) => mid(OBJECTIVES[p].label));
    add(id, 'new', Object.values(placement).includes(id)
      ? 'Your starting point from the quick check.'
      : after.length ? `Ready to start. It builds on ${after.join(' and ')}.` : 'A good place to start.');
  });

  // A quick check that found gaps below every nearby skill can leave nothing ready
  // here. Then step back: first the missing foundation of anything already tried,
  // then the earliest ready skills in the subject, so the plan is never a dead end.
  if (out.length < 2) {
    near.filter((id) => reports[id].state !== 'not-started' && !isReady(reports, id))
      .sort((a, b) => OBJECTIVES[a].order - OBJECTIVES[b].order)
      .forEach((id) => { const f = foundation(id); if (f !== id) add(f, 'support', `Builds the foundation for ${mid(OBJECTIVES[id].label)}, which has been tricky so far.`); });
  }
  if (out.length < 2) {
    Object.keys(OBJECTIVES).filter(inFocus).filter((id) => !isMet(reports[id]) && isReady(reports, id))
      .sort((a, b) => OBJECTIVES[a].order - OBJECTIVES[b].order)
      .slice(0, 2 - out.length + 1)
      .forEach((id) => add(id, 'new', 'A foundation to build on first.'));
  }

  if (out.length < limit) {
    const next = BANDS[bandIndex(band) + 2];
    if (next) {
      objectivesFor(next, 0).filter(inFocus).filter((id) => reports[id].state === 'not-started' && isReady(reports, id))
        .forEach((id) => add(id, 'stretch', 'A stretch: usually met a little later, and the foundations are in place.'));
    }
  }

  return out.slice(0, limit);
}

// ---------- Placement check ----------
// A short adaptive check along one subject's ladder. A right answer jumps two rungs
// up, a wrong one steps back, and it stops when the edge is found or after `max`
// questions. One attempt per question and no right/wrong shown to the child.
const DIAGNOSABLE = (id) => {
  const s = generateStep(id, 2, mulberry32(7));
  return !['drop', 'memory'].includes(s.kind);
};

export function startDiagnostic(subject, band, max = 7) {
  const top = bandIndex(band) + 1;
  const rungs = ladder(subject).filter((id) => GENERATORS[id] && DIAGNOSABLE(id)
    && OBJECTIVES[id].bands.some((b) => bandIndex(b) <= top));
  if (!rungs.length) return null;
  let pos = rungs.findIndex((id) => OBJECTIVES[id].bands.includes(band));
  if (pos < 0) pos = Math.max(0, rungs.findIndex((id) => OBJECTIVES[id].bands.some((b) => bandIndex(b) >= bandIndex(band))));
  // Start a little below the usual level so the first question is a confident one.
  pos = Math.max(0, pos - 1);
  return { subject, band, rungs, pos, lo: -1, hi: rungs.length, asked: 0, max, done: false, log: [] };
}

export function diagnosticItem(diag, rand) {
  const id = diag.rungs[diag.pos];
  return { objective: id, step: generateStep(id, 2, rand) };
}

export function answerDiagnostic(diag, correct) {
  const asked = diag.asked + 1;
  const log = [...diag.log, { objective: diag.rungs[diag.pos], correct }];
  let { lo, hi, pos } = diag;
  if (correct) lo = Math.max(lo, pos); else hi = Math.min(hi, pos);
  const done = asked >= diag.max || hi - lo <= 1;
  if (!done) pos = correct ? Math.min(hi - 1, pos + 2) : Math.max(lo + 1, pos - 1);
  return { ...diag, asked, log, lo, hi, pos, done };
}

// What the check found: the first rung not yet shown (the starting point), and the
// objectives below the highest correct answer that can be assumed for now.
export function diagnosticResult(diag) {
  const start = diag.rungs[Math.min(diag.hi, diag.rungs.length - 1)];
  const known = diag.lo >= 0 ? diag.rungs[diag.lo] : null;
  const assumed = known ? [...allPrereqs(known)].filter((id) => OBJECTIVES[id].subject === diag.subject) : [];
  return { subject: diag.subject, start, highestShown: known, assumed, questions: diag.asked };
}

export const subjectsFor = (band) => Object.keys(SUBJECTS).filter((s) => objectivesFor(band, 1).some((id) => OBJECTIVES[id].subject === s));
