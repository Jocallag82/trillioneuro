// Parent summary: shows only what this device recorded, plus clearly labelled suggestions.
import { ACTIVITIES, BANDS, LEVEL_NAMES } from './content.js';
import { readState, writeState, summarise, recommend, updateSettings } from './progress.js';
import { el } from './dom.js';

const storage = (() => { try { return window.localStorage; } catch { return null; } })();
const root = document.getElementById('parent-app');
const TREND_LABEL = {
  improving: 'Improving',
  practice: 'Worth more practice',
  steady: 'Steady so far',
  new: 'Just started',
};

let state = readState(storage);

function save(next) {
  state = next;
  if (!writeState(storage, state)) {
    flash('Settings could not be saved on this device.');
  }
}

function flash(text) {
  const n = document.getElementById('flash');
  if (n) n.textContent = text;
}

const pct = (x) => `${Math.round(x * 100)}%`;
const titleOf = (id) => ACTIVITIES.find((a) => a.id === id)?.title ?? 'Activity';

function render() {
  const sum = summarise(state);
  const recs = recommend(state, ACTIVITIES, 3);

  const settingsForm = el('form', { class: 'panel', 'aria-labelledby': 'settings-h', onsubmit: (e) => e.preventDefault() }, [
    el('h3', { id: 'settings-h', text: 'Learning settings' }),
    el('fieldset', { class: 'chips' }, [
      el('legend', { text: 'Age band (a starting point, not a measure of ability)' }),
      ...BANDS.map((band) => el('label', { class: 'chip' }, [
        el('input', { type: 'radio', name: 'band', value: band, checked: state.settings.band === band,
          onchange: () => { save(updateSettings(state, { band })); render(); } }),
        el('span', { text: `Age ${band.replace('-', '–')}` }),
      ])),
    ]),
    el('label', { class: 'check' }, [
      el('input', { type: 'checkbox', checked: state.settings.showAll,
        onchange: (e) => { save(updateSettings(state, { showAll: e.target.checked })); render(); } }),
      el('span', { text: 'Show activities from all age bands' }),
    ]),
    el('label', { class: 'check' }, [
      el('input', { type: 'checkbox', checked: state.settings.audio,
        onchange: (e) => { save(updateSettings(state, { audio: e.target.checked })); } }),
      el('span', { text: 'Spoken instructions (optional)' }),
    ]),
    el('label', { class: 'range' }, [
      el('span', { text: 'Voice volume' }),
      el('input', { type: 'range', min: 0, max: 1, step: 0.1, value: state.settings.volume,
        onchange: (e) => save(updateSettings(state, { volume: Number(e.target.value) })) }),
    ]),
  ]);

  const overview = el('section', { class: 'stats', 'aria-labelledby': 'overview-h' }, [
    el('h3', { id: 'overview-h', text: 'What this device recorded' }),
    el('dl', { class: 'stat-grid' }, [
      stat('Activities finished', sum.completed),
      stat('Sessions', sum.sessionCount),
      stat('Answers recorded', sum.stepCount),
      stat('Right on first try', sum.firstTryAccuracy === null ? '—' : pct(sum.firstTryAccuracy)),
    ]),
  ]);

  const skillTable = sum.skills.length
    ? el('div', { class: 'table-wrap' }, el('table', {}, [
      el('caption', { text: 'Skills practised (first try answers only)' }),
      el('thead', {}, el('tr', {}, [el('th', { scope: 'col', text: 'Skill' }), el('th', { scope: 'col', text: 'Answers' }),
        el('th', { scope: 'col', text: 'First try' }), el('th', { scope: 'col', text: 'Trend' })])),
      el('tbody', {}, sum.skills.map((s) => el('tr', {}, [
        el('th', { scope: 'row', text: s.label }),
        el('td', { text: String(s.attempts) }),
        el('td', { text: pct(s.accuracy) }),
        el('td', { text: TREND_LABEL[s.trend] }),
      ]))),
    ]))
    : el('p', { class: 'muted', text: 'No answers recorded yet. Finish an activity to see skills here.' });

  const recent = sum.recent.length
    ? el('ol', { class: 'recent' }, sum.recent.map((s) => el('li', {}, [
      el('span', { class: 'recent-title', text: titleOf(s.activityId) }),
      el('span', { class: 'muted', text: ` · ${new Date(s.at).toLocaleDateString('en-US', { day: 'numeric', month: 'short' })} · ${s.correctFirst} of ${s.total} first try` }),
    ])))
    : el('p', { class: 'muted', text: 'No sessions yet.' });

  const recList = recs.length
    ? el('ul', { class: 'recs' }, recs.map(({ activity: a, reason }) => el('li', {}, [
      el('a', { href: `/learn/?activity=${a.id}`, text: a.title }),
      el('span', { class: 'muted', text: ` · ${reason} · ${LEVEL_NAMES[a.level]}` }),
    ])))
    : el('p', { class: 'muted', text: 'Nothing to suggest for this age band yet. Try "Show activities from all age bands".' });

  root.replaceChildren(
    overview,
    el('section', { class: 'panel', 'aria-labelledby': 'skills-h' }, [
      el('h3', { id: 'skills-h', text: 'Skills' }), skillTable,
    ]),
    el('section', { class: 'panel', 'aria-labelledby': 'recent-h' }, [el('h3', { id: 'recent-h', text: 'Recent sessions' }), recent]),
    el('section', { class: 'panel', 'aria-labelledby': 'rec-h' }, [
      el('h3', { id: 'rec-h', text: 'Suggested next activities' }),
      el('p', { class: 'muted', text: 'Suggestions based on the answers above. They are not a diagnosis or a measure of ability.' }),
      recList,
    ]),
    settingsForm,
    el('section', { class: 'panel danger', 'aria-labelledby': 'data-h' }, [
      el('h3', { id: 'data-h', text: 'Delete progress on this device' }),
      el('p', { class: 'muted', text: 'Removes every recorded answer and session from this browser. Settings are kept until you clear them too.' }),
      el('button', { type: 'button', class: 'btn btn-line', onclick: resetProgress, text: 'Delete progress' }),
    ]),
    el('p', { id: 'flash', class: 'flash', role: 'status', 'aria-live': 'polite' }),
  );
}

function stat(label, value) {
  return el('div', { class: 'stat' }, [
    el('dt', { text: label }),
    el('dd', { text: String(value) }),
  ]);
}

function resetProgress() {
  if (!window.confirm('Delete all progress recorded on this device? This cannot be undone.')) return;
  save({ ...state, steps: [], sessions: [] });
  render();
  flash('Progress on this device has been deleted.');
}

render();
