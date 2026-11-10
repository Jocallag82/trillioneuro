// Fraction Pizza Shop: top exactly the fraction of the pizza each customer orders, before they lose patience.
import { shell, boot, sfx, rand, pick, pop, shake, say } from './arcade.js';

const root = document.getElementById('game');
const fx = boot(root);
const LEVELS = [
  { label: 'Halves & quarters', value: { dens: [2, 4], equiv: false } },
  { label: 'Thirds to eighths', value: { dens: [3, 5, 6, 8], equiv: false } },
  { label: 'Equivalent', value: { dens: [2, 3, 4], equiv: true } },
  { label: 'Chef mode', value: { dens: [2, 3, 4, 5, 6, 8, 10, 12], equiv: true } },
];
const PEOPLE = ['🐻', '🦊', '🐼', '🐯', '🐸', '🐨', '🦁', '🐰', '🐵', '🐧'];
const TOPS = [{ e: '🍅', c: '#dc2626' }, { e: '🍄', c: '#a16207' }, { e: '🫑', c: '#16a34a' }, { e: '🧀', c: '#facc15' }];

let s = null;
const ui = shell({ root, id: 'pizza', levels: LEVELS, onStart: start });
const stage = ui.stage;
const svg = stage.querySelector('.fp-pizza');
const order = stage.querySelector('.fp-order');
const face = stage.querySelector('.fp-face');
const pat = stage.querySelector('.fp-patience i');
const serve = stage.querySelector('.fp-serve');
const hud = { score: stage.querySelector('[data-hud=score]'), lives: stage.querySelector('[data-hud=lives]'), served: stage.querySelector('[data-hud=served]') };
serve.onclick = () => check();

function gcd(a, b) { return b ? gcd(b, a % b) : a; }

function start(level) {
  s = { level, score: 0, lives: 3, served: 0, on: true };
  next(); paint(); tick();
}

function next() {
  const { dens, equiv } = s.level;
  const d = pick(dens); const n = rand(1, d - 1);
  let slices = d;
  if (equiv && Math.random() < 0.75) slices = d * pick([2, 3].filter((k) => d * k <= 12)) || d;
  const g = gcd(n, d);
  s.cur = { n: n / g, d: d / g, slices, on: new Set(), top: pick(TOPS), who: pick(PEOPLE), patience: 1, start: performance.now(), life: Math.max(9000, 20000 - s.served * 500) };
  face.textContent = s.cur.who; face.classList.remove('fp-in'); void face.offsetWidth; face.classList.add('fp-in');
  order.innerHTML = `<span class="fp-frac"><b>${s.cur.n}</b><b>${s.cur.d}</b></span><span>${s.cur.top.e} please!</span>`;
  say(`${s.cur.n} ${s.cur.d === 2 ? (s.cur.n > 1 ? 'halves' : 'half') : ordinal(s.cur.d, s.cur.n)} with ${topName(s.cur.top.e)}, please`);
  draw();
}

function ordinal(d, n) {
  const w = { 3: 'third', 4: 'quarter', 5: 'fifth', 6: 'sixth', 8: 'eighth', 10: 'tenth', 12: 'twelfth' }[d] || `${d}th`;
  return n > 1 ? `${w}s` : w;
}
function topName(e) { return { '🍅': 'tomato', '🍄': 'mushroom', '🫑': 'pepper', '🧀': 'extra cheese' }[e]; }

function draw() {
  const { slices, on, top } = s.cur; const R = 100;
  let h = `<circle cx="0" cy="0" r="${R + 10}" fill="#d97706"/><circle cx="0" cy="0" r="${R}" fill="#fde68a"/>`;
  for (let i = 0; i < slices; i++) {
    const a0 = (i / slices) * Math.PI * 2 - Math.PI / 2, a1 = ((i + 1) / slices) * Math.PI * 2 - Math.PI / 2;
    const large = slices === 1 ? 1 : 0;
    const p = `M0 0 L${R * Math.cos(a0)} ${R * Math.sin(a0)} A${R} ${R} 0 ${large} 1 ${R * Math.cos(a1)} ${R * Math.sin(a1)} Z`;
    const am = (a0 + a1) / 2;
    h += `<g class="fp-slice${on.has(i) ? ' is-on' : ''}" data-i="${i}" role="button" tabindex="0" aria-pressed="${on.has(i)}" aria-label="Slice ${i + 1}">`;
    h += `<path d="${p}" fill="${on.has(i) ? '#fca5a5' : '#fde68a'}" stroke="#b45309" stroke-width="2.5"/>`;
    if (on.has(i)) {
      const k = Math.max(1, Math.round(6 / slices * 2));
      for (let j = 0; j < k; j++) {
        const rr = R * (0.35 + 0.4 * ((j * 37) % 10) / 10); const aa = a0 + (a1 - a0) * (0.25 + 0.5 * ((j * 53) % 10) / 10);
        h += `<text x="${rr * Math.cos(aa)}" y="${rr * Math.sin(aa)}" font-size="${slices > 8 ? 13 : 18}" text-anchor="middle" dominant-baseline="central">${top.e}</text>`;
      }
    } else h += `<text x="${R * 0.62 * Math.cos(am)}" y="${R * 0.62 * Math.sin(am)}" class="fp-num" text-anchor="middle" dominant-baseline="central">${i + 1}</text>`;
    h += '</g>';
  }
  svg.innerHTML = h;
  svg.querySelectorAll('.fp-slice').forEach((g) => {
    const t = () => toggle(Number(g.dataset.i));
    g.addEventListener('click', t);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); t(); } });
  });
  stage.querySelector('.fp-count').textContent = `${on.size} of ${slices} slices`;
}

function toggle(i) {
  if (!s?.on || s.cur.done) return;
  const on = s.cur.on; on.has(i) ? on.delete(i) : on.add(i); sfx.tap(); draw();
  const el = svg.querySelector(`[data-i="${i}"]`); el?.focus({ preventScroll: true });
}

function check() {
  if (!s?.on) return;
  const c = s.cur; if (c.done) return; const got = c.on.size; const sr = stage.getBoundingClientRect();
  if (got * c.d === c.n * c.slices) {
    const quick = Math.max(0, Math.round((1 - (performance.now() - c.start) / c.life) * 20));
    const bonus = c.slices !== c.d ? 10 : 0;
    c.done = true; const pts = 20 + quick + bonus; s.score += pts; s.served++;
    sfx.good(s.served); fx.burst(sr.width / 2, sr.height * 0.45, ['#fbbf24', '#ef4444', '#22c55e', '#fff'], 46, 8);
    pop(stage, sr.width / 2, sr.height * 0.3, `${got}/${c.slices} = ${c.n}/${c.d}  +${pts}`, 'big');
    face.textContent = '😋';
    if (s.served % 5 === 0) { sfx.level(); fx.confetti(); }
    paint(); setTimeout(() => s.on && next(), 900);
  } else {
    sfx.bad(); shake(svg);
    const hint = got * c.d < c.n * c.slices ? 'Not enough' : 'Too much';
    pop(stage, sr.width / 2, sr.height * 0.3, `${hint}! ${c.n}/${c.d} of ${c.slices} slices = ${c.n * c.slices / c.d}`, 'bad');
    c.life -= 2500;
  }
}

function tick() {
  if (!s?.on) return;
  const c = s.cur; const left = 1 - (performance.now() - c.start) / c.life;
  pat.style.transform = `scaleX(${Math.max(0, left)})`;
  pat.style.background = left > 0.5 ? '#22c55e' : left > 0.25 ? '#f59e0b' : '#ef4444';
  if (left <= 0 && !c.done) {
    c.done = true;
    s.lives--; sfx.boom(); face.textContent = '😤'; shake(stage);
    const sr = stage.getBoundingClientRect();
    pop(stage, sr.width / 2, sr.height * 0.3, `It was ${c.n}/${c.d} = ${c.n * c.slices / c.d} of ${c.slices} slices`, 'bad');
    paint();
    if (s.lives <= 0) return finish();
    setTimeout(() => s.on && next(), 1400);
  }
  requestAnimationFrame(tick);
}

function paint() {
  hud.score.textContent = s.score; hud.served.textContent = `${s.served} served`;
  hud.lives.textContent = '⭐'.repeat(Math.max(0, s.lives)) + '☆'.repeat(3 - Math.max(0, s.lives));
}

function finish() { s.on = false; ui.end(s.score, `${s.served} pizzas served.`); }
