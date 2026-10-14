/* Builds the early-years games hub (/early-years/games) and the player shell
   (/early-years/games/play) from redteddytutor/early/games/content.js. Static HTML,
   no runtime build. Re-run after editing content.js: node scripts/build-early-games.mjs */
import { readFileSync, writeFileSync } from 'node:fs';
import { ACTIVITIES, BANDS, STRANDS } from '../redteddytutor/early/games/content.js';

const DIR = new URL('../redteddytutor/early/games/', import.meta.url);
const SITE = 'https://www.redteddytutor.com';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Shared header and footer come from an existing early-years page so the brand stays identical.
const shell = readFileSync(new URL('../redteddytutor/early/little-world-play.html', import.meta.url), 'utf8');
const head = shell.slice(0, shell.indexOf('<main id="main">'));
const foot = shell.slice(shell.indexOf('</main>'), shell.indexOf('<script type="module"'));

function page({ path, title, desc, robots, body, script = '' }) {
  const h = head
    .replace(/<title>[^<]*<\/title>/, `<title>${esc(title)}</title>`)
    .replace(/(<meta name="description" content=")[^"]*/, `$1${esc(desc)}`)
    .replace(/(<meta property="og:description" content=")[^"]*/, `$1${esc(desc)}`)
    .replace(/(<meta property="og:title" content=")[^"]*/, `$1${esc(title)}`)
    .replace(/(<meta name="robots" content=")[^"]*/, `$1${robots}`)
    .replace(/(<link rel="canonical" href=")[^"]*/, `$1${SITE}${path}`)
    .replace(/(<meta property="og:url" content=")[^"]*/, `$1${SITE}${path}`)
    .replace('<link rel="stylesheet" href="/early/early.css">', '<link rel="stylesheet" href="/early/early.css">\n<link rel="stylesheet" href="/early/games/games.css">');
  return `${h}<main id="main">\n${body}\n${foot}${script}</body>\n</html>\n`;
}

const KIND = { explore: 'Tap and hear', choose: 'Find it', count: 'Touch and count', match: 'Match pairs', memory: 'Memory', sort: 'Sort', sequence: 'Put in order', parent: 'Off-screen, together' };
const GUIDE = {
  '1-2': ['Sit together and hold the screen between you. Name what you see.', 'Short is best: one or two games, then play with the real things.', 'There are no wrong answers here. A wrong tap simply shows the right picture.', 'If your child loses interest, stop. Pointing, babbling and copying sounds all count.'],
  '2-3': ['Name every picture before your child chooses.', 'Simplify: cover one choice with your hand so there are only two.', 'Stretch: ask “Why?” after each answer.', 'Hints come after a miss; the answer is shown kindly after three tries.'],
  '3-4': ['Count, clap and say sounds out loud together.', 'Simplify: do one round, then play the off-screen idea.', 'Stretch: ask your child to explain or to be the teacher.', 'Mistakes are part of learning. Nothing is scored or recorded.'],
  '4-6': ['Pick one strand at a time: reading, math, thinking or everyday skills.', 'Simplify: read the question aloud and point to each choice.', 'Stretch: after a game, ask your child to make up their own question.', 'Children develop at different paces. These games are practice, not a test.'],
};

const card = (a) => `<li class="g-card"><div class="g-card-top"><span class="g-kind">${KIND[a.kind]} · ${esc(a.area)}</span>
<h3><a href="/early-years/games/play?a=${a.id}">${esc(a.title)}</a></h3><p>${esc(a.objective)}</p></div>
<details><summary>For grown-ups</summary><dl><dt>Practising</dt><dd>${esc(a.practising)}</dd><dt>Play together</dt><dd>${esc(a.together)}</dd><dt>Off-screen</dt><dd>${esc(a.offline)}</dd></dl></details></li>`;

const bands = BANDS.map((b) => {
  const list = ACTIVITIES.filter((a) => a.band === b.band).sort((x, y) => (x.level || 1) - (y.level || 1));
  const groups = b.band === '4-6'
    ? Object.entries(STRANDS).map(([k, name]) => `<h3 class="g-strand">${name}</h3><ul class="g-list">${list.filter((a) => a.strand === k).map(card).join('')}</ul>`).join('')
    : `<ul class="g-list">${list.map(card).join('')}</ul>`;
  return `<section class="g-band" id="${b.slug}" aria-labelledby="h-${b.slug}"><div class="wrap">
<div class="g-band-head"><div><p class="eyebrow">Ages ${b.ages}</p><h2 id="h-${b.slug}">${b.name}</h2><p>${esc(b.blurb)} ${list.length} activities, easiest first. <a href="${b.page}">Off-screen ideas for ages ${b.ages}</a>.</p></div>
<aside class="g-parent"><h3>For grown-ups</h3><ul>${GUIDE[b.band].map((x) => `<li>${esc(x)}</li>`).join('')}</ul></aside></div>
${groups}</div></section>`;
}).join('\n');

writeFileSync(new URL('games.html', DIR), page({
  path: '/early-years/games', robots: 'index, follow',
  title: 'Free learning games for ages 1–6 with real photos | Red Teddy',
  desc: `${ACTIVITIES.length} free early-years games for ages 1 to 6: animals, first words, colors, counting, letter sounds, patterns, memory and feelings. No sign-up, no ads, nothing recorded.`,
  body: `<nav class="wrap ey-crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/early-years">Ages 1–6</a></li><li aria-current="page">Games</li></ol></nav>
<section class="g-hero"><div class="wrap"><p class="eyebrow">Free · no sign-up · no ads</p><h1>Red Teddy’s early-years games</h1>
<p class="lead">Four learning journeys for ages 1 to 6. Short, calm games with big pictures, Red Teddy’s gentle help, and an idea to carry on away from the screen. No timers, no scores, nothing recorded.</p>
<ul class="g-bands">${BANDS.map((b) => `<li><a href="#${b.slug}">${b.name} · ${b.ages}</a></li>`).join('')}</ul></div></section>
${bands}
<section class="ey-more"><div class="wrap g-honest"><h2>About these games</h2>
<p>Ages are a rough guide. Children of the same age can be at very different points, so start wherever your child is comfortable and move up or down freely. The games were written to follow common early-years practice; they have not been independently reviewed by early-years specialists, and they do not replace parents, teachers or individual developmental advice.</p>
<p>Under 2, the American Academy of Pediatrics advises keeping screen use shared and brief. The Little World games are designed to be played together, on a lap.</p>
<p>Privacy: the games run in your browser. They do not record answers, need an account or send anything anywhere. The only thing remembered on this device is whether sound is on. <a href="/privacy">Privacy</a>.</p></div></section>`,
}));

writeFileSync(new URL('play.html', DIR), page({
  path: '/early-years/games/play', robots: 'noindex, follow',
  title: 'Play | Red Teddy’s early-years games', desc: 'A free Red Teddy learning game for ages 1 to 6.',
  body: `<section class="gp"><div class="wrap">
<div class="gp-top"><a id="back" href="/early-years/games">← All games</a>
<div class="gp-tools"><button type="button" id="sound" aria-pressed="true"><span>Sound on</span></button></div></div>
<p class="gp-journey" id="journey"></p><h1 id="title">Red Teddy’s games</h1>
<div class="progress" id="progress" role="img" aria-label="Progress"></div>
<div class="bubble" id="bubble"><img src="/teddy-mark.webp" alt="Red Teddy" width="64" height="64"><p id="bubble-text"></p><button type="button" id="replay" aria-label="Hear it again"><span aria-hidden="true">🔊</span></button></div>
<div class="stage" id="game"><noscript><p>The games need JavaScript. Try the <a href="/early-years">off-screen activities</a> instead.</p></noscript></div>
<p id="status" class="ey-sr" role="status" aria-live="polite"></p>
<details class="gp-about"><summary>For grown-ups: what is this practising?</summary><dl><dt>Practising</dt><dd id="about-practise"></dd><dt>Play together</dt><dd id="about-together"></dd><dt>Off-screen</dt><dd id="about-offline"></dd></dl>
<p>No scores or answers are recorded. Pictures marked with a symbol are waiting for their photograph.</p></details>
</div></section>`,
  script: '<script type="module" src="/early/games/player.js"></script>\n',
}));
console.log(`games.html (${ACTIVITIES.length} activities) and play.html written`);
