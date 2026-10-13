// Standards coverage: how much of the denominator (registry.js) Red Teddy actually
// covers, computed from the same data the app runs. Never typed in.
//
// For each standard in the denominator:
//   mapped    - at least one published skill lists it (a code alone, nothing more)
//   taught    - a mapped skill has a lesson (explanation + worked examples)
//   assessed  - a mapped skill has generated practice that passes the automated
//               quality gate (scripts/quality-gate.mjs; pass `qa` to apply its result)
//   full      - taught AND assessed AND at least one skill addresses it as 'aligned'
//   partial   - mapped, but every link is 'partial' or the skill lacks a lesson
//   reviewed  - approved by a qualified educator (none yet: always 0)
//   unsupported - not mapped by any skill
import { OBJECTIVES } from '../framework.js';
import { GENERATORS } from '../generators.js';
import { LESSONS } from '../lessons.js';
import { STANDARDS, STANDARD_INDEX, SOURCES, standardOf } from './registry.js';

// qa: optional { [skillId]: true|false } from the quality gate. Default: every skill
// with a generator is treated as passing (the test suite enforces this in CI).
export function standardsCoverage(catalogue, qa = null) {
  const links = new Map(); // key -> [{ id, fit }]
  const unknownCodes = [];
  const outside = [];
  for (const [id, place] of Object.entries(catalogue.placement)) {
    if (!OBJECTIVES[id]) continue;
    for (const s of place.standards || []) {
      const code = standardOf(s.framework, s.code);
      const key = `${s.framework}:${code}`;
      if (!STANDARD_INDEX.has(key)) {
        // High-school CCSS codes and similar are real but outside the denominator.
        if (SOURCES[s.framework] && isInScope(s.framework, s.code)) unknownCodes.push(`${id}: ${s.framework} ${s.code}`);
        else outside.push({ id, framework: s.framework, code: s.code, fit: s.fit });
        continue;
      }
      if (!links.has(key)) links.set(key, []);
      links.get(key).push({ id, fit: s.fit });
    }
  }
  const passes = (id) => Boolean(GENERATORS[id]) && (qa ? qa[id] === true : true);
  const rows = STANDARDS.map((s) => {
    const key = `${s.framework}:${s.code}`;
    const l = links.get(key) || [];
    const taught = l.some((x) => LESSONS[x.id]);
    const assessed = l.some((x) => passes(x.id));
    const aligned = l.some((x) => x.fit === 'aligned' && LESSONS[x.id] && passes(x.id));
    const status = !l.length ? 'unsupported' : aligned ? 'full' : 'partial';
    return { ...s, skills: l.map((x) => x.id), mapped: l.length > 0, taught, assessed, full: status === 'full', status, reviewed: false, stateVerified: false };
  });
  const sum = (list) => {
    const total = list.length;
    const n = (k) => list.filter((r) => r[k]).length;
    const pct = (x) => (total ? Math.round((1000 * x) / total) / 10 : 0);
    const out = { total, mapped: n('mapped'), taught: n('taught'), assessed: n('assessed'), full: n('full'), partial: list.filter((r) => r.status === 'partial').length, unsupported: list.filter((r) => r.status === 'unsupported').length, reviewed: 0, stateVerified: 0 };
    out.pct = { mapped: pct(out.mapped), taught: pct(out.taught), assessed: pct(out.assessed), full: pct(out.full), reviewed: 0 };
    return out;
  };
  const byFramework = {};
  for (const fw of Object.keys(SOURCES)) byFramework[fw] = sum(rows.filter((r) => r.framework === fw));
  const byGrade = {};
  for (const r of rows) (byGrade[`${r.framework}|${r.grade}`] ||= []).push(r);
  const grades = Object.entries(byGrade).map(([k, list]) => { const [framework, grade] = k.split('|'); return { framework, grade, ...sum(list) }; });
  return { overall: sum(rows), byFramework, byGrade: grades, rows, unknownCodes, outsideDenominator: outside };
}

// K-8 CCSS codes and all NGSS codes are in the denominator; anything shaped like one
// that is missing from the registry is an error (a typo or an invented code).
function isInScope(framework, code) {
  if (framework === 'CCSS-M') return /^[K1-8]\./.test(code);
  if (framework === 'CCSS-ELA') return /^[A-Z]+\.[K1-8]\./.test(code);
  return framework === 'NGSS';
}
