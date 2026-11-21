/* Homepage orchestration. Every number shown comes from the database; if it can't be reached we show "—", never a guess. */
(function () {
  'use strict';
  var MV = window.MV, $ = MV.$, esc = MV.esc;

  function fail(sel) { MV.$$(sel).forEach(function (e) { e.textContent = '—'; }); }

  /* Hero globe + stars */
  var globe = null;
  if ($('#globe')) globe = window.MVGlobe.mount($('#globe'));
  if ($('#stars')) window.MVGlobe.stars($('#stars'));

  /* Stats */
  MV.stats().then(function (s) {
    var map = { contributors: s.contributors, countries: s.countries, ideas: s.ideas, votes: s.votes };
    Object.keys(map).forEach(function (k) { var el = $('[data-stat="' + k + '"]'); if (el) MV.countUp(el, map[k], { duration: 2000 }); });
    var live = $('#live-note-t');
    if (live) {
      if (!s.contributors) live.textContent = MV.t('live.zero', 'We are at the very beginning: no one has registered yet. These counters show real registrations only — the first name on the board could be yours.');
      else live.textContent = MV.t('live.some', 'Live from the database — real registrations only. Next milestone: {n} contributors.', { n: MV.num(s.next_milestone || s.contributors) });
    }
    // mission ring: progress to the next genuine milestone
    var ring = $('#ring-v'), rt = $('#ring-t'), rs = $('#ring-s');
    if (ring && s.next_milestone) {
      var C = 2 * Math.PI * 42, frac = Math.min(s.contributors / s.next_milestone, 1);
      ring.setAttribute('stroke-dasharray', C); ring.setAttribute('stroke-dashoffset', C);
      MV.onVisible(ring, function () { requestAnimationFrame(function () { ring.setAttribute('stroke-dashoffset', C * (1 - frac)); }); });
      rt.textContent = MV.num(s.contributors) + ' / ' + MV.num(s.next_milestone);
      rs.textContent = MV.t('ring.s', 'contributors toward the next public milestone');
    }
    var fr = $('[data-founding]'); if (fr) MV.countUp(fr, s.founding_remaining, { duration: 1600 });
    var ms = $('#milestones');
    if (ms) ms.innerHTML = s.milestones.length ? s.milestones.map(function (m) { return '<span class="pill gold">' + MV.num(m.threshold) + ' contributors · ' + esc(MV.date(m.reached_at)) + '</span>'; }).join('') : '';
  }).catch(function () { fail('[data-stat]'); var n = $('#live-note-t'); if (n) n.textContent = MV.t('live.fail', 'Live figures are temporarily unavailable.'); });

  /* Mission: €1 trillion is the ambition, shown as a target — not a balance */
  var big = $('#target-n');
  if (big) MV.onVisible(big, function () { MV.countUp(big, 1e12, { duration: 2600, format: function (n) { return '€' + MV.num(n); } }); });

  /* Countries: map, panel, search, leaderboards */
  MV.board().then(function (rows) {
    if (globe) globe.setNodes(rows.filter(function (r) { return r.contributors > 0; }).map(function (r) { return { lat: r.lat, lng: r.lng, n: r.contributors, name: r.name }; }));
    var mapBox = $('#map'), panel = $('#cpanel');
    if (mapBox) {
      var mapRef = null;
      var pick = function (r) { window.MVMap.panel(panel, r); if (mapRef) mapRef.select(r.code, true); };
      MV.onVisible(mapBox, function () {
        window.MVMap.mount(mapBox, rows, { onSelect: function (r) { window.MVMap.panel(panel, r); } }).then(function (m) { mapRef = m; });
      }, '0px 0px 40% 0px');
      window.MVMap.find($('#find'), $('#find-list'), rows, pick);
      window.MVMap.panel(panel, null);
    }
    MV.$$('[data-board]').forEach(function (el) { window.MVMap.board(el, rows, { limit: Number(el.getAttribute('data-board')) || 10 }); });
    var cc = $('#board-count'); if (cc) { var n = rows.filter(function (r) { return r.contributors > 0; }).length; cc.textContent = n ? MV.t('board.count', '{n} countries ranked so far', { n: n }) : ''; }
  }).catch(function () { MV.$$('[data-board]').forEach(function (el) { el.innerHTML = '<div class="board-empty"><b>' + esc(MV.t('board.fail.t', 'The board could not be loaded.')) + '</b>' + esc(MV.t('board.fail.d', 'Please refresh in a moment.')) + '</div>'; }); });

  /* Priorities */
  if ($('#priorities-root')) window.MVVote.mount($('#priorities-root'));

  /* Join */
  if ($('#joinbox')) window.MVJoin.mount($('#joinbox'));

  /* Spread: personal link when signed in, generic invitation otherwise */
  var sp = $('#spread-root');
  if (sp) {
    var url = MV.SITE + '/', cardEl = $('#card-canvas');
    var setCard = function (o) {
      window.MVShare.card(o).then(function (cv) {
        cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', 'Your Trillion Euro share graphic'); cv.id = 'card-canvas';
        var old = $('#card-canvas'); if (old) old.replaceWith(cv); else $('#card-slot').appendChild(cv);
        var dl = $('#card-dl'), sh = $('#card-share');
        if (dl) dl.onclick = function () { window.MVShare.download(cv, 'trillion-euro.png'); if (MV.session()) MV.rpc('mv_log_invite', { p_channel: 'card' }, { auth: true }).catch(function () {}); };
        if (sh) sh.onclick = function () { window.MVShare.shareFile(cv, MV.shareText(), url).catch(function () {}); };
      });
    };
    if (MV.session()) {
      MV.dashboard().then(function (d) {
        if (!d.has_profile) { setCard({}); MV.bindShare($('#share-btns'), { url: url, kind: 'spread' }); return; }
        url = MV.SITE + '/?ref=' + d.referral.code;
        $('#ref-link').value = url; $('#ref-signed').hidden = false; $('#ref-anon').hidden = true;
        var set = function (k, v) { var e = $('[data-r="' + k + '"]'); if (e) e.textContent = v; };
        set('invites', MV.num(d.referral.invites)); set('registered', MV.num(d.referral.successful)); set('rank', d.referral.rank ? '#' + d.referral.rank : '—');
        MV.bindShare($('#share-btns'), { url: url, kind: 'referral', onLog: function (n) { set('invites', MV.num(n)); } });
        var c = (window.__rows || []).filter(function (r) { return r.code === d.profile.country_code; })[0];
        setCard({ tag: d.profile.founding_number ? (d.profile.is_founding ? 'Founding Contributor Nº ' + MV.pad(d.profile.founding_number) : 'Contributor Nº ' + MV.pad(d.profile.founding_number)) : 'Contributor', countryCode: d.profile.country_code, lat: c && c.lat, lng: c && c.lng });
        MV.board().then(function (rows) { var r = rows.filter(function (x) { return x.code === d.profile.country_code; })[0]; if (r) setCard({ tag: d.profile.is_founding ? 'Founding Contributor Nº ' + MV.pad(d.profile.founding_number) : 'Contributor Nº ' + MV.pad(d.profile.founding_number), countryCode: r.code, lat: r.lat, lng: r.lng }); });
      }).catch(function () { setCard({}); MV.bindShare($('#share-btns'), { url: url, kind: 'spread', log: false }); });
    } else {
      setCard({});
      MV.bindShare($('#share-btns'), { url: url, kind: 'spread', log: false });
      var ra = $('#ref-anon'); if (ra) ra.hidden = false;
    }
    var cp = $('#ref-copy'); if (cp) cp.onclick = function () { MV.copy($('#ref-link').value); if (MV.session()) MV.rpc('mv_log_invite', { p_channel: 'copy' }, { auth: true }).catch(function () {}); };
  }
})();
