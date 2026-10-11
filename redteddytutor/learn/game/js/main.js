// Page bootstrap for the bakery game. Mounts once, and tears the game down when the page is left.
import { mountBakery } from './mount.js';

const root = document.getElementById('game-root');
const notice = document.getElementById('g-notice');
const storage = (() => { try { return window.localStorage; } catch { return null; } })();
const seed = Number(new URLSearchParams(window.location.search).get('seed')) || null;

let instance = null;
let leaving = false;

if (!storage) {
  notice.textContent = 'Your browser is blocking storage, so progress will not be saved. You can still play.';
}

if (!root.dataset.mounted) {
  root.dataset.mounted = 'true';
  mountBakery({ root, storage: storage ?? { getItem: () => null, setItem() {}, removeItem() {} }, seed })
    .then((game) => {
      if (leaving) game.destroy();
      else instance = game;
    })
    .catch((err) => {
      notice.textContent = err.message || 'The game could not start. Please refresh the page.';
      root.dataset.view = 'error';
    });
}

window.addEventListener('pagehide', () => {
  leaving = true;
  instance?.destroy();
});
