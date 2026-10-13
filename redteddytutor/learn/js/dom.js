// Small DOM helpers. Text is always set with textContent, never innerHTML.
const SVG_NS = 'http://www.w3.org/2000/svg';

export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'dataset') Object.assign(node.dataset, value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of [].concat(children)) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

function svg(tag, attrs) {
  const node = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
}

const SHAPE_NAMES = { circle: 'circle', square: 'square', triangle: 'triangle', rectangle: 'rectangle' };

// A ten frame. Used to show an amount, and (with buttons) to build one.
export function tenFrame(filled, capacity = 10, label = '') {
  const box = el('div', { class: 'visual-tenframe', role: 'img', 'aria-label': label || `${filled} of ${capacity}` });
  for (let i = 0; i < capacity; i++) box.append(el('span', { class: i < filled ? 'cell on' : 'cell', 'aria-hidden': 'true' }));
  return box;
}

// Renders an activity visual. Every visual has a text equivalent in aria-label.
export function visualNode(v) {
  if (!v) return null;
  if (v.kind === 'dots') {
    const cols = Math.min(v.count, 5);
    const rows = Math.ceil(v.count / cols);
    const gap = 44;
    const width = cols * gap;
    const height = rows * gap;
    const s = svg('svg', {
      viewBox: `0 0 ${width} ${height}`, class: 'visual-dots', role: 'img',
      'aria-label': `${v.count} ${v.count === 1 ? 'dot' : 'dots'}`,
    });
    for (let i = 0; i < v.count; i++) {
      const cx = (i % cols) * gap + gap / 2;
      const cy = Math.floor(i / cols) * gap + gap / 2;
      s.append(svg('circle', { cx, cy, r: 15, fill: 'var(--red)' }));
    }
    return s;
  }
  if (v.kind === 'shape') {
    const label = SHAPE_NAMES[v.shape];
    const s = svg('svg', { viewBox: '0 0 120 120', class: 'visual-shape', role: 'img', 'aria-label': label });
    // Outline shapes are the "holes" in shape-fitting activities.
    const fill = v.outline
      ? { fill: 'none', stroke: 'var(--red)', 'stroke-width': 6, 'stroke-dasharray': '10 6' }
      : { fill: 'var(--red)' };
    if (v.shape === 'circle') s.append(svg('circle', { cx: 60, cy: 60, r: 50, ...fill }));
    if (v.shape === 'square') s.append(svg('rect', { x: 14, y: 14, width: 92, height: 92, ...fill }));
    if (v.shape === 'rectangle') s.append(svg('rect', { x: 8, y: 33, width: 104, height: 54, ...fill }));
    if (v.shape === 'triangle') s.append(svg('polygon', { points: '60,10 112,108 8,108', ...fill }));
    if (v.rotate) [...s.children].forEach((c) => c.setAttribute('transform', `rotate(${v.rotate} 60 60)`));
    return s;
  }
  if (v.kind === 'tenframe') return tenFrame(v.filled, 10, `${v.filled} counters in a frame of 10`);
  if (v.kind === 'blocks') {
    const s = svg('svg', { viewBox: `0 0 ${v.tens * 22 + (v.ones ? 30 + Math.ceil(v.ones / 5) * 22 : 0)} 120`, class: 'visual-blocks', role: 'img',
      'aria-label': `${v.tens} tens and ${v.ones} ones` });
    for (let t = 0; t < v.tens; t++) {
      s.append(svg('rect', { x: t * 22 + 2, y: 2, width: 16, height: 116, rx: 2, fill: 'var(--blue)' }));
      for (let k = 1; k < 10; k++) s.append(svg('line', { x1: t * 22 + 2, x2: t * 22 + 18, y1: 2 + k * 11.6, y2: 2 + k * 11.6, stroke: 'var(--paper)', 'stroke-width': 1 }));
    }
    for (let o = 0; o < v.ones; o++) {
      s.append(svg('rect', { x: v.tens * 22 + 30 + Math.floor(o / 5) * 22, y: 120 - (o % 5 + 1) * 22, width: 16, height: 16, rx: 2, fill: 'var(--red-l)' }));
    }
    return s;
  }
  if (v.kind === 'groups') {
    const box = el('div', { class: 'visual-groups', role: 'img', 'aria-label': `${v.groups} groups of ${v.each}` });
    for (let g = 0; g < v.groups; g++) box.append(el('span', { class: 'group', 'aria-hidden': 'true' }, Array.from({ length: v.each }, () => el('i'))));
    return box;
  }
  if (v.kind === 'fraction') {
    const w = 240;
    const s = svg('svg', { viewBox: `0 0 ${w} 60`, class: 'visual-fraction', role: 'img',
      'aria-label': `A bar cut into ${v.parts} ${v.unequal ? 'unequal' : 'equal'} parts, ${v.shaded} shaded` });
    // Unequal bars still have `parts` pieces, but the first is wider than the rest.
    const widths = v.unequal
      ? [w * 0.5, ...Array.from({ length: v.parts - 1 }, () => (w * 0.5) / (v.parts - 1))]
      : Array.from({ length: v.parts }, () => w / v.parts);
    let x = 0;
    widths.forEach((pw, i) => {
      s.append(svg('rect', { x: x + 1, y: 1, width: pw - 2, height: 58, fill: i < v.shaded ? 'var(--red-l)' : 'var(--paper)', stroke: 'var(--ink)', 'stroke-width': 2 }));
      x += pw;
    });
    return s;
  }
  if (v.kind === 'ruler') {
    const unit = 26;
    const s = svg('svg', { viewBox: `0 0 ${20 * unit + 20} 110`, class: 'visual-ruler', role: 'img',
      'aria-label': `A pencil from ${v.start} to ${v.start + v.length} on a centimetre ruler` });
    s.append(svg('rect', { x: 10 + v.start * unit, y: 8, width: v.length * unit, height: 26, rx: 4, fill: 'var(--gold)' }));
    s.append(svg('polygon', { points: `${10 + (v.start + v.length) * unit},8 ${10 + (v.start + v.length) * unit + 16},21 ${10 + (v.start + v.length) * unit},34`, fill: 'var(--ink)' }));
    s.append(svg('rect', { x: 2, y: 46, width: 20 * unit + 16, height: 60, rx: 6, fill: 'var(--ivory2)', stroke: 'var(--line-strong)' }));
    for (let i = 0; i <= 20; i++) {
      const x = 10 + i * unit;
      s.append(svg('line', { x1: x, x2: x, y1: 46, y2: 66, stroke: 'var(--ink)', 'stroke-width': 2 }));
      const label = svg('text', { x, y: 92, 'text-anchor': 'middle', 'font-size': 15, fill: 'var(--ink)' });
      label.textContent = String(i);
      s.append(label);
    }
    return s;
  }
  if (v.kind === 'swatch') {
    return el('span', { class: 'visual-swatch', role: 'img', 'aria-label': v.label, style: `background:${v.hex}` });
  }
  if (v.kind === 'text') {
    return el('span', { class: 'visual-text', text: v.text });
  }
  if (v.kind === 'sequence') {
    return el('div', { class: 'visual-sequence', role: 'group', 'aria-label': 'Pattern' },
      v.items.map((item) => (item === null
        ? el('span', { class: 'tile tile-blank', role: 'img', 'aria-label': 'missing item' }, '?')
        : el('span', { class: 'tile' }, visualNode(item)))));
  }
  return null;
}
