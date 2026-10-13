// Ties the local progress model to a signed-in child profile. When nobody is signed
// in, or no profile is active, everything stays on this device exactly as before.
import {
  loadSession, ensureSession, loadActiveProfile, saveActiveProfile,
  listProfiles, fetchProgress, pushAttempt, pushSession, updateProfile, resetProgress,
  rowsToState, queueWrite, flushQueue, attemptRow,
} from './api.js';
import { normalize } from './progress.js';

// Returns { session, profile, state } when a profile is active and reachable, else null.
export async function openRemote(storage) {
  const session = await ensureSession(storage, loadSession(storage));
  if (!session) return null;
  const activeId = loadActiveProfile(storage);
  if (!activeId) return { session, profile: null, state: null };
  try {
    const profiles = await listProfiles(session);
    const profile = profiles.find((p) => p.id === activeId);
    if (!profile) { saveActiveProfile(storage, null); return { session, profile: null, state: null }; }
    const data = await fetchProgress(session, profile.id);
    flushQueue(storage, session).catch(() => {});
    return { session, profile, state: normalize(rowsToState(profile, data)) };
  } catch {
    return { session, profile: null, state: null, offline: true };
  }
}

// Writes one finished step or session. A failed write is queued and retried later.
export async function syncStep(storage, remote, step) {
  if (!remote?.profile) return;
  try { await pushAttempt(remote.session, remote.profile.id, step); }
  catch { queueWrite(storage, { path: 'rtt_attempts', body: attemptRow(remote.profile.id, step) }); }
}

export async function syncSession(storage, remote, s) {
  if (!remote?.profile) return;
  const row = { activityId: s.activityId, total: s.total, correctFirst: s.correctFirst, hintsUsed: s.hintsUsed };
  try { await pushSession(remote.session, remote.profile.id, row); }
  catch { queueWrite(storage, { path: 'rtt_sessions', body: { profile_id: remote.profile.id, activity_id: row.activityId, total: row.total, correct_first: row.correctFirst, hints_used: row.hintsUsed } }); }
}

export async function syncSettings(remote, settings) {
  if (!remote?.profile) return;
  const { band, locale, ...rest } = settings;
  await updateProfile(remote.session, remote.profile.id, { age_band: band, locale: locale || null, settings: rest });
}

export async function syncReset(remote) {
  if (remote?.profile) await resetProgress(remote.session, remote.profile.id);
}

