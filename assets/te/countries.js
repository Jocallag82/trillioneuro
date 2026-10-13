(function () {
  'use strict';
  var T = window.TE, rows = [], tb = T.$('#ctable tbody');
  function render() {
    var q = T.$('#cq').value.trim().toLowerCase(), sort = T.$('#csort').value, show = T.$('#cshow').value;
    var list = rows.filter(function (r) { return (show === 'all' || r.entries > 0 || q) && (!q || r.name.toLowerCase().indexOf(q) >= 0 || r.code.toLowerCase() === q); });
    if (sort === 'rate') list.sort(function (a, b) { return (b.per_million || -1) - (a.per_million || -1) || a.name.localeCompare(b.name); });
    else if (sort === 'name') list.sort(function (a, b) { return a.name.localeCompare(b.name); });
    if (!list.length) {
      tb.innerHTML = '<tr><td colspan="5"><div class="empty" style="border:0"><h3>' + (q ? 'No country matches “' + T.esc(q) + '”.' : 'No country has a verified entry yet.') + '</h3><p>' +
        (q ? 'Check the spelling or show all countries.' : 'The first verified entry puts its country at number one.') + '</p></div></td></tr>';
      return;
    }
    tb.innerHTML = list.map(function (r) {
      var mv = '', d = r.rank && r.rank_7d ? r.rank_7d - r.rank : null;
      if (r.rank && !r.rank_7d) mv = '<span class="mv-up">new</span>';
      else if (d > 0) mv = '<span class="mv-up">▲ ' + d + '</span>'; else if (d < 0) mv = '<span class="mv-down">▼ ' + (-d) + '</span>'; else if (d === 0) mv = '<span class="muted">—</span>';
      return '<tr><td class="num">' + (r.rank || '<span class="muted">—</span>') + '</td>' +
        '<td><a href="/countries/' + r.code + '"><span class="flag" aria-hidden="true">' + T.flag(r.code) + '</span> ' + T.esc(r.name) + '</a></td>' +
        '<td class="r">' + T.num(r.entries) + '</td>' +
        '<td class="r">' + (r.per_million != null ? Number(r.per_million).toLocaleString('en-IE', { maximumFractionDigits: 3 }) : '<span class="muted" title="No sourced population figure">—</span>') + '</td>' +
        '<td class="r">' + mv + '</td></tr>';
    }).join('');
  }
  T.rpc('te_country_stats').then(function (r) {
    rows = r; window.TEWorld.render(T.$('#world'), rows); render();
  }).catch(function (e) { tb.innerHTML = '<tr><td colspan="5">' + T.errorBlock(e.message) + '</td></tr>'; });
  ['#cq', '#csort', '#cshow'].forEach(function (s) { T.$(s).addEventListener('input', render); });
})();
