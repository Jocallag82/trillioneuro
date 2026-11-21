/* Interactive world map + country leaderboard. All figures come from mv_country_board() (real registrations).
   Every country is selectable: those with a polygon at 50m scale are shapes, the rest (small states) are dots,
   and a search box covers keyboard / screen-reader use. */
(function () {
  'use strict';
  var MV = window.MV, esc = MV.esc, geoP = null;
  function geo() { return geoP || (geoP = fetch('/assets/mv/world.json').then(function (r) { return r.json(); })); }
  var NS = 'http://www.w3.org/2000/svg';

  function mountMap(box, rows, o) {
    o = o || {};
    return geo().then(function (g) {
      var byCode = {}, max = 1; rows.forEach(function (r) { byCode[r.code] = r; if (r.contributors > max) max = r.contributors; });
      var s = '<svg class="map-svg" viewBox="0 0 ' + g.w + ' ' + g.h + '" role="group" aria-label="' + esc(MV.t('map.label', 'World map of contributor communities. Select a country.')) + '" focusable="false">';
      s += '<path class="grat" d="' + g.grat + '"/>';
      var dots = '', pulses = '';
      Object.keys(g.paths).forEach(function (code) {
        var r = byCode[code]; if (!r) return;
        var on = r.contributors > 0, op = on ? (0.45 + 0.5 * Math.sqrt(r.contributors / max)).toFixed(2) : '';
        s += '<path d="' + g.paths[code] + '" data-c="' + code + '" class="' + (on ? 'on' : '') + '" role="button" tabindex="-1" aria-label="' + esc(r.name + ': ' + (on ? MV.num(r.contributors) + ' contributors' : 'no contributors yet')) + '"' + (on ? ' style="fill-opacity:' + op + '"' : '') + '/>';
      });
      rows.forEach(function (r) {
        if (g.paths[r.code] || !g.pts[r.code]) return; var p = g.pts[r.code], on = r.contributors > 0;
        dots += '<circle class="dot' + (on ? ' on' : '') + '" data-c="' + r.code + '" cx="' + p[0] + '" cy="' + p[1] + '" r="' + (on ? 4.2 : 2.9) + '" role="button" tabindex="-1" aria-label="' + esc(r.name + ': ' + (on ? MV.num(r.contributors) + ' contributors' : 'no contributors yet')) + '"/>';
      });
      rows.forEach(function (r) { if (r.contributors > 0 && g.pts[r.code]) pulses += '<circle class="pulse" cx="' + g.pts[r.code][0] + '" cy="' + g.pts[r.code][1] + '" r="9" style="animation-delay:' + ((r.code.charCodeAt(0) % 9) * 0.3) + 's"/>'; });
      box.innerHTML = s + dots + pulses + '</svg><div class="map-tip" aria-hidden="true"></div>';
      var svg = box.querySelector('svg'), tip = box.querySelector('.map-tip'), cur = null;
      function sel(code, silent) {
        if (cur) cur.classList.remove('sel');
        cur = svg.querySelector('[data-c="' + code + '"]'); if (cur) cur.classList.add('sel');
        if (!silent && o.onSelect) o.onSelect(byCode[code]);
      }
      function showTip(el) {
        var r = byCode[el.getAttribute('data-c')]; if (!r) return;
        var b = box.getBoundingClientRect(), c = el.getBoundingClientRect();
        tip.innerHTML = '<span class="flag">' + MV.flag(r.code) + '</span> ' + esc(r.name) + ' · <b>' + MV.num(r.contributors) + '</b>';
        tip.style.left = Math.min(Math.max(c.left - b.left + c.width / 2, 70), b.width - 70) + 'px'; tip.style.top = (c.top - b.top) + 'px'; tip.style.opacity = 1;
      }
      svg.addEventListener('click', function (e) { var t = e.target.closest('[data-c]'); if (t) sel(t.getAttribute('data-c')); });
      svg.addEventListener('keydown', function (e) { if ((e.key === 'Enter' || e.key === ' ') && e.target.getAttribute('data-c')) { e.preventDefault(); sel(e.target.getAttribute('data-c')); } });
      svg.addEventListener('mouseover', function (e) { var t = e.target.closest('[data-c]'); if (t) showTip(t); });
      svg.addEventListener('mouseout', function () { tip.style.opacity = 0; });
      svg.addEventListener('focusin', function (e) { if (e.target.getAttribute && e.target.getAttribute('data-c')) showTip(e.target); });
      svg.addEventListener('focusout', function () { tip.style.opacity = 0; });
      return { select: sel };
    });
  }

  // Search box + native datalist (keyboard and screen-reader route to every country).
  function mountFind(input, list, rows, onPick) {
    list.innerHTML = rows.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (r) { return '<option value="' + esc(r.name) + '"></option>'; }).join('');
    function pick() { var v = input.value.trim().toLowerCase(); var r = rows.filter(function (x) { return x.name.toLowerCase() === v; })[0]; if (r) onPick(r); }
    input.addEventListener('change', pick); input.addEventListener('input', pick);
  }

  function countryPanel(el, r, o) {
    o = o || {};
    if (!r) { el.innerHTML = '<p class="empty-note">' + esc(MV.t('map.pick', 'Select any country on the map — or search for it above — to see its community.')) + '</p>'; return; }
    var has = r.contributors > 0;
    el.innerHTML = '<div class="name"><span class="flag" aria-hidden="true">' + MV.flag(r.code) + '</span><span>' + esc(r.name) + '</span></div>' +
      '<div class="kv"><div><b>' + MV.num(r.contributors) + '</b><span>Contributors</span></div>' +
      '<div><b>' + (r.rank ? '#' + r.rank : '—') + '</b><span>Global ranking</span></div>' +
      '<div><b>' + (has ? r.pct + '%' : '0%') + '</b><span>Of all contributors</span></div>' +
      '<div><b>' + (has ? '+' + MV.num(r.growth_7d) : '—') + '</b><span>New this week</span></div></div>' +
      (has ? '' : '<p class="empty-note">' + esc(MV.t('map.first', 'No one has joined from {name} yet. The first contributor puts it on the map.', { name: r.name })) + '</p>') +
      '<div class="row-actions"><a class="btn btn-gold btn-sm" href="/join?country=' + r.code + '#join">' + esc(MV.t('map.join', 'Join from {name}', { name: r.name })) + ' <span class="arr">→</span></a>' +
      '<a class="btn btn-ghost btn-sm" href="/countries/' + esc(r.slug) + '">' + esc(MV.t('map.community', 'Community page')) + '</a></div>';
  }

  /* Leaderboard: only countries with real contributors are ranked. */
  function board(el, rows, o) {
    o = o || {};
    var live = rows.filter(function (r) { return r.contributors > 0; }).sort(function (a, b) { return b.contributors - a.contributors || a.name.localeCompare(b.name); });
    if (!live.length) {
      el.innerHTML = '<div class="board-empty"><b>' + esc(MV.t('board.empty.t', 'The board is empty — for now.')) + '</b>' + esc(MV.t('board.empty.d', 'No contributors have registered yet, so no country is ranked. The first person from each country sets its place on this board.')) + '</div>';
      return;
    }
    var top = live[0].contributors, shown = live.slice(0, o.limit || 10);
    el.innerHTML = shown.map(function (r, i) {
      var pos = r.rank || i + 1;
      return '<a class="lrow" href="/countries/' + esc(r.slug) + '"><span class="pos num">' + pos + '</span><span class="fl flag" aria-hidden="true">' + MV.flag(r.code) + '</span>' +
        '<span class="cn">' + esc(r.name) + '<small>' + esc(r.region || '') + ' · ' + r.pct + '% of all contributors</small></span>' +
        '<span class="bar" aria-hidden="true"><i data-w="' + Math.max(2, Math.round(r.contributors / top * 100)) + '"></i></span>' +
        '<span class="ct num"><span data-n="' + r.contributors + '">0</span>' + (r.growth_7d ? '<small>+' + MV.num(r.growth_7d) + ' this week</small>' : '<small>&nbsp;</small>') + '</span></a>';
    }).join('');
    MV.onVisible(el, function () {
      MV.$$('.bar i', el).forEach(function (b, i) { setTimeout(function () { b.style.width = b.getAttribute('data-w') + '%'; }, i * 70); });
      MV.$$('[data-n]', el).forEach(function (n) { MV.countUp(n, Number(n.getAttribute('data-n')), { duration: 1400 }); });
    });
  }

  window.MVMap = { mount: mountMap, find: mountFind, panel: countryPanel, board: board };
})();
