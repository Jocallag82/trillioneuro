// Pure SVG badge renderer (no I/O) — unit-tested. Only real published figures are ever drawn.
export const BADGE_STYLES = { light: 'Light', dark: 'Dark', compact: 'Compact' } as const;
export type BadgeStyle = keyof typeof BADGE_STYLES;
export const BADGE_SIZE: Record<BadgeStyle, [number, number]> = { light: [220, 64], dark: [220, 64], compact: [150, 28] };

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

export function badgeLabel(count: number, avg: number | null) {
  return count > 0 && avg != null
    ? `Rated ${avg.toFixed(1)} out of 5 from ${count} ${count === 1 ? 'review' : 'reviews'} on RateMe.ie`
    : 'Review us on RateMe.ie';
}

export function renderBadge(style: BadgeStyle, count: number, avg: number | null): string {
  const [w, h] = BADGE_SIZE[style];
  const rated = count > 0 && avg != null;
  const dark = style === 'dark';
  const bg = dark ? '#16211b' : '#ffffff', fg = dark ? '#ffffff' : '#16211b', sub = dark ? '#c9d3cc' : '#5b655f', border = dark ? '#16211b' : '#e1dcd1';
  const label = esc(badgeLabel(count, avg));
  if (style === 'compact') {
    const text = rated ? `★ ${avg!.toFixed(1)} · ${count} on RateMe.ie` : 'Review us on RateMe.ie';
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}"><title>${label}</title>`
      + `<rect width="${w}" height="${h}" rx="14" fill="#1d4a35"/><text x="${w / 2}" y="18.5" text-anchor="middle" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="12" font-weight="700" fill="#fff">${esc(text)}</text></svg>`;
  }
  const stars = rated ? Array.from({ length: 5 }, (_, i) => {
    const fill = Math.max(0, Math.min(1, avg! - i));
    return `<g transform="translate(${64 + i * 17},14)"><defs><linearGradient id="s${i}"><stop offset="${fill}" stop-color="#e9a514"/><stop offset="${fill}" stop-color="${dark ? '#3a4a40' : '#e1dcd1'}"/></linearGradient></defs>`
      + `<path d="M7 0l2.1 4.6 5 .5-3.8 3.4 1.1 4.9L7 10.9 2.6 13.4l1.1-4.9L0 5.1l5-.5z" fill="url(#s${i})"/></g>`;
  }).join('') : '';
  const line1 = rated ? `<text x="155" y="26" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="15" font-weight="800" fill="${fg}">${avg!.toFixed(1)}</text>` : `<text x="64" y="27" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="14" font-weight="800" fill="${fg}">Review us</text>`;
  const line2 = rated ? `${count} ${count === 1 ? 'review' : 'reviews'} on RateMe.ie` : 'on RateMe.ie';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${label}"><title>${label}</title>`
    + `<rect x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="12" fill="${bg}" stroke="${border}"/>`
    + `<rect x="12" y="12" width="40" height="40" rx="10" fill="#1d4a35"/><path d="M23 33l6 6 12-14" fill="none" stroke="#e9a514" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>`
    + stars + line1
    + `<text x="64" y="48" font-family="system-ui,-apple-system,Segoe UI,sans-serif" font-size="12" fill="${sub}">${esc(line2)}</text></svg>`;
}
