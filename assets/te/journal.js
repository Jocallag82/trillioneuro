(function () {
  'use strict';
  var T = window.TE;
  // Body is plain text with blank-line paragraphs and **bold**; rendered escaped (no HTML from the database).
  function body(s) {
    return String(s || '').split(/\n{2,}/).map(function (p) {
      var h = T.esc(p.trim()).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/\n/g, '<br>');
      if (/^##\s/.test(p.trim())) return '<h2 style="font-size:32px;margin:1.6em 0 .6em">' + h.replace(/^##\s/, '') + '</h2>';
      return h ? '<p>' + h + '</p>' : '';
    }).join('');
  }
  var art = T.$('#article');
  if (art) {
    var m = location.pathname.match(/^\/journal\/([a-z0-9-]{1,80})\/?$/);
    if (!m) { art.insertAdjacentHTML('beforeend', T.errorBlock('Unknown update.')); return; }
    T.rpc('te_journal_get', { p_slug: m[1] }).then(function (p) {
      if (!p) { art.innerHTML = '<p class="small"><a href="/journal">← The Journal</a></p><div class="empty" style="margin-top:24px"><h3>This update isn’t published.</h3><a class="btn btn-line btn-sm" href="/journal">All updates</a></div>'; return; }
      document.title = p.title + ' — TrillionEuro.com';
      art.innerHTML = '<p class="small"><a href="/journal">← The Journal</a></p>' +
        '<p class="kicker" style="margin-top:28px">' + T.esc(T.date(p.published_at)) + (p.categories.length ? ' · ' + p.categories.map(T.esc).join(' · ') : '') + '</p>' +
        '<h1 style="font-size:clamp(38px,6vw,72px);margin:16px 0 24px;max-width:20ch">' + T.esc(p.title) + '</h1>' +
        (p.excerpt ? '<p class="lede">' + T.esc(p.excerpt) + '</p>' : '') +
        (p.cover_url ? '<img src="' + T.esc(p.cover_url) + '" alt="" style="margin:32px 0;width:100%;max-height:520px;object-fit:cover" loading="lazy">' : '') +
        '<div class="article-body" style="margin-top:32px">' + body(p.body) + '</div>' +
        (p.milestones.length ? '<h2 style="font-size:28px;margin:48px 0 20px">Related milestones</h2><ul class="timeline">' + p.milestones.map(function (x) {
          return '<li class="' + T.esc(x.kind) + '"><time>' + T.esc(T.date(x.occurred_on)) + '</time><h3>' + T.esc(x.title) + '</h3>' + (x.verified ? '<span class="badge">Verified</span>' : '') + '</li>'; }).join('') + '</ul>' : '') +
        '<div class="share-row" id="share" style="margin-top:40px"></div>';
      T.shareButtons(T.$('#share'), { url: T.SITE + '/journal/' + p.slug, text: p.title + ' — BEAT ELON journal', kind: 'journal' });
    }).catch(function (e) { art.insertAdjacentHTML('beforeend', T.errorBlock(e.message)); });
    return;
  }
  T.rpc('te_journal_list', { p_limit: 50 }).then(function (ps) {
    T.$('#posts').innerHTML = ps.length ? ps.map(function (p) {
      return '<a class="post reveal" href="/journal/' + encodeURIComponent(p.slug) + '">' + (p.cover_url ? '<img src="' + T.esc(p.cover_url) + '" alt="" loading="lazy">' : '') +
        '<span class="kicker">' + T.esc(T.date(p.published_at)) + '</span><h3>' + T.esc(p.title) + '</h3>' + (p.excerpt ? '<p class="muted">' + T.esc(p.excerpt) + '</p>' : '') + '</a>';
    }).join('') : '<div class="empty" style="grid-column:1/-1"><h3>No updates published yet.</h3><p>The first founder update lands here. Nothing is backdated.</p></div>';
    T.reveal();
  }).catch(function (e) { T.$('#posts').innerHTML = T.errorBlock(e.message); });
  T.rpc('te_milestones_list').then(function (ms) {
    T.$('#timeline').innerHTML = ms.length ? ms.map(function (x) {
      return '<li class="' + T.esc(x.kind) + '"><time datetime="' + T.esc(x.occurred_on) + '">' + T.esc(T.date(x.occurred_on)) + ' · ' + T.esc(x.kind) + '</time><h3>' + T.esc(x.title) + '</h3>' +
        (x.detail ? '<p class="muted">' + T.esc(x.detail) + '</p>' : '') + (x.verified ? '<span class="badge">Verified</span>' : '<span class="badge" style="border-color:var(--line-2);color:var(--mute)">Founder-reported</span>') +
        (x.source_url ? ' <a class="small" href="' + T.esc(x.source_url) + '" rel="noopener nofollow" target="_blank">Source</a>' : '') + '</li>';
    }).join('') : '<li><h3>No milestones recorded yet.</h3><p class="muted">Milestones are added when they happen, with evidence where it exists.</p></li>';
  }).catch(function () {});
})();
