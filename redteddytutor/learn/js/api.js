// Accounts and synced profiles on Supabase, called over REST with fetch.
// Only the publishable key is used in the browser. Row-level security on the
// database decides what each signed-in parent can read and write.
import { clearProfileCaches } from './progress.js';

export const SUPABASE_URL = 'https://kxzywyflylkcqoidiqmo.supabase.co';
export const PUBLISHABLE_KEY = 'sb_publishable_37yXvakYMXdpz2e3Hf_zng__oGOVC-g';
const SESSION_KEY = 'rtt.auth.v1';
const ACTIVE_KEY = 'rtt.activeProfile.v1';
const PENDING_KEY = 'rtt.pending.v1';

const headers = (token) => ({
  apikey: PUBLISHABLE_KEY,
  Authorization: `Bearer ${token || PUBLISHABLE_KEY}`,
  'Content-Type': 'application/json',
});

// ---- Local storage (all reads and writes guarded) ----
function read(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}
function write(storage, key, value) {
  try {
    if (value === null) storage.removeItem(key);
    else storage.setItem(key, JSON.stringify(value));
  } catch { /* storage blocked: the session simply will not persist */ }
}

export const loadSession = (storage) => read(storage, SESSION_KEY, null);
export const saveSession = (storage, s) => write(storage, SESSION_KEY, s);
export const loadActiveProfile = (storage) => read(storage, ACTIVE_KEY, null);
export const saveActiveProfile = (storage, id) => write(storage, ACTIVE_KEY, id);

// ---- Auth ----
export async function sendMagicLink(email, redirectTo) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/otp?redirect_to=${encodeURIComponent(redirectTo)}`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ email, create_user: true }),
  });
  if (!res.ok) throw await failure(res, 'Could not send the sign-in link.');
}

// Reads the tokens Supabase puts in the URL fragment after the link is clicked.
export function sessionFromHash(hash) {
  const p = new URLSearchParams(hash.replace(/^#/, ''));
  const access = p.get('access_token');
  const refresh = p.get('refresh_token');
  if (!access || !refresh) return null;
  const expiresIn = Number(p.get('expires_in')) || 3600;
  return { access_token: access, refresh_token: refresh, expires_at: Date.now() + expiresIn * 1000, user: null };
}

export async function fetchUser(session) {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, { headers: headers(session.access_token) });
  if (!res.ok) throw await failure(res, 'Your sign-in has expired.');
  const u = await res.json();
  return { id: u.id, email: u.email };
}

// Renews the access token when it is close to expiry. Returns a usable session or null.
export async function ensureSession(storage, session) {
  if (!session) return null;
  if (session.expires_at - Date.now() > 60_000) return session;
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`, {
    method: 'POST', headers: headers(), body: JSON.stringify({ refresh_token: session.refresh_token }),
  });
  if (!res.ok) { saveSession(storage, null); return null; }
  const j = await res.json();
  const next = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: Date.now() + j.expires_in * 1000, user: session.user };
  saveSession(storage, next);
  return next;
}

export async function signOut(storage, session) {
  if (session) {
    try { await fetch(`${SUPABASE_URL}/auth/v1/logout`, { method: 'POST', headers: headers(session.access_token) }); } catch { /* best effort */ }
  }
  saveSession(storage, null);
  saveActiveProfile(storage, null);
  write(storage, PENDING_KEY, null);
  // Synced children's progress leaves the device with the sign-in.
  clearProfileCaches(storage);
}

// ---- REST (row-level security applies) ----
async function rest(session, method, path, body, prefer) {
  const h = headers(session.access_token);
  if (prefer) h.Prefer = prefer;
  const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    method, headers: h, body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (!res.ok) throw await failure(res, 'The change could not be saved.');
  if (res.status === 204) return null;
  return res.json();
}

const failure = async (res, fallback) => {
  let detail = '';
  try { detail = (await res.json()).message || ''; } catch { /* no body */ }
  const err = new Error(detail || fallback);
  err.status = res.status;
  return err;
};

export const listProfiles = (s) => rest(s, 'GET', 'rtt_profiles?select=id,nickname,age_band,locale,settings&order=created_at.asc');
export const createProfile = (s, nickname, ageBand, locale = null) => rest(s, 'POST', 'rtt_profiles?select=id,nickname,age_band,locale,settings',
  { nickname, age_band: ageBand, ...(locale ? { locale } : {}) }, 'return=representation').then((r) => r[0]);
export const updateProfile = (s, id, patch) => rest(s, 'PATCH', `rtt_profiles?id=eq.${id}`, patch, 'return=minimal');
export const deleteProfile = (s, id) => rest(s, 'DELETE', `rtt_profiles?id=eq.${id}`);
export const resetProgress = async (s, id) => {
  await rest(s, 'DELETE', `rtt_attempts?profile_id=eq.${id}`);
  await rest(s, 'DELETE', `rtt_sessions?profile_id=eq.${id}`);
};

export async function fetchProgress(s, profileId) {
  const [attempts, sessions] = await Promise.all([
    rest(s, 'GET', `rtt_attempts?profile_id=eq.${profileId}&select=activity_id,skill,first_try,correct,hints,difficulty,misconception,source,created_at&order=created_at.asc&limit=2000`),
    rest(s, 'GET', `rtt_sessions?profile_id=eq.${profileId}&select=activity_id,total,correct_first,hints_used,created_at&order=created_at.asc&limit=200`),
  ]);
  return { attempts, sessions };
}

export const attemptRow = (profileId, a) => ({
  profile_id: profileId, activity_id: a.activityId, skill: a.skill, first_try: a.firstTry,
  correct: a.correct ?? null, hints: a.hints ?? null, difficulty: a.difficulty ?? null,
  misconception: a.misconception ?? null, source: a.source ?? null,
});

export const pushAttempt = (s, profileId, a) => rest(s, 'POST', 'rtt_attempts', attemptRow(profileId, a), 'return=minimal');

export const pushSession = (s, profileId, x) => rest(s, 'POST', 'rtt_sessions', {
  profile_id: profileId, activity_id: x.activityId, total: x.total,
  correct_first: x.correctFirst, hints_used: x.hintsUsed,
}, 'return=minimal');

// ---- Mapping between database rows and the local progress model (pure) ----
// The result goes through progress.normalize() before use, which drops anything malformed.
export function rowsToState(profile, { attempts, sessions }) {
  const st = profile.settings || {};
  const opt = (v) => (v === null || v === undefined ? undefined : v);
  return {
    v: 1,
    settings: {
      band: profile.age_band, audio: st.audio ?? true, volume: st.volume ?? 1, showAll: st.showAll ?? false,
      locale: profile.locale ?? st.locale ?? null, onboarded: st.onboarded ?? false, focus: st.focus ?? 'all',
      placement: st.placement ?? {}, assumed: st.assumed ?? [], grade: st.grade ?? null,
    },
    steps: attempts.map((r) => ({
      activityId: r.activity_id, skill: r.skill, firstTry: r.first_try, at: Date.parse(r.created_at),
      correct: opt(r.correct), hints: opt(r.hints), difficulty: opt(r.difficulty), misconception: opt(r.misconception), source: opt(r.source),
    })),
    sessions: sessions.map((r) => ({ activityId: r.activity_id, at: Date.parse(r.created_at), total: r.total, correctFirst: r.correct_first, hintsUsed: r.hints_used })),
  };
}

// Writes that failed (offline, expired session) are kept and retried later.
export function queueWrite(storage, job) {
  const q = read(storage, PENDING_KEY, []);
  write(storage, PENDING_KEY, [...q, job].slice(-200));
}
export async function flushQueue(storage, session) {
  const q = read(storage, PENDING_KEY, []);
  if (!q.length || !session) return 0;
  const left = [];
  for (const job of q) {
    try { await rest(session, 'POST', job.path, job.body, 'return=minimal'); }
    catch (e) { if (!e.status || e.status >= 500 || e.status === 0) left.push(job); }
  }
  write(storage, PENDING_KEY, left.length ? left : null);
  return q.length - left.length;
}
export const pendingCount = (storage) => read(storage, PENDING_KEY, []).length;
