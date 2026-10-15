// Little World: Look and Name. One big card at a time; a tap names it (text always,
// voice only if the device can speak). No scores, no right or wrong, nothing stored
// or sent. After CARDS_PER_SITTING cards the screen suggests off-screen play.
import { LOOK_CARDS, CARDS_PER_SITTING } from './data.js';
import { svg } from './art.js';
import { speak as say } from '/learn/js/speech.js';

const stage = document.getElementById('look');
const status = document.getElementById('look-status');
const offline = [
  'Find something red in your room and hold it together.',
  'Make animal sounds together: moo, quack, baa.',
  'Sing “Twinkle, Twinkle, Little Star” with hand movements.',
  'Roll a real ball back and forth and say “ball” each time.',
];

function speak(text) {
  if (document.getElementById('look-sound')?.checked === false) return;
  say(text);
}

function shuffled(list) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

let deck = [];
let i = 0;

function start() {
  deck = shuffled(LOOK_CARDS).slice(0, CARDS_PER_SITTING);
  i = 0;
  show();
}

function show() {
  const c = deck[i];
  stage.innerHTML = '';
  const card = document.createElement('button');
  card.type = 'button';
  card.className = `look-card hue-${c.hue}`;
  card.setAttribute('aria-describedby', 'look-hint');
  card.innerHTML = `<span class="look-art">${svg(c.art, c.word)}</span><span class="look-word" hidden>${c.word}</span>`;
  const next = document.createElement('button');
  next.type = 'button';
  next.className = 'btn btn-red btn-lg look-next';
  next.textContent = i + 1 < deck.length ? 'Next picture' : 'All done';
  next.hidden = true;
  card.addEventListener('click', () => {
    card.querySelector('.look-word').hidden = false;
    card.classList.add('is-named');
    status.textContent = c.say;
    speak(c.say);
    next.hidden = false;
  });
  next.addEventListener('click', () => { i += 1; i < deck.length ? show() : done(); });
  const count = document.createElement('p');
  count.className = 'look-count';
  count.textContent = `Picture ${i + 1} of ${deck.length}`;
  stage.append(count, card, next);
  status.textContent = '';
  card.focus({ preventScroll: true });
}

function done() {
  const idea = offline[Math.floor(Math.random() * offline.length)];
  stage.innerHTML = `<div class="look-done"><p class="eyebrow">Screen off time</p>
    <h2 tabindex="-1">Lovely looking! Now let’s play for real.</h2>
    <p class="look-idea">${idea}</p>
    <div class="cta-row"><a class="btn btn-red" href="/little-world#activities">More off-screen ideas</a>
    <button type="button" class="btn btn-line" id="look-again">Start again</button></div></div>`;
  stage.querySelector('h2').focus();
  document.getElementById('look-again').addEventListener('click', start);
  status.textContent = 'All done. Time for off-screen play.';
}

start();
