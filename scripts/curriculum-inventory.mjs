// Writes the machine-readable curriculum inventory: every published skill with its
// grades, subject, course, lesson, assessment, prerequisites, standards (and fit) and
// activity types, plus per-grade/subject counts and the gaps that remain.
// Computed from the same modules the app runs, so it cannot claim more than exists.
//
// Run: node scripts/curriculum-inventory.mjs [out.json]   (default docs/curriculum/inventory.json)
// Activity types are sampled from the generators (all three difficulties, many seeds).
import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC = resolve(process.env.RTT_ROOT || join(HERE, '..'), 'redteddytutor/learn/js/curriculum');
const load = (f) => import(pathToFileURL(join(SRC, f)).href);
const { OBJECTIVES, SUBJECTS, STRANDS } = await load('framework.js');
const { GENERATORS, generateStep } = await load('generators.js');
const { LESSONS } = await load('lessons.js');
const { US_CATALOGUE } = await load('catalogues/us.js');
const { coverageByGrade, totals, courseStatus } = await load('coverage.js');
const { US_GRADES } = await load('grades.js');
const { mulberry32 } = await import(pathToFileURL(join(SRC, '../../game/js/rng.js')).href);

function activityTypes(id) {
  const kinds = new Set();
  const rand = mulberry32(id.length * 977);
  for (const d of [1, 2, 3]) for (let i = 0; i < 25; i++) {
    const s = generateStep(id, d, rand);
    kinds.add(s.visual?.kind ? `${s.kind || 'choice'}+${s.visual.kind}` : (s.kind || 'choice'));
  }
  return [...kinds].sort();
}

const cat = US_CATALOGUE;
const skills = Object.entries(OBJECTIVES).map(([id, o]) => {
  const p = cat.placement[id] || { grades: [], standards: [] };
  return {
    id, label: o.label, subject: o.subject, subjectName: cat.subjectNames[o.subject] || SUBJECTS[o.subject].label,
    strand: STRANDS[o.strand] || o.strand, ageBands: o.bands, grades: p.grades, course: p.course || null, alsoIn: p.also || [],
    goal: o.goal, prerequisites: o.prereqs,
    lesson: Boolean(LESSONS[id]), practice: Boolean(GENERATORS[id]), assessment: Boolean(GENERATORS[id]) ? 'scored practice set with spaced review' : null,
    activityTypes: GENERATORS[id] ? activityTypes(id) : [],
    standards: (p.standards || []).map((s) => ({ framework: s.framework, code: s.code, fit: s.fit })),
    coverage: !(p.standards || []).length ? 'unmapped' : p.standards.every((s) => s.fit === 'aligned') ? 'aligned' : 'partial',
    stateAlignmentVerified: false, review: o.review, note: p.note || null,
  };
});

const grid = coverageByGrade(cat).map((r) => ({
  grade: r.grade, subject: r.subject, skills: r.objectives, withLessons: r.lessons, standardsMapped: r.standardsMapped,
  courses: r.courses.map((c) => `${c.title} (${c.status})`),
}));
const gaps = [];
for (const g of US_GRADES) for (const s of ['maths', 'literacy', 'science', 'social', 'computing']) {
  const row = grid.find((r) => r.grade === g && r.subject === s);
  const n = row?.skills || 0;
  const want = { maths: 4, literacy: 3, science: 2, social: 1, computing: 1 }[s];
  if (g === 'PK' && s !== 'maths' && s !== 'literacy') continue;
  if (['K', '1', '2'].includes(g) && ['social', 'computing'].includes(s)) continue;
  if (n < want) gaps.push({ grade: g, subject: s, skills: n, note: n ? 'thin' : 'none' });
}

const out = {
  generatedAt: new Date().toISOString().slice(0, 10), country: 'US',
  frameworks: cat.frameworks,
  totals: { ...totals(cat), skills: skills.length, aligned: skills.filter((s) => s.coverage === 'aligned').length, partial: skills.filter((s) => s.coverage === 'partial').length, unmapped: skills.filter((s) => s.coverage === 'unmapped').length },
  courses: cat.courses.map((c) => ({ id: c.id, title: c.title, subject: c.subject, grades: c.grades, status: courseStatus(cat, c), skills: skills.filter((s) => s.course === c.id || s.alsoIn.includes(c.id)).map((s) => s.id) })),
  byGradeAndSubject: grid, gaps,
  caveats: [
    'Standards codes are linked only where the practice addresses the standard; "partial" means part of what the standard asks (often explaining, modelling or wider contexts) is not assessed.',
    'No state-level alignment has been verified. Common Core and NGSS are adopted and modified differently by each state.',
    'Social studies, personal finance and computer science skills have no mapped codes.',
    'Content is authored by the Red Teddy team and checked by automated tests; no outside educator review has taken place yet.',
  ],
  skills,
};
const file = resolve(process.argv[2] || join(HERE, '..', 'docs/curriculum/inventory.json'));
await mkdir(dirname(file), { recursive: true });
await writeFile(file, JSON.stringify(out, null, 2) + '\n');
console.log(`${skills.length} skills, ${out.totals.activeCourses} active / ${out.totals.plannedCourses} planned courses, ${out.totals.aligned} aligned, ${out.totals.partial} partial, ${out.totals.unmapped} unmapped, ${gaps.length} grade/subject gaps -> ${file}`);
