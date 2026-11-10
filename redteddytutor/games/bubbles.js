// Bubble Pop Bonds: pop two bubbles that add up to the target before the 60-second timer ends.
import { shell, boot, sfx, rand, pick, pop, shake, say } from './arcade.js';

const root = document.getElementById('game');
const fx = boot(root);
const LEVELS = [
  { label: 'Make 10', value: { min: 10, max: 10, step: 1 } },
  { label: 'Up to 20', value: { min: 11, max: 20, step: 1 } },
  { label: 'Up to 100', value: { min: 30, max: 100, step: 10 } },
  { label: 'Tricky 100', value: { min: 40, max: 100, step: 1 } },
];
const COLORS = ['#60a5fa', '#f472b6', '#34d399', '#fbbf24', '#a78bfa', '#fb7185', '#22d3ee'];

let s = null;
const ui = shell({ root, id: 'bubbles', levels: LEVELS, onStart: start });
const stage = ui.stage;
const field = stage.querySelector('.bb-field');
const tgt = stage.querySelector('.bb-target');
const hud = { score: stage.querySelector('[data-hud=score]'), time: stage.querySelector('[data-hud=time]'), combo: stage.querySelector('[data-hud=combo]') };

function start(level) {
  field.innerHTML = '';
  s = { level, score: 0, combo: 0, made: 0, time: 60, bubbles: [], sel: null, on: true, last: performance.now() };
  newTarget();
  s.timer = setInterval(() => { s.time--; paint(); if (s.time <= 5 && s.time > 0) sfx.tap(); if (s.time <= 0) finish(); }, 1000);
  paint(); requestAnimationFrame(loop);
}

function newTarget() {
  const { min, max, step } = s.level;
  s.target = Math.round(rand(min, max) / step) * step || min;
  tgt.textContent = s.target; tgt.classList.remove('bb-bump'); void tgt.offsetWidth; tgt.classList.add('bb-bump');
  say(`Make ${s.target}`);
  // clear out and refill so at least two pairs exist
  s.bubbles.forEach((b) => b.el.remove()); s.bubbles = []; s.sel = null;
  for (let i = 0; i < 3; i++) { const a = part(); add(a); add(s.target - a); }
  for (let i = 0; i < 3; i++) add(decoy());
}

function part() { const st = s.level.step === 10 && Math.random() < 0.7 ? 10 : 1; return Math.max(0, Math.round(rand(0, s.target) / st) * st); }
function decoy() { return Math.max(0, Math.min(s.target, part() + pick([-1, 1, 2, -2]))); }

function add(n) {
  const el = document.createElement('button'); el.type = 'button'; el.className = 'bb-bubble'; el.textContent = n;
  const size = 64 + rand(0, 22); const c = pick(COLORS);
  el.style.cssText = `--c:${c};width:${size}px;height:${size}px`;
  const b = { n, el, size, x: rand(4, Math.max(6, field.clientWidth - size - 4)), y: rand(Math.round(field.clientHeight * 0.35), Math.max(10, field.clientHeight - size)), v: 0.02 + Math.random() * 0.03, wob: Math.random() * 6 };
  el.onclick = () => tap(b);
  field.appendChild(el); s.bubbles.push(b);
}

function tap(b) {
  if (!s?.on) return;
  if (!s.sel) { s.sel = b; b.el.classList.add('is-sel'); sfx.tap(); return; }
  if (s.sel === b) { b.el.classList.remove('is-sel'); s.sel = null; return; }
  const a = s.sel; s.sel = null; a.el.classList.remove('is-sel');
  const sr = stage.getBoundingClientRect();
  if (a.n + b.n === s.target) {
    s.combo++; s.made++;
    const pts = 10 + (s.combo - 1) * 5; s.score += pts;
    const r = b.el.getBoundingClientRect();
    for (const q of [a, b]) {
      const r = q.el.getBoundingClientRect();
      fx.burst(r.left - sr.left + r.width / 2, r.top - sr.top + r.height / 2, [getComputedStyle(q.el).getPropertyValue('--c'), '#fff'], 22, 5);
      q.el.remove();
    }
    pop(stage, r.left - sr.left, r.top - sr.top, `${a.n} + ${b.n} = ${s.target}  +${pts}`);
    s.bubbles = s.bubbles.filter((q) => q !== a && q !== b);
    sfx.good(s.combo);
    if (s.made % 3 === 0) { s.time += 3; pop(stage, sr.width / 2, 70, '+3 seconds', 'big'); sfx.level(); newTarget(); }
    else { const p = part(); add(p); add(s.target - p); }
  } else {
    s.combo = 0; sfx.bad(); shake(a.el); shake(b.el);
    pop(stage, b.el.getBoundingClientRect().left - sr.left, b.el.getBoundingClientRect().top - sr.top, `${a.n} + ${b.n} = ${a.n + b.n}`, 'bad');
  }
  paint();
}

function loop(now) {
  if (!s?.on) return;
  const dt = Math.min(50, now - s.last); s.last = now;
  for (const b of s.bubbles) {
    b.y -= b.v * dt; b.wob += dt * 0.002;
    if (b.y < -b.size) { b.y = field.clientHeight + rand(10, 120); b.x = rand(4, Math.max(6, field.clientWidth - b.size - 4)); }
    b.el.style.transform = `translate(${b.x + Math.sin(b.wob) * 10}px, ${b.y}px)`;
  }
  requestAnimationFrame(loop);
}

function paint() {
  hud.score.textContent = s.score; hud.time.textContent = `${Math.max(0, s.time)}s`;
  hud.combo.textContent = s.combo >= 2 ? `${s.combo} in a row` : '';
}

function finish() {
  s.on = false; clearInterval(s.timer); field.innerHTML = '';
  ui.end(s.score, `${s.made} number bonds made.`);
}
