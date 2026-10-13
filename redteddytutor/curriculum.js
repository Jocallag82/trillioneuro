// Public curriculum page. Everything is read from the same catalogue, lessons and
// generators the app uses, so the page cannot claim more than the product has.
import { OBJECTIVES } from '/learn/js/curriculum/framework.js';
import { US_CATALOGUE } from '/learn/js/curriculum/catalogues/us.js';
import { coverageByGrade, totals, inCourse, courseStatus } from '/learn/js/curriculum/coverage.js';
import { LESSONS } from '/learn/js/curriculum/lessons.js';
import { US_GRADES, gradeLabel, schoolLevel, LEVEL_LABEL } from '/learn/js/curriculum/grades.js';
import { el } from '/learn/js/dom.js';

const cat = US_CATALOGUE;
const SUBJECT_ORDER = ['maths', 'literacy', 'science', 'social', 'computing', 'thinking', 'electives'];
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
