// Parent view. Everything here is computed from recorded answers by learner.js.
// Three things are kept visibly apart: what the child did (counts), what we estimate
// from it (with how sure we are), and what a placement check assumed (no answers yet).
import { ACTIVITIES, BANDS } from './content.js';
import { readState, writeState, summarise, updateSettings } from './progress.js';
import { el } from './dom.js';
import { openRemote, syncSettings, syncReset } from './sync.js';
import { OBJECTIVES, SUBJECTS, STRANDS, objectivesFor } from './curriculum/framework.js';
import { MISCONCEPTIONS } from './curriculum/misconceptions.js';
import { LOCALES, pickLocale, localise, stageName } from './curriculum/locales.js';
import { learnerReport, plan, STATE_LABEL } from './learner.js';

const GAME_TITLES = { 'bakery-counting': 'Teddy’s Bakery: Counting Cakes', 'bakery-numbers': 'Teddy’s Bakery: The Number Shop', 'bakery-shapes': 'Teddy’s Bakery: Shape Delivery', 'bakery-patterns': 'Teddy’s Bakery: Pattern Oven', 'bakery-grand-opening': 'Teddy’s Bakery: Grand Opening' };
const DAY = 86400000;

const storage = (() => { try { return window.localStorage; } catch { return null; } })();
const root = document.getElementById('parent-app');

let state = readState(storage);
let remote = null;

const locale = () => state.settings.locale || pickLocale(navigator.languages || []);
const L = (t) => localise(t, locale());
const name = () => remote?.profile?.nickname || 'Your child';

function save(next) {
  state = next;
  if (!writeState(storage, state)) flash('Settings could not be saved on this device.');
  syncSettings(remote, state.settings).catch(() => flash('Settings saved on this device. They will sync when you are online.'));
}

function flash(text) {
  const n = document.getElementById('flash');
  if (n) n.textContent = text;
}

const titleOf = (id) => ACTIVITIES.find((a) => a.id === id)?.title
  ?? GAME_TITLES[id]
  ?? (/^(pr|rv)-/.test(id) ? `${id.startsWith('rv') ? 'Review' : 'Practice'}: ${OBJECTIVES[id.slice(3)]?.label ?? 'activity'}` : null)
  ?? (/^dx-/.test(id) ? 'Quick check' : 'Activity');
const ago = (t, now) => {
  const d = Math.floor((now - t) / DAY);
  return d <= 0 ? 'today' : d === 1 ? 'yesterday' : `${d} days ago`;
};

// How sure we are, in words. Never a bare percentage without enough evidence.
function sureness(r) {
  if (!r.mastery.attempts) return '';
  if (!r.mastery.reportable) return 'Too few answers to say yet';
  if (r.mastery.confidence < 0.6) return 'Fairly sure';
  return 'Sure';
}

function render() {
  const now = Date.now();
  const reports = learnerReport(state, now);
  const sum = summarise(state);
  const band = state.settings.band;
  const inScope = new Set(objectivesFor(band, 1));
  const practised = Object.values(reports).filter((r) => r.mastery.attempts > 0);
  const shown = Object.values(reports).filter((r) => r.mastery.attempts > 0 || r.state === 'assumed');
  const notYet = Object.values(reports).filter((r) => inScope.has(r.id) && r.state === 'not-started');

  const who = remote?.profile
    ? el('p', { class: 'muted', text: `Showing ${remote.profile.nickname}, synced to your account. ${stageName(band, locale())}, age ${band.replace('-', '–')}.` })
    : el('p', { class: 'muted', text: `Showing progress saved on this device (${stageName(band, locale())}). Sign in on the Account page to see it on any device.` });

  if (!state.steps.length) {
    root.replaceChildren(who, el('section', { class: 'panel' }, [
      el('h2', { text: 'Nothing recorded yet' }),
      el('p', { text: 'Once your child answers a few questions, this page shows what they are learning, where they need support and what comes next.' }),
      el('a', { class: 'btn btn-red', href: '/learn/', text: 'Start learning' }),
    ]), settingsPanel(), privacyPanel(), el('p', { id: 'flash', class: 'flash', role: 'status', 'aria-live': 'polite' }));
    return;
  }

  const support = practised.filter((r) => r.state === 'needs-support' || r.misconceptions.some((m) => m.active));
  const secure = practised.filter((r) => r.state === 'secure');
  const due = practised.filter((r) => r.retention.due);
  const remembered = practised.filter((r) => r.retention.rememberedAfterDays >= 3);
  const next = plan(state, now, 3);

  // ---- Headline: the few things a parent most needs ----
  const headline = el('section', { class: 'panel', 'aria-labelledby': 'now-h' }, [
    el('h2', { id: 'now-h', text: 'At a glance' }),
    el('ul', { class: 'glance' }, [
      el('li', {}, [el('strong', { text: `${practised.length}` }), ` ${practised.length === 1 ? 'skill' : 'skills'} practised, from ${sum.stepCount} answers.`]),
      el('li', {}, [el('strong', { text: `${secure.length}` }), ' secure: answered right first time often enough to be confident.']),
      el('li', {}, [el('strong', { text: `${support.length}` }), ` ${support.length === 1 ? 'needs' : 'need'} support.`]),
      el('li', {}, [el('strong', { text: `${remembered.length}` }), ` remembered after a break of three days or more${due.length ? `. ${due.length} ${due.length === 1 ? 'is' : 'are'} due for review` : ''}.`]),
    ]),
  ]);

  // ---- Where support is needed ----
  const supportPanel = el('section', { class: 'panel', 'aria-labelledby': 'support-h' }, [
    el('h2', { id: 'support-h', text: 'Where support would help' }),
    support.length ? el('ul', { class: 'support-list' }, support.map((r) => {
      const mc = r.misconceptions.find((m) => m.active);
      return el('li', {}, [
        el('strong', { text: L(r.label) }),
        el('p', { text: mc ? MISCONCEPTIONS[mc.code].parent : `${r.mastery.firstTry} of ${r.mastery.attempts} answers right first time so far.` }),
        mc ? el('p', { class: 'muted', text: `Seen ${mc.count} times in recent answers. At home: ${MISCONCEPTIONS[mc.code].tip}` }) : null,
      ]);
    })) : el('p', { class: 'muted', text: 'Nothing stands out at the moment. This updates as more answers come in.' }),
  ]);

  // ---- Skills, by subject and strand ----
  const subjects = Object.keys(SUBJECTS).filter((s) => shown.some((r) => r.subject === s));
  const skills = el('section', { class: 'panel', 'aria-labelledby': 'skills-h' }, [
    el('h2', { id: 'skills-h', text: `What ${name() === 'Your child' ? 'your child is' : `${name()} is`} learning` }),
    notYet.length ? el('p', { class: 'muted', text: `Not started yet for this age: ${notYet.map((r) => L(r.label).toLowerCase()).join(', ')}.` }) : null,
    el('p', { class: 'muted small', text: '“Answers” and “first time” are exactly what was recorded. The status is an estimate from those answers, weighted towards recent, harder and unaided ones. “Probably known” comes from the quick check and has no answers behind it yet.' }),
    ...subjects.map((s) => el('div', { class: 'report-subject' }, [
      el('h3', { text: L(SUBJECTS[s].label) }),
      el('div', { class: 'table-wrap' }, el('table', {}, [
        el('thead', {}, el('tr', {}, ['Skill', 'Answers', 'First time', 'Status', 'Last practised', 'Notes'].map((h) => el('th', { scope: 'col', text: h })))),
        el('tbody', {}, SUBJECTS[s].strands.flatMap((strand) => shown.filter((r) => r.subject === s && r.strand === strand)
          .sort((a, b) => OBJECTIVES[a.id].order - OBJECTIVES[b.id].order)
          .map((r, i) => el('tr', { class: i === 0 ? 'strand-start' : '' }, [
            el('th', { scope: 'row' }, [
              el('span', { class: 'cell-strand', text: i === 0 ? STRANDS[strand] : '' }),
              el('span', { text: L(r.label) }),
              el('span', { class: 'cell-goal', text: r.goal }),
            ]),
            el('td', { 'data-label': 'Answers', text: r.mastery.attempts ? String(r.mastery.attempts) : '—' }),
            el('td', { 'data-label': 'First time', text: r.mastery.attempts ? `${r.mastery.firstTry}` : '—' }),
            el('td', { 'data-label': 'Status' }, [el('span', { class: `status state-${r.state}`, text: STATE_LABEL[r.state] }), el('span', { class: 'cell-goal', text: sureness(r) })]),
            el('td', { 'data-label': 'Last practised', text: r.mastery.lastAt ? ago(r.mastery.lastAt, now) : '—' }),
            el('td', { 'data-label': 'Notes', text: notes(r, now) }),
          ])))),
      ])),
    ])),
  ]);

  const nextPanel = el('section', { class: 'panel', 'aria-labelledby': 'next-h' }, [
    el('h2', { id: 'next-h', text: 'Coming up next' }),
    next.length ? el('ol', { class: 'recs' }, next.map((p) => el('li', {}, [
      el('a', { href: `/learn/?practise=${p.objective}`, text: L(p.label) }),
      el('span', { class: 'muted', text: ` · ${p.reason}` }),
    ]))) : el('p', { class: 'muted', text: 'Nothing to suggest for this age and focus yet.' }),
    el('p', { class: 'muted small', text: 'Suggestions from recorded answers, not a diagnosis or a measure of ability.' }),
  ]);

  root.replaceChildren(who, headline, supportPanel, nextPanel, skills, weeksPanel(now), recentPanel(sum), settingsPanel(), privacyPanel(),
    el('p', { id: 'flash', class: 'flash', role: 'status', 'aria-live': 'polite' }));
}

function notes(r, now) {
  const out = [];
  if (r.retention.due) out.push('Review due');
  if (r.retention.rememberedAfterDays >= 3) out.push(`Remembered after ${r.retention.rememberedAfterDays} days`);
  const mc = r.misconceptions.find((m) => m.active);
  if (mc) out.push(mc.label);
  else if (r.misconceptions.some((m) => m.resolved)) out.push('A past mix-up now sorted');
  if (r.fromDiagnostic && r.fromDiagnostic === r.mastery.attempts) out.push('From the quick check only');
  return out.join('. ') || '—';
}

// Answers per week for the last eight weeks, and how many were right first time.
function weeksPanel(now) {
  const weeks = Array.from({ length: 8 }, (_, i) => {
    const end = now - i * 7 * DAY;
    const start = end - 7 * DAY;
    const steps = state.steps.filter((s) => s.at > start && s.at <= end);
    return { label: i === 0 ? 'This week' : i === 1 ? 'Last week' : `${i} weeks ago`, total: steps.length, first: steps.filter((s) => s.firstTry).length };
  }).reverse();
  const max = Math.max(1, ...weeks.map((w) => w.total));
  const days = new Set(state.steps.filter((s) => s.at > now - 14 * DAY).map((s) => Math.floor(s.at / DAY))).size;
  return el('section', { class: 'panel', 'aria-labelledby': 'weeks-h' }, [
    el('h2', { id: 'weeks-h', text: 'Over time' }),
    el('p', { class: 'muted', text: `Practised on ${days} of the last 14 days. Short, regular practice helps more than long sessions.` }),
    el('div', { class: 'weeks', role: 'img', 'aria-label': weeks.map((w) => `${w.label}: ${w.total} answers, ${w.first} right first time`).join('. ') },
      weeks.map((w) => el('div', { class: 'week' }, [
        el('span', { class: 'week-num', text: w.total ? String(w.total) : '' }),
        el('span', { class: 'week-bar', style: `height:${Math.round((w.total / max) * 100)}%` }, [
          el('span', { class: 'week-first', style: `height:${w.total ? Math.round((w.first / w.total) * 100) : 0}%` }),
        ]),
        el('span', { class: 'week-label', text: w.label }),
      ]))),
    el('p', { class: 'legend' }, [el('span', { class: 'key key-total' }), 'Answers', el('span', { class: 'key key-first' }), 'Right first time']),
  ]);
}

function recentPanel(sum) {
  return el('section', { class: 'panel', 'aria-labelledby': 'recent-h' }, [
    el('h2', { id: 'recent-h', text: 'Recent sessions' }),
    sum.recent.length ? el('ol', { class: 'recent' }, sum.recent.map((s) => el('li', {}, [
      el('span', { class: 'recent-title', text: titleOf(s.activityId) }),
      el('span', { class: 'muted', text: ` · ${new Date(s.at).toLocaleDateString(locale(), { day: 'numeric', month: 'short' })} · ${s.correctFirst} of ${s.total} first time` }),
    ]))) : el('p', { class: 'muted', text: 'No finished sessions yet.' }),
  ]);
}

function settingsPanel() {
  return el('form', { class: 'panel', 'aria-labelledby': 'settings-h', onsubmit: (e) => e.preventDefault() }, [
    el('h2', { id: 'settings-h', text: 'Learning settings' }),
    el('fieldset', { class: 'chips' }, [
      el('legend', { text: 'Age (a starting point, not a measure of ability)' }),
      ...BANDS.map((band) => el('label', { class: 'chip' }, [
        el('input', { type: 'radio', name: 'band', value: band, checked: state.settings.band === band,
          onchange: () => { save(updateSettings(state, { band })); render(); } }),
        el('span', { text: `Age ${band.replace('-', '–')}` }),
      ])),
    ]),
    el('label', { class: 'field-label', for: 'p-locale', text: 'Country' }),
    el('select', { id: 'p-locale', class: 'field', onchange: (e) => { save(updateSettings(state, { locale: e.target.value })); render(); } },
      Object.entries(LOCALES).map(([id, l]) => el('option', { value: id, text: l.label, selected: id === locale() }))),
    el('label', { class: 'field-label', for: 'p-focus', text: 'Focus' }),
    el('select', { id: 'p-focus', class: 'field', onchange: (e) => { save(updateSettings(state, { focus: e.target.value })); render(); } },
      [['all', 'Everything'], ...Object.entries(SUBJECTS).map(([id, s]) => [id, L(s.label)])].map(([id, label]) => el('option', { value: id, text: label, selected: id === state.settings.focus }))),
    el('label', { class: 'check' }, [
      el('input', { type: 'checkbox', checked: state.settings.audio, onchange: (e) => save(updateSettings(state, { audio: e.target.checked })) }),
      el('span', { text: 'Spoken instructions' }),
    ]),
  ]);
}

function privacyPanel() {
  return el('section', { class: 'panel', 'aria-labelledby': 'data-h' }, [
    el('h2', { id: 'data-h', text: 'What is recorded' }),
    el('ul', { class: 'plain' }, [
      el('li', { text: 'For each answer: which skill and activity, whether it was right first time, how many tries, the item’s difficulty, the time, and a mistake type when the wrong answer showed one.' }),
      el('li', { text: 'For a child profile: a nickname, an age band, a country and settings. No surname, birthday, school or photo.' }),
      el('li', { text: 'Teddy’s explanations: nothing your child types to Teddy, and nothing Teddy says, is stored. Only a daily count of requests per account is kept, to apply fair-use limits. Teddy’s replies are written by an AI model and are not checked by a person before they are shown.' }),
    ]),
    el('p', { class: 'muted', text: remote?.profile ? 'Deleting removes every answer and session for this child from this device and your account. Deleting the profile on the Account page removes everything.' : 'Deleting removes every answer and session saved on this device.' }),
    el('button', { type: 'button', class: 'btn btn-line', onclick: resetProgress, text: 'Delete progress' }),
  ]);
}

function resetProgress() {
  if (!window.confirm('Delete all recorded progress for this learner? This cannot be undone.')) return;
  save(updateSettings({ ...state, steps: [], sessions: [] }, { placement: {}, assumed: [] }));
  syncReset(remote).catch(() => flash('Could not delete the synced progress. Try again when online.'));
  render();
  flash('Progress has been deleted.');
}

openRemote(storage).then((r) => {
  if (r?.profile) { remote = r; state = r.state; writeState(storage, state); }
}).finally(render);
