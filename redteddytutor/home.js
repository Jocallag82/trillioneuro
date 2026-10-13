// Home page: the live question demo, the skill list (read from the curriculum
// framework, so it never drifts from the app), the menu and the news form.
// The demo uses the app's own generators, marking and mistake tips. It stores nothing.
import { OBJECTIVES, SUBJECTS, STRANDS } from '/learn/js/curriculum/framework.js';
import { generateStep } from '/learn/js/curriculum/generators.js';
import { MISCONCEPTIONS } from '/learn/js/curriculum/misconceptions.js';
import { pickLocale, localise } from '/learn/js/curriculum/locales.js';
import { grade, MAX_MISSES } from '/learn/js/engine.js';
import { el, visualNode } from '/learn/js/dom.js';
import { mulberry32 } from '/learn/game/js/rng.js';
import { US_CATALOGUE } from '/learn/js/curriculum/catalogues/us.js';
import { wireWelcome } from '/welcome-video.js';
import { helpFor } from '/learn/js/help.js';

const locale = pickLocale(navigator.languages || []);
const L = (t) => localise(t, locale);

/* ---------- skill list ---------- */
// Grades come from the US catalogue, so the list matches the curriculum page.
const gradeSpan = (grades) => {
  const name = (g) => (g === 'PK' ? 'Pre-K' : g === 'K' ? 'K' : g);
  if (!grades.length) return '';
  const first = name(grades[0]); const last = name(grades[grades.length - 1]);
  return grades.length === 1 ? (first === 'K' || first === 'Pre-K' ? first : `Grade ${first}`) : `Grades ${first}–${last}`;
};
const BLURBS = {
  maths: 'Counting to calculus: place value, the four operations, fractions and decimals, ratios, algebra, geometry, trigonometry and derivatives.',
  literacy: 'Phonics and reading to literary analysis: spelling, vocabulary, grammar, figurative language, comprehension and argument.',
  science: 'States of matter, ecosystems, cells, photosynthesis, the Earth–sun–moon system, density, forces, chemistry and genetics.',
  social: 'US government and the Bill of Rights, a US history timeline, states and capitals, supply and demand, and personal finance.',
  computing: 'Reading and tracing Python: variables, loops and conditions.',
  thinking: 'Colors, sorting, patterns, sequences, memory and logic puzzles for younger learners.',
};

function renderSubjects() {
  const host = document.getElementById('subjects');
  if (!host) return;
  const ids = Object.keys(OBJECTIVES);
  document.getElementById('obj-count').textContent = String(ids.length);
  document.querySelectorAll('[data-obj-count]').forEach((n) => { n.textContent = String(ids.length); });
  // On a phone the full list is long, so each subject starts folded.
  const open = window.matchMedia('(min-width: 641px)').matches;
  host.replaceChildren(...Object.entries(SUBJECTS).map(([sid, subject]) => {
    const mine = ids.filter((id) => OBJECTIVES[id].subject === sid);
    return el('article', { class: 'subject' }, [
      el('h3', { text: US_CATALOGUE.subjectNames[sid] || L(subject.label) }),
      BLURBS[sid] ? el('p', { text: BLURBS[sid] }) : null,
      el('details', { class: 'strands', open }, [
        el('summary', { text: `All ${mine.length} skills` }),
        ...subject.strands.map((strand) => {
          const list = mine.filter((id) => OBJECTIVES[id].strand === strand)
            .sort((x, y) => OBJECTIVES[x].order - OBJECTIVES[y].order);
          if (!list.length) return null;
          return el('div', { class: 'strand' }, [
            el('h4', { text: STRANDS[strand] }),
            el('ul', {}, list.map((id) => el('li', {}, [
              el('span', { text: L(OBJECTIVES[id].label) }),
              el('span', { text: gradeSpan(US_CATALOGUE.placement[id]?.grades || []) }),
            ]))),
          ]);
        }),
      ]),
    ]);
  }));
}

/* ---------- live demo ---------- */
// Skills chosen because their questions read well without sound or dragging.
const DEMO = {
  '3-5': ['number-names', 'subitise', 'patterns', 'rhyme', 'compare-numbers'],
  '5-7': ['add-within-20', 'shape-words', 'subtract-within-20', 'measure-length', 'place-value-100'],
  '7-9': ['tell-time', 'bar-charts', 'word-problems', 'comprehension', 'logic-puzzles', 'subtract-2digit', 'unit-fractions'],
  '9-11': ['decimals', 'area-perimeter', 'comprehension', 'logic-puzzles', 'times-tables', 'fractions-compare', 'spelling', 'states-capitals'],
  '11-14': ['equations-two-step', 'ratios-rates', 'integers', 'probability', 'pythagorean', 'context-clues', 'cells', 'code-tracing', 'percent'],
  '14-18': ['quadratics', 'trig-ratios', 'systems', 'function-notation', 'derivatives', 'forces-motion', 'literary-analysis', 'simple-interest', 'logarithms'],
};
const LEVEL = { '3-5': [1, 2], '5-7': [1, 2, 3], '7-9': [2, 3], '9-11': [2, 3], '11-14': [1, 2, 3], '14-18': [1, 2, 3] };
const BAND_NAME = { '3-5': 'Pre-K', '5-7': 'Grades K–1', '7-9': 'Grades 2–3', '9-11': 'Grades 4–5', '11-14': 'Grades 6–8', '14-18': 'Grades 9–12' };

const panel = document.getElementById('demo-panel');
const body = document.getElementById('demo-body');
const skillLine = document.getElementById('demo-skill');
const feedback = document.getElementById('demo-feedback');
const hintBtn = document.getElementById('demo-hint');
const howBtn = document.getElementById('demo-how');
// The age style for each demo band, the same as the app uses.
const BAND_STAGE = { '3-5': 'early', '5-7': 'early', '7-9': 'primary', '9-11': 'primary', '11-14': 'middle', '14-18': 'high' };
const nextBtn = document.getElementById('demo-next');
const tabs = [...document.querySelectorAll('.book-tabs [role=tab]')];
const rand = mulberry32((Date.now() ^ (Math.random() * 1e9)) >>> 0);

let band = '11-14';
let turn = Object.fromEntries(Object.keys(DEMO).map((b) => [b, Math.floor(rand() * DEMO[b].length)]));
let q = null; // { id, step, misses, hintsShown, done }

function makeQuestion() {
  const list = DEMO[band];
  for (let tries = 0; tries < 20; tries++) {
    const id = list[turn[band] % list.length];
    if (tries % 4 === 3) turn[band]++;
    const levels = LEVEL[band];
    const step = generateStep(id, levels[Math.floor(rand() * levels.length)], rand);
    const kind = step.kind || 'choice';
    if ((kind === 'choice' || kind === 'input') && !step.listen) { turn[band]++; return { id, step, misses: 0, hintsShown: 0, done: false }; }
  }
  return null;
}

function show(fbNode) { feedback.replaceChildren(fbNode); }
function hintNode(title, text) { return el('p', { class: 'fb fb-hint' }, [title, el('span', { text: L(text) })]); }

function nextHint() {
  const hints = q.step.hints || [];
  const text = hints[Math.min(q.hintsShown, hints.length - 1)];
  q.hintsShown++;
  return text;
}

function finish(correct) {
  q.done = true;
  hintBtn.disabled = true;
  body.querySelectorAll('button, input').forEach((n) => { n.disabled = true; });
  if (correct) {
    show(el('p', { class: 'fb fb-right', text: q.misses ? 'That’s it. Getting there after a hint still counts as learning.' : 'Right first time.' }));
  } else {
    const shown = q.step.options ? (q.step.options.find((o) => o.id === q.step.answer)?.label ?? q.step.answer) : q.step.answer;
    show(el('p', { class: 'fb fb-reveal', text: `The answer is ${L(String(shown))}. In the app, this skill would come back soon with easier questions first.` }));
  }
  body.querySelector(`[data-option="${CSS.escape(q.step.answer)}"]`)?.classList.add('is-right');
  nextBtn.focus();
}

function wrong(misconception) {
  q.misses++;
  if (q.misses >= MAX_MISSES) return finish(false);
  const tip = misconception && MISCONCEPTIONS[misconception]?.tip;
  show(tip ? hintNode('Not quite. A common slip: ', tip) : hintNode('Not quite. Hint: ', nextHint()));
}

function choose(id, btn) {
  if (q.done) return;
  if (id === q.step.answer) { btn.classList.add('is-right'); return finish(true); }
  btn.classList.add('is-wrong');
  btn.disabled = true;
  const opt = q.step.options.find((o) => o.id === id);
  const left = [...body.querySelectorAll('.demo-opt:not([disabled])')];
  if (left.length === 1) { q.misses = MAX_MISSES - 1; } // only the answer is left
  wrong(opt?.misconception);
}

function render() {
  q = makeQuestion();
  hintBtn.disabled = false;
  howBtn.setAttribute('aria-expanded', 'false');
  feedback.replaceChildren();
  if (!q) { body.replaceChildren(el('p', { class: 'demo-prompt', text: 'Could not make a question just now.' })); return; }
  const { step, id } = q;
  skillLine.replaceChildren(`${BAND_NAME[band]} · `, el('b', { text: L(OBJECTIVES[id].label) }));
  const pictorial = step.options?.every((o) => o.visual);
  const parts = [
    el('p', { class: 'demo-prompt', id: 'demo-prompt', text: L(step.prompt) }),
    step.visual ? el('div', { class: 'demo-stage' }, visualNode(step.visual.kind === 'passage' ? { ...step.visual, title: L(step.visual.title), text: L(step.visual.text) } : step.visual)) : null,
  ];
  if (step.kind === 'input') {
    const input = el('input', { type: 'text', inputmode: 'numeric', autocomplete: 'off', 'aria-labelledby': 'demo-prompt', maxlength: 8 });
    const submit = () => {
      if (q.done) return;
      const r = grade(step, input.value);
      if (!r.valid) { show(hintNode('', 'Type an answer first.')); input.focus(); return; }
      if (r.correct) return finish(true);
      wrong(r.misconception);
      input.select();
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    parts.push(el('div', { class: 'demo-input' }, [input, el('button', { type: 'button', class: 'btn btn-red', onclick: submit, text: 'Check' })]));
  } else {
    const long = step.options.some((o) => String(o.label).length > 18);
    parts.push(el('div', { class: `demo-options${long ? ' long' : ''}`, role: 'group', 'aria-labelledby': 'demo-prompt' }, step.options.map((o) => {
      const b = el('button', {
        type: 'button', class: 'demo-opt', dataset: { option: o.id },
        'aria-label': pictorial ? L(o.label) : undefined,
        onclick: (e) => choose(o.id, e.currentTarget),
      }, [
        o.visual ? el('span', { 'aria-hidden': pictorial ? 'true' : undefined }, visualNode(o.visual)) : null,
        pictorial ? null : el('span', { text: L(o.label) }),
      ]);
      return b;
    })));
  }
  body.replaceChildren(...parts.filter(Boolean));
}

function selectTab(tab, focus) {
  band = tab.dataset.band;
  tabs.forEach((t) => {
    const on = t === tab;
    t.setAttribute('aria-selected', String(on));
    t.tabIndex = on ? 0 : -1;
  });
  panel.setAttribute('aria-labelledby', tab.id);
  if (focus) tab.focus();
  render();
}

function initDemo() {
  if (!panel) return;
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => selectTab(t));
    t.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (!d) return;
      e.preventDefault();
      selectTab(tabs[(i + d + tabs.length) % tabs.length], true);
    });
  });
  hintBtn.addEventListener('click', () => { if (q && !q.done) show(hintNode('Hint: ', nextHint())); });
  howBtn.addEventListener('click', () => {
    if (!q) return;
    const h = helpFor(q.step, q.id, BAND_STAGE[band], rand);
    const ex = h.example;
    howBtn.setAttribute('aria-expanded', 'true');
    show(el('div', { class: 'demo-how' }, [
      h.method.length ? el('div', {}, [el('p', { class: 'demo-how-title', text: h.style.framing }), el('ul', {}, h.method.map((m) => el('li', { text: L(m) })))]) : null,
      ex ? el('div', { class: 'demo-how-ex' }, [
        el('p', { class: 'demo-how-title', text: h.style.exampleIntro }),
        el('p', { class: 'demo-how-q', text: L(ex.step.prompt) }),
        ex.step.visual ? el('div', { class: 'demo-how-visual' }, visualNode(ex.step.visual)) : null,
        el('ol', {}, ex.steps.map((t) => el('li', { text: L(t) }))),
        el('p', { class: 'demo-how-yours', text: 'Now try yours the same way.' }),
      ]) : null,
    ]));
  });
  nextBtn.addEventListener('click', () => { render(); body.querySelector('input, .demo-opt')?.focus({ preventScroll: true }); });
  render();
}

/* ---------- menu ---------- */
function initMenu() {
  const btn = document.querySelector('.menu-btn');
  const nav = document.getElementById('nav');
  const close = () => { nav.classList.remove('open'); btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', () => btn.setAttribute('aria-expanded', String(nav.classList.toggle('open'))));
  nav.addEventListener('click', (e) => { if (e.target.closest('a')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && nav.classList.contains('open')) { close(); btn.focus(); } });
}

/* ---------- news form ---------- */
// Supabase RPC rtt_join -> public.rtt_waitlist (insert-only, rate-limited; see README.md).
const ENDPOINT = 'https://kxzywyflylkcqoidiqmo.supabase.co/rest/v1/rpc/rtt_join';
const KEY = 'sb_publishable_37yXvakYMXdpz2e3Hf_zng__oGOVC-g';

function initForm() {
  const f = document.getElementById('ea-form');
  if (!f) return;
  const em = document.getElementById('email');
  const cs = document.getElementById('consent');
  const ee = document.getElementById('email-err');
  const ce = document.getElementById('consent-err');
  const st = document.getElementById('status');
  f.addEventListener('submit', (e) => {
    e.preventDefault();
    ee.textContent = ce.textContent = '';
    st.className = 'status';
    em.removeAttribute('aria-invalid');
    const v = em.value.trim();
    let bad = null;
    if (!v) { ee.textContent = 'Please enter your email address.'; bad = em; }
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v)) { ee.textContent = 'That doesn’t look like a complete email address.'; bad = em; }
    if (bad) em.setAttribute('aria-invalid', 'true');
    if (!cs.checked) { ce.textContent = 'Please tick the box so we may email you.'; bad = bad || cs; }
    if (bad) { bad.focus(); return; }
    const a = f.querySelector('input[name=audience]:checked');
    const b = f.querySelector('button[type=submit]');
    b.disabled = true;
    b.textContent = 'Saving…';
    fetch(ENDPOINT, { method: 'POST', headers: { apikey: KEY, 'Content-Type': 'application/json' }, body: JSON.stringify({ p_email: v, p_audience: a ? a.value : null }) })
      .then((r) => { if (!r.ok) throw new Error(String(r.status)); st.textContent = 'Thank you. We’ll email you when there is news.'; f.reset(); })
      .catch(() => { st.textContent = 'Sorry, that didn’t save. Please check your connection and try again.'; })
      .finally(() => { st.className = 'status show'; b.disabled = false; b.textContent = 'Keep me posted'; });
  });
}

initMenu();
initForm();
try { wireWelcome(); } catch (e) { console.warn('[home] welcome video', e); }
try { renderSubjects(); } catch (e) { console.warn('[home] skill list', e); }
try { initDemo(); } catch (e) {
  console.warn('[home] demo', e);
  body?.replaceChildren(el('p', { class: 'demo-prompt', text: 'The live question could not load. You can still open the app.' }));
}
