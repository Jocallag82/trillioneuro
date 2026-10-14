// Red Teddy early-years games: rules. Pure functions, no DOM, so every mechanic is
// testable in Node (scripts/early-games.test.mjs). player.js draws the screen.

// Seeded random numbers (mulberry32) so a `?seed=` gives a repeatable game.
export function rng(seed = Date.now()) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function shuffle(list, rand) {
  const a = list.slice();
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

// Normalises an option. A bare string is a photo asset; otherwise `id` falls back to the
// text, numeral or shape so the answer key can name it.
export function opt(o) {
  if (typeof o === 'string') return { id: o, asset: o, label: o };
  const id = o.id ?? o.text ?? (o.numeral != null ? String(o.numeral) : o.shape ?? o.asset);
  const label = o.label ?? o.text ?? (o.numeral != null ? String(o.numeral) : o.asset) ?? id;
  return { ...o, id: String(id), label };
}

export const isCorrect = (question, optionId) => String(question.answer) === String(optionId);

// Assets an activity uses, for validation and preloading.
export function assetsOf(a) {
  const out = new Set();
  const add = (x) => {
    if (!x) return;
    if (typeof x === 'string') { if (x !== '?') out.add(x); return; }
    if (Array.isArray(x)) return x.forEach(add);
    if (x.asset) out.add(x.asset);
    if (x.type === 'asset' || x.type === 'half') out.add(x.id ?? x.asset);
    if (x.items) add(x.items);
    if (x.a && typeof x.a === 'object') add(x.a); if (x.b && typeof x.b === 'object') add(x.b);
  };
  for (const i of a.items || []) add(i.asset);
  for (const q of a.questions || []) { q.options.forEach(add); add(q.show); }
  for (const r of a.rounds || []) {
    if (Array.isArray(r)) r.forEach((p) => (Array.isArray(p) ? p.forEach(add) : add(p)));
    else { add(r.asset); add(r.steps); add(r.extra); (r.bins || []).forEach(add); (r.items || []).forEach(([o]) => add(o)); }
  }
  return [...out];
}
export function soundsOf(a) {
  const out = new Set();
  for (const i of a.items || []) if (i.sound) out.add(i.sound);
  for (const q of a.questions || []) if (q.show?.type === 'sound') out.add(q.show.id);
  return [...out];
}

// Structural check of one activity. Returns a list of problems (empty = valid).
export function validate(a, { photos = new Set(), sounds = new Set() } = {}) {
  const e = [];
  const need = ['id', 'band', 'title', 'area', 'kind', 'objective', 'practising', 'intro', 'together', 'offline'];
  for (const k of need) if (!a[k] || String(a[k]).length < 2) e.push(`${a.id}: missing ${k}`);
  if (!['1-2', '2-3', '3-4', '4-6'].includes(a.band)) e.push(`${a.id}: bad band`);
  const K = a.kind;
  if (K === 'explore' && !(a.items?.length >= 4)) e.push(`${a.id}: explore needs 4+ items`);
  if (K === 'parent' && !(a.prompts?.length >= 3)) e.push(`${a.id}: parent needs 3+ prompts`);
  if (K === 'choose') {
    if (!(a.questions?.length >= 4)) e.push(`${a.id}: choose needs 4+ questions`);
    const seen = new Set();
    for (const [i, q] of (a.questions || []).entries()) {
      const ids = q.options.map((o) => opt(o).id);
      if (ids.length < 2) e.push(`${a.id}#${i}: fewer than 2 options`);
      if (new Set(ids).size !== ids.length) e.push(`${a.id}#${i}: duplicate options ${ids}`);
      if (ids.filter((x) => x === String(q.answer)).length !== 1) e.push(`${a.id}#${i}: answer ${q.answer} not exactly once in ${ids}`);
      if (!q.hint || !q.prompt) e.push(`${a.id}#${i}: needs prompt and hint`);
      const sig = q.prompt + JSON.stringify(q.show || '') + q.options.map((o) => JSON.stringify(o)).sort().join();
      if (seen.has(sig)) e.push(`${a.id}#${i}: duplicate question`);
      seen.add(sig);
      if (a.band === '1-2' && ids.length > 2) e.push(`${a.id}#${i}: ages 1-2 use two choices`);
    }
  }
  if (K === 'count') for (const r of a.rounds || []) if (!(r.n >= 1 && r.n <= 20 && r.asset)) e.push(`${a.id}: bad count round`);
  if (K === 'match') for (const r of a.rounds || []) {

    if (r.length < 2) e.push(`${a.id}: match round needs 2+ pairs`);
    const lefts = r.map((p) => opt(p[0]).id);
    if (new Set(lefts).size !== lefts.length) e.push(`${a.id}: duplicate left in match round`);

  }
  if (K === 'memory') for (const r of a.rounds || []) if (r.length < 2 || new Set(r).size !== r.length) e.push(`${a.id}: bad memory round`);
  if (K === 'sort') for (const r of a.rounds || []) {
    const bins = new Set(r.bins.map((b) => b.id));
    for (const [o, b] of r.items) if (!bins.has(b)) e.push(`${a.id}: ${opt(o).id} -> unknown bin ${b}`);
    for (const b of bins) if (!r.items.some(([, x]) => x === b)) e.push(`${a.id}: empty bin ${b}`);
  }
  if (K === 'sequence') for (const r of a.rounds || []) {
    const ids = [...r.steps, ...(r.extra || [])].map((o) => opt(o).id);
    if (r.steps.length < 2) e.push(`${a.id}: sequence needs 2+ steps`);
    if (new Set(ids).size !== ids.length) e.push(`${a.id}: duplicate sequence card`);
    if (r.labels && r.labels.length !== r.steps.length) e.push(`${a.id}: labels must match steps`);
  }
  if (['count', 'match', 'memory', 'sort', 'sequence'].includes(K) && !(a.rounds?.length >= 2)) e.push(`${a.id}: needs 2+ rounds`);
  if (photos.size) for (const x of assetsOf(a)) if (!photos.has(x)) e.push(`${a.id}: unknown photo ${x}`);
  if (sounds.size) for (const x of soundsOf(a)) if (!sounds.has(x)) e.push(`${a.id}: unknown sound ${x}`);
  return e;
}

// Answer bookkeeping shared by every scored mechanic. No scores are shown to children:
// it only decides when to offer a hint and when to show the answer kindly.
//   miss 1 -> hint, miss 2 -> one wrong option is set aside, miss 3 -> answer is shown.
// Forgiving activities (ages 1-2) show the answer after the first miss.
export function attempt(state, correct, { forgiving = false } = {}) {
  if (correct) return { ...state, done: true, result: 'correct' };
  const misses = state.misses + 1;
  const limit = forgiving ? 1 : 3;
  return { ...state, misses, result: misses >= limit ? 'reveal' : misses === 1 ? 'hint' : 'narrow', done: misses >= limit };
}
export const fresh = () => ({ misses: 0, done: false, result: null });

// Number of steps an activity has, for the progress dots.
export function stepsOf(a) {
  if (a.kind === 'choose') return a.questions.length;
  if (a.kind === 'explore') return a.items.length;
  if (a.kind === 'parent') return a.prompts.length;
  return a.rounds.length;
}

// Count: the child taps each object; numbers given in order. Returns the next tally.
export function tally(counted, index) { return counted.includes(index) ? counted : [...counted, index]; }

// Sequence: is `id` the right next card given the cards already placed?
export const nextInSequence = (round, placed, id) => opt(round.steps[placed.length]).id === id;

// Match: pairs are matched by their index in the round.
export const isPair = (round, leftIndex, rightIndex) => leftIndex === rightIndex;
