/* RipeStream app UI — hash router, views, one delegated click handler. */
import * as S from './store.js';
import { TOPICS, TOPIC_NAME, AREAS, AREA, parentOf } from './seed.js';
import { WEIGHTS, FACTOR_LABELS, DEFAULT_MIX, HALF_LIFE_HOURS, detectTopics, scorePosts } from './rank.js';

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const PAGE = 15;
let shown = PAGE;

/* ── helpers ─────────────────────────────────────────────── */
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
function ago(t) {
  const s = Math.max(1, (Date.now() - t) / 1000);
  if (s < 60) return 'now';
  if (s < 3600) return Math.floor(s / 60) + 'm';
  if (s < 86400) return Math.floor(s / 3600) + 'h';
  if (s < 604800) return Math.floor(s / 86400) + 'd';
  return new Date(t).toLocaleDateString('en-IE', { day: 'numeric', month: 'short' });
}
const initials = (n) => String(n || '?').split(/\s+/).map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const avatar = (u, size = 40) => `<span class="av" style="--s:${size}px;background:${esc(u?.color || '#888')}" aria-hidden="true">${esc(initials(u?.name))}</span>`;
const teamBadge = (u) => (u && u.team ? '<span class="badge team" title="Run by the RipeStream team">Team</span>' : '');
const topicName = (t) => TOPIC_NAME[t] || t;
const fmtDate = (d) => new Date(d + 'T12:00').toLocaleDateString('en-IE', { weekday: 'short', day: 'numeric', month: 'short' });
const icon = (n) => `<svg class="i" aria-hidden="true"><use href="#i-${n}"/></svg>`;

export function toast(msg, undo) {
  const t = $('#toast');
  t.innerHTML = esc(msg) + (undo ? ' <button type="button" class="link" data-act="undo">Undo</button>' : '');
  t.hidden = false; t._undo = undo;
  clearTimeout(t._h); t._h = setTimeout(() => { t.hidden = true; }, undo ? 6000 : 3200);
}
function guard(fn) { try { return fn(); } catch (e) { toast(e.message || 'Something went wrong.'); return null; } }

function sheet(html, label) {
  const d = $('#sheet');
  $('#sheet-body').innerHTML = html;
  d.setAttribute('aria-label', label || 'Dialog');
  if (!d.open) d.showModal();
  const f = $('[autofocus]', d) || $('button, a, input, select, textarea', $('#sheet-body'));
  if (f) f.focus();
}
const closeSheet = () => { const d = $('#sheet'); if (d.open) d.close(); };

/* ── post card ───────────────────────────────────────────── */
function postCard(p, item) {
  const a = S.user(p.author) || { name: 'Deleted account' };
  const c = p.community ? S.community(p.community) : null;
  const n = S.commentCount(p.id), l = S.likes(p.id);
  const rec = item && item.recommended;
  const why = item ? `<button class="why ${rec ? 'rec' : ''}" type="button" data-act="why" data-id="${p.id}" aria-label="Why am I seeing this post?">${icon('info')}<span>${esc(item.reasons[0])}</span></button>` : '';
  const ev = p.event ? `<div class="event"><div class="ev-date"><b>${esc(new Date(p.event.date + 'T12:00').getDate())}</b><span>${esc(new Date(p.event.date + 'T12:00').toLocaleDateString('en-IE', { month: 'short' }))}</span></div>
    <div class="ev-body"><b>${esc(p.event.title)}</b><span>${esc(fmtDate(p.event.date))}${p.event.time ? ' · ' + esc(p.event.time) : ''}${p.event.place ? ' · ' + esc(p.event.place) : ''}</span><span class="muted">${S.rsvps(p.id)} going · organised by ${esc(a.name)}</span></div>
    <button class="btn sm ${S.going(p.id) ? 'on' : ''}" type="button" data-act="rsvp" data-id="${p.id}" aria-pressed="${S.going(p.id)}">${S.going(p.id) ? 'Going ✓' : 'Going?'}</button></div>` : '';
  return `<article class="post${p.hiddenPendingReview ? ' held' : ''}" data-post="${p.id}">
    ${why}
    <header class="ph">
      <a href="#/u/${esc(a.handle)}" class="ph-av">${avatar(a)}</a>
      <div class="ph-meta">
        <div class="ph-line"><a class="name" href="#/u/${esc(a.handle)}">${esc(a.name)}</a>${teamBadge(a)}${p.starter ? '<span class="badge starter" title="Written by the RipeStream team to start the conversation">Starter</span>' : ''}${p.kind === 'question' ? '<span class="badge q">Question</span>' : ''}</div>
        <div class="ph-sub">${c ? `<a href="#/c/${c.id}">${esc(c.emoji)} ${esc(c.name)}</a> · ` : ''}${p.area && !(c && c.area === p.area) ? `<span>📍 ${esc(S.areaName(p.area))}</span> · ` : ''}<a href="#/p/${p.id}" class="muted"><time datetime="${new Date(p.createdAt).toISOString()}">${ago(p.createdAt)}</time></a></div>
      </div>
      <button class="icon-btn" type="button" data-act="menu" data-id="${p.id}" aria-label="Post options">${icon('more')}</button>
    </header>
    ${p.hiddenPendingReview ? '<p class="note">Hidden from others while a moderator reviews reports.</p>' : ''}
    ${p.text ? `<div class="pt">${esc(p.text).replace(/\n/g, '<br>')}</div>` : ''}
    ${p.image ? `<img class="pimg" src="${p.image}" alt="Photo posted by ${esc(a.name)}" loading="lazy" decoding="async">` : ''}
    ${ev}
    ${(p.topics || []).length ? `<div class="tags">${p.topics.map((t) => `<a href="#/t/${t}">#${esc(topicName(t))}</a>`).join('')}</div>` : ''}
    <footer class="pa">
      <button type="button" class="act ${S.liked(p.id) ? 'on' : ''}" data-act="like" data-id="${p.id}" aria-pressed="${S.liked(p.id)}" aria-label="Like (${l})">${icon('heart')}<span>${l || ''}</span></button>
      <a class="act" href="#/p/${p.id}" aria-label="Replies (${n})">${icon('reply')}<span>${n || ''}</span></a>
      <button type="button" class="act" data-act="share" data-id="${p.id}" aria-label="Share">${icon('share')}</button>
      ${item ? '' : `<button type="button" class="act" data-act="why" data-id="${p.id}" aria-label="Why would I see this?">${icon('info')}</button>`}
    </footer>
  </article>`;
}

/* ── "Why am I seeing this?" ─────────────────────────────── */
function whySheet(id) {
  const p = S.post(id);
  const ctx = S.feedContext();
  const item = scorePosts({ ...ctx, posts: [p] })[0];
  if (!item) return sheet('<h2>Hidden by your settings</h2><p>You have muted or blocked something about this post, so it won\'t appear in your feed.</p><button class="btn" data-act="close">Close</button>');
  const pr = S.prefs();
  const mix = { ...DEFAULT_MIX, ...pr.mix };
  const slot = { following: 'Following', communities: 'Communities', local: 'Local', discover: 'Discovery', own: 'Your posts' }[item.source];
  const max = Object.values(item.factors).filter((f) => !f.multiplier).reduce((m, f) => Math.max(m, f.contribution), 0.0001);
  const rows = Object.entries(item.factors).filter(([, f]) => !f.multiplier).map(([k, f]) =>
    `<tr class="${f.contribution > 0.0001 && k !== 'base' ? 'hit' : ''}"><th scope="row">${esc(FACTOR_LABELS[k])}</th><td><span class="bar"><i style="width:${Math.round((f.contribution / max) * 100)}%"></i></span></td><td class="num">${f.contribution.toFixed(2)}</td></tr>`).join('');
  const topic = (p.topics || [])[0];
  sheet(`<h2 id="why-title">Why you're seeing this</h2>
    <ul class="reasons">${item.reasons.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    <p class="slot">It filled a <b>${esc(slot)}</b> slot${item.source !== 'own' && pr.mode === 'mix' ? ` — ${mix[item.source] ?? 0}% of your mix` : ''}.</p>
    <details class="score"><summary>See the full score</summary>
      <table><tbody>${rows}</tbody></table>
      <p class="muted small">× freshness ${item.factors.recency.value.toFixed(2)} (halves every ${HALF_LIFE_HOURS}h) × your settings ${item.factors.preference.value.toFixed(2)} = <b>${item.score.toFixed(3)}</b>. This is the whole formula. <a href="#/how" data-act="close">How ranking works</a></p>
    </details>
    <h3>Change it</h3>
    <div class="chips">
      ${topic ? `<button class="chip" data-act="adj" data-k="topic" data-v="${topic}" data-d="1">More #${esc(topicName(topic))}</button><button class="chip" data-act="adj" data-k="topic" data-v="${topic}" data-d="-1">Less #${esc(topicName(topic))}</button>` : ''}
      ${p.community ? `<button class="chip" data-act="adj" data-k="community" data-v="${p.community}" data-d="1">More from ${esc(S.community(p.community).name)}</button><button class="chip" data-act="adj" data-k="community" data-v="${p.community}" data-d="-1">Less from ${esc(S.community(p.community).name)}</button>` : ''}
      ${p.author !== S.me().id ? `<button class="chip" data-act="adj" data-k="author" data-v="${p.author}" data-d="1">More from ${esc(S.user(p.author).name)}</button><button class="chip" data-act="adj" data-k="author" data-v="${p.author}" data-d="-1">Less from ${esc(S.user(p.author).name)}</button>` : ''}
    </div>
    <div class="row gap">
      ${p.author !== S.me().id ? `<button class="btn ghost sm" data-act="ni" data-id="${p.id}">Not interested in this post</button>` : ''}
      <a class="btn ghost sm" href="#/settings" data-act="close">Feed settings</a>
    </div>`, 'Why you\'re seeing this');
}

function menuSheet(id) {
  const p = S.post(id); const a = S.user(p.author); const mine = p.author === S.me().id;
  const c = p.community && S.community(p.community);
  const topic = (p.topics || [])[0];
  sheet(`<h2 class="sr">Post options</h2><div class="menu">
    ${mine ? `<button data-act="delpost" data-id="${id}" class="danger">Delete post</button>` : `
    <button data-act="ni" data-id="${id}">Not interested <small>Hide this post, show fewer like it</small></button>
    ${topic ? `<button data-act="adj" data-k="topic" data-v="${topic}" data-d="-1">See fewer #${esc(topicName(topic))}</button><button data-act="mute" data-k="topics" data-v="${topic}">Never show #${esc(topicName(topic))}</button>` : ''}
    ${c ? `<button data-act="mute" data-k="communities" data-v="${c.id}">Mute ${esc(c.name)} <small>Stays joined, leaves your feed</small></button>` : ''}
    <button data-act="mute" data-k="users" data-v="${a.id}">Mute ${esc(a.name)} <small>They won't know</small></button>
    <button data-act="block" data-v="${a.id}">Block ${esc(a.name)} <small>Neither of you sees or replies to the other</small></button>
    <button data-act="report" data-k="post" data-id="${id}" class="danger">Report post</button>`}
    <button data-act="copy" data-id="${id}">Copy link</button>
  </div>`, 'Post options');
}

function reportSheet(type, id) {
  sheet(`<h2>Report ${esc(type)}</h2><p class="muted">Reports go to a human moderator. The person you report isn't told who reported them.</p>
    <form data-form="report" data-k="${esc(type)}" data-id="${esc(id)}">
      <fieldset class="radios"><legend class="sr">Reason</legend>${S.REPORT_REASONS.map((r, i) => `<label><input type="radio" name="reason" value="${esc(r)}" ${i === 0 ? 'required' : ''}> ${esc(r)}</label>`).join('')}</fieldset>
      <label class="field">Anything a moderator should know? <span class="muted">Optional</span><textarea name="note" maxlength="500" rows="2"></textarea></label>
      <div class="row gap"><button class="btn" type="submit">Send report</button><button class="btn ghost" type="button" data-act="close">Cancel</button></div>
    </form>`, 'Report');
}

/* ── composer ────────────────────────────────────────────── */
let pendingImage = null;
function composer(opts = {}) {
  pendingImage = null;
  const u = S.me();
  const mine = S.joined().map(S.community);
  sheet(`<h2>New post</h2>
  <form data-form="post" class="composer">
    <div class="seg" role="radiogroup" aria-label="Post type">
      ${['post', 'question', 'event'].map((k) => `<label><input type="radio" name="kind" value="${k}" ${k === (opts.kind || 'post') ? 'checked' : ''}><span>${{ post: 'Post', question: 'Question', event: 'Event' }[k]}</span></label>`).join('')}
    </div>
    <label class="field"><span class="sr">What's happening?</span><textarea name="text" rows="4" maxlength="2000" placeholder="${opts.kind === 'question' ? 'Ask your community something…' : 'Share something with your people…'}" autofocus>${esc(opts.text || '')}</textarea></label>
    <div class="evf" ${opts.kind === 'event' ? '' : 'hidden'}>
      <label class="field">Event title<input name="ev_title" maxlength="80"></label>
      <div class="row gap"><label class="field">Date<input type="date" name="ev_date" min="${new Date().toISOString().slice(0, 10)}"></label><label class="field">Time<input type="time" name="ev_time"></label></div>
      <label class="field">Where <span class="muted">— a venue or area, never a home address</span><input name="ev_place" maxlength="80"></label>
    </div>
    <label class="field">Post to
      <select name="community"><option value="">My followers</option>${mine.map((c) => `<option value="${c.id}" ${opts.community === c.id ? 'selected' : ''}>${esc(c.emoji)} ${esc(c.name)}</option>`).join('')}</select>
    </label>
    ${u.area ? `<label class="check"><input type="checkbox" name="local" ${opts.local ? 'checked' : ''}> Show in Local for ${esc(S.areaName(u.area))} <span class="muted">(area name only)</span></label>` : ''}
    <div class="row between">
      <label class="btn ghost sm file">${icon('image')} Photo<input type="file" name="image" accept="image/*" hidden></label>
      <span class="muted small" data-topics></span>
    </div>
    <img class="preview" alt="" hidden>
    <div class="row between"><span class="muted small" data-count>0 / 2000</span><button class="btn" type="submit">Post</button></div>
    ${mine.length ? '' : '<p class="note">Tip: join a community and your posts can reach people who share the interest, not just your followers.</p>'}
  </form>`, 'New post');
}
function downscale(file) {
  return new Promise((res, rej) => {
    const img = new Image(); const url = URL.createObjectURL(file);
    img.onload = () => {
      const max = 1080, k = Math.min(1, max / Math.max(img.width, img.height));
      const cv = document.createElement('canvas'); cv.width = Math.round(img.width * k); cv.height = Math.round(img.height * k);
      cv.getContext('2d').drawImage(img, 0, 0, cv.width, cv.height); URL.revokeObjectURL(url);
      res(cv.toDataURL('image/jpeg', 0.78));   // also strips EXIF/GPS
    };
    img.onerror = () => rej(new Error('That file could not be read as an image.'));
    img.src = url;
  });
}

/* ── views ───────────────────────────────────────────────── */
const MODE_TABS = [['mix', 'Your mix'], ['following', 'Following'], ['communities', 'Communities'], ['local', 'Local'], ['discover', 'Discover']];

function earlyCard() {
  const u = S.me();
  const memberPosts = S.listPosts((p) => !p.starter).length;
  if (memberPosts > 12) return '';
  return `<section class="early card" aria-labelledby="early-h">
    <h2 id="early-h">You're early here.</h2>
    <p>RipeStream is new, so feeds are quiet until people like you post. Starter posts from the team are labelled — everything else is real members.</p>
    <div class="row wrap gap">
      <a class="btn sm" href="#/invite">Invite 3 friends who share your interests</a>
      <button class="btn ghost sm" data-act="compose" data-kind="question">Ask a question</button>
      ${u.area ? '' : '<a class="btn ghost sm" href="#/local">Set your area</a>'}
    </div></section>`;
}

function emptyFor(mode) {
  const u = S.me();
  const m = {
    following: ['Nobody you follow has posted yet.', 'Following is pure chronological — only people you chose. Follow a few people to fill it.', '<a class="btn sm" href="#/people">Find people to follow</a>'],
    communities: ['Your communities are quiet.', 'Join a couple of communities, or start a conversation in one you\'re in.', '<a class="btn sm" href="#/communities">Browse communities</a>'],
    local: [u.area ? `Nothing local in ${esc(S.areaName(u.area))} yet.` : 'Pick your area to see local posts.', u.area ? 'Be the first: ask a local question, or share an event or notice.' : 'Area only — never your exact location.', u.area ? '<button class="btn sm" data-act="compose" data-kind="question" data-local="1">Ask something local</button>' : '<a class="btn sm" href="#/local">Choose area</a>'],
    discover: ['Nothing new to discover right now.', 'Discovery only shows posts from outside your follows and communities.', '<a class="btn sm" href="#/communities">Browse communities</a>'],
    mix: ['Your feed is empty.', 'Follow people, join communities or set your area — your feed is built only from those choices.', '<a class="btn sm" href="#/communities">Join communities</a> <a class="btn ghost sm" href="#/people">Find people</a>']
  }[mode];
  return `<div class="empty"><h2>${m[0]}</h2><p>${m[1]}</p><div class="row gap center">${m[2]}</div></div>`;
}

function viewFeed() {
  const pr = S.prefs();
  const mode = pr.mode;
  const r = S.feed();
  const mix = { ...DEFAULT_MIX, ...pr.mix };
  const items = r.items.slice(0, shown);
  const shortfall = r.items.length < 8 ? r.shortfall.filter((k) => k !== 'discover') : [];
  return `<div class="tabs" role="tablist" aria-label="Feed mode">${MODE_TABS.map(([k, l]) => `<button role="tab" aria-selected="${mode === k}" data-act="mode" data-v="${k}">${l}</button>`).join('')}</div>
    <div class="mixbar">${mode === 'mix'
      ? `<a href="#/settings" class="mix" aria-label="Your feed mix — edit">${['following', 'communities', 'local', 'discover'].map((k) => `<span class="m-${k}" style="flex:${mix[k] || 0.001}" title="${k} ${mix[k]}%"></span>`).join('')}</a><span class="small muted">Following ${mix.following}% · Communities ${mix.communities}% · Local ${mix.local}% · Discover ${mix.discover}% · <a href="#/settings">Edit</a></span>`
      : `<span class="small muted">${{ following: 'Only people you follow. Newest first. No ranking.', communities: 'Only communities you joined, ranked by the factors in <a href="#/how">How it works</a>.', local: 'Posts tagged to your area or county.', discover: 'Posts from outside your follows and communities.' }[mode]}</span>`}</div>
    <button class="compose-bar" data-act="compose">${S.me() ? avatar(S.me(), 32) : ''}<span>Share something with your people…</span></button>
    ${earlyCard()}
    ${shortfall.length ? `<p class="note">Not enough ${shortfall.join(' or ')} posts yet, so other slots filled in. <a href="#/communities">Find more</a></p>` : ''}
    <div class="stream">${items.length ? items.map((it) => postCard(it.post, it)).join('') : emptyFor(mode)}</div>
    ${r.items.length > shown ? '<button class="btn ghost wide" data-act="more" id="more">Show more</button>' : items.length ? '<p class="end">You\'re all caught up. <a href="#/communities">Explore communities</a> or come back later — we won\'t pad this with junk.</p>' : ''}`;
}

function viewPost(id) {
  const p = S.post(id);
  if (!p || p.removed) return '<div class="empty"><h2>This post isn\'t available.</h2><p>It was deleted or removed by a moderator.</p><a class="btn sm" href="#/">Back to feed</a></div>';
  const a = S.user(p.author);
  if (a && a.private && !S.isFollowing(a.id) && a.id !== S.me().id) return '<div class="empty"><h2>This account is private.</h2></div>';
  const cs = S.comments(p.id).filter((c) => !c.hiddenPendingReview || c.author === S.me().id);
  const top = cs.filter((c) => !c.parent);
  const kids = (id_) => cs.filter((c) => c.parent === id_);
  const cm = (c, nested) => { const u = S.user(c.author) || { name: 'Deleted' }; return `<div class="cm ${nested ? 'nested' : ''}" id="${c.id}">${avatar(u, 30)}<div class="cm-b"><div><a class="name" href="#/u/${esc(u.handle)}">${esc(u.name)}</a>${teamBadge(u)} <span class="muted small">${ago(c.createdAt)}</span></div><p>${esc(c.text).replace(/\n/g, '<br>')}</p>
    <div class="cm-a">${nested ? '' : `<button class="link small" data-act="replyto" data-id="${c.id}" data-name="${esc(u.name)}">Reply</button>`}${c.author === S.me().id || S.isModOf(p.community) ? `<button class="link small" data-act="delcm" data-id="${c.id}">Delete</button>` : ''}${c.author !== S.me().id ? `<button class="link small" data-act="report" data-k="comment" data-id="${c.id}">Report</button>` : ''}</div></div></div>`; };
  const can = S.canReply(p);
  return `<a class="back" href="#/">← Feed</a>${postCard(p)}
  <section class="thread" aria-label="Replies"><h2 class="sr">Replies</h2>
    ${can ? `<form data-form="comment" data-id="${p.id}" class="reply"><input type="hidden" name="parent"><label class="sr" for="cm-t">Reply</label><textarea id="cm-t" name="text" rows="2" maxlength="1000" placeholder="Add a reply…"></textarea><div class="row between"><span class="small muted" data-replying></span><button class="btn sm" type="submit">Reply</button></div></form>`
      : `<p class="note">${esc(a.name)} has limited who can reply to this post.</p>`}
    ${top.length ? top.map((c) => cm(c) + kids(c.id).map((k) => cm(k, true)).join('')).join('') : `<div class="empty small"><p>No replies yet. ${can ? 'Be the first — good first replies are how communities start.' : ''}</p></div>`}
  </section>`;
}

function commCard(c) {
  const m = S.isMember(c.id);
  return `<div class="cc"><a href="#/c/${c.id}" class="cc-e" aria-hidden="true" tabindex="-1">${esc(c.emoji)}</a><div class="cc-b"><a href="#/c/${c.id}" class="name">${esc(c.name)}</a><span class="small muted">${S.members(c.id).length} members · ${esc(c.category)}</span><p class="small">${esc(c.description)}</p></div>
  <button class="btn sm ${m ? 'ghost' : ''}" data-act="${m ? 'leave' : 'join'}" data-id="${c.id}" aria-pressed="${m}">${m ? 'Joined' : 'Join'}</button></div>`;
}
function viewCommunities() {
  const sug = S.suggestedCommunities();
  const cats = [...new Set(S.communities().map((c) => c.category))];
  return `<h1>Communities</h1>
  <p class="muted">A small, curated set to start — so each one has people in it. Missing one? Ask for it and we'll open it when there's demand.</p>
  ${S.joined().length ? `<h2>Yours</h2><div class="list">${S.joined().map((id) => commCard(S.community(id))).join('')}</div>` : ''}
  ${sug.length ? `<h2>Suggested for you</h2><div class="list">${sug.slice(0, 4).map(commCard).join('')}</div>` : ''}
  ${cats.map((k) => `<h2>${esc(k)}</h2><div class="list">${S.communities().filter((c) => c.category === k && !S.isMember(c.id)).map(commCard).join('') || '<p class="small muted">You\'ve joined all of these.</p>'}</div>`).join('')}
  <form data-form="creq" class="card"><h2>Request a community</h2><label class="field">Name<input name="name" maxlength="50" required></label><label class="field">Who is it for? <span class="muted">Optional</span><input name="why" maxlength="300"></label><button class="btn sm" type="submit">Send request</button></form>`;
}
function viewCommunity(id) {
  const c = S.community(id);
  if (!c) return '<div class="empty"><h2>Community not found.</h2></div>';
  const m = S.isMember(c.id);
  const muted = S.prefs().mute.communities.includes(c.id);
  const posts = S.listPosts((p) => p.community === c.id);
  return `<a class="back" href="#/communities">← Communities</a>
  <header class="chead"><span class="cc-e big">${esc(c.emoji)}</span><div><h1>${esc(c.name)}</h1><p class="muted small">${S.members(c.id).length} members · ${esc(c.category)}${c.area ? ' · 📍 ' + esc(S.areaName(c.area)) : ''}</p></div></header>
  <p>${esc(c.description)}</p>
  <div class="row wrap gap">
    <button class="btn sm ${m ? 'ghost' : ''}" data-act="${m ? 'leave' : 'join'}" data-id="${c.id}">${m ? 'Leave' : 'Join'}</button>
    ${m ? `<button class="btn ghost sm" data-act="compose" data-c="${c.id}">Post here</button>` : ''}
    <button class="btn ghost sm" data-act="${muted ? 'unmute' : 'mute'}" data-k="communities" data-v="${c.id}">${muted ? 'Unmute' : 'Mute in feed'}</button>
    <a class="btn ghost sm" href="#/invite?c=${c.id}">Invite</a>
    <button class="btn ghost sm" data-act="report" data-k="community" data-id="${c.id}">Report</button>
  </div>
  <details class="rules card"><summary>Rules & moderators</summary><ol>${c.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ol><p class="small muted">Moderated by ${c.mods.map((x) => esc((S.user(x) || {}).name)).join(', ')}. Volunteer moderators from the community wanted — <a href="mailto:hello@ripestream.com">get in touch</a>.</p></details>
  <div class="stream">${posts.length ? posts.slice(0, 40).map((p) => postCard(p)).join('') : `<div class="empty"><h2>You're early here.</h2><p>No posts in ${esc(c.name)} yet. The first post sets the tone.</p>${m ? `<button class="btn sm" data-act="compose" data-c="${c.id}">Write the first post</button>` : `<button class="btn sm" data-act="join" data-id="${c.id}">Join to post</button>`}</div>`}</div>`;
}

function areaSelect(name, value, extra = '') {
  const groups = AREAS.filter((a) => !a[2]);
  return `<select name="${name}" ${extra}><option value="">Not set</option>${groups.map(([id, n]) => {
    const kids = AREAS.filter((a) => a[2] === id);
    return kids.length ? `<optgroup label="${esc(n.replace(' (county)', ''))}"><option value="${id}" ${value === id ? 'selected' : ''}>${esc(n)}</option>${kids.map(([k, kn]) => `<option value="${k}" ${value === k ? 'selected' : ''}>${esc(kn)}</option>`).join('')}</optgroup>` : `<option value="${id}" ${value === id ? 'selected' : ''}>${esc(n)}</option>`;
  }).join('')}</select>`;
}
function viewLocal() {
  const u = S.me();
  const r = u.area ? S.feed('local') : { items: [] };
  const today = new Date().toISOString().slice(0, 10);
  const events = r.items.filter((x) => x.post.event && x.post.event.date >= today).sort((a, b) => a.post.event.date.localeCompare(b.post.event.date));
  const comms = S.communities().filter((c) => c.area && u.area && (c.area === u.area || c.area === parentOf(u.area) || parentOf(c.area) === parentOf(u.area) || c.area === (parentOf(u.area) || u.area)));
  return `<h1>Local</h1>
  <form data-form="area" class="card row wrap gap between"><label class="field grow">Your area ${areaSelect('area', u.area)}</label><p class="small muted grow">Broad area only. We never ask for or store your exact location. Others only see it if you turn on "Show my area" in Settings.</p></form>
  ${u.area ? `
  <div class="row wrap gap"><button class="chip" data-act="compose" data-kind="question" data-local="1">❓ Ask a local question</button><button class="chip" data-act="compose" data-kind="event" data-local="1">📅 Share an event</button><button class="chip" data-act="compose" data-local="1" data-text="Lost/found: ">🔎 Lost & found</button><button class="chip" data-act="compose" data-local="1" data-text="Traffic/transport: ">🚌 Transport update</button></div>
  ${comms.length ? `<h2>Local communities</h2><div class="list">${comms.map(commCard).join('')}</div>` : ''}
  ${events.length ? `<h2>Upcoming near you</h2><div class="stream">${events.map((x) => postCard(x.post, x)).join('')}</div>` : ''}
  <h2>Around ${esc(S.areaName(u.area))}</h2>
  <div class="stream">${r.items.filter((x) => !x.post.event).map((x) => postCard(x.post, x)).join('') || emptyFor('local')}</div>` : emptyFor('local')}`;
}

function personRow(x) {
  const u = x.u || x;
  const f = S.isFollowing(u.id);
  return `<div class="person">${avatar(u)}<div class="grow"><a class="name" href="#/u/${esc(u.handle)}">${esc(u.name)}</a>${teamBadge(u)}<div class="small muted">@${esc(u.handle)}${x.why ? ' · ' + esc(x.why) : ''}</div></div>${u.id === S.me().id ? '' : `<button class="btn sm ${f ? 'ghost' : ''}" data-act="${f ? 'unfollow' : 'follow'}" data-id="${u.id}" aria-pressed="${f}">${f ? 'Following' : 'Follow'}</button>`}</div>`;
}
function viewPeople() {
  const s = S.suggestedPeople();
  return `<h1>People</h1><p class="muted">Suggestions come from communities and interests you share. Nobody pays to appear here.</p>
  <div class="list">${s.map(personRow).join('') || '<div class="empty"><p>No suggestions yet — join a community and you\'ll see who\'s in it.</p></div>'}</div>
  <div class="card"><h2>Your friends aren't here yet?</h2><p>RipeStream works best with people you actually know. <a href="#/invite">Invite a few</a>.</p></div>`;
}

function viewProfile(handle) {
  const u = S.userByHandle(handle);
  if (!u || u.suspended) return '<div class="empty"><h2>Account not found.</h2></div>';
  const meU = S.me(); const self = u.id === meU.id;
  const blocked = S.isBlocked(meU.id, u.id);
  const locked = u.private && !self && !S.isFollowing(u.id);
  const posts = locked || blocked ? [] : S.listPosts((p) => p.author === u.id);
  const f = S.isFollowing(u.id);
  return `<header class="prof">${avatar(u, 72)}<div><h1>${esc(u.name)} ${teamBadge(u)}</h1><p class="muted">@${esc(u.handle)}${u.private ? ' · 🔒 Private' : ''}${u.showArea && u.area ? ' · 📍 ' + esc(S.areaName(u.area)) : ''}</p></div></header>
  ${u.bio ? `<p>${esc(u.bio)}</p>` : self ? '<p class="muted">Add a short bio so people know who you are.</p>' : ''}
  <p class="small"><b>${S.followers(u.id).length}</b> followers · <b>${S.following(u.id).length}</b> following · <b>${S.joined(u.id).length}</b> communities</p>
  ${(u.interests || []).length ? `<div class="tags">${u.interests.map((t) => `<a href="#/t/${t}">#${esc(topicName(t))}</a>`).join('')}</div>` : ''}
  <div class="row wrap gap">${self ? '<a class="btn ghost sm" href="#/settings/profile">Edit profile</a><a class="btn ghost sm" href="#/settings">Privacy & feed</a>'
    : blocked ? `<button class="btn ghost sm" data-act="unblock" data-v="${u.id}">Unblock</button>`
    : `<button class="btn sm ${f ? 'ghost' : ''}" data-act="${f ? 'unfollow' : 'follow'}" data-id="${u.id}">${f ? 'Following' : 'Follow'}</button>
      <button class="btn ghost sm" data-act="${S.prefs().mute.users.includes(u.id) ? 'unmute' : 'mute'}" data-k="users" data-v="${u.id}">${S.prefs().mute.users.includes(u.id) ? 'Unmute' : 'Mute'}</button>
      <button class="btn ghost sm" data-act="block" data-v="${u.id}">Block</button><button class="btn ghost sm" data-act="report" data-k="user" data-id="${u.id}">Report</button>`}</div>
  ${S.joined(u.id).length && !locked ? `<h2>Communities</h2><div class="tags">${S.joined(u.id).map((c) => `<a href="#/c/${c}">${esc(S.community(c).emoji)} ${esc(S.community(c).name)}</a>`).join('')}</div>` : ''}
  <h2>Posts</h2>
  <div class="stream">${locked ? '<div class="empty"><h2>This account is private.</h2><p>Follow to see their posts.</p></div>' : blocked ? '<div class="empty"><p>You blocked this account.</p></div>' : posts.map((p) => postCard(p)).join('') || `<div class="empty"><p>${self ? 'You haven\'t posted yet.' : 'No posts yet.'}</p>${self ? '<button class="btn sm" data-act="compose">Write your first post</button>' : ''}</div>`}</div>`;
}

function viewTopic(t) {
  const posts = S.listPosts((p) => (p.topics || []).includes(t));
  const muted = S.prefs().mute.topics.includes(t);
  return `<a class="back" href="#/search">← Search</a><h1>#${esc(topicName(t))}</h1>
  <div class="row gap"><button class="btn ghost sm" data-act="adj" data-k="topic" data-v="${esc(t)}" data-d="1">More of this</button><button class="btn ghost sm" data-act="adj" data-k="topic" data-v="${esc(t)}" data-d="-1">Less of this</button><button class="btn ghost sm" data-act="${muted ? 'unmute' : 'mute'}" data-k="topics" data-v="${esc(t)}">${muted ? 'Unmute' : 'Never show'}</button></div>
  <h2>Communities</h2><div class="list">${S.communities().filter((c) => c.topics.includes(t)).map(commCard).join('') || '<p class="muted small">None yet.</p>'}</div>
  <h2>Posts</h2><div class="stream">${posts.map((p) => postCard(p)).join('') || '<div class="empty"><p>No posts on this topic yet.</p></div>'}</div>`;
}

function viewSearch(q) {
  const r = S.search(q);
  const any = r.people.length + r.communities.length + r.topics.length + r.posts.length;
  return `<h1 class="sr">Search</h1><form data-form="search" role="search"><label class="sr" for="q">Search people, communities, topics and posts</label><input id="q" name="q" type="search" value="${esc(q)}" placeholder="Search people, communities, topics, posts" autofocus></form>
  ${q.length < 2 ? `<h2>Topics</h2><div class="tags">${TOPICS.map(([k, n]) => `<a href="#/t/${k}">#${esc(n)}</a>`).join('')}</div><h2>Communities</h2><div class="list">${S.communities().slice(0, 6).map(commCard).join('')}</div>` : !any ? `<div class="empty"><h2>Nothing for "${esc(q)}".</h2><p>Search matches names, handles, community descriptions and post text.</p></div>` : `
  ${r.people.length ? `<h2>People</h2><div class="list">${r.people.map(personRow).join('')}</div>` : ''}
  ${r.communities.length ? `<h2>Communities</h2><div class="list">${r.communities.map(commCard).join('')}</div>` : ''}
  ${r.topics.length ? `<h2>Topics</h2><div class="tags">${r.topics.map((t) => `<a href="#/t/${t}">#${esc(topicName(t))}</a>`).join('')}</div>` : ''}
  ${r.posts.length ? `<h2>Posts</h2><div class="stream">${r.posts.map((p) => postCard(p)).join('')}</div>` : ''}`}`;
}

function viewNotifications() {
  const ns = S.notifications();
  const html = ns.map((n) => {
    const a = n.actor && S.user(n.actor);
    const others = n.actors.length > 1 ? ` and ${n.actors.length - 1} other${n.actors.length > 2 ? 's' : ''}` : '';
    const text = { follow: `<b>${esc(a?.name)}</b> followed you`, reply: `<b>${esc(a?.name)}</b> replied to your post`, like: `<b>${esc(a?.name)}</b>${others} liked your post`, community: esc(n.text), event: esc(n.text) }[n.type];
    const href = n.post ? `#/p/${n.post}` : n.community ? `#/c/${n.community}` : a ? `#/u/${a.handle}` : '#/';
    return `<a class="notif ${n.read ? '' : 'unread'}" href="${href}">${a ? avatar(a, 34) : '<span class="av" style="--s:34px">•</span>'}<span class="grow">${text}</span><span class="small muted">${ago(n.createdAt)}</span></a>`;
  }).join('');
  setTimeout(() => { S.markRead(); updateBadge(); }, 1200);
  return `<h1>Notifications</h1><p class="small muted">Only things people did, or reminders you asked for. Never "you might like…". <a href="#/settings">Choose what you get</a>.</p>
  <div class="list">${html || '<div class="empty"><h2>Nothing yet.</h2><p>Replies, follows, events you\'re going to and busy days in your communities show up here.</p></div>'}</div>`;
}

function viewInvite(cid) {
  const c = cid && S.community(cid);
  const inv = S.myInvites();
  const used = inv.filter((i) => i.usedBy).length;
  return `<h1>Invite people</h1>
  <p>RipeStream gets good when the people you'd actually talk to are here. <b>Invite 3 friends who share your interests</b> — not 300 contacts.</p>
  <div class="card"><p class="small muted">${used} of your invites joined. 5 invites a month. No rewards, points or leaderboards.</p>
  <form data-form="invite" class="row wrap gap"><label class="field grow">Invite them into <select name="c"><option value="">Just to RipeStream</option>${S.joined().map((id) => `<option value="${id}" ${id === cid ? 'selected' : ''}>${esc(S.community(id).name)}</option>`).join('')}</select></label><button class="btn" type="submit">Create invite link</button></form>
  ${c && !S.isMember(c.id) ? `<p class="note">Join ${esc(c.name)} first to invite people into it.</p>` : ''}</div>
  ${inv.length ? `<h2>Your invites</h2><div class="list">${inv.map((i) => `<div class="person"><code>${esc(i.code)}</code><span class="grow small">${i.community ? esc(S.community(i.community).name) : 'RipeStream'} · ${i.usedBy ? 'joined as @' + esc((S.user(i.usedBy) || {}).handle || 'deleted') : 'not used yet'}</span>${i.usedBy ? '' : `<button class="btn ghost sm" data-act="copyinv" data-v="${i.code}">Copy link</button>`}</div>`).join('')}</div>` : ''}`;
}

function viewHow() {
  const rows = Object.entries(WEIGHTS).map(([k, w]) => `<tr><th scope="row">${esc(FACTOR_LABELS[k])}</th><td class="num">${Math.round(w * 100)}</td></tr>`).join('');
  return `<h1>How RipeStream recommends content</h1>
  <p class="lede">There is an algorithm. Here's all of it, in plain language — and you control it.</p>
  <h2>1. You pick the feed</h2><p><b>Following</b> is people you follow, newest first, no ranking at all. <b>Communities</b>, <b>Local</b> and <b>Discover</b> each show one kind of content. <b>Your mix</b> blends them using percentages you set (default Following 60 · Communities 25 · Local 10 · Discover 5).</p>
  <h2>2. Within a slot, posts get a score</h2><p>Every post gets points for each of these. The numbers are the weights, out of 100:</p>
  <table class="weights"><tbody>${rows}</tbody></table>
  <p>The total is multiplied by <b>freshness</b> (a post's score halves every ${HALF_LIFE_HOURS} hours) and by <b>your settings</b> — each "more of this" multiplies by 1.6, each "less" divides by 1.6.</p>
  <h2>3. Things that never get through</h2><p>Anything from people you've muted or blocked, communities you've muted, topics you've said never to show, posts you marked not interested, and private accounts you don't follow.</p>
  <h2>4. What we learn from you</h2><p>Only one thing: when you like or reply, we note the post's topics (e.g. "running +1"). You can see that list in <a href="#/settings">Settings</a> and wipe it with <b>Reset my feed</b>. We don't track how long you look at posts, we don't use your contacts, and we don't use location beyond the area you chose.</p>
  <h2>5. What uses automation</h2><p>Topics on posts are detected with simple keyword rules. Spam checks are rules plus rate limits. No AI writes posts, replies or comments, and no AI decides your feed. A human moderator makes every removal decision.</p>
  <h2>6. What we don't do</h2><p>No paid boosts in your feed. No engagement-bait notifications. No autoplay. Tap "Why?" on any post to see its exact score.</p>`;
}

function viewSettings(section) {
  const u = S.me(); const pr = S.prefs(); const mix = { ...DEFAULT_MIX, ...pr.mix };
  const inferred = Object.entries(pr.inferred).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const adj = Object.entries(pr.adjust).flatMap(([k, o]) => Object.entries(o).map(([key, v]) => ({ k, key, v })));
  const label = (k, key) => k === 'topic' ? '#' + topicName(key) : k === 'community' ? (S.community(key) || {}).name : k === 'author' ? (S.user(key) || {}).name : key;
  const mutes = pr.mute;
  if (section === 'profile') return `<a class="back" href="#/settings">← Settings</a><h1>Edit profile</h1>
    <form data-form="profile" class="card"><label class="field">Name<input name="name" value="${esc(u.name)}" maxlength="40" required></label><label class="field">Bio<textarea name="bio" maxlength="200" rows="3">${esc(u.bio)}</textarea></label>
    <fieldset><legend>Interests</legend><div class="chips">${TOPICS.map(([k, n]) => `<label class="chip-check"><input type="checkbox" name="interests" value="${k}" ${u.interests.includes(k) ? 'checked' : ''}><span>${esc(n)}</span></label>`).join('')}</div></fieldset>
    <button class="btn" type="submit">Save</button></form>`;
  const accts = S.accounts();
  return `<h1>Settings</h1>
  <section class="card" id="feed"><h2>Your feed</h2>
    <form data-form="mix"><p class="small muted">How "Your mix" is made up. Sliders rebalance to 100%.</p>
    ${['following', 'communities', 'local', 'discover'].map((k) => `<label class="slider"><span>${k[0].toUpperCase() + k.slice(1)}</span><input type="range" name="${k}" min="0" max="100" step="5" value="${mix[k]}"><output>${mix[k]}%</output></label>`).join('')}
    <div class="row gap"><button class="btn sm" type="submit">Save mix</button><button class="btn ghost sm" type="button" data-act="presetmix" data-v="70,30,0,0">Friends & communities only</button><button class="btn ghost sm" type="button" data-act="presetmix" data-v="40,20,35,5">Local-heavy</button></div></form>
    <h3>More / less</h3>${adj.length ? `<div class="chips">${adj.map((a) => `<button class="chip" data-act="adjclear" data-k="${a.k}" data-v="${esc(a.key)}" data-d="${-a.v}">${a.v > 0 ? 'More' : 'Less'}: ${esc(label(a.k, a.key))} ✕</button>`).join('')}</div>` : '<p class="small muted">None. Use "Why?" on any post to tune it.</p>'}
    <h3>Muted</h3>${mutes.users.length + mutes.communities.length + mutes.topics.length ? `<div class="chips">${mutes.users.map((x) => `<button class="chip" data-act="unmute" data-k="users" data-v="${x}">${esc((S.user(x) || {}).name)} ✕</button>`).join('')}${mutes.communities.map((x) => `<button class="chip" data-act="unmute" data-k="communities" data-v="${x}">${esc(S.community(x).name)} ✕</button>`).join('')}${mutes.topics.map((x) => `<button class="chip" data-act="unmute" data-k="topics" data-v="${x}">#${esc(topicName(x))} ✕</button>`).join('')}</div>` : '<p class="small muted">Nothing muted.</p>'}
    <form data-form="mutetopic" class="row gap"><label class="field grow">Never show a topic <select name="t">${TOPICS.map(([k, n]) => `<option value="${k}">${esc(n)}</option>`).join('')}</select></label><button class="btn ghost sm" type="submit">Mute topic</button></form>
    <h3>What we've learned from your likes and replies</h3>${inferred.length ? `<div class="chips">${inferred.map(([t, v]) => `<span class="chip static">#${esc(topicName(t))} · ${v}</span>`).join('')}</div>` : '<p class="small muted">Nothing yet.</p>'}
    <div class="danger-zone"><h3>Reset my feed</h3><p class="small">Clears learned interests, more/less settings, "not interested" posts and your mix. Keeps who you follow, your communities, your area and your mutes & blocks (those are safety settings).</p><button class="btn ghost sm" data-act="resetfeed">Reset my feed</button></div>
  </section>
  <section class="card" id="privacy"><h2>Privacy & safety</h2>
    <form data-form="privacy">
      <label class="check"><input type="checkbox" name="private" ${u.private ? 'checked' : ''}> Private account <span class="small muted">— only followers see your posts (community posts too)</span></label>
      <label class="check"><input type="checkbox" name="showArea" ${u.showArea ? 'checked' : ''}> Show my area on my profile</label>
      <label class="check"><input type="checkbox" name="discoverable" ${u.discoverable !== false ? 'checked' : ''}> Suggest me to people with shared communities</label>
      <label class="field">Who can reply to my posts <select name="replyPolicy">${[['everyone', 'Everyone'], ['following', 'People I follow'], ['nobody', 'Nobody']].map(([k, n]) => `<option value="${k}" ${u.replyPolicy === k ? 'selected' : ''}>${n}</option>`).join('')}</select></label>
      <label class="field">My area ${areaSelect('area', u.area)}</label>
      <button class="btn sm" type="submit">Save privacy</button></form>
    <h3>Blocked</h3>${S.blockedByMe().length ? `<div class="chips">${S.blockedByMe().map((x) => `<button class="chip" data-act="unblock" data-v="${x}">${esc((S.user(x) || {}).name || 'Deleted')} — unblock</button>`).join('')}</div>` : '<p class="small muted">Nobody.</p>'}
  </section>
  <section class="card"><h2>Notifications</h2><form data-form="notify">${[['replies', 'Replies and likes on my posts'], ['follows', 'New followers'], ['community', 'Daily note when my communities are busy'], ['events', 'Reminders for events I\'m going to']].map(([k, n]) => `<label class="check"><input type="checkbox" name="${k}" ${pr.notify[k] !== false ? 'checked' : ''}> ${n}</label>`).join('')}<button class="btn sm" type="submit">Save</button></form></section>
  <section class="card"><h2>Your data</h2><div class="row wrap gap"><button class="btn ghost sm" data-act="export">Download my data (JSON)</button><a class="btn ghost sm" href="#/u/${esc(u.handle)}">Delete individual posts</a><button class="btn ghost sm danger" data-act="delacct">Delete my account</button></div></section>
  <section class="card preview-tools"><h2>Preview tools</h2><p class="small muted">This is a preview: accounts and posts live only in this browser. These tools exist so you can test RipeStream with more than one person.</p>
    <div class="row wrap gap">${accts.filter((a) => a.id !== u.id).map((a) => `<button class="btn ghost sm" data-act="switch" data-v="${a.id}">Switch to @${esc(a.handle)}</button>`).join('')}<button class="btn ghost sm" data-act="newacct">Create another test account</button>
    <label class="check"><input type="checkbox" data-act="previewmod" ${u.previewModerator ? 'checked' : ''}> Act as moderator</label>${S.isAnyMod() ? '<a class="btn ghost sm" href="#/mod">Moderation</a>' : ''}<button class="btn ghost sm danger" data-act="wipe">Wipe all preview data</button></div></section>`;
}

function viewMod() {
  if (!S.isAnyMod()) return '<div class="empty"><h2>Moderators only.</h2></div>';
  const q = S.modQueue(); const h = S.health();
  const target = (r) => {
    if (r.targetType === 'post') { const p = S.post(r.targetId); return p ? `<blockquote>${esc(p.text.slice(0, 240))}</blockquote><a class="small" href="#/p/${p.id}">Open post</a>` : 'Deleted'; }
    if (r.targetType === 'comment') { const c = S.commentById(r.targetId); return c ? `<blockquote>${esc(c.text.slice(0, 240))}</blockquote><a class="small" href="#/p/${c.post}">Open thread</a>` : 'Deleted'; }
    if (r.targetType === 'user') { const u = S.user(r.targetId); return u ? `<a href="#/u/${esc(u.handle)}">@${esc(u.handle)}</a>` : 'Deleted'; }
    return esc(r.targetType + ' ' + r.targetId);
  };
  return `<h1>Moderation</h1><p class="small muted">Rules and three-report auto-hiding help, but a person makes every removal decision.</p>
  <h2>Report queue (${q.length})</h2><div class="list">${q.map((r) => `<div class="card report"><div class="small"><b>${esc(r.reason)}</b> · ${esc(r.targetType)} · ${ago(r.createdAt)} ago${r.note ? ' · “' + esc(r.note) + '”' : ''}</div>${target(r)}<div class="row gap"><button class="btn sm danger" data-act="resolve" data-id="${r.id}" data-v="remove">Remove${r.targetType === 'user' ? ' / suspend' : ''}</button><button class="btn ghost sm" data-act="resolve" data-id="${r.id}" data-v="dismiss">Dismiss</button></div></div>`).join('') || '<div class="empty small"><p>Queue is clear.</p></div>'}</div>
  <h2>Network health</h2>
  <div class="stats">
    <div><b>${h.accounts}</b><span>accounts</span></div><div><b>${h.activation.fullyActivated}%</b><span>activated (interests + follow + join)</span></div><div><b>${h.activation.posted}%</b><span>have posted</span></div>
    <div><b>${h.retention.d1}% / ${h.retention.d7}% / ${h.retention.d30}%</b><span>D1 / D7 / D30 return</span></div><div><b>${h.network.postsPerActiveUser}</b><span>posts per posting user</span></div><div><b>${h.network.commentsPerPost}</b><span>replies per member post</span></div>
    <div><b>${h.network.memberPosts}</b><span>member posts (${h.network.starterPosts} starter)</span></div><div><b>${h.network.activeCommunities}</b><span>communities active this week</span></div><div><b>${h.network.communityRequests}</b><span>community requests</span></div>
  </div>`;
}

/* ── onboarding: < 1 minute, every question changes the feed ── */
let ob = { step: 0, interests: [], area: '', invite: null };
function viewOnboarding() {
  const inv = ob.invite && S.invite(ob.invite);
  const inviter = inv && S.user(inv.from);
  const steps = ['You', 'Interests', 'Area', 'Communities', 'People'];
  const head = `<div class="ob-head"><span class="logo">${'<svg aria-hidden="true" width="28" height="28"><use href="#mark"/></svg>'}RipeStream</span><ol class="dots" aria-label="Step ${ob.step + 1} of 5">${steps.map((s, i) => `<li class="${i <= ob.step ? 'on' : ''}"><span class="sr">${s}</span></li>`).join('')}</ol></div>`;
  if (ob.step === 0) return `${head}<div class="ob">
    ${inviter ? `<p class="invited">${avatar(inviter, 28)} <b>${esc(inviter.name)}</b> invited you${inv.community ? ` to <b>${esc(S.community(inv.community).name)}</b>` : ''}.</p>` : ''}
    <h1>Social media you control.</h1><p class="lede">Your feed, your communities, your algorithm — and a plain answer to "why am I seeing this?" on every post.</p>
    <form data-form="signup" class="card"><label class="field">Your name<input name="name" autocomplete="name" maxlength="40" required autofocus></label><label class="field">Username<input name="handle" autocomplete="username" maxlength="20" pattern="[a-zA-Z0-9._]{3,20}" required placeholder="e.g. aoife.runs"></label>
    <p class="small muted">No phone number, birthday, contacts or location needed. Preview: your account is stored in this browser only.</p>
    <button class="btn wide" type="submit">Start — takes under a minute</button></form>
    ${S.accounts().length ? `<p class="small center">Already tried it here? ${S.accounts().map((a) => `<button class="link" data-act="switch" data-v="${a.id}">Continue as @${esc(a.handle)}</button>`).join(' · ')}</p>` : ''}</div>`;
  if (ob.step === 1) return `${head}<div class="ob"><h1>What are you into?</h1><p class="muted">Pick a few. This decides which communities we suggest and what Discover shows. Change it any time.</p>
    <div class="chips big">${TOPICS.map(([k, n]) => `<button class="chip" data-act="obint" data-v="${k}" aria-pressed="${ob.interests.includes(k)}">${esc(n)}</button>`).join('')}</div>
    <div class="ob-foot"><button class="btn ghost" data-act="obback">Back</button><button class="btn" data-act="obnext">${ob.interests.length ? 'Next' : 'Skip'}</button></div></div>`;
  if (ob.step === 2) return `${head}<div class="ob"><h1>Where are you based?</h1><p class="muted">Pick a broad area for local posts, events and communities. Optional. Never your exact location, and hidden from your profile unless you choose to show it.</p>
    <form data-form="obarea" class="card"><label class="field">Area ${areaSelect('area', ob.area, 'autofocus')}</label></form>
    <div class="ob-foot"><button class="btn ghost" data-act="obback">Back</button><button class="btn" data-act="obnext">${ob.area ? 'Next' : 'Skip'}</button></div></div>`;
  const u = S.me();
  if (ob.step === 3) {
    const sug = S.suggestedCommunities(u);
    const list = [...(u.inviteCommunity ? [S.community(u.inviteCommunity)] : []), ...sug.filter((c) => c.id !== u.inviteCommunity), ...S.communities().filter((c) => !sug.includes(c) && c.id !== u.inviteCommunity && !c.area).slice(0, 4)];
    const uniq = [...new Map(list.map((c) => [c.id, c])).values()].slice(0, 9);
    return `${head}<div class="ob"><h1>Join a few communities</h1><p class="muted">This is where most conversation happens. Suggested from your interests${u.area ? ' and area' : ''}.</p>
    <div class="list">${uniq.map(commCard).join('')}</div>
    <div class="ob-foot"><button class="btn ghost" data-act="obback">Back</button><button class="btn" data-act="obnext">${S.joined().length ? 'Next' : 'Skip'}</button></div></div>`;
  }
  const ppl = S.suggestedPeople(u).slice(0, 8);
  return `${head}<div class="ob"><h1>Follow people</h1><p class="muted">Your Following feed only ever shows people you pick here or later. ${S.accounts().length < 3 ? "It's early, so there aren't many yet — inviting friends is the fastest way to a good feed." : ''}</p>
    <div class="list">${ppl.map(personRow).join('')}</div>
    <div class="card"><b>Bring 3 friends who share your interests.</b> <a href="#/invite" data-act="obfinish" data-to="#/invite">Create an invite link</a></div>
    <div class="ob-foot"><button class="btn ghost" data-act="obback">Back</button><button class="btn" data-act="obfinish">See my feed</button></div></div>`;
}

/* ── shell ───────────────────────────────────────────────── */
function rail() {
  const pr = S.prefs(); const mix = { ...DEFAULT_MIX, ...pr.mix };
  const sug = S.suggestedCommunities().slice(0, 3);
  return `<div class="card"><h2 class="h3">Your algorithm</h2><p class="small">Mode: <b>${esc(MODE_TABS.find((m) => m[0] === pr.mode)[1])}</b></p>
  ${pr.mode === 'mix' ? `<p class="small muted">Following ${mix.following}% · Communities ${mix.communities}% · Local ${mix.local}% · Discover ${mix.discover}%</p>` : ''}
  <p class="small"><a href="#/settings">Tune it</a> · <a href="#/how">How it works</a></p></div>
  ${sug.length ? `<div class="card"><h2 class="h3">Communities for you</h2>${sug.map((c) => `<p class="small"><a href="#/c/${c.id}">${esc(c.emoji)} ${esc(c.name)}</a> · ${S.members(c.id).length} members</p>`).join('')}</div>` : ''}
  <div class="card"><h2 class="h3">Bring your people</h2><p class="small">RipeStream is better with friends. <a href="#/invite">Invite 3</a>.</p></div>
  <p class="small muted foot"><a href="/">About</a> · <a href="/privacy">Privacy</a> · <a href="/terms">Terms</a> · Preview</p>`;
}
function updateBadge() { const n = S.unreadCount(); for (const b of $$('[data-badge]')) { b.textContent = n > 9 ? '9+' : n; b.hidden = !n; } }

const ROUTES = [
  [/^\/?$/, () => viewFeed(), 'Feed'],
  [/^\/p\/([\w-]+)$/, (m) => viewPost(m[1]), 'Post'],
  [/^\/c\/([\w-]+)$/, (m) => viewCommunity(m[1]), 'Community'],
  [/^\/communities$/, () => viewCommunities(), 'Communities'],
  [/^\/local$/, () => viewLocal(), 'Local'],
  [/^\/people$/, () => viewPeople(), 'People'],
  [/^\/u\/([\w.]+)$/, (m) => viewProfile(m[1]), 'Profile'],
  [/^\/t\/([\w-]+)$/, (m) => viewTopic(m[1]), 'Topic'],
  [/^\/search(?:\?q=(.*))?$/, (m) => viewSearch(decodeURIComponent(m[1] || '')), 'Search'],
  [/^\/notifications$/, () => viewNotifications(), 'Notifications'],
  [/^\/invite(?:\?c=([\w-]+))?$/, (m) => viewInvite(m[1]), 'Invite'],
  [/^\/how$/, () => viewHow(), 'How ranking works'],
  [/^\/settings(?:\/(\w+))?$/, (m) => viewSettings(m[1]), 'Settings'],
  [/^\/mod$/, () => viewMod(), 'Moderation']
];

export function render() {
  const u = S.me();
  const path = location.hash.replace(/^#/, '') || '/';
  document.body.classList.toggle('onboarding', !u || !u.onboarded);
  if (!u || !u.onboarded) {
    if (u && !u.onboarded && ob.step === 0) ob.step = 1;
    $('#main').innerHTML = viewOnboarding();
    document.title = 'Join RipeStream';
    return;
  }
  for (const [re, fn, title] of ROUTES) {
    const m = path.match(re);
    if (m) {
      $('#main').innerHTML = fn(m);
      document.title = `${title} · RipeStream`;
      for (const a of $$('[data-nav]')) a.setAttribute('aria-current', a.dataset.nav === (path.split(/[/?]/)[1] || 'feed') ? 'page' : 'false');
      $('#rail').innerHTML = rail();
      updateBadge();
      return;
    }
  }
  $('#main').innerHTML = '<div class="empty"><h2>Page not found.</h2><a class="btn sm" href="#/">Feed</a></div>';
}
const rerender = () => { const y = scrollY; render(); scrollTo(0, y); };

/* ── events ──────────────────────────────────────────────── */
function share(id) {
  const url = `${location.origin}${location.pathname}#/p/${id}`;
  if (navigator.share) navigator.share({ url, title: 'RipeStream' }).catch(() => {});
  else navigator.clipboard?.writeText(url).then(() => toast('Link copied.'), () => toast(url));
}

const ACTIONS = {
  close: () => closeSheet(),
  mode: (d) => { S.setMode(d.v); shown = PAGE; render(); scrollTo(0, 0); },
  more: () => { shown += PAGE; rerender(); },
  why: (d) => whySheet(d.id),
  menu: (d) => menuSheet(d.id),
  like: (d) => { S.toggleLike(d.id); rerender(); },
  rsvp: (d) => { S.toggleRsvp(d.id); rerender(); },
  share: (d) => share(d.id),
  copy: (d) => { closeSheet(); share(d.id); },
  compose: (d) => composer({ community: d.c, kind: d.kind, local: !!d.local, text: d.text }),
  adj: (d) => { S.adjust(d.k, d.v, +d.d); closeSheet(); toast(`${+d.d > 0 ? 'More' : 'Fewer'} posts like that. Change it in Settings.`, () => S.adjust(d.k, d.v, -d.d)); rerender(); },
  adjclear: (d) => { S.adjust(d.k, d.v, +d.d); rerender(); },
  ni: (d) => { S.notInterested(d.id); closeSheet(); toast('Hidden. You\'ll see fewer posts like it.'); rerender(); },
  mute: (d) => { S.mute(d.k, d.v); closeSheet(); toast('Muted. Undo any time in Settings.', () => S.unmute(d.k, d.v)); rerender(); },
  unmute: (d) => { S.unmute(d.k, d.v); toast('Unmuted.'); rerender(); },
  block: (d) => { if (confirm(`Block ${(S.user(d.v) || {}).name}? You won't see each other's posts or be able to reply or follow.`)) { S.block(d.v); closeSheet(); toast('Blocked.'); rerender(); } },
  unblock: (d) => { S.unblock(d.v); toast('Unblocked.'); rerender(); },
  report: (d) => reportSheet(d.k, d.id),
  delpost: (d) => { if (confirm('Delete this post and its replies? This can\'t be undone.')) { S.deletePost(d.id); closeSheet(); toast('Deleted.'); location.hash.startsWith('#/p/') ? (location.hash = '#/') : rerender(); } },
  delcm: (d) => { S.deleteComment(d.id); rerender(); },
  replyto: (d) => { const f = $('[data-form=comment]'); f.parent.value = d.id; $('[data-replying]', f).innerHTML = `Replying to ${esc(d.name)} · <button type="button" class="link" data-act="replycancel">cancel</button>`; f.text.focus(); },
  replycancel: () => { const f = $('[data-form=comment]'); f.parent.value = ''; $('[data-replying]', f).textContent = ''; },
  follow: (d) => { guard(() => S.follow(d.id)); rerender(); },
  unfollow: (d) => { S.unfollow(d.id); rerender(); },
  join: (d) => { S.join(d.id); rerender(); },
  leave: (d) => { S.leave(d.id); rerender(); },
  resetfeed: () => { if (confirm('Reset your feed? Learned interests and more/less settings are cleared. Follows, communities, mutes and blocks stay.')) { S.resetFeed(); toast('Feed reset. It\'s now built only from your follows, communities, interests and area.'); rerender(); } },
  presetmix: (d) => { const [a, b, c, e] = d.v.split(',').map(Number); S.setMix({ following: a, communities: b, local: c, discover: e }); toast('Mix updated.'); rerender(); },
  export: () => { const blob = new Blob([JSON.stringify(S.exportData(), null, 2)], { type: 'application/json' }); const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `ripestream-${S.me().handle}.json`; a.click(); toast('Downloaded.'); },
  delacct: () => { const h = prompt(`This deletes your account, posts, replies, likes and follows immediately. Type your username (${S.me().handle}) to confirm.`); if (h && h.replace(/^@/, '') === S.me().handle) { S.deleteAccount(); ob = { step: 0, interests: [], area: '', invite: null }; location.hash = '#/'; render(); toast('Account deleted.'); } },
  switch: (d) => { S.switchTo(d.v); location.hash = '#/'; render(); S.digest(); updateBadge(); },
  newacct: () => { S.signOut(); ob = { step: 0, interests: [], area: '', invite: null }; location.hash = '#/'; render(); },
  previewmod: (d, el) => { S.setPreviewModerator(el.checked); rerender(); },
  wipe: () => { if (confirm('Delete every preview account and post in this browser?')) { S.wipePreview(); ob = { step: 0, interests: [], area: '', invite: null }; location.hash = '#/'; render(); } },
  resolve: (d) => { S.resolveReport(d.id, d.v); toast(d.v === 'remove' ? 'Removed.' : 'Dismissed.'); rerender(); },
  copyinv: (d) => { const url = `${location.origin}${location.pathname}?invite=${d.v}`; navigator.clipboard?.writeText(url).then(() => toast('Invite link copied.'), () => toast(url)); },
  undo: () => { const t = $('#toast'); if (t._undo) { t._undo(); t._undo = null; t.hidden = true; rerender(); } },
  obint: (d) => { ob.interests = ob.interests.includes(d.v) ? ob.interests.filter((x) => x !== d.v) : [...ob.interests, d.v]; render(); },
  obback: () => { ob.step = Math.max(1, ob.step - 1); render(); },
  obnext: () => {
    if (ob.step === 1) { S.updateProfile({ interests: ob.interests }); S.track('onboard_interests', { n: ob.interests.length }); }
    if (ob.step === 2) { const v = ($('[data-form=obarea] select') || {}).value || ''; ob.area = v; S.updateProfile({ area: v }); S.track('onboard_area', { set: !!v }); }
    ob.step++; render(); scrollTo(0, 0);
  },
  obfinish: (d) => { S.updateProfile({ onboarded: true }); S.track('onboarded'); S.markSession(); location.hash = d.to || '#/'; render(); scrollTo(0, 0); }
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const fn = ACTIONS[el.dataset.act];
  if (!fn) return;
  if (el.tagName !== 'INPUT') e.preventDefault();
  guard(() => fn(el.dataset, el));
});

const FORMS = {
  signup: (f) => { S.createAccount({ name: f.name.value, handle: f.handle.value, invite: ob.invite }); const u = S.me(); if (u.invitedBy) S.follow(u.invitedBy); ob.step = 1; render(); },
  obarea: () => {},
  post: async (f) => {
    const kind = f.kind.value;
    const p = S.createPost({ text: f.text.value, community: f.community.value || null, image: pendingImage, kind, toArea: f.local && f.local.checked,
      event: kind === 'event' ? { title: f.ev_title.value, date: f.ev_date.value, time: f.ev_time.value, place: f.ev_place.value } : null });
    closeSheet(); toast('Posted.');
    if (location.hash.startsWith('#/c/') || location.hash === '#/local') rerender(); else { location.hash = '#/'; render(); }
    return p;
  },
  comment: (f) => { S.addComment(f.dataset.id, f.text.value, f.parent.value || null); rerender(); },
  report: (f) => { S.report(f.dataset.k, f.dataset.id, f.reason.value, f.note.value); closeSheet(); toast('Reported. A moderator will review it. Thanks for looking out.'); },
  creq: (f) => { S.requestCommunity({ name: f.name.value, why: f.why.value }); f.reset(); toast('Request sent. We open communities when enough people ask.'); },
  area: (f) => { S.updateProfile({ area: f.area.value }); rerender(); },
  search: (f) => { location.hash = '#/search?q=' + encodeURIComponent(f.q.value); },
  invite: (f) => { const c = f.c.value || null; const code = S.createInvite(c); rerender(); ACTIONS.copyinv({ v: code }); },
  mix: (f) => {
    const v = Object.fromEntries(['following', 'communities', 'local', 'discover'].map((k) => [k, +f[k].value]));
    const tot = Object.values(v).reduce((a, b) => a + b, 0);
    if (!tot) throw new Error('At least one slot needs some share.');
    const n = Object.fromEntries(Object.entries(v).map(([k, x]) => [k, Math.round((x / tot) * 100)]));
    S.setMix(n); toast('Mix saved.'); rerender();
  },
  mutetopic: (f) => { S.mute('topics', f.t.value); toast('Topic muted.'); rerender(); },
  privacy: (f) => { S.updateProfile({ private: f.private.checked, showArea: f.showArea.checked, discoverable: f.discoverable.checked, replyPolicy: f.replyPolicy.value, area: f.area.value }); toast('Privacy saved.'); rerender(); },
  notify: (f) => { for (const k of ['replies', 'follows', 'community', 'events']) S.setNotify(k, f[k].checked); toast('Saved.'); },
  profile: (f) => { S.updateProfile({ name: f.name.value, bio: f.bio.value, interests: $$('input[name=interests]:checked', f).map((x) => x.value) }); toast('Profile saved.'); location.hash = '#/u/' + S.me().handle; }
};
document.addEventListener('submit', async (e) => {
  const f = e.target.closest('[data-form]'); if (!f) return;
  e.preventDefault();
  try { await FORMS[f.dataset.form](f); } catch (err) { toast(err.message || 'Something went wrong.'); }
});
document.addEventListener('change', async (e) => {
  const t = e.target;
  if (t.closest('[data-form=area]')) { S.updateProfile({ area: t.value }); S.track('set_area'); rerender(); }
  if (t.closest('[data-form=obarea]')) { ob.area = t.value; render(); }
  if (t.name === 'kind' && t.closest('.composer')) $('.evf').hidden = t.value !== 'event';
  if (t.name === 'image' && t.files[0]) {
    try { pendingImage = await downscale(t.files[0]); const pv = $('.composer .preview'); pv.src = pendingImage; pv.hidden = false; pv.alt = 'Selected photo'; }
    catch (err) { toast(err.message); }
  }
});
document.addEventListener('input', (e) => {
  const t = e.target;
  if (t.type === 'range') { const o = t.parentElement.querySelector('output'); if (o) o.textContent = t.value + '%'; }
  if (t.name === 'text' && t.closest('.composer')) {
    const f = t.closest('form'); $('[data-count]', f).textContent = `${t.value.length} / 2000`;
    const tp = detectTopics(t.value); $('[data-topics]', f).textContent = tp.length ? 'Topics: ' + tp.map(topicName).join(', ') : '';
  }
});
$('#sheet').addEventListener('click', (e) => { if (e.target.id === 'sheet') closeSheet(); });

// Auto "show more" when the button scrolls into view: pagination, not an endless feed.

export function start() {
  S.load();
  try { const inv = new URLSearchParams(location.search).get('invite'); if (inv) { ob.invite = inv.toUpperCase(); } } catch {}
  if (S.me()) { S.digest(); if (S.me().onboarded) S.markSession(); }
  addEventListener('hashchange', () => { shown = PAGE; closeSheet(); render(); scrollTo(0, 0); });
  render();
}
