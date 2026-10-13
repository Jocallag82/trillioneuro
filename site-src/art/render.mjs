// Renders the OG card and touch icon. Run with a Playwright install: node site-src/art/render.mjs
import { chromium } from 'playwright';
import { fileURLToPath } from 'node:url';
const here = (p) => new URL(p, import.meta.url);
const b = await chromium.launch({ executablePath: process.env.CHROME || undefined });
const p = await b.newPage({ viewport: { width: 1200, height: 630 } });
await p.goto(here('og.html').href); await p.evaluate(() => document.fonts.ready);
await p.screenshot({ path: fileURLToPath(here('../../assets/te/og-beat-elon.png')) });
const i = await b.newPage({ viewport: { width: 180, height: 180 } });
await i.goto(here('../../assets/te/favicon.svg').href);
await i.screenshot({ path: fileURLToPath(here('../../assets/te/apple-touch-icon.png')) });
await b.close();
