/* Generates the world-map assets used by the movement site. Build-time only — the site ships plain JSON.
   Inputs are public-domain Natural Earth data (via the `world-atlas` npm package) and `world-countries` for
   ISO numeric → alpha-2 codes. They are NOT repo dependencies: install them anywhere and pass the folder:

     mkdir /tmp/geo && cd /tmp/geo && npm i world-atlas@2.0.2 topojson-client@3.1.0 world-countries@5.1.0
     node scripts/mv/build-geo.mjs /tmp/geo/node_modules

   Writes assets/mv/world.json  { w, h, paths: { CC: "svg path d" }, pts: { CC: [x, y] } }
      and assets/mv/land.json   { lw, lh, land: "<base64 bitmap>" }  (small: needed by the hero globe)
   • paths  — Natural Earth projection, simplified, one entry per country that has a polygon at 50m scale
   • pts    — projected point for EVERY country in lib/countries.json (tiny states have no polygon, so the map
              draws them as selectable dots)
   • land   — 1.5° land/ocean bitmap for the dotted globe (row-major, 1 = land)                              */
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join } from 'node:path';

const nm = process.argv[2];
if (!nm) { console.error('usage: node build-geo.mjs <node_modules dir>'); process.exit(1); }
const require = createRequire(join(nm, 'x.js'));
const { feature } = require('topojson-client');
const countriesMeta = require('world-countries');
const topo = JSON.parse(readFileSync(join(nm, 'world-atlas/countries-50m.json'), 'utf8'));
const land110 = JSON.parse(readFileSync(join(nm, 'world-atlas/land-110m.json'), 'utf8'));
const ours = JSON.parse(readFileSync(new URL('../../lib/countries.json', import.meta.url), 'utf8'));

const W = 1000, LAT_MIN = -58;
const rad = Math.PI / 180;
function ne(lng, lat) {                                   // Natural Earth (Šavrič et al.)
  const l = lng * rad, p = lat * rad, p2 = p * p, p4 = p2 * p2;
  return [l * (0.8707 - 0.131979 * p2 + p4 * (-0.013791 + p4 * (0.003971 * p2 - 0.001529 * p4))),
          p * (1.007226 + p2 * (0.015085 + p4 * (-0.044475 + 0.028874 * p2 - 0.005916 * p4)))];
}
const xMax = ne(180, 0)[0], yTop = ne(0, 84)[1], yBot = ne(0, LAT_MIN)[1];
const H = Math.round(W * (yTop - yBot) / (2 * xMax));
const proj = (lng, lat) => { const [x, y] = ne(lng, lat);
  return [(x + xMax) / (2 * xMax) * W, (yTop - y) / (yTop - yBot) * H]; };

const num2a2 = Object.fromEntries(countriesMeta.map((c) => [c.ccn3, c.cca2]));
const fc = feature(topo, topo.objects.countries);

const EPS = 1.0;                                          // px in a 1000-wide viewBox
const area = (r) => { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] + r[i][0]) * (r[j][1] - r[i][1]); return Math.abs(a / 2); };
// Rings that cross the antimeridian (Russia, Fiji, …) are unwrapped to continuous longitudes and then clipped at ±180°,
// so no stroke ever runs across the whole map.
function clipLng(ring, edge, keepBelow) {            // Sutherland–Hodgman against the half-plane lng <= edge (or >= edge)
  const inside = (p) => (keepBelow ? p[0] <= edge : p[0] >= edge), out = [];
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i], b = ring[(i + 1) % ring.length], ia = inside(a), ib = inside(b);
    if (ia) out.push(a);
    if (ia !== ib) { const t = (edge - a[0]) / (b[0] - a[0]); out.push([edge, a[1] + (b[1] - a[1]) * t]); }
  }
  return out;
}
function splitRing(ring) {
  let cross = false;
  for (let i = 1; i < ring.length; i++) if (Math.abs(ring[i][0] - ring[i - 1][0]) > 180) { cross = true; break; }
  if (!cross) return [ring];
  const un = [ring[0].slice()];
  for (let i = 1; i < ring.length; i++) { const p = ring[i].slice(), q = un[i - 1]; while (p[0] - q[0] > 180) p[0] -= 360; while (p[0] - q[0] < -180) p[0] += 360; un.push(p); }
  const west = clipLng(un, 180, true), east = clipLng(un, 180, false).map((p) => [p[0] - 360, p[1]]);
  const west2 = clipLng(un, -180, false), east2 = clipLng(un, -180, true).map((p) => [p[0] + 360, p[1]]);
  const parts = [west, east, west2, east2].filter((r) => r.length >= 3);
  // keep only parts inside [-180, 180]
  return parts.map((r) => r.map((p) => [Math.max(-180, Math.min(180, p[0])), p[1]])).filter((r) => r.some((p) => p[0] > -179.9 || p[0] < 179.9));
}
function ringPath(ring) {
  const pts = []; let last = null;
  for (const [lng, lat] of ring) {
    if (lat < LAT_MIN - 1) continue;
    const p = proj(lng, Math.max(lat, LAT_MIN));
    if (!last || Math.hypot(p[0] - last[0], p[1] - last[1]) >= EPS) { pts.push(p); last = p; }
  }
  return pts;
}
const paths = {}; let bytes = 0;
for (const f of fc.features) {
  const code = num2a2[String(f.id).padStart(3, '0')];
  if (!code || !ours.find((c) => c.code === code)) continue;
  const polys = f.geometry.type === 'Polygon' ? [f.geometry.coordinates] : f.geometry.coordinates;
  let rings = [];
  for (const poly of polys) for (const ring of poly.slice(0, 1)) for (const part of splitRing(ring)) { const r = ringPath(part); if (r.length >= 3) rings.push(r); }
  if (!rings.length) continue;
  const big = Math.max(...rings.map(area));
  rings = rings.filter((r) => area(r) >= 0.35 || area(r) === big);
  const d = rings.map((r) => 'M' + r.map((p) => p[0].toFixed(1) + ' ' + p[1].toFixed(1)).join(' ') + 'Z').join('');
  paths[code] = (paths[code] || '') + d; bytes += d.length;
}
// Territories folded into a parent in the dataset (e.g. Kosovo has no ISO numeric) are simply points.

const pts = {};
for (const c of ours) {
  if (c.lat == null || c.lng == null) continue;
  const p = proj(c.lng, Math.max(c.lat, LAT_MIN));
  pts[c.code] = [Math.round(p[0] * 10) / 10, Math.round(p[1] * 10) / 10];
}

// ── land bitmap (point-in-polygon on the 110m land mass) ─────────────────────
const land = feature(land110, land110.objects.land);
const polys = [];
for (const g of (land.features ? land.features.map((f) => f.geometry) : [land.geometry])) {
  for (const p of g.type === 'Polygon' ? [g.coordinates] : g.coordinates) {
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const [x, y] of p[0]) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    polys.push({ p, x0, x1, y0, y1 });
  }
}
const inRing = (x, y, r) => { let c = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
  if ((r[i][1] > y) !== (r[j][1] > y) && x < (r[j][0] - r[i][0]) * (y - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c = !c; } return c; };
const STEP = 1.5, LW = 360 / STEP, LH = 180 / STEP;
const bits = new Uint8Array(LW * LH);
for (let r = 0; r < LH; r++) for (let c = 0; c < LW; c++) {
  const lng = -180 + (c + 0.5) * STEP, lat = 90 - (r + 0.5) * STEP;
  for (const pl of polys) {
    if (lng < pl.x0 || lng > pl.x1 || lat < pl.y0 || lat > pl.y1) continue;
    if (inRing(lng, lat, pl.p[0]) && !pl.p.slice(1).some((h) => inRing(lng, lat, h))) { bits[r * LW + c] = 1; break; }
  }
}
const packed = Buffer.alloc(Math.ceil(bits.length / 8));
bits.forEach((b, i) => { if (b) packed[i >> 3] |= 1 << (i & 7); });

// graticule: meridians + parallels every 30°, as projected polylines (Natural Earth curves them)
let grat = '';
for (let lng = -180; lng <= 180; lng += 30) { let d = ''; for (let lat = LAT_MIN; lat <= 84; lat += 6) { const p = proj(lng, lat); d += (d ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); } grat += d; }
for (let lat = -30; lat <= 60; lat += 30) { let d = ''; for (let lng = -180; lng <= 180; lng += 10) { const p = proj(lng, lat); d += (d ? 'L' : 'M') + p[0].toFixed(1) + ' ' + p[1].toFixed(1); } grat += d; }
writeFileSync(new URL('../../assets/mv/world.json', import.meta.url), JSON.stringify({ w: W, h: H, grat, paths, pts }));
writeFileSync(new URL('../../assets/mv/land.json', import.meta.url), JSON.stringify({ lw: LW, lh: LH, land: packed.toString('base64') }));
console.log(`countries with polygons: ${Object.keys(paths).length}/${ours.length}; path bytes ${bytes}; viewBox ${W}x${H}; land cells ${bits.reduce((a, b) => a + b, 0)}`);
