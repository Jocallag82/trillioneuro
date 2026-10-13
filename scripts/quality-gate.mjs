// Curriculum quality gate. Runs every automated check on every published skill and
// writes docs/curriculum/quality-report.json. Exits 1 if any skill fails.
//
// Run: node scripts/quality-gate.mjs [out.json]
//
// Checks (per skill unless noted):
//   ids          id format, no case-insensitive duplicate ids or duplicate titles (global)
//   prereqs      every prerequisite exists, no cycles, prerequisites start no later
//   placement    placed in a US course of the same subject that runs at each placed grade,
//                and each placed grade's age band is one of the skill's bands
//   lesson       intro, two or more ideas, a worked example with steps and answer, a watch-out
//   practice     40 generated sets per skill validate (options, keys, hints, mistake codes)
//   keys         each choice key appears once; numeric keys never repeated by a distractor
//   variety      at least 8 distinct items across 40 sets (no single repeated question)
//   duplicates   identical question text under two skills is reported (warning, global)
//   reachable    the skill is offered to some age band, so the app can plan it
//   standards    every mapped code is in the registry (or outside the K-8 denominator)
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(process.env.RTT_ROOT || join(HERE, '..'), 'redteddytutor/learn/js');
const load = (f) => import(pathToFileURL(join(SRC, f)).href);
const { OBJECTIVES, BANDS, validateFramework, objectivesFor } = await load('curriculum/framework.js');
const { GENERATORS, practiceActivity } = await load('curriculum/generators.js');
const { LESSONS } = await load('curriculum/lessons.js');
const { US_CATALOGUE } = await load('curriculum/catalogues/us.js');
const { GRADE_BAND } = await load('curriculum/grades.js');
const { standardsCoverage } = await load('curriculum/standards/coverage.js');
const { validateActivity } = await load('engine.js');

const results = {};
const fail = (id, check, msg) => { (results[id] ||= { errors: [], warnings: [] }).errors.push(`${check}: ${msg}`); };
const warn = (id, check, msg) => { (results[id] ||= { errors: [], warnings: [] }).warnings.push(`${check}: ${msg}`); };
const ids = Object.keys(OBJECTIVES);
for (const id of ids) results[id] = { errors: [], warnings: [] };

// ---- Global: ids and titles ----
const lower = new Map();
const titles = new Map();
for (const id of ids) {
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(id)) fail(id, 'ids', 'id is not lower-case-kebab');
  if (lower.has(id.toLowerCase())) fail(id, 'ids', `duplicates ${lower.get(id.toLowerCase())}`);
  lower.set(id.toLowerCase(), id);
  const t = OBJECTIVES[id].label.toLowerCase();
  if (titles.has(t)) fail(id, 'ids', `same title as ${titles.get(t)}`);
  titles.set(t, id);
}
for (const e of validateFramework()) fail(e.split(':')[0], 'prereqs', e);

const first = (id) => Math.min(...OBJECTIVES[id].bands.map((b) => BANDS.indexOf(b)));
const reachable = new Set(BANDS.flatMap((b) => objectivesFor(b)));
const promptOwner = new Map();
// The same question text under two skills is reported once per pair as a warning:
// overlapping skills (times tables and multiplying by 10) can legitimately share a fact.
const overlaps = new Map();
const overlap = (id, owner, prompt) => { const k = `${id}|${owner}`; if (!overlaps.has(k)) overlaps.set(k, []); overlaps.get(k).push(prompt); };

for (const id of ids) {
  const o = OBJECTIVES[id];
  for (const p of o.prereqs) if (OBJECTIVES[p] && first(p) > first(id)) fail(id, 'prereqs', `${p} starts later`);

  // Placement
  const place = US_CATALOGUE.placement[id];
  if (!place) fail(id, 'placement', 'no US placement');
  else {
    const courses = US_CATALOGUE.courses.filter((c) => c.id === place.course || (place.also || []).includes(c.id));
    if (!courses.length) fail(id, 'placement', `unknown course ${place.course}`);
    for (const c of courses) if (c.subject !== o.subject) fail(id, 'placement', `course ${c.id} is ${c.subject}, skill is ${o.subject}`);
    for (const g of place.grades) {
      if (!courses.some((c) => c.grades.includes(g))) fail(id, 'placement', `grade ${g} is in none of its courses`);
      if (!o.bands.includes(GRADE_BAND[g])) warn(id, 'placement', `grade ${g} (ages ${GRADE_BAND[g]}) is outside the skill's bands ${o.bands.join(', ')}`);
    }
  }

  // Lesson
  const l = LESSONS[id];
  if (!l) warn(id, 'lesson', 'no lesson: the app shows the goal and hints only');
  else if (!(l.intro && l.ideas?.length >= 2 && l.example?.steps?.length && l.example.answer && l.watch)) fail(id, 'lesson', 'incomplete lesson');
  else if (!(l.more || []).length) warn(id, 'lesson', 'one worked example only');

  // Practice, keys, variety
  if (!GENERATORS[id]) { fail(id, 'practice', 'no generator'); continue; }
  const prompts = new Set();
  for (let seed = 1; seed <= 40; seed++) {
    let act;
    try { act = practiceActivity(id, [1, 2, 3, 2, 3], seed * 31 + 7); } catch (e) { fail(id, 'practice', `throws: ${e.message}`); break; }
    const errs = validateActivity(act);
    if (errs.length) { fail(id, 'practice', errs[0]); break; }
    for (const s of act.steps) {
      const key = JSON.stringify([s.prompt, s.visual, s.options?.map((x) => [x.label, x.visual]), s.tiles?.map((t) => t.label).sort(), s.items, s.cards?.map((c) => c.label).sort(), s.target]);
      prompts.add(key);
      if (s.options) {
        if (s.options.filter((x) => x.id === s.answer).length !== 1) fail(id, 'keys', `key missing or repeated in "${s.prompt}"`);
        const k = Number(s.options.find((x) => x.id === s.answer)?.label);
        if (Number.isFinite(k) && s.options.filter((x) => Number(x.label) === k).length > 1) fail(id, 'keys', `two options equal the key in "${s.prompt}"`);
        // Odd-one-out items repeat the distractors on purpose; the key must still be unique.
        const keyLabel = JSON.stringify(s.options.filter((x) => x.id === s.answer).map((x) => [x.label, x.visual])[0]);
        if (s.options.filter((x) => JSON.stringify([x.label, x.visual]) === keyLabel).length > 1) fail(id, 'keys', `an option looks the same as the key in "${s.prompt}"`);
      }
      if (s.kind === 'input' && s.wrong && Object.keys(s.wrong).includes(s.answer)) fail(id, 'keys', `answer listed as a wrong value in "${s.prompt}"`);
      // Generic prompts ("What does this program print?") are distinguished by their visuals.
      if (!s.visual) {
        const owner = promptOwner.get(s.prompt);
        if (owner && owner !== id) overlap(id, owner, s.prompt);
        promptOwner.set(s.prompt, id);
      }
    }
  }
  if (prompts.size < 8) fail(id, 'variety', `only ${prompts.size} distinct items in 40 sets`);
  if (!reachable.has(id)) fail(id, 'reachable', 'not offered to any age band');
}

for (const [k, list] of overlaps) { const [id, owner] = k.split('|'); warn(id, 'duplicates', `${list.length} question(s) also asked under ${owner}, e.g. "${list[0]}"`); }

// Standards
const cov0 = standardsCoverage(US_CATALOGUE);
for (const u of cov0.unknownCodes) fail(u.split(':')[0], 'standards', `code not in the registry: ${u}`);

const qa = Object.fromEntries(ids.map((id) => [id, results[id].errors.length === 0]));
const cov = standardsCoverage(US_CATALOGUE, qa);
const failing = ids.filter((id) => !qa[id]);
const report = {
  generatedAt: new Date().toISOString().slice(0, 10),
  skills: ids.length, passing: ids.length - failing.length, failing: failing.length,
  withWarnings: ids.filter((id) => results[id].warnings.length).length,
  checks: ['ids', 'prereqs', 'placement', 'lesson', 'practice', 'keys', 'variety', 'duplicates', 'reachable', 'standards'],
  educatorReviewed: 0,
  standards: { overall: cov.overall, byFramework: cov.byFramework },
  results,
};
const file = resolve(process.argv[2] || join(HERE, '..', 'docs/curriculum/quality-report.json'));
await mkdir(dirname(file), { recursive: true });
await writeFile(file, JSON.stringify(report, null, 2) + '\n');
// A small module the public curriculum page reads, so it shows the gate's real result.
const mod = join(SRC, 'curriculum/quality.js');
await writeFile(mod, `// Generated by scripts/quality-gate.mjs. Do not edit by hand.\nexport const QUALITY = ${JSON.stringify({ generatedAt: report.generatedAt, skills: report.skills, passing: report.passing, warnings: report.withWarnings, pass: qa })};\n`);
console.log(`${report.passing}/${report.skills} skills pass the quality gate; ${report.withWarnings} with warnings -> ${file}`);
for (const id of failing) console.log(`  FAIL ${id}: ${results[id].errors.join('; ')}`);
process.exit(failing.length ? 1 : 0);
