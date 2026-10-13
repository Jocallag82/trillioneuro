// Local preview of redteddytutor.com: serves redteddytutor/ at the site root with the
// production CSP. The AI tutor endpoint answers 503 so the offline fallback is exercised.
// Run: node scripts/dev-rtt.mjs [port]
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, normalize, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', 'redteddytutor');
const PORT = Number(process.argv[2] || process.env.PORT || 4321);
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.json': 'application/json', '.txt': 'text/plain', '.xml': 'application/xml' };
const vercel = JSON.parse(await readFile(join(HERE, '..', 'vercel.json'), 'utf8'));
const CSP = vercel.routes.find((r) => r.headers?.['Content-Security-Policy'])?.headers['Content-Security-Policy'];
const ALIASES = { '/learn/parent': '/learn/parent.html', '/learn/account': '/learn/account.html', '/privacy': '/privacy.html' };

createServer(async (req, res) => {
  let p = decodeURIComponent(new URL(req.url, 'http://x').pathname).replace(/\/$/, '') || '/';
  if (p.startsWith('/api/')) { res.writeHead(503, { 'content-type': 'application/json' }); return res.end('{"ok":false,"reason":"offline"}'); }
  p = ALIASES[p] || p;
  if (!extname(p)) p += '/index.html';
  try {
    const body = await readFile(join(ROOT, normalize(p)));
    res.writeHead(200, { 'content-type': TYPES[extname(p)] || 'application/octet-stream', 'Content-Security-Policy': CSP, 'cache-control': 'no-store' });
    res.end(body);
  } catch { res.writeHead(404, { 'content-type': 'text/plain' }); res.end('not found'); }
}).listen(PORT, () => console.log(`Red Teddy Tutor on http://localhost:${PORT}`));
