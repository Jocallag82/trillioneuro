// Original illustrations for abstract ideas (shapes, numbers, positions, feelings,
// measurement), where a photograph would confuse. Same ink-outline style as
// /early/art.js. Each returns an SVG string with role="img" and a label.
const INK = '#3a2a24';
const O = `stroke="${INK}" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"`;
export const COLORS = { red: '#d23b3b', blue: '#3b78c4', gold: '#f2b632', green: '#4f9a4a', yellow: '#f6cf3c', orange: '#ee8a2b', purple: '#8a4fb5', white: '#ffffff' };
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const wrap = (body, label, vb = '0 0 200 200') => `<svg viewBox="${vb}" role="img" aria-label="${esc(label)}" xmlns="http://www.w3.org/2000/svg" focusable="false">${body}</svg>`;

const SHAPES = {
  circle: () => '<circle cx="100" cy="100" r="70"/>',
  square: () => '<rect x="34" y="34" width="132" height="132" rx="6"/>',
  rectangle: () => '<rect x="18" y="56" width="164" height="88" rx="6"/>',
  triangle: () => '<path d="M100 26L176 166H24z"/>',
  star: () => '<path d="M100 20l22 52 56 4-43 36 14 56-49-30-49 30 14-56-43-36 56-4z"/>',
  heart: () => '<path d="M100 172C30 120 18 86 30 60c14-30 54-32 70-4 16-28 56-26 70 4 12 26 0 60-70 112z"/>',
  hexagon: () => '<path d="M60 30h80l40 70-40 70H60L20 100z"/>',
};
export function shape(name, color = 'red') {
  return wrap(`<g fill="${COLORS[color] || color}" ${O}>${SHAPES[name]()}</g>`, `${color} ${name}`);
}

// Up to 12 dots in a tidy layout; 1-6 follow dice patterns for subitizing.
const DICE = { 1: [[1, 1]], 2: [[0, 0], [2, 2]], 3: [[0, 0], [1, 1], [2, 2]], 4: [[0, 0], [2, 0], [0, 2], [2, 2]], 5: [[0, 0], [2, 0], [1, 1], [0, 2], [2, 2]], 6: [[0, 0], [2, 0], [0, 1], [2, 1], [0, 2], [2, 2]] };
export function dots(n, { dice = false } = {}) {
  if (dice && DICE[n]) {
    const d = DICE[n].map(([x, y]) => `<circle cx="${45 + x * 55}" cy="${45 + y * 55}" r="20" fill="${INK}"/>`).join('');
    return wrap(`<rect x="10" y="10" width="180" height="180" rx="30" fill="#fff" ${O}/>${d}`, `${n} dots`);
  }
  const cols = n <= 4 ? n : Math.ceil(n / 2);
  const rows = Math.ceil(n / cols);
  const step = 180 / Math.max(cols, rows * 1.0);
  const r = Math.min(22, step * 0.36);
  let s = '';
  for (let i = 0; i < n; i++) {
    const cx = 100 + ((i % cols) - (cols - 1) / 2) * step;
    const cy = 100 + (Math.floor(i / cols) - (rows - 1) / 2) * step;
    s += `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${COLORS.red}" ${O}/>`;
  }
  return wrap(s, `${n} dots`);
}

// Ten frame (or five frame) with `have` counters.
export function frame(total, have) {
  const cols = 5; const rows = total / 5; const w = 36;
  let s = '';
  for (let i = 0; i < total; i++) {
    const x = 10 + (i % cols) * w; const y = 10 + Math.floor(i / cols) * w;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${w}" fill="#fff" stroke="${INK}" stroke-width="3"/>`;
    if (i < have) s += `<circle cx="${x + w / 2}" cy="${y + w / 2}" r="12" fill="${COLORS.red}" stroke="${INK}" stroke-width="3"/>`;
  }
  return wrap(s, `${have} of ${total} spaces filled, ${total - have} empty`, `0 0 200 ${20 + rows * w}`);
}

const FACES = {
  happy: '<path d="M70 120c16 22 44 22 60 0" fill="none"/>',
  sad: '<path d="M70 138c16-20 44-20 60 0" fill="none"/><path d="M76 96l-4 14" fill="none" stroke="#3b78c4"/>',
  angry: '<path d="M64 74l26 12M136 74l-26 12M72 134h56" fill="none"/>',
  surprised: '<ellipse cx="100" cy="130" rx="14" ry="18" fill="#3a2a24"/>',
  sleepy: '<path d="M70 92q10 8 20 0M110 92q10 8 20 0M84 130h32" fill="none"/><text x="140" y="60" font-size="28" font-family="sans-serif" fill="#3a2a24" stroke="none">z</text>',
  worried: '<path d="M64 80l24-8M136 80l-24-8M72 134c10-8 20 4 28-2s18 6 28-2" fill="none"/>',
};
export function feeling(name) {
  const eyes = ['sleepy'].includes(name) ? '' : '<circle cx="80" cy="96" r="7" fill="#3a2a24"/><circle cx="120" cy="96" r="7" fill="#3a2a24"/>';
  return wrap(`<circle cx="100" cy="104" r="78" fill="#f6cf3c" ${O}/>${eyes}<g ${O}>${FACES[name]}</g>`, `${name} face`);
}

// A ball (or other object) placed relative to a box, for position words.
export function place({ where, obj = 'ball' }) {
  const box = (x) => `<rect x="${x}" y="100" width="70" height="60" fill="#d9a441" ${O}/>`;
  const ball = (x, y) => `<circle cx="${x}" cy="${y}" r="20" fill="${COLORS.red}" ${O}/>`;
  const ground = `<path d="M10 182h180" stroke="${INK}" stroke-width="4"/>`;
  const S = {
    above: box(65) + ball(100, 40),
    below: `<rect x="60" y="40" width="80" height="16" fill="#d9a441" ${O}/><path d="M68 56v120M132 56v120" ${O}/>` + ball(100, 158),
    beside: box(40) + ball(150, 140),
    in: `<path d="M60 100v60h80v-60" fill="#d9a441" ${O}/>` + ball(100, 140).replace('r="20"', 'r="18"') + `<path d="M60 112h80" stroke="#d9a441" stroke-width="16"/><path d="M60 100v60h80v-60" fill="none" ${O}/>`,
    on: box(65) + ball(100, 78),
    between: box(10) + `<rect x="120" y="100" width="70" height="60" fill="#d9a441" ${O}/>` + ball(100, 140),
  };
  const label = where === 'below' ? `${obj} under the table` : where === 'between' ? `${obj} between two boxes` : `${obj} ${where} the box`;
  return wrap(ground + S[where], label);
}

export function art(a) {
  if (a.type === 'updown') return wrap(`<path d="M10 180h180" stroke="${INK}" stroke-width="4"/><g transform="translate(${a.up ? 100 : 100},${a.up ? 40 : 158})"><ellipse rx="26" ry="16" fill="#3b78c4" ${O}/><path d="M-6 -4l-18-22 26 12z" fill="#3b78c4" ${O}/><circle cx="16" cy="-6" r="3" fill="${INK}"/><path d="M26 0l12 4-12 4z" fill="#ee8a2b" ${O}/></g>${a.up ? '<circle cx="160" cy="36" r="16" fill="#f6cf3c" stroke="#3a2a24" stroke-width="4"/>' : ''}`, a.up ? 'bird up high in the sky' : 'bird down low on the ground');
  if (a.type === 'glass') return wrap(`<path d="M60 30h80l-10 150H70z" fill="#fff" ${O}/>${a.full ? `<path d="M64 46h72l-8 130H72z" fill="#7fb6e6"/>` : ''}<path d="M60 30h80l-10 150H70z" fill="none" ${O}/>`, a.full ? 'full glass' : 'empty glass');
  if (a.type === 'box') return wrap(a.open
    ? `<rect x="40" y="90" width="120" height="80" fill="#d9a441" ${O}/><path d="M40 90l-20-40 100 0 40 40" fill="#e9bf6b" ${O}/><circle cx="100" cy="110" r="16" fill="${COLORS.red}" ${O}/>`
    : `<rect x="40" y="90" width="120" height="80" fill="#d9a441" ${O}/><rect x="32" y="74" width="136" height="20" fill="#e9bf6b" ${O}/>`, a.open ? 'open box' : 'closed box');
  if (a.type === 'bar') return wrap(`<rect x="10" y="80" width="${a.len * 20}" height="40" rx="20" fill="${COLORS[a.color]}" ${O}/><circle cx="${a.len * 20 - 6}" cy="94" r="4" fill="${INK}"/>`, `${a.len > 5 ? 'long' : 'short'} ${a.color} shape`);
  if (a.type === 'tower') return wrap(Array.from({ length: a.h }, (_, i) => `<rect x="70" y="${170 - (i + 1) * 26}" width="60" height="26" fill="${[COLORS.red, COLORS.blue, COLORS.gold, COLORS.green][i % 4]}" ${O}/>`).join('') + `<path d="M20 172h160" stroke="${INK}" stroke-width="4"/>`, `tower of ${a.h} blocks`);
  return '';
}
