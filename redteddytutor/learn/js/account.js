// Parent sign-in (email magic link), child profiles and sign-out.
import { el } from './dom.js';
import {
  loadSession, saveSession, ensureSession, sessionFromHash, fetchUser,
  sendMagicLink, signOut, listProfiles, createProfile, deleteProfile,
  loadActiveProfile, saveActiveProfile,
} from './api.js';
import { BANDS } from './content.js';

const storage = (() => { try { return window.localStorage; } catch { return null; } })();
const app = document.getElementById('account-app');
const notice = document.getElementById('notice');
const BAND_LABEL = { '2-3': 'Age 2–3', '3-5': 'Age 3–5', '5-7': 'Age 5–7' };

function say(text) { notice.textContent = text; }

async function boot() {
  // Arriving from the magic link: the tokens are in the URL fragment.
  if (window.location.hash.includes('access_token=')) {
    const session = sessionFromHash(window.location.hash);
    history.replaceState(null, '', window.location.pathname);
    if (session) {
      try {
        session.user = await fetchUser(session);
        saveSession(storage, session);
        say('You are signed in.');
      } catch (e) { say(e.message); }
    }
  }
  const session = await ensureSession(storage, loadSession(storage));
  if (!session) return renderSignIn();
  return renderAccount(session);
}

function renderSignIn(sent = null) {
  if (sent) {
    app.replaceChildren(el('section', { class: 'panel' }, [
      el('h2', { text: 'Check your email' }),
      el('p', { text: `We sent a sign-in link to ${sent}. Open it on this device to continue.` }),
      el('p', { class: 'muted', text: 'The link expires after a short time. You can request a new one from this page.' }),
      el('button', { type: 'button', class: 'btn btn-line', onclick: () => renderSignIn(), text: 'Use a different email' }),
    ]));
    return;
  }
  const input = el('input', { type: 'email', id: 'email', name: 'email', required: true, autocomplete: 'email', placeholder: 'you@example.com', class: 'field' });
  app.replaceChildren(el('form', {
    class: 'panel',
    onsubmit: async (e) => {
      e.preventDefault();
      const email = input.value.trim();
      if (!email) return say('Enter your email address.');
      try {
        await sendMagicLink(email, `${window.location.origin}/learn/account.html`);
        renderSignIn(email);
      } catch (err) { say(err.message); }
    },
  }, [
    el('label', { for: 'email', class: 'field-label', text: 'Parent email' }),
    input,
    el('button', { type: 'submit', class: 'btn btn-red', text: 'Email me a sign-in link' }),
    el('p', { class: 'muted small', text: 'We only use your email to sign you in. Your child is never asked for a surname, birthday or contact details.' }),
  ]));
}

async function renderAccount(session) {
  let profiles = [];
  try { profiles = await listProfiles(session); }
  catch (e) { say(e.message); }
  const active = loadActiveProfile(storage);

  const list = profiles.length
    ? el('ul', { class: 'profiles' }, profiles.map((p) => el('li', { class: 'profile' }, [
      el('div', { class: 'profile-info' }, [
        el('strong', { text: p.nickname }),
        el('span', { class: 'muted', text: ` · ${BAND_LABEL[p.age_band]}${active === p.id ? ' · learning now' : ''}` }),
      ]),
      el('div', { class: 'profile-actions' }, [
        el('button', { type: 'button', class: 'btn btn-red', onclick: () => { saveActiveProfile(storage, p.id); window.location.href = '/learn/'; }, text: 'Learn as ' + p.nickname }),
        el('button', { type: 'button', class: 'btn btn-line', onclick: () => removeProfile(session, p), text: 'Delete' }),
      ]),
    ])))
    : el('p', { class: 'muted', text: 'No child profiles yet. Add one below.' });

  const nickname = el('input', { id: 'nickname', maxlength: 20, required: true, placeholder: 'e.g. Sam or Bear', class: 'field' });
  const band = el('select', { id: 'band', class: 'field' }, BANDS.map((b) => el('option', { value: b, text: BAND_LABEL[b] })));
  band.value = '3-5';

  app.replaceChildren(
    el('section', { class: 'panel', 'aria-labelledby': 'profiles-h' }, [
      el('div', { class: 'panel-head' }, [
        el('h2', { id: 'profiles-h', text: 'Child profiles' }),
        el('span', { class: 'muted', text: session.user?.email || '' }),
      ]),
      list,
      profiles.length >= 5 ? el('p', { class: 'muted', text: 'You have reached the limit of five profiles.' }) : null,
    ]),
    profiles.length < 5 ? el('form', {
      class: 'panel',
      onsubmit: async (e) => {
        e.preventDefault();
        const name = nickname.value.trim();
        if (!name) return say('Enter a nickname for your child.');
        try {
          const p = await createProfile(session, name, band.value);
          saveActiveProfile(storage, p.id);
          say(`Profile created for ${p.nickname}.`);
          renderAccount(session);
        } catch (err) { say(err.message); }
      },
    }, [
      el('h2', { text: 'Add a child' }),
      el('label', { for: 'nickname', class: 'field-label', text: 'Nickname (no real name)' }),
      nickname,
      el('label', { for: 'band', class: 'field-label', text: 'Age band (a starting point, not a measure of ability)' }),
      band,
      el('button', { type: 'submit', class: 'btn btn-red', text: 'Add profile' }),
    ]) : null,
    el('section', { class: 'panel' }, [
      el('h3', { text: 'Account' }),
      el('p', { class: 'muted', text: 'Signing out keeps your children’s saved progress. It only removes this device’s sign-in.' }),
      el('button', { type: 'button', class: 'btn btn-line', onclick: async () => { await signOut(storage, session); renderSignIn(); say('You have signed out.'); }, text: 'Sign out' }),
    ]),
  );
}

async function removeProfile(session, p) {
  if (!window.confirm(`Delete ${p.nickname}'s profile and all of their saved progress? This cannot be undone.`)) return;
  try {
    await deleteProfile(session, p.id);
    if (loadActiveProfile(storage) === p.id) saveActiveProfile(storage, null);
    say(`${p.nickname}'s profile and progress were deleted.`);
    renderAccount(session);
  } catch (err) { say(err.message); }
}

boot().catch((e) => say(e.message));

