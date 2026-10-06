/* RipeStream feed ranking — pure, deterministic, no I/O, no AI.
 *
 * Every post that reaches a feed carries:
 *   source   — which slot of the user's mix it filled (following | communities | local | discover | own)
 *   factors  — every input to its score, with the value and the weight used
 *   reasons  — the same thing in plain language ("You follow Aoife")
 *
 * The score is a weighted sum. Nothing is hidden: the "Why am I seeing this?"
 * panel renders `factors` directly. The engine is replaceable — anything that
 * returns the same item shape can sit behind feed.js.
 */

export const DEFAULT_MIX = { following: 60, communities: 25, local: 10, discover: 5 };
export const MODES = ['mix', 'following', 'communities', 'local', 'discover'];

export const WEIGHTS = {
  follow: 0.35,       // you follow the author
  community: 0.25,    // you joined the community it was posted in
  interest: 0.20,     // matches topics you picked (or engaged with)
  local: 0.15,        // posted in / about your area
  interaction: 0.15,  // you've liked or replied to this author before
  popularity: 0.10,   // likes + replies, log-scaled so nothing runs away
  base: 0.05          // so brand-new posts with no signal still get a chance
};
export const HALF_LIFE_HOURS = 18;
const PREF_STEP = 1.6;   // "more of this" multiplies by this, "less" divides

export const FACTOR_LABELS = {
  follow: 'You follow the author',
  community: 'From a community you joined',
  interest: 'Matches your interests',
  local: 'Near your area',
  interaction: "You've engaged with this author",
  popularity: 'Popular with others',
  base: 'Baseline (every post gets a small chance)',
  recency: 'Freshness',
  preference: 'Your "more / less" settings'
};

/** Locality relevance: same area 1, same county 0.6, otherwise 0. */
export function localScore(viewerArea, postArea, parentOf) {
  if (!viewerArea || !postArea) return 0;
  if (viewerArea === postArea) return 1;
  const vp = parentOf(viewerArea) || viewerArea;
  const pp = parentOf(postArea) || postArea;
  return vp === pp ? 0.6 : 0;
}

export function recency(createdAt, now) {
  const hours = Math.max(0, (now - createdAt) / 36e5);
  return Math.pow(0.5, hours / HALF_LIFE_HOURS);
}

function prefMultiplier(prefs, post) {
  let m = 1;
  const notes = [];
  const adj = (bag, key, label) => {
    const v = (bag && bag[key]) || 0;            // -2…+2 steps
    if (v) { m *= Math.pow(PREF_STEP, v); notes.push(`${v > 0 ? 'More' : 'Less'} ${label}`); }
  };
  for (const t of post.topics || []) adj(prefs.adjust?.topic, t, `#${t}`);
  if (post.community) adj(prefs.adjust?.community, post.community, 'from this community');
  adj(prefs.adjust?.author, post.author, 'from this person');
  if (post.kind) adj(prefs.adjust?.kind, post.kind, `${post.kind}s`);
  return { m, notes };
}

/**
 * ctx = {
 *   viewer: { id, area, interests: [] },
 *   prefs: { mode, mix, adjust:{topic,community,author,kind}, mute:{users,communities,topics}, notInterested:[], inferred:{topic:n} },
 *   posts: [{ id, author, community, area, topics, kind, createdAt, removed }],
 *   following: Set(userId), joined: Set(communityId), blocked: Set(userId) (both directions),
 *   privateAuthors: Set(userId), engagement: { [postId]: { likes, comments } },
 *   interactions: { [authorId]: count }, parentOf: (areaId)=>parentId|null,
 *   names: { user:(id)=>name, community:(id)=>name, area:(id)=>name }, now
 * }
 */
export function scorePosts(ctx) {
  const { viewer, prefs, now } = ctx;
  const mute = prefs.mute || {};
  const mutedUsers = new Set(mute.users || []);
  const mutedComms = new Set(mute.communities || []);
  const mutedTopics = new Set(mute.topics || []);
  const hidden = new Set(prefs.notInterested || []);
  const explicit = new Set(viewer.interests || []);
  const inferred = prefs.inferred || {};
  const names = ctx.names || { user: (x) => x, community: (x) => x, area: (x) => x };
  const out = [];

  for (const p of ctx.posts) {
    if (p.removed) continue;
    const own = p.author === viewer.id;
    if (!own) {
      if (ctx.blocked.has(p.author) || mutedUsers.has(p.author)) continue;
      if (p.community && mutedComms.has(p.community)) continue;
      if ((p.topics || []).some((t) => mutedTopics.has(t))) continue;
      if (hidden.has(p.id)) continue;
      if (ctx.privateAuthors.has(p.author) && !ctx.following.has(p.author)) continue;
    }

    const follow = ctx.following.has(p.author) ? 1 : 0;
    const community = p.community && ctx.joined.has(p.community) ? 1 : 0;
    let interest = 0, interestTopic = null;
    for (const t of p.topics || []) {
      const v = Math.min(1, (explicit.has(t) ? 1 : 0) + Math.min(0.6, (inferred[t] || 0) * 0.15));
      if (v > interest) { interest = v; interestTopic = t; }
    }
    const local = localScore(viewer.area, p.area, ctx.parentOf);
    const interaction = Math.min(1, (ctx.interactions[p.author] || 0) / 4);
    const e = ctx.engagement[p.id] || { likes: 0, comments: 0 };
    const popularity = Math.min(1, Math.log1p(e.likes + 2 * e.comments) / Math.log(40));
    const fresh = recency(p.createdAt, now);
    const pref = prefMultiplier(prefs, p);

    const raw = { follow, community, interest, local, interaction, popularity, base: 1 };
    const factors = {};
    let sum = 0;
    for (const k of Object.keys(WEIGHTS)) {
      const c = raw[k] * WEIGHTS[k];
      factors[k] = { value: raw[k], weight: WEIGHTS[k], contribution: c };
      sum += c;
    }
    factors.recency = { value: fresh, multiplier: true };
    factors.preference = { value: pref.m, multiplier: true, notes: pref.notes };
    const score = sum * fresh * pref.m;

    let source;
    if (own) source = 'own';
    else if (follow) source = 'following';
    else if (community) source = 'communities';
    else if (local > 0) source = 'local';
    else source = 'discover';

    const reasons = [];
    if (own) reasons.push('Your post');
    if (follow) reasons.push(`You follow ${names.user(p.author)}`);
    if (community) reasons.push(`You joined ${names.community(p.community)}`);
    if (local === 1) reasons.push(`Posted in ${names.area(p.area)}, your area`);
    else if (local > 0) reasons.push(`Posted nearby, in ${names.area(p.area)}`);
    if (interest && interestTopic) {
      reasons.push(explicit.has(interestTopic)
        ? `Matches your interest: ${interestTopic}`
        : `You've engaged with posts about ${interestTopic}`);
    }
    if (interaction >= 0.25) reasons.push(`You've liked or replied to ${names.user(p.author)} before`);
    if (popularity >= 0.5) reasons.push('Getting a lot of replies and likes');
    for (const n of pref.notes) reasons.push(`Your setting: ${n.toLowerCase()}`);
    if (!reasons.length) reasons.push('New post, recommended to help you discover');

    out.push({ post: p, score, source, local, factors, reasons, recommended: source !== 'own' && source !== 'following' });
  }
  return out;
}

/** Interleave buckets by the user's mix. Empty buckets give their share away — and we say so. */
export function mixBuckets(items, mix) {
  const order = ['following', 'communities', 'local', 'discover'];
  const buckets = Object.fromEntries(order.map((k) => [k, []]));
  const own = [];
  for (const it of items) (it.source === 'own' ? own : buckets[it.source]).push(it);
  for (const k of order) buckets[k].sort((a, b) => b.score - a.score);

  const total = order.reduce((s, k) => s + Math.max(0, mix[k] || 0), 0) || 1;
  const share = Object.fromEntries(order.map((k) => [k, Math.max(0, mix[k] || 0) / total]));
  const taken = Object.fromEntries(order.map((k) => [k, 0]));
  const result = [];
  const n = items.length - own.length;

  // Your own recent posts (last 24h) pin to the top so you see they landed.
  own.sort((a, b) => b.post.createdAt - a.post.createdAt);
  const freshOwn = own.filter((o) => o.factors.recency.value > 0.4);
  result.push(...freshOwn);

  for (let i = 0; i < n; i++) {
    let best = null, bestDeficit = -Infinity;
    for (const k of order) {
      if (!buckets[k].length || share[k] === 0) continue;
      const deficit = share[k] * (i + 1) - taken[k];
      if (deficit > bestDeficit) { bestDeficit = deficit; best = k; }
    }
    if (!best) break;                 // every slot the user wants is empty
    taken[best]++;
    result.push(buckets[best].shift());
  }
  const shortfall = order.filter((k) => share[k] > 0 && taken[k] === 0);
  return { items: result, shortfall };
}

/** One call for the UI. Returns { items, shortfall, mode }. */
export function buildFeed(ctx) {
  const mode = MODES.includes(ctx.prefs.mode) ? ctx.prefs.mode : 'mix';
  const scored = scorePosts(ctx);
  const byScore = (a, b) => b.score - a.score;
  switch (mode) {
    case 'following':
      return { mode, shortfall: [], items: scored.filter((x) => x.source === 'following' || x.source === 'own')
        .sort((a, b) => b.post.createdAt - a.post.createdAt) };   // pure chronological
    case 'communities':
      return { mode, shortfall: [], items: scored.filter((x) => x.factors.community.value === 1 || (x.source === 'own' && x.post.community)).sort(byScore) };
    case 'local':
      return { mode, shortfall: [], items: scored.filter((x) => x.local > 0).sort(byScore) };
    case 'discover':
      return { mode, shortfall: [], items: scored.filter((x) => x.source === 'discover' || x.source === 'local').sort(byScore) };
    default: {
      const r = mixBuckets(scored, { ...DEFAULT_MIX, ...(ctx.prefs.mix || {}) });
      return { mode, ...r };
    }
  }
}

/* ── lightweight topic detection (keyword rules, no model) ───────────── */
export const TOPIC_KEYWORDS = {
  technology: ['tech', 'software', 'laptop', 'phone', 'code', 'coding', 'ai ', 'computer', 'app', 'startup', 'server', 'linux', 'windows'],
  cars: ['car ', 'cars', 'nct', 'diesel', 'petrol', 'ev ', 'tyre', 'tyres', 'engine', 'mechanic', 'garage', 'motor'],
  fitness: ['gym', 'workout', 'lifting', 'deadlift', 'squat', 'protein', 'fitness', 'training'],
  running: ['run ', 'running', 'parkrun', '5k', '10k', 'marathon', 'jog'],
  football: ['football', 'soccer', 'league of ireland', 'premier league', 'match', 'goal', 'shamrock rovers', 'bohs'],
  gaa: ['gaa', 'hurling', 'camogie', 'gaelic', 'all-ireland', 'sliotar'],
  cycling: ['cycle', 'cycling', 'bike', 'bikes', 'greenway', 'cyclist'],
  gaming: ['game', 'gaming', 'xbox', 'playstation', 'ps5', 'nintendo', 'switch', 'steam'],
  food: ['food', 'restaurant', 'cafe', 'café', 'coffee', 'recipe', 'pizza', 'brunch', 'chipper', 'bakery'],
  travel: ['travel', 'flight', 'ryanair', 'aer lingus', 'holiday', 'trip', 'airport'],
  music: ['music', 'gig', 'band', 'album', 'concert', 'trad', 'session', 'vinyl'],
  photography: ['photo', 'camera', 'film', 'lens', 'photography', 'shot'],
  diy: ['diy', 'drill', 'paint', 'renovation', 'garden', 'shed', 'fix'],
  parenting: ['kids', 'baby', 'toddler', 'parent', 'school run', 'creche', 'childcare'],
  careers: ['job', 'jobs', 'career', 'cv', 'interview', 'salary', 'hiring'],
  business: ['business', 'shop', 'small business', 'opening', 'customers', 'invoice'],
  transport: ['bus', 'luas', 'dart', 'traffic', 'road', 'roadworks', 'm50', 'train', 'irish rail', 'dublin bus'],
  outdoors: ['hike', 'hiking', 'walk', 'swim', 'sea swim', 'beach', 'mountain', 'trail']
};

export function detectTopics(text, limit = 3) {
  const t = ` ${String(text || '').toLowerCase()} `;
  const hits = [];
  for (const [topic, words] of Object.entries(TOPIC_KEYWORDS)) {
    let n = 0;
    for (const w of words) if (t.includes(w)) n++;
    if (n) hits.push([topic, n]);
  }
  return hits.sort((a, b) => b[1] - a[1]).slice(0, limit).map((h) => h[0]);
}
