// Public curriculum page. Everything is read from the same catalogue, lessons and
// generators the app uses, so the page cannot claim more than the product has.
import { OBJECTIVES } from '/learn/js/curriculum/framework.js';
import { US_CATALOGUE } from '/learn/js/curriculum/catalogues/us.js';
import { coverageByGrade, totals, inCourse, courseStatus } from '/learn/js/curriculum/coverage.js';
import { LESSONS } from '/learn/js/curriculum/lessons.js';
import { US_GRADES, gradeLabel, schoolLevel, LEVEL_LABEL } from '/learn/js/curriculum/grades.js';
import { el } from '/learn/js/dom.js';
import { standardsCoverage } from '/learn/js/curriculum/standards/coverage.js';
import { SOURCES, REFERENCE_FRAMEWORKS } from '/learn/js/curriculum/standards/registry.js';
import { allStateStatus, STATES } from '/learn/js/curriculum/standards/states.js';
import { QUALITY } from '/learn/js/curriculum/quality.js';

const cat = US_CATALOGUE;
const SUBJECT_ORDER = ['maths', 'literacy', 'science', 'social', 'computing', 'thinking', 'enrichment'];
const sName = (s) => cat.subjectNames[s] || s;
const rows = coverageByGrade(cat);

const t = totals(cat);
document.getElementById('cur-totals').textContent =
  `${t.objectives} skills today, all with practice; ${t.withLessons} with a full lesson; ${t.standardsMapped} linked to a Common Core or NGSS standard. ${t.activeCourses} courses have content and ${t.plannedCourses} are planned.`;

function showGrade(grade) {
  document.querySelectorAll('.cur-grades button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.grade === grade)));
  const courses = cat.courses.filter((c) => c.grades.includes(grade))
    .sort((a, b) => SUBJECT_ORDER.indexOf(a.subject) - SUBJECT_ORDER.indexOf(b.subject));
  const host = document.getElementById('cur-grade');
  host.replaceChildren(
    el('h3', { class: 'cur-grade-title', text: `${gradeLabel(grade)} · ${LEVEL_LABEL[schoolLevel(grade)]}` }),
    ...courses.map((c) => {
      const ids = Object.entries(cat.placement).filter(([id, p]) => OBJECTIVES[id] && inCourse(p, c.id) && p.grades.includes(grade)).map(([id]) => id)
        .sort((a, b) => OBJECTIVES[a].order - OBJECTIVES[b].order);
      const planned = courseStatus(cat, c) === 'planned' || !ids.length;
      return el('article', { class: `cur-card${planned ? ' is-planned' : ''}` }, [
        el('div', { class: 'cur-card-head' }, [
          el('h4', { text: c.title }),
          el('span', { class: 'cur-subject', text: sName(c.subject) }),
          planned ? el('span', { class: 'cur-badge', text: 'Not available yet' }) : null,
        ]),
        ids.length ? el('ul', { class: 'cur-skills' }, ids.map((id) => {
          const p = cat.placement[id];
          return el('li', {}, [
            el('span', { class: 'cur-skill' }, [
              el('a', { href: `/learn/?lesson=${id}`, text: OBJECTIVES[id].label }),
              el('span', { class: 'cur-goal', text: OBJECTIVES[id].goal }),
            ]),
            el('span', { class: 'cur-meta' }, [
              p.standards.length
                ? p.standards.map((s) => `${s.code}${s.fit === 'partial' ? ' (part)' : ''}`).join(', ')
                : (p.note ? 'No standard mapped' : 'Red Teddy skill'),
              LESSONS[id] ? ' · lesson' : '',
              ' · practice',
            ]),
          ]);
        })) : null,
      ]);
    }),
  );
}

const grades = document.getElementById('cur-grades');
grades.replaceChildren(...US_GRADES.map((g) => el('button', {
  type: 'button', dataset: { grade: g }, 'aria-pressed': 'false', onclick: () => { showGrade(g); history.replaceState(null, '', `#grade-${g}`); },
  text: g === 'PK' ? 'Pre-K' : g,
})));
const fromHash = /^#grade-(\w+)$/.exec(location.hash)?.[1];
showGrade(US_GRADES.includes(fromHash) ? fromHash : '3');

// Coverage matrix: grades down, subjects across.
const subjects = SUBJECT_ORDER.filter((s) => rows.some((r) => r.subject === s && r.objectives));
const matrix = document.getElementById('cur-matrix');
matrix.replaceChildren(
  el('caption', { class: 'sr-only', text: 'Skills with lessons and practice, by grade and subject' }),
  el('thead', {}, [el('tr', {}, [el('th', { scope: 'col', text: 'Grade' }), ...subjects.map((s) => el('th', { scope: 'col', text: sName(s) }))])]),
  el('tbody', {}, US_GRADES.map((g) => el('tr', {}, [
    el('th', { scope: 'row', text: g === 'PK' ? 'Pre-K' : g === 'K' ? 'K' : `Grade ${g}` }),
    ...subjects.map((s) => {
      const r = rows.find((x) => x.grade === g && x.subject === s);
      if (!r || !r.objectives) return el('td', { class: 'none', text: '–' });
      return el('td', { title: `${r.objectives} skills, ${r.lessons} with lessons, ${r.standardsMapped} with standards` }, [
        el('strong', { text: String(r.objectives) }),
        el('span', { text: ` skill${r.objectives === 1 ? '' : 's'}` }),
      ]);
    }),
  ]))),
);

document.getElementById('cur-sources').replaceChildren(...Object.values(cat.frameworks).map((f) => el('li', {}, [
  el('a', { href: f.url, rel: 'noopener', target: '_blank', text: f.name }),
  ` (${f.version}), ${f.owner}.`,
])));


// ---------- Standards coverage, against a stated denominator ----------
const std = standardsCoverage(cat, QUALITY.pass);
const pc = (n, d) => (d ? `${Math.round((1000 * n) / d) / 10}%` : '–');
const cell = (n, d) => el('td', {}, [el('strong', { text: String(n) }), el('span', { text: ` (${pc(n, d)})` })]);
document.getElementById('std-lead').textContent =
  `Measured against ${std.overall.total} official standards: Common Core math and English for kindergarten to grade 8, and every NGSS performance expectation. High-school math and English, computer science, social studies and state standards are not in this denominator yet, so they are never counted as covered.`;
const head = ['Framework', 'Standards', 'Mapped', 'Taught', 'Assessed', 'Fully covered', 'Educator-reviewed'];
const stdRow = (label, f) => el('tr', {}, [el('th', { scope: 'row', text: label }), el('td', { text: String(f.total) }), cell(f.mapped, f.total), cell(f.taught, f.total), cell(f.assessed, f.total), cell(f.full, f.total), cell(0, f.total)]);
document.getElementById('cur-std').replaceChildren(
  el('caption', { class: 'sr-only', text: 'Standards coverage by framework' }),
  el('thead', {}, [el('tr', {}, head.map((h) => el('th', { scope: 'col', text: h })))]),
  el('tbody', {}, [...Object.entries(std.byFramework).map(([fw, f]) => stdRow(`${fw} (${SOURCES[fw].grades.split(' ')[0]})`, f)), stdRow('All', std.overall)]),
);
const GORDER = ['K', '1', '2', '3', '4', '5', '6', '7', '8', 'K-2', '3-5', 'MS', 'HS'];
const gradeRows = std.byGrade.sort((a, b) => a.framework.localeCompare(b.framework) || GORDER.indexOf(a.grade) - GORDER.indexOf(b.grade));
document.getElementById('cur-std-grade').replaceChildren(
  el('caption', { class: 'sr-only', text: 'Standards coverage by grade' }),
  el('thead', {}, [el('tr', {}, ['Framework', 'Grade', 'Standards', 'Mapped', 'Taught', 'Assessed', 'Fully covered'].map((h) => el('th', { scope: 'col', text: h })))]),
  el('tbody', {}, gradeRows.map((r) => el('tr', {}, [el('td', { text: r.framework }), el('th', { scope: 'row', text: r.grade }), el('td', { text: String(r.total) }), cell(r.mapped, r.total), cell(r.taught, r.total), cell(r.assessed, r.total), cell(r.full, r.total)]))),
);

document.getElementById('cur-qa').textContent =
  `${QUALITY.passing} of ${QUALITY.skills} published skills pass every automated check (last run ${QUALITY.generatedAt}): answer keys re-solved independently, no broken or circular prerequisites, every skill placed in a course and reachable, valid practice sets with enough variety, and standards codes checked against the registry. ${QUALITY.warnings} skills carry warnings, mostly a lesson with a single worked example or none. Educator-reviewed: 0.`;

// ---------- States ----------
const states = allStateStatus();
const LABEL = {
  'national-mapping-likely-transfers-unverified': 'Uses the national standard (not yet verified)',
  'national-mapping-is-a-starting-point': 'Revised national standard: needs its own mapping',
  'national-mapping-does-not-transfer': 'State’s own standards: not mapped',
  'not-researched': 'Not researched yet',
};
const researched = states.filter((s) => s.launch !== 'not-researched');
document.getElementById('cur-states').replaceChildren(
  el('caption', { class: 'sr-only', text: 'State standards status' }),
  el('thead', {}, [el('tr', {}, ['State', 'Math', 'English', 'Science', 'Verified skills'].map((h) => el('th', { scope: 'col', text: h })))]),
  el('tbody', {}, researched.map((s) => el('tr', {}, [
    el('th', { scope: 'row' }, [STATES[s.code].source ? el('a', { href: STATES[s.code].source, rel: 'noopener', target: '_blank', text: s.name }) : s.name]),
    el('td', { text: LABEL[s.math] }), el('td', { text: LABEL[s.ela] }), el('td', { text: LABEL[s.science] }), el('td', { text: String(s.verifiedSkills) }),
  ]))),
);
document.getElementById('states-rest').textContent = `${states.length - researched.length} other states and the District of Columbia have not been researched yet. State history, graduation requirements and state test formats are not supported in any state.`;

// ---------- Limitations ----------
const fw = std.byFramework;
document.getElementById('cur-limits').replaceChildren(...[
  `${fw['CCSS-M'].total - fw['CCSS-M'].mapped} of ${fw['CCSS-M'].total} K–8 Common Core math standards have no skill yet.`,
  `${fw['CCSS-ELA'].total - fw['CCSS-ELA'].mapped} of ${fw['CCSS-ELA'].total} K–8 Common Core English standards have no skill yet. Writing, speaking and listening are only partly practised: the app checks choices about writing, not a child’s own extended writing.`,
  `${fw.NGSS.total - fw.NGSS.mapped} of ${fw.NGSS.total} NGSS performance expectations have no skill yet, and none is fully covered: NGSS expects investigations, models and explanations that multiple-choice practice only partly assesses.`,
  'High-school math and English standards are not yet in the denominator, although courses such as Algebra I, Geometry, Algebra II, Precalculus and Statistics have skills.',
  `Computer science (${REFERENCE_FRAMEWORKS.CSTA.name}), social studies (${REFERENCE_FRAMEWORKS.C3.name}) and enrichment frameworks are referenced but not mapped.`,
  'No skill has been reviewed by an outside qualified educator, and no state alignment has been verified.',
].map((t) => el('li', { text: t })));
