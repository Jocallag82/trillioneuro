// Sound effects synthesised with Web Audio, so the game ships no audio files.
// The AudioContext is created on the first sound, which always follows a tap
// (browsers block audio that starts without a user gesture).
const SOUNDS = {
  tap: (t, tone) => tone(660, 0, 0.06, 'sine', 0.15),
  pop: (t, tone) => { tone(900, 0, 0.05, 'sine', 0.12); tone(1300, 0.03, 0.07, 'sine', 0.08); },
  right: (t, tone) => [523, 659, 784].forEach((f, i) => tone(f, i * 0.09, 0.22, 'triangle', 0.22)),
  wrong: (t, tone) => { tone(330, 0, 0.18, 'triangle', 0.16); tone(262, 0.12, 0.22, 'triangle', 0.12); },
  hint: (t, tone) => tone(880, 0, 0.3, 'sine', 0.12),
  reveal: (t, tone) => { tone(523, 0, 0.2, 'sine', 0.14); tone(392, 0.18, 0.3, 'sine', 0.14); },
  win: (t, tone) => [523, 659, 784, 1047].forEach((f, i) => tone(f, i * 0.12, 0.35, 'triangle', 0.22)),
  sticker: (t, tone) => [784, 988].forEach((f, i) => tone(f, i * 0.1, 0.25, 'sine', 0.18)),
};

export function createSfx() {
  let ctx = null;
  let enabled = true;
  let volume = 1;

  const ensure = () => {
    try {
      if (!ctx) {
        const Ctor = window.AudioContext || window.webkitAudioContext;
        if (!Ctor) return null;
        ctx = new Ctor();
      }
      if (ctx.state === 'suspended') ctx.resume();
      return ctx;
    } catch { return null; }
  };

  const tone = (freq, delay, dur, type, gain) => {
    const c = ctx;
    const t = c.currentTime + delay;
    const osc = c.createOscillator();
    const amp = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    amp.gain.setValueAtTime(0.0001, t);
    amp.gain.linearRampToValueAtTime(gain * volume, t + 0.01);
    amp.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(amp).connect(c.destination);
    osc.start(t);
    osc.stop(t + dur + 0.02);
  };

  return {
    play(name) {
      if (!enabled || !SOUNDS[name] || !ensure()) return;
      try { SOUNDS[name](null, tone); } catch { /* audio is optional */ }
    },
    setEnabled(v) { enabled = !!v; },
    setVolume(v) { volume = Math.min(1, Math.max(0, Number(v) || 0)); },
    close() {
      try { ctx?.close(); } catch { /* already closed */ }
      ctx = null;
    },
  };
}
