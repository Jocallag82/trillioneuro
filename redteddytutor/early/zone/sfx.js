// Play Zone effects: real-sounding pops (Web Audio, no files) and burst/confetti particles.
import { isMuted } from '../games/media.js';

let ctx = null;
const ac = () => (ctx ||= new (window.AudioContext || window.webkitAudioContext)());

// Balloon pop: a sharp filtered noise crack plus a short low thump. `soft` is for bubbles.
export function pop(soft = false) {
  if (isMuted()) return;
  try {
    const c = ac(); const t = c.currentTime;
    const len = Math.floor(c.sampleRate * (soft ? 0.06 : 0.18));
    const buf = c.createBuffer(1, len, c.sampleRate); const d = buf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, soft ? 6 : 4);
    const n = c.createBufferSource(); n.buffer = buf;
    const f = c.createBiquadFilter(); f.type = soft ? 'bandpass' : 'highpass'; f.frequency.value = soft ? 2400 : 900; f.Q.value = soft ? 1.5 : 0.7;
    const g = c.createGain(); g.gain.value = soft ? 0.5 : 0.9;
    n.connect(f).connect(g).connect(c.destination); n.start(t);
    const o = c.createOscillator(); const og = c.createGain();
    o.type = 'sine'; o.frequency.setValueAtTime(soft ? 900 : 180, t); o.frequency.exponentialRampToValueAtTime(soft ? 1800 : 50, t + 0.08);
    og.gain.setValueAtTime(soft ? 0.25 : 0.7, t); og.gain.exponentialRampToValueAtTime(0.0001, t + 0.12);
    o.connect(og).connect(c.destination); o.start(t); o.stop(t + 0.15);
  } catch { /* optional */ }
}

// Little rising "ta-da" for a finished round.
export function chime() {
  if (isMuted()) return;
  try {
    const c = ac(); const t = c.currentTime;
    [523, 659, 784, 1047].forEach((fq, i) => {
      const o = c.createOscillator(); const g = c.createGain(); const s = t + i * 0.09;
      o.type = 'triangle'; o.frequency.value = fq;
      g.gain.setValueAtTime(0.0001, s); g.gain.exponentialRampToValueAtTime(0.35, s + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, s + 0.5);
      o.connect(g).connect(c.destination); o.start(s); o.stop(s + 0.55);
    });
  } catch { /* optional */ }
}

const still = () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
const CONF = ['#e5322d', '#ffb800', '#1e6fd9', '#2bb24c', '#ff7a00', '#8e44ad', '#ff7eb6'];

// Explosion at an element's centre: shards in its colour, confetti, and a "POP!" word.
export function burst(el, color, word = 'POP!') {
  if (still()) return;
  const r = el.getBoundingClientRect();
  const x = r.left + r.width / 2; const y = r.top + r.height / 2;
  const box = document.createElement('div');
  box.className = 'fx'; box.style.left = `${x}px`; box.style.top = `${y}px`;
  let html = word ? `<b class="fx-word">${word}</b><span class="fx-ring" style="--c:${color}"></span>` : '';
  const n = word ? 26 : 12;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.4;
    const dist = (word ? 90 : 50) + Math.random() * (word ? 110 : 50);
    const shard = i % 3 === 0;
    const c = shard ? color : CONF[i % CONF.length];
    html += `<i class="${shard ? 'fx-shard' : 'fx-bit'}" style="--c:${c};--dx:${Math.cos(a) * dist}px;--dy:${Math.sin(a) * dist}px;--r:${Math.random() * 720 - 360}deg;--s:${0.6 + Math.random() * 0.8}"></i>`;
  }
  box.innerHTML = html;
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 1200);
}

// Full-screen confetti shower for a finished round.
export function confetti(count = 70) {
  if (still()) return;
  const box = document.createElement('div');
  box.className = 'fx-rain';
  box.innerHTML = Array.from({ length: count }, (_, i) => `<i style="--x:${Math.random() * 100}vw;--c:${CONF[i % CONF.length]};--d:${Math.random() * 0.6}s;--t:${1.6 + Math.random() * 1.4}s;--w:${6 + Math.random() * 8}px;--sway:${Math.random() * 120 - 60}px;--r:${Math.random() * 1080}deg"></i>`).join('');
  document.body.appendChild(box);
  setTimeout(() => box.remove(), 3800);
}
