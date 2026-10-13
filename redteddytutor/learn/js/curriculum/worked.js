// Worked solutions: the actual working, with the question's own numbers, step by step.
//
// Shown only for the "Show me how" example (a different question of the same kind),
// never for the learner's own question. Each solver reads the question exactly as
// the learner sees it. Where there is no solver (most authored banks), the question's
// hints are used, followed by the answer. scripts/secondary.test.mjs checks that every
// worked solution ends with the right answer.
const num = (s) => Number(String(s).replace(/−/g, '-'));
const nums = (s) => (String(s).replace(/−/g, '-').match(/-?\d+(\.\d+)?/g) || []).map(Number);
const neg = (n) => (n < 0 ? `−${-n}` : String(n));
const par = (n) => (n < 0 ? `(${neg(n)})` : String(n));
const countList = (from, to) => Array.from({ length: to - from + 1 }, (_, i) => from + i).join(', ');
const SUP = { '⁰': 0, '¹': 1, '²': 2, '³': 3, '⁴': 4, '⁵': 5, '⁶': 6, '⁷': 7, '⁸': 8, '⁹': 9 };
const unsup = (s) => Number([...s].map((c) => SUP[c]).join(''));

// Each solver returns an array of lines, or null when it does not recognise the question.
const SOLVERS = {
  // ---- Expansion, October 2026 ----
  'multiply-multidigit': (s) => {
    const [a, b] = nums(s.prompt);
    if (b < 10) {
      const parts = String(a).split('').reverse().map((dg, i) => Number(dg) * 10 ** i).filter(Boolean).reverse();
      return [...parts.map((p) => `${p} × ${b} = ${p * b}.`), `Add the parts: ${parts.map((p) => p * b).join(' + ')} = ${a * b}.`];
    }
    const t = Math.floor(b / 10) * 10; const o = b % 10;
    return [`Split ${b} into ${t} + ${o}.`, `${a} × ${o} = ${a * o}.`, `${a} × ${t} = ${a * t}.`, `Add the partial products: ${a * o} + ${a * t} = ${a * b}.`];
  },
  'long-division': (s) => {
    const [a, b] = nums(s.prompt);
    const lines = []; let r = 0;
    for (const dg of String(a)) {
      const cur = r * 10 + Number(dg); const q = Math.floor(cur / b); r = cur - q * b;
      if (cur >= b || lines.length) lines.push(`${cur} ÷ ${b} = ${q}${r ? ` remainder ${r}` : ''}.`);
    }
    return /remainder/.test(s.prompt)
      ? [...lines, `${b} × ${Math.floor(a / b)} = ${b * Math.floor(a / b)}, and ${a} − ${b * Math.floor(a / b)} = ${a % b}. The remainder is ${a % b}.`]
      : [...lines, `So ${a} ÷ ${b} = ${a / b}. Check: ${a / b} × ${b} = ${a}.`];
  },
  'order-of-operations': (s) => {
    const e = s.prompt.replace(/ = \?$/, '');
    let m;
    if ((m = e.match(/^(\d+) ([+−]) (\d+) × (\d+)$/))) { const p = m[3] * m[4]; return [`Multiply first: ${m[3]} × ${m[4]} = ${p}.`, `Then ${m[1]} ${m[2]} ${p} = ${m[2] === '+' ? Number(m[1]) + p : m[1] - p}.`]; }
    if ((m = e.match(/^\((\d+) \+ (\d+)\) × (\d+) − (\d+)$/))) { const p = Number(m[1]) + Number(m[2]); return [`Parentheses: ${m[1]} + ${m[2]} = ${p}.`, `Multiply: ${p} × ${m[3]} = ${p * m[3]}.`, `Subtract: ${p * m[3]} − ${m[4]} = ${p * m[3] - m[4]}.`]; }
    if ((m = e.match(/^(\d+) \+ (\d+)² × (\d+) ÷ (\d+)$/))) { const sq = m[2] ** 2; const t = sq * m[3]; return [`Exponent: ${m[2]}² = ${sq}.`, `Left to right: ${sq} × ${m[3]} = ${t}, then ${t} ÷ ${m[4]} = ${t / m[4]}.`, `Add: ${m[1]} + ${t / m[4]} = ${Number(m[1]) + t / m[4]}.`]; }
    return null;
  },
  'volume': (s) => {
    const v = nums(s.prompt);
    if (/How tall/.test(s.prompt)) { const [V, l, w] = v; return [`Base: ${l} × ${w} = ${l * w}.`, `Height = ${V} ÷ ${l * w} = ${V / (l * w)}.`]; }
    const [l, w, h] = v; return [`One layer: ${l} × ${w} = ${l * w}.`, `${h} layers: ${l * w} × ${h} = ${l * w * h}.`];
  },
  'circles': (s) => {
    const [n] = nums(s.prompt);
    if (/circumference/.test(s.prompt)) return [`C = 2πr = 2 × π × ${n}.`, `So C = ${2 * n}π, and k = ${2 * n}.`];
    const r = /diameter/.test(s.prompt) ? n / 2 : n;
    return [...(/diameter/.test(s.prompt) ? [`Radius = ${n} ÷ 2 = ${r}.`] : []), `A = πr² = π × ${r}².`, `${r}² = ${r * r}, so k = ${r * r}.`];
  },
  'volume-solids': (s) => {
    const [r, h] = nums(s.prompt);
    if (/cylinder/.test(s.prompt)) return [`V = πr²h = π × ${r}² × ${h}.`, `${r * r} × ${h} = ${r * r * h}, so k = ${r * r * h}.`];
    if (/cone/.test(s.prompt)) return [`V = ⅓πr²h = ⅓ × π × ${r}² × ${h}.`, `${r * r} × ${h} = ${r * r * h}; ${r * r * h} ÷ 3 = ${(r * r * h) / 3}. So k = ${(r * r * h) / 3}.`];
    return [`V = ⁴⁄₃πr³ = ⁴⁄₃ × π × ${r}³.`, `${r}³ = ${r ** 3}; × 4 = ${4 * r ** 3}; ÷ 3 = ${(4 * r ** 3) / 3}. So k = ${(4 * r ** 3) / 3}.`];
  },
  'sequences': (s) => {
    const v = nums(s.prompt.replace(/term \d+.*$/, '')); const n = Number(s.prompt.match(/term (\d+)\?$/)?.[1]);
    if (/goes up by the same amount/.test(s.prompt)) { const dd = v[1] - v[0]; return [`Common difference: ${neg(v[1])} − ${par(v[0])} = ${dd}.`, `Term ${n} = ${neg(v[0])} + (${n} − 1) × ${dd} = ${neg(v[0] + (n - 1) * dd)}.`]; }
    if (/multiplied by the same number/.test(s.prompt)) { const r = v[1] / v[0]; return [`Common ratio: ${v[1]} ÷ ${v[0]} = ${r}.`, `Term ${n} = ${v[0]} × ${r}^${n - 1} = ${v[0] * r ** (n - 1)}.`]; }
    const m = s.prompt.match(/term (\d+) is (\S+) and term (\d+) is (\S+)\./); if (!m) return null;
    const [i, a, j, b] = [Number(m[1]), num(m[2]), Number(m[3]), num(m[4])]; const dd = (b - a) / (j - i);
    return [`From term ${i} to term ${j}: ${j - i} steps, a change of ${neg(b - a)}. Difference = ${neg(b - a)} ÷ ${j - i} = ${neg(dd)}.`, `Term 1 = ${neg(a)} − ${i - 1} × ${par(dd)} = ${neg(a - (i - 1) * dd)}.`];
  },
  'data-spread': (s) => {
    const m = s.prompt.match(/of: (.+)$/); if (!m) return null;
    const v = nums(m[1]).sort((x, y) => x - y);
    const lower = v.slice(0, 3); const upper = v.slice(4);
    const lines = [`In order: ${v.join(', ')}. Median: ${v[3]}.`, `Lower half ${lower.join(', ')} → Q1 = ${lower[1]}.`];
    if (/lower quartile/.test(s.prompt)) return lines;
    return [...lines, `Upper half ${upper.join(', ')} → Q3 = ${upper[1]}.`, `IQR = ${upper[1]} − ${lower[1]} = ${upper[1] - lower[1]}.`];
  },
  'energy': (s) => {
    const v = nums(s.prompt);
    if (/kinetic energy in joules/.test(s.prompt)) { const [m, sp] = v; return [`KE = ½mv² = ½ × ${m} × ${sp}².`, `${sp}² = ${sp * sp}; ½ × ${m} × ${sp * sp} = ${(m * sp * sp) / 2}.`]; }
    const [m, h] = v.filter((x) => x !== 10); if (m === undefined || h === undefined) return null;
    return [`PE = mgh = ${m} × 10 × ${h} = ${m * 10 * h}.`, ...(/dropped/.test(s.prompt) ? [`All of it becomes kinetic energy: ${m * 10 * h}.`] : [])];
  },
  'binary': (s) => {
    let m;
    if ((m = s.prompt.match(/binary number (\d+) in decimal/))) { const bits = m[1]; const parts = [...bits].map((b, i) => (b === '1' ? 2 ** (bits.length - 1 - i) : 0)).filter(Boolean); return [`Place values with a 1: ${parts.join(' + ')}.`, `Total: ${parts.reduce((x, y) => x + y, 0)}.`]; }
    if ((m = s.prompt.match(/using (\d+) bits/))) { const b = Number(m[1]); return [`Each bit doubles the patterns: 2 multiplied ${b} times.`, `2^${b} = ${2 ** b}.`]; }
    return null;
  },
  'count-to-5': countDots,
  'count-to-10': (s) => (s.kind === 'build'
    ? [`Put the counters in one at a time and count: ${countList(1, s.target)}.`, `Stop at ${s.target}.`]
    : countDots(s)),
  'number-names': (s) => {
    const n = nums(s.prompt)[0];
    return [`The number is ${n}.`, 'Count the dots in each picture.', `The picture with ${n} ${n === 1 ? 'dot' : 'dots'} is the one: ${countList(1, n)}.`];
  },
  'subitise': (s) => {
    const n = s.visual.filled;
    return n > 5
      ? ['The top row is full. A full row is 5.', `The bottom row has ${n - 5} more.`, `5 and ${n - 5} make ${n}.`]
      : [`There is only one row of counters. Count them: ${countList(1, n)}.`, `There are ${n}.`];
  },
  'compare-numbers': (s) => {
    const [a, b] = nums(s.prompt);
    const smaller = /smaller/.test(s.prompt);
    const lo = Math.min(a, b); const hi = Math.max(a, b);
    return [`Count up: you say ${lo} before you say ${hi}.`, `So ${hi} is bigger and ${lo} is smaller.`, `The question asks for the ${smaller ? 'smaller' : 'bigger'} one: ${smaller ? lo : hi}.`];
  },
  'number-line-20': (s) => (s.target <= 10
    ? ['Start at 0.', `Count the jumps: ${countList(1, s.target)}.`, `Put the marker on ${s.target}.`]
    : ['Start at 10.', `Count on the jumps: ${countList(11, s.target)}.`, `Put the marker on ${s.target}.`]),
  'bonds-to-10': (s) => {
    if (s.kind === 'build') {
      const k = 10 - s.start;
      return [`There are ${s.start} counters. A full frame is 10.`, `Count on from ${s.start}: ${countList(s.start + 1, 10)}.`, `That is ${k} more counters.`];
    }
    const a = nums(s.prompt)[0];
    return [`Start at ${a} and count on to 10: ${countList(a + 1, 10)}.`, `That is ${10 - a} jumps, so ${a} + ${10 - a} = 10.`];
  },
  'add-within-20': (s) => {
    if (/\?\s*=/.test(s.prompt)) {
      const [a, total] = nums(s.prompt);
      return [`Start at ${a} and count on to ${total}: ${countList(a + 1, total)}.`, `That is ${total - a} jumps, so the missing number is ${total - a}.`];
    }
    const [a, b] = nums(s.prompt);
    if (a + b > 10 && a < 10) {
      const toTen = 10 - a; const left = b - toTen;
      return [`${a} needs ${toTen} to make 10.`, `Split ${b} into ${toTen} and ${left}.`, `${a} + ${toTen} = 10, then 10 + ${left} = ${a + b}.`];
    }
    return [`Start at ${a}.`, `Count on ${b}: ${countList(a + 1, a + b)}.`, `You land on ${a + b}.`];
  },
  'subtract-within-20': (s) => {
    const [a, b] = nums(s.prompt);
    if (a > 10 && b > a - 10) {
      const toTen = a - 10; const rest = b - toTen;
      return [`First take away ${toTen} to get to 10: ${a} − ${toTen} = 10.`, `You still need to take away ${b} − ${toTen} = ${rest}.`, `10 − ${rest} = ${a - b}.`];
    }
    return [`Start at ${a}.`, `Count back ${b}: ${countList(a - b, a - 1).split(', ').reverse().join(', ')}.`, `You land on ${a - b}.`];
  },
  'add-2digit': (s) => {
    const [a, b] = nums(s.prompt);
    const ao = a % 10; const bo = b % 10; const at = Math.floor(a / 10); const bt = Math.floor(b / 10);
    const ones = ao + bo;
    const carry = ones >= 10 ? 1 : 0;
    return [
      `Ones: ${ao} + ${bo} = ${ones}.${carry ? ` That is 1 ten and ${ones - 10} ones. Write ${ones - 10}, carry the 1 ten.` : ''}`,
      `Tens: ${at} + ${bt}${carry ? ' + 1 carried' : ''} = ${at + bt + carry} tens.`,
      `So ${a} + ${b} = ${a + b}.`,
    ];
  },
  'subtract-2digit': (s) => {
    const [a, b] = nums(s.prompt);
    const ao = a % 10; const bo = b % 10; const at = Math.floor(a / 10); const bt = Math.floor(b / 10);
    if (ao < bo) {
      return [
        `Ones: ${ao} is smaller than ${bo}, so exchange one ten: ${a} becomes ${at - 1} tens and ${ao + 10} ones.`,
        `Ones: ${ao + 10} − ${bo} = ${ao + 10 - bo}.`,
        `Tens: ${at - 1} − ${bt} = ${at - 1 - bt}.`,
        `So ${a} − ${b} = ${a - b}. Check: ${a - b} + ${b} = ${a}.`,
      ];
    }
    return [`Ones: ${ao} − ${bo} = ${ao - bo}.`, `Tens: ${at} − ${bt} = ${at - bt}.`, `So ${a} − ${b} = ${a - b}. Check: ${a - b} + ${b} = ${a}.`];
  },
  'times-2-5-10': timesWork,
  'times-tables': timesWork,
  'division-facts': (s) => {
    const [c, a] = nums(s.prompt);
    const q = c / a;
    return [`Ask: how many ${a}s make ${c}?`, `Count in ${a}s: ${Array.from({ length: q }, (_, i) => a * (i + 1)).join(', ')}.`, `That is ${q} ${a}s, so ${c} ÷ ${a} = ${q}.`];
  },
  'unit-fractions': (s) => (s.visual?.kind === 'fraction'
    ? [`Count all the equal parts: there are ${s.visual.parts}. That is the bottom number.`, '1 part is shaded. That is the top number.', `So the fraction is 1/${s.visual.parts}.`]
    : null),
  'fractions-compare': (s) => {
    const m = s.prompt.match(/(\d+)\/(\d+) or (\d+)\/(\d+)/);
    if (!m) return s.kind === 'numberline' ? [`The line from 0 to 1 is cut into ${s.max} equal jumps.`, `Count ${s.target} ${s.target === 1 ? 'jump' : 'jumps'} from 0.`, `That point is ${s.target}/${s.max}.`] : null;
    const [n1, d1, n2, d2] = m.slice(1).map(Number);
    if (n1 === 1 && n2 === 1) {
      const big = Math.min(d1, d2);
      return [`Picture one bar cut into ${d1} parts and another cut into ${d2} parts.`, `Fewer parts means each part is bigger.`, `So 1/${big} is bigger.`];
    }
    const lcm = (x, y) => { let k = Math.max(x, y); while (k % x || k % y) k++; return k; };
    const L = lcm(d1, d2); const a = n1 * (L / d1); const b = n2 * (L / d2);
    return [`Use the same bottom number: ${L}.`, `${n1}/${d1} = ${a}/${L} and ${n2}/${d2} = ${b}/${L}.`, `${Math.max(a, b)}/${L} is bigger, so ${a > b ? `${n1}/${d1}` : `${n2}/${d2}`} is bigger.`];
  },
  'measure-length': (s) => {
    const { start, length } = s.visual;
    return start
      ? [`The pencil starts at ${start} and ends at ${start + length}.`, `Length = end − start = ${start + length} − ${start} = ${length} cm.`]
      : ['The pencil starts at 0.', `It ends at ${length}, so it is ${length} cm long.`];
  },
  'tell-time': (s) => {
    const { h, m } = s.visual;
    return [
      `The short hand is ${m === 0 ? 'right on' : 'just past'} the ${h}, so the hour is ${h}.`,
      m === 0 ? 'The long hand points to 12, so it is exactly on the hour.' : `The long hand points to the ${m / 5}. Count by 5s from the 12: ${Array.from({ length: m / 5 }, (_, i) => (i + 1) * 5).join(', ')}. That is ${m} minutes.`,
      `The time is ${h}:${String(m).padStart(2, '0')}.`,
    ];
  },
  'bar-charts': (s) => {
    const v = Object.fromEntries((s.visual?.items || []).map((b) => [b.label, b.value]));
    let m;
    if ((m = s.prompt.match(/How many more (\w+) than (\w+)\?/))) return [`Read the ${m[1]} bar: ${v[m[1]]}.`, `Read the ${m[2]} bar: ${v[m[2]]}.`, `Difference: ${v[m[1]]} − ${v[m[2]]} = ${v[m[1]] - v[m[2]]}.`];
    if ((m = s.prompt.match(/how many for (\w+)\?/))) return [`The scale goes up in ${s.visual.step}s.`, `Follow the top of the ${m[1]} bar across to the scale.`, `It reads ${v[m[1]]}.`];
    if (/most/.test(s.prompt)) { const top = Object.entries(v).sort((x, y) => y[1] - x[1])[0]; return ['Find the tallest bar.', `It is ${top[0]}, at ${top[1]}.`]; }
    return null;
  },
  'area-perimeter': (s) => {
    const { w, h } = s.visual;
    return /perimeter/.test(s.prompt)
      ? ['Perimeter is the distance all the way around.', `Add all four sides: ${w} + ${h} + ${w} + ${h} = ${2 * (w + h)} cm.`]
      : [`The rectangle is ${w} long and ${h} wide.`, `Area = length × width = ${w} × ${h} = ${w * h} square cm.`];
  },
  'decimals': (s) => {
    let m;
    if ((m = s.prompt.match(/Which is bigger: (\S+) or (\S+)\?/))) {
      const [a, b] = [m[1], m[2]];
      const ta = a.split('.')[1][0]; const tb = b.split('.')[1][0];
      if (ta !== tb) return [`Compare tenths first: ${a} has ${ta} tenths, ${b} has ${tb} tenths.`, `${Math.max(ta, tb)} tenths is more, so ${Number(a) > Number(b) ? a : b} is bigger.`];
      return [`Both have ${ta} tenths, so compare hundredths.`, `${Number(a) > Number(b) ? a : b} has more hundredths, so it is bigger.`];
    }
    if ((m = s.prompt.match(/same as (\d+)\/(\d+)/))) {
      const [n, d] = [Number(m[1]), Number(m[2])];
      return d === 10 ? [`${n}/10 means ${n} tenths.`, `Tenths go in the first place after the point: 0.${n}.`] : [`${n}/100 means ${n} hundredths.`, `Hundredths fill two places after the point: ${(n / 100).toFixed(2)}.`];
    }
    return null;
  },
  'logic-puzzles': (s) => {
    if (s.visual?.kind !== 'passage') return null;
    const MORE = { taller: 1, older: 1, faster: 1, shorter: -1, younger: -1, slower: -1 };
    const clues = [...s.visual.text.matchAll(/(\w+) is (\w+) than (\w+)\./g)];
    const pairs = clues.map(([, a, rel, b]) => (MORE[rel] > 0 ? [a, b] : [b, a]));
    const word = clues.find(([, , rel]) => MORE[rel] > 0)?.[2] || ({ shorter: 'taller', younger: 'older', slower: 'faster' })[clues[0][2]];
    // Build the line from the top: the one nobody is above.
    const names = [...new Set(pairs.flat())];
    const order = [];
    let left = [...names];
    while (left.length) {
      const top = left.find((n) => !pairs.some(([hi, lo]) => lo === n && left.includes(hi)));
      order.push(top); left = left.filter((n) => n !== top);
    }
    return [
      ...clues.map(([full, a, rel, b]) => (MORE[rel] > 0 ? `“${full}” → ${a} is above ${b}.` : `“${full}” → ${b} is above ${a}.`)),
      `Put them in a line, ${({ taller: 'tallest', older: 'oldest', faster: 'fastest' })[word]} first: ${order.join(' → ')}.`,
      `Now answer the question using the line: ${s.options.find((o) => o.id === s.answer).label}.`,
    ];
  },
  'number-patterns': (s) => {
    const seq = nums(s.prompt.replace(/^What comes next\?/, ''));
    const diffs = seq.slice(1).map((x, i) => x - seq[i]);
    if (diffs.every((d) => d === diffs[0])) return [`Find the jumps: ${diffs.map((d) => (d < 0 ? `−${-d}` : `+${d}`)).join(', ')}.`, `The rule is ${diffs[0] < 0 ? `−${-diffs[0]}` : `+${diffs[0]}`} each time.`, `${seq[seq.length - 1]} ${diffs[0] < 0 ? '−' : '+'} ${Math.abs(diffs[0])} = ${seq[seq.length - 1] + diffs[0]}.`];
    return ['The jumps are not the same, so look for another rule.', `Each number is double the one before: ${seq.join(' → ')}.`, `${seq[seq.length - 1]} × 2 = ${seq[seq.length - 1] * 2}.`];
  },

  // ---- Grades 6-12 ----
  'integers': (s) => {
    const m = s.prompt.match(/^\(?(−?\d+)\)? ([+−×]) \(?(−?\d+)\)?/);
    if (!m) return null;
    const [a, op, b] = [num(m[1]), m[2], num(m[3])];
    if (op === '×') return [`Multiply the sizes: ${Math.abs(a)} × ${Math.abs(b)} = ${Math.abs(a * b)}.`, `Signs: ${(a < 0) === (b < 0) ? 'same signs give a positive answer' : 'different signs give a negative answer'}.`, `So ${par(a)} × ${par(b)} = ${neg(a * b)}.`];
    const add = op === '+' ? b : -b;
    return [
      op === '−' ? `Subtracting ${par(b)} is the same as adding ${par(-b)}: ${par(a)} + ${par(-b)}.` : `Start at ${neg(a)} on the number line.`,
      `Move ${Math.abs(add)} to the ${add >= 0 ? 'right' : 'left'}.`,
      `You land on ${neg(a + add)}.`,
    ];
  },
  'mean-median': (s) => {
    const v = nums(s.prompt.split(':')[1]);
    if (/median/.test(s.prompt)) { const o = [...v].sort((x, y) => x - y); return [`Put them in order: ${o.join(', ')}.`, `The middle one is ${o[2]}.`]; }
    if (/mean/.test(s.prompt)) { const t = v.reduce((x, y) => x + y, 0); return [`Add them: ${v.join(' + ')} = ${t}.`, `Divide by how many there are: ${t} ÷ ${v.length} = ${t / v.length}.`]; }
    return [`Largest: ${Math.max(...v)}. Smallest: ${Math.min(...v)}.`, `Range = ${Math.max(...v)} − ${Math.min(...v)} = ${Math.max(...v) - Math.min(...v)}.`];
  },
  'percent': (s) => {
    let m;
    if ((m = s.prompt.match(/What is (\d+)% of (\d+)\?/))) { const [p, n] = [Number(m[1]), Number(m[2])]; return [`10% of ${n} is ${n / 10}.`, `${p}% is ${p / 10} times that: ${n / 10} × ${p / 10} = ${(n * p) / 100}.`]; }
    if ((m = s.prompt.match(/costs \$(\d+)\. It is on sale for (\d+)% off/))) { const [n, p] = [Number(m[1]), Number(m[2])]; const off = (n * p) / 100; return [`Discount: ${p}% of $${n} = $${off}.`, `Sale price: $${n} − $${off} = $${n - off}.`]; }
    return null;
  },
  'ratios-rates': (s) => {
    let m;
    if ((m = s.prompt.match(/uses (\d+) cups of flour for every (\d+) batches.*for (\d+) batches/))) { const [a, b, c] = m.slice(1).map(Number); return [`${c} batches is ${c / b} times ${b} batches.`, `Multiply the flour by ${c / b} too: ${a} × ${c / b} = ${(a * c) / b} cups.`]; }
    const v = nums(s.prompt);
    if (v.length === 2 && !/Store/.test(s.prompt)) { const [x, y] = /tickets/.test(s.prompt) ? [v[1], v[0]] : v; return [`A unit rate is the amount for one.`, `Divide: ${x} ÷ ${y} = ${x / y}.`]; }
    return null;
  },
  'exponents': (s) => {
    let m;
    if ((m = s.prompt.match(/^(\d)([⁰¹²³⁴⁵⁶⁷⁸⁹]+) = \?/))) { const b = Number(m[1]); const n = unsup(m[2]); return [`${b}${m[2]} means ${Array(n).fill(b).join(' × ')}.`, `Multiply step by step: ${Array.from({ length: n }, (_, i) => b ** (i + 1)).join(' → ')}.`, `So ${b}${m[2]} = ${b ** n}.`]; }
    if ((m = s.prompt.match(/^x([⁰¹²³⁴⁵⁶⁷⁸⁹]+) · x([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/))) { const a = unsup(m[1]); const b = unsup(m[2]); return ['Same base multiplied: add the exponents.', `${a} + ${b} = ${a + b}.`]; }
    if ((m = s.prompt.match(/^\(x([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\)([⁰¹²³⁴⁵⁶⁷⁸⁹]+)/))) { const a = unsup(m[1]); const b = unsup(m[2]); return ['A power of a power: multiply the exponents.', `${a} × ${b} = ${a * b}.`]; }
    return null;
  },
  'probability': (s) => {
    const counts = [...s.prompt.matchAll(/(\d+) (red|blue|green)/g)].map((m) => [m[2], Number(m[1])]);
    const total = counts.reduce((t, [, n]) => t + n, 0);
    const red = counts.find(([c]) => c === 'red')[1];
    const want = /NOT red/.test(s.prompt) ? total - red : red;
    return [`Total marbles: ${counts.map(([, n]) => n).join(' + ')} = ${total}.`, /NOT red/.test(s.prompt) ? `Not red: ${total} − ${red} = ${want}.` : `Red marbles: ${red}.`, `Probability = ${want}/${total}.`];
  },
  'equations-two-step': solveLinear,
  'multi-step-equations': solveLinear,
  'pythagorean': (s) => {
    const v = s.visual;
    if (v.c === '?') { const [a, b] = [Number(v.a), Number(v.b)]; return [`Square the legs: ${a}² = ${a * a}, ${b}² = ${b * b}.`, `Add: ${a * a} + ${b * b} = ${a * a + b * b}.`, `Square root: √${a * a + b * b} = ${Math.sqrt(a * a + b * b)}.`]; }
    const [a, c] = [Number(v.a), Number(v.c)];
    return [`c² − a² gives the missing leg squared: ${c}² − ${a}² = ${c * c} − ${a * a} = ${c * c - a * a}.`, `Square root: √${c * c - a * a} = ${Math.sqrt(c * c - a * a)}.`];
  },
  'slope': (s) => {
    const [x1, y1, x2, y2] = nums(s.prompt);
    const rise = y2 - y1; const run = x2 - x1;
    const g = (p, q) => (q ? g(q, p % q) : Math.abs(p));
    const k = g(rise, run);
    const simp = run / k === 1 ? neg(rise / k) : `${rise < 0 ? "−" : ""}${Math.abs(rise) / k}/${run / k}`;
    return [`Rise = y₂ − y₁ = ${neg(y2)} − ${par(y1)} = ${neg(rise)}.`, `Run = x₂ − x₁ = ${neg(x2)} − ${par(x1)} = ${neg(run)}.`, `Slope = rise ÷ run = ${neg(rise)}/${neg(run)} = ${simp}.`];
  },
  'function-notation': (s) => {
    let m;
    if ((m = s.prompt.match(/^f\(x\) = (.+)\. Find f\((.+)\)\.$/))) { const k = num(m[2]); return [`Replace every x with (${neg(k)}): ${m[1].replace(/x/g, `(${neg(k)})`)}.`, 'Work out powers first, then multiplication, then addition and subtraction.', `Result: ${neg(evalExpr(m[1], k))}.`]; }
    if ((m = s.prompt.match(/^f\(x\) = (.+)\. For which value of x is f\(x\) = (.+)\?$/))) {
      const [, expr, out] = m; const [a, b] = nums(expr); const sign = /−/.test(expr) ? -1 : 1; const y = num(out);
      return [`Set ${expr} = ${out}.`, `${sign < 0 ? 'Add' : 'Subtract'} ${b}: ${a}x = ${neg(y - sign * b)}.`, `Divide by ${a}: x = ${neg((y - sign * b) / a)}.`];
    }
    return null;
  },
  'quadratics': (s) => {
    const m = s.prompt.match(/^Solve: (.+) = 0$/);
    if (!m) return null;
    const roots = nums(s.options.find((o) => o.id === s.answer).label);
    const [p, q] = roots;
    const f = (r) => (r > 0 ? `(x − ${r})` : `(x + ${-r})`);
    return [
      `Find two numbers that multiply to ${neg(p * q)} and add to ${neg(-(p + q))}: they are ${neg(-p)} and ${neg(-q)}.`,
      `So it factors as ${f(p)}${f(q)} = 0.`,
      `Set each factor to zero: x = ${neg(p)} or x = ${neg(q)}.`,
    ];
  },
  'trig-ratios': (s) => {
    const fn = s.prompt.match(/What is (sin|cos|tan) θ/)[1];
    const { a, b, c } = s.visual;
    const ratio = { sin: [`opposite ÷ hypotenuse`, `${a}/${c}`], cos: [`adjacent ÷ hypotenuse`, `${b}/${c}`], tan: [`opposite ÷ adjacent`, `${a}/${b}`] }[fn];
    return ['From θ: the opposite side is across from it, the adjacent side is next to it.', `${fn} θ = ${ratio[0]}.`, `${fn} θ = ${ratio[1]}.`];
  },
  'logarithms': (s) => {
    let m;
    const SUBS = { '₂': 2, '₃': 3, '₅': 5, '₁₀': 10 };
    if ((m = s.prompt.match(/^log([₀-₉]+) (\d+) = \?$/))) { const b = SUBS[m[1]]; const n = Number(m[2]); const k = Math.round(Math.log(n) / Math.log(b)); return [`Ask: ${b} to what power is ${n}?`, k === 0 ? `${b}⁰ = 1.` : `${Array(k).fill(b).join(' × ')} = ${n}.`, `So the answer is ${k}.`]; }
    if ((m = s.prompt.match(/^If log([₀-₉]+) x = (\d+)/))) { const b = SUBS[m[1]]; const k = Number(m[2]); return [`log means: ${b} to the power ${k} is x.`, `x = ${b ** k}.`]; }
    return null;
  },
  'derivatives': (s) => {
    let m;
    if ((m = s.prompt.match(/^f\(x\) = (\d+)x([⁰¹²³⁴⁵⁶⁷⁸⁹]+)\./))) { const a = Number(m[1]); const n = unsup(m[2]); return [`Power rule: bring the exponent down and multiply, then lower the exponent by 1.`, `${n} × ${a} = ${n * a}, so f′(x) = ${n * a}x${n - 1 === 1 ? '' : `^${n - 1}`}.`]; }
    if ((m = s.prompt.match(/^f\(x\) = (.+) \+ 5\./))) {
      const k = num(s.prompt.match(/(?:f′\((.+)\)|x = (.+)\?)/).slice(1).find(Boolean));
      const h = 1e-6; const d = Math.round((evalExpr(m[1], k + h) - evalExpr(m[1], k - h)) / (2 * h)) + 0;
      return ['Differentiate each term with the power rule; the constant 5 becomes 0.', `Substitute x = ${neg(k)} into f′(x).`, `f′(${neg(k)}) = ${neg(d)}.`];
    }
    return null;
  },
  'density': (s) => {
    const v = nums(s.prompt);
    if (/float or sink/.test(s.prompt)) return [`Density = ${v[0]} ÷ ${v[1]} = ${v[0] / v[1]} g/cm³.`, `Water is 1 g/cm³. ${v[0] / v[1] < 1 ? 'Less dense than water: it floats.' : 'Denser than water: it sinks.'}`];
    return [`Density = mass ÷ volume.`, `${v[0]} ÷ ${v[1]} = ${v[0] / v[1]} g/cm³.`];
  },
  'forces-motion': (s) => {
    const v = nums(s.prompt);
    if (/cart accelerates/.test(s.prompt)) return ['F = m × a.', `F = ${v[0]} × ${v[1]} = ${v[0] * v[1]} N.`];
    if (/acts on a/.test(s.prompt)) return ['a = F ÷ m.', `a = ${v[0]} ÷ ${v[1]} = ${v[0] / v[1]} m/s².`];
    return ['m = F ÷ a.', `m = ${v[0]} ÷ ${v[1]} = ${v[0] / v[1]} kg.`];
  },
  'conservation-of-mass': (s) => {
    const v = nums(s.prompt);
    if (/sealed container, \d+ g/.test(s.prompt)) return ['In a sealed container, mass before = mass after.', `${v[0]} + ${v[1]} = ${v[0] + v[1]} g.`];
    if (/products have a mass/.test(s.prompt)) return ['Mass before = mass after.', `${v[1]} − ${v[0]} = ${v[1] - v[0]} g.`];
    return null;
  },
  'simple-interest': (s) => {
    const v = nums(s.prompt);
    if (/compounded/.test(s.prompt)) { const [P, r] = v; const y1 = P * (1 + r / 100); return [`Year 1: ${P} × ${1 + r / 100} = ${y1}.`, `Year 2: ${y1} × ${1 + r / 100} = ${Math.round(y1 * (1 + r / 100))}.`]; }
    const [P, r, t] = v; const I = (P * r * t) / 100;
    return [`Interest = principal × rate × time = ${P} × ${r / 100} × ${t} = ${I}.`, ...(/repay in total/.test(s.prompt) ? [`Total = ${P} + ${I} = ${P + I}.`] : [])];
  },
};

function countDots(s) {
  const n = s.visual?.count;
  if (!n) return null;
  return ['Touch each dot once and say a number for it.', `${countList(1, n)}.`, `The last number is ${n}, so there are ${n} dots.`];
}

function timesWork(s) {
  if (s.visual?.kind === 'groups') {
    const { groups, each } = s.visual;
    return [`There are ${groups} groups of ${each}.`, `Count in ${each}s: ${Array.from({ length: groups }, (_, i) => each * (i + 1)).join(', ')}.`, `${groups} × ${each} = ${groups * each}.`];
  }
  const [a, b] = nums(s.prompt);
  if (!a || !b) return null;
  const [small, big] = a <= b ? [a, b] : [b, a];
  return [`${a} × ${b} means ${small} groups of ${big}.`, `Count in ${big}s: ${Array.from({ length: small }, (_, i) => big * (i + 1)).join(', ')}.`, `So ${a} × ${b} = ${a * b}.`];
}

function solveLinear(s) {
  const m = s.prompt.match(/^Solve for x: (.+) = (.+)$/);
  if (!m) return null;
  const x = num(s.answer);
  const [lhs, rhs] = [m[1], m[2]];
  const simple = lhs.match(/^(\d*)x ([+−]) (\d+)$/);
  if (simple && /^−?\d+$/.test(rhs)) {
    const p = Number(simple[1] || 1); const q = Number(simple[3]) * (simple[2] === '−' ? -1 : 1); const r = num(rhs);
    return [
      `${q < 0 ? `Add ${-q}` : `Subtract ${q}`} on both sides: ${p === 1 ? '' : p}x = ${neg(r - q)}.`,
      p === 1 ? `So x = ${neg(x)}.` : `Divide both sides by ${p}: x = ${neg(r - q)} ÷ ${p} = ${neg(x)}.`,
      `Check: ${lhs.replace('x', `(${neg(x)})`)} = ${neg(r)}. ✓`,
    ];
  }
  if (/^\d*x$/.test(lhs)) { const p = Number(lhs.slice(0, -1) || 1); return [`Divide both sides by ${p}: x = ${rhs} ÷ ${p} = ${neg(x)}.`]; }
  if (/^x \+ \d+$/.test(lhs)) { const q = nums(lhs)[0]; return [`Subtract ${q} from both sides: x = ${rhs} − ${q} = ${neg(x)}.`]; }
  // Both sides are linear: a·x + b, the left possibly written as p(x ± q).
  const lines = [];
  let left = lhs;
  const dist = lhs.match(/^(\d+)\(x ([+−]) (\d+)\)$/);
  if (dist) {
    const p = Number(dist[1]); const q = Number(dist[3]) * (dist[2] === '−' ? -1 : 1);
    left = `${p}x ${p * q < 0 ? '−' : '+'} ${Math.abs(p * q)}`;
    lines.push(`Distribute: ${lhs} = ${left}.`);
  }
  const lin = (e) => { const b = evalExpr(e, 0); return [evalExpr(e, 1) - b, b]; };
  const [a, b] = lin(left); const [c, d] = lin(rhs);
  const term = (k, v) => (k === 0 ? '' : `${k < 0 ? '− ' : '+ '}${Math.abs(k)}${v}`);
  const ax = a - c; const rest = d - b;
  const sol = rest / ax;
  const xs = (k) => (k === 1 ? 'x' : k === -1 ? '−x' : `${neg(k)}x`);
  if (c !== 0) lines.push(`${c > 0 ? `Subtract ${xs(c)}` : `Add ${xs(-c)}`} on both sides: ${xs(ax)} ${term(b, '')} = ${neg(d)}.`.replace(/ {2,}/g, ' ').replace(/ \+? ?=/, ' ='));
  if (b !== 0) lines.push(`${b < 0 ? `Add ${-b}` : `Subtract ${b}`} on both sides: ${xs(ax)} = ${neg(rest)}.`);
  if (ax !== 1) lines.push(`Divide both sides by ${neg(ax)}: x = ${neg(rest)} ÷ ${par(ax)} = ${neg(sol)}.`);
  lines.push(`Check with x = ${neg(sol)}: left side ${neg(evalExpr(left, sol))}, right side ${neg(evalExpr(rhs, sol))}. Equal ✓`);
  void x;
  return lines;
}

// Evaluates a polynomial in x as written in our questions, such as "2x³ − 5x² + 4x"
// or "x² − 2x". No eval: the site's content security policy forbids it.
const POW = { '²': 2, '³': 3 };
function evalExpr(expr, x) {
  const terms = expr.replace(/−/g, '-').replace(/\s+/g, '').match(/[+-]?[^+-]+/g) || [];
  return terms.reduce((sum, t) => {
    const m = t.match(/^([+-]?)(\d*)(x?)([²³]?)$/);
    if (!m) throw new Error(`cannot read term ${t}`);
    const sign = m[1] === '-' ? -1 : 1;
    const coef = m[2] === '' ? 1 : Number(m[2]);
    const value = m[3] ? x ** (POW[m[4]] || 1) : 1;
    return sum + sign * coef * value;
  }, 0);
}

export function workFor(objective, step, answerText) {
  let lines = null;
  try { lines = SOLVERS[objective]?.(step) || null; } catch { lines = null; }
  if (!lines) return [...step.hints, `So the answer is ${answerText}.`];
  return lines;
}

export const SOLVED = Object.keys(SOLVERS);
