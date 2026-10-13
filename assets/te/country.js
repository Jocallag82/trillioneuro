(function () {
  'use strict';
  var T = window.TE, head = T.$('#country-head'), list = T.$('#list'), pager = T.$('#pager'), PAGE = 24, page = 1;
  var m = location.pathname.match(/^\/countries\/([A-Za-z]{2})\/?$/);
  if (!m) { head.innerHTML = T.errorBlock('Unknown country.'); return; }
  var code = m[1].toUpperCase();
  T.rpc('te_country_stats').then(function (rows) {
    var c = rows.filter(function (r) { return r.code === code; })[0];
    if (!c) { head.innerHTML = '<div class="empty" style="margin-top:24px"><h3>We don’t list that country code.</h3><a class="btn btn-line btn-sm" href="/countries">All countries</a></div>'; return; }
    document.title = c.name + ' in the Founders’ Record — TrillionEuro.com';
    var ranked = rows.filter(function (r) { return r.entries > 0; }).length;
    head.innerHTML = '<p class="kicker" style="margin-top:24px">Country</p><h1 style="font-size:clamp(44px,8vw,96px);margin:14px 0 24px"><span class="flag" aria-hidden="true">' + T.flag(code) + '</span> ' + T.esc(c.name) + '</h1>' +
      '<div class="stats"><div class="stat"><div class="v num">' + T.num(c.entries) + '</div><div class="l">Verified entries</div></div>' +
      '<div class="stat"><div class="v num">' + (c.rank ? '#' + c.rank : '—') + '</div><div class="l">Rank' + (ranked ? ' of ' + ranked : '') + '</div></div>' +
      '<div class="stat"><div class="v num">' + (c.per_million != null ? Number(c.per_million).toLocaleString('en-IE', { maximumFractionDigits: 3 }) : '—') + '</div><div class="l">Per million people</div><div class="s">' +
      (c.population ? 'Population ' + T.num(c.population) + ' (' + c.population_year + ', World Bank)' : 'No sourced population figure') + '</div></div>' +
      '<div class="stat"><div class="v num">' + (c.rank && c.rank_7d ? (c.rank_7d - c.rank > 0 ? '▲' + (c.rank_7d - c.rank) : c.rank_7d - c.rank < 0 ? '▼' + (c.rank - c.rank_7d) : '—') : c.rank ? 'New' : '—') + '</div><div class="l">7-day movement</div></div></div>' +
      '<p class="small muted" style="margin-top:14px">Counts individual participants who chose ' + T.esc(c.name) + '. It is not an endorsement by the country, its government or its people.</p>' +
      '<div class="share-row" id="share"></div>';
    T.shareButtons(T.$('#share'), { url: T.SITE + '/countries/' + code, text: T.flag(code) + ' ' + c.name + ' in the Founders’ Record: ' + c.entries + ' verified ' + (c.entries === 1 ? 'entry' : 'entries') + '. Can we take #1? BEAT ELON.', kind: 'country' });
    load();
  }).catch(function (e) { head.innerHTML = T.errorBlock(e.message); });
  function load() {
    list.innerHTML = T.skeletonCards(3);
    T.rpc('te_record', { p_country: code, p_sort: 'newest', p_limit: PAGE, p_offset: (page - 1) * PAGE }).then(function (r) {
      if (!r.rows.length) { list.innerHTML = '<div class="empty" style="grid-column:1/-1"><h3>No verified entries from here yet.</h3><p>The first one takes this country onto the board.</p><a class="btn btn-gold" href="/join?country=' + code + '">Be the first</a></div>'; pager.innerHTML = ''; return; }
      list.innerHTML = r.rows.map(T.entryCard).join(''); T.reveal(list);
      var pages = Math.ceil(r.total / PAGE);
      pager.innerHTML = pages > 1 ? (page > 1 ? '<button class="btn btn-line btn-sm" data-p="-1">← Previous</button>' : '') + '<span class="small muted">Page ' + page + ' of ' + pages + '</span>' + (page < pages ? '<button class="btn btn-line btn-sm" data-p="1">Next →</button>' : '') : '';
    }).catch(function (e) { list.innerHTML = '<div style="grid-column:1/-1">' + T.errorBlock(e.message) + '</div>'; });
  }
  pager.addEventListener('click', function (e) { var b = e.target.closest('[data-p]'); if (b) { page += parseInt(b.getAttribute('data-p'), 10); load(); } });
})();
