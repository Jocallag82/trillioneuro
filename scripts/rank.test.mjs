import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scorePosts, buildFeed, mixBuckets, detectTopics, localScore, DEFAULT_MIX } from '../ripestream/app/js/rank.js';

const now = Date.UTC(2026, 9, 6, 12);
const parentOf = (a) => ({ clondalkin: 'dublin', tallaght: 'dublin', 'cork-city': 'cork' }[a] || null);
const P = (id, o) => ({ id, author: 'x', community: null, area: null, topics: [], createdAt: now - 36e5, ...o });
function ctx(posts, o = {}) {
  return {
    viewer: { id: 'me', area: 'clondalkin', interests: ['running'] },
    prefs: { mode: 'mix', mix: DEFAULT_MIX, adjust: {}, mute: { users: [], communities: [], topics: [] }, notInterested: [], inferred: {}, ...(o.prefs || {}) },
    posts, following: new Set(o.following || ['friend']), joined: new Set(o.joined || ['c-run']), blocked: new Set(o.blocked || []),
    privateAuthors: new Set(o.private || []), engagement: {}, interactions: {}, parentOf, now
  };
}

test('every item explains itself, and factors sum to the score', () => {
  const [it] = scorePosts(ctx([P('a', { author: 'friend', community: 'c-run', topics: ['running'] })]));
  assert.equal(it.source, 'following');
  assert.ok(it.reasons.length >= 2);
  const sum = Object.values(it.factors).filter((f) => !f.multiplier).reduce((s, f) => s + f.contribution, 0);
  assert.ok(Math.abs(sum * it.factors.recency.value * it.factors.preference.value - it.score) < 1e-12);
});

test('mutes, blocks, not-interested and private accounts are hard filters', () => {
  const posts = [P('m', { author: 'muted' }), P('b', { author: 'blk' }), P('t', { topics: ['cars'] }), P('n'), P('p', { author: 'priv' }), P('ok')];
  const out = scorePosts(ctx(posts, { blocked: ['blk'], private: ['priv'], prefs: { mute: { users: ['muted'], communities: [], topics: ['cars'] }, notInterested: ['n'] } }));
  assert.deepEqual(out.map((x) => x.post.id), ['ok']);
});

test('locality: same area 1, same county 0.6, elsewhere 0', () => {
  assert.equal(localScore('clondalkin', 'clondalkin', parentOf), 1);
  assert.equal(localScore('clondalkin', 'tallaght', parentOf), 0.6);
  assert.equal(localScore('clondalkin', 'cork-city', parentOf), 0);
});

test('"less of this" lowers a score, "more" raises it', () => {
  const base = scorePosts(ctx([P('a', { topics: ['running'] })]))[0].score;
  const less = scorePosts(ctx([P('a', { topics: ['running'] })], { prefs: { adjust: { topic: { running: -1 } } } }))[0].score;
  const more = scorePosts(ctx([P('a', { topics: ['running'] })], { prefs: { adjust: { topic: { running: 1 } } } }))[0].score;
  assert.ok(less < base && base < more);
});

test('following mode is chronological and only followed authors', () => {
  const r = buildFeed({ ...ctx([P('old', { author: 'friend', createdAt: now - 9e6 }), P('new', { author: 'friend', createdAt: now - 1e3 }), P('x')]), prefs: { ...ctx([]).prefs, mode: 'following' } });
  assert.deepEqual(r.items.map((x) => x.post.id), ['new', 'old']);
});

test('mix respects shares and reports empty slots', () => {
  const items = [];
  for (let i = 0; i < 10; i++) items.push({ source: 'following', score: 1, post: {}, factors: { recency: { value: 1 } } });
  for (let i = 0; i < 10; i++) items.push({ source: 'communities', score: 1, post: {}, factors: { recency: { value: 1 } } });
  const r = mixBuckets(items, { following: 50, communities: 50, local: 0, discover: 0 });
  const first10 = r.items.slice(0, 10).map((x) => x.source);
  assert.equal(first10.filter((s) => s === 'following').length, 5);
  const r2 = mixBuckets(items, DEFAULT_MIX);
  assert.deepEqual(r2.shortfall.sort(), ['discover', 'local']);
});

test('topic detection is keyword-based and bounded', () => {
  assert.deepEqual(detectTopics('Luas delays and roadworks on the M50'), ['transport']);
  assert.ok(detectTopics('parkrun 5k then a gym session').includes('running'));
  assert.equal(detectTopics('').length, 0);
});
