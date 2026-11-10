// Shared arcade kit for the free games: sound, particles, speech, best scores, HUD.
// No network, no accounts. Best scores live in localStorage (wrapped; works without it).

let ctx = null;
let muted = false;
try { muted = localStorage.getItem('rtt.arcade.muted') === '1'; } catch {}

function audio() {
  if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { return null; } }
  if (ctx.state === 'suspended') ctx.resume();
  return ctx;
}

function tone(freq, dur = 0.12, type = 'sine', vol = 0.18, slide = 0, delay = 0) {
  if (muted) return;
  const a = audio(); if (!a) return;
  const t = a.currentTime + delay;
  const o = a.createOscillator(); const g = a.createGain();
  o.type = type; o.frequency.setValueAtTime(freq, t);
  if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(40, freq + slide), t + dur);
  g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur);
  o.connect(g).connect(a.destination); o.start(t); o.stop(t + dur + 0.02);
}

export const sfx = {
  good(combo = 0) { const b = 520 + Math.min(combo, 10) * 40; tone(b, 0.1, 'triangle'); tone(b * 1.5, 0.14, 'triangle', 0.16, 0, 0.07); },
  bad() { tone(220, 0.25, 'sawtooth', 0.1, -120); },
  boom() { tone(160, 0.35, 'square', 0.12, -120); },
  tap() { tone(700, 0.05, 'sine', 0.1); },
  level() { [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.18, 'triangle', 0.16, 0, i * 0.1)); },
  over() { [392, 330, 262].forEach((f, i) => tone(f, 0.25, 'triangle', 0.14, 0, i * 0.16)); },
};

export function setMuted(v) { muted = v; try { localStorage.setItem('rtt.arcade.muted', v ? '1' : '0'); } catch {} }
export function isMuted() { return muted; }

export function say(text) {
  if (muted || !('speechSynthesis' in window)) return;
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text); u.rate = 0.9; u.pitch = 1.1;
    speechSynthesis.speak(u);
  } catch {}
}

export function best(game, score) {
  const k = `rtt.arcade.best.${game}`;
  let b = 0;
  try { b = Number(localStorage.getItem(k)) || 0; } catch {}
  if (score != null && score > b) { try { localStorage.setItem(k, String(score)); } catch {} return { best: score, isNew: true }; }
  return { best: b, isNew: false };
}

export const rand = (a, b) => a + Math.floor(Math.random() * (b - a + 1));
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function shuffle(a) { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }

// Particle burst on a full-stage overlay canvas.
export class Fx {
  constructor(stage) {
    this.c = document.createElement('canvas'); this.c.className = 'ar-fx'; stage.appendChild(this.c);
    this.g = this.c.getContext('2d'); this.p = []; this.stage = stage; this.running = false;
    this.resize(); addEventListener('resize', () => this.resize());
  }
  resize() { const r = this.stage.getBoundingClientRect(); const d = devicePixelRatio || 1; this.c.width = r.width * d; this.c.height = r.height * d; this.g.setTransform(d, 0, 0, d, 0, 0); }
  burst(x, y, colors = ['#f3d79c', '#e5484d', '#7dd3fc', '#86efac', '#fff'], n = 26, speed = 6) {
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2; const s = speed * (0.3 + Math.random());
      this.p.push({ x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 1, r: 2 + Math.random() * 4, c: pick(colors), sq: Math.random() < 0.4 });
    }
    if (!this.running) { this.running = true; requestAnimationFrame(() => this.tick()); }
  }
  confetti() { const r = this.stage.getBoundingClientRect(); for (let i = 0; i < 6; i++) setTimeout(() => this.burst(rand(40, r.width - 40), rand(40, r.height / 2), undefined, 40, 8), i * 120); }
  tick() {
    const g = this.g; const r = this.stage.getBoundingClientRect();
    g.clearRect(0, 0, r.width, r.height);
    this.p = this.p.filter((q) => (q.life -= 0.018) > 0);
    for (const q of this.p) {
      q.x += q.vx; q.y += q.vy; q.vy += 0.22; q.vx *= 0.98;
      g.globalAlpha = q.life; g.fillStyle = q.c;
      if (q.sq) g.fillRect(q.x, q.y, q.r * 1.6, q.r * 1.6); else { g.beginPath(); g.arc(q.x, q.y, q.r, 0, 7); g.fill(); }
    }
    g.globalAlpha = 1;
    if (this.p.length) requestAnimationFrame(() => this.tick()); else this.running = false;
  }
}

// Floating "+10" / "x3 combo" text.
export function pop(stage, x, y, text, cls = '') {
  const el = document.createElement('div'); el.className = `ar-pop ${cls}`; el.textContent = text;
  const w = stage.clientWidth; el.style.left = `${Math.max(90, Math.min(w - 90, x))}px`; el.style.top = `${Math.max(50, y)}px`; stage.appendChild(el);
  setTimeout(() => el.remove(), 900);
}

export function shake(el) { el.classList.remove('ar-shake'); void el.offsetWidth; el.classList.add('ar-shake'); }

// Standard shell: start screen, HUD, end screen. Game supplies start(level) and returns nothing;
// it calls shell.end(score, summary) when the round finishes.
export function shell({ root, id, title, levels, onStart }) {
  const stage = root.querySelector('.ar-stage');
  const start = root.querySelector('.ar-start');
  const end = root.querySelector('.ar-end');
  const mute = root.querySelector('.ar-mute');
  const sel = start.querySelector('.ar-levels');
  let level = levels[0].value;
  levels.forEach((l, i) => {
    const b = document.createElement('button'); b.type = 'button'; b.className = 'ar-chip'; b.textContent = l.label;
    b.setAttribute('aria-pressed', i === 0 ? 'true' : 'false');
    b.onclick = () => { level = l.value; sel.querySelectorAll('.ar-chip').forEach((c) => c.setAttribute('aria-pressed', String(c === b))); sfx.tap(); };
    sel.appendChild(b);
  });
  const paintBest = () => { start.querySelector('.ar-best').textContent = `Best: ${best(id).best}`; };
  paintBest();
  const paintMute = () => { mute.textContent = isMuted() ? '🔇' : '🔊'; mute.setAttribute('aria-label', isMuted() ? 'Turn sound on' : 'Turn sound off'); };
  paintMute();
  mute.onclick = () => { setMuted(!isMuted()); paintMute(); };
  const go = () => { audio(); start.hidden = true; end.hidden = true; stage.focus({ preventScroll: true }); onStart(level); };
  start.querySelector('.ar-go').onclick = go;
  end.querySelector('.ar-again').onclick = go;
  end.querySelector('.ar-menu').onclick = () => { end.hidden = true; start.hidden = false; paintBest(); };
  return {
    stage,
    end(score, summary) {
      const r = best(id, score);
      end.querySelector('.ar-score').textContent = score;
      end.querySelector('.ar-sum').textContent = summary;
      end.querySelector('.ar-new').hidden = !r.isNew;
      end.querySelector('.ar-bestv').textContent = r.best;
      end.hidden = false;
      if (r.isNew && score > 0) { sfx.level(); fx.confetti(); } else sfx.over();
      end.querySelector('.ar-again').focus({ preventScroll: true });
    },
  };
}

export let fx = null;
export function boot(root) { const stage = root.querySelector('.ar-stage'); fx = new Fx(stage); return fx; }
