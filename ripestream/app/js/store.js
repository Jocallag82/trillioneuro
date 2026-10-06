/* RipeStream data layer — PREVIEW adapter.
 *
 * Everything lives in this browser's localStorage. It mirrors the tables in
 * supabase/ripestream-app.sql one-to-one (users, follows, communities,
 * memberships, posts, comments, reactions, rsvps, prefs, blocks, reports,
 * notifications, invites, analytics) so the production adapter can replace it
 * behind the same function names. UI code never touches `db` directly.
 */
import { COMMUNITIES, TEAM, STARTER_POSTS, AREA, parentOf } from './seed.js';
import { buildFeed, detectTopics, DEFAULT_MIX } from './rank.js';

const KEY = 'rs_app_v1';
const DAY = 864e5;
let db;

const uid = (p) => p + '-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-3);
const now = () => Date.now();

function fresh() {
  const t = now();
  const posts = STARTER_POSTS.map((s, i) => {
    const p = {
      id: 'p-starter-' + i, author: s.author, community: s.community || null,
      area: s.area || (COMMUNITIES.find((c) => c.id === s.community) || {}).area || null,
      kind: s.kind || 'post', text: s.text, image: null, starter: true,
      createdAt: t - s.hoursAgo * 36e5, removed: false, hiddenPendingReview: false
    };
    const comm = COMMUNITIES.find((c) => c.id === p.community);
    p.topics = [...new Set([...(comm ? comm.topics : []), ...detectTopics(p.text)])].slice(0, 3);
    if (s.event) {
      const d = new Date(t + s.event.inDays * DAY);
      p.event = { title: s.event.title, date: d.toISOString().slice(0, 10), time: s.event.time, place: s.event.place };
    }
    return p;
  });
  return {
    v: 1, me: null,
    users: TEAM.map((u) => ({ ...u, createdAt: t, private: false, replyPolicy: 'everyone', discoverable: true })),
    communities: COMMUNITIES.map((c) => ({ ...c })),
    follows: [], memberships: [], posts, comments: [], reactions: [], rsvps: [],
    prefs: {}, blocks: [], reports: [], notifications: [], invites: [], communityRequests: [],
    analytics: [], rate: {}, sessions: {}
  };
}

export function load() {
  try { db = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch { db = null; }
  if (!db || db.v !== 1) { db = fresh(); save(); }
  return db;
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); }
  catch { throw new Error('This browser is out of storage space for the preview. Remove an image post or reset preview data in Settings.'); }
}

/* ── lookups ─────────────────────────────────────────────── */
export const me = () => db.users.find((u) => u.id === db.me) || null;
export const user = (id) => db.users.find((u) => u.id === id);
export const userByHandle = (h) => db.users.find((u) => u.handle === h);
export const community = (id) => db.communities.find((c) => c.id === id);
export const communities = () => db.communities;
export const commentById = (id) => db.comments.find((c) => c.id === id);
export const post = (id) => db.posts.find((p) => p.id === id);
export const accounts = () => db.users.filter((u) => !u.team);
export const isTeam = (id) => !!(user(id) || {}).team;

export function prefs(id = db.me) {
  if (!db.prefs[id]) db.prefs[id] = { mode: 'mix', mix: { ...DEFAULT_MIX }, adjust: { topic: {}, community: {}, author: {}, kind: {} }, mute: { users: [], communities: [], topics: [] }, notInterested: [], inferred: {}, notify: { replies: true, follows: true, community: true, events: true } };
  return db.prefs[id];
}
export const following = (id = db.me) => db.follows.filter((f) => f.from === id).map((f) => f.to);
export const followers = (id) => db.follows.filter((f) => f.to === id).map((f) => f.from);
export const isFollowing = (to, from = db.me) => db.follows.some((f) => f.from === from && f.to === to);
export const joined = (id = db.me) => db.memberships.filter((m) => m.user === id).map((m) => m.community);
export const isMember = (c, u = db.me) => db.memberships.some((m) => m.user === u && m.community === c);
export const members = (c) => db.memberships.filter((m) => m.community === c).map((m) => m.user);
export const isBlocked = (a, b) => db.blocks.some((x) => (x.from === a && x.to === b) || (x.from === b && x.to === a));
export const blockedByMe = () => db.blocks.filter((b) => b.from === db.me).map((b) => b.to);
export const likes = (postId) => db.reactions.filter((r) => r.post === postId).length;
export const liked = (postId) => db.reactions.some((r) => r.post === postId && r.user === db.me);
export const comments = (postId) => db.comments.filter((c) => c.post === postId && !c.removed && !isBlocked(db.me, c.author))
  .sort((a, b) => a.createdAt - b.createdAt);
export const commentCount = (postId) => db.comments.filter((c) => c.post === postId && !c.removed).length;
export const rsvps = (postId) => db.rsvps.filter((r) => r.post === postId).length;
export const going = (postId) => db.rsvps.some((r) => r.post === postId && r.user === db.me);
export const isModOf = (cid, u = db.me) => { const c = community(cid); const usr = user(u); return !!(c && (c.mods.includes(u))) || !!(usr && usr.previewModerator); };
export const isAnyMod = (u = db.me) => !!(user(u) || {}).previewModerator || db.communities.some((c) => c.mods.includes(u));
export const areaName = (id) => (AREA[id] || {}).name || '';

/* ── analytics: activation / engagement / retention, nothing else ── */
export function track(name, props = {}) {
  if (!db.me && name !== 'signup') return;
  db.analytics.push({ u: db.me, name, at: now(), ...props });
  if (db.analytics.length > 5000) db.analytics.splice(0, 1000);
  save();
}
export function markSession() {
  if (!db.me) return;
  const day = new Date().toISOString().slice(0, 10);
  const s = db.sessions[db.me] || (db.sessions[db.me] = []);
  if (s[s.length - 1] !== day) { s.push(day); track('session_day'); }
  track('feed_session');
}

/* ── rate limiting + basic spam detection ─────────────────── */
const LIMITS = { post: [5, 10 * 60e3], comment: [20, 10 * 60e3], report: [10, 60 * 60e3], follow: [60, 60 * 60e3], invite: [5, 30 * DAY] };
function allow(action) {
  const [n, win] = LIMITS[action];
  const k = db.me + ':' + action;
  const list = (db.rate[k] || []).filter((t) => now() - t < win);
  if (list.length >= n) return false;
  list.push(now()); db.rate[k] = list; return true;
}
export function spamCheck(text, authorId) {
  const t = String(text || '');
  const links = (t.match(/https?:\/\//g) || []).length;
  if (links > 2) return 'Posts with more than two links are held back — it is our main spam signal.';
  const letters = t.replace(/[^a-zA-Z]/g, '');
  if (letters.length > 30 && letters === letters.toUpperCase()) return 'Please don\'t post in all caps.';
  if (/(.)\1{9,}/.test(t)) return 'That looks like repeated characters.';
  const recent = db.posts.filter((p) => p.author === authorId).slice(-5).map((p) => p.text.trim().toLowerCase());
  if (recent.includes(t.trim().toLowerCase())) return 'You already posted that.';
  if (/\b(crypto giveaway|double your|whatsapp me|dm for promo|onlyfans)\b/i.test(t)) return 'That reads like spam. If it isn\'t, rephrase it.';
  return null;
}

/* ── accounts ─────────────────────────────────────────────── */
const HANDLE_RE = /^[a-z0-9._]{3,20}$/;
export function createAccount({ name, handle, invite }) {
  name = String(name || '').trim().slice(0, 40);
  handle = String(handle || '').trim().toLowerCase().replace(/^@/, '');
  if (name.length < 2) throw new Error('Enter your name (2+ characters).');
  if (!HANDLE_RE.test(handle)) throw new Error('Usernames are 3–20 characters: letters, numbers, dots, underscores.');
  if (userByHandle(handle)) throw new Error('That username is taken.');
  const palette = ['#ff5b1f', '#6b3fa0', '#2e7d5b', '#1f6feb', '#b83a0c', '#8a6d00'];
  const u = { id: uid('u'), name, handle, bio: '', interests: [], area: null, showArea: false, private: false, replyPolicy: 'everyone', discoverable: true, color: palette[db.users.length % palette.length], createdAt: now(), onboarded: false };
  db.users.push(u); db.me = u.id; prefs(u.id);
  if (invite) {
    const inv = db.invites.find((i) => i.code === invite && !i.usedBy);
    if (inv) { inv.usedBy = u.id; u.invitedBy = inv.from; u.inviteCommunity = inv.community || null; }
  }
  track('signup', { invited: !!u.invitedBy }); save();
  return u;
}
export function switchTo(id) { if (user(id) && !user(id).team) { db.me = id; save(); } }
export function signOut() { db.me = null; save(); }

export function updateProfile(fields) {
  const u = me();
  if ('name' in fields) { const n = String(fields.name).trim().slice(0, 40); if (n.length < 2) throw new Error('Name too short.'); u.name = n; }
  if ('bio' in fields) u.bio = String(fields.bio).slice(0, 200);
  for (const k of ['private', 'showArea', 'discoverable']) if (k in fields) u[k] = !!fields[k];
  if ('replyPolicy' in fields && ['everyone', 'following', 'nobody'].includes(fields.replyPolicy)) u.replyPolicy = fields.replyPolicy;
  if ('area' in fields) u.area = AREA[fields.area] ? fields.area : null;
  if ('interests' in fields) u.interests = [...new Set(fields.interests)].slice(0, 12);
  if ('onboarded' in fields) u.onboarded = !!fields.onboarded;
  save();
}

/* ── graph ───────────────────────────────────────────────── */
export function follow(to) {
  if (to === db.me || isFollowing(to) || isBlocked(db.me, to)) return;
  if (!allow('follow')) throw new Error('You are following a lot of people quickly. Take a breather.');
  db.follows.push({ from: db.me, to, at: now() });
  notify(to, 'follow', { actor: db.me });
  track('follow'); save();
}
export function unfollow(to) { db.follows = db.follows.filter((f) => !(f.from === db.me && f.to === to)); save(); }
export function join(cid) {
  if (isMember(cid)) return;
  db.memberships.push({ user: db.me, community: cid, at: now() });
  track('join_community', { c: cid }); save();
}
export function leave(cid) { db.memberships = db.memberships.filter((m) => !(m.user === db.me && m.community === cid)); save(); }

/* ── posts ───────────────────────────────────────────────── */
export function createPost({ text, community: cid, image, kind = 'post', event, toArea }) {
  const u = me();
  text = String(text || '').trim();
  if (!text && !image) throw new Error('Write something or add a photo.');
  if (text.length > 2000) throw new Error('Posts are capped at 2,000 characters.');
  if (cid && !isMember(cid)) throw new Error('Join the community to post in it.');
  const spam = spamCheck(text, u.id); if (spam) throw new Error(spam);
  if (!allow('post')) throw new Error('That is 5 posts in 10 minutes — the limit for now. It keeps spam bots out.');
  const comm = cid ? community(cid) : null;
  const p = {
    id: uid('p'), author: u.id, community: cid || null,
    area: comm && comm.area ? (u.area && parentOf(u.area) === comm.area ? u.area : comm.area) : (toArea && u.area ? u.area : null),
    kind, text, image: image || null, createdAt: now(), removed: false, starter: false,
    topics: [...new Set([...(comm ? comm.topics : []), ...detectTopics(text)])].slice(0, 3)
  };
  if (kind === 'event') {
    if (!event || !event.title || !event.date) throw new Error('Events need a title and a date.');
    p.event = { title: String(event.title).slice(0, 80), date: event.date, time: event.time || '', place: String(event.place || '').slice(0, 80) };
  }
  db.posts.push(p);
  track('post', { kind, community: !!cid, image: !!image });
  save();
  return p;
}
export function deletePost(id) {
  const p = post(id); if (!p || p.author !== db.me) return;
  db.posts = db.posts.filter((x) => x.id !== id);
  db.comments = db.comments.filter((c) => c.post !== id);
  db.reactions = db.reactions.filter((r) => r.post !== id);
  save();
}
export function canReply(p, u = db.me) {
  const a = user(p.author);
  if (!a || isBlocked(a.id, u)) return false;
  if (a.id === u) return true;
  if (a.replyPolicy === 'nobody') return false;
  if (a.replyPolicy === 'following') return isFollowing(u, a.id);
  return true;
}
export function toggleLike(id) {
  const p = post(id);
  if (liked(id)) db.reactions = db.reactions.filter((r) => !(r.post === id && r.user === db.me));
  else {
    db.reactions.push({ user: db.me, post: id, at: now() });
    learn(p, 1);
    if (p.author !== db.me) notify(p.author, 'like', { actor: db.me, post: id, aggregate: true });
    track('react');
  }
  save();
}
export function addComment(postId, text, parent = null) {
  const p = post(postId);
  text = String(text || '').trim();
  if (!text) throw new Error('Write a reply first.');
  if (text.length > 1000) throw new Error('Replies are capped at 1,000 characters.');
  if (!canReply(p)) throw new Error('The author has limited who can reply.');
  const spam = spamCheck(text, '__none__'); if (spam) throw new Error(spam);
  if (!allow('comment')) throw new Error('Slow down a little — too many replies in 10 minutes.');
  const c = { id: uid('cm'), post: postId, author: db.me, parent, text, createdAt: now(), removed: false };
  db.comments.push(c);
  learn(p, 2);
  if (p.author !== db.me) notify(p.author, 'reply', { actor: db.me, post: postId });
  if (parent) { const pc = db.comments.find((x) => x.id === parent); if (pc && pc.author !== db.me && pc.author !== p.author) notify(pc.author, 'reply', { actor: db.me, post: postId }); }
  track('comment'); save();
  return c;
}
export function deleteComment(id) {
  const c = db.comments.find((x) => x.id === id);
  if (c && (c.author === db.me || isModOf(post(c.post).community))) { c.removed = true; save(); }
}
export function toggleRsvp(postId) {
  if (going(postId)) db.rsvps = db.rsvps.filter((r) => !(r.post === postId && r.user === db.me));
  else { db.rsvps.push({ user: db.me, post: postId, at: now() }); track('rsvp'); }
  save();
}

/* Inferred interests: the only implicit signal. Visible and resettable in Settings. */
function learn(p, w) {
  const pr = prefs();
  for (const t of p.topics || []) pr.inferred[t] = Math.min(10, (pr.inferred[t] || 0) + w);
}

/* ── feed controls ───────────────────────────────────────── */
export function setMode(mode) { prefs().mode = mode; track('feed_mode', { mode }); save(); }
export function setMix(mix) { prefs().mix = mix; track('feed_mix'); save(); }
export function adjust(kind, key, delta) {
  const a = prefs().adjust[kind] || (prefs().adjust[kind] = {});
  a[key] = Math.max(-2, Math.min(2, (a[key] || 0) + delta));
  if (!a[key]) delete a[key];
  track('feed_adjust', { kind, delta }); save();
}
export function mute(kind, key) {
  const m = prefs().mute[kind];
  if (!m.includes(key)) m.push(key);
  track('mute', { kind }); save();
}
export function unmute(kind, key) { const m = prefs().mute; m[kind] = m[kind].filter((x) => x !== key); save(); }
export function notInterested(postId) {
  const pr = prefs(); pr.notInterested.push(postId);
  const p = post(postId); for (const t of p.topics || []) pr.inferred[t] = Math.max(0, (pr.inferred[t] || 0) - 2);
  track('not_interested'); save();
}
export function resetFeed() {
  const pr = prefs();
  pr.inferred = {}; pr.adjust = { topic: {}, community: {}, author: {}, kind: {} };
  pr.notInterested = []; pr.mix = { ...DEFAULT_MIX }; pr.mode = 'mix';
  track('feed_reset'); save();
}

/* ── safety ──────────────────────────────────────────────── */
export function block(to) {
  if (!db.blocks.some((b) => b.from === db.me && b.to === to)) db.blocks.push({ from: db.me, to, at: now() });
  db.follows = db.follows.filter((f) => !((f.from === db.me && f.to === to) || (f.from === to && f.to === db.me)));
  track('block'); save();
}
export function unblock(to) { db.blocks = db.blocks.filter((b) => !(b.from === db.me && b.to === to)); save(); }

export const REPORT_REASONS = ['Spam or scam', 'Harassment or bullying', 'Hate', 'Violence or threats', 'Sharing someone\'s private information', 'Sexual content', 'Misinformation that could cause harm', 'Something else'];
export function report(targetType, targetId, reason, note = '') {
  if (!allow('report')) throw new Error('You have sent a lot of reports this hour. Our moderators will get to them.');
  if (db.reports.some((r) => r.reporter === db.me && r.targetId === targetId && r.status === 'open')) return;
  db.reports.push({ id: uid('r'), reporter: db.me, targetType, targetId, reason, note: String(note).slice(0, 500), status: 'open', createdAt: now() });
  // Three independent reports hide a post or comment until a human moderator looks.
  const n = new Set(db.reports.filter((r) => r.targetId === targetId && r.status === 'open').map((r) => r.reporter)).size;
  if (n >= 3) {
    if (targetType === 'post') { const p = post(targetId); if (p) p.hiddenPendingReview = true; }
    if (targetType === 'comment') { const c = db.comments.find((x) => x.id === targetId); if (c) c.hiddenPendingReview = true; }
  }
  track('report', { targetType }); save();
}
export function modQueue() {
  const mine = (r) => {
    if ((me() || {}).previewModerator) return true;
    if (r.targetType === 'post') return isModOf((post(r.targetId) || {}).community);
    if (r.targetType === 'comment') { const c = db.comments.find((x) => x.id === r.targetId); return c && isModOf((post(c.post) || {}).community); }
    return false;
  };
  return db.reports.filter((r) => r.status === 'open' && mine(r)).sort((a, b) => a.createdAt - b.createdAt);
}
export function resolveReport(id, action) {
  const r = db.reports.find((x) => x.id === id); if (!r) return;
  const all = db.reports.filter((x) => x.targetId === r.targetId && x.status === 'open');
  if (action === 'remove') {
    if (r.targetType === 'post') { const p = post(r.targetId); if (p) p.removed = true; }
    if (r.targetType === 'comment') { const c = db.comments.find((x) => x.id === r.targetId); if (c) c.removed = true; }
    if (r.targetType === 'user') { const u = user(r.targetId); if (u) u.suspended = true; }
  } else {
    if (r.targetType === 'post') { const p = post(r.targetId); if (p) p.hiddenPendingReview = false; }
    if (r.targetType === 'comment') { const c = db.comments.find((x) => x.id === r.targetId); if (c) c.hiddenPendingReview = false; }
  }
  for (const x of all) { x.status = action === 'remove' ? 'actioned' : 'dismissed'; x.resolvedBy = db.me; x.resolvedAt = now(); }
  save();
}
export function setPreviewModerator(on) { me().previewModerator = !!on; save(); }

/* ── notifications: only things a person did, or things you asked for ── */
function notify(to, type, data) {
  const u = user(to); if (!u || u.team) return;
  const p = prefs(to);
  const gate = { reply: 'replies', follow: 'follows', like: 'replies', community: 'community', event: 'events' }[type];
  if (gate && p.notify && p.notify[gate] === false) return;
  if (data.aggregate) {
    const ex = db.notifications.find((n) => n.user === to && n.type === type && n.post === data.post && !n.read);
    if (ex) { if (!ex.actors.includes(data.actor)) ex.actors.push(data.actor); ex.createdAt = now(); return; }
  }
  db.notifications.push({ id: uid('n'), user: to, type, actor: data.actor || null, actors: data.actor ? [data.actor] : [], post: data.post || null, community: data.community || null, text: data.text || null, createdAt: now(), read: false });
}
/** Called once per visit: event reminders and a once-a-day digest of joined communities. */
export function digest() {
  const u = me(); if (!u) return;
  const p = prefs();
  const last = p.lastVisit || u.createdAt;
  const today = new Date().toISOString().slice(0, 10);
  if (p.digestDay !== today && p.notify.community) {
    for (const cid of joined()) {
      const n = db.posts.filter((x) => x.community === cid && x.createdAt > last && x.author !== u.id && !x.removed).length;
      if (n >= 2) notify(u.id, 'community', { community: cid, text: `${n} new posts in ${community(cid).name} since your last visit` });
    }
    p.digestDay = today;
  }
  for (const r of db.rsvps.filter((x) => x.user === u.id)) {
    const ev = post(r.post); if (!ev || !ev.event) continue;
    const at = new Date(ev.event.date + 'T' + (ev.event.time || '09:00')).getTime();
    if (at > now() && at - now() < DAY && !db.notifications.some((n) => n.user === u.id && n.type === 'event' && n.post === ev.id)) {
      notify(u.id, 'event', { post: ev.id, text: `Tomorrow-ish: ${ev.event.title}` });
    }
  }
  p.lastVisit = now(); save();
}
export const notifications = () => db.notifications.filter((n) => n.user === db.me).sort((a, b) => b.createdAt - a.createdAt);
export const unreadCount = () => db.notifications.filter((n) => n.user === db.me && !n.read).length;
export function markRead() { for (const n of notifications()) n.read = true; save(); }
export function setNotify(k, v) { prefs().notify[k] = !!v; save(); }

/* ── invitations: a few, personal, optionally into a community ── */
export function createInvite(cid = null) {
  if (!allow('invite')) throw new Error('You have used your 5 invitations for this month.');
  const code = Math.random().toString(36).slice(2, 6).toUpperCase() + Math.random().toString(36).slice(2, 6).toUpperCase();
  db.invites.push({ code, from: db.me, community: cid, createdAt: now(), usedBy: null });
  track('invite_created', { community: !!cid }); save();
  return code;
}
export const myInvites = () => db.invites.filter((i) => i.from === db.me).sort((a, b) => b.createdAt - a.createdAt);
export const invite = (code) => db.invites.find((i) => i.code === code);

export function requestCommunity({ name, why }) {
  name = String(name || '').trim().slice(0, 50);
  if (name.length < 3) throw new Error('Give the community a name.');
  db.communityRequests.push({ id: uid('cr'), by: db.me, name, why: String(why || '').slice(0, 300), createdAt: now(), status: 'open' });
  track('community_request'); save();
}

/* ── feed ────────────────────────────────────────────────── */
function engagementIndex() {
  const e = {};
  for (const r of db.reactions) (e[r.post] || (e[r.post] = { likes: 0, comments: 0 })).likes++;
  for (const c of db.comments) if (!c.removed) (e[c.post] || (e[c.post] = { likes: 0, comments: 0 })).comments++;
  return e;
}
function interactionIndex(uid_) {
  const out = {};
  const pa = Object.fromEntries(db.posts.map((p) => [p.id, p.author]));
  for (const r of db.reactions) if (r.user === uid_) out[pa[r.post]] = (out[pa[r.post]] || 0) + 1;
  for (const c of db.comments) if (c.author === uid_) out[pa[c.post]] = (out[pa[c.post]] || 0) + 2;
  return out;
}
export function feedContext(overridePrefs) {
  const u = me();
  const blocked = new Set(db.blocks.filter((b) => b.from === u.id || b.to === u.id).map((b) => (b.from === u.id ? b.to : b.from)));
  for (const s of db.users.filter((x) => x.suspended)) blocked.add(s.id);
  return {
    viewer: u, prefs: overridePrefs || prefs(), now: now(),
    posts: db.posts.filter((p) => !p.hiddenPendingReview || p.author === u.id),
    following: new Set(following()), joined: new Set(joined()), blocked,
    privateAuthors: new Set(db.users.filter((x) => x.private).map((x) => x.id)),
    engagement: engagementIndex(), interactions: interactionIndex(u.id), parentOf,
    names: { user: (id) => (user(id) || {}).name || 'someone', community: (id) => (community(id) || {}).name || 'a community', area: areaName }
  };
}
export function feed(mode) {
  const ctx = feedContext();
  if (mode) ctx.prefs = { ...ctx.prefs, mode };
  return buildFeed(ctx);
}
/** Posts for a community/profile page — chronological, still respecting blocks and mutes of people. */
export function listPosts(filter) {
  const u = me();
  const pr = prefs();
  return db.posts.filter((p) => !p.removed && (!p.hiddenPendingReview || p.author === u.id) && filter(p)
    && !isBlocked(u.id, p.author) && !pr.mute.users.includes(p.author) && !(user(p.author) || {}).suspended
    && (!(user(p.author) || {}).private || p.author === u.id || isFollowing(p.author)))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/* ── search: plain substring matching. No AI. ─────────────── */
export function search(q) {
  q = String(q || '').trim().toLowerCase();
  if (q.length < 2) return { people: [], communities: [], topics: [], posts: [] };
  const has = (s) => String(s || '').toLowerCase().includes(q);
  return {
    people: db.users.filter((u) => !u.suspended && (u.discoverable !== false || u.id === db.me) && !isBlocked(db.me, u.id) && (has(u.name) || has(u.handle))).slice(0, 10),
    communities: db.communities.filter((c) => has(c.name) || has(c.description) || c.topics.some(has)).slice(0, 10),
    topics: Object.keys(engagementTopics()).filter(has).slice(0, 8),
    posts: listPosts((p) => has(p.text) || (p.event && has(p.event.title))).slice(0, 20)
  };
}
function engagementTopics() { const o = {}; for (const p of db.posts) for (const t of p.topics || []) o[t] = (o[t] || 0) + 1; return o; }
export const topicCounts = engagementTopics;

/* ── suggestions ─────────────────────────────────────────── */
export function suggestedCommunities(u = me()) {
  const ints = new Set(u.interests || []);
  return db.communities.map((c) => {
    let s = c.topics.filter((t) => ints.has(t)).length * 2;
    if (c.area && u.area && (c.area === u.area || c.area === parentOf(u.area))) s += 3;
    return { c, s };
  }).filter((x) => x.s > 0 && !isMember(x.c.id)).sort((a, b) => b.s - a.s).map((x) => x.c);
}
export function suggestedPeople(u = me()) {
  const mine = new Set(joined()), ints = new Set(u.interests || []);
  return db.users.filter((x) => x.id !== u.id && !x.suspended && x.discoverable !== false && !isFollowing(x.id) && !isBlocked(u.id, x.id))
    .map((x) => {
      let s = 0, why = [];
      const shared = joined(x.id).filter((c) => mine.has(c));
      if (shared.length) { s += shared.length * 2; why.push(`Also in ${community(shared[0]).name}`); }
      const si = (x.interests || []).filter((t) => ints.has(t));
      if (si.length) { s += si.length; why.push(`Into ${si.slice(0, 2).join(', ')}`); }
      if (x.area && u.area && parentOf(x.area) === parentOf(u.area) && x.showArea) { s += 1; why.push('Near you'); }
      if (x.id === u.invitedBy) { s += 10; why.unshift('Invited you'); }
      if (x.team) { s += 0.5; if (!why.length) why.push('Team account — starter posts and updates'); }
      return { u: x, s, why: why[0] || 'New on RipeStream' };
    }).sort((a, b) => b.s - a.s);
}

/* ── your data ───────────────────────────────────────────── */
export function exportData() {
  const id = db.me;
  return {
    exportedAt: new Date().toISOString(), note: 'Everything RipeStream holds about you in this preview.',
    profile: me(), preferences: prefs(),
    following: following().map((x) => user(x).handle), followers: followers(id).map((x) => (user(x) || {}).handle),
    communities: joined().map((c) => community(c).name),
    posts: db.posts.filter((p) => p.author === id), comments: db.comments.filter((c) => c.author === id),
    likes: db.reactions.filter((r) => r.user === id), rsvps: db.rsvps.filter((r) => r.user === id),
    blocks: blockedByMe().map((x) => (user(x) || {}).handle), reportsYouMade: db.reports.filter((r) => r.reporter === id),
    invites: myInvites(), activityLog: db.analytics.filter((a) => a.u === id)
  };
}
export function deleteAccount() {
  const id = db.me;
  const myPosts = new Set(db.posts.filter((p) => p.author === id).map((p) => p.id));
  db.posts = db.posts.filter((p) => p.author !== id);
  db.comments = db.comments.filter((c) => c.author !== id && !myPosts.has(c.post));
  db.reactions = db.reactions.filter((r) => r.user !== id && !myPosts.has(r.post));
  db.follows = db.follows.filter((f) => f.from !== id && f.to !== id);
  db.memberships = db.memberships.filter((m) => m.user !== id);
  db.rsvps = db.rsvps.filter((r) => r.user !== id);
  db.blocks = db.blocks.filter((b) => b.from !== id && b.to !== id);
  db.notifications = db.notifications.filter((n) => n.user !== id);
  db.analytics = db.analytics.filter((a) => a.u !== id);
  delete db.prefs[id]; delete db.sessions[id];
  db.users = db.users.filter((u) => u.id !== id);
  db.me = null; save();
}
export function wipePreview() { try { localStorage.removeItem(KEY); } catch {} db = fresh(); save(); }

/* ── network health (the metrics that matter, not page views) ── */
export function health() {
  const people = accounts();
  const ev = db.analytics;
  const did = (u, n) => ev.some((e) => e.u === u.id && e.name === n);
  const activated = people.filter((u) => (u.interests || []).length && did(u, 'follow') && did(u, 'join_community'));
  const posters = people.filter((u) => db.posts.some((p) => p.author === u.id));
  const days = (u) => db.sessions[u.id] || [];
  const ret = (u, d) => { const start = new Date(u.createdAt).toISOString().slice(0, 10); const t = new Date(new Date(start).getTime() + d * DAY).toISOString().slice(0, 10); return days(u).some((x) => x >= t); };
  const realPosts = db.posts.filter((p) => !p.starter && !p.removed);
  const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0);
  return {
    accounts: people.length,
    activation: {
      choseInterests: pct(people.filter((u) => (u.interests || []).length).length, people.length),
      followedSomeone: pct(people.filter((u) => did(u, 'follow')).length, people.length),
      joinedCommunity: pct(people.filter((u) => did(u, 'join_community')).length, people.length),
      posted: pct(posters.length, people.length),
      fullyActivated: pct(activated.length, people.length)
    },
    retention: { d1: pct(people.filter((u) => ret(u, 1)).length, people.length), d7: pct(people.filter((u) => ret(u, 7)).length, people.length), d30: pct(people.filter((u) => ret(u, 30)).length, people.length) },
    network: {
      postsPerActiveUser: posters.length ? (realPosts.length / posters.length).toFixed(1) : '0',
      commentsPerPost: realPosts.length ? (db.comments.filter((c) => !c.removed).length / realPosts.length).toFixed(1) : '0',
      memberPosts: realPosts.length, starterPosts: db.posts.filter((p) => p.starter).length,
      activeCommunities: new Set(realPosts.filter((p) => p.community && Date.now() - p.createdAt < 7 * DAY).map((p) => p.community)).size,
      openReports: db.reports.filter((r) => r.status === 'open').length,
      communityRequests: db.communityRequests.length
    }
  };
}
