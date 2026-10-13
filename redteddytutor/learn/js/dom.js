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
  if (v.kind === 'clock') {
    // The label must not read out the time: that is the question.
    const s = svg('svg', { viewBox: '0 0 220 220', class: 'visual-clock', role: 'img', 'aria-label': 'An analogue clock face with an hour hand and a minute hand' });
    s.append(svg('circle', { cx: 110, cy: 110, r: 102, fill: 'var(--paper)', stroke: 'var(--ink)', 'stroke-width': 6 }));
    for (let i = 0; i < 60; i++) {
      const a = (i * 6 * Math.PI) / 180;
      const r1 = i % 5 === 0 ? 84 : 90;
      s.append(svg('line', { x1: 110 + r1 * Math.sin(a), y1: 110 - r1 * Math.cos(a), x2: 110 + 96 * Math.sin(a), y2: 110 - 96 * Math.cos(a), stroke: 'var(--ink)', 'stroke-width': i % 5 === 0 ? 3 : 1.2 }));
    }
    for (let n = 1; n <= 12; n++) {
      const a = (n * 30 * Math.PI) / 180;
      const t = svg('text', { x: 110 + 68 * Math.sin(a), y: 110 - 68 * Math.cos(a) + 7, 'text-anchor': 'middle', 'font-size': 20, 'font-weight': 700, fill: 'var(--ink)' });
      t.textContent = String(n);
      s.append(t);
    }
    const hand = (deg, len, width, colour) => {
      const a = (deg * Math.PI) / 180;
      s.append(svg('line', { x1: 110, y1: 110, x2: 110 + len * Math.sin(a), y2: 110 - len * Math.cos(a), stroke: colour, 'stroke-width': width, 'stroke-linecap': 'round' }));
    };
    hand(((v.h % 12) + v.m / 60) * 30, 46, 9, 'var(--ink)');
    hand(v.m * 6, 78, 5, 'var(--red)');
    s.append(svg('circle', { cx: 110, cy: 110, r: 7, fill: 'var(--ink)' }));
    return s;
  }
  if (v.kind === 'bars') {
    const W = 360; const H = 250; const left = 40; const bottom = 38; const top = 34;
    const plotH = H - bottom - top;
    const slot = (W - left - 10) / v.items.length;
    const y = (val) => top + plotH - (val / v.max) * plotH;
    const s = svg('svg', { viewBox: `0 0 ${W} ${H}`, class: 'visual-bars', role: 'img', 'aria-label': `Bar chart: ${v.title}. The scale goes up in ${v.step}s.` });
    const title = svg('text', { x: W / 2, y: 20, 'text-anchor': 'middle', 'font-size': 17, 'font-weight': 700, fill: 'var(--ink)' });
    title.textContent = v.title;
    s.append(title);
    for (let g = 0; g <= v.max; g += v.step) {
      s.append(svg('line', { x1: left, x2: W - 8, y1: y(g), y2: y(g), stroke: 'var(--ink)', 'stroke-opacity': g === 0 ? 0.9 : 0.18, 'stroke-width': g === 0 ? 2 : 1 }));
      const t = svg('text', { x: left - 7, y: y(g) + 5, 'text-anchor': 'end', 'font-size': 14, fill: 'var(--ink)' });
      t.textContent = String(g);
      s.append(t);
    }
    v.items.forEach((b, i) => {
      const x = left + i * slot + slot * 0.18;
      s.append(svg('rect', { x, y: y(b.value), width: slot * 0.64, height: y(0) - y(b.value), rx: 3, fill: i % 2 ? 'var(--blue)' : 'var(--red)' }));
      const t = svg('text', { x: x + slot * 0.32, y: H - 14, 'text-anchor': 'middle', 'font-size': b.label.length > 7 ? 12 : 14, fill: 'var(--ink)' });
      t.textContent = b.label;
      s.append(t);
    });
    return s;
  }
  if (v.kind === 'grid') {
    const c = 30; const pad = v.labels ? 40 : 6;
    const unit = v.labels ? 'centimetres' : 'squares';
    const s = svg('svg', { viewBox: `0 0 ${v.w * c + pad * 2} ${v.h * c + pad * 2}`, class: 'visual-grid', role: 'img',
      'aria-label': `A rectangle ${v.w} ${unit} long and ${v.h} ${unit} wide` });
    s.append(svg('rect', { x: pad, y: pad, width: v.w * c, height: v.h * c, fill: 'var(--red-soft)', stroke: 'var(--red)', 'stroke-width': 3 }));
    if (!v.labels) {
      for (let i = 1; i < v.w; i++) s.append(svg('line', { x1: pad + i * c, x2: pad + i * c, y1: pad, y2: pad + v.h * c, stroke: 'var(--red)', 'stroke-opacity': 0.55 }));
      for (let j = 1; j < v.h; j++) s.append(svg('line', { x1: pad, x2: pad + v.w * c, y1: pad + j * c, y2: pad + j * c, stroke: 'var(--red)', 'stroke-opacity': 0.55 }));
    } else {
      const lw = svg('text', { x: pad + (v.w * c) / 2, y: pad - 12, 'text-anchor': 'middle', 'font-size': 16, 'font-weight': 700, fill: 'var(--ink)' });
      lw.textContent = `${v.w} cm`;
      const lh = svg('text', { x: pad + v.w * c + 6, y: pad + (v.h * c) / 2 + 5, 'font-size': 16, 'font-weight': 700, fill: 'var(--ink)' });
      lh.textContent = `${v.h} cm`;
      s.append(lw, lh);
    }
    return s;
  }
  if (v.kind === 'passage') {
    return el('article', { class: 'visual-passage' }, [
      el('h3', { text: v.title }),
      ...v.text.split('\n').map((para) => el('p', { text: para })),
    ]);
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
