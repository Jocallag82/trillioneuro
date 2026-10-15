// Red Teddy Play Zone: endless, voice-led games for ages 1–5 that need no reading.
// Every round is generated, so no two plays are the same. Difficulty rises as the
// child succeeds and eases off after misses. Every 5 wins earns a sticker.
//   /early-years/play-zone            → the game picker
//   /early-years/play-zone?g=<id>     → one game
import { say, stop, isMuted, setMuted } from '../games/media.js';
import { shape, COLORS } from '../games/visuals.js';
import { award, celebrate, load } from './stickers.js';

const $ = (s, r = document) => r.querySelector(s);
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (a) => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const sample = (a, k) => shuffle(a).slice(0, k);
const wait = (ms) => new Promise((r) => setTimeout(r, ms));
const PRAISE = ['Yes!', 'Well done!', 'Brilliant!', 'Super!', 'Hooray!', 'Great job!', 'You did it!', 'Amazing!'];
const NUM = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

const ANIMALS = [
  ['dog', '🐶', 'Woof woof!'], ['cat', '🐱', 'Meow!'], ['cow', '🐮', 'Moo!'], ['pig', '🐷', 'Oink oink!'],
  ['sheep', '🐑', 'Baa!'], ['duck', '🦆', 'Quack quack!'], ['horse', '🐴', 'Neigh!'], ['frog', '🐸', 'Ribbit!'],
  ['lion', '🦁', 'Roar!'], ['chicken', '🐔', 'Cluck cluck!'], ['owl', '🦉', 'Hoo hoo!'], ['mouse', '🐭', 'Squeak squeak!'],
  ['bee', '🐝', 'Buzz buzz!'], ['monkey', '🐵', 'Ooh ooh, ah ah!'], ['elephant', '🐘', 'Toot toot!'], ['snake', '🐍', 'Hiss!'],
];
const FOODS = [
  ['apple', '🍎', 'red'], ['strawberry', '🍓', 'red'], ['cherries', '🍒', 'red'], ['tomato', '🍅', 'red'],
  ['banana', '🍌', 'yellow'], ['lemon', '🍋', 'yellow'], ['corn', '🌽', 'yellow'], ['cheese', '🧀', 'yellow'],
  ['orange', '🍊', 'orange'], ['carrot', '🥕', 'orange'], ['broccoli', '🥦', 'green'], ['pear', '🍐', 'green'],
  ['cucumber', '🥒', 'green'], ['grapes', '🍇', 'purple'], ['blueberries', '🫐', 'blue'], ['cookie', '🍪', 'brown'],
];
const BALLOON = ['red', 'yellow', 'blue', 'green', 'orange', 'purple'];
const SHAPES = ['circle', 'square', 'triangle', 'star', 'heart', 'rectangle'];
const article = (w) => (/^[aeiou]/.test(w) ? 'an' : 'a');

// ── shell: speech bubble, level, win counter, stickers ──
const S = { level: 1, wins: 0, miss: 0 };
function teddy(text, speak = true) { $('#z-say').textContent = text; if (speak) say(text); }
$('#z-replay').addEventListener('click', () => say($('#z-say').textContent));
const soundBtn = $('#z-sound');
const paint = () => { soundBtn.textContent = isMuted() ? '🔇 Sound off' : '🔊 Sound on'; soundBtn.setAttribute('aria-pressed', String(!isMuted())); };
soundBtn.addEventListener('click', () => { setMuted(!isMuted()); paint(); });
paint();
function stars() { $('#z-stars').innerHTML = Array.from({ length: 5 }, (_, i) => `<span class="${i < S.wins % 5 ? 'on' : ''}">★</span>`).join(''); }
async function win(text) {
  S.wins += 1; S.miss = 0; S.level = Math.min(10, S.level + 1);
  teddy(text || pick(PRAISE));
  stars();
  if (S.wins % 5 === 0) { stars(); await wait(900); $('#z-stars').innerHTML = '★★★★★'.split('').map(() => '<span class="on">★</span>').join(''); await celebrate(award()); stars(); }
  else await wait(1300);
}
function miss() { S.miss += 1; if (S.miss >= 2) S.level = Math.max(1, S.level - 1); }
const stage = () => $('#z-stage');
const bounce = (el) => { el.classList.remove('z-bounce'); void el.offsetWidth; el.classList.add('z-bounce'); };
const wiggle = (el) => { el.classList.remove('z-wiggle'); void el.offsetWidth; el.classList.add('z-wiggle'); };

// ── the games ──
const GAMES = [
  {
    id: 'balloons', icon: '🎈', title: 'Balloon Pop', ages: '1–4', blurb: 'Pop the balloons Red Teddy asks for.',
    async round() {
      const k = Math.min(3 + Math.floor(S.level / 2), 8);
      const target = pick(BALLOON);
      const others = BALLOON.filter((c) => c !== target);
      const want = S.level < 4 ? 1 : Math.min(1 + Math.floor(Math.random() * 3), 3);
      const cols = shuffle([...Array(want).fill(target), ...Array.from({ length: k - want }, () => pick(others))]);
      stage().innerHTML = `<div class="z-sky">${cols.map((c, i) => `<button type="button" class="z-balloon" style="--c:${COLORS[c]};--x:${(i + 0.5) * (100 / k)}%;--t:${(i % 3) * 0.4}s" data-c="${c}" aria-label="${c} balloon"></button>`).join('')}</div>`;
      teddy(want === 1 ? `Pop the ${target} balloon!` : `Pop all the ${target} balloons!`);
      return new Promise((done) => {
        let left = want;
        stage().querySelectorAll('.z-balloon').forEach((b) => b.addEventListener('click', async () => {
          if (b.classList.contains('is-pop')) return;
          if (b.dataset.c === target) {
            b.classList.add('is-pop'); left -= 1;
            if (left === 0) { await win(`Pop! ${pick(PRAISE)}`); done(); } else teddy(`Pop! ${cap(target)}!`);
          } else { wiggle(b); miss(); teddy(`That one is ${b.dataset.c}. Find ${target}!`); }
        }));
      });
    },
  },
  {
    id: 'feed', icon: '🍌', title: 'Feed Red Teddy', ages: '1–5', blurb: 'Red Teddy is hungry! Tap the food Teddy asks for.',
    async round() {
      const k = Math.min(2 + Math.floor(S.level / 2), 6);
      const foods = sample(FOODS.filter((f) => f[2] !== 'brown' || S.level > 5), k);
      const goal = pick(foods);
      const mode = S.level < 4 ? 'name' : S.level < 7 ? pick(['name', 'color']) : pick(['name', 'color', 'count']);
      const n = mode === 'count' ? 2 + Math.floor(Math.random() * 3) : 1;
      const ok = (f) => (mode === 'color' ? f[2] === goal[2] : f[0] === goal[0]);
      stage().innerHTML = `<div class="z-feed"><div class="z-teddy"><img src="/teddy-mark.webp" alt="Red Teddy" width="200" height="200"><span class="z-tummy" aria-live="polite"></span></div>
        <div class="z-plate">${foods.map((f) => `<button type="button" class="z-food" data-f="${f[0]}" aria-label="${f[0]}">${f[1]}</button>`).join('')}</div></div>`;
      const ask = mode === 'color' ? `I'm hungry! Give me something ${goal[2]}!` : mode === 'count' ? `I'm hungry! Give me ${NUM[n]} ${goal[0]}!` : `I'm hungry! Can I have ${goal[0] === 'grapes' || goal[0] === 'cherries' || goal[0] === 'blueberries' ? 'the' : article(goal[0])} ${goal[0]}?`;
      teddy(ask);
      return new Promise((done) => {
        let got = 0;
        const t = stage().querySelector('.z-teddy');
        stage().querySelectorAll('.z-food').forEach((b) => b.addEventListener('click', async () => {
          const f = FOODS.find((x) => x[0] === b.dataset.f);
          if (ok(f)) {
            got += 1; bounce(t);
            stage().querySelector('.z-tummy').textContent = f[1].repeat(got);
            if (mode === 'count' && got < n) { say(NUM[got]); return; }
            await win(mode === 'count' ? `${cap(NUM[n])}! Yum yum, thank you!` : `Yum yum! Thank you!`); done();
          } else { wiggle(b); miss(); teddy(mode === 'color' ? `That's ${f[2]}. I want ${goal[2]}!` : `That's ${article(f[0])} ${f[0]}. I want the ${goal[0]}!`); }
        }));
      });
    },
  },
  {
    id: 'peekaboo', icon: '🙈', title: 'Peekaboo', ages: '1–4', blurb: 'An animal is hiding. Can you find it?',
    async round() {
      const k = Math.min(2 + Math.floor(S.level / 2), 6);
      const a = pick(ANIMALS);
      const at = Math.floor(Math.random() * k);
      const hides = ['🌳', '📦', '🪨', '🌷', '🧺', '⛺'];
      const h = pick(hides);
      stage().innerHTML = `<div class="z-hide">${Array.from({ length: k }, (_, i) => `<button type="button" class="z-spot" data-i="${i}" aria-label="Look here"><span class="z-cover">${h}</span><span class="z-who" hidden>${i === at ? a[1] : ''}</span></button>`).join('')}</div>`;
      teddy(`${a[2]} Where is the ${a[0]}?`);
      return new Promise((done) => {
        stage().querySelectorAll('.z-spot').forEach((b) => b.addEventListener('click', async () => {
          if (b.classList.contains('is-open')) return;
          b.classList.add('is-open'); b.querySelector('.z-who').hidden = false;
          if (+b.dataset.i === at) { bounce(b); await win(`Peekaboo! You found the ${a[0]}!`); done(); }
          else { miss(); teddy(pick(['Not here!', 'Nobody here!', 'Keep looking!'])); }
        }));
      });
    },
  },
  {
    id: 'sounds', icon: '🐮', title: 'Who Says That?', ages: '1–4', blurb: 'Hear a sound and find the animal.',
    async round() {
      const k = Math.min(2 + Math.floor(S.level / 3), 4);
      const set = sample(ANIMALS, k);
      const a = pick(set);
      stage().innerHTML = `<div class="z-grid z-k${k}">${set.map((x) => `<button type="button" class="z-tile" data-a="${x[0]}" aria-label="${x[0]}">${x[1]}</button>`).join('')}</div>`;
      teddy(`Who says ${a[2].replace(/!$/, '')}?`);
      return new Promise((done) => {
        stage().querySelectorAll('.z-tile').forEach((b) => b.addEventListener('click', async () => {
          const x = ANIMALS.find((y) => y[0] === b.dataset.a);
          if (x === a) { bounce(b); await win(`${a[2]} The ${a[0]}!`); done(); }
          else { wiggle(b); miss(); teddy(`The ${x[0]} says ${x[2]}`); }
        }));
      });
    },
  },
  {
    id: 'bubbles', icon: '🫧', title: 'Bubble Counting', ages: '2–5', blurb: 'Pop bubbles and count them out loud.',
    async round() {
      const n = Math.min(1 + Math.floor(Math.random() * (1 + S.level)), 10);
      const total = Math.min(n + 2 + Math.floor(S.level / 3), 14);
      stage().innerHTML = `<div class="z-sky z-bub">${Array.from({ length: total }, (_, i) => `<button type="button" class="z-bubble" style="--x:${8 + ((i * 53) % 84)}%;--y:${10 + ((i * 29) % 70)}%;--t:${(i % 5) * 0.3}s" aria-label="bubble"></button>`).join('')}<p class="z-count" aria-live="polite"></p></div>`;
      teddy(n === 1 ? 'Pop one bubble!' : `Pop ${NUM[n]} bubbles!`);
      return new Promise((done) => {
        let c = 0;
        stage().querySelectorAll('.z-bubble').forEach((b) => b.addEventListener('click', async () => {
          if (b.classList.contains('is-pop') || c >= n) return;
          b.classList.add('is-pop'); c += 1;
          stage().querySelector('.z-count').textContent = c;
          if (c === n) { await win(`${cap(NUM[n])}! ${pick(PRAISE)}`); done(); } else say(cap(NUM[c]));
        }));
      });
    },
  },
  {
    id: 'shapes', icon: '🔺', title: 'Shape Sorter', ages: '2–5', blurb: 'Put each shape in the right hole.',
    async round() {
      const k = Math.min(2 + Math.floor(S.level / 3), 5);
      const set = sample(SHAPES.slice(0, S.level < 5 ? 4 : 6), k);
      const s = pick(set);
      const col = pick(BALLOON);
      stage().innerHTML = `<div class="z-sorter"><div class="z-piece">${shape(s, col)}</div><div class="z-holes">${shuffle(set).map((x) => `<button type="button" class="z-hole" data-s="${x}" aria-label="${x} hole">${shape(x, '#3a2a24')}</button>`).join('')}</div></div>`;
      teddy(`Where does the ${s} go?`);
      return new Promise((done) => {
        stage().querySelectorAll('.z-hole').forEach((b) => b.addEventListener('click', async () => {
          if (b.dataset.s === s) { stage().querySelector('.z-piece').classList.add('is-in'); bounce(b); await win(`Plop! The ${s} goes in!`); done(); }
          else { wiggle(b); miss(); teddy(`That's the ${b.dataset.s} hole. Find the ${s}!`); }
        }));
      });
    },
  },
  {
    id: 'colouring', icon: '🖍️', title: 'Colouring', ages: '1–5', blurb: 'Pick a crayon and tap to colour the picture.',
    async round() {
      const p = PICTURES[(S.wins + Math.floor(Math.random() * PICTURES.length)) % PICTURES.length];
      const pal = ['red', 'yellow', 'blue', 'green', 'orange', 'purple', 'pink', 'brown'];
      const HEX = { ...COLORS, pink: '#ff7eb6', brown: '#8b5a2b' };
      let cur = 'red';
      stage().innerHTML = `<div class="z-colour"><div class="z-pic">${p.svg}</div><div class="z-pal">${pal.map((c) => `<button type="button" class="z-crayon${c === cur ? ' is-on' : ''}" data-c="${c}" style="--c:${HEX[c]}" aria-label="${c}"></button>`).join('')}</div>
        <button type="button" class="btn btn-red btn-lg z-done">I'm finished!</button></div>`;
      teddy(`Let's colour ${p.name}! Pick a colour.`);
      return new Promise((done) => {
        stage().querySelectorAll('.z-crayon').forEach((b) => b.addEventListener('click', () => {
          stage().querySelectorAll('.z-crayon').forEach((x) => x.classList.remove('is-on'));
          b.classList.add('is-on'); cur = b.dataset.c; say(cap(cur));
        }));
        stage().querySelectorAll('[data-r]').forEach((r) => r.addEventListener('click', () => { r.setAttribute('fill', HEX[cur]); }));
        stage().querySelector('.z-done').addEventListener('click', async () => { await win(`What a beautiful picture!`); done(); });
      });
    },
  },
  {
    id: 'music', icon: '🎹', title: 'Animal Band', ages: '1–5', blurb: 'Tap the keys to make music with the animals.',
    async round() {
      const keys = [['red', 262, '🐶'], ['orange', 294, '🐱'], ['yellow', 330, '🐤'], ['green', 349, '🐸'], ['blue', 392, '🐳'], ['purple', 440, '🦄'], ['red', 494, '🐷'], ['orange', 523, '🦁']];
      stage().innerHTML = `<div class="z-piano">${keys.map((k, i) => `<button type="button" class="z-key" data-i="${i}" style="--c:${COLORS[k[0]]}" aria-label="${k[0]} key"><span>${k[2]}</span></button>`).join('')}</div><p class="z-note">Tap the keys! A sticker every 30 notes.</p>`;
      teddy('Let\'s make music! Tap the keys.');
      return new Promise((done) => {
        let taps = 0;
        stage().querySelectorAll('.z-key').forEach((b) => b.addEventListener('pointerdown', async () => {
          tone(keys[+b.dataset.i][1]); bounce(b.querySelector('span')); taps += 1;
          if (taps === 30) { await win('What lovely music!'); done(); }
        }));
      });
    },
  },
  {
    id: 'big-small', icon: '🐘', title: 'Big and Small', ages: '2–4', blurb: 'Find the big one or the small one.',
    async round() {
      const a = pick(ANIMALS);
      const k = S.level < 4 ? 2 : 3;
      const sizes = shuffle(k === 2 ? ['big', 'small'] : ['big', 'small', 'middle']);
      const goal = pick(['big', 'small']);
      const px = { big: 9, middle: 5.5, small: 3 };
      stage().innerHTML = `<div class="z-sizes">${sizes.map((s) => `<button type="button" class="z-size" data-s="${s}" aria-label="${s} ${a[0]}" style="font-size:${px[s]}rem">${a[1]}</button>`).join('')}</div>`;
      teddy(`Find the ${goal} ${a[0]}!`);
      return new Promise((done) => {
        stage().querySelectorAll('.z-size').forEach((b) => b.addEventListener('click', async () => {
          if (b.dataset.s === goal) { bounce(b); await win(`Yes! That's the ${goal} ${a[0]}!`); done(); }
          else { wiggle(b); miss(); teddy(`That one is ${b.dataset.s === 'middle' ? 'in the middle' : b.dataset.s}. Find the ${goal} one!`); }
        }));
      });
    },
  },
];

// Colouring pages: every region with data-r can be filled.
const L = 'stroke="#3a2a24" stroke-width="4" stroke-linejoin="round"';
const R = (d, tag = 'path') => (tag === 'path' ? `<path data-r d="${d}" fill="#fff" ${L}/>` : `<${tag} data-r ${d} fill="#fff" ${L}/>`);
const PICTURES = [
  { name: 'a house', svg: `<svg viewBox="0 0 300 300" role="img" aria-label="house">${R('x="0" y="240" width="300" height="60"', 'rect')}${R('cx="250" cy="50" r="30"', 'circle')}${R('x="60" y="130" width="180" height="120"', 'rect')}${R('M40 135L150 50l110 85z')}${R('x="130" y="180" width="40" height="70"', 'rect')}${R('x="78" y="155" width="38" height="38"', 'rect')}${R('x="184" y="155" width="38" height="38"', 'rect')}</svg>` },
  { name: 'a fish', svg: `<svg viewBox="0 0 300 300" role="img" aria-label="fish">${R('M60 150c40-70 140-80 190 0-50 80-150 70-190 0z')}${R('M60 150L15 105v90z')}${R('M140 95c20-30 50-30 60-10z')}${R('cx="40" cy="60" r="14"', 'circle')}${R('cx="70" cy="35" r="9"', 'circle')}<circle cx="205" cy="140" r="9" fill="#3a2a24"/>${R('M120 120c15 20 15 40 0 60')}${R('M150 115c15 25 15 45 0 70')}</svg>` },
  { name: 'a flower', svg: `<svg viewBox="0 0 300 300" role="img" aria-label="flower">${R('x="140" y="150" width="20" height="100"', 'rect')}${R('M150 220c-40-30-70-10-70 0 30 15 55 10 70 0z')}${R('M150 200c40-30 70-10 70 0-30 15-55 10-70 0z')}${['150,60', '205,90', '205,150', '150,180', '95,150', '95,90'].map((p) => R(`cx="${p.split(',')[0]}" cy="${p.split(',')[1]}" r="32"`, 'circle')).join('')}${R('cx="150" cy="120" r="30"', 'circle')}${R('M100 250h100l-15 45h-70z')}</svg>` },
  { name: 'a car', svg: `<svg viewBox="0 0 300 300" role="img" aria-label="car">${R('M30 190v-40l40-10 30-45h100l40 45 30 10v40z')}${R('M110 105h40v35h-65z')}${R('M160 105h35l30 35h-65z')}${R('cx="85" cy="200" r="28"', 'circle')}${R('cx="215" cy="200" r="28"', 'circle')}${R('x="0" y="228" width="300" height="72"', 'rect')}</svg>` },
  { name: 'a butterfly', svg: `<svg viewBox="0 0 300 300" role="img" aria-label="butterfly">${R('M145 140C100 40 30 50 40 110s70 50 105 30z')}${R('M155 140C200 40 270 50 260 110s-70 50-105 30z')}${R('M145 155c-50 0-90 30-70 75 20 30 60 0 70-60z')}${R('M155 155c50 0 90 30 70 75-20 30-60 0-70-60z')}${R('x="140" y="90" width="20" height="140" rx="10"', 'rect')}${R('cx="90" cy="100" r="15"', 'circle')}${R('cx="210" cy="100" r="15"', 'circle')}</svg>` },
  { name: 'a rocket', svg: `<svg viewBox="0 0 300 300" role="img" aria-label="rocket">${R('M150 20c40 40 50 100 40 170h-80c-10-70 0-130 40-170z')}${R('cx="150" cy="100" r="22"', 'circle')}${R('M110 150l-35 50 35-5z')}${R('M190 150l35 50-35-5z')}${R('M120 195h60l-10 25h-40z')}${R('M130 225c5 25 15 45 20 55 5-10 15-30 20-55z')}</svg>` },
  { name: 'a teddy', svg: `<svg viewBox="0 0 300 300" role="img" aria-label="teddy">${R('cx="95" cy="70" r="30"', 'circle')}${R('cx="205" cy="70" r="30"', 'circle')}${R('cx="150" cy="215" rx="75" ry="70"', 'ellipse')}${R('cx="150" cy="110" r="65"', 'circle')}${R('cx="150" cy="135" rx="30" ry="22"', 'ellipse')}<circle cx="125" cy="100" r="7" fill="#3a2a24"/><circle cx="175" cy="100" r="7" fill="#3a2a24"/><ellipse cx="150" cy="128" rx="9" ry="6" fill="#3a2a24"/>${R('cx="150" cy="225" rx="35" ry="30"', 'ellipse')}</svg>` },
  { name: 'a rainbow', svg: `<svg viewBox="0 0 300 300" role="img" aria-label="rainbow">${[130, 112, 94, 76, 58].map((r) => R(`M${150 - r} 220a${r} ${r} 0 0 1 ${2 * r} 0h-18a${r - 18} ${r - 18} 0 0 0 ${-2 * (r - 18)} 0z`)).join('')}${R('M10 230c0-25 40-30 50-12 15-10 40 0 35 20z')}${R('M205 230c0-25 40-30 50-12 15-10 40 0 35 20z')}</svg>` },
];

// Soft xylophone-like note (Web Audio, no files).
let ctx = null;
function tone(f) {
  if (isMuted()) return;
  try {
    ctx ||= new (window.AudioContext || window.webkitAudioContext)();
    const o = ctx.createOscillator(); const g = ctx.createGain();
    o.type = 'triangle'; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.9);
    o.connect(g).connect(ctx.destination); o.start(); o.stop(ctx.currentTime + 1);
  } catch { /* optional */ }
}

// ── pages ──
function picker() {
  const d = load();
  $('#z-title').textContent = 'Red Teddy’s Play Zone';
  $('#z-say').textContent = 'Hello! Pick a game to play!';
  $('#z-stars').hidden = true;
  stage().innerHTML = `<p class="z-book"><a class="btn btn-line" href="/early-years/stickers">⭐ My sticker book (${d.have.length})</a></p>
    <ul class="z-pick">${GAMES.map((g) => `<li><a class="z-card" href="?g=${g.id}"><span class="z-ico" aria-hidden="true">${g.icon}</span><span class="z-name">${g.title}</span><span class="z-ages">Ages ${g.ages}</span></a></li>`).join('')}</ul>`;
}
async function play(g) {
  document.title = `${g.title} | Red Teddy’s Play Zone`;
  $('#z-title').textContent = g.title;
  stars();
  stage().innerHTML = `<div class="z-start"><span class="z-ico-big" aria-hidden="true">${g.icon}</span><button type="button" class="btn btn-red btn-lg" id="z-go">▶ Let’s play!</button></div>`;
  teddy(g.blurb, false);
  $('#z-go').focus({ preventScroll: true });
  await new Promise((r) => $('#z-go').addEventListener('click', r, { once: true }));
  for (;;) { await g.round(); stop(); }
}
const id = new URLSearchParams(location.search).get('g');
const game = GAMES.find((g) => g.id === id);
if (game) play(game); else picker();
export { GAMES };
