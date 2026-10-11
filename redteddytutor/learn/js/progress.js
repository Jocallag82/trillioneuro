// Device-only progress. Stored in the browser's localStorage under one key.
// Pure state functions are separated from storage I/O so tests can use a fake store.
import { BANDS, SKILLS } from './content.js';

export const STORAGE_KEY = 'rtt.learn.v1';
const MAX_STEPS = 2000;
const MAX_SESSIONS = 200;

export function emptyState() {
  return {
    v: 1,
    settings: { band: '3-5', audio: true, volume: 1, showAll: false },
    steps: [],
    sessions: [],
  };
}

const isNum = (n) => typeof n === 'number' && Number.isFinite(n);

// Accepts anything read from storage and returns a safe, well-typed state.
export function normalize(raw) {
  const base = emptyState();
  if (!raw || typeof raw !== 'object' || raw.v !== 1) return base;
  const s = raw.settings || {};
  base.settings = {
    band: BANDS.includes(s.band) ? s.band : base.settings.band,
    audio: typeof s.audio === 'boolean' ? s.audio : base.settings.audio,
    volume: isNum(s.volume) ? Math.min(1, Math.max(0, s.volume)) : base.settings.volume,
    showAll: typeof s.showAll === 'boolean' ? s.showAll : base.settings.showAll,
  };
  base.steps = (Array.isArray(raw.steps) ? raw.steps : [])
    .filter((x) => x && typeof x.activityId === 'string' && typeof x.skill === 'string'
      && typeof x.firstTry === 'boolean' && isNum(x.at))
    .slice(-MAX_STEPS);
  base.sessions = (Array.isArray(raw.sessions) ? raw.sessions : [])
    .filter((x) => x && typeof x.activityId === 'string' && isNum(x.at)
      && isNum(x.total) && isNum(x.correctFirst) && isNum(x.hintsUsed))
    .slice(-MAX_SESSIONS);
  return base;
}

export function readState(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    return raw ? normalize(JSON.parse(raw)) : emptyState();
  } catch {
    return emptyState();
  }
}

export function writeState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function clearState(storage) {
  try {
    storage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

// One answered step (after the child's first tap or after retries).
export function recordStep(state, activityId, skill, firstTry, at) {
  const steps = [...state.steps, { activityId, skill, firstTry, at }].slice(-MAX_STEPS);
  return { ...state, steps };
}

// One finished activity.
export function recordCompletion(state, activityId, summary, at) {
  const sessions = [...state.sessions, { activityId, at, ...summary }].slice(-MAX_SESSIONS);
  return { ...state, sessions };
}

export function updateSettings(state, patch) {
  return normalize({ ...state, v: 1, settings: { ...state.settings, ...patch } });
}

// Trend uses only what was observed: first-try results, in order.
export function trendOf(results) {
  const n = results.length;
  if (n === 0) return 'new';
  const accuracy = results.filter(Boolean).length / n;
  if (n >= 6) {
    const half = Math.floor(n / 2);
    const early = results.slice(0, half).filter(Boolean).length / half;
    const late = results.slice(-half).filter(Boolean).length / half;
    if (late - early >= 0.2) return 'improving';
  }
  if (n >= 3 && accuracy < 0.6) return 'practice';
  return 'steady';
}

export function skillSummaries(state) {
  const bySkill = new Map();
  for (const s of state.steps) {
    if (!bySkill.has(s.skill)) bySkill.set(s.skill, []);
    bySkill.get(s.skill).push(s.firstTry);
  }
  return [...bySkill.entries()]
    .filter(([skill]) => SKILLS[skill])
    .map(([skill, results]) => {
      const correctFirst = results.filter(Boolean).length;
      return {
        skill,
        label: SKILLS[skill].label,
        domain: SKILLS[skill].domain,
        attempts: results.length,
        correctFirst,
        accuracy: correctFirst / results.length,
        trend: trendOf(results),
      };
    })
    .sort((a, b) => a.label.localeCompare(b.label));
}

export function summarise(state) {
  const skills = skillSummaries(state);
  const correct = state.steps.filter((s) => s.firstTry).length;
  return {
    completed: new Set(state.sessions.map((s) => s.activityId)).size,
    sessionCount: state.sessions.length,
    stepCount: state.steps.length,
    firstTryAccuracy: state.steps.length ? correct / state.steps.length : null,
    skills,
    recent: [...state.sessions].reverse().slice(0, 5),
  };
}

// Suggestions only. Order: skills that need practice, then new activities by
// level, then completed activities in weak skills (for another try).
export function recommend(state, activities, limit = 3) {
  const inScope = state.settings.showAll
    ? activities
    : activities.filter((a) => a.band === state.settings.band);
  const completed = new Set(state.sessions.map((s) => s.activityId));
  const weak = new Set(skillSummaries(state).filter((s) => s.trend === 'practice').map((s) => s.skill));
  const byLevel = (a, b) => a.level - b.level;

  const practice = inScope.filter((a) => !completed.has(a.id) && weak.has(a.skill)).sort(byLevel);
  const fresh = inScope.filter((a) => !completed.has(a.id) && !weak.has(a.skill)).sort(byLevel);
  const retry = inScope.filter((a) => completed.has(a.id) && weak.has(a.skill)).sort(byLevel);

  const reasonFor = (a, why) => ({ activity: a, reason: why });
  return [
    ...practice.map((a) => reasonFor(a, `More practice: ${SKILLS[a.skill].label}`)),
    ...fresh.map((a) => reasonFor(a, `New: ${SKILLS[a.skill].label}`)),
    ...retry.map((a) => reasonFor(a, `Try again: ${SKILLS[a.skill].label}`)),
  ].slice(0, limit);
}
