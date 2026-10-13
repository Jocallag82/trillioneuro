// Screens for exploring and asking: the curriculum browser (grade → subject → course
// → objective), the lesson that comes before practice, and Ask Red Teddy.
//
// They draw only. Progress comes from learner.js through `ctx`, curriculum from the
// country catalogue, and answers to questions from the tutor service. Nothing here
// records progress: practice does that.
import { el } from './dom.js';
import { OBJECTIVES, SUBJECTS, STRANDS, BANDS } from './curriculum/framework.js';
import { LESSONS, ASK_PROMPTS } from './curriculum/lessons.js';
import { US_CATALOGUE } from './curriculum/catalogues/us.js';
import { courseStatus, inCourse } from './curriculum/coverage.js';
import { US_GRADES, GRADE_BAND, gradeLabel, schoolLevel, LEVEL_LABEL } from './curriculum/grades.js';
import { objectiveReport } from './learner.js';
import { askTutor, reasonText } from './tutor.js';

const STATE_SHORT = { 'not-started': 'Not started', assumed: 'Probably known', 'getting-started': 'Started', 'needs-support': 'Needs practice', developing: 'Coming along', secure: 'Secure' };
const cat = US_CATALOGUE;
const subjectName = (s) => cat.subjectNames[s] || SUBJECTS[s]?.label || s;

// Which grade to browse first: the learner's own, or the first grade of their band.
export function defaultGrade(settings) {
  if (settings.grade && US_GRADES.includes(settings.grade)) return settings.grade;
  return US_GRADES.find((g) => GRADE_BAND[g] === settings.band) || 'K';
}

// ---------- Curriculum browser ----------
export function renderCurriculum(ctx, grade = defaultGrade(ctx.state().settings)) {
  const now = Date.now();
  const state = ctx.state();
  const courses = cat.courses.filter((c) => c.grades.includes(grade));
  const bySubject = {};
  for (const c of courses) (bySubject[c.subject] ||= []).push(c);

  const gradePicker = el('div', { class: 'grade-tabs', role: 'group', 'aria-label': 'Grade' }, US_GRADES.map((g) => el('button', {
    type: 'button', class: `grade-tab${g === grade ? ' is-current' : ''}`, 'aria-pressed': String(g === grade),
    onclick: () => renderCurriculum(ctx, g), text: g === 'PK' ? 'Pre-K' : g,
  })));

  const sections = Object.entries(bySubject).map(([subject, list]) => el('section', { class: 'cur-subject', 'aria-labelledby': `cs-${subject}` }, [
    el('h3', { id: `cs-${subject}`, text: subjectName(subject) }),
    ...list.map((course) => {
      const ids = Object.entries(cat.placement).filter(([id, p]) => inCourse(p, course.id) && p.grades.includes(grade) && OBJECTIVES[id]).map(([id]) => id)
        .sort((a, b) => OBJECTIVES[a].order - OBJECTIVES[b].order);
      const status = courseStatus(cat, course);
      return el('div', { class: `cur-course${status === 'planned' ? ' is-planned' : ''}` }, [
        el('div', { class: 'cur-course-head' }, [
          el('h4', { text: course.title }),
          status === 'planned' || !ids.length
            ? el('span', { class: 'tag tag-planned', text: 'Not available yet' })
            : el('span', { class: 'muted small', text: `${ids.length} ${ids.length === 1 ? 'skill' : 'skills'} at this grade` }),
        ]),
        ids.length ? el('ul', { class: 'skills' }, ids.map((id) => {
          const r = objectiveReport(state, id, now);
          const std = cat.placement[id].standards;
          return el('li', { class: `skill state-${r.state}` }, [
            el('span', { class: 'dot', 'aria-hidden': 'true' }),
            el('span', { class: 'skill-name' }, [
              ctx.L(OBJECTIVES[id].label),
              std.length ? el('span', { class: 'std', title: 'Related standards', text: std.map((s) => s.code).join(', ') }) : null,
            ]),
            el('span', { class: 'skill-meta', text: STATE_SHORT[r.state] + (r.mastery.attempts ? ` · ${r.mastery.attempts} answers` : '') }),
            el('span', { class: 'skill-actions' }, [
              LESSONS[id] ? el('button', { type: 'button', class: 'link', 'aria-label': `Lesson: ${OBJECTIVES[id].label}`, onclick: () => renderLesson(ctx, id, () => renderCurriculum(ctx, grade)), text: 'Lesson' }) : null,
              el('button', { type: 'button', class: 'link', 'aria-label': `Practice ${OBJECTIVES[id].label}`, onclick: () => ctx.startPractice(id, 'practice', { skipLesson: true }), text: 'Practice' }),
            ]),
          ]);
        })) : null,
      ]);
    }),
  ]));

  ctx.setScreen([
    el('nav', { class: 'activity-nav' }, [el('button', { type: 'button', class: 'link', onclick: () => ctx.renderHome(), text: '← Back to my plan' })]),
    el('p', { class: 'eyebrow', text: LEVEL_LABEL[schoolLevel(grade)] }),
    el('h2', { id: 'cur-title', tabindex: '-1', text: `${gradeLabel(grade)} curriculum` }),
    el('p', { class: 'lead', text: 'Every skill we teach at this grade, grouped into courses. Codes like 3.NF.A.1 show related Common Core or NGSS standards. Courses marked “Not available yet” are on our list but have no lessons today.' }),
    gradePicker,
    sections.length ? el('div', { class: 'cur-grid' }, sections) : el('p', { class: 'muted', text: 'Nothing is catalogued for this grade yet.' }),
    el('p', { class: 'muted small', text: 'Standards are published by their owners; we link to the source on the Curriculum page. No state’s own version of these standards has been checked yet.' }),
  ], '#cur-title');
  ctx.say(`${gradeLabel(grade)} curriculum.`);
}

// ---------- Lesson ----------
export function renderLesson(ctx, id, back = () => ctx.renderHome()) {
  const o = OBJECTIVES[id];
  const l = LESSONS[id];
  const place = cat.placement[id];
  if (!l) { ctx.startPractice(id, 'practice', { skipLesson: true }); return; }
  ctx.setScreen([
    el('nav', { class: 'activity-nav' }, [el('button', { type: 'button', class: 'link', onclick: back, text: '← Back' })]),
    el('article', { class: 'lesson' }, [
      el('p', { class: 'eyebrow', text: [subjectName(o.subject), STRANDS[o.strand], place?.grades?.length ? place.grades.map(gradeLabel).join(', ') : null].filter(Boolean).join(' · ') }),
      el('h2', { id: 'lesson-title', tabindex: '-1', text: ctx.L(o.label) }),
      el('p', { class: 'lesson-goal' }, [el('strong', { text: 'You will be able to: ' }), o.goal]),
      el('p', { class: 'lesson-intro', text: ctx.L(l.intro) }),
      el('ul', { class: 'lesson-ideas' }, l.ideas.map((t) => el('li', { text: ctx.L(t) }))),
      el('section', { class: 'worked', 'aria-labelledby': 'worked-h' }, [
        el('h3', { id: 'worked-h', text: 'Worked example' }),
        el('p', { class: 'worked-problem', text: ctx.L(l.example.problem) }),
        el('ol', { class: 'worked-steps' }, l.example.steps.map((t) => el('li', { text: ctx.L(t) }))),
        el('p', { class: 'worked-answer' }, [el('strong', { text: 'Answer: ' }), ctx.L(l.example.answer)]),
      ]),
      el('p', { class: 'lesson-watch' }, [el('strong', { text: 'Watch out for: ' }), ctx.L(l.watch)]),
      place?.standards?.length ? el('p', { class: 'muted small', text: `Related standards: ${place.standards.map((s) => `${s.code}${s.fit === 'partial' ? ' (part)' : ''}`).join(', ')}.` }) : null,
      el('div', { class: 'cta-row left' }, [
        el('button', { type: 'button', class: 'btn btn-red', onclick: () => ctx.startPractice(id, 'practice', { skipLesson: true }), text: 'Start practice' }),
        el('button', { type: 'button', class: 'btn btn-line', onclick: () => renderAsk(ctx, id), text: 'Ask Red Teddy about this' }),
      ]),
    ]),
  ], '#lesson-title');
  ctx.say(`${o.label}. ${l.intro}`);
}

// ---------- Ask Red Teddy ----------
// A tutoring session about one topic. The conversation lives only in memory for
// this visit; nothing typed is stored. Signed-in families only, ages 5 and up.
const askSession = { objective: null, log: [], busy: false, lastError: null };

export function renderAsk(ctx, objective = askSession.objective) {
  const state = ctx.state();
  const signedIn = Boolean(ctx.remote()?.profile);
  const near = new Set();
  const i = BANDS.indexOf(state.settings.band);
  for (const b of BANDS.slice(Math.max(0, i - 1), i + 2)) Object.keys(OBJECTIVES).filter((id) => OBJECTIVES[id].bands.includes(b)).forEach((id) => near.add(id));
  const choices = [...near].sort((a, b) => OBJECTIVES[a].subject.localeCompare(OBJECTIVES[b].subject) || OBJECTIVES[a].order - OBJECTIVES[b].order);
  if (!objective || !OBJECTIVES[objective]) objective = choices[0];
  if (askSession.objective !== objective) { askSession.objective = objective; askSession.log = []; askSession.lastError = null; }

  const topic = el('select', { id: 'ask-topic', class: 'field', onchange: (e) => renderAsk(ctx, e.target.value) },
    Object.keys(SUBJECTS).map((s) => {
      const ids = choices.filter((id) => OBJECTIVES[id].subject === s);
      return ids.length ? el('optgroup', { label: subjectName(s) }, ids.map((id) => el('option', { value: id, text: ctx.L(OBJECTIVES[id].label), selected: id === objective }))) : null;
    }).filter(Boolean));

  const send = (message) => askTurn(ctx, objective, message);
  const log = el('div', { class: 'ask-log', 'aria-live': 'polite' }, askSession.log.length
    ? askSession.log.map((m) => el('div', { class: `help-msg ${m.role}` }, [
      el('span', { class: 'help-who', text: m.role === 'tutor' ? 'Red Teddy (AI tutor)' : m.role === 'note' ? '' : 'You' }),
      el('p', { class: 'ask-text', text: m.text }),
      m.followUp ? el('p', { class: 'help-follow' }, [el('strong', { text: 'Try this: ' }), m.followUp]) : null,
    ]))
    : [el('p', { class: 'muted', text: 'Ask anything about this topic: what something means, another example, or a practice question.' })]);

  const form = el('form', { class: 'ask-form', onsubmit: (e) => {
    e.preventDefault();
    const box = e.target.querySelector('textarea');
    const text = box.value.trim();
    if (text) { box.value = ''; send(text); }
  } }, [
    el('label', { class: 'sr-only', for: 'ask-text', text: 'Your question' }),
    el('textarea', { id: 'ask-text', class: 'field', rows: 3, maxlength: 300, placeholder: 'Type your question…', disabled: !signedIn || undefined,
      onkeydown: (e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); e.target.form.requestSubmit(); } } }),
    el('button', { type: 'submit', class: 'btn btn-red', disabled: !signedIn || askSession.busy || undefined, text: askSession.busy ? 'Thinking…' : 'Ask' }),
  ]);

  ctx.setScreen([
    el('nav', { class: 'activity-nav' }, [el('button', { type: 'button', class: 'link', onclick: () => ctx.renderHome(), text: '← Back to my plan' })]),
    el('div', { class: 'ask' }, [
      el('div', { class: 'ask-head' }, [
        el('img', { src: '/learn/game/art/teddy-think.webp', width: 72, height: 148, alt: '', class: 'ask-teddy' }),
        el('div', {}, [
          el('p', { class: 'eyebrow', text: 'Ask Red Teddy' }),
          el('h2', { id: 'ask-title', tabindex: '-1', text: 'What would you like help with?' }),
          el('p', { class: 'muted', text: 'Red Teddy explains, gives examples and asks you questions. He helps you work it out rather than doing the work for you, and he can make mistakes: check with your teacher if something seems off.' }),
          ctx.meetLink ? ctx.meetLink() : null,
        ]),
      ]),
      el('label', { class: 'field-row' }, [el('span', { class: 'field-label', text: 'Topic' }), topic]),
      el('div', { class: 'cta-row left ask-links' }, [
        LESSONS[objective] ? el('button', { type: 'button', class: 'btn btn-line', onclick: () => renderLesson(ctx, objective, () => renderAsk(ctx, objective)), text: 'Read the lesson' }) : null,
        el('button', { type: 'button', class: 'btn btn-line', onclick: () => ctx.startPractice(objective, 'practice', { skipLesson: true }), text: 'Practice this' }),
      ]),
      signedIn ? null : el('p', { class: 'notice-box' }, ['Red Teddy’s answers need a parent to sign in, so usage stays within the family’s daily limit. ', el('a', { href: '/learn/account.html', text: 'Parent sign-in' }), '. Lessons and practice work without an account.']),
      el('div', { class: 'ask-suggest', role: 'group', 'aria-label': 'Suggested questions' }, ASK_PROMPTS.map((q) => el('button', {
        type: 'button', class: 'chip-btn', disabled: !signedIn || askSession.busy || undefined, onclick: () => send(q), text: q,
      }))),
      log,
      askSession.lastError ? el('div', { class: 'ask-error' }, [
        el('p', { text: askSession.lastError.text }),
        askSession.lastError.retry ? el('button', { type: 'button', class: 'btn btn-line', onclick: () => send(askSession.lastError.message, true), text: 'Try again' }) : null,
      ]) : null,
      form,
    ]),
  ], '#ask-title');
}

async function askTurn(ctx, objective, message, retry = false) {
  if (askSession.busy) return;
  if (!retry) askSession.log.push({ role: 'learner', text: message });
  askSession.busy = true;
  askSession.lastError = null;
  renderAsk(ctx, objective);
  const history = askSession.log.filter((m) => m.role === 'learner' || m.role === 'tutor').slice(-7, -1).map((m) => ({ role: m.role, text: m.text }));
  const l = LESSONS[objective];
  const result = await askTutor(ctx.storage, {
    profileId: ctx.remote()?.profile?.id, objective, mode: 'ask', message, history,
    item: { prompt: OBJECTIVES[objective].label, answer: '', options: [], context: l ? `${l.intro} ${l.ideas.join(' ')}` : OBJECTIVES[objective].goal },
  });
  askSession.busy = false;
  if (askSession.objective !== objective) return;
  if (result.ok) {
    askSession.log.push({ role: result.type === 'safety' ? 'note' : 'tutor', text: result.reply, followUp: result.followUp });
    ctx.say(result.reply);
  } else {
    // Keep the question so it is not lost; offer a retry when it might work.
    const retryable = ['unavailable', 'offline', 'fallback'].includes(result.reason);
    askSession.lastError = { text: retryable ? 'Red Teddy could not answer just now. Your question is still here.' : reasonText(result.reason), retry: retryable, message };
  }
  renderAsk(ctx, objective);
  ctx.focus?.('#ask-text');
}
