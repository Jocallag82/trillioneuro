/* Builds the early-years pages (ages 1 to kindergarten) from redteddytutor/early/data.js
   into static HTML in redteddytutor/early/. No runtime build: re-run after editing data.js.
   Run: node scripts/build-early.mjs */
import { writeFileSync } from 'node:fs';
import { STAGES, TOPICS, SITE, CARDS_PER_SITTING } from '../redteddytutor/early/data.js';
import { svg } from '../redteddytutor/early/art.js';
import { BANDS, ACTIVITIES as GAMES } from '../redteddytutor/early/games/content.js';
const gamesFor = (slug) => BANDS.find((b) => b.page === `/${slug}`);

const out = new URL('../redteddytutor/early/', import.meta.url);
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const WHERE = { offline: 'Off-screen', screen: 'On-screen, together', both: 'On-screen game + off-screen play' };
const PHOTO = {
  'little-world': ['/early/img/little-world.webp', 684, 706, 'Red Teddy on a play rug with a grown-up, wooden blocks, a ball and a board book.'],
  'toddler-activities': ['/early/img/toddler-activities.webp', 684, 322, 'Red Teddy in a garden at a little table with toy animals, fruit and colored blocks.'],
  'pre-k-kindergarten-readiness': ['/early/img/pre-k-kindergarten-readiness.webp', 900, 491, 'Red Teddy with a school bag at a classroom table with letter cards, an abacus and a picture book.'],
  'preschool-activities': ['/early/img/preschool-activities.webp', 684, 316, 'Red Teddy at a classroom table with letter blocks, number blocks and picture cards.'],
};
const STAGE_ART = { 'little-world': 'duck', 'toddler-activities': 'ball', 'preschool-activities': 'star', 'pre-k-kindergarten-readiness': 'apple' };

function page({ path, title, desc, body, robots = 'index, follow', jsonld = [], scripts = '' }) {
  const url = SITE + path;
  const ld = jsonld.map((o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`).join('\n');
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>${esc(title)}</title>
<meta name="description" content="${esc(desc)}">
<meta name="robots" content="${robots}">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Red Teddy Tutor">
<meta property="og:url" content="${url}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(desc)}">
<meta property="og:image" content="${SITE}/og-image.jpg">
<meta property="og:locale" content="en_US">
<meta name="twitter:card" content="summary_large_image">
<meta name="theme-color" content="#0e1830">
<link rel="icon" href="/teddy-mark.webp" type="image/webp">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible:ital,wght@0,400;0,700;1,400&family=Fraunces:ital,opsz,wght@0,9..144,500;0,9..144,700;1,9..144,500&display=swap">
<link rel="stylesheet" href="/home.css">
<link rel="stylesheet" href="/early/early.css">
${ld}
</head>
<body class="ey">
<a class="skip" href="#main">Skip to content</a>
<header class="site-head">
  <div class="wrap bar">
    <a class="brand" href="/" aria-label="Red Teddy Tutor home"><img src="/teddy-mark.webp" width="40" height="40" alt=""><span>Red Teddy Tutor</span></a>
    <nav class="ey-nav" aria-label="Main"><ul>
      <li class="ey-hide-sm"><a href="/early-years">Ages 1–6</a></li>
      <li class="ey-hide-sm"><a href="/curriculum">Grades K–12</a></li>
      <li><a class="btn btn-red" href="/learn/">Start learning</a></li>
    </ul></nav>
  </div>
</header>
<main id="main">
${body}
</main>
<footer class="site-foot">
  <div class="wrap foot">
    <div>
      <a class="brand" href="/"><img src="/teddy-mark.webp" width="40" height="40" alt=""><span>Red Teddy Tutor</span></a>
      <p>Free early-years play for ages 1–6, and lessons with adaptive practice from kindergarten to grade 12.</p>
    </div>
    <ul class="foot-links">
      <li><a href="/early-years">Early years (ages 1–6)</a></li>
      ${STAGES.map((s) => `<li><a href="/${s.slug}">${esc(s.short)} (ages ${s.ages})</a></li>`).join('\n      ')}
      <li><a href="/learn/">Learning app</a></li>
      <li><a href="/curriculum">Curriculum K–12</a></li>
      <li><a href="/privacy">Privacy</a></li>
    </ul>
    <p class="legal">&copy; 2026 Red Teddy Tutor.</p>
  </div>
</footer>
${scripts}
</body>
</html>
`;
}

const crumbs = (items) => ({
  '@context': 'https://schema.org', '@type': 'BreadcrumbList',
  itemListElement: items.map(([name, path], i) => ({ '@type': 'ListItem', position: i + 1, name, item: SITE + path })),
});

const ageCards = (current) => `<ol class="ey-ages" aria-label="Choose an age">
${STAGES.map((s) => `  <li><a class="ey-age${s.slug === current ? ' is-current' : ''}" href="/${s.slug}"${s.slug === current ? ' aria-current="page"' : ''}>
    ${PHOTO[s.slug] ? `<span class="ey-age-photo"><img src="${PHOTO[s.slug][0]}" width="${PHOTO[s.slug][1]}" height="${PHOTO[s.slug][2]}" alt="" loading="lazy"></span>` : `<span class="ey-age-art" aria-hidden="true">${svg(STAGE_ART[s.slug], '')}</span>`}
    <span class="ey-age-n">Ages ${s.ages}</span>
    <span class="ey-age-name">${esc(s.name)}</span>
  </a></li>`).join('\n')}
  <li><a class="ey-age ey-age-school" href="/learn/">
    <span class="ey-age-art" aria-hidden="true"><img src="/teddy-mark.webp" width="64" height="64" alt=""></span>
    <span class="ey-age-n">Grades K–12</span>
    <span class="ey-age-name">School learning app</span>
  </a></li>
</ol>`;

function activity(a, ages) {
  const std = a.standards?.length ? `<p class="ey-std"><span>Relates to Common Core:</span> ${a.standards.map((c) => `<code>${esc(c)}</code>`).join(' ')}</p>` : '';
  const play = a.play ? `<a class="btn btn-red ey-play" href="${a.play}">${a.play.startsWith('/little-world') ? 'Open the cards' : 'Play now — free'}</a>` : '';
  return `<article class="ey-act" id="${a.id}">
  <header>
    <p class="ey-area">${esc(a.area)}</p>
    <h3>${esc(a.title)}</h3>
    <p class="ey-meta">${ages ? `<span>Ages ${ages}</span>` : ''}<span>${WHERE[a.where]}</span><span>About ${a.minutes} min</span></p>
  </header>
  <p class="ey-obj"><strong>What it builds:</strong> ${esc(a.objective)}</p>
  <div class="ey-cols">
    <div><h4>You need</h4><ul>${a.materials.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
    <h4>How to play</h4><ol>${a.steps.map((m) => `<li>${esc(m)}</li>`).join('')}</ol></div>
    <div><h4>Things to say</h4><ul class="ey-talk">${a.talk.map((m) => `<li>${esc(m)}</li>`).join('')}</ul>
    <h4>Take it further</h4><p>${esc(a.extend)}</p></div>
  </div>
  ${std}
  ${play}
</article>`;
}


const topicLinks = (current) => `<div class="ey-topics"><h2 class="ey-topics-h">Or choose a skill</h2><ul>${TOPICS.map((t) => `<li><a href="/${t.slug}"${t.slug === current ? ' aria-current="page"' : ''}>${esc(t.short)}</a></li>`).join('')}</ul></div>`;
const where = Object.fromEntries(STAGES.flatMap((s) => s.activities.map((a) => [a.id, { a, s }])));

function topicPage(t) {
  const acts = t.ids.map((id) => where[id]);
  const body = `<nav class="wrap ey-crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/early-years">Early years</a></li><li aria-current="page">${esc(t.short)}</li></ol></nav>
<section class="ey-hero" aria-labelledby="h1">
  <div class="wrap">
    <p class="eyebrow">${esc(t.short)} · Free · No sign-up</p>
    <h1 id="h1">${esc(t.h1)}</h1>
    <p class="lead">${esc(t.intro)}</p>
    <div class="cta-row"><a class="btn btn-red btn-lg" href="#activities">See ${acts.length} activities</a></div>
  </div>
</section>
<section class="ey-guide" aria-labelledby="dev-h">
  <div class="wrap ey-guide-grid">
    <h2 id="dev-h">What it often looks like by age</h2>
    <div><dl class="ey-stages">${t.stages.map(([ages, txt]) => `<div><dt>Ages ${ages}</dt><dd>${esc(txt)}</dd></div>`).join('')}</dl>
    <p class="ey-note">Every child is different, and these are broad patterns, not milestones to test against.</p>
    <h3 class="ey-tips-h">Tips that help</h3><ul>${t.tips.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>
  </div>
</section>
<section class="ey-list" id="activities" aria-labelledby="acts-h">
  <div class="wrap">
    <div class="sec-head"><p class="eyebrow">${acts.length} activities</p><h2 id="acts-h">${esc(t.short)} activities to do together</h2>
    <p>Each one is also on its age page, with the rest of that age’s activities. <button type="button" class="ey-print" data-print>Print this page</button></p></div>
    ${acts.map(({ a, s }) => activity(a, s.ages)).join('\n')}
  </div>
</section>
<section class="ey-more" aria-labelledby="more-h">
  <div class="wrap">
    <h2 id="more-h">Choose an age</h2>
    ${ageCards(null)}
    ${topicLinks(t.slug)}
  </div>
</section>`;
  return page({
    path: `/${t.slug}`, title: t.metaTitle, desc: t.metaDesc, body,
    jsonld: [crumbs([['Home', '/'], ['Early years', '/early-years'], [t.short, `/${t.slug}`]])],
    scripts: '<script src="/early/print.js" defer></script>',
  });
}

function stagePage(s, idx) {
  const prev = STAGES[idx - 1], next = STAGES[idx + 1];
  const body = `<nav class="wrap ey-crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/early-years">Early years</a></li><li aria-current="page">Ages ${s.ages}</li></ol></nav>
<section class="ey-hero" aria-labelledby="h1">
  <div class="wrap ey-hero-grid">
    <div>
      <p class="eyebrow">Ages ${s.ages} · Free · No sign-up</p>
      <h1 id="h1">${esc(s.h1)}</h1>
      <p class="lead">${esc(s.lead)}</p>
      <div class="cta-row">
        <a class="btn btn-red btn-lg" href="${s.activities.find((a) => a.play)?.play}">${s.band ? 'Play the first activity' : 'Open the Look and Name cards'}</a>
        <a class="btn btn-ghost btn-lg" href="/early-years/games#${gamesFor(s.slug).slug}">${GAMES.filter((g) => g.band === gamesFor(s.slug).band).length} ${esc(gamesFor(s.slug).name)} games</a>
        <a class="btn btn-ghost btn-lg" href="#activities">See all ${s.activities.length} activities</a>
      </div>
    </div>
    ${PHOTO[s.slug] ? `<figure class="ey-hero-photo"><img src="${PHOTO[s.slug][0]}" width="${PHOTO[s.slug][1]}" height="${PHOTO[s.slug][2]}" alt="${esc(PHOTO[s.slug][3])}" fetchpriority="high"></figure>` : `<figure class="ey-hero-art" aria-hidden="true">${svg(STAGE_ART[s.slug], '')}</figure>`}
  </div>
</section>
<section class="ey-guide" aria-labelledby="guide-h">
  <div class="wrap ey-guide-grid">
    <h2 id="guide-h">For grown-ups</h2>
    <ul>${s.guidance.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>
  </div>
</section>
<section class="ey-list" id="activities" aria-labelledby="acts-h">
  <div class="wrap">
    <div class="sec-head">
      <p class="eyebrow">${s.activities.length} activities</p>
      <h2 id="acts-h">Things to do together</h2>
      <p>Each one has a clear purpose, a way to play, and words to use. <a class="ey-dl" href="/early/printables/${s.slug}.pdf" download>Download the free printable pack (PDF)</a><span class="ey-dl"> · </span><button type="button" class="ey-print" data-print>Print this page</button></p>
    </div>
    <ul class="ey-jump" aria-label="Jump to an activity">${s.activities.map((a) => `<li><a href="#${a.id}">${esc(a.title)}</a></li>`).join('')}</ul>
    ${s.activities.map((a) => activity(a)).join('\n')}
    <p class="honest">These activities relate to the Head Start Early Learning Outcomes Framework domains of ${s.elof.slice(0, -1).join(', ')} and ${s.elof.at(-1)}${s.band === '5-7' ? ', and to the Common Core kindergarten standards shown on each card' : ''}. That is our own mapping, not an official review or endorsement.</p>
  </div>
</section>
<section class="ey-more" aria-labelledby="more-h">
  <div class="wrap">
    <h2 id="more-h">Choose another age</h2>
    ${ageCards(s.slug)}
    ${topicLinks(null)}
    <p class="ey-pn">${prev ? `<a href="/${prev.slug}">← ${esc(prev.name)} (ages ${prev.ages})</a>` : '<span></span>'}${next ? `<a href="/${next.slug}">${esc(next.name)} (ages ${next.ages}) →</a>` : '<a href="/learn/">Ready for school learning? Grades K–12 →</a>'}</p>
  </div>
</section>`;
  return page({
    path: `/${s.slug}`, title: s.metaTitle, desc: s.metaDesc, body,
    jsonld: [crumbs([['Home', '/'], ['Early years', '/early-years'], [`Ages ${s.ages}`, `/${s.slug}`]])],
    scripts: '<script src="/early/print.js" defer></script>',
  });
}

const total = STAGES.reduce((n, s) => n + s.activities.length, 0);
const hub = page({
  path: '/early-years',
  title: 'Free early learning activities for ages 1–6 | Red Teddy Tutor',
  desc: `Free, no-sign-up learning for babies, toddlers, preschool, pre-K and kindergarten: ${total} parent-guided activities with on-screen games and real-world play.`,
  jsonld: [crumbs([['Home', '/'], ['Early years', '/early-years']])],
  body: `<nav class="wrap ey-crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li aria-current="page">Early years</li></ol></nav>
<section class="ey-hero" aria-labelledby="h1">
  <div class="wrap">
    <p class="eyebrow">Ages 1 to 6 · Always free · No account</p>
    <h1 id="h1">Learn together with Red Teddy, from first words to kindergarten.</h1>
    <p class="lead">${total} activities, each with a purpose, a way to play and words to use. Short on-screen games where they help, and off-screen play where that is better. Pick an age to start.</p>
    <div class="cta-row"><a class="btn btn-red btn-lg" href="/early-years/play-zone">🎈 Play Zone: endless games</a> <a class="btn btn-line btn-lg" href="/early-years/games">Play ${GAMES.length} learning games</a></div>
  </div>
</section>
<section class="ey-more ey-pick" aria-labelledby="pick-h">
  <div class="wrap">
    <h2 id="pick-h" class="ey-sr">Choose an age</h2>
    ${ageCards(null)}
    ${topicLinks(null)}
  </div>
</section>
<section class="ey-guide" aria-labelledby="promise-h">
  <div class="wrap ey-guide-grid">
    <h2 id="promise-h">Our promise for the early years</h2>
    <ul>
      <li>Everything for ages 1 to kindergarten is free, with no sign-up, no email and no limits.</li>
      <li>No adverts, no trackers, no names or birthdays asked for. Progress, if any, stays on your device.</li>
      <li>Built for doing together. Screen moments are short and every one has an off-screen version.</li>
      <li>No streaks, scores or leaderboards. A wrong tap gets a kind hint.</li>
      <li>No promises of faster development. Just good play with a purpose, explained.</li>
      <li>Every age has a free printable pack: <a href="/early/printables/little-world.pdf" download>1–2</a>, <a href="/early/printables/toddler-activities.pdf" download>2–3</a>, <a href="/early/printables/preschool-activities.pdf" download>3–4</a>, <a href="/early/printables/pre-k-kindergarten-readiness.pdf" download>4–6</a> (PDF).</li>
    </ul>
  </div>
</section>`,
});

const play = page({
  path: '/little-world/play',
  title: 'Look and Name cards for ages 1–2 | Red Teddy’s Little World',
  desc: 'Six big picture cards to look at, point to and name with your little one. Free, no sign-up, then a suggestion for off-screen play.',
  robots: 'noindex, follow',
  body: `<nav class="wrap ey-crumbs" aria-label="Breadcrumb"><ol><li><a href="/">Home</a></li><li><a href="/little-world">Little World</a></li><li aria-current="page">Look and Name</li></ol></nav>
<section class="ey-look" aria-labelledby="h1">
  <div class="wrap">
    <h1 id="h1" class="ey-look-h">Look and Name</h1>
    <p id="look-hint" class="ey-look-hint">Grown-up: point to the picture and name it together, then tap it to hear the word. ${CARDS_PER_SITTING} pictures, then off-screen play.</p>
    <label class="ey-sound"><input type="checkbox" id="look-sound" checked> Say the words aloud</label>
    <div id="look" class="look-stage"><noscript><p>The cards need JavaScript. Try the <a href="/little-world#activities">off-screen activities</a> instead.</p></noscript></div>
    <p id="look-status" class="ey-sr" role="status" aria-live="polite"></p>
  </div>
</section>`,
  scripts: '<script type="module" src="/early/look.js"></script>',
});

writeFileSync(new URL('early-years.html', out), hub);
writeFileSync(new URL('little-world-play.html', out), play);
STAGES.forEach((s, i) => writeFileSync(new URL(`${s.slug}.html`, out), stagePage(s, i)));
TOPICS.forEach((t) => writeFileSync(new URL(`${t.slug}.html`, out), topicPage(t)));
console.log(`early-years: wrote ${STAGES.length + TOPICS.length + 2} pages, ${total} activities`);
