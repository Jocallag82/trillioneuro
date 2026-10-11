// Spoken instructions via the browser's speech synthesis. Always optional:
// every spoken line is also shown as a caption, and the app works without audio.
// Speech starts only from a tap (see player.js), never on page load.

// Most natural-sounding voices first. Matching is by name, so it depends on
// what the device ships with; the fallbacks below cover everything else.
const PREFERRED = [
  /Microsoft .*(Natural|Online).*(en-US|United States)/i,
  /Google US English/i,
  /(Samantha|Ava|Allison|Susan|Zoe|Nicky)\b/i,
];

// Pure: chooses a voice from a list. Prefers en-US, then network (usually
// higher quality) voices, then any English voice. Returns null if none.
export function pickVoice(voices) {
  const english = voices.filter((v) => /^en([-_]|$)/i.test(v.lang || ''));
  if (!english.length) return null;
  const us = english.filter((v) => /-US$|_US$/i.test(v.lang || ''));
  const pool = us.length ? us : english;
  for (const pattern of PREFERRED) {
    const hit = pool.find((v) => pattern.test(v.name));
    if (hit) return hit;
  }
  return pool.find((v) => v.localService === false) || pool[0];
}

export function canSpeak() {
  return typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && typeof window.SpeechSynthesisUtterance === 'function';
}

let cachedVoice = null;
function currentVoice() {
  const synth = window.speechSynthesis;
  const voices = synth.getVoices();
  if (!voices.length) return null;
  if (!cachedVoice || !voices.includes(cachedVoice)) cachedVoice = pickVoice(voices);
  return cachedVoice;
}

if (typeof window !== 'undefined' && canSpeak()) {
  // Voices load asynchronously in most browsers.
  window.speechSynthesis.addEventListener?.('voiceschanged', () => { cachedVoice = null; });
}

export function speak(text, { volume = 1, muted = false } = {}) {
  if (!canSpeak() || muted) return false;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    const voice = currentVoice();
    if (voice) utterance.voice = voice;
    utterance.lang = voice ? voice.lang : 'en-US';
    utterance.rate = 0.92;   // slightly slower reads clearer for young listeners
    utterance.pitch = 1;
    utterance.volume = Math.min(1, Math.max(0, volume));
    synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking() {
  if (!canSpeak()) return;
  try { window.speechSynthesis.cancel(); } catch { /* ignore */ }
}

// Recorded narration. A clip at /learn/audio/<key>.mp3 is played when present,
// otherwise the built-in voice speaks the same text. A missing clip is remembered
// per key so the page does not re-request it on every tap.
const clipState = new Map(); // key -> true (exists) | false (missing)
let currentClip = null;

export function narrate(key, text, { volume = 1, muted = false } = {}) {
  if (muted) return false;
  if (!key || clipState.get(key) === false || typeof Audio !== 'function') {
    return speak(text, { volume, muted });
  }
  try {
    if (currentClip) currentClip.pause();
    stopSpeaking();
    const clip = new Audio(`/learn/audio/${key}.mp3`);
    clip.volume = Math.min(1, Math.max(0, volume));
    currentClip = clip;
    clip.onerror = () => { clipState.set(key, false); speak(text, { volume }); };
    clip.play().then(() => clipState.set(key, true)).catch(() => {
      if (clip === currentClip && clipState.get(key) !== true) {
        clipState.set(key, false);
        speak(text, { volume });
      }
    });
    return true;
  } catch {
    return speak(text, { volume, muted });
  }
}
