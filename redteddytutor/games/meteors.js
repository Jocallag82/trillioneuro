// Times Table Meteors: answer the lowest meteor's multiplication fact before it lands.
import { shell, boot, sfx, rand, shuffle, pop, shake} from './arcade.js';

const root = document.getElementById('game');
const fx = boot(root);
const LEVELS = [
  { label: '2, 5, 10', value: [2, 5, 10] },
  { label: '3, 4, 6', value: [3, 4, 6] },
  { label: '7, 8, 9', value: [7, 8, 9] },
  { label: 'Mixed 2–12', value: [2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12] },
];

let s = null;
const ui = shell({ root, id: 'meteors', levels: LEVELS, onStart: start });
const stage = ui.stage;
const field = stage.querySelector('.mt-field');
const pad = stage.querySelector('.mt-pad');
const hud = { score: stage.querySelector('[data-hud=score]'), lives: stage.querySelector('[data-hud=lives]'), combo: stage.querySelector('[data-hud=combo]') };
const ship = stage.querySelector('.mt-ship');

function fact(tables) {
  const a = tables[rand(0, tables.length - 1)]; const b = rand(1, 12);
  return Math.random() < 0.5 ? { a, b, ans: a * b } : { a: b, b: a, ans: a * b };
}

function options(f) {
  const set = new Set([f.ans]);
  const near = [f.ans + f.a, f.ans - f.a, f.ans + f.b, f.ans - f.b, (f.a + 1) * f.b, f.a + f.b, f.ans + 1, f.ans - 1, f.ans + 10];
  for (const n of shuffle(near)) { if (set.size >= 4) break; if (n > 0) set.add(n); }
  while (set.size < 4) set.add(rand(1, 144));
  return shuffle([...set]);
}

function start(tables) {
  field.innerHTML = '';
  s = { tables, meteors: [], score: 0, lives: 3, combo: 0, right: 0, wrong: 0, t: 0, spawnIn: 0, speed: 0.045, last: performance.now(), on: true, missed: new Map() };
  paintHud(); spawn(); requestAnimationFrame(loop);
}

function spawn() {
  const f = fact(s.tables);
  const el = document.createElement('div'); el.className = 'mt-meteor';
  el.innerHTML = `<span>${f.a} × ${f.b}</span>`;
  el.style.setProperty('--spin', `${rand(-40, 40)}deg`);
  field.appendChild(el);
  const w = field.clientWidth;
  s.meteors.push({ f, el, x: rand(10, Math.max(12, w - 110)), y: -70, opts: null });
  s.spawnIn = Math.max(1600, 4200 - s.right * 90);
  target();
}

function target() {
  const t = s.meteors.reduce((m, x) => (!m || x.y > m.y ? x : m), null);
  s.meteors.forEach((m) => m.el.classList.toggle('is-target', m === t));
  if (!t) { pad.innerHTML = ''; return; }
  if (pad.dataset.for === String(t.f.a * 1000 + t.f.b + t.x)) return;
  pad.dataset.for = String(t.f.a * 1000 + t.f.b + t.x);
  t.opts = t.opts || options(t.f);
  pad.innerHTML = '';
  t.opts.forEach((n) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'mt-key'; b.textContent = n;
    b.onclick = () => answer(t, n, b); pad.appendChild(b);
  });
}

function answer(m, n, btn) {
  if (!s?.on || !s.meteors.includes(m)) return;
  if (n === m.f.ans) {
    s.combo++; s.right++;
    const pts = 10 * Math.min(1 + Math.floor(s.combo / 3), 5);
    s.score += pts;
    laser(m);
    const r = m.el.getBoundingClientRect(); const sr = stage.getBoundingClientRect();
    fx.burst(r.left - sr.left + r.width / 2, r.top - sr.top + r.height / 2, ['#fbbf24', '#f97316', '#ef4444', '#fde68a', '#fff'], 34, 7);
    pop(stage, r.left - sr.left + r.width / 2, r.top - sr.top, `+${pts}`);
    if (s.combo > 0 && s.combo % 5 === 0) { pop(stage, sr.width / 2, sr.height / 2.5, `${s.combo} in a row!`, 'big'); sfx.level(); } else sfx.good(s.combo);
    m.el.remove(); s.meteors = s.meteors.filter((x) => x !== m);
    s.speed = Math.min(0.12, 0.045 + s.right * 0.0018);
    if (!s.meteors.length) s.spawnIn = Math.min(s.spawnIn, 500);
  } else {
    s.combo = 0; s.wrong++;
    const k = `${Math.min(m.f.a, m.f.b)}×${Math.max(m.f.a, m.f.b)}`; s.missed.set(k, m.f.ans);
    btn.classList.add('is-wrong'); btn.disabled = true; sfx.bad(); shake(m.el);
    m.y += 18; // a wrong answer pulls the meteor closer
  }
  paintHud(); target();
}

function laser(m) {
  const sr = stage.getBoundingClientRect(); const r = m.el.getBoundingClientRect(); const sh = ship.getBoundingClientRect();
  const x1 = sh.left - sr.left + sh.width / 2, y1 = sh.top - sr.top;
  const x2 = r.left - sr.left + r.width / 2, y2 = r.top - sr.top + r.height / 2;
  const l = document.createElement('div'); l.className = 'mt-laser';
  const len = Math.hypot(x2 - x1, y2 - y1);
  l.style.cssText = `left:${x1}px;top:${y1}px;width:${len}px;transform:rotate(${Math.atan2(y2 - y1, x2 - x1)}rad)`;
  stage.appendChild(l); setTimeout(() => l.remove(), 180);
  ship.style.left = `${x2}px`;
}

function loop(now) {
  if (!s?.on) return;
  const dt = Math.min(50, now - s.last); s.last = now;
  const floor = field.clientHeight - 60;
  for (const m of [...s.meteors]) {
    m.y += s.speed * dt;
    m.el.style.transform = `translate(${m.x}px, ${m.y}px)`;
    if (m.y > floor) {
      const k = `${Math.min(m.f.a, m.f.b)}×${Math.max(m.f.a, m.f.b)}`; s.missed.set(k, m.f.ans);
      s.lives--; s.combo = 0; sfx.boom(); shake(stage);
      fx.burst(m.x + 50, floor + 30, ['#94a3b8', '#64748b', '#f97316'], 30, 5);
      m.el.remove(); s.meteors = s.meteors.filter((x) => x !== m);
      paintHud(); target();
      if (s.lives <= 0) return finish();
    }
  }
  s.spawnIn -= dt;
  if (s.spawnIn <= 0 && s.meteors.length < 1 + Math.floor(s.right / 8)) spawn();
  else if (s.spawnIn <= 0) s.spawnIn = 400;
  if (!s.meteors.length && s.spawnIn > 600) s.spawnIn = 600;
  target();
  requestAnimationFrame(loop);
}

function paintHud() {
  hud.score.textContent = s.score;
  hud.lives.textContent = '❤️'.repeat(Math.max(0, s.lives)) + '🖤'.repeat(3 - Math.max(0, s.lives));
  hud.combo.textContent = s.combo >= 3 ? `×${Math.min(1 + Math.floor(s.combo / 3), 5)} combo` : '';
}

function finish() {
  s.on = false; field.innerHTML = ''; pad.innerHTML = ''; pad.dataset.for = '';
  const miss = [...s.missed].slice(0, 4).map(([k, v]) => `${k} = ${v}`).join(', ');
  ui.end(s.score, `${s.right} facts blasted.` + (miss ? ` Practise next: ${miss}.` : ' No misses — try a harder level!'));
}
