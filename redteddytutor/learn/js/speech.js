// Spoken instructions via the browser's speech synthesis. Always optional:
// every spoken line is also shown as a caption, and the app works without audio.
// Speech starts only from a tap (see player.js), never on page load.

export function canSpeak() {
  return typeof window !== 'undefined'
    && 'speechSynthesis' in window
    && typeof window.SpeechSynthesisUtterance === 'function';
}

export function speak(text, { volume = 1, muted = false } = {}) {
  if (!canSpeak() || muted) return false;
  try {
    const synth = window.speechSynthesis;
    synth.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = 'en-US';
    utterance.rate = 0.9;
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
