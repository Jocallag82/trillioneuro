/* Country community page (/countries/<slug>) and the countries index (/countries). Public aggregates only. */
(function () {
  'use strict';
  var MV = window.MV, $ = MV.$, esc = MV.esc;

  /* ── index: /countries ── */
  var idx = $('#countries-index');
  if (idx) {
    MV.board().then(function (rows) {
      window.MVMap.board($('#idx-board'), rows, { limit: 25 });
      var mapRef = null, panel = $('#cpanel');
      window.MVMap.mount($('#map'), rows, { onSelect: function (r) { window.MVMap.panel(panel, r); } }).then(function (m) { mapRef = m; });
      window.MVMap.find($('#find'), $('#find-list'), rows, function (r) { window.MVMap.panel(panel, r); if (mapRef) mapRef.select(r.code, true); });
      window.MVMap.panel(panel, null);
      $('#dir').innerHTML = rows.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (r) {
        return '<a href="/countries/' + esc(r.slug) + '"><span class="flag">' + MV.flag(r.code) + '</span><span>' + esc(r.name) + '</span><span class="n">' + (r.contributors ? MV.num(r.contributors) : '') + '</span></a>';
      }).join('');
    }).catch(function () { $('#idx-board').innerHTML = '<div class="board-empty"><b>' + esc(MV.t('board.fail.t', 'The board could not be loaded.')) + '</b>' + esc(MV.t('board.fail.d', 'Please refresh in a moment.')) + '</div>'; });
    return;
  }

  /* ── country page ── */
  var root = $('#country-root'); if (!root) return;
  var slug = (location.pathname.match(/\/countries\/([a-z0-9-]+)/) || [])[1];
  var inline = $('#country-data'), first = null;
  try { first = inline ? JSON.parse(inline.textContent) : null; } catch (e) {}

  function spark(series) {
    var max = Math.max.apply(null, series.map(function (s) { return s.n; }).concat([1])), W = 300, H = 70, step = W / (series.length - 1);
    var pts = series.map(function (s, i) { return (i * step).toFixed(1) + ',' + (H - 6 - (s.n / max) * (H - 14)).toFixed(1); });
    var any = series.some(function (s) { return s.n > 0; });
    return '<svg class="spark" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="New contributors per day, last 14 days" preserveAspectRatio="none"><defs><linearGradient id="spg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#6cc3ff" stop-opacity=".4"/><stop offset="1" stop-color="#6cc3ff" stop-opacity="0"/></linearGradient></defs>' +
      (any ? '<polygon points="0,' + H + ' ' + pts.join(' ') + ' ' + W + ',' + H + '" fill="url(#spg)"/><polyline points="' + pts.join(' ') + '" fill="none" stroke="#6cc3ff" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>' : '<line x1="0" y1="' + (H - 6) + '" x2="' + W + '" y2="' + (H - 6) + '" stroke="rgba(120,160,255,.35)" stroke-dasharray="3 5"/>') + '</svg>';
  }
  var NEXT = [10, 100, 1000, 10000, 100000];

  function render(c, rows, pri) {
    var has = c.contributors > 0, url = MV.SITE + '/countries/' + c.slug, ranked = rows.filter(function (r) { return r.contributors > 0; });
    var next = NEXT.filter(function (t) { return t > c.contributors; })[0];
    var perM = has && c.population ? (c.contributors / c.population * 1e6) : null;
    var near = (function () {
      if (!ranked.length) return [];
      var i = ranked.findIndex(function (r) { return r.code === c.code; }); if (i < 0) return ranked.slice(0, 5);
      return ranked.slice(Math.max(0, i - 2), i + 3);
    })();
    var text = has ? MV.t('c.share', '{name} has {n} contributors on Trillion Euro — ranked #{rank} of {m} countries. Join us and help shape what we tackle first.', { name: c.name, n: MV.num(c.contributors), rank: c.rank, m: c.countries_with_contributors })
      : MV.t('c.share0', 'Be the first from {name} to join Trillion Euro — one trillion, one world, a better future.', { name: c.name });
    root.innerHTML =
      '<section class="page-hero"><div class="wrap"><div class="cpage-top"><div><div class="cflag flag" aria-hidden="true">' + MV.flag(c.code) + '</div><span class="kicker">' + esc(MV.t('c.kicker', 'Country community')) + (c.region ? ' · ' + esc(c.region) : '') + '</span>' +
      '<h1 style="margin-top:18px">' + esc(c.name) + '</h1><p class="lede">' + (has ? MV.t('c.lede', '{n} {people} from {name} {have} joined the global movement. Together we are choosing what to tackle first — one trillion, one world.', { n: MV.num(c.contributors), people: c.contributors === 1 ? 'person' : 'people', name: esc(c.name), have: c.contributors === 1 ? 'has' : 'have' }) : MV.t('c.lede0', 'No one has joined from {name} yet. The first contributor sets this community in motion — and puts it on the world map.', { name: esc(c.name) })) + '</p>' +
      '<div class="row-actions"><a class="btn btn-gold" href="/join?country=' + c.code + '#join">' + esc(MV.t('c.join', 'Join from {name}', { name: c.name })) + ' <span class="arr">→</span></a><a class="btn btn-ghost" href="/countries">' + esc(MV.t('c.all', 'All countries')) + '</a></div></div>' +
      '<div class="glass panel"><div class="kv" style="margin-top:0"><div><b class="num" data-n="' + c.contributors + '">0</b><span>Contributors</span></div><div><b>' + (c.rank ? '#' + c.rank : '—') + '</b><span>Global position' + (c.rank ? ' of ' + c.countries_with_contributors : '') + '</span></div><div><b>' + (has ? c.pct + '%' : '0%') + '</b><span>Of all contributors</span></div><div><b>' + (has ? '+' + MV.num(c.growth_7d) : '—') + '</b><span>New this week</span></div></div>' +
      '<div class="lbl small muted">' + esc(MV.t('c.growth', 'New contributors per day · last 14 days')) + '</div>' + spark(c.series) + '</div></div></div></section>' +

      '<section class="sec bg-a"><div class="wrap"><div class="mission-grid"><div class="rv"><span class="kicker">' + esc(MV.t('c.about', 'About this community')) + '</span><h2 style="margin:20px 0 26px;font-size:clamp(28px,4.4vw,52px)">' + esc(MV.t('c.one', 'One movement. Every country.')) + '</h2>' +
      '<p class="lede">' + esc(MV.t('c.global', 'Country communities are not rivals — they are the movement’s local roots. {name} shares one global agenda with every other country, and the priorities below are chosen by all contributors together.', { name: c.name })) + '</p>' +
      '<ul class="perks"><li><div><b>' + MV.num(c.growth_30d) + '</b> ' + esc(MV.t('c.30', 'joined in the last 30 days')) + '</div></li><li><div><b>' + MV.num(c.votes_cast) + '</b> ' + esc(MV.t('c.votes', 'votes cast by contributors here')) + '</div></li>' +
      (perM != null ? '<li><div><b>' + perM.toFixed(perM < 10 ? 2 : 1) + '</b> ' + esc(MV.t('c.pm', 'contributors per million people (population: World Bank, 2018)')) + '</div></li>' : '') + '</ul>' +
      (next ? '<p class="small muted">' + esc(MV.t('c.next', 'Next community milestone: {t} contributors — {left} to go.', { t: MV.num(next), left: MV.num(next - c.contributors) })) + '</p>' : '') +
      '<div class="ms">' + c.milestones.map(function (m) { return '<span class="pill gold">' + MV.num(m.threshold) + ' contributors · ' + esc(MV.date(m.reached_at)) + '</span>'; }).join('') + '</div></div>' +
      '<div class="rv" style="--d:1"><div class="glass panel"><h3>' + esc(MV.t('c.pri', 'Shared global priorities')) + '</h3><p class="muted small" style="margin:8px 0 18px">' + esc(MV.t('c.pri.d', 'What the whole movement is voting on. One vote per contributor.')) + '</p><div id="c-pri"></div><a class="link" href="/#priorities">' + esc(MV.t('c.pri.go', 'See all priorities and vote')) + ' →</a></div></div></div></div></section>' +

      '<section class="sec bg-b"><div class="wrap"><div class="sec-head rv"><span class="kicker">' + esc(MV.t('c.near', 'Standings')) + '</span><h2>' + esc(MV.t('c.near.h', 'Countries rise together')) + '</h2></div><div class="board rv" id="c-board"></div></div></section>' +

      '<section class="sec bg-a"><div class="wrap"><div class="spread"><div class="rv"><span class="kicker">' + esc(MV.t('spread.k', 'Spread the movement')) + '</span><h2 style="margin:20px 0 22px;font-size:clamp(30px,4.6vw,56px)">' + esc(MV.t('c.inv', 'Bring {name} in.', { name: c.name })) + '</h2><p class="lede">' + esc(MV.t('c.inv.d', 'Share this page with someone in {name}. Every person adds to the same global total.', { name: c.name })) + '</p>' +
      '<div class="linkbox"><input readonly id="c-link" value="' + esc(url) + '" aria-label="Link to this page"><button class="btn btn-gold btn-sm" id="c-copy" type="button">' + esc(MV.t('share.copy', 'Copy link')) + '</button></div><div class="shares" id="c-share"></div></div>' +
      '<div class="rv" style="--d:1"><div class="cardprev glass" id="c-card"></div><div class="row-actions" style="justify-content:center"><button class="btn btn-ghost btn-sm" id="c-dl" type="button">' + esc(MV.t('card.dl', 'Download image')) + '</button></div></div></div></div></section>';
    MV.reveal(root);
    MV.onVisible($('[data-n]', root), function () { MV.$$('[data-n]', root).forEach(function (n) { MV.countUp(n, Number(n.getAttribute('data-n'))); }); });
    window.MVMap.board($('#c-board'), near.length ? near : rows, { limit: 5 });
    MV.bindShare($('#c-share'), { url: url, text: text, kind: 'country', log: false });
    $('#c-copy').onclick = function () { MV.copy(url); };
    if (pri) {
      var tp = pri.ideas.slice().sort(function (a, b) { return b.votes - a.votes; }).slice(0, 3);
      $('#c-pri').innerHTML = pri.total_votes ? tp.map(function (i) { return '<div style="margin-bottom:16px"><div class="vmeta"><span>' + esc(i.title) + '</span><span class="num">' + i.pct + '%</span></div><div class="bar"><i data-w="' + i.pct + '"></i></div></div>'; }).join('') : '<p class="muted">' + esc(MV.t('c.pri.zero', 'No votes have been cast yet. Contributors choose the first priorities.')) + '</p>';
      MV.onVisible($('#c-pri'), function () { MV.$$('#c-pri .bar i').forEach(function (b) { b.style.width = b.getAttribute('data-w') + '%'; }); });
    }
    window.MVShare.card({ tag: has && c.rank ? c.name + ' · #' + c.rank + ' of ' + c.countries_with_contributors : c.name, countryCode: c.code, lat: c.lat, lng: c.lng, lines: has ? ['ONE TRILLION.', 'ONE WORLD.', 'A BETTER FUTURE.'] : ['BE THE FIRST.', 'ONE WORLD.', 'A BETTER FUTURE.'] }).then(function (cv) {
      cv.setAttribute('role', 'img'); cv.setAttribute('aria-label', c.name + ' on Trillion Euro'); $('#c-card').appendChild(cv); $('#c-dl').onclick = function () { window.MVShare.download(cv, 'trillion-euro-' + c.slug + '.png'); };
    });
  }

  Promise.all([first ? Promise.resolve(first) : MV.rpc('mv_country', { p_slug: slug }), MV.board(), MV.rpc('mv_priorities', {}).catch(function () { return null; })]).then(function (r) {
    if (!r[0]) { root.innerHTML = '<section class="page-hero"><div class="wrap"><h1>Country not found</h1><p class="lede"><a class="link" href="/countries">See all countries</a></p></div></section>'; return; }
    var pop = (r[1].filter(function (x) { return x.code === r[0].code; })[0] || {}).population;
    var rows = r[1]; var meta = null;
    MV.countries().then(function (list) { var m = list.filter(function (x) { return x.code === r[0].code; })[0]; r[0].population = m && m.pop; render(r[0], rows, r[2]); });
  }).catch(function () { root.innerHTML = '<section class="page-hero"><div class="wrap"><h1>Something went wrong</h1><p class="lede">This community could not be loaded. Please refresh in a moment.</p></div></section>'; });
})();
