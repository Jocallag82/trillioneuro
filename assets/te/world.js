/* World participation map: equirectangular point map of every country (dataset
   coordinates), gold where verified entries exist. Keyboard-focusable points with
   accessible names; a list/table alternative is always rendered alongside. */
(function () {
  'use strict';
  function render(el, rows, opts) {
    opts = opts || {};
    var W = 1000, H = 500, max = 1;
    rows.forEach(function (r) { if (r.entries > max) max = r.entries; });
    var g = '';
    for (var lon = -150; lon <= 150; lon += 30) g += '<line class="grat" x1="' + x(lon) + '" y1="0" x2="' + x(lon) + '" y2="' + H + '"/>';
    for (var lat = -60; lat <= 60; lat += 30) g += '<line class="grat" x1="0" y1="' + y(lat) + '" x2="' + W + '" y2="' + y(lat) + '"/>';
    var pts = '', halos = '';
    rows.slice().sort(function (a, b) { return a.entries - b.entries; }).forEach(function (r) {
      if (r.lat == null || r.lng == null) return;
      var on = r.entries > 0;
      var rad = on ? 3.5 + 12 * Math.sqrt(r.entries / max) : 2.2;
      var label = r.name + ': ' + (on ? r.entries + ' verified ' + (r.entries === 1 ? 'entry' : 'entries') : 'no entries yet');
      if (on) halos += '<circle class="halo" cx="' + x(r.lng) + '" cy="' + y(r.lat) + '" r="' + (rad * 2.2).toFixed(1) + '"/>';
      pts += '<a href="/countries/' + r.code + '" tabindex="' + (on ? 0 : -1) + '" aria-label="' + TE.esc(label) + '">' +
        '<circle class="c' + (on ? ' on' : '') + '" cx="' + x(r.lng) + '" cy="' + y(r.lat) + '" r="' + rad.toFixed(1) + '" data-l="' + TE.esc(label) + '"/></a>';
    });
    el.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="xMidYMid meet" focusable="false">' + g + halos + pts + '</svg><div class="world-tip" aria-hidden="true"></div>';
    var tip = el.querySelector('.world-tip');
    function show(c) {
      var b = el.getBoundingClientRect(), cb = c.getBoundingClientRect();
      tip.textContent = c.getAttribute('data-l');
      tip.style.left = (cb.left - b.left + cb.width / 2) + 'px'; tip.style.top = (cb.top - b.top) + 'px'; tip.style.opacity = 1;
    }
    el.addEventListener('mouseover', function (e) { if (e.target.matches('circle.c')) show(e.target); });
    el.addEventListener('focusin', function (e) { var c = e.target.querySelector && e.target.querySelector('circle.c'); if (c) show(c); });
    el.addEventListener('mouseout', function () { tip.style.opacity = 0; });
    el.addEventListener('focusout', function () { tip.style.opacity = 0; });
    function x(lng) { return ((lng + 180) / 360 * W).toFixed(1); }
    function y(lat) { return ((90 - lat) / 180 * H).toFixed(1); }
  }
  window.TEWorld = { render: render };
})();
