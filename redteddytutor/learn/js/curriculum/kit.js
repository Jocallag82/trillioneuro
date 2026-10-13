// Building blocks for generated practice. Every generator file uses these, so a
// choice, typed answer or ordering step always has the same shape and checks.
export const int = (rand, lo, hi) => lo + Math.floor(rand() * (hi - lo + 1));
export const pick = (rand, list) => list[Math.floor(rand() * list.length)];

export function shuffled(list, rand) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Builds a choice step from the right value and candidate wrong values.
// Wrong values equal to the answer, duplicates and out-of-range values are dropped.
export function choice(rand, { prompt, visual, answer, wrong, hints, label = String, visualFor, listen, min = -Infinity, max = Infinity, size = 4 }) {
  const seen = new Set([String(answer)]);
  const distractors = [];
  for (const w of wrong) {
    const key = String(w.value);
    if (seen.has(key) || (typeof w.value === 'number' && (w.value < min || w.value > max))) continue;
    seen.add(key);
    distractors.push(w);
  }
  const chosen = [{ value: answer }, ...distractors.slice(0, size - 1)];
  const options = shuffled(chosen, rand).map((w) => ({
    id: String(w.value),
    label: label(w.value),
    ...(visualFor ? { visual: visualFor(w.value) } : {}),
    ...(w.misconception ? { misconception: w.misconception } : {}),
  }));
  return { prompt, ...(visual ? { visual } : {}), ...(listen ? { listen: true } : {}), options, answer: String(answer), hints };
}

// Typed numeric answer. `wrong` maps a wrong value to the mistake it shows.
export function input(prompt, answer, hints, wrong = {}, visual) {
  const map = {};
  for (const [k, v] of Object.entries(wrong)) if (Number(k) !== answer && v) map[String(k)] = v;
  return { kind: 'input', prompt, ...(visual ? { visual } : {}), answer: String(answer), wrong: map, hints };
}

export const dots = (count) => ({ kind: 'dots', count });
export const text = (t) => ({ kind: 'text', text: String(t) });


export function order(prompt, tokens, accept, rand, hints, misconception, extra = {}) {
  const tiles = tokens.map((label, i) => ({ id: `t${i}`, label }));
  let order = shuffled(tiles, rand);
  if (order.map((t) => t.label).join(' ') === accept[0]) order = [...order.slice(1), order[0]];
  return { kind: 'order', prompt, tiles: order, accept, answer: accept[0], hints, misconception, ...extra };
}
