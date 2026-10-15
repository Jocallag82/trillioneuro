// Red Teddy sticker book. Every finished game earns a sticker; the first game of each
// day earns a golden one. Stored only in this browser (localStorage), never sent.
import { say } from '../games/media.js';

export const STICKERS = [
  ['dog', '🐶'], ['cat', '🐱'], ['cow', '🐮'], ['pig', '🐷'], ['frog', '🐸'], ['lion', '🦁'], ['monkey', '🐵'],
  ['panda', '🐼'], ['koala', '🐨'], ['tiger', '🐯'], ['fox', '🦊'], ['bunny', '🐰'], ['bear', '🐻'], ['penguin', '🐧'],
  ['chick', '🐤'], ['duck', '🦆'], ['owl', '🦉'], ['bee', '🐝'], ['butterfly', '🦋'], ['ladybird', '🐞'], ['turtle', '🐢'],
  ['octopus', '🐙'], ['whale', '🐳'], ['dolphin', '🐬'], ['unicorn', '🦄'], ['dinosaur', '🦖'], ['train', '🚂'],
  ['rocket', '🚀'], ['fire engine', '🚒'], ['tractor', '🚜'], ['boat', '⛵'], ['balloon', '🎈'], ['rainbow', '🌈'],
  ['star', '⭐'], ['sunflower', '🌻'], ['strawberry', '🍓'], ['watermelon', '🍉'], ['ice cream', '🍦'], ['cupcake', '🧁'], ['birthday cake', '🎂'],
];
const KEY = 'rtt.ey.stickers';
const store = (() => { try { return window.localStorage; } catch { return null; } })();

export function load() {
  try { const d = JSON.parse(store?.getItem(KEY) || 'null'); if (d && Array.isArray(d.have)) return { have: d.have, gold: d.gold || 0, day: d.day || '', streak: d.streak || 0, plays: d.plays || 0 }; } catch { /* fresh */ }
  return { have: [], gold: 0, day: '', streak: 0, plays: 0 };
}
function save(d) { try { store?.setItem(KEY, JSON.stringify(d)); } catch { /* optional */ } }
const today = () => new Date().toISOString().slice(0, 10);
const yesterday = () => new Date(Date.now() - 864e5).toISOString().slice(0, 10);

// Awards one sticker. Prefers one not yet collected so the book keeps filling.
export function award() {
  const d = load();
  const missing = STICKERS.filter(([n]) => !d.have.includes(n));
  const pool = missing.length ? missing : STICKERS;
  const [name, emoji] = pool[Math.floor(Math.random() * pool.length)];
  const isNew = !d.have.includes(name);
  if (isNew) d.have.push(name);
  const golden = d.day !== today();
  if (golden) { d.streak = d.day === yesterday() ? d.streak + 1 : 1; d.day = today(); d.gold += 1; }
  d.plays += 1;
  save(d);
  return { name, emoji, isNew, golden, count: d.have.length, total: STICKERS.length, streak: d.streak };
}

// Full-screen celebration with the new sticker; resolves when dismissed.
export function celebrate(s) {
  return new Promise((done) => {
    const el = document.createElement('div');
    el.className = 'stk-pop';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', `New sticker: ${s.name}`);
    const confetti = Array.from({ length: 24 }, (_, i) => `<i style="--x:${(i * 37) % 100}%;--d:${(i % 6) * 0.12}s;--c:${['#e52521', '#ffd500', '#1e6fd9', '#2ba84a', '#ff8c1a', '#8e44ad'][i % 6]}"></i>`).join('');
    el.innerHTML = `<div class="stk-confetti" aria-hidden="true">${confetti}</div>
      <div class="stk-card${s.golden ? ' is-gold' : ''}"><div class="stk-big" aria-hidden="true">${s.emoji}</div>
      <p class="stk-title">${s.golden ? 'Golden sticker!' : s.isNew ? 'New sticker!' : 'Sticker!'}</p>
      <p class="stk-sub">${s.count} of ${s.total} in your sticker book${s.streak > 1 ? ` · ${s.streak} days in a row` : ''}</p>
      <div class="stk-btns"><a class="btn btn-line" href="/early-years/stickers">Sticker book</a><button type="button" class="btn btn-red btn-lg">Play more</button></div></div>`;
    document.body.append(el);
    const close = () => { el.remove(); done(); };
    el.querySelector('button').addEventListener('click', close);
    el.querySelector('button').focus({ preventScroll: true });
    say(s.golden ? `A golden sticker! You got the ${s.name}!` : `Hooray! You got the ${s.name} sticker!`);
  });
}
