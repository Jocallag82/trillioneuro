// "Meet Red Teddy": the 10-second welcome video, shown only when someone asks for it.
//
// Rules:
// - Never autoplays. The video element (and its 3.7 MB of bytes) is created only when
//   the visitor presses play. Sound is on because pressing play is the visitor's choice.
// - Never blocks anything: it opens in a dialog that closes with Escape, the close
//   button or a click outside, and nothing waits for it.
// - Remembered on this device only: after it has been watched to the end or closed,
//   entry points switch to a quieter "watch again" form. Nothing is sent anywhere.
//   If storage is blocked, it simply behaves like a first visit.
export const WELCOME = {
  src: '/media/red-teddy-welcome-v1.mp4',
  poster: '/media/red-teddy-welcome-poster-1280.webp',
  posterSmall: '/media/red-teddy-welcome-poster-640.webp',
  seconds: 10,
  // No captions file exists yet; the description stands in for the picture.
  description: 'Red Teddy, a red teddy bear, sits at a desk in a sunny classroom with an open book and greets you. 10 seconds, with sound.',
};

const KEY = 'rtt.welcome.v1';

export function welcomeSeen() {
  try { return window.localStorage.getItem(KEY) === 'seen'; } catch { return false; }
}

function markSeen() {
  try { window.localStorage.setItem(KEY, 'seen'); } catch { /* storage blocked: fine */ }
  document.dispatchEvent(new CustomEvent('rtt-welcome-seen'));
}

let dialog = null;

function build() {
  dialog = document.createElement('dialog');
  dialog.className = 'welcome-dialog';
  dialog.setAttribute('aria-labelledby', 'welcome-title');
  dialog.setAttribute('aria-describedby', 'welcome-desc');
  dialog.innerHTML = `
    <div class="welcome-frame">
      <div class="welcome-bar">
        <h2 id="welcome-title">Meet Red Teddy</h2>
        <button type="button" class="welcome-close" aria-label="Close video">Close</button>
      </div>
      <div class="welcome-media"></div>
      <p id="welcome-desc" class="welcome-desc"></p>
      <p class="welcome-error" role="alert" hidden>The video could not play. You can still <a href="/learn/">start learning</a> right away.</p>
    </div>`;
  dialog.querySelector('.welcome-desc').textContent = WELCOME.description;
  dialog.querySelector('.welcome-close').addEventListener('click', () => dialog.close());
  // A click on the backdrop (outside the frame) closes it.
  dialog.addEventListener('click', (e) => { if (e.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => {
    const v = dialog.querySelector('video');
    if (v) { v.pause(); v.removeAttribute('src'); v.load(); v.remove(); }
    markSeen();
    lastTrigger?.focus();
  });
  document.body.append(dialog);
}

let lastTrigger = null;

export function openWelcome(trigger = null) {
  if (!dialog) build();
  lastTrigger = trigger || document.activeElement;
  const media = dialog.querySelector('.welcome-media');
  const error = dialog.querySelector('.welcome-error');
  error.hidden = true;
  const v = document.createElement('video');
  v.src = WELCOME.src;
  v.poster = WELCOME.poster;
  v.controls = true;
  v.playsInline = true;
  v.preload = 'auto';
  v.setAttribute('aria-label', 'Red Teddy welcome video');
  v.addEventListener('ended', markSeen);
  v.addEventListener('error', () => { error.hidden = false; });
  media.replaceChildren(v);
  if (typeof dialog.showModal === 'function') dialog.showModal(); else dialog.setAttribute('open', '');
  // The visitor pressed play, so start. If the browser still refuses, the controls remain.
  v.play().catch(() => {});
  v.focus();
}

// Wires every element with [data-welcome] to open the video, and lets each one
// show a first-visit or returning form via the `is-seen` class.
export function wireWelcome(root = document) {
  const triggers = [...root.querySelectorAll('[data-welcome]')];
  const sync = () => { const seen = welcomeSeen(); triggers.forEach((t) => t.classList.toggle('is-seen', seen)); };
  triggers.forEach((t) => t.addEventListener('click', (e) => { e.preventDefault(); openWelcome(t); }));
  document.addEventListener('rtt-welcome-seen', sync);
  sync();
}
