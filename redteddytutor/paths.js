// Pathway pages and the home-page stage chooser.
// Every demo here is fixed, authored content: no network calls, nothing stored.
document.documentElement.classList.add('js');
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

/* ---------- menu (pathway pages; the home page has its own in home.js) ---------- */
function initMenu() {
  const btn = $('.menu-btn');
  const nav = $('#nav');
  if (!btn || !nav || !document.body.dataset.stage) return;
  const close = () => { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', () => btn.setAttribute('aria-expanded', String(nav.classList.toggle('open'))));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) { close(); btn.focus(); } });
}

/* ---------- home: "Which stage is your child at?" ---------- */
const UNSURE = `<p>A quick guide, by school stage rather than exact age:</p>
<dl>
<div><dt>Preschool</dt><dd>Not at school yet, or in pre-K. Play-based activities done together with a grown-up, mostly by tapping pictures. Free, no sign-up.</dd></div>
<div><dt>Primary school</dt><dd>Kindergarten to grade 5. Reading, spelling and maths with hints and step-by-step help.</dd></div>
<div><dt>High school</dt><dd>Grades 6 to 12. Subject explanations, guided problem-solving and revision practice.</dd></div>
</dl>
<p>Between two? Start with the earlier stage. The app’s quick check moves up as soon as it is too easy.</p>`;

function initChooser() {
  const form = $('#stage-chooser');
  if (!form) return;
  const out = $('#chooser-out');
  const cards = { pre: $('#pc-pre'), pri: $('#pc-pri'), hs: $('#pc-hs') };
  const names = { pre: 'Preschool', pri: 'Primary School', hs: 'High School' };
  form.addEventListener('change', (e) => {
    const v = e.target.value;
    Object.values(cards).forEach((c) => c?.classList.remove('is-picked'));
    if (v === 'unsure') { out.innerHTML = UNSURE; return; }
    const card = cards[v];
    const link = card.querySelector('.pc-main');
    card.classList.add('is-picked');
    out.innerHTML = '';
    const p = document.createElement('p');
    p.append(`${names[v]} is the right place. `);
    const a = document.createElement('a');
    a.href = link.getAttribute('href');
    a.textContent = `Go to ${names[v]} →`;
    p.append(a);
    out.append(p);
    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (innerWidth < 980) card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'center' });
  });
}

/* ---------- preschool: count the apples ---------- */
const COUNT_ROUNDS = [
  { n: 3, opts: [2, 3, 4] },
  { n: 5, opts: [5, 4, 6] },
  { n: 4, opts: [3, 5, 4] },
];
function initCount() {
  const root = $('#count-demo');
  if (!root) return;
  const apples = $('.apples', root);
  const opts = $('.big-opts', root);
  const fb = $('.fb', root);
  const next = $('#count-next', root);
  let r = 0;
  const render = () => {
    const round = COUNT_ROUNDS[r % COUNT_ROUNDS.length];
    apples.replaceChildren(...Array.from({ length: round.n }, () => Object.assign(document.createElement('span'), { className: 'apple' })));
    apples.setAttribute('aria-label', `A plate of apples. Count them.`);
    fb.textContent = ''; fb.className = 'fb';
    next.hidden = true;
    opts.replaceChildren(...round.opts.map((v) => {
      const b = document.createElement('button');
      b.type = 'button'; b.textContent = String(v);
      b.setAttribute('aria-label', `${v} apples`);
      b.addEventListener('click', () => {
        if (v === round.n) {
          b.classList.add('right');
          $$('button', opts).forEach((x) => { x.disabled = true; });
          fb.textContent = `Yes! ${v} apples. Point and count them again together: ${Array.from({ length: v }, (_, i) => i + 1).join(', ')}.`;
          fb.className = 'fb ok';
          next.hidden = false;
          next.focus();
        } else {
          b.classList.add('tried'); b.disabled = true;
          fb.textContent = 'Nearly! Touch each apple once as you count.';
          fb.className = 'fb no';
        }
      });
      return b;
    }));
  };
  next.addEventListener('click', () => { r++; render(); $('button', opts)?.focus(); });
  render();
}

/* ---------- primary: hints, then a worked explanation ---------- */
// Mia has 3 bags with 8 marbles in each. She gives 5 away. How many are left? = 19
const PRI = {
  answer: 19,
  mistakes: {
    24: 'That is how many marbles Mia had before she gave any away. What happens next in the story?',
    29: 'It looks like the 5 was added. Mia gives 5 away, so there will be fewer.',
    16: 'It looks like 8 was added to itself once. There are 3 bags, not 2.',
    6: 'It looks like the numbers 3 and 8 were added, then 5 taken away. Each bag has 8 inside, so think “3 groups of 8”.',
  },
  hints: [
    'Start with the bags. How many marbles are in 3 bags of 8? You could count in 8s: 8, 16, …',
    'You should have 24 marbles altogether. Mia gives 5 away, so take 5 from 24.',
  ],
};
function initPrimary() {
  const root = $('#pri-demo');
  if (!root) return;
  const form = $('form', root);
  const input = $('input', root);
  const fb = $('.fb', root);
  const hints = $('.hints', root);
  const hintBtn = $('#pri-hint', root);
  const howBtn = $('#pri-how', root);
  const worked = $('.worked', root);
  let shown = 0;
  const showHint = () => {
    if (shown >= PRI.hints.length) return;
    const li = document.createElement('li');
    li.innerHTML = `<b>Hint ${shown + 1}.</b> `;
    li.append(PRI.hints[shown]);
    hints.append(li);
    shown++;
    if (shown >= PRI.hints.length) hintBtn.disabled = true;
  };
  hintBtn.addEventListener('click', showHint);
  howBtn.addEventListener('click', () => {
    const open = worked.classList.toggle('show');
    howBtn.setAttribute('aria-expanded', String(open));
  });
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const raw = input.value.trim();
    fb.className = 'fb';
    if (!/^\d+$/.test(raw)) { fb.textContent = 'Type a whole number, like 12.'; fb.className = 'fb no'; input.focus(); return; }
    const v = Number(raw);
    if (v === PRI.answer) {
      fb.textContent = 'Correct: 19 marbles. 3 × 8 = 24, then 24 − 5 = 19.';
      fb.className = 'fb ok';
      input.setAttribute('aria-invalid', 'false');
      return;
    }
    input.setAttribute('aria-invalid', 'true');
    fb.textContent = PRI.mistakes[v] || 'Not yet. Here is a hint to get you going.';
    fb.className = 'fb no';
    showHint();
  });
}

/* ---------- high school: one step at a time, then a follow-up ---------- */
function initHigh() {
  const root = $('#hs-demo');
  if (!root) return;
  const steps = $$('.sol li', root);
  const stepBtn = $('#hs-step', root);
  const follow = $('.follow', root);
  const fb = $('.follow .fb', root);
  let i = 0;
  steps.forEach((s) => { s.hidden = true; });
  stepBtn.addEventListener('click', () => {
    if (i < steps.length) { steps[i].hidden = false; i++; }
    stepBtn.textContent = i < steps.length ? `Show step ${i + 1} of ${steps.length}` : 'Solution complete';
    if (i >= steps.length) { stepBtn.disabled = true; follow.classList.add('show'); }
  });
  stepBtn.textContent = `Show step 1 of ${steps.length}`;
  $$('.follow .opt-row button', root).forEach((b) => b.addEventListener('click', () => {
    if (b.dataset.right) {
      b.classList.add('right');
      $$('.follow .opt-row button', root).forEach((x) => { x.disabled = true; });
      fb.textContent = 'Correct. 2x + 6 = x − 4, so x = −10. Check: 2(−10 + 3) = −14 and −10 − 4 = −14.';
      fb.className = 'fb ok';
    } else {
      b.classList.add('tried'); b.disabled = true;
      fb.textContent = b.dataset.why;
      fb.className = 'fb no';
    }
  }));
}

/* ---------- gentle reveal ---------- */
function initReveal() {
  const els = $$('.reveal');
  if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) { els.forEach((e) => e.classList.add('in')); return; }
  const io = new IntersectionObserver((entries) => entries.forEach((en) => {
    if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); }
  }), { rootMargin: '0px 0px -8% 0px' });
  els.forEach((e) => io.observe(e));
}

for (const f of [initMenu, initChooser, initCount, initPrimary, initHigh, initReveal]) {
  try { f(); } catch (e) { console.warn('[paths]', f.name, e); }
}
