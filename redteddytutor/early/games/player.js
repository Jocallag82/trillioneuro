// Red Teddy early-years games: the screen. One page plays any activity:
//   /early-years/games/play?a=<activity-id>[&seed=<n>]
// Rules come from engine.js, words and pictures from content.js. Nothing is stored
// except the sound on/off choice; nothing is sent; no timers or scores.
import { ACTIVITIES, BANDS } from './content.js';
import { rng, shuffle, opt, isCorrect, attempt, fresh, stepsOf, nextInSequence } from './engine.js';
import { shape, dots, frame, feeling, place, art } from './visuals.js';
import { photo, guardImages, say, sound, stop, isMuted, setMuted, audioAvailable, nameOf, soundText } from './media.js';

const $ = (s, r = document) => r.querySelector(s);
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const params = new URLSearchParams(location.search);
const A = ACTIVITIES.find((a) => a.id === params.get('a'));
const seed = Number(params.get('seed')) || Date.now();
const rand = rng(seed);
const root = $('#game');
const bubble = $('#bubble-text');
const status = $('#status');
const band = A && BANDS.find((b) => b.band === A.band);
const backHref = band ? `/early-years/games#${band.slug}` : '/early-years/games';

const PRAISE = ['Yes!', 'Well done!', 'You found it!', 'Great looking!', 'That’s right!', 'Brilliant!'];
const TRY = ['Not quite. Have another look.', 'Hmm, try again.', 'Good try! Look again.'];
const praise = () => PRAISE[Math.floor(rand() * PRAISE.length)];

let spoken = '';
function teddy(text, { speakIt = true, voice = text } = {}) {
  bubble.textContent = text;
  status.textContent = text;
  spoken = voice;
  if (speakIt) say(voice);
}
$('#replay').addEventListener('click', () => { if (lastSound) sound(lastSound, spoken); else say(spoken); });
let lastSound = null;

const soundBtn = $('#sound');
function paintSound() { soundBtn.setAttribute('aria-pressed', String(!isMuted())); soundBtn.querySelector('span').textContent = isMuted() ? 'Sound off' : 'Sound on'; }
soundBtn.addEventListener('click', () => { setMuted(!isMuted()); paintSound(); });
paintSound();
if (!audioAvailable()) $('#replay').hidden = true;

function progress(i, total) {
  const p = $('#progress');
  p.innerHTML = Array.from({ length: total }, (_, k) => `<span class="${k < i ? 'is-done' : k === i ? 'is-now' : ''}"></span>`).join('');
  p.setAttribute('aria-label', `Step ${Math.min(i + 1, total)} of ${total}`);
}

// ── option and visual rendering ──
function face(o) {
  const x = opt(o);
  if (x.asset) {
    if (x.n && x.n > 1) return `<span class="grp" style="--k:${Math.min(x.n, 6)}">${Array.from({ length: x.n }, () => photo(x.asset)).join('')}</span>`;
    return photo(x.asset, { scale: x.scale ?? 1, half: x.half });
  }
  if (x.shape) return `<span class="art">${shape(x.shape, x.color)}</span>`;
  if (x.numeral != null) return `<span class="num">${x.numeral}</span>`;
  if (x.n != null) return `<span class="art">${dots(x.n)}</span>`;
  if (x.face) return `<span class="art">${feeling(x.face)}</span>`;
  if (x.place) return `<span class="art">${place(x.place)}</span>`;
  if (x.art) return `<span class="art">${art(x.art)}</span>`;
  if (x.text) return `<span class="txt">${esc(x.text)}</span>`;
  return esc(x.label);
}
const labelOf = (o) => { const x = opt(o); return x.asset ? (x.label !== x.asset ? x.label : nameOf(x.asset)) : x.label; };

function visual(v) {
  if (!v) return '';
  switch (v.type) {
    case 'asset': return `<div class="vis vis-one">${photo(v.id, { eager: true })}</div>`;
    case 'half': return `<div class="vis vis-one vis-half">${photo(v.asset, { half: 'left', eager: true })}<span class="gap" aria-hidden="true">?</span></div>`;
    case 'sound': return `<div class="vis"><button type="button" class="btn btn-red btn-lg play-sound" data-sound="${esc(v.id)}"><span aria-hidden="true">🔊</span> Play the sound</button></div>`;
    case 'story': return `<div class="vis story"><p>${esc(v.text)}</p></div>`;
    case 'dice': return `<div class="vis vis-one"><span class="art">${dots(v.n, { dice: true })}</span></div>`;
    case 'frame': return `<div class="vis vis-frame"><span class="art">${frame(v.total, v.have)}</span></div>`;
    case 'row': return `<div class="vis row" role="list">${v.items.map((it) => `<span role="listitem" class="cell">${it === '?' ? '<span class="gap" aria-label="missing">?</span>' : face(it)}</span>`).join('')}</div>`;
    case 'rows': return `<div class="vis rows"><p class="rl">Row 1</p><div class="row">${v.a.map((x) => `<span class="cell">${face(x)}</span>`).join('')}</div><p class="rl">Row 2</p><div class="row">${v.b.map((x) => `<span class="cell">${face(x)}</span>`).join('')}</div></div>`;
    case 'compare': return `<div class="vis compare"><div class="grp-box"><span class="grp" style="--k:${Math.min(v.a.n, 6)}">${Array.from({ length: v.a.n }, () => photo(v.a.asset)).join('')}</span></div><div class="grp-box"><span class="grp" style="--k:${Math.min(v.b.n, 6)}">${Array.from({ length: v.b.n }, () => photo(v.b.asset)).join('')}</span></div></div>`;
    case 'sum': {
      const all = Array.from({ length: v.op === '+' ? v.a + v.b : v.a }, (_, i) => `<span class="cell${v.op !== '+' && i >= v.a - v.b ? ' gone' : ''}">${photo(v.asset)}</span>`);
      const body = v.op === '+' ? `<span class="grp-box">${all.slice(0, v.a).join('')}</span><span class="op" aria-hidden="true">+</span><span class="grp-box">${all.slice(v.a).join('')}</span>` : `<span class="grp-box">${all.join('')}</span>`;
      return `<div class="vis sum" aria-label="${v.a} ${v.op === '+' ? 'and' : 'take away'} ${v.b}">${body}</div>`;
    }
    default: return '';
  }
}
function wire(scope) {
  guardImages(scope);
  scope.querySelectorAll('.play-sound').forEach((b) => b.addEventListener('click', () => { lastSound = b.dataset.sound; sound(b.dataset.sound); }));
}

function nextBtn(label, onClick) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'btn btn-red btn-lg next'; b.textContent = label;
  b.addEventListener('click', onClick);
  return b;
}
function hintBtn(getHint) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'btn btn-line hint'; b.innerHTML = '<span aria-hidden="true">💡</span> Hint';
  b.addEventListener('click', () => teddy(getHint()));
  return b;
}

// ── mechanics ──
const RUN = {
  explore() {
    const items = A.items;
    const seen = new Set();
    root.innerHTML = `<div class="grid grid-explore">${items.map((it, i) => `<button type="button" class="card tap" data-i="${i}" aria-label="${esc(it.say)}">${photo(it.asset, { eager: i < 4 })}<span class="cap" hidden>${esc(it.say)}</span></button>`).join('')}</div><div class="actions"></div>`;
    wire(root);
    progress(0, items.length);
    const done = nextBtn('All done', finish);
    $('.actions', root).append(done);
    root.querySelectorAll('.card').forEach((c) => c.addEventListener('click', () => {
      const it = items[+c.dataset.i];
      c.querySelector('.cap').hidden = false;
      c.classList.add('is-on');
      if (it.color) c.dataset.color = it.color;
      seen.add(it);
      progress(seen.size, items.length);
      lastSound = it.sound || null;
      if (it.sound) { teddy(`${soundText(it.sound)} ${it.say}!`, { speakIt: false, voice: it.say }); sound(it.sound, it.say); }
      else teddy(it.say);
    }));
  },

  choose() {
    const qs = A.questions.slice();
    const order = A.ordered ? qs : shuffle(qs, rand);
    let i = 0;
    const show = () => {
      const q = order[i];
      root.dataset.q = String(A.questions.indexOf(q));
      let st = fresh();
      const opts = shuffle(q.options.map(opt), rand);
      root.innerHTML = `${visual(q.show)}<div class="grid grid-${Math.min(opts.length, 4)}${A.band === '1-2' ? ' big' : ''}">${opts.map((o) => `<button type="button" class="card opt" data-id="${esc(o.id)}" aria-label="${esc(labelOf(o))}">${face(o)}<span class="mark" aria-hidden="true"></span></button>`).join('')}</div><div class="actions"></div>`;
      wire(root);
      progress(i, order.length);
      lastSound = q.show?.type === 'sound' ? q.show.id : null;
      const prompt = A.listen && !q.show ? (q.say || q.prompt) : q.prompt;
      const voice = q.show?.type === 'story' ? `${q.show.text} ${q.say || q.prompt}` : (q.say || q.prompt);
      teddy(A.listen && !q.show ? 'Listen…' : prompt, { speakIt: false, voice });
      if (A.listen && !q.show) { bubble.textContent = 'Listen… (tap 🔊 to hear it again)'; $('#bubble').dataset.listen = prompt; }
      if (lastSound) sound(lastSound, voice); else say(voice);
      const actions = $('.actions', root);
      if (!A.forgiving) actions.append(hintBtn(() => q.hint));
      root.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
        if (st.done) return;
        const ok = isCorrect(q, b.dataset.id);
        st = attempt(st, ok, { forgiving: A.forgiving });
        if (ok) {
          b.classList.add('is-right'); b.querySelector('.mark').textContent = '✓';
          teddy(`${praise()} ${A.listen && !q.show ? `${q.say || q.prompt}.` : ''}`.trim());
        } else {
          b.classList.add('is-wrong'); b.querySelector('.mark').textContent = '✕';
          b.setAttribute('aria-disabled', 'true');
          if (st.result === 'reveal') {
            const right = root.querySelector(`.opt[data-id="${CSS.escape(String(q.answer))}"]`);
            right.classList.add('is-right', 'is-shown'); right.querySelector('.mark').textContent = '✓';
            teddy(A.forgiving ? `That’s the ${labelOf(opts.find((o) => o.id === b.dataset.id))}. Here’s the ${labelOf(opts.find((o) => o.id === String(q.answer)))}!` : `Here it is. ${q.hint}`);
          } else if (st.result === 'narrow') {
            const other = [...root.querySelectorAll('.opt')].find((x) => x !== b && !x.classList.contains('is-wrong') && x.dataset.id !== String(q.answer));
            if (other) { other.classList.add('is-wrong', 'is-out'); other.setAttribute('aria-disabled', 'true'); }
            teddy(`${TRY[1]} ${q.hint}`);
          } else teddy(`${TRY[Math.floor(rand() * TRY.length)]} ${q.hint}`);
        }
        if (st.done) {
          root.querySelectorAll('.opt').forEach((x) => x.setAttribute('aria-disabled', 'true'));
          actions.replaceChildren(nextBtn(i + 1 < order.length ? 'Next' : 'Finish', () => { i += 1; i < order.length ? show() : finish(); }));
          actions.querySelector('.next').focus({ preventScroll: true });
        }
      }));
    };
    show();
  },

  count() {
    const rounds = A.rounds;
    let r = 0;
    const show = () => {
      const { asset, n: total } = rounds[r];
      let counted = [];
      let st = fresh();
      const opts = shuffle([total, total + 1, total > 1 ? total - 1 : total + 2].map((v) => ({ id: String(v), numeral: v })), rand);
      root.innerHTML = `<div class="count-field" style="--k:${total > 6 ? 4 : 3}">${Array.from({ length: total }, (_, k) => `<button type="button" class="card cnt" data-k="${k}" aria-label="${esc(nameOf(asset))} ${k + 1}, not counted">${photo(asset, { eager: true })}<span class="badge" aria-hidden="true"></span></button>`).join('')}</div>
        <p class="ask">How many?</p><div class="grid grid-3 nums">${opts.map((o) => `<button type="button" class="card opt" data-id="${o.id}" aria-label="${o.id}"><span class="num">${o.id}</span><span class="mark" aria-hidden="true"></span></button>`).join('')}</div><div class="actions"></div>`;
      wire(root);
      progress(r, rounds.length);
      teddy(`Tap each ${nameOf(asset)} to count it.`);
      const actions = $('.actions', root);
      actions.append(hintBtn(() => 'Touch each one once and say the next number. The last number you say is how many.'));
      root.querySelectorAll('.cnt').forEach((b) => b.addEventListener('click', () => {
        const k = +b.dataset.k;
        if (counted.includes(k)) return;
        counted = [...counted, k];
        b.classList.add('is-counted');
        b.querySelector('.badge').textContent = counted.length;
        b.setAttribute('aria-label', `${nameOf(asset)} counted, number ${counted.length}`);
        say(String(counted.length));
        if (counted.length === total) teddy(`${total}! So how many are there?`);
      }));
      root.querySelectorAll('.opt').forEach((b) => b.addEventListener('click', () => {
        if (st.done) return;
        const ok = b.dataset.id === String(total);
        st = attempt(st, ok);
        if (ok) { b.classList.add('is-right'); b.querySelector('.mark').textContent = '✓'; teddy(`${praise()} There are ${total}.`); }
        else {
          b.classList.add('is-wrong'); b.querySelector('.mark').textContent = '✕'; b.setAttribute('aria-disabled', 'true');
          if (st.result === 'reveal') { const right = root.querySelector(`.opt[data-id="${total}"]`); right.classList.add('is-right', 'is-shown'); right.querySelector('.mark').textContent = '✓'; teddy(`Let’s count together… there are ${total}.`); }
          else teddy('Let’s count again, slowly. Tap each one.');
          if (st.result !== 'reveal') { counted = []; root.querySelectorAll('.cnt').forEach((c, k) => { c.classList.remove('is-counted'); c.querySelector('.badge').textContent = ''; c.setAttribute('aria-label', `${nameOf(asset)} ${k + 1}, not counted`); }); }
        }
        if (st.done) actions.replaceChildren(nextBtn(r + 1 < rounds.length ? 'Next' : 'Finish', () => { r += 1; r < rounds.length ? show() : finish(); }));
      }));
    };
    show();
  },

  match() {
    let r = 0;
    const show = () => {
      const pairs = A.rounds[r];
      const left = shuffle(pairs.map((p, k) => ({ k, o: opt(p[0]) })), rand);
      const right = shuffle(pairs.map((p, k) => ({ k, o: opt(p[1]) })), rand);
      let pick = null; let made = 0; let st = fresh();
      root.innerHTML = `<div class="match"><div class="col">${left.map((x) => `<button type="button" class="card m-l" data-k="${x.k}" aria-label="${esc(labelOf(x.o))}">${face(x.o)}<span class="mark" aria-hidden="true"></span></button>`).join('')}</div>
        <div class="col">${right.map((x) => `<button type="button" class="card m-r" data-k="${x.k}" aria-label="${esc(labelOf(x.o))}">${face(x.o)}<span class="mark" aria-hidden="true"></span></button>`).join('')}</div></div><div class="actions"></div>`;
      wire(root);
      progress(r, A.rounds.length);
      teddy(A.intro);
      const actions = $('.actions', root);
      actions.append(hintBtn(() => (pick ? `Find the partner for ${pick.getAttribute('aria-label')}.` : 'Start with one picture on the left. What goes with it?')));
      root.querySelectorAll('.m-l').forEach((b) => b.addEventListener('click', () => {
        if (b.classList.contains('is-paired')) return;
        root.querySelectorAll('.m-l').forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true'); pick = b;
        teddy(`${b.getAttribute('aria-label')}. Now find its partner.`);
      }));
      root.querySelectorAll('.m-r').forEach((b) => b.addEventListener('click', () => {
        if (b.classList.contains('is-paired')) return;
        if (!pick) { teddy('First tap a picture on the left.'); return; }
        if (pick.dataset.k === b.dataset.k) {
          made += 1; st = fresh();
          for (const x of [pick, b]) { x.classList.add('is-paired', 'is-right'); x.setAttribute('aria-pressed', 'false'); x.setAttribute('aria-disabled', 'true'); x.querySelector('.mark').textContent = String(made); }
          teddy(`${praise()} ${pick.getAttribute('aria-label')} and ${b.getAttribute('aria-label')}.`);
          pick = null;
          if (made === pairs.length) actions.replaceChildren(nextBtn(r + 1 < A.rounds.length ? 'Next' : 'Finish', () => { r += 1; r < A.rounds.length ? show() : finish(); }));
        } else {
          st = attempt(st, false);
          b.classList.add('is-wrong'); setTimeout(() => b.classList.remove('is-wrong'), 700);
          if (st.result === 'reveal') {
            const partner = root.querySelector(`.m-r[data-k="${pick.dataset.k}"]`);
            partner.classList.add('is-shown'); teddy(`This one goes with ${pick.getAttribute('aria-label')}.`); st = fresh();
          } else teddy(`${TRY[0]} What goes with ${pick.getAttribute('aria-label')}?`);
        }
      }));
    };
    show();
  },

  memory() {
    let r = 0;
    const show = () => {
      const ids = A.rounds[r];
      const cards = shuffle([...ids, ...ids], rand);
      let open = []; let found = 0; let previewing = !!A.preview;
      root.innerHTML = `<div class="grid memory grid-${cards.length <= 4 ? 2 : cards.length <= 6 ? 3 : 4}">${cards.map((id, k) => `<button type="button" class="card mem${previewing ? ' is-up' : ''}" data-k="${k}" data-id="${esc(id)}" aria-label="${previewing ? esc(nameOf(id)) : 'Hidden card'}"><span class="front">${photo(id, { eager: true })}</span><span class="back" aria-hidden="true"><img src="/teddy-mark.webp" alt="" width="60" height="60"></span></button>`).join('')}</div><div class="actions"></div>`;
      wire(root);
      progress(r, A.rounds.length);
      const actions = $('.actions', root);
      const all = [...root.querySelectorAll('.mem')];
      if (previewing) {
        teddy('Look at the pictures. When you are ready, tap Peekaboo to hide them.');
        actions.append(nextBtn('Peekaboo! Hide them', () => {
          previewing = false; all.forEach((c) => { c.classList.remove('is-up'); c.setAttribute('aria-label', 'Hidden card'); });
          actions.replaceChildren(); teddy('Find two the same.');
        }));
      } else teddy('Turn over two cards. Find two the same.');
      all.forEach((c) => c.addEventListener('click', () => {
        if (previewing || c.classList.contains('is-found')) return;
        if (open.length === 2) { open.forEach((x) => { x.classList.remove('is-up'); x.setAttribute('aria-label', 'Hidden card'); }); open = []; }
        if (open.includes(c)) return;
        c.classList.add('is-up'); c.setAttribute('aria-label', nameOf(c.dataset.id));
        open.push(c);
        if (open.length === 1) { say(nameOf(c.dataset.id)); return; }
        const [a, b] = open;
        if (a.dataset.id === b.dataset.id) {
          found += 1;
          for (const x of open) { x.classList.add('is-found'); x.setAttribute('aria-disabled', 'true'); }
          open = [];
          teddy(`${praise()} You found a pair: ${nameOf(a.dataset.id)}.`);
          if (found === ids.length) actions.replaceChildren(nextBtn(r + 1 < A.rounds.length ? 'Next' : 'Finish', () => { r += 1; r < A.rounds.length ? show() : finish(); }));
        } else teddy(A.forgiving ? `${nameOf(b.dataset.id)}! Not the same. Tap another card.` : 'Not the same. Remember where they are and try again.');
      }));
    };
    show();
  },

  sort() {
    let r = 0;
    const show = () => {
      const R = A.rounds[r];
      const items = shuffle(R.items.map(([o, bin]) => ({ o: opt(o), bin })), rand);
      let pick = null; let placed = 0; let st = fresh();
      const binFace = (b) => (b.asset ? photo(b.asset) : b.shape ? `<span class="art">${shape(b.shape, 'blue')}</span>` : b.swatch ? `<span class="swatch" data-color="${b.swatch}"></span>` : '');
      root.innerHTML = `<p class="ask">${esc(R.prompt)}</p><div class="pool">${items.map((x, k) => `<button type="button" class="card s-item" data-k="${k}" data-bin="${esc(x.bin)}" aria-label="${esc(labelOf(x.o))}">${face(x.o)}</button>`).join('')}</div>
        <div class="bins bins-${R.bins.length}">${R.bins.map((b) => `<button type="button" class="bin" data-bin="${esc(b.id)}" aria-label="${esc(b.label)} group"><span class="bin-head">${binFace(b)}<span class="bin-label">${esc(b.label)}</span></span><span class="bin-in"></span></button>`).join('')}</div><div class="actions"></div>`;
      wire(root);
      progress(r, A.rounds.length);
      teddy(`${R.prompt} Tap a picture, then tap its group.`);
      const actions = $('.actions', root);
      actions.append(hintBtn(() => (pick ? `Where does the ${pick.getAttribute('aria-label')} go? ${R.prompt}` : 'Tap one picture first.')));
      root.querySelectorAll('.s-item').forEach((b) => b.addEventListener('click', () => {
        root.querySelectorAll('.s-item').forEach((x) => x.setAttribute('aria-pressed', 'false'));
        b.setAttribute('aria-pressed', 'true'); pick = b; st = fresh();
        say(b.getAttribute('aria-label'));
      }));
      root.querySelectorAll('.bin').forEach((bin) => bin.addEventListener('click', () => {
        if (!pick) { teddy('Tap a picture first, then its group.'); return; }
        if (pick.dataset.bin === bin.dataset.bin) {
          placed += 1;
          const copy = document.createElement('span');
          copy.className = 'card s-placed'; copy.innerHTML = pick.innerHTML; copy.setAttribute('role', 'img'); copy.setAttribute('aria-label', pick.getAttribute('aria-label'));
          bin.querySelector('.bin-in').append(copy);
          pick.remove();
          teddy(`${praise()} ${copy.getAttribute('aria-label')}: ${bin.getAttribute('aria-label').replace(' group', '')}.`);
          pick = null;
          if (placed === items.length) actions.replaceChildren(nextBtn(r + 1 < A.rounds.length ? 'Next' : 'Finish', () => { r += 1; r < A.rounds.length ? show() : finish(); }));
        } else {
          st = attempt(st, false);
          bin.classList.add('is-wrong'); setTimeout(() => bin.classList.remove('is-wrong'), 700);
          if (st.result === 'reveal') { const right = root.querySelector(`.bin[data-bin="${CSS.escape(pick.dataset.bin)}"]`); right.classList.add('is-shown'); setTimeout(() => right.classList.remove('is-shown'), 1600); teddy(`It goes in ${right.getAttribute('aria-label').replace(' group', '')}.`); st = fresh(); }
          else teddy(`${TRY[2]} ${R.prompt}`);
        }
      }));
    };
    show();
  },

  sequence() {
    let r = 0;
    const show = () => {
      const R = A.rounds[r];
      const cards = shuffle([...R.steps, ...(R.extra || [])].map(opt), rand);
      const placed = []; let st = fresh();
      root.innerHTML = `<p class="ask">${esc(R.prompt)}</p><ol class="slots">${R.steps.map((_, k) => `<li class="slot" data-k="${k}"><span class="slot-n">${['First', 'Next', 'Then', 'Last'][R.steps.length === 2 ? [0, 3][k] : R.steps.length === 3 ? [0, 1, 3][k] : k]}</span><span class="slot-in"></span>${R.labels ? `<span class="slot-cap" hidden>${esc(R.labels[k])}</span>` : ''}</li>`).join('')}</ol>
        <div class="pool">${cards.map((o) => `<button type="button" class="card q-card" data-id="${esc(o.id)}" aria-label="${esc(labelOf(o))}">${face(o)}</button>`).join('')}</div><div class="actions"></div>`;
      wire(root);
      progress(r, A.rounds.length);
      teddy(A.kind === 'sequence' && A.listen ? R.prompt : `${R.prompt}. What comes first?`);
      const actions = $('.actions', root);
      actions.append(hintBtn(() => {
        const want = opt(R.steps[placed.length]);
        return R.labels ? `Next: ${R.labels[placed.length].toLowerCase()}.` : `Think: what happens ${placed.length ? 'next' : 'first'}? ${placed.length ? '' : `(It is ${labelOf(want)}.)`}`.trim();
      }));
      root.querySelectorAll('.q-card').forEach((b) => b.addEventListener('click', () => {
        if (b.getAttribute('aria-disabled') === 'true') return;
        if (nextInSequence(R, placed, b.dataset.id)) {
          const slot = root.querySelector(`.slot[data-k="${placed.length}"]`);
          placed.push(b.dataset.id); st = fresh();
          b.setAttribute('aria-disabled', 'true'); b.tabIndex = -1;
          slot.querySelector('.slot-in').append(b);
          const cap = slot.querySelector('.slot-cap'); if (cap) cap.hidden = false;
          teddy(R.labels ? R.labels[placed.length - 1] : `${praise()}`);
          if (placed.length === R.steps.length) {
            root.querySelectorAll('.pool .q-card').forEach((x) => x.setAttribute('aria-disabled', 'true'));
            teddy(`${praise()} ${R.labels ? R.labels.join(', then ') + '.' : ''}`);
            actions.replaceChildren(nextBtn(r + 1 < A.rounds.length ? 'Next' : 'Finish', () => { r += 1; r < A.rounds.length ? show() : finish(); }));
          }
        } else {
          st = attempt(st, false);
          b.classList.add('is-wrong'); setTimeout(() => b.classList.remove('is-wrong'), 700);
          if (st.result === 'reveal') { const want = root.querySelector(`.q-card[data-id="${CSS.escape(opt(R.steps[placed.length]).id)}"]`); want.classList.add('is-shown'); teddy(`This one comes ${placed.length ? 'next' : 'first'}.`); st = fresh(); }
          else teddy(`${TRY[1]} What comes ${placed.length ? 'next' : 'first'}?`);
        }
      }));
    };
    show();
  },

  parent() {
    const done = new Set();
    root.innerHTML = `<ul class="prompts">${A.prompts.map((p, k) => `<li class="prompt"><h3>${esc(p.title)}</h3><p>${esc(p.text)}</p><button type="button" class="btn btn-line tried" data-k="${k}" aria-pressed="false">We tried this</button></li>`).join('')}</ul><div class="actions"></div>`;
    progress(0, A.prompts.length);
    teddy(A.intro);
    $('.actions', root).append(nextBtn('Finish', finish));
    root.querySelectorAll('.tried').forEach((b) => b.addEventListener('click', () => {
      const on = b.getAttribute('aria-pressed') !== 'true';
      b.setAttribute('aria-pressed', String(on)); b.textContent = on ? '✓ We tried this' : 'We tried this';
      on ? done.add(b.dataset.k) : done.delete(b.dataset.k);
      progress(done.size, A.prompts.length);
    }));
  },
};

function finish() {
  stop();
  const list = ACTIVITIES.filter((a) => a.band === A.band);
  const next = list[(list.indexOf(A) + 1) % list.length];
  progress(stepsOf(A), stepsOf(A));
  root.innerHTML = `<div class="done"><img src="/teddy-think.webp" alt="" width="120" height="120" class="done-teddy">
    <h2 tabindex="-1">All done. Lovely playing!</h2>
    <p class="done-off"><strong>Off-screen idea:</strong> ${esc(A.offline)}</p>
    <div class="cta-row"><button type="button" class="btn btn-line" id="again">Play again</button>
    <a class="btn btn-red" href="/early-years/games/play?a=${esc(next.id)}">Next: ${esc(next.title)}</a>
    <a class="btn btn-line" href="${backHref}">Back to ${esc(band.name)}</a></div></div>`;
  teddy('All done! Lovely playing.');
  $('#again').addEventListener('click', () => { location.search = `?a=${A.id}`; });
  $('.done h2').focus();
}

function start() {
  if (!A) {
    $('#title').textContent = 'Activity not found';
    root.innerHTML = '<p>That activity does not exist. <a href="/early-years/games">See all games</a>.</p>';
    return;
  }
  document.title = `${A.title} | Red Teddy’s early years games`;
  $('#title').textContent = A.title;
  $('#journey').textContent = `${band.name} · ages ${band.ages}`;
  $('#back').href = backHref;
  $('#about-practise').textContent = A.practising;
  $('#about-together').textContent = A.together;
  $('#about-offline').textContent = A.offline;
  teddy(A.intro, { speakIt: false });
  progress(0, stepsOf(A));
  root.innerHTML = `<div class="intro"><button type="button" class="btn btn-red btn-lg" id="go"><span aria-hidden="true">▶</span> Let’s play</button></div>`;
  $('#go').addEventListener('click', () => RUN[A.kind]());
  $('#go').focus({ preventScroll: true });
}
start();
