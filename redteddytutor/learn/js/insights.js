// Parent-facing conclusions, each with the evidence behind it. Pure: state in, facts out.
//
// Two kinds of statement are kept apart everywhere they are shown:
// - Observed: counts of what the child actually did (answers, first-time answers, days,
//   mistakes seen). These are facts about the record.
// - Estimated: a judgement made from those facts (secure, uncertain, improving). Every
//   estimate says how much evidence it rests on, and says "too early to tell" rather
//   than guess. Nothing here predicts grades or test results.
import { OBJECTIVES } from './curriculum/framework.js';
import { MISCONCEPTIONS } from './curriculum/misconceptions.js';

const DAY = 86400000;
const dayKey = (t) => Math.floor(t / DAY);

// How much evidence a set of answers is. Plain words, never a bare percentage.
export function evidenceOf(steps) {
  const answers = steps.length;
  const days = new Set(steps.map((s) => dayKey(s.at))).size;
  let level = 'none';
  if (answers >= 12 && days >= 3) level = 'strong';
  else if (answers >= 5) level = 'some';
  else if (answers > 0) level = 'little';
  const text = {
    none: 'No answers yet',
    little: `Little evidence: ${answers} ${answers === 1 ? 'answer' : 'answers'}`,
    some: `Some evidence: ${answers} answers on ${days} ${days === 1 ? 'day' : 'days'}`,
    strong: `Strong evidence: ${answers} answers on ${days} days`,
  }[level];
  return { answers, days, level, text };
}

const stepsFor = (state, id) => state.steps.filter((s) => s.skill === id);

// Skills the child has shown they can do on their own: secure, from unaided answers.
export function independent(state, reports) {
  return Object.values(reports)
    .filter((r) => r.state === 'secure')
    .map((r) => {
      const steps = stepsFor(state, r.id);
      const recent = [...steps].sort((a, b) => a.at - b.at).slice(-10);
      return {
        id: r.id, label: r.label,
        observed: `${recent.filter((s) => s.firstTry).length} of the last ${recent.length} answered right first time, without help.`,
        remembered: r.retention.rememberedAfterDays >= 3 ? `Still right after a ${r.retention.rememberedAfterDays}-day break.` : 'Not yet checked after a break of three days or more.',
        evidence: evidenceOf(steps),
      };
    })
    .sort((a, b) => b.evidence.answers - a.evidence.answers);
}

// Skills with answers (or an assumption) that are not yet secure, and the reason why.
export function uncertain(state, reports) {
  const out = [];
  for (const r of Object.values(reports)) {
    const steps = stepsFor(state, r.id);
    const ev = evidenceOf(steps);
    const m = r.mastery;
    const mc = r.misconceptions.find((x) => x.active);
    let why = null; let kind = null;
    if (r.state === 'assumed') { kind = 'assumed'; why = 'Assumed known from the quick check. No practice answers yet, so this is a guess to plan with, not a result.'; }
    else if (r.state === 'getting-started') { kind = 'too-early'; why = `Only ${m.attempts} ${m.attempts === 1 ? 'answer' : 'answers'} so far: too few to judge either way.`; }
    else if (r.state === 'needs-support') { kind = 'struggling'; why = `${m.firstTry} of ${m.attempts} answers right first time.${mc ? ` A mix-up keeps appearing: ${mc.label.toLowerCase()}.` : ''}`; }
    else if (r.state === 'developing') {
      kind = 'not-consistent';
      const seen = `${m.firstTry} of ${m.attempts} answers right first time.`;
      why = mc ? `${seen} Improving, but a mix-up keeps appearing: ${mc.label.toLowerCase()}.`
        : m.confidence < 0.5 ? `${seen} Going well, but not enough answers yet to call it secure.`
          : `${seen} Recent answers are not yet consistent enough to call it secure.`;
    }
    if (kind) out.push({ id: r.id, label: r.label, kind, why, evidence: ev });
  }
  const rank = { struggling: 0, 'not-consistent': 1, 'too-early': 2, assumed: 3 };
  return out.sort((a, b) => rank[a.kind] - rank[b.kind] || b.evidence.answers - a.evidence.answers);
}

// Mistake types seen at least twice in the window, across all skills.
export function recurringMistakes(state, reports, now = Date.now(), windowDays = 30) {
  const since = now - windowDays * DAY;
  const byCode = {};
  for (const s of state.steps) {
    if (!s.misconception || s.at < since) continue;
    const c = (byCode[s.misconception] ||= { code: s.misconception, count: 0, skills: new Set(), lastAt: 0 });
    c.count += 1; c.skills.add(s.skill); c.lastAt = Math.max(c.lastAt, s.at);
  }
  return Object.values(byCode).filter((c) => c.count >= 2).map((c) => {
    const skills = [...c.skills];
    const active = skills.some((id) => reports[id]?.misconceptions.some((m) => m.code === c.code && m.active));
    const resolved = !active && skills.every((id) => reports[id]?.misconceptions.some((m) => m.code === c.code && m.resolved));
    return {
      code: c.code, label: MISCONCEPTIONS[c.code].label, parent: MISCONCEPTIONS[c.code].parent, tip: MISCONCEPTIONS[c.code].tip,
      count: c.count, skills: skills.map((id) => OBJECTIVES[id]?.label || id), lastAt: c.lastAt,
      status: active ? 'active' : resolved ? 'resolved' : 'quiet',
    };
  }).sort((a, b) => (a.status === 'active' ? 0 : 1) - (b.status === 'active' ? 0 : 1) || b.count - a.count);
}

// Is first-time accuracy changing? Compares the last 14 days with the 14 before, using
// only skills practised in both periods so a switch to harder topics does not read as
// decline. Needs at least 8 answers in each period; otherwise it says it cannot tell.
export const TREND_MIN = 8;
export function trend(state, now = Date.now(), days = 14) {
  const recentFrom = now - days * DAY; const earlierFrom = now - 2 * days * DAY;
  const recentAll = state.steps.filter((s) => s.at > recentFrom && s.at <= now);
  const earlierAll = state.steps.filter((s) => s.at > earlierFrom && s.at <= recentFrom);
  const shared = new Set(recentAll.map((s) => s.skill).filter((id) => earlierAll.some((e) => e.skill === id)));
  const recent = recentAll.filter((s) => shared.has(s.skill));
  const earlier = earlierAll.filter((s) => shared.has(s.skill));
  const rate = (xs) => xs.filter((s) => s.firstTry).length / xs.length;
  const base = { recent: { answers: recent.length, firstTry: recent.filter((s) => s.firstTry).length }, earlier: { answers: earlier.length, firstTry: earlier.filter((s) => s.firstTry).length }, skills: shared.size };
  if (recent.length < TREND_MIN || earlier.length < TREND_MIN) {
    return { ...base, direction: 'unknown', text: `Too early to tell: comparing needs at least ${TREND_MIN} answers on the same skills in each of the last two fortnights.` };
  }
  const diff = rate(recent) - rate(earlier);
  const direction = diff >= 0.15 ? 'up' : diff <= -0.15 ? 'down' : 'steady';
  const words = { up: 'More answers right first time than the fortnight before', down: 'Fewer answers right first time than the fortnight before', steady: 'About the same as the fortnight before' }[direction];
  return { ...base, direction, text: `${words}: ${base.recent.firstTry} of ${base.recent.answers} recently, against ${base.earlier.firstTry} of ${base.earlier.answers} before, on the same ${shared.size} ${shared.size === 1 ? 'skill' : 'skills'}.` };
}
