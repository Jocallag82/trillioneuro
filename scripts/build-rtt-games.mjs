// Builds the free games pages for redteddytutor.com from one data file so every page
// gets the same SEO shell (title, canonical, Open Graph, JSON-LD, FAQ, internal links).
// Run: node scripts/build-rtt-games.mjs
import { writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const OUT = join(dirname(fileURLToPath(import.meta.url)), '..', 'redteddytutor', 'games');
const SITE = 'https://www.redteddytutor.com';
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const GAMES = [
  {
    slug: 'multiplication-games', cls: 'mt', js: 'meteors.js', icon: '☄️', name: 'Times Table Meteors',
    short: 'Blast falling meteors by answering times tables facts.', ages: '7–11', grades: 'Grades 2–5', skill: 'Multiplication facts 1–12',
    title: 'Free Multiplication Games for Kids — Times Table Meteors | Red Teddy',
    desc: 'Free online multiplication game for grades 2–5. Blast meteors by answering times tables 2–12. No sign-up, no ads, works on phones, tablets and Chromebooks.',
    h1: 'Multiplication games: Times Table Meteors',
    lede: 'Meteors are falling, and each one carries a times tables fact. Tap the right answer to fire your laser before it lands. Free, no sign-up, no ads.',
    stage: `<div class="ar-hud"><span data-hud="score">0</span><span data-hud="lives"></span><span class="sp"></span><span data-hud="combo"></span></div>
<div class="mt-field" aria-live="polite"></div><div class="mt-ship" aria-hidden="true">🚀</div><div class="mt-ground"></div><div class="mt-pad" aria-label="Answers"></div>`,
    how: ['Pick which times tables to practise: 2, 5 and 10 first, then 3, 4 and 6, then 7, 8 and 9.', 'The glowing meteor is closest to the ground. Tap its answer to blast it.', 'Answer quickly to build a combo: every 3 in a row multiplies your points, up to five times.', 'A wrong answer pulls the meteor closer, and three meteors landing ends the game. At the end you see which facts to practise next.'],
    body: `<h2>Why this multiplication game works</h2>
<p>Times tables stick through <strong>quick retrieval practice</strong>: recalling the fact, not reading it. Meteors give gentle time pressure that builds speed, and the four answer choices are deliberately tricky. They include mistakes children really make, such as adding instead of multiplying (6 + 7 = 13) or being one group off (7 × 7 = 49 when the question was 6 × 7).</p>
<p>Start with the 2s, 5s and 10s, which follow easy counting patterns. Then move to 3s, 4s and 6s, and leave the 7s, 8s and 9s until last. The end screen lists the exact facts your child missed, so practice time goes where it is needed.</p>
<h2>Skills and standards</h2>
<ul><li>Fluently multiply within 100 (Common Core 3.OA.C.7)</li><li>Multiplication as equal groups and commutativity: 3 × 8 = 8 × 3 (3.OA.B.5)</li><li>Times tables to 12 × 12 for grades 4–5 fluency and the UK multiplication tables check</li></ul>
<h2>Tips for parents and teachers</h2>
<p>Ten minutes a day beats an hour on Sunday. Play two or three rounds, then say the missed facts aloud together. Once your child reaches 300 or more on a level, move up.</p>`,
    faq: [['What age is this multiplication game for?', 'Ages 7 to 11 (grades 2–5). Younger children can start with the 2, 5 and 10 level.'], ['Is it really free?', 'Yes. There is no sign-up, no ads, and nothing to download. Best scores are saved only on your device.'], ['Does it work on iPad and Chromebook?', 'Yes. It runs in any modern browser and is built for touch screens.'], ['How do I learn times tables fast?', 'Short daily practice of the facts you miss. The game lists those facts after every round so you can focus on them.']],
  },
  {
    slug: 'addition-games', cls: 'bb', js: 'bubbles.js', icon: '🫧', name: 'Bubble Pop Bonds',
    short: 'Pop two bubbles that add up to the target number.', ages: '5–9', grades: 'Grades K–3', skill: 'Number bonds and addition',
    title: 'Free Addition Games for Kids — Number Bonds to 10, 20, 100 | Red Teddy',
    desc: 'Free online addition game for kindergarten to grade 3. Pop bubble pairs that make 10, 20 or 100 to master number bonds. No sign-up, no ads.',
    h1: 'Addition games: Bubble Pop Bonds',
    lede: 'Numbered bubbles float up the screen. Pop two that add up to the target before time runs out. Number bonds to 10, 20 and 100.',
    stage: `<div class="ar-hud"><span data-hud="score">0</span><span data-hud="time"></span><span class="sp"></span><span data-hud="combo"></span></div>
<div class="bb-target" aria-live="polite"></div><div class="bb-field"></div>`,
    how: ['Choose a level: Make 10, Up to 20, Up to 100 (in tens) or Tricky 100.', 'Tap one bubble, then tap another. If the two numbers add up to the target, both pop.', 'Make three pairs to earn 3 extra seconds and a new target.', 'Pairs in a row score bonus points. A wrong pair shows you its real sum, so every mistake teaches something.'],
    body: `<h2>Number bonds are the base of mental math</h2>
<p>A child who instantly knows that 7 and 3 make 10 can solve 47 + 3, 70 + 30 and 10 − 7 without counting on fingers. Number bonds to 10 come first, then to 20, then multiples of ten to 100. This game trains that instant recall with no worksheets.</p>
<h2>Skills and standards</h2>
<ul><li>Find the number that makes 10 when added to any number from 1 to 9 (Common Core K.OA.A.4)</li><li>Fluently add and subtract within 20 (2.OA.B.2)</li><li>Add within 100 using place value (1.NBT.C.4, 2.NBT.B.5)</li></ul>
<h2>Tips for parents</h2>
<p>Make 10 is the most important level. Stay on it until your child finds pairs without counting, then move up. Saying the bond aloud ("six and four make ten") doubles the effect.</p>`,
    faq: [['What are number bonds?', 'Pairs of numbers that make a total, such as 6 + 4 = 10. Knowing them by heart makes addition and subtraction much faster.'], ['What age is this for?', 'Ages 5 to 9 (kindergarten to grade 3).'], ['Is it free?', 'Yes. It is completely free with no sign-up and no ads.']],
  },
  {
    slug: 'fraction-games', cls: 'fp', js: 'pizza.js', icon: '🍕', name: 'Fraction Pizza Shop',
    short: 'Top exactly the fraction of pizza each customer orders.', ages: '7–11', grades: 'Grades 2–5', skill: 'Fractions and equivalent fractions',
    title: 'Free Fraction Games for Kids — Fraction Pizza Shop | Red Teddy',
    desc: 'Free online fraction game for grades 2–5. Run a pizza shop: top 3/4, 2/3 or 5/8 of a pizza and learn equivalent fractions. No sign-up, no ads.',
    h1: 'Fraction games: Fraction Pizza Shop',
    lede: 'Hungry customers order fractions of pizza. Tap slices to add toppings, then serve, before they lose patience. Equivalent fractions included.',
    stage: `<div class="ar-hud"><span data-hud="score">0</span><span data-hud="lives"></span><span class="sp"></span><span data-hud="served"></span></div>
<div class="fp-shop"><div class="fp-cust"><div class="fp-face" aria-hidden="true"></div><div class="fp-order" aria-live="polite"></div><div class="fp-patience" aria-label="Customer patience"><i></i></div></div>
<div class="fp-board"><svg class="fp-pizza" viewBox="-115 -115 230 230" role="group" aria-label="Pizza slices"></svg><span class="fp-count"></span><button type="button" class="fp-serve">Serve 🍕</button></div></div>`,
    how: ['Read the order, for example ¾ with tomato.', 'Tap slices to add toppings. Tap a slice again to remove its topping.', 'Press Serve. Fast, correct pizzas earn bonus points.', 'In the Equivalent levels the pizza has more slices than the order: ½ of an 8-slice pizza means 4 slices.'],
    body: `<h2>Fractions you can see</h2>
<p>Fractions confuse children when they are only symbols. A pizza shows what ¾ really means: the whole is cut into 4 equal parts, and you take 3 of them. The Equivalent levels teach the idea most children find hardest: ½, 2/4 and 4/8 are the same amount, shown on one pizza.</p>
<p>A wrong serve explains itself: "Not enough! 2/3 of 6 slices = 4". Every mistake becomes a lesson.</p>
<h2>Skills and standards</h2>
<ul><li>Partition shapes into halves, thirds and fourths (Common Core 2.G.A.3)</li><li>Understand a fraction 1/b and a/b as parts of a whole (3.NF.A.1)</li><li>Recognise and generate equivalent fractions (3.NF.A.3, 4.NF.A.1)</li></ul>`,
    faq: [['What age is the fraction pizza game for?', 'Ages 7 to 11 (grades 2–5). Halves and quarters suit grade 2. Equivalent fractions suit grades 3–5.'], ['How do you teach equivalent fractions?', 'Show the same amount cut into different numbers of pieces. In this game ½ of a 4-slice pizza and ½ of an 8-slice pizza cover the same area.'], ['Is it free?', 'Yes. There is no sign-up, no ads, and it works in any browser.']],
  },
  {
    slug: 'spelling-games', cls: 'sp', js: 'spelling.js', icon: '🐝', name: 'Spelling Bee Hive',
    short: 'Hear a word, then tap the honeycomb letters to spell it.', ages: '5–10', grades: 'Grades K–4', skill: 'Spelling and phonics',
    title: 'Free Spelling Games for Kids — Spelling Bee Hive | Red Teddy',
    desc: 'Free online spelling game for kindergarten to grade 4. Hear the word, see the picture, and tap honeycomb letters to spell it. Spoken words, no sign-up, no ads.',
    h1: 'Spelling games: Spelling Bee Hive',
    lede: 'Hear the word, see the picture, then tap the honeycomb letters in order. 60 seconds, and every correct word adds time.',
    stage: `<div class="ar-hud"><span data-hud="score">0</span><span data-hud="time"></span><span class="sp"></span><span data-hud="combo"></span></div>
<div class="sp-top"><div class="sp-pic" aria-hidden="true"></div><div class="sp-tools"><button type="button" class="sp-hear">🔊 Hear again</button><button type="button" class="sp-back">⌫ Undo</button></div><div class="sp-slots" aria-live="polite"></div></div><div class="sp-hive" aria-label="Letters"></div>`,
    how: ['Pick a level: 3-letter words for K–1, up to long words for grade 4 and above.', 'Listen to the word and look at the picture. Press "Hear again" whenever you like.', 'Tap the letters in order. On a keyboard, you can type instead.', 'After two wrong taps, the next letter glows green to help. Words spelled without a mistake score a Perfect bonus.'],
    body: `<h2>Spelling from sound, the way schools teach it</h2>
<p>Children learn to spell by hearing a word, breaking it into sounds and matching each sound to letters. That is phonics in reverse. This game does exactly that: spoken word, picture clue, then letter by letter. Decoy letters make children think instead of guessing.</p>
<h2>Skills and standards</h2>
<ul><li>Spell simple CVC words phonetically (Common Core L.K.2.D)</li><li>Spell words with blends, digraphs and vowel teams (L.1.2.D, L.2.2.D)</li><li>Spell grade-level multi-syllable words (L.3.2.E, L.4.2.D)</li></ul>`,
    faq: [['What age is this spelling game for?', 'Ages 5 to 10 (kindergarten to grade 4).'], ['Does it read the words aloud?', 'Yes. It uses your device’s built-in voice. Press "Hear again" to repeat a word.'], ['Is it free?', 'Yes. It is completely free, with no sign-up and no ads.']],
  },
];

function head({ title, desc, path, ld }) {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="index, follow, max-image-preview:large">
<link rel="canonical" href="${SITE}${path}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Red Teddy Tutor">
<meta property="og:url" content="${SITE}${path}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}/og-image.jpg">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(desc)}">
<meta name="twitter:image" content="${SITE}/og-image.jpg">
<meta name="theme-color" content="#0e1830">
<link rel="icon" href="/teddy-mark.webp" type="image/webp">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;1,9..144,500&display=swap">
<link rel="stylesheet" href="/home.css">
<link rel="stylesheet" href="/games/arcade.css">
<script type="application/ld+json">${JSON.stringify(ld).replace(/</g, '\\u003c')}</script>
</head>
<body class="ga">
<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <div class="wrap bar">
    <a class="brand" href="/" aria-label="Red Teddy Tutor home"><img src="/teddy-mark.webp" width="40" height="40" alt=""><span>Red Teddy Tutor</span></a>
    <nav class="ey-nav" aria-label="Main"><ul style="gap:18px">
      <li><a href="/games">Games</a></li>
      <li class="ga-hide-sm"><a href="/primary">Primary</a></li>
      <li><a class="btn btn-red" href="/learn/">Start learning</a></li>
    </ul></nav>
  </div>
</header>`;
}

const foot = (extra = '') => `<footer class="site-foot">
  <div class="wrap foot">
    <div><a class="brand" href="/"><img src="/teddy-mark.webp" width="40" height="40" alt=""><span>Red Teddy Tutor</span></a>
    <p>Free learning games, plus lessons with adaptive practice from kindergarten to grade 12.</p></div>
    <ul class="foot-links">
      <li><a href="/games">All free games</a></li>
${GAMES.map((g) => `      <li><a href="/${g.slug}">${esc(g.h1.split(':')[0])}</a></li>`).join('\n')}
      <li><a href="/early-years/games">Games for ages 1–6</a></li>
      <li><a href="/learn/game/">Teddy’s Bakery</a></li>
      <li><a href="/primary">Primary school</a></li>
      <li><a href="/curriculum">Curriculum</a></li>
      <li><a href="/privacy">Privacy</a></li>
    </ul>
    <p class="legal">&copy; 2026 Red Teddy Tutor.</p>
  </div>
</footer>
${extra}</body>
</html>
`;

function gamePage(g) {
  const path = `/${g.slug}`;
  const others = GAMES.filter((x) => x !== g);
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': ['VideoGame', 'LearningResource'], name: g.name, url: SITE + path, description: g.desc, inLanguage: 'en', genre: 'Educational', gamePlatform: 'Web browser', applicationCategory: 'Game', operatingSystem: 'Any', isAccessibleForFree: true, educationalLevel: g.grades, teaches: g.skill, typicalAgeRange: g.ages.replace('–', '-'), learningResourceType: 'Game', offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' }, publisher: { '@type': 'Organization', name: 'Red Teddy Tutor', url: SITE + '/' } },
    { '@type': 'HowTo', name: `How to play ${g.name}`, step: g.how.map((t, i) => ({ '@type': 'HowToStep', position: i + 1, text: t })) },
    { '@type': 'FAQPage', mainEntity: g.faq.map(([q, a]) => ({ '@type': 'Question', name: q, acceptedAnswer: { '@type': 'Answer', text: a } })) },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: 'Free games', item: SITE + '/games' }, { '@type': 'ListItem', position: 3, name: g.name, item: SITE + path }] },
  ] };
  return `${head({ title: g.title, desc: g.desc, path, ld })}
<main id="main">
<section class="ga-hero" style="padding-bottom:40px">
  <div class="wrap">
    <nav class="ga-crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/games">Free games</a></li><li aria-current="page">${esc(g.name)}</li></ol></nav>
    <h1>${esc(g.h1)}</h1>
    <p class="lede">${esc(g.lede)}</p>
    <div id="game" class="ar ${g.cls}">
      <div class="ar-stage" tabindex="-1">
${g.stage}
      </div>
      <button type="button" class="ar-mute"></button>
      <div class="ar-start">
        <div class="ar-icon" aria-hidden="true">${g.icon}</div>
        <h2>${esc(g.name)}</h2>
        <p>${esc(g.short)} Ages ${g.ages}.</p>
        <div class="ar-levels" role="group" aria-label="Level"></div>
        <button type="button" class="btn btn-red ar-go">▶ Play</button>
        <span class="ar-best"></span>
      </div>
      <div class="ar-end" hidden>
        <h2>Round over!</h2>
        <span class="ar-new" hidden>New best score!</span>
        <div class="ar-score">0</div>
        <p>Best: <b class="ar-bestv">0</b></p>
        <p class="ar-sum"></p>
        <div class="ar-row"><button type="button" class="btn btn-red ar-again">Play again</button><button type="button" class="btn btn-ghost ar-menu">Change level</button></div>
        <a class="btn btn-ghost" href="/learn/">Get personalised practice →</a>
      </div>
    </div>
  </div>
</section>
<section class="ga-body">
  <div class="wrap ga-cols">
    <article>
      <h2>How to play ${esc(g.name)}</h2>
      <ol>${g.how.map((t) => `<li>${esc(t)}</li>`).join('')}</ol>
      ${g.body}
      <h2>Frequently asked questions</h2>
      ${g.faq.map(([q, a]) => `<details><summary>${esc(q)}</summary><p>${esc(a)}</p></details>`).join('\n      ')}
    </article>
    <aside class="ga-side" aria-label="More games">
      <div class="ga-cta"><strong style="font-family:var(--serif);font-size:1.3rem">Want practice that adapts?</strong><p>Red Teddy finds what your child nearly knows and gives hints instead of answers. Free to start.</p><a class="btn btn-red" href="/learn/">Start learning free</a></div>
${others.map((o) => `      <a class="ga-card" href="/${o.slug}"><div class="em" aria-hidden="true">${o.icon}</div><strong>${esc(o.name)}</strong><span>${esc(o.short)} Ages ${o.ages}.</span></a>`).join('\n')}
    </aside>
  </div>
</section>
</main>
${foot(`<script type="module" src="/games/${g.js}"></script>\n`)}`;
}

function hub() {
  const path = '/games';
  const title = 'Free Educational Games for Kids — Math & Spelling, No Sign-Up | Red Teddy';
  const desc = 'Free online learning games for kids aged 5–11: multiplication, addition, fractions and spelling. No ads, no sign-up. Works on iPad, Chromebook and phones.';
  const ld = { '@context': 'https://schema.org', '@graph': [
    { '@type': 'CollectionPage', name: 'Free educational games for kids', url: SITE + path, description: desc, inLanguage: 'en' },
    { '@type': 'ItemList', itemListElement: GAMES.map((g, i) => ({ '@type': 'ListItem', position: i + 1, url: `${SITE}/${g.slug}`, name: g.name })) },
    { '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: 'Home', item: SITE + '/' }, { '@type': 'ListItem', position: 2, name: 'Free games', item: SITE + path }] },
  ] };
  return `${head({ title, desc, path, ld })}
<main id="main">
<section class="ga-hero" style="padding:48px 0 64px">
  <div class="wrap">
    <nav class="ga-crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Free games</li></ol></nav>
    <h1>Free educational games for kids</h1>
    <p class="lede">Arcade-style math and spelling games for ages 5–11. No ads and no sign-up. Every game is built around a real school skill, and every mistake shows the right answer.</p>
    <div class="ga-grid">
${GAMES.map((g) => `      <a class="ga-card" href="/${g.slug}"><div class="em" aria-hidden="true">${g.icon}</div><strong>${esc(g.name)}</strong><span>${esc(g.short)}</span><br><span class="ga-tag">${esc(g.grades)} · ${esc(g.skill)}</span></a>`).join('\n')}
      <a class="ga-card" href="/learn/game/"><div class="em" aria-hidden="true">🧁</div><strong>Teddy’s Bakery</strong><span>Bake, count and sell in Teddy’s story game.</span><br><span class="ga-tag">Ages 5–9</span></a>
      <a class="ga-card" href="/early-years/games"><div class="em" aria-hidden="true">🧸</div><strong>Games for ages 1–6</strong><span>Colours, shapes, counting and first letters.</span><br><span class="ga-tag">Toddler &amp; preschool</span></a>
    </div>
  </div>
</section>
<section class="ga-body">
  <div class="wrap" style="max-width:52rem">
    <h2>Learning games that are actually learning</h2>
    <p>Each game trains one skill from the school curriculum: times tables, number bonds, fractions or spelling. Rounds are short (about a minute or until you run out of lives), so they fit before school or after homework. The end screen shows what to practise next.</p>
    <h2>Safe for kids</h2>
    <ul><li>No ads, chat, links or in-game purchases.</li><li>No account needed. Best scores are saved only on your device.</li><li>Works on iPad, Android, Chromebook and computers, with sound you can turn off.</li></ul>
    <h2>Ready for more?</h2>
    <p><a href="/learn/">Red Teddy’s adaptive lessons</a> pick up where the games stop. They find what your child nearly knows, give hints instead of answers, and send parents a summary built from real answers. <a href="/curriculum">See the full K–12 curriculum</a>.</p>
  </div>
</section>
</main>
${foot()}`;
}

await writeFile(join(OUT, 'games.html'), hub());
for (const g of GAMES) await writeFile(join(OUT, `${g.slug}.html`), gamePage(g));
console.log(`Wrote ${GAMES.length + 1} pages to ${OUT}`);
