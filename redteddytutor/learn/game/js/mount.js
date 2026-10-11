// Game controller. Owns the learning loop, persistence, the accessible DOM controls and the
// Phaser lifecycle. The Phaser scene only draws and reports player actions; every decision
// about correctness, hints, difficulty and progress happens here, using the pure modules.
import {
  LEVELS, BOSS, PASS_MARK, ROUNDS_PER_LEVEL, checkAnswer, makeRound, levelById,
} from './curriculum.js';
import { tierForSkill, adjustForSession, unlockedLevels } from './mastery.js';
import { createSfx } from './audio.js';
import { mulberry32 } from './rng.js';
import { readState, writeState, recordStep, recordCompletion, updateSettings, skillSummaries } from '../../js/progress.js';
import { openRemote, syncStep, syncSession, syncSettings } from '../../js/sync.js';

const BOSS_PLAN = ['count', 'compare', 'shape', 'pattern', 'count', 'compare'];
const CALM_KEY = 'rtt.game.calm.v1';
const SHAPE_LABEL = { circle: 'Circle', square: 'Square', triangle: 'Triangle', rectangle: 'Rectangle' };

// Mounts the bakery game inside `root`. Returns { destroy }.
export async function mountBakery({ root, storage, Phaser = window.Phaser, seed = null }) {
  if (!Phaser) throw new Error('The game engine did not load. Check your connection and refresh the page.');
  // Loaded only once Phaser exists: the scene class extends Phaser.Scene at load time.
  const { BakeryScene } = await import('./bakery.js');
  const $ = (id) => root.querySelector(`#${id}`);
  const stage = $('g-stage');
  const ui = {
    step: $('g-step'), prompt: $('g-prompt'), choices: $('g-choices'), hint: $('g-hint'),
    hintText: $('g-hint-text'), feedback: $('g-feedback'), actions: $('g-actions'), notice: $('g-notice'),
    sound: $('g-sound'), volume: $('g-volume'), calm: $('g-calm'),
  };

  let destroyed = false;
  const timers = new Set();
  const listeners = [];
  const on = (node, type, fn) => { node.addEventListener(type, fn); listeners.push(() => node.removeEventListener(type, fn)); };
  const later = (ms, fn) => {
    const t = setTimeout(() => { timers.delete(t); if (!destroyed) fn(); }, ms);
    timers.add(t);
  };

  let calm = readCalm(storage);
  let state = readState(storage);
  let remote = null;
  try {
    remote = await openRemote(storage);
    if (remote?.state) { state = remote.state; writeState(storage, state); }
  } catch { /* offline or signed out: the device copy is used */ }
  if (destroyed) return { destroy() {} };

  const sfx = createSfx();
  sfx.setEnabled(state.settings.audio);
  sfx.setVolume(state.settings.volume);
  ui.sound.setAttribute('aria-pressed', String(state.settings.audio));
  ui.sound.textContent = state.settings.audio ? 'Sound on' : 'Sound off';
  ui.volume.value = String(state.settings.volume);
  ui.calm.checked = calm;

  let session = null;
  let lastLevelId = LEVELS[0].id;
  let onPick = null;     // current handler for the answer buttons
  let onAction = null;   // current handler for the end-of-level buttons
  on(ui.choices, 'click', (e) => {
    const b = e.target.closest('button[data-choice]');
    if (!b || b.disabled || !onPick) return;
    sfx.play('tap');
    onPick(b.dataset.choice);
  });
  on(ui.actions, 'click', (e) => {
    const b = e.target.closest('button[data-action]');
    if (b && onAction) onAction(b.dataset.action);
  });

  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: stage,
    width: 960,
    height: 600,
    backgroundColor: '#fbf3e7',
    scale: { mode: Phaser.Scale.FIT, autoCenter: Phaser.Scale.CENTER_BOTH },
    audio: { noAudio: true },
    banner: false,
    disableContextMenu: true,
    input: { touch: { capture: true } },
    fps: { target: 60, min: 30 },
    scene: [BakeryScene],
  });
  game.registry.set('calm', calm);

  const gameEvents = [];
  const onGame = (name, fn) => { game.events.on(name, fn); gameEvents.push([name, fn]); };
  onGame('scene-ready', () => { if (!destroyed) showMap(); });
  onGame('map-pick', ({ levelId }) => startLevel(levelId));
  onGame('answer', ({ choice }) => handleAnswer(choice));
  onGame('sfx', (name) => sfx.play(name));
  onGame('next', ({ action }) => handleNext(action));

  // ---------- Persistence ----------
  function persist() {
    if (!writeState(storage, state)) setNotice('Progress could not be saved on this device. You can keep playing.');
  }
  function setNotice(text) { ui.notice.textContent = text; }

  // ---------- Map ----------
  function unlocked() { return unlockedLevels(state.sessions, PASS_MARK); }
  function bestStars(levelId) {
    const best = Math.max(0, ...state.sessions.filter((s) => s.activityId === levelId).map((s) => s.correctFirst));
    return best >= 5 ? 3 : best >= 4 ? 2 : best >= 3 ? 1 : 0;
  }
  function allPassed() { return LEVELS.every((l) => unlocked().includes(l.id) && state.sessions.some((s) => s.activityId === l.id && s.correctFirst >= PASS_MARK)); }

  function showMap() {
    session = null;
    root.dataset.view = 'map';
    root.dataset.level = '';
    const open = unlocked();
    const levels = LEVELS.map((l) => ({ id: l.id, title: l.title, locked: !open.includes(l.id), stars: bestStars(l.id) }));
    const bossOpen = allPassed();
    const bossDone = state.sessions.some((s) => s.activityId === BOSS.id);
    const firstVisit = state.sessions.length === 0;
    game.events.emit('show-map', {
      levels,
      boss: { id: BOSS.id, title: BOSS.title, stars: 0, done: bossDone },
      bossOpen,
      headline: firstVisit ? 'Red Teddy’s Bakery' : 'Teddy’s Bakery',
    });
    ui.step.textContent = firstVisit ? 'Welcome!' : 'The bakery map';
    ui.prompt.textContent = firstVisit
      ? 'Red Teddy needs help opening the shop. Solve each sign to open the bakery.'
      : 'Choose a sign to solve.';
    const choices = levels.filter((l) => !l.locked).map((l) => ({ label: l.title, value: l.id, kind: 'level' }));
    if (bossOpen) choices.push({ label: BOSS.title, value: BOSS.id, kind: 'level' });
    renderChoices(choices, (value) => startLevel(value));
    renderActions([]);
    ui.hint.hidden = true;
    clearFeedback();
  }

  // ---------- Level loop ----------
  function startLevel(levelId) {
    if (destroyed) return;
    const isBoss = levelId === BOSS.id;
    const level = isBoss ? BOSS : levelById(levelId);
    if (!level) return;
    if (!isBoss && !unlocked().includes(levelId)) return;
    if (isBoss && !allPassed()) return;
    lastLevelId = levelId;
    const plan = isBoss ? BOSS_PLAN : Array.from({ length: ROUNDS_PER_LEVEL }, () => level.kind);
    session = {
      level, plan, total: plan.length, index: 0, misses: 0, consecutive: 0, correctFirst: 0, hintsUsed: 0,
      busy: false, round: null, hintLevel: 0,
      rng: mulberry32(seed ?? Date.now()), results: [],
    };
    nextRound();
  }

  function nextRound() {
    const kind = session.plan[session.index];
    const levelOfKind = LEVELS.find((l) => l.kind === kind);
    const base = tierForSkill(state.steps, levelOfKind.skill);
    const tier = adjustForSession(base, session.consecutive);
    session.round = makeRound(kind, tier, session.rng);
    session.misses = 0;
    session.busy = false;
    session.hintLevel = 0;
    root.dataset.view = 'round';
    root.dataset.level = session.level.id;
    root.dataset.index = String(session.index);

    game.events.emit('show-round', {
      round: session.round, index: session.index, total: session.total,
      levelTitle: session.level.title, boss: session.level === BOSS,
    });
    ui.step.textContent = `${session.level.title}  ·  ${session.index + 1} of ${session.total}`;
    ui.prompt.textContent = session.round.prompt;
    ui.hint.hidden = false;
    ui.hint.disabled = false;
    ui.hintText.textContent = '';
    clearFeedback();
    renderActions([]);
    renderChoices(session.round.options.map((opt) => ({ label: labelFor(session.round, opt), value: String(opt), kind: session.round.kind })), (value) => handleAnswer(value));
    ui.prompt.focus({ preventScroll: true });
  }

  function handleAnswer(choice) {
    if (!session || session.busy || !session.round) return;
    const round = session.round;
    const value = String(choice);
    if (!round.options.map(String).includes(value)) return;

    if (checkAnswer(round, value)) {
      const firstTry = session.misses === 0;
      settle(firstTry);
      session.busy = true;
      ui.hint.disabled = true;
      game.events.emit('show-feedback', { type: 'correct' });
      setFeedback(firstTry ? 'Well done! You got it first time.' : 'Nice work. You got it!', 'good');
      later(1500, advance);
      return;
    }

    session.misses += 1;
    markTried(value);
    if (session.misses < 3) {
      const hint = round.hints[Math.min(session.misses - 1, round.hints.length - 1)];
      session.hintsUsed += 1;
      game.events.emit('show-feedback', { type: 'wrong', hint });
      setFeedback('Not quite. Let’s look again.', 'retry');
      ui.hintText.textContent = `Hint: ${hint}`;
      sfx.play('hint');
    } else {
      settle(false);
      session.busy = true;
      ui.hint.disabled = true;
      const answerLabel = labelFor(round, round.answer);
      game.events.emit('show-feedback', { type: 'reveal', answer: answerLabel });
      setFeedback(`The answer is ${answerLabel}. We will try the next one together.`, 'reveal');
      later(2200, advance);
    }
  }

  // Records one round's outcome (what the child did, not the score) and adapts.
  function settle(firstTry) {
    state = recordStep(state, session.level.id, session.round.skill, firstTry, Date.now());
    syncStep(storage, remote, state.steps[state.steps.length - 1]);
    persist();
    session.consecutive = firstTry ? 0 : session.consecutive + 1;
    if (firstTry) session.correctFirst += 1;
    session.results.push(firstTry);
  }

  function advance() {
    session.index += 1;
    if (session.index >= session.total) finishLevel();
    else nextRound();
  }

  function finishLevel() {
    const { level, total, correctFirst, hintsUsed } = session;
    const summary = { total, correctFirst, hintsUsed };
    state = recordCompletion(state, level.id, summary, Date.now());
    syncSession(storage, remote, state.sessions[state.sessions.length - 1]);
    persist();
    session.round = null;
    if (level === BOSS) return showEnding(summary);

    const passed = correctFirst >= PASS_MARK;
    const idx = LEVELS.findIndex((l) => l.id === level.id);
    const next = passed ? LEVELS[idx + 1] : null;
    root.dataset.view = 'result';
    game.events.emit('show-result', {
      passed, correctFirst, total, levelTitle: level.title, nextTitle: next?.title ?? null, boss: false,
    });
    ui.step.textContent = `${level.title}  ·  finished`;
    ui.prompt.textContent = passed
      ? (next ? `Sign finished! Next up: ${next.title}.` : 'Sign finished!')
      : 'Let’s try this sign again. Practice makes the oven hot.';
    ui.hint.hidden = true;
    renderChoices([], null);
    const actions = passed
      ? [{ label: next ? 'Next sign' : 'Back to the map', value: 'map', style: 'red' }]
      : [{ label: 'Try again', value: 'retry', style: 'red' }, { label: 'Back to the map', value: 'map', style: 'line' }];
    renderActions(actions);
    setFeedback(`You got ${correctFirst} of ${total} right first time.`, 'good');
  }

  function showEnding(summary) {
    root.dataset.view = 'ending';
    const lines = [
      `${summary.correctFirst} of ${summary.total} right first time in the Grand Opening.`,
      ...skillSummaries(state).map((s) => `${s.label}: ${Math.round(s.accuracy * 100)}% first time`),
    ];
    game.events.emit('show-ending', { summary: { lines } });
    ui.step.textContent = 'The Grand Opening';
    ui.prompt.textContent = 'The bakery is open! Here is what you practised.';
    ui.hint.hidden = true;
    renderChoices([], null);
    renderActions([{ label: 'Back to the map', value: 'map', style: 'red' }]);
    setFeedback('Well done, Red Teddy is proud of you.', 'good');
  }

  function handleNext(action) {
    if (destroyed) return;
    if (action === 'retry') startLevel(lastLevelId);
    else showMap();
  }

  // ---------- DOM controls (accessible mirror of the canvas) ----------
  function renderChoices(items, pick) {
    onPick = pick;
    ui.choices.replaceChildren(...items.map((item) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `g-choice${item.kind === 'pattern' ? ' is-colour' : ''}`;
      b.dataset.choice = item.value;
      b.textContent = item.label;
      if (item.kind === 'count') b.classList.add('is-number');
      return b;
    }));
    ui.choices.hidden = items.length === 0;
  }

  // A wrong answer stays tappable (a child can try again). It is only struck through,
  // so the third miss can still happen and reveal the answer.
  function markTried(value) {
    const b = ui.choices.querySelector(`[data-choice="${CSS.escape(String(value))}"]`);
    if (b) b.classList.add('is-tried');
  }

  function renderActions(items) {
    onAction = handleNext;
    ui.actions.replaceChildren(...items.map((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `btn ${a.style === 'red' ? 'btn-red' : 'btn-line'}`;
      b.textContent = a.label;
      b.dataset.action = a.value;
      return b;
    }));
  }

  function setFeedback(text, tone) {
    ui.feedback.dataset.tone = tone;
    ui.feedback.textContent = text;
  }
  function clearFeedback() { ui.feedback.textContent = ''; ui.hintText.textContent = ''; }

  function labelFor(round, opt) {
    if (round.kind === 'compare') return opt === 'left' ? 'Left tray' : 'Right tray';
    if (round.kind === 'shape') return SHAPE_LABEL[opt] ?? opt;
    if (round.kind === 'pattern') return opt.charAt(0).toUpperCase() + opt.slice(1);
    return String(opt);
  }

  // ---------- Controls ----------
  on(ui.hint, 'click', () => {
    if (!session?.round || session.busy) return;
    const hints = session.round.hints;
    if (session.hintLevel >= hints.length) return;
    session.hintLevel += 1;
    session.hintsUsed += 1;
    ui.hintText.textContent = `Hint: ${hints[session.hintLevel - 1]}`;
    game.events.emit('show-feedback', { type: 'hint', hint: hints[session.hintLevel - 1] });
    sfx.play('hint');
    if (session.hintLevel >= hints.length) ui.hint.disabled = true;
  });

  on(ui.sound, 'click', () => {
    state = updateSettings(state, { audio: !state.settings.audio });
    persist();
    syncSettings(remote, state.settings).catch(() => {});
    sfx.setEnabled(state.settings.audio);
    ui.sound.setAttribute('aria-pressed', String(state.settings.audio));
    ui.sound.textContent = state.settings.audio ? 'Sound on' : 'Sound off';
    if (state.settings.audio) sfx.play('tap');
  });
  on(ui.volume, 'change', () => {
    state = updateSettings(state, { volume: Number(ui.volume.value) });
    persist();
    syncSettings(remote, state.settings).catch(() => {});
    sfx.setVolume(state.settings.volume);
  });
  on(ui.calm, 'change', () => {
    calm = ui.calm.checked;
    writeCalm(storage, calm);
    game.registry.set('calm', calm);
    setNotice(calm ? 'Calm motion is on. Movement stops and only faces change.' : 'Calm motion is off.');
  });

  // ---------- Lifecycle ----------
  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      timers.forEach((t) => clearTimeout(t));
      timers.clear();
      listeners.forEach((off) => off());
      listeners.length = 0;
      gameEvents.forEach(([name, fn]) => game.events.off(name, fn));
      game.destroy(true, false);
      sfx.close();
      root.dataset.view = '';
      ui.choices.replaceChildren();
      ui.actions.replaceChildren();
    },
  };
}

function readCalm(storage) {
  try {
    if (storage.getItem(CALM_KEY) === '1') return true;
  } catch { /* storage blocked */ }
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
}
function writeCalm(storage, v) {
  try { storage.setItem(CALM_KEY, v ? '1' : '0'); } catch { /* storage blocked */ }
}

