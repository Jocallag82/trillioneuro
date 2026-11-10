// Spelling Bee Hive: hear the word, tap the honeycomb letters in order. 60-second rounds.
import { shell, boot, sfx, pick, shuffle, pop, shake, say } from './arcade.js';

const root = document.getElementById('game');
const fx = boot(root);
const W = {
  k1: [['cat', '🐱'], ['dog', '🐶'], ['sun', '☀️'], ['hat', '🎩'], ['bed', '🛏️'], ['pig', '🐷'], ['bus', '🚌'], ['cup', '🥤'], ['fox', '🦊'], ['hen', '🐔'], ['bug', '🐛'], ['map', '🗺️'], ['net', '🥅'], ['pen', '🖊️'], ['box', '📦']],
  g2: [['fish', '🐟'], ['frog', '🐸'], ['ship', '🚢'], ['star', '⭐'], ['tree', '🌳'], ['moon', '🌙'], ['rain', '🌧️'], ['cake', '🎂'], ['bike', '🚲'], ['duck', '🦆'], ['chair', '🪑'], ['snake', '🐍'], ['train', '🚆'], ['sheep', '🐑'], ['clock', '⏰'], ['house', '🏠']],
  g3: [['apple', '🍎'], ['tiger', '🐯'], ['pencil', '✏️'], ['rabbit', '🐰'], ['rocket', '🚀'], ['window', '🪟'], ['spider', '🕷️'], ['garden', '🌷'], ['castle', '🏰'], ['flower', '🌸'], ['turtle', '🐢'], ['monkey', '🐵'], ['bridge', '🌉'], ['candle', '🕯️'], ['planet', '🪐']],
  g4: [['elephant', '🐘'], ['umbrella', '☂️'], ['dinosaur', '🦕'], ['butterfly', '🦋'], ['pineapple', '🍍'], ['telephone', '☎️'], ['penguin', '🐧'], ['kangaroo', '🦘'], ['strawberry', '🍓'], ['octopus', '🐙'], ['mountain', '⛰️'], ['volcano', '🌋'], ['scissors', '✂️'], ['caterpillar', '🐛']],
};
const LEVELS = [
  { label: 'K–1 (3 letters)', value: 'k1' },
  { label: 'Grade 2', value: 'g2' },
  { label: 'Grade 3', value: 'g3' },
  { label: 'Grade 4+', value: 'g4' },
];

let s = null;
const ui = shell({ root, id: 'spelling', levels: LEVELS, onStart: start });
const stage = ui.stage;
const hive = stage.querySelector('.sp-hive');
const slots = stage.querySelector('.sp-slots');
const pic = stage.querySelector('.sp-pic');
const hud = { score: stage.querySelector('[data-hud=score]'), time: stage.querySelector('[data-hud=time]'), streak: stage.querySelector('[data-hud=combo]') };
stage.querySelector('.sp-hear').onclick = () => s?.word && say(s.word);
stage.querySelector('.sp-back').onclick = () => back();
addEventListener('keydown', (e) => {
  if (!s?.on || stage.closest('[hidden]')) return;
  if (e.key === 'Backspace') { e.preventDefault(); back(); return; }
  const k = e.key.toLowerCase();
  if (/^[a-z]$/.test(k)) { const b = [...hive.querySelectorAll('.sp-cell:not([disabled])')].find((x) => x.textContent === k); if (b) b.click(); }
});

function start(level) {
  s = { level, score: 0, streak: 0, done: 0, time: 60, on: true, bag: shuffle(W[level]), missed: [] };
  s.timer = setInterval(() => { s.time--; paint(); if (s.time <= 0) finish(); }, 1000);
  next(); paint();
}

function next() {
  if (!s.bag.length) s.bag = shuffle(W[s.level]);
  const [w, e] = s.bag.pop(); s.word = w; s.typed = []; s.miss = 0;
  pic.textContent = e; pic.classList.remove('sp-in'); void pic.offsetWidth; pic.classList.add('sp-in');
  const extra = shuffle('abcdefghijklmnopqrstuvwxyz'.split('').filter((c) => !w.includes(c))).slice(0, Math.min(3, 9 - w.length > 0 ? 9 - w.length : 1));
  hive.innerHTML = '';
  shuffle([...w.split(''), ...extra]).forEach((c) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'sp-cell'; b.textContent = c;
    b.onclick = () => letter(b, c); hive.appendChild(b);
  });
  paintSlots(); setTimeout(() => s.on && say(w), 250);
}

function letter(b, c) {
  if (!s?.on) return;
  const want = s.word[s.typed.length];
  if (c === want) {
    s.typed.push(b); b.disabled = true; b.classList.add('is-used'); sfx.tap(); paintSlots();
    if (s.typed.length === s.word.length) win();
  } else {
    s.miss++; s.streak = 0; sfx.bad(); shake(b); paint();
    if (s.miss >= 2) { const hint = [...hive.querySelectorAll('.sp-cell:not([disabled])')].find((x) => x.textContent === want); hint?.classList.add('is-hint'); }
  }
}

function back() { const b = s?.typed.pop(); if (b) { b.disabled = false; b.classList.remove('is-used'); paintSlots(); } }

function win() {
  s.streak++; s.done++;
  const pts = s.word.length * 5 + (s.miss ? 0 : 10) + Math.min(s.streak, 10) * 2;
  s.score += pts; if (s.miss) s.missed.push(s.word);
  const sr = stage.getBoundingClientRect();
  fx.burst(sr.width / 2, sr.height * 0.35, ['#fbbf24', '#f59e0b', '#fde68a', '#fff'], 40, 7);
  pop(stage, sr.width / 2, sr.height * 0.25, s.miss ? `+${pts}` : `Perfect! +${pts}`, 'big');
  sfx.good(s.streak); s.time += 2; paint();
  slots.classList.add('is-win'); setTimeout(() => { slots.classList.remove('is-win'); s.on && next(); }, 700);
}

function paintSlots() {
  slots.innerHTML = s.word.split('').map((c, i) => `<span class="${i < s.typed.length ? 'is-on' : ''}">${i < s.typed.length ? c : ''}</span>`).join('');
}

function paint() {
  hud.score.textContent = s.score; hud.time.textContent = `${Math.max(0, s.time)}s`;
  hud.streak.textContent = s.streak >= 2 ? `🐝 ${s.streak} streak` : '';
}

function finish() {
  s.on = false; clearInterval(s.timer); hive.innerHTML = ''; slots.innerHTML = '';
  ui.end(s.score, `${s.done} words spelled.` + (s.missed.length ? ` Practise: ${[...new Set(s.missed)].slice(0, 5).join(', ')}.` : ''));
}
void pick;
