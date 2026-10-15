// Photos and sounds from manifest.json (via the generated manifest.js), with honest
// fallbacks: a photo that has not been sourced yet, or fails to load, shows a labelled
// picture-symbol tile (never a different photo). A sound that has not been sourced is
// spoken by the device voice (e.g. "Woof woof!"). Speech never overlaps.
import M from './manifest.js';
import { speak, stopSpeaking, canSpeak } from '/learn/js/speech.js';

const PHOTOS = Object.fromEntries(M.photos.map((p) => [p.id, p]));
const SOUNDS = Object.fromEntries(M.sounds.map((s) => [s.id, s]));
const norm = (t) => String(t).toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
const VOICE = Object.fromEntries((M.voice || []).filter((v) => v.status === 'ready' && v.path).map((v) => [norm(v.text), v.path]));
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const nameOf = (id) => (PHOTOS[id]?.subject || id);

export function photo(id, { scale = 1, half = null, eager = false } = {}) {
  const p = PHOTOS[id];
  const alt = p?.alt || nameOf(id);
  const style = scale !== 1 ? ` style="--s:${scale}"` : '';
  const cls = `ph${half ? ` ph-half ph-${half}` : ''}${scale !== 1 ? ' ph-scaled' : ''}`;
  if (half) {
    const inner = p?.status === 'ready' && p.path
      ? `<img src="${esc(p.path)}" width="640" height="640" alt="" loading="${eager ? 'eager' : 'lazy'}" decoding="async" data-fallback="${esc(p.emoji || '')}">`
      : `<span class="ph-emoji" aria-hidden="true">${p?.emoji || '❔'}</span>`;
    return `<span class="ph ph-half ph-${half}" role="img" aria-label="${esc(`${half} half of the ${nameOf(id)}`)}"><span class="ph-inner">${inner}</span></span>`;
  }
  if (p?.status === 'ready' && p.path) {
    const small = p.path.replace(/-640\.webp$/, '-320.webp');
    return `<span class="${cls}"${style}><img src="${esc(small)}" srcset="${esc(small)} 320w, ${esc(p.path)} 640w" sizes="(min-width: 700px) 280px, 45vw" width="640" height="640" alt="${esc(alt)}" loading="${eager ? 'eager' : 'lazy'}" decoding="async" data-fallback="${esc(p.emoji || '')}"></span>`;
  }
  return `<span class="${cls} ph-symbol"${style} role="img" aria-label="${esc(alt)}"><span class="ph-emoji" aria-hidden="true">${p?.emoji || '❔'}</span></span>`;
}

// Replace any photo that fails to load with its labelled symbol tile.
export function guardImages(root) {
  for (const img of root.querySelectorAll('.ph img')) {
    img.addEventListener('error', () => {
      const box = img.parentElement;
      box.classList.add('ph-symbol');
      box.setAttribute('role', 'img');
      box.setAttribute('aria-label', img.alt);
      box.innerHTML = `<span class="ph-emoji" aria-hidden="true">${img.dataset.fallback || '❔'}</span>`;
    }, { once: true });
  }
}

// ── Audio: one channel, nothing plays until the child or grown-up taps. ──
const store = (() => { try { return window.localStorage; } catch { return null; } })();
let muted = (() => { try { return store?.getItem('rtt.ey.muted') === '1'; } catch { return false; } })();
export const isMuted = () => muted;
export function setMuted(v) { muted = v; try { store?.setItem('rtt.ey.muted', v ? '1' : '0'); } catch { /* optional */ } if (v) stop(); }
export const audioAvailable = () => canSpeak() || typeof Audio === 'function';

let clip = null;
export function stop() { if (clip) { clip.pause(); clip = null; } stopSpeaking(); }

function play(path, fallback) {
  const a = new Audio(path);
  clip = a;
  a.play().catch(() => { if (clip === a) { clip = null; speak(fallback); } });
  return true;
}

// Speaks a line: a recorded Red Teddy clip when one exists for exactly this text,
// otherwise the device voice. Always cancels whatever was playing.
export function say(text) {
  if (text != null) text = String(text);
  if (muted || !text) return false;
  stop();
  const rec = VOICE[norm(text)];
  if (rec && typeof Audio === 'function') return play(rec, text);
  return speak(text);
}

// Plays a recorded sound if one is sourced, then optionally says `after`.
export function sound(id, after = '') {
  if (muted) return false;
  stop();
  const s = SOUNDS[id];
  if (s?.status === 'ready' && s.path && typeof Audio === 'function') {
    const a = new Audio(s.path);
    clip = a;
    a.addEventListener('ended', () => { if (clip === a) { clip = null; if (after) say(after); } });
    a.play().catch(() => { if (clip === a) { clip = null; say([s.say, after].filter(Boolean).join(' ')); } });
    return true;
  }
  return say([s?.say, after].filter(Boolean).join(' '));
}
export const soundText = (id) => SOUNDS[id]?.say || '';
