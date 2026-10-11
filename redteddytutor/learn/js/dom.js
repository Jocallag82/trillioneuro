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
    const fill = { fill: 'var(--red)' };
    if (v.shape === 'circle') s.append(svg('circle', { cx: 60, cy: 60, r: 50, ...fill }));
    if (v.shape === 'square') s.append(svg('rect', { x: 14, y: 14, width: 92, height: 92, ...fill }));
    if (v.shape === 'rectangle') s.append(svg('rect', { x: 8, y: 33, width: 104, height: 54, ...fill }));
    if (v.shape === 'triangle') s.append(svg('polygon', { points: '60,10 112,108 8,108', ...fill }));
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
