// Activity player: age choice, activity list, steps, feedback and completion.
import { ACTIVITIES, BANDS, DOMAINS, LEVEL_NAMES } from './content.js';
import { startSession, submit, placeItem, placeCard, summarySession } from './engine.js';
import { readState, writeState, recordStep, recordCompletion, updateSettings, recommend } from './progress.js';
import { canSpeak, speak, narrate, stopSpeaking } from './speech.js';
import { el, visualNode } from './dom.js';

const storage = (() => { try { return window.localStorage; } catch { return null; } })();
const app = document.getElementById('app');
const caption = document.getElementById('caption');
const replayBtn = document.getElementById('replay');
const soundBtn = document.getElementById('sound');
const volumeInput = document.getElementById('volume');
const audioBar = document.getElementById('audio-bar');
const audioNote = document.getElementById('audio-note');

let state = readState(storage);
let view = 'home';
let current = null;
let session = null;
let spokenLast = '';
let spokenKey = null;

const byId = (id) => ACTIVITIES.find((a) => a.id === id);
const completedIds = () => new Set(state.sessions.map((s) => s.activityId));
const inScope = () => ACTIVITIES.filter((a) => state.settings.showAll || a.band === state.settings.band);

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
  app.replaceChildren(...[].concat(nodes));
  const target = focusSelector ? app.querySelector(focusSelector) : app;
  if (target) target.focus({ preventScroll: false });
}

function teddy(cls = '') {
  return el('img', { src: '/teddy-mark.webp', width: 64, height: 64, alt: '', class: `teddy ${cls}`.trim() });
}

// ---------- Home ----------
function renderHome(focusSelector = '#home-title') {
  view = 'home';
  stopSpeaking();
  const done = completedIds();
  const rec = recommend(state, ACTIVITIES, 3);

  const bandRadios = BANDS.map((band) => el('label', { class: 'chip' }, [
    el('input', { type: 'radio', name: 'band', id: `band-${band}`, value: band, checked: state.settings.band === band,
      onchange: () => setBand(band) }),
    el('span', { text: `Age ${band.replace('-', '–')}` }),
  ]));

  const showAllBox = el('label', { class: 'check' }, [
    el('input', { type: 'checkbox', id: 'show-all', checked: state.settings.showAll,
      onchange: (e) => setSettings({ showAll: e.target.checked }, 'show-all') }),
    el('span', { text: 'Show all levels' }),
  ]);

  const recSection = rec.length
    ? el('section', { class: 'panel', 'aria-labelledby': 'rec-h' }, [
      el('h3', { id: 'rec-h', text: 'Suggested next' }),
      el('p', { class: 'muted', text: 'Based on what you have tried on this device. These are suggestions, not a diagnosis.' }),
      el('ul', { class: 'cards' }, rec.map(({ activity: a, reason }) => el('li', {}, [
        el('button', { type: 'button', class: 'card', onclick: () => startActivity(a.id) },
          cardBody(a, `${reason} · ${LEVEL_NAMES[a.level]}`)),
      ]))),
    ])
    : el('section', { class: 'panel' }, [
      el('p', { text: `You have finished every activity for this age. Turn on "Show all levels" to explore more.` }),
    ]);

  const groups = DOMAINS.map((domain) => {
    const items = inScope().filter((a) => a.domain === domain);
    if (!items.length) return null;
    return el('section', { class: 'domain', 'aria-labelledby': `d-${domainSlug(domain)}` }, [
      el('h3', { id: `d-${domainSlug(domain)}`, text: domain }),
      el('ul', { class: 'cards' }, items.map((a) => el('li', {}, [
        el('button', { type: 'button', class: 'card', onclick: () => startActivity(a.id) },
          cardBody(a, `${LEVEL_NAMES[a.level]} · ${done.has(a.id) ? 'Done' : 'New'}`)),
      ]))),
    ]);
  });

  setScreen([
    el('section', { class: 'hero-banner' }, [
      teddy('teddy-hero'),
      el('div', {}, [
        el('p', { class: 'eyebrow', text: 'Free early learning' }),
        el('h2', { id: 'home-title', tabindex: '-1', text: 'Learn by playing' }),
        el('p', { class: 'hero-copy', text: 'Short activities for counting, shapes, colours, letters and patterns. Pick an age to start.' }),
      ]),
    ]),
    el('div', { class: 'age-panel' }, [
      el('fieldset', { class: 'chips' }, [el('legend', { text: 'Age (a starting point, not a measure of ability)' }), ...bandRadios]),
      showAllBox,
    ]),
    recSection,
    ...groups.filter(Boolean),
    el('p', { class: 'privacy', text: 'No name or account is needed. Progress is saved only on this device. Clear it any time in the Parent summary.' }),
  ], focusSelector);
  say('Choose an age, then pick an activity.');
}

// A card shows a small preview of the activity's first picture, so it reads at a glance.
function cardBody(a, meta) {
  const first = a.steps[0];
  const preview = first.visual
    || first.options?.[0]?.visual || first.items?.[0]?.visual || first.cards?.[0]?.visual
    || null;
  return [
    el('span', { class: 'card-preview', 'aria-hidden': 'true' }, visualNode(preview)),
    el('span', { class: 'card-title', text: a.title }),
    el('span', { class: 'card-meta', text: meta }),
  ];
}

function domainSlug(d) {
  return d.toLowerCase().replace(/[^a-z]+/g, '-').replace(/^-|-$/g, '');
}

function setBand(band) {
  setSettings({ band }, `#band-${band}`);
}

function setSettings(patch, focusSelector) {
  state = updateSettings(state, patch);
  persist();
  renderHome(focusSelector);
}

// ---------- Activity ----------
function startActivity(id) {
  current = byId(id);
  session = startSession(current);
  renderStep(true);
}

let selectedItem = null;
let dragItem = null;

// viewState lets a finished step be drawn from its last in-progress state.
function renderStep(intro = false, viewState = session) {
  view = 'activity';
  const step = current.steps[viewState.index];
  const total = current.steps.length;
  const body = bodyFor(step, viewState);

  setScreen([
    el('nav', { class: 'activity-nav' }, [
      el('button', { type: 'button', class: 'link', onclick: () => renderHome('#home-title'), text: '← All activities' }),
    ]),
    el('div', { class: 'progress-row' }, [
      el('p', { class: 'step-count', text: `Question ${viewState.index + 1} of ${total}` }),
      el('progress', { max: total, value: viewState.index, 'aria-label': 'Activity progress' }),
    ]),
    el('h2', { id: 'prompt', tabindex: '-1', text: current.title }),
    el('p', { class: 'prompt', text: step.prompt }),
    body,
    el('div', { id: 'feedback', class: 'feedback', role: 'status', 'aria-live': 'polite' }),
  ], '#prompt');

  if (intro) say(`${current.instruction} ${step.prompt}`);
  else say(step.prompt, `${current.id}-${viewState.index}`);
}

function bodyFor(step, viewState) {
  if (step.kind === 'drop') return dropBody(step, viewState.drop);
  if (step.kind === 'memory') return memoryBody(step, viewState.memory, viewState.order?.[viewState.index]);
  return choiceBody(step);
}

function choiceBody(step) {
  const options = step.options.map((opt) => el('button', {
    type: 'button', class: 'option', dataset: { option: opt.id },
    onclick: () => choose(opt.id),
  }, [
    opt.visual ? el('span', { class: 'option-visual' }, visualNode(opt.visual)) : null,
    el('span', { class: 'option-label', text: opt.label }),
  ]));
  return el('div', { class: 'choice-body' }, [
    step.listen
      ? el('button', { type: 'button', class: 'btn btn-line play', onclick: () => say(step.prompt, `${current.id}-${session.index}`) }, 'Play question again')
      : null,
    step.visual ? el('div', { class: 'stage' }, visualNode(step.visual)) : null,
    el('div', { class: 'options', role: 'group', 'aria-label': 'Answers' }, options),
  ]);
}

// Memory board. Cards are face down unless flipped or matched.
function memoryBody(step, mem, order) {
  const m = mem || { flipped: [], matched: [] };
  const up = (id) => m.flipped.includes(id) || m.matched.includes(id);
  const byId = Object.fromEntries(step.cards.map((c) => [c.id, c]));
  const layout = order || step.cards.map((c) => c.id);
  const cards = layout.map((id, n) => {
    const card = byId[id];
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
    persistSteps(outcome.firstTry);
    const message = outcome.firstTry ? 'Every pair found, first time. Brilliant!' : 'Every pair found. Well done!';
    const finished = { ...before, memory: { flipped: [], matched: step.cards.map((c) => c.id) } };
    renderStep(false, finished);
    feedback().replaceChildren(teddy('teddy-happy'), el('p', { class: 'fb fb-correct', text: message }), continueButton(outcome.activityDone));
    say(message);
    return;
  }

  renderStep(false);
  const message = outcome.kind === 'match' ? 'A match! Keep going.' : 'Now find its partner.';
  feedback().replaceChildren(el('p', { class: 'fb fb-correct', text: message }));
  say(message);
}

// Drag a piece onto a hole, or tap a piece then tap its hole (touch and keyboard).
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
    }, [
      visualNode(item.visual),
      el('span', { class: 'option-label', text: item.label }),
    ])));
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
      el('span', { class: 'option-label', text: t.label }),
      el('span', { class: 'placed-row' }, placed.map((i) => el('span', { class: 'placed' }, visualNode(i.visual) || el('span', { class: 'placed-text', text: i.label })))),
    ]);
  });

  return el('div', { class: 'drop-area' }, [
    tray,
    el('div', { class: 'zones' }, zones),
  ]);
}

function markSelected() {
  app.querySelectorAll('.drag-item').forEach((b) => {
    const on = b.dataset.item === selectedItem;
    b.setAttribute('aria-pressed', String(on));
  });
}

function dropOn(targetId, itemId) {
  const step = current.steps[session.index];
  const feedback = document.getElementById('feedback');
  if (!itemId) {
    const msg = 'Tap a piece first, then tap its hole.';
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
    const message = `Not that one. Have another look. Hint: ${outcome.hint}`;
    document.getElementById('feedback').replaceChildren(
      el('p', { class: 'fb fb-retry', text: 'Not that one. Have another look.' }),
      el('p', { class: 'hint', text: `Hint: ${outcome.hint}` }),
    );
    say(message);
    return;
  }

  if (outcome.stepDone) {
    persistSteps(outcome.firstTry);
    const isLast = outcome.activityDone;
    const message = outcome.firstTry ? 'Brilliant! Every piece is in the right place.' : 'Well done. Every piece is in the right place now.';
    const finishedView = { ...before, drop: { placed: { ...(before.drop?.placed || {}), [itemId]: targetId } } };
    renderStep(false, finishedView);
    document.getElementById('feedback').replaceChildren(
      teddy('teddy-happy'),
      el('p', { class: 'fb fb-correct', text: message }),
      continueButton(isLast),
    );
    say(message);
    return;
  }

  const remaining = step.items.length - Object.keys(session.drop.placed).length;
  renderStep(false);
  const message = `Yes, that one goes there. ${remaining} to go.`;
  document.getElementById('feedback').replaceChildren(el('p', { class: 'fb fb-correct', text: message }));
  say(message);
}

function choose(optionId) {
  const step = current.steps[session.index];
  const { session: next, outcome } = submit(session, current, optionId);
  session = next;
  const feedback = document.getElementById('feedback');
  const optionButtons = [...app.querySelectorAll('.option')];

  if (outcome.kind === 'retry') {
    feedback.replaceChildren(
      el('p', { class: 'fb fb-retry', text: 'Not quite. Have another look.' }),
      el('p', { class: 'hint', text: `Hint: ${outcome.hint}` }),
    );
    optionButtons.find((b) => b.dataset.option === optionId)?.focus();
    say(`Not quite. Have another look. Hint: ${outcome.hint}`);
    return;
  }

  optionButtons.forEach((b) => { b.disabled = true; });
  const isLast = outcome.activityDone;
  const correctLabel = step.options.find((o) => o.id === step.answer).label;

  if (outcome.kind === 'correct') {
    const message = outcome.firstTry ? 'Well done! You got it first time.' : 'Nice work. You got it.';
    feedback.replaceChildren(
      teddy('teddy-happy'),
      el('p', { class: 'fb fb-correct', text: message }),
      continueButton(isLast),
    );
    say(message);
  } else {
    const message = `That one is tricky. The answer is ${correctLabel}. Let's keep going.`;
    feedback.replaceChildren(
      el('p', { class: 'fb fb-reveal', text: message }),
      continueButton(isLast),
    );
    say(message);
  }

  persistSteps(outcome.firstTry);
}

function persistSteps(firstTry) {
  state = recordStep(state, current.id, current.skill, firstTry, Date.now());
  if (session.done) {
    state = recordCompletion(state, current.id, summarySession(session), Date.now());
  }
  persist();
}

function continueButton(isLast) {
  const btn = el('button', {
    type: 'button', class: 'btn btn-red',
    text: isLast ? 'See your result' : 'Next question',
    onclick: () => (isLast ? renderComplete() : renderStep(false)),
  });
  queueMicrotask(() => btn.focus());
  return btn;
}

// ---------- Completion ----------
function renderComplete() {
  view = 'complete';
  const sum = summarySession(session);
  const title = current.title;
  const headline = sum.correctFirst === sum.total
    ? `You finished "${title}" and got every answer on the first try.`
    : `You finished "${title}". Every try helps you learn.`;
  const detail = `${sum.correctFirst} of ${sum.total} right on the first try.`
    + (sum.hintsUsed ? ` You used ${sum.hintsUsed} ${sum.hintsUsed === 1 ? 'hint' : 'hints'}.` : '');

  const next = recommend(state, ACTIVITIES, 4).find((r) => r.activity.id !== current.id);

  setScreen([
    el('div', { class: 'complete' }, [
      teddy('teddy-large'),
      el('h2', { id: 'prompt', tabindex: '-1', text: 'Well done!' }),
      el('p', { text: headline }),
      el('p', { class: 'muted', text: detail }),
      el('div', { class: 'cta-row' }, [
        next ? el('button', { type: 'button', class: 'btn btn-red', onclick: () => startActivity(next.activity.id),
          text: `Next: ${next.activity.title}` }) : null,
        el('button', { type: 'button', class: 'btn btn-line', onclick: () => renderHome('#home-title'), text: 'All activities' }),
        el('a', { class: 'btn btn-line', href: '/learn/parent.html', text: 'Parent summary' }),
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
    state = updateSettings(state, { audio: !state.settings.audio });
    persist();
    soundBtn.setAttribute('aria-pressed', String(state.settings.audio));
    soundBtn.textContent = state.settings.audio ? 'Voice on' : 'Voice off';
    if (!state.settings.audio) stopSpeaking();
  });
  volumeInput.addEventListener('change', () => {
    state = updateSettings(state, { volume: Number(volumeInput.value) });
    persist();
  });
  replayBtn.addEventListener('click', () => {
    if (!state.settings.audio) return;
    if (spokenKey) narrate(spokenKey, spokenLast, { volume: state.settings.volume });
    else speak(spokenLast || 'Choose an activity.', { volume: state.settings.volume });
  });
}

window.addEventListener('pagehide', stopSpeaking);
window.addEventListener('pointerup', () => { dragItem = null; });

setupAudio();
const requested = new URLSearchParams(window.location.search).get('activity');
if (requested && byId(requested)) startActivity(requested);
else renderHome('#home-title');
