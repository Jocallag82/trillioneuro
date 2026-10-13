// The learner app: first-run setup, placement check, today's plan, the learning map,
// every activity type, Teddy's help, and the end-of-activity summary.
//
// Decisions about learning live elsewhere and are only called from here:
//   engine.js      is an answer right, what hint comes next
//   learner.js     what has been shown, what to do next, the placement check
//   curriculum/*   what is taught and how practice is generated
import { ACTIVITIES, DOMAINS, LEVEL_NAMES } from './content.js';
import { startSession, submit, respond, grade, placeItem, placeCard, summarySession, useHelp } from './engine.js';
import { helpFor, styleFor } from './help.js';
import { readState, writeState, recordStep, recordCompletion, updateSettings } from './progress.js';
import { canSpeak, speak, narrate, stopSpeaking } from './speech.js';
import { el, visualNode } from './dom.js';
import { openRemote, syncStep, syncSession, syncSettings } from './sync.js';
import { OBJECTIVES, SUBJECTS, STRANDS, STAGES, BANDS, objectivesFor, bandIndex } from './curriculum/framework.js';
import { practiceActivity } from './curriculum/generators.js';
import { MISCONCEPTIONS } from './curriculum/misconceptions.js';
import { LOCALES, pickLocale, localise, stageName } from './curriculum/locales.js';
import {
  plan, objectiveReport, nextDifficulty, rampFor, STATE_LABEL, subjectsFor,
  startDiagnostic, diagnosticItem, answerDiagnostic, diagnosticResult,
} from './learner.js';
import { askTutor, itemFor, reasonText } from './tutor.js';
import { mulberry32 } from '../game/js/rng.js';
import { renderCurriculum, renderLesson, renderAsk } from './explore.js';
import { openWelcome, welcomeSeen } from '/welcome-video.js';
import { LESSONS } from './curriculum/lessons.js';
import { US_GRADES, GRADE_BAND, gradeLabel } from './curriculum/grades.js';

const storage = (() => { try { return window.localStorage; } catch { return null; } })();
const app = document.getElementById('app');
const caption = document.getElementById('caption');
const replayBtn = document.getElementById('replay');
const soundBtn = document.getElementById('sound');
const volumeInput = document.getElementById('volume');
const audioBar = document.getElementById('audio-bar');
const audioNote = document.getElementById('audio-note');

let state = readState(storage);
let remote = null; // { session, profile } when a child profile is active and signed in
let current = null; // the activity being played
let session = null; // engine session for it
let purpose = 'library'; // library | practice | review | diagnostic
let spokenLast = '';
let spokenKey = null;
let ui = {}; // per-step interaction state (marker position, picked tiles, counters)
let help = { index: -1, log: [], busy: false }; // Teddy's messages for the current step
let diag = null; // { queue, current, item, rand, results }

const SOURCE = { library: 'library', practice: 'practice', review: 'review', diagnostic: 'diagnostic' };
const KIND_LABEL = { review: 'Review', support: 'Extra practice', continue: 'Keep going', new: 'New', stretch: 'Stretch' };

const locale = () => state.settings.locale || pickLocale(typeof navigator !== 'undefined' ? navigator.languages || [] : []);
const L = (text) => localise(text, locale());
const band = () => state.settings.band;
const stage = () => STAGES[band()];
const isPrimary = () => stage().id === 'primary';
const isOlder = () => ['primary', 'middle', 'high'].includes(stage().id);
const usGrades = () => locale() === 'en-US';
const gradeName = () => (usGrades() && state.settings.grade ? gradeLabel(state.settings.grade) : stageName(band(), locale()));
const tutorAllowed = () => bandIndex(band()) >= 2;
const byId = (id) => ACTIVITIES.find((a) => a.id === id);
const completedIds = () => new Set(state.sessions.map((s) => s.activityId));
const libraryInScope = () => ACTIVITIES.filter((a) => state.settings.showAll || a.band === band());

function persist() {
  if (!writeState(storage, state)) showNotice('Progress could not be saved on this device. You can keep playing.');
}

function showNotice(text) {
  const n = document.getElementById('notice');
  if (n) n.textContent = text;
}

// Every spoken line is also shown as a caption. Speech runs only after a tap.
function say(text, clipKey = null) {
  spokenLast = text;
  spokenKey = clipKey;
  caption.textContent = text;
  if (!state.settings.audio) return;
  if (clipKey) narrate(clipKey, text, { volume: state.settings.volume });
  else speak(text, { volume: state.settings.volume });
}

function setScreen(nodes, focusSelector) {
  app.replaceChildren(...[].concat(nodes).filter(Boolean));
  document.body.dataset.stage = stage().id;
  const target = focusSelector ? app.querySelector(focusSelector) : app;
  if (target) target.focus({ preventScroll: false });
}

function teddy(cls = '') {
  return el('img', { src: '/teddy-mark.webp', width: 64, height: 64, alt: '', class: `teddy ${cls}`.trim() });
}

// A quiet way to watch Red Teddy's 10-second hello. Never plays by itself.
function meetLink() {
  return el('button', { type: 'button', class: 'meet-link', onclick: (e) => openWelcome(e.currentTarget) }, [
    el('span', { class: 'meet-link-play', 'aria-hidden': 'true' }),
    welcomeSeen() ? 'Watch Red Teddy’s hello again' : 'New here? Meet Red Teddy (10-second video)',
  ]);
}

// What the curriculum, lesson and Ask Red Teddy screens need from the app.
const ctx = {
  state: () => state, remote: () => remote, storage, L, say,
  setScreen: (nodes, focus) => setScreen(nodes, focus),
  renderHome: () => renderHome(),
  startPractice: (id, why, opts) => startPractice(id, why, opts),
  focus: (sel) => app.querySelector(sel)?.focus(),
  meetLink: () => meetLink(),
};

function saveSettings(patch) {
  state = updateSettings(state, patch);
  persist();
  syncSettings(remote, state.settings).catch(() => showNotice('Saved on this device. It will sync when you are online.'));
}

// ---------- First run ----------
function renderSetup(step = 'age') {
  stopSpeaking();
  if (step === 'age') {
    const loc = el('select', { id: 'locale', class: 'field field-inline', onchange: (e) => { saveSettings({ locale: e.target.value }); renderSetup('age'); } },
      Object.entries(LOCALES).map(([id, l]) => el('option', { value: id, text: l.label, selected: id === locale() })));
    const pickGrade = (g) => { saveSettings({ grade: g, band: GRADE_BAND[g], locale: locale() }); renderSetup(bandIndex(GRADE_BAND[g]) >= 2 ? 'focus' : 'start'); };
    const gradeGrid = el('div', { class: 'grade-grid', role: 'group', 'aria-label': 'Grade' }, [
      el('button', { type: 'button', class: 'grade-card', onclick: () => { saveSettings({ grade: null, band: '2-3', locale: locale() }); renderSetup('start'); } }, [
        el('span', { class: 'grade-big', text: '2–3' }), el('span', { class: 'band-note', text: 'Toddler, with a grown-up' })]),
      ...US_GRADES.map((g) => el('button', {
        type: 'button', class: `grade-card${g === state.settings.grade && state.settings.onboarded ? ' is-current' : ''}`, onclick: () => pickGrade(g),
      }, [
        el('span', { class: 'grade-big', text: g === 'PK' ? 'Pre-K' : g }),
        el('span', { class: 'band-note', text: g === 'PK' ? 'Preschool' : g === 'K' ? 'Kindergarten' : Number(g) <= 5 ? 'Elementary' : Number(g) <= 8 ? 'Middle school' : 'High school' }),
      ])),
    ]);
    setScreen([
      el('div', { class: 'setup' }, [
        el('p', { class: 'eyebrow', text: 'Getting started' }),
        el('h2', { id: 'setup-title', tabindex: '-1', text: usGrades() ? 'What grade is the learner in?' : 'Who is learning today?' }),
        meetLink(),
        el('p', { class: 'lead', text: usGrades()
          ? 'Pick the school grade. It sets the starting point, the curriculum shown and how the screens look. It is not a measure of ability, and you can change it any time.'
          : 'Choose an age. It sets the starting point and how the screens look. It is not a measure of ability, and you can change it any time.' }),
        usGrades() ? gradeGrid : el('div', { class: 'band-grid', role: 'group', 'aria-label': 'Age' }, BANDS.map((b) => el('button', {
          type: 'button', class: `band-card${b === band() && state.settings.onboarded ? ' is-current' : ''}`,
          onclick: () => { saveSettings({ band: b, locale: locale() }); renderSetup(bandIndex(b) >= 2 ? 'focus' : 'start'); },
        }, [
          el('span', { class: 'band-age', text: `Age ${b.replace('-', '–')}` }),
          el('span', { class: 'band-name', text: stageName(b, locale()) }),
          el('span', { class: 'band-note', text: STAGES[b].supervised ? 'With a grown-up' : STAGES[b].reading === 'independent' ? 'Reads on their own' : 'Early reader' }),
        ]))),
        el('label', { class: 'field-row' }, [el('span', { class: 'field-label', text: 'Country (changes grade names and spellings)' }), loc]),
        el('p', { class: 'muted small', text: usGrades()
          ? 'Skills are mapped to related Common Core and NGSS standards where they exist. No state’s own standards have been checked yet.'
          : 'Activities are written for these ages. They are not yet matched to this country’s official curriculum.' }),
      ]),
    ], '#setup-title');
    say(usGrades() ? 'What grade is the learner in?' : 'Who is learning today? Choose an age.');
    return;
  }
  if (step === 'focus') {
    const older = bandIndex(band()) >= 5;
    const choices = [['maths', L('Maths'), older ? 'Algebra, geometry, statistics and more' : 'Number, calculation, fractions, shape and measuring'],
      ['literacy', usGrades() ? 'English' : 'Reading & words', older ? 'Grammar, vocabulary, literature and argument' : 'Letters, sounds, building words and sentences'],
      ...(bandIndex(band()) >= 3 ? [['science', 'Science', 'Life, physical, and Earth and space science'], ['social', usGrades() ? 'Social studies' : 'History & society', 'Government, history, geography and economics']] : []),
      ...(older ? [['computing', 'Computer science', 'Reading and tracing code']] : []),
      ['all', 'A bit of everything', older ? 'Every subject' : L('Maths') + ', reading and thinking skills']];
    setScreen([
      el('div', { class: 'setup' }, [
        el('button', { type: 'button', class: 'link', onclick: () => renderSetup('age'), text: '← Back' }),
        el('p', { class: 'eyebrow', text: 'Getting started' }),
        el('h2', { id: 'setup-title', tabindex: '-1', text: 'What would you like to work on?' }),
        el('div', { class: 'focus-list' }, choices.map(([id, title, note]) => el('button', {
          type: 'button', class: 'focus-card', onclick: () => { saveSettings({ focus: id }); renderSetup('start'); },
        }, [el('strong', { text: title }), el('span', { text: note })]))),
      ]),
    ], '#setup-title');
    say('What would you like to work on?');
    return;
  }
  // 'start'
  if (!stage().diagnostic) {
    saveSettings({ onboarded: true, focus: 'all' });
    renderHome();
    return;
  }
  setScreen([
    el('div', { class: 'setup' }, [
      el('p', { class: 'eyebrow', text: 'Getting started' }),
      el('h2', { id: 'setup-title', tabindex: '-1', text: 'Find the right starting point' }),
      el('p', { class: 'lead', text: 'A quick check of up to seven questions per subject, about two minutes. It moves up when an answer is right and down when it is not. No marks are shown.' }),
      el('div', { class: 'cta-row left' }, [
        el('button', { type: 'button', class: 'btn btn-red', onclick: startCheck, text: 'Start the quick check' }),
        el('button', { type: 'button', class: 'btn btn-line', onclick: () => { saveSettings({ onboarded: true }); renderHome(); }, text: 'Skip and start learning' }),
      ]),
      el('p', { class: 'muted small', text: stage().supervised ? 'Best done with a grown-up nearby. Read the questions aloud together if that helps.' : 'If a question is too hard, have a guess. That is useful too.' }),
    ]),
  ], '#setup-title');
  say('Find the right starting point with a quick check, or skip and start learning.');
}

// ---------- Placement check ----------
function startCheck() {
  const focus = state.settings.focus;
  const queue = (focus === 'all' ? ['maths', 'literacy'] : [focus])
    .filter((s) => s !== 'thinking' && subjectsFor(band()).includes(s));
  diag = { queue, current: null, rand: mulberry32((Date.now() >>> 0) ^ 0x5bd1e995), results: [] };
  nextSubject();
}

function nextSubject() {
  const subject = diag.queue.shift();
  if (!subject) return finishCheck();
  diag.current = startDiagnostic(subject, band());
  if (!diag.current) return nextSubject();
  nextCheckItem();
}

function nextCheckItem() {
  const { objective, step } = diagnosticItem(diag.current, diag.rand);
  const o = OBJECTIVES[objective];
  purpose = 'diagnostic';
  current = { id: `dx-${diag.current.subject}`, title: `Quick check: ${L(SUBJECTS[o.subject].label)}`, domain: o.domain, band: band(), level: 2, skill: objective, instruction: '', steps: [step] };
  session = startSession(current, diag.rand);
  ui = {};
  renderStep(false);
}

function checkAnswered(correct, misconception) {
  const step = current.steps[0];
  state = recordStep(state, current.id, current.skill, correct, Date.now(), {
    correct, hints: 0, difficulty: step.difficulty || 2, misconception: correct ? null : misconception, source: 'diagnostic',
  });
  syncStep(storage, remote, state.steps[state.steps.length - 1]);
  persist();
  diag.current = answerDiagnostic(diag.current, correct);
  const fb = document.getElementById('feedback');
  app.querySelectorAll('.option, .answer-controls button, .answer-controls input').forEach((b) => { b.disabled = true; });
  const message = 'Thanks. On to the next one.';
  fb.replaceChildren(el('p', { class: 'fb fb-neutral', text: message }));
  say(message);
  setTimeout(() => {
    if (diag.current.done) {
      diag.results.push(diagnosticResult(diag.current));
      nextSubject();
    } else nextCheckItem();
  }, 900);
}

function finishCheck() {
  const placement = { ...state.settings.placement };
  const assumed = new Set(state.settings.assumed);
  for (const r of diag.results) {
    placement[r.subject] = r.start;
    r.assumed.forEach((id) => assumed.add(id));
  }
  saveSettings({ placement, assumed: [...assumed], onboarded: true });
  const results = diag.results;
  diag = null;
  purpose = 'library';
  setScreen([
    el('div', { class: 'setup' }, [
      teddy('teddy-large'),
      el('h2', { id: 'setup-title', tabindex: '-1', text: 'All done. Here is where to start.' }),
      results.length ? el('ul', { class: 'result-list' }, results.map((r) => el('li', {}, [
        el('strong', { text: L(SUBJECTS[r.subject].label) }),
        el('span', { text: ` Starting with ${OBJECTIVES[r.start].label.toLowerCase()}.` }),
        r.assumed.length ? el('span', { class: 'muted', text: ` ${r.assumed.length} earlier ${r.assumed.length === 1 ? 'skill is' : 'skills are'} treated as probably known for now.` }) : null,
      ]))) : el('p', { text: 'There was nothing to check for this age yet.' }),
      el('p', { class: 'muted', text: 'This is a starting point from a few answers, not a test result. Skills marked “probably known” have no answers behind them yet. They come back in reviews, and the plan adjusts as real answers come in.' }),
      el('div', { class: 'cta-row left' }, [el('button', { type: 'button', class: 'btn btn-red', onclick: () => renderHome(), text: 'See today’s plan' })]),
    ]),
  ], '#setup-title');
  say('All done. Here is where to start.');
}

// ---------- Home ----------
function renderHome(focusSelector = '#home-title') {
  purpose = 'library';
  stopSpeaking();
  const now = Date.now();
  const today = plan(state, now, 4);
  const who = remote?.profile?.nickname;

  const planList = today.length
    ? el('ol', { class: 'plan' }, today.map((p, i) => el('li', { class: `plan-item${i === 0 ? ' is-first' : ''}` }, [
      el('div', { class: 'plan-text' }, [
        el('span', { class: `tag tag-${p.kind}`, text: KIND_LABEL[p.kind] }),
        el('strong', { class: 'plan-title', text: p.label }),
        el('span', { class: 'plan-reason', text: p.reason }),
      ]),
      el('button', { type: 'button', class: i === 0 ? 'btn btn-red' : 'btn btn-line', dataset: { objective: p.objective },
        onclick: () => startPractice(p.objective, p.kind === 'review' ? 'review' : 'practice'), text: i === 0 ? 'Start' : 'Practice' }),
    ])))
    : el('p', { class: 'muted', text: 'Nothing is planned for this focus yet. Try another focus or age in settings.' });

  const lib = libraryInScope();
  const done = completedIds();
  const libraryGroups = DOMAINS.map((domain) => {
    const items = lib.filter((a) => a.domain === domain);
    if (!items.length) return null;
    return el('section', { class: 'domain', 'aria-labelledby': `d-${slug(domain)}` }, [
      el('h4', { id: `d-${slug(domain)}`, text: L(domain) }),
      el('ul', { class: 'cards' }, items.map((a) => el('li', {}, [
        el('button', { type: 'button', class: 'card', onclick: () => startLibrary(a.id) },
          cardBody(a, `${LEVEL_NAMES[a.level]} · ${done.has(a.id) ? 'Done' : 'New'}`)),
      ]))),
    ]);
  }).filter(Boolean);

  setScreen([
    el('section', { class: 'hero-banner' }, [
      teddy('teddy-hero'),
      el('div', {}, [
        el('p', { class: 'eyebrow', text: usGrades() && state.settings.grade ? gradeName() : `${stageName(band(), locale())} · Age ${band().replace('-', '–')}` }),
        el('h2', { id: 'home-title', tabindex: '-1', text: who ? `${who}’s plan for today` : 'Today’s plan' }),
        el('p', { class: 'hero-copy', text: isPrimary()
          ? 'Short practice sets that adapt to your answers. Do the first one, then pick what you like.'
          : 'A few short activities chosen from what has been tried so far.' }),
      ]),
    ]),
    isOlder() || usGrades() ? el('div', { class: 'home-tools' }, [
      el('button', { type: 'button', class: 'tool-btn', onclick: () => renderCurriculum(ctx) }, [el('strong', { text: 'Browse the curriculum' }), el('span', { text: 'Every skill by grade and subject' })]),
      tutorAllowed() ? el('button', { type: 'button', class: 'tool-btn', onclick: () => renderAsk(ctx) }, [el('strong', { text: 'Ask Red Teddy' }), el('span', { text: 'Help with any topic' })]) : null,
    ]) : null,
    remote?.profile
      ? el('p', { class: 'learning-as' }, ['Learning as ', el('strong', { text: remote.profile.nickname }), ' · ', el('a', { href: '/learn/account.html', text: 'Change profile' })])
      : el('p', { class: 'learning-as muted' }, ['Saved on this device. ', el('a', { href: '/learn/account.html', text: 'Sign in to sync and use Teddy’s explanations' })]),
    el('section', { class: 'panel', 'aria-labelledby': 'plan-h' }, [
      el('h3', { id: 'plan-h', text: 'Up next' }),
      planList,
      el('p', { class: 'muted small', text: 'Chosen from recorded answers: reviews that are due, mix-ups worth fixing, then new skills whose foundations are in place.' }),
    ]),
    mapSection(now),
    libraryGroups.length ? el('section', { class: 'library', 'aria-labelledby': 'lib-h' }, [
      el('h3', { id: 'lib-h', text: isPrimary() ? 'Early-years activities' : 'Activities' }),
      ...libraryGroups,
    ]) : null,
    el('div', { class: 'settings-row' }, [
      el('button', { type: 'button', class: 'btn btn-line', onclick: () => renderSetup('age'), text: 'Change age or focus' }),
      stage().diagnostic ? el('button', { type: 'button', class: 'btn btn-line', onclick: startCheck, text: 'Redo the quick check' }) : null,
      el('label', { class: 'check' }, [
        el('input', { type: 'checkbox', id: 'show-all', checked: state.settings.showAll, onchange: (e) => { saveSettings({ showAll: e.target.checked }); renderHome('#show-all'); } }),
        el('span', { text: 'Show activities for every age' }),
      ]),
    ]),
    el('p', { class: 'privacy', text: remote?.profile
      ? 'Answers are saved to your account so a parent can see progress. Nothing typed to Teddy is stored.'
      : 'No account needed. Progress is saved only on this device. Clear it any time in the parent view.' }),
  ], focusSelector);
  say(today[0] ? `Up next: ${today[0].label}.` : 'Choose an activity.');
}

const STATE_SHORT = { 'not-started': 'Not started', assumed: 'Probably known', 'getting-started': 'Started', 'needs-support': 'Needs practice', developing: 'Coming along', secure: 'Secure' };

function mapSection(now) {
  const focus = state.settings.focus;
  const ids = objectivesFor(band(), 1).filter((id) => focus === 'all' || OBJECTIVES[id].subject === focus);
  const subjects = Object.keys(SUBJECTS).filter((s) => ids.some((id) => OBJECTIVES[id].subject === s));
  if (!subjects.length) return null;
  return el('section', { class: 'panel map', 'aria-labelledby': 'map-h' }, [
    el('h3', { id: 'map-h', text: 'Learning map' }),
    el('p', { class: 'muted small', text: 'Every skill for this age, and how it is going. Pick any one to practise.' }),
    ...subjects.map((s, i) => el('details', { class: 'map-subject', open: i === 0 || undefined }, [
      el('summary', { text: L(SUBJECTS[s].label) }),
      ...SUBJECTS[s].strands.map((strand) => {
        const inStrand = ids.filter((id) => OBJECTIVES[id].subject === s && OBJECTIVES[id].strand === strand)
          .sort((a, b) => OBJECTIVES[a].order - OBJECTIVES[b].order);
        if (!inStrand.length) return null;
        return el('div', { class: 'strand' }, [
          el('h4', { text: STRANDS[strand] }),
          el('ul', { class: 'skills' }, inStrand.map((id) => {
            const r = objectiveReport(state, id, now);
            const evidence = r.mastery.attempts ? `${r.mastery.attempts} ${r.mastery.attempts === 1 ? 'answer' : 'answers'}` : '';
            return el('li', { class: `skill state-${r.state}` }, [
              el('span', { class: 'dot', 'aria-hidden': 'true' }),
              el('span', { class: 'skill-name', text: L(OBJECTIVES[id].label) }),
              el('span', { class: 'skill-meta', text: [STATE_SHORT[r.state], evidence, r.retention.due ? 'review due' : ''].filter(Boolean).join(' · ') }),
              el('span', { class: 'skill-actions' }, [
                LESSONS[id] ? el('button', { type: 'button', class: 'link', 'aria-label': `Lesson: ${OBJECTIVES[id].label}`, onclick: () => renderLesson(ctx, id), text: 'Lesson' }) : null,
                el('button', { type: 'button', class: 'link', 'aria-label': `Practice ${OBJECTIVES[id].label}`, onclick: () => startPractice(id, r.retention.due ? 'review' : 'practice', { skipLesson: true }), text: 'Practice' }),
              ]),
            ]);
          })),
        ]);
      }),
    ])),
  ]);
}

// A card shows a small preview of the activity's first picture, so it reads at a glance.
function cardBody(a, meta) {
  const first = a.steps[0];
  const preview = first.visual || first.options?.[0]?.visual || first.items?.[0]?.visual || first.cards?.[0]?.visual || null;
  return [
    el('span', { class: 'card-preview', 'aria-hidden': 'true' }, visualNode(preview)),
    el('span', { class: 'card-title', text: a.title }),
    el('span', { class: 'card-meta', text: meta }),
  ];
}

const slug = (d) => d.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');

// ---------- Starting things ----------
function startLibrary(id) {
  purpose = 'library';
  begin(byId(id));
}

// A skill the learner has never answered starts with its lesson, when there is one.
function startPractice(objective, why = 'practice', { skipLesson = false } = {}) {
  const report = objectiveReport(state, objective, Date.now());
  if (!skipLesson && why !== 'review' && LESSONS[objective] && report.mastery.attempts === 0 && bandIndex(band()) >= 3) {
    renderLesson(ctx, objective);
    return;
  }
  const d = nextDifficulty(report, band());
  purpose = why;
  begin(practiceActivity(objective, why === 'review' ? [d, d, d] : rampFor(d), (Date.now() ^ (Math.random() * 1e9)) >>> 0, why === 'review' ? 3 : 5, why));
}

function begin(activity) {
  current = activity;
  session = startSession(current);
  ui = {};
  help = { index: -1, log: [], busy: false };
  renderStep(true);
}

// ---------- Activity ----------
let selectedItem = null;
let dragItem = null;

// viewState lets a finished step be drawn from its last in-progress state.
function renderStep(intro = false, viewState = session) {
  const step = current.steps[viewState.index];
  const total = current.steps.length;
  if (help.index !== viewState.index) help = { index: viewState.index, log: [], busy: false };
  const diagnostic = purpose === 'diagnostic';
  const label = diagnostic
    ? `Question ${diag.current.asked + 1} of up to ${diag.current.max}`
    : `Question ${viewState.index + 1} of ${total}`;

  setScreen([
    el('nav', { class: 'activity-nav' }, [
      el('button', { type: 'button', class: 'link', onclick: () => { diag = null; renderHome(); }, text: diagnostic ? '← Stop the check' : '← Back to plan' }),
    ]),
    el('div', { class: 'progress-row' }, [
      el('p', { class: 'step-count', text: label }),
      diagnostic ? null : el('progress', { max: total, value: viewState.index, 'aria-label': 'Activity progress' }),
    ]),
    el('h2', { id: 'prompt', tabindex: '-1', text: current.generated ? `${current.purpose === 'review' ? 'Review' : 'Practice'}: ${L(current.title)}` : L(current.title) }),
    el('p', { class: 'prompt', text: L(step.prompt) }),
    !diagnostic && viewState === session ? workItOut(step) : null,
    bodyFor(step, viewState),
    el('div', { id: 'feedback', class: 'feedback', role: 'status', 'aria-live': 'polite' }),
    !diagnostic && tutorAllowed() && remote?.profile ? helpPanel(step, viewState) : null,
  ], '#prompt');

  const words = step.listen && step.say ? `${step.prompt}` : step.prompt;
  if (intro && current.instruction) say(`${current.instruction} ${words}`);
  else say(words, current.generated || diagnostic ? null : `${current.id}-${viewState.index}`);
}

function bodyFor(step, viewState) {
  if (step.kind === 'drop') return dropBody(step, viewState.drop);
  if (step.kind === 'memory') return memoryBody(step, viewState.memory, viewState.order?.[viewState.index]);
  if (step.kind === 'input') return inputBody(step);
  if (step.kind === 'numberline') return lineBody(step);
  if (step.kind === 'order') return orderBody(step);
  if (step.kind === 'build') return buildBody(step);
  return choiceBody(step);
}

// The picture or text above the answers. Reading passages follow the chosen
// country's spelling, like every other word on screen.
function stageFor(v) {
  if (!v) return null;
  const shown = v.kind === 'passage' ? { ...v, title: L(v.title), text: L(v.text) } : v;
  return el('div', { class: `stage${v.kind === 'passage' ? ' stage-text' : ''}` }, visualNode(shown));
}

// When every option is a picture, the picture is the answer: a caption such as
// "3 dots" or "triangle" would let a reader skip the skill. The caption then
// becomes the button's accessible name only.
function choiceBody(step) {
  const pictorial = step.options.every((o) => o.visual);
  const options = step.options.map((opt) => el('button', {
    type: 'button', class: 'option', dataset: { option: opt.id }, onclick: () => choose(opt.id),
    'aria-label': pictorial ? L(opt.label) : undefined,
  }, [
    opt.visual ? el('span', { class: 'option-visual', 'aria-hidden': pictorial ? 'true' : undefined }, visualNode(opt.visual)) : null,
    pictorial ? null : el('span', { class: 'option-label', text: L(opt.label) }),
  ]));
  const long = step.options.some((o) => String(o.label).length > 18);
  return el('div', { class: 'choice-body' }, [
    step.listen ? el('button', { type: 'button', class: 'btn btn-line play', onclick: () => say(step.prompt), text: 'Hear the question' }) : null,
    stageFor(step.visual),
    el('div', { class: `options${long ? ' long' : step.options.length === 2 ? ' two' : ''}`, role: 'group', 'aria-label': 'Answers' }, options),
  ]);
}

// Typed answer. Numbers bring up the number keyboard on phones.
function inputBody(step) {
  const numeric = /^-?\d+$/.test(step.answer);
  const field = el('input', {
    id: 'answer', class: 'answer-field', type: 'text', inputmode: numeric ? 'numeric' : 'text', autocomplete: 'off',
    'aria-label': 'Your answer', maxlength: 8, value: ui.text || '', disabled: ui.locked || undefined,
    oninput: (e) => { ui.text = e.target.value; },
  });
  return el('div', { class: 'choice-body' }, [
    stageFor(step.visual),
    el('form', { class: 'answer-controls', onsubmit: (e) => { e.preventDefault(); answer(field.value, field.value); } }, [
      field,
      el('button', { type: 'submit', class: 'btn btn-red', disabled: ui.locked || undefined, text: 'Check' }),
    ]),
  ]);
}

// Number line: drag or click the line, or use the arrow keys or the − and + buttons.
function lineBody(step) {
  if (ui.line === undefined) ui.line = step.min;
  const span = step.max - step.min;
  const W = 600; const pad = 30; const unit = (W - pad * 2) / span;
  const xOf = (v) => pad + (v - step.min) * unit;
  const fmt = (v) => (step.denominator ? (v === 0 ? '0' : v === step.denominator ? '1' : `${v}/${step.denominator}`) : String(v));
  const svgNS = 'http://www.w3.org/2000/svg';
  const mk = (tag, attrs) => { const n = document.createElementNS(svgNS, tag); for (const [k, v] of Object.entries(attrs)) n.setAttribute(k, v); return n; };
  const s = mk('svg', { viewBox: `0 0 ${W} 110`, class: 'line-svg', 'aria-hidden': 'true' });
  s.append(mk('line', { x1: pad, x2: W - pad, y1: 60, y2: 60, stroke: 'currentColor', 'stroke-width': 3 }));
  for (let v = step.min; v <= step.max; v++) {
    const labelled = (v - step.min) % (step.labelEvery || 1) === 0 || v === step.max;
    s.append(mk('line', { x1: xOf(v), x2: xOf(v), y1: labelled ? 46 : 52, y2: labelled ? 74 : 68, stroke: 'currentColor', 'stroke-width': labelled ? 3 : 2 }));
    if (labelled) {
      const t = mk('text', { x: xOf(v), y: 98, 'text-anchor': 'middle', 'font-size': 18, fill: 'currentColor' });
      t.textContent = fmt(v);
      s.append(t);
    }
  }
  const marker = mk('g', { class: 'marker' });
  marker.append(mk('polygon', { points: `${xOf(ui.line) - 13},14 ${xOf(ui.line) + 13},14 ${xOf(ui.line)},40`, fill: 'var(--red)' }));
  marker.append(mk('line', { x1: xOf(ui.line), x2: xOf(ui.line), y1: 38, y2: 60, stroke: 'var(--red)', 'stroke-width': 3 }));
  s.append(marker);

  const set = (v) => {
    if (ui.locked) return;
    ui.line = Math.min(step.max, Math.max(step.min, v));
    const box = app.querySelector('.line-wrap');
    if (box) box.replaceWith(lineBody(step));
    app.querySelector('.line-slider')?.focus();
  };
  const fromPointer = (e) => {
    const r = s.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W;
    return Math.round((x - pad) / unit) + step.min;
  };
  s.addEventListener('pointerdown', (e) => { if (ui.locked) return; s.setPointerCapture?.(e.pointerId); set(fromPointer(e)); });

  return el('div', { class: 'line-wrap' }, [
    el('div', {
      class: 'line-slider', role: 'slider', tabindex: ui.locked ? '-1' : '0', 'aria-label': 'Marker on the number line',
      'aria-valuemin': step.min, 'aria-valuemax': step.max, 'aria-valuenow': ui.line, 'aria-valuetext': fmt(ui.line),
      onkeydown: (e) => {
        const d = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
        if (d) { e.preventDefault(); set(ui.line + d); }
        if (e.key === 'Home') { e.preventDefault(); set(step.min); }
        if (e.key === 'End') { e.preventDefault(); set(step.max); }
        if (e.key === 'Enter') { e.preventDefault(); answer(ui.line, fmt(ui.line)); }
      },
    }, [s]),
    el('div', { class: 'answer-controls' }, [
      el('button', { type: 'button', class: 'btn btn-line step-btn', 'aria-label': 'Move left', disabled: ui.locked || undefined, onclick: () => set(ui.line - 1), text: '−' }),
      el('output', { class: 'line-value', 'aria-live': 'polite', text: fmt(ui.line) }),
      el('button', { type: 'button', class: 'btn btn-line step-btn', 'aria-label': 'Move right', disabled: ui.locked || undefined, onclick: () => set(ui.line + 1), text: '+' }),
      el('button', { type: 'button', class: 'btn btn-red', disabled: ui.locked || undefined, onclick: () => answer(ui.line, fmt(ui.line)), text: 'Check' }),
    ]),
  ]);
}

// Arrange tiles: tap a tile to add it to the answer, tap it again in the answer to take it back.
function orderBody(step) {
  if (!ui.picked) ui.picked = [];
  const byTile = Object.fromEntries(step.tiles.map((t) => [t.id, t]));
  const left = step.tiles.filter((t) => !ui.picked.includes(t.id));
  const refresh = () => { app.querySelector('.order-wrap').replaceWith(orderBody(step)); };
  const tight = step.joiner === '';
  return el('div', { class: 'order-wrap' }, [
    step.listen && step.say ? el('button', { type: 'button', class: 'btn btn-line play', onclick: () => say(step.say), text: 'Hear the word' }) : null,
    el('div', { class: `order-answer${tight ? ' tight' : ''}`, role: 'group', 'aria-label': 'Your answer' },
      ui.picked.length ? ui.picked.map((id, i) => el('button', {
        type: 'button', class: 'tile-btn placed-tile', disabled: ui.locked || undefined,
        'aria-label': `${byTile[id].label}, position ${i + 1}. Tap to take back`,
        onclick: () => { ui.picked = ui.picked.filter((x) => x !== id); refresh(); app.querySelector('.order-tray .tile-btn, .order-answer .tile-btn')?.focus(); },
        text: byTile[id].label,
      })) : [el('span', { class: 'order-empty', text: tight ? 'Tap the letters in order' : 'Tap the words in order' })]),
    el('div', { class: 'order-tray', role: 'group', 'aria-label': 'Tiles to use' }, left.map((t) => el('button', {
      type: 'button', class: 'tile-btn', disabled: ui.locked || undefined,
      onclick: () => { ui.picked = [...ui.picked, t.id]; refresh(); (app.querySelector('.order-tray .tile-btn') || app.querySelector('#order-check'))?.focus(); },
      text: t.label,
    }))),
    el('div', { class: 'answer-controls' }, [
      el('button', { type: 'button', class: 'btn btn-line', disabled: ui.locked || !ui.picked.length || undefined, onclick: () => { ui.picked = []; refresh(); }, text: 'Start again' }),
      el('button', { type: 'button', id: 'order-check', class: 'btn btn-red', disabled: ui.locked || left.length > 0 || undefined,
        onclick: () => answer([...ui.picked], ui.picked.map((id) => byTile[id].label).join(tight ? '' : ' ')), text: 'Check' }),
    ]),
  ]);
}

// Ten frame: tap an empty square to add a counter, tap one you added to take it away.
function buildBody(step) {
  if (ui.count === undefined) ui.count = step.start;
  const refresh = () => { app.querySelector('.build-wrap').replaceWith(buildBody(step)); app.querySelector('.build-plus')?.focus(); };
  const cells = Array.from({ length: step.capacity }, (_, i) => {
    const fixed = i < step.start;
    const on = i < ui.count;
    return el('button', {
      type: 'button', class: `cell${on ? ' on' : ''}${fixed ? ' fixed' : ''}`, disabled: fixed || ui.locked || undefined,
      'aria-label': fixed ? 'Counter already there' : on ? 'Counter. Tap to take away' : 'Empty. Tap to add a counter',
      onclick: () => { ui.count = on ? Math.max(step.start, ui.count - 1) : Math.min(step.capacity, ui.count + 1); refresh(); },
    });
  });
  return el('div', { class: 'build-wrap' }, [
    el('div', { class: 'visual-tenframe build', role: 'group', 'aria-label': `Ten frame, ${ui.count} counters` }, cells),
    el('div', { class: 'answer-controls' }, [
      el('button', { type: 'button', class: 'btn btn-line step-btn', 'aria-label': 'Take one away', disabled: ui.locked || ui.count <= step.start || undefined, onclick: () => { ui.count -= 1; refresh(); }, text: '−' }),
      el('output', { class: 'line-value', 'aria-live': 'polite', text: String(ui.count) }),
      el('button', { type: 'button', class: 'btn btn-line step-btn build-plus', 'aria-label': 'Add one', disabled: ui.locked || ui.count >= step.capacity || undefined, onclick: () => { ui.count += 1; refresh(); }, text: '+' }),
      el('button', { type: 'button', class: 'btn btn-red', disabled: ui.locked || undefined, onclick: () => answer(ui.count, String(ui.count)), text: 'Check' }),
    ]),
  ]);
}

// Memory board. Cards are face down unless flipped or matched.
function memoryBody(step, mem, order) {
  const m = mem || { flipped: [], matched: [] };
  const up = (id) => m.flipped.includes(id) || m.matched.includes(id);
  const cardsById = Object.fromEntries(step.cards.map((c) => [c.id, c]));
  const layout = order || step.cards.map((c) => c.id);
  const cards = layout.map((id, n) => {
    const card = cardsById[id];
    const matched = m.matched.includes(card.id);
    const shown = up(card.id);
    return el('button', {
      type: 'button',
      class: `memory-card${shown ? ' is-up' : ''}${matched ? ' is-matched' : ''}`,
      dataset: { card: card.id },
      disabled: matched || undefined,
      'aria-label': shown ? `${card.label}${matched ? ', matched' : ''}` : `Hidden card ${n + 1}`,
      onclick: () => flipCard(card.id),
    }, shown ? [visualNode(card.visual) || el('span', { class: 'visual-text small', text: card.label })] : [el('span', { class: 'card-back', 'aria-hidden': 'true' })]);
  });
  return el('div', { class: 'memory-board', role: 'group', 'aria-label': 'Memory cards' }, cards);
}

function flipCard(cardId) {
  const step = current.steps[session.index];
  const before = session;
  const { session: next, outcome } = placeCard(session, current, cardId);
  session = next;
  const feedback = () => document.getElementById('feedback');

  if (outcome.kind === 'retry') {
    renderStep(false);
    feedback().replaceChildren(
      el('p', { class: 'fb fb-retry', text: 'Not a pair. Those cards turn back over next.' }),
      el('p', { class: 'hint', text: `Hint: ${outcome.hint}` }),
    );
    say(`Not a pair. Hint: ${outcome.hint}`);
    return;
  }
  if (outcome.kind === 'correct') {
    persistStep();
    const message = outcome.firstTry ? 'Every pair found, first time. Brilliant!' : 'Every pair found. Well done!';
    renderStep(false, { ...before, memory: { flipped: [], matched: step.cards.map((c) => c.id) } });
    feedback().replaceChildren(teddy('teddy-happy'), el('p', { class: 'fb fb-correct', text: message }), continueButton(outcome.activityDone));
    say(message);
    return;
  }
  renderStep(false);
  const message = outcome.kind === 'match' ? 'A match! Keep going.' : 'Now find its partner.';
  feedback().replaceChildren(el('p', { class: 'fb fb-correct', text: message }));
  say(message);
}

// Drag a piece onto a target, or tap a piece then tap its target (touch and keyboard).
function dropBody(step, drop) {
  const d = drop || { placed: {}, wrong: 0 };
  const unplaced = step.items.filter((i) => !d.placed[i.id]);
  const tray = el('div', { class: 'tray', role: 'group', 'aria-label': 'Pieces to place' },
    unplaced.map((item) => el('button', {
      type: 'button',
      class: 'drag-item',
      dataset: { item: item.id },
      'aria-pressed': String(selectedItem === item.id),
      'aria-label': `${item.label}${selectedItem === item.id ? ', selected. Now choose where it goes' : ''}`,
      onpointerdown: () => { dragItem = item.id; selectedItem = item.id; markSelected(); },
      onclick: () => { selectedItem = item.id; markSelected(); },
    }, [visualNode(item.visual), el('span', { class: 'option-label', text: L(item.label) })])));
  if (!unplaced.length) tray.hidden = true;

  const zones = step.targets.map((t) => {
    const placed = step.items.filter((i) => d.placed[i.id] === t.id);
    return el('button', {
      type: 'button',
      class: 'drop-zone',
      dataset: { target: t.id },
      'aria-label': `${t.label}. ${placed.length} placed.`,
      onpointerup: () => { if (dragItem) { const id = dragItem; dragItem = null; dropOn(t.id, id); } },
      onclick: () => dropOn(t.id, selectedItem),
    }, [
      t.visual ? el('span', { class: 'drop-visual' }, visualNode(t.visual)) : null,
      el('span', { class: 'option-label', text: L(t.label) }),
      el('span', { class: 'placed-row' }, placed.map((i) => el('span', { class: 'placed' }, visualNode(i.visual) || el('span', { class: 'placed-text', text: i.label })))),
    ]);
  });
  return el('div', { class: 'drop-area' }, [tray, el('div', { class: 'zones' }, zones)]);
}

function markSelected() {
  app.querySelectorAll('.drag-item').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.item === selectedItem)));
}

function dropOn(targetId, itemId) {
  const step = current.steps[session.index];
  const feedback = document.getElementById('feedback');
  if (!itemId) {
    const msg = 'Tap a piece first, then tap where it goes.';
    feedback.replaceChildren(el('p', { class: 'fb fb-retry', text: msg }));
    say(msg);
    return;
  }
  const before = session;
  const { session: next, outcome } = placeItem(session, current, itemId, targetId);
  session = next;
  selectedItem = null;
  dragItem = null;

  if (outcome.kind === 'retry') {
    renderStep(false);
    document.getElementById('feedback').replaceChildren(
      el('p', { class: 'fb fb-retry', text: 'Not that one. Have another look.' }),
      el('p', { class: 'hint', text: `Hint: ${outcome.hint}` }),
    );
    say(`Not that one. Have another look. Hint: ${outcome.hint}`);
    return;
  }
  if (outcome.stepDone) {
    persistStep();
    const message = outcome.firstTry ? 'Brilliant! Every piece is in the right place.' : 'Well done. Every piece is in the right place now.';
    renderStep(false, { ...before, drop: { placed: { ...(before.drop?.placed || {}), [itemId]: targetId } } });
    document.getElementById('feedback').replaceChildren(teddy('teddy-happy'), el('p', { class: 'fb fb-correct', text: message }), continueButton(outcome.activityDone));
    say(message);
    return;
  }
  const remaining = step.items.length - Object.keys(session.drop.placed).length;
  renderStep(false);
  const message = `Yes, that one goes there. ${remaining} to go.`;
  document.getElementById('feedback').replaceChildren(el('p', { class: 'fb fb-correct', text: message }));
  say(message);
}

// A mistake the answer showed gets a hint about that mistake; otherwise the next authored hint.
const hintFor = (outcome) => (outcome.misconception ? MISCONCEPTIONS[outcome.misconception].tip : outcome.hint);

function choose(optionId) {
  const step = current.steps[session.index];
  if (purpose === 'diagnostic') {
    const opt = step.options.find((o) => o.id === optionId);
    checkAnswered(optionId === step.answer, opt?.misconception || null);
    return;
  }
  ui.lastAnswer = step.options.find((o) => o.id === optionId)?.label;
  const { session: next, outcome } = submit(session, current, optionId);
  session = next;
  const feedback = document.getElementById('feedback');
  const optionButtons = [...app.querySelectorAll('.option')];

  if (outcome.kind === 'retry') {
    const hint = hintFor(outcome);
    feedback.replaceChildren(el('p', { class: 'fb fb-retry', text: 'Not quite. Have another look.' }), el('p', { class: 'hint', text: `Hint: ${hint}` }));
    optionButtons.find((b) => b.dataset.option === optionId)?.focus();
    say(`Not quite. Have another look. Hint: ${hint}`);
    return;
  }
  optionButtons.forEach((b) => { b.disabled = true; b.classList.toggle('is-answer', b.dataset.option === step.answer); });
  persistStep();
  finishStep(outcome, step.options.find((o) => o.id === step.answer).label);
}

// Answers for typed, number line, tile and ten-frame steps.
function answer(response, shown) {
  const step = current.steps[session.index];
  if (purpose === 'diagnostic') {
    const g = grade(step, response);
    if (!g.valid) { invalidAnswer(step); return; }
    checkAnswered(g.correct, g.misconception);
    return;
  }
  ui.lastAnswer = shown;
  const before = session;
  const { session: next, outcome } = respond(session, current, response);
  if (outcome.kind === 'invalid') { invalidAnswer(step); return; }
  session = next;
  const feedback = document.getElementById('feedback');
  if (outcome.kind === 'retry') {
    const hint = hintFor(outcome);
    feedback.replaceChildren(el('p', { class: 'fb fb-retry', text: 'Not quite. Have another look.' }), el('p', { class: 'hint', text: `Hint: ${hint}` }));
    say(`Not quite. Have another look. Hint: ${hint}`);
    if (step.kind === 'input') { ui.text = ''; const f = app.querySelector('#answer'); if (f) { f.value = ''; f.focus(); } }
    return;
  }
  persistStep();
  ui.locked = true;
  if (outcome.kind === 'reveal') {
    if (step.kind === 'numberline') ui.line = step.target;
    if (step.kind === 'build') ui.count = step.target;
    if (step.kind === 'input') ui.text = step.answer;
    if (step.kind === 'order') {
      const pool = [...step.tiles];
      ui.picked = step.accept[0].split(' ').map((label) => pool.splice(pool.findIndex((t) => t.label === label), 1)[0].id);
    }
  }
  renderStep(false, before);
  const shownAnswer = step.kind === 'order' ? step.accept[0].split(' ').join(step.joiner ?? ' ')
    : step.kind === 'numberline' && step.denominator ? `${step.target}/${step.denominator}` : String(step.answer ?? step.target);
  finishStep(outcome, shownAnswer);
}

function invalidAnswer(step) {
  const msg = step.kind === 'order' ? 'Use every tile, then check.' : step.kind === 'input' ? 'Type an answer first.' : 'Choose an answer first.';
  document.getElementById('feedback').replaceChildren(el('p', { class: 'fb fb-retry', text: msg }));
  say(msg);
}

function finishStep(outcome, answerLabel) {
  const feedback = document.getElementById('feedback');
  const isLast = outcome.activityDone;
  if (outcome.kind === 'correct') {
    const message = outcome.firstTry ? 'Yes! You got it first time.' : 'Nice work. You got there.';
    feedback.replaceChildren(teddy('teddy-happy'), el('p', { class: 'fb fb-correct', text: message }), continueButton(isLast));
    say(message);
  } else {
    const message = `That one was tricky. The answer is ${answerLabel}. Let’s keep going.`;
    feedback.replaceChildren(el('p', { class: 'fb fb-reveal', text: message }), continueButton(isLast));
    say(message);
  }
  ui.revealed = outcome.kind === 'reveal';
  ui.stepDone = true;
  refreshHelp();
}

function persistStep() {
  const r = session.results[session.results.length - 1];
  state = recordStep(state, current.id, current.skill, r.firstTry, Date.now(), {
    // Tries missed plus help asked for: both mean the answer was not unaided.
    correct: r.correct, hints: Math.min(10, r.misses + (r.help || 0)), difficulty: r.difficulty, misconception: r.misconception, source: SOURCE[purpose],
  });
  syncStep(storage, remote, state.steps[state.steps.length - 1]);
  if (session.done) {
    state = recordCompletion(state, current.id, summarySession(session), Date.now());
    syncSession(storage, remote, state.sessions[state.sessions.length - 1]);
  }
  persist();
}

function continueButton(isLast) {
  const btn = el('button', {
    type: 'button', class: 'btn btn-red',
    text: isLast ? 'See how it went' : 'Next question',
    onclick: () => { ui = {}; if (isLast) renderComplete(); else renderStep(false); },
  });
  queueMicrotask(() => btn.focus());
  return btn;
}

// ---------- Work it out ----------
// Help that is always on offer under the question, before any answer: hints one at
// a time, then "Show me how": the method and a worked example of a different question
// of the same kind. Words and amount shown follow the learner's school stage.
function workItOut(step) {
  const stageId = stage().id;
  const style = styleFor(stageId);
  const young = stageId === 'early';
  if (!ui.work) ui.work = { hints: 0, shown: false, data: null };
  const w = ui.work;
  const data = () => (w.data ||= helpFor(step, current.skill, stageId, mulberry32((Date.now() >>> 0) ^ 0x2545f491)));
  const hintsLeft = w.hints < step.hints.length;
  const takeHint = () => {
    if (!hintsLeft || ui.stepDone) return;
    session = useHelp(session);
    w.hints += 1;
    const text = step.hints[w.hints - 1];
    refreshWork(step);
    say(young ? `Here’s a clue. ${text}` : text);
  };
  const showHow = () => {
    if (w.shown || ui.stepDone) { w.shown = true; refreshWork(step); return; }
    session = useHelp(session);
    w.shown = true;
    refreshWork(step);
    const d = data();
    say([style.framing, ...d.method, d.example ? `${style.exampleIntro}. ${d.example.step.prompt} ${d.example.steps.join(' ')} The answer is ${d.example.answer}.` : ''].join(' '));
  };

  const shownHints = step.hints.slice(0, w.hints);
  const d = w.shown ? data() : null;
  return el('section', { class: `work work-${stageId}`, id: 'work', 'aria-label': 'Help to work it out' }, [
    el('div', { class: 'work-actions' }, [
      el('span', { class: 'work-label', text: young ? 'Need help?' : 'Stuck?' }),
      el('button', { type: 'button', class: 'btn btn-line work-btn', disabled: !hintsLeft || ui.stepDone || undefined, onclick: takeHint,
        text: young ? 'Give me a clue' : hintsLeft ? `Hint ${w.hints + 1} of ${step.hints.length}` : 'No more hints' }),
      el('button', { type: 'button', class: 'btn btn-line work-btn', 'aria-expanded': String(w.shown), onclick: showHow,
        text: young ? 'Show me how' : 'Show me how (worked example)' }),
    ]),
    shownHints.length ? el('ol', { class: 'work-hints', 'aria-live': 'polite' }, shownHints.map((h) => el('li', { text: L(h) }))) : null,
    d ? el('div', { class: 'work-how', 'aria-live': 'polite' }, [
      d.method.length ? el('div', { class: 'work-method' }, [
        el('p', { class: 'work-title', text: style.framing }),
        el(young ? 'ol' : 'ul', {}, d.method.map((m) => el('li', { text: L(m) }))),
      ]) : null,
      d.example ? el('div', { class: 'work-example' }, [
        el('p', { class: 'work-title', text: style.exampleIntro }),
        el('p', { class: 'work-q', text: L(d.example.step.prompt) }),
        d.example.step.visual ? el('div', { class: 'work-visual' }, visualNode(d.example.step.visual.kind === 'passage' ? { ...d.example.step.visual, title: L(d.example.step.visual.title), text: L(d.example.step.visual.text) } : d.example.step.visual)) : null,
        el('ol', { class: 'work-steps' }, d.example.steps.map((t) => el('li', { text: L(t) }))),
        el('p', { class: 'work-answer' }, [el('strong', { text: young ? 'So the answer is ' : 'Answer: ' }), L(d.example.answer)]),
        el('p', { class: 'work-yours', text: young ? 'Now try yours the same way!' : 'Now use the same steps on your question.' }),
      ]) : null,
    ]) : null,
  ]);
}

function refreshWork(step) {
  const node = app.querySelector('#work');
  if (node) node.replaceWith(workItOut(step));
}

// ---------- Teddy's help ----------
// Teddy explains, gives a smaller step, or asks a follow-up question. He never marks
// answers and nothing he says is recorded as progress. Every failure falls back to
// the authored hints.
function helpPanel(step, viewState) {
  const signedIn = Boolean(remote?.profile);
  const stepIndex = viewState.index;
  const attempts = viewState.index === session.index ? session.misses : 3;
  const log = el('div', { class: 'help-log', 'aria-live': 'polite' }, help.log.map((m) => el('div', { class: `help-msg ${m.role}` }, [
    el('span', { class: 'help-who', text: m.role === 'tutor' ? 'Teddy (AI helper)' : m.role === 'note' ? '' : 'You' }),
    el('p', { text: m.text }),
    m.followUp ? el('p', { class: 'help-follow' }, [el('strong', { text: 'Try this: ' }), m.followUp]) : null,
  ])));
  const ask = (mode, message) => tutorTurn(step, stepIndex, mode, message, attempts);
  const chat = isOlder() && signedIn ? el('form', { class: 'help-ask', onsubmit: (e) => {
    e.preventDefault();
    const input = e.target.querySelector('input');
    const text = input.value.trim();
    if (text) { input.value = ''; ask('chat', text); }
  } }, [
    el('label', { class: 'sr-only', for: 'help-text', text: 'Ask Teddy about this question' }),
    el('input', { id: 'help-text', class: 'field', maxlength: 200, autocomplete: 'off', placeholder: 'Ask Teddy about this question' }),
    el('button', { type: 'submit', class: 'btn btn-line', disabled: help.busy || undefined, text: 'Ask' }),
  ]) : null;

  return el('aside', { class: 'help', 'aria-labelledby': 'help-h' }, [
    el('div', { class: 'help-head' }, [
      teddy('teddy-small'),
      el('div', {}, [
        el('h3', { id: 'help-h', text: 'Stuck? Ask Teddy' }),
        el('p', { class: 'muted small', text: signedIn ? 'Teddy explains and asks questions. He won’t just tell you the answer.' : 'Teddy’s explanations need a grown-up to sign in. The hints still work.' }),
      ]),
    ]),
    el('div', { class: 'help-actions' }, [
      el('button', { type: 'button', class: 'btn btn-line', disabled: help.busy || undefined, onclick: () => ask(ui.stepDone ? 'explain' : 'hint'), text: ui.stepDone ? 'Why is that the answer?' : 'Give me a clue' }),
      el('button', { type: 'button', class: 'btn btn-line', disabled: help.busy || undefined, onclick: () => ask('explain'), text: 'Explain it another way' }),
      ui.stepDone ? el('button', { type: 'button', class: 'btn btn-line', disabled: help.busy || undefined, onclick: () => ask('check'), text: 'Check I’ve got it' }) : null,
    ]),
    help.busy ? el('p', { class: 'muted small help-busy', text: 'Teddy is thinking…' }) : null,
    log,
    chat,
  ]);
}

function refreshHelp() {
  const panel = app.querySelector('.help');
  if (!panel || !current) return;
  const viewIndex = help.index;
  panel.replaceWith(helpPanel(current.steps[viewIndex], { index: viewIndex }));
}

async function tutorTurn(step, stepIndex, mode, message, attempts) {
  if (help.busy) return;
  const revealed = Boolean(ui.revealed) || (ui.stepDone && mode !== 'hint');
  if (message) help.log.push({ role: 'learner', text: message });
  help.busy = true;
  refreshHelp();
  const history = help.log.filter((m) => m.role === 'learner' || m.role === 'tutor').slice(-6).map((m) => ({ role: m.role, text: m.text }));
  const result = await askTutor(storage, {
    profileId: remote?.profile?.id, objective: current.skill, mode,
    item: itemFor(step, attempts, revealed, ui.lastAnswer), message, history: message ? history.slice(0, -1) : history,
  });
  if (help.index !== stepIndex) return; // moved on while waiting
  help.busy = false;
  if (result.ok) {
    help.log.push({ role: 'tutor', text: result.reply, followUp: result.followUp });
    say(result.followUp ? `${result.reply} ${result.followUp}` : result.reply);
  } else {
    const fallback = step.hints[Math.min(help.log.filter((m) => m.role === 'note').length, step.hints.length - 1)];
    const text = `${reasonText(result.reason)} ${ui.stepDone ? '' : `Hint: ${fallback}`}`.trim();
    help.log.push({ role: 'note', text });
    say(text);
  }
  refreshHelp();
}

// ---------- Completion ----------
function renderComplete() {
  const sum = summarySession(session);
  const now = Date.now();
  const report = objectiveReport(state, current.skill, now);
  const headline = sum.correctFirst === sum.total
    ? `Every answer right first time in “${L(current.title)}”.`
    : `You finished “${L(current.title)}”. Every try helps you learn.`;
  const detail = `${sum.correctFirst} of ${sum.total} right first time.`
    + (sum.hintsUsed ? ` ${sum.hintsUsed} ${sum.hintsUsed === 1 ? 'hint' : 'hints'} used.` : '');
  const mixups = report.misconceptions.filter((m) => m.active);
  const next = plan(state, now, 4).find((p) => p.objective !== current.skill);

  setScreen([
    el('div', { class: 'complete' }, [
      teddy('teddy-large'),
      el('h2', { id: 'prompt', tabindex: '-1', text: 'Well done!' }),
      el('p', { text: headline }),
      el('p', { class: 'muted', text: detail }),
      el('div', { class: 'evidence' }, [
        el('p', {}, [el('strong', { text: `${L(report.label)}: ` }), `${STATE_LABEL[report.state].toLowerCase()}, from ${report.mastery.attempts} ${report.mastery.attempts === 1 ? 'answer' : 'answers'} so far.`]),
        mixups.length ? el('p', { class: 'muted', text: `Something to watch: ${mixups[0].label.toLowerCase()}. ${MISCONCEPTIONS[mixups[0].code].tip}` }) : null,
      ]),
      el('div', { class: 'cta-row' }, [
        next ? el('button', { type: 'button', class: 'btn btn-red', onclick: () => startPractice(next.objective, next.kind === 'review' ? 'review' : 'practice'), text: `Next: ${L(next.label)}` }) : null,
        el('button', { type: 'button', class: 'btn btn-line', onclick: () => renderHome(), text: 'Back to plan' }),
        el('a', { class: 'btn btn-line', href: '/learn/parent.html', text: 'Parent view' }),
      ]),
    ]),
  ], '#prompt');
  say(headline);
}

// ---------- Audio controls ----------
function setupAudio() {
  if (!canSpeak()) {
    audioBar.hidden = true;
    audioNote.hidden = false;
    audioNote.textContent = 'Spoken instructions are not available in this browser. Everything is also written on screen.';
    return;
  }
  volumeInput.value = String(state.settings.volume);
  soundBtn.setAttribute('aria-pressed', String(state.settings.audio));
  soundBtn.textContent = state.settings.audio ? 'Voice on' : 'Voice off';
  soundBtn.addEventListener('click', () => {
    saveSettings({ audio: !state.settings.audio });
    soundBtn.setAttribute('aria-pressed', String(state.settings.audio));
    soundBtn.textContent = state.settings.audio ? 'Voice on' : 'Voice off';
    if (!state.settings.audio) stopSpeaking();
  });
  volumeInput.addEventListener('change', () => saveSettings({ volume: Number(volumeInput.value) }));
  replayBtn.addEventListener('click', () => {
    if (!state.settings.audio) return;
    if (spokenKey) narrate(spokenKey, spokenLast, { volume: state.settings.volume });
    else speak(spokenLast || 'Choose an activity.', { volume: state.settings.volume });
  });
}

window.addEventListener('pagehide', stopSpeaking);
window.addEventListener('pointerup', () => { dragItem = null; });

setupAudio();
// Signed in with an active child profile: load that child's synced progress.
// Otherwise everything stays on this device.
openRemote(storage).then((r) => {
  remote = r?.profile ? r : null;
  if (r?.state) {
    state = r.state;
    writeState(storage, state);
  }
}).finally(() => {
  document.body.dataset.stage = stage().id;
  const params = new URLSearchParams(window.location.search);
  const requested = params.get('activity');
  const practise = params.get('practise');
  if (requested && byId(requested)) { state = updateSettings(state, { onboarded: true }); startLibrary(requested); }
  else if (practise && OBJECTIVES[practise]) { state = updateSettings(state, { onboarded: true }); startPractice(practise); }
  else if (params.get('view') === 'curriculum') renderCurriculum(ctx, US_GRADES.includes(params.get('grade')) ? params.get('grade') : undefined);
  else if (params.get('view') === 'ask') renderAsk(ctx, OBJECTIVES[params.get('topic')] ? params.get('topic') : undefined);
  else if (params.get('lesson') && OBJECTIVES[params.get('lesson')]) renderLesson(ctx, params.get('lesson'));
  else if (!state.settings.onboarded && !state.steps.length) renderSetup('age');
  else renderHome();
});
