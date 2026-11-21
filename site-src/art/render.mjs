// Renders the OG card and touch icon. Needs a Playwright install and the dev server's static files:
//   node site-src/art/render.mjs
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { extname, join } from 'node:path';
const root = fileURLToPath(new URL('../../', import.meta.url));
const T = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };
const srv = createServer(async (q, r) => { try { const b = await readFile(join(root, decodeURIComponent(q.url.split('?')[0]))); r.writeHead(200, { 'content-type': T[extname(q.url.split('?')[0])] || 'application/octet-stream' }); r.end(b); } catch { r.writeHead(404); r.end(); } }).listen(0);
const base = `http://localhost:${srv.address().port}`;
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto(`${base}/site-src/art/og.html`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(1200);
await p.screenshot({ path: join(root, 'assets/mv/og.png') });
const i = await b.newPage({ viewport: { width: 180, height: 180 } });
await i.goto(`${base}/assets/mv/favicon.svg`);
await i.screenshot({ path: join(root, 'assets/mv/apple-touch-icon.png') });
await b.close(); srv.close();
