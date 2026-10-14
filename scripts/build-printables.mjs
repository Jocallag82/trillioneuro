/* Renders each age page's print layout to a free PDF pack in redteddytutor/early/printables/.
   Needs the preview server (node scripts/dev-rtt.mjs) and Playwright. Re-run after build-early.
   Run: PLAYWRIGHT_MODULE=/path/to/playwright/index.mjs node scripts/build-printables.mjs */
import { mkdirSync } from 'node:fs';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { STAGES } from '../redteddytutor/early/data.js';

const { chromium } = await import(process.env.PLAYWRIGHT_MODULE ? pathToFileURL(process.env.PLAYWRIGHT_MODULE).href : 'playwright');
const BASE = process.env.BASE || 'http://localhost:4321';
const dir = fileURLToPath(new URL('../redteddytutor/early/printables/', import.meta.url));
mkdirSync(dir, { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage();
for (const s of STAGES) {
  await page.goto(`${BASE}/${s.slug}`, { waitUntil: 'networkidle' });
  await page.evaluate(() => document.fonts.ready);
  await page.pdf({
    path: `${dir}${s.slug}.pdf`, format: 'Letter', printBackground: false,
    margin: { top: '0.6in', bottom: '0.7in', left: '0.6in', right: '0.6in' },
    displayHeaderFooter: true, headerTemplate: '<span></span>',
    footerTemplate: `<div style="font:9px sans-serif;width:100%;padding:0 0.6in;display:flex;justify-content:space-between;color:#555"><span>Red Teddy Tutor · ${s.name} (ages ${s.ages}) · free at redteddytutor.com/${s.slug}</span><span><span class="pageNumber"></span>/<span class="totalPages"></span></span></div>`,
  });
  console.log(`printables: ${s.slug}.pdf`);
}
await browser.close();
