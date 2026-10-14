/* Imports hand-picked, licence-checked photos and sounds into the early-years games.
   Works on Windows, macOS and Linux. Needs ImageMagick 7 (`magick`) for photos and
   ffmpeg for sounds, both free.

   1. Download the file yourself from the source page (never a search thumbnail).
   2. Save it as redteddytutor/early/games/incoming/<id>.<jpg|png|webp|mp3|wav|ogg>.
   3. In manifest.json fill sourceUrl, creator, licence, licenceUrl (and attribution if the
      licence needs one) for that id. Photos also need `alt`.
   4. Run: node scripts/import-early-assets.mjs
   Photos become img/<id>-640.webp and img/<id>-320.webp (square crop, centre). Sounds become
   audio/<id>.mp3 (mono, 64 kbps, max 4 s). Entries without licence details are skipped.
   The script also regenerates manifest.js, which the browser loads. */
import { readFileSync, writeFileSync, readdirSync, existsSync, unlinkSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

const DIR = fileURLToPath(new URL('../redteddytutor/early/games/', import.meta.url));
const MAN = join(DIR, 'manifest.json');
const m = JSON.parse(readFileSync(MAN, 'utf8'));
const inbox = existsSync(join(DIR, 'incoming')) ? readdirSync(join(DIR, 'incoming')) : [];
const today = new Date().toISOString().slice(0, 10);
const magick = (() => { for (const c of ['magick', 'convert']) { try { execFileSync(c, ['-version'], { stdio: 'ignore' }); return c; } catch {} } return null; })();
const licensed = (e) => e.sourceUrl && e.licence && e.licenceUrl && e.creator !== undefined;
const report = { imported: [], skipped: [] };

for (const file of inbox) {
  const [id, ext] = [file.replace(/\.[^.]+$/, ''), file.split('.').pop().toLowerCase()];
  const src = join(DIR, 'incoming', file);
  const photo = m.photos.find((p) => p.id === id);
  const sound = m.sounds.find((s) => s.id === id);
  const e = ['jpg', 'jpeg', 'png', 'webp'].includes(ext) ? photo : ['mp3', 'wav', 'ogg'].includes(ext) ? sound : null;
  if (!e) { report.skipped.push(`${file}: no manifest entry of that type`); continue; }
  if (!licensed(e)) { report.skipped.push(`${file}: fill sourceUrl, creator, licence, licenceUrl first`); continue; }
  if (e === photo) {
    if (!magick) { report.skipped.push(`${file}: install ImageMagick (winget install ImageMagick.ImageMagick)`); continue; }
    if (!e.alt) { report.skipped.push(`${file}: add alt text`); continue; }
    for (const w of [640, 320]) {
      execFileSync(magick, [src, '-auto-orient', '-resize', `${w}x${w}^`, '-gravity', 'center', '-extent', `${w}x${w}`, '-strip', '-quality', '80', join(DIR, 'img', `${id}-${w}.webp`)]);
    }
    Object.assign(e, { status: 'ready', path: `/early/games/img/${id}-640.webp`, width: 640, height: 640, checked: today });
  } else {
    try {
      execFileSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', src, '-t', '4', '-ac', '1', '-b:a', '64k', join(DIR, 'audio', `${id}.mp3`)]);
    } catch { report.skipped.push(`${file}: install ffmpeg (winget install Gyan.FFmpeg)`); continue; }
    Object.assign(e, { status: 'ready', path: `/early/games/audio/${id}.mp3`, checked: today });
  }
  unlinkSync(src);
  report.imported.push(file);
}
writeFileSync(MAN, JSON.stringify(m, null, 2) + '\n');
writeFileSync(join(DIR, 'manifest.js'), `// Generated from manifest.json by scripts/import-early-assets.mjs. Do not edit.\nexport default ${JSON.stringify(m)};\n`);
const need = (l) => l.filter((x) => x.status !== 'ready').map((x) => x.id);
console.log(`Imported: ${report.imported.join(', ') || 'none'}`);
for (const s of report.skipped) console.log(`Skipped ${s}`);
console.log(`Photos still needed (${need(m.photos).length}): ${need(m.photos).join(', ')}`);
console.log(`Sounds still needed (${need(m.sounds).length}): ${need(m.sounds).join(', ')}`);
