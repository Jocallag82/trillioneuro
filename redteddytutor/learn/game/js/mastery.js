// Adaptive difficulty from recorded first-try results. Pure: takes saved steps, returns tiers.
// Uses only what the child actually answered, most recent first.
import { LEVELS } from './curriculum.js';

const WINDOW = 10; // most recent first-try results per skill

export function recentResults(steps, skill) {
  return steps.filter((s) => s.skill === skill).slice(-WINDOW).map((s) => s.firstTry);
}

// Difficulty tier 1..3 from accuracy. Fewer than three answers means start at tier 1.
export function tierFromResults(results) {
  if (results.length < 3) return 1;
  const acc = results.filter(Boolean).length / results.length;
  if (acc < 0.5) return 1;
  if (acc < 0.8) return 2;
  return 3;
}

export function tierForSkill(steps, skill) {
  return tierFromResults(recentResults(steps, skill));
}

// Lowers the tier for the rest of a level after consecutive misses, so a struggling
// child gets easier rounds straight away, without any penalty.
export function adjustForSession(tier, consecutiveMisses) {
  if (consecutiveMisses >= 2) return Math.max(1, tier - 1);
  return tier;
}

// A level is passed when enough rounds were right first time (see curriculum PASS_MARK).
export function levelPassed(sessions, levelId, passMark) {
  return sessions.some((s) => s.activityId === levelId && s.correctFirst >= passMark);
}

// Which levels are open: level 1 always, then each level after a pass.
export function unlockedLevels(sessions, passMark) {
  const open = [LEVELS[0].id];
  for (let i = 0; i < LEVELS.length - 1; i++) {
    if (levelPassed(sessions, LEVELS[i].id, passMark)) open.push(LEVELS[i + 1].id);
    else break;
  }
  return open;
}
