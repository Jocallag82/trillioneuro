/* Branded share graphics, drawn on a canvas in the browser (no server, no image service). 1080×1350 works on every
   network's feed. Only ever contains what is genuinely true for that person/country at that moment. */
(function () {
  'use strict';
  var MV = window.MV, landP = null;
  function land() {
    return landP || (landP = fetch('/assets/mv/land.json').then(function (r) { return r.json(); }).then(function (m) {
      var bin = atob(m.land), out = [];
      for (var i = 0; i < m.lw * m.lh; i++) if (bin.charCodeAt(i >> 3) & (1 << (i & 7))) out.push([90 - ((i / m.lw | 0) + 0.5) * 1.5, -180 + (i % m.lw + 0.5) * 1.5]);
      return out;
    }));
  }
  function fonts() {
    return Promise.all(['600 60px "Fraunces"', '500 60px "Fraunces"', 'italic 400 40px "Fraunces"', '600 24px "Inter Tight"'].map(function (f) { return document.fonts.load(f); }).concat(document.fonts.load('40px "Twemoji Flags"', '\u{1F1EE}\u{1F1EA}'))).catch(function () {});
  }
  function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }

  // o: { kind, number, countryCode, countryName, lat, lng, line1, line2 }
  function card(o) {
    return Promise.all([land(), fonts()]).then(function (r) {
      var pts = r[0], W = 1080, H = 1350, cv = document.createElement('canvas'); cv.width = W; cv.height = H;
      var c = cv.getContext('2d');
      var g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0d1f4a'); g.addColorStop(.55, '#050b1d'); g.addColorStop(1, '#02040b'); c.fillStyle = g; c.fillRect(0, 0, W, H);
      for (var i = 0; i < 90; i++) { c.fillStyle = 'rgba(190,215,255,' + (0.15 + (i % 5) * 0.08) + ')'; c.fillRect((i * 173 + 40) % W, (i * 97 + 20) % 760, 1.6 + i % 3 * .6, 1.6 + i % 3 * .6); }
      var cx = 540, cy = 560, R = 330, rot = ((o.lng == null ? -25 : o.lng)) * Math.PI / 180, tilt = ((o.lat == null ? 20 : o.lat) * 0.55) * Math.PI / 180;
      var h = c.createRadialGradient(cx, cy, R * .8, cx, cy, R * 1.7); h.addColorStop(0, 'rgba(59,140,255,.38)'); h.addColorStop(1, 'rgba(59,140,255,0)'); c.fillStyle = h; c.fillRect(0, 0, W, 1000);
      var b = c.createRadialGradient(cx - 110, cy - 130, 30, cx, cy, R); b.addColorStop(0, '#12306d'); b.addColorStop(1, '#040c22'); c.fillStyle = b; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
      c.strokeStyle = 'rgba(108,195,255,.6)'; c.lineWidth = 2; c.stroke();
      function proj(lat, lng) {
        var p = lat * Math.PI / 180, l = lng * Math.PI / 180 - rot, x = Math.cos(p) * Math.sin(l), y = Math.sin(p), z = Math.cos(p) * Math.cos(l);
        var y2 = y * Math.cos(tilt) - z * Math.sin(tilt), z2 = y * Math.sin(tilt) + z * Math.cos(tilt); return [cx + x * R, cy - y2 * R, z2];
      }
      pts.forEach(function (p) { var q = proj(p[0], p[1]); if (q[2] < 0) return; c.fillStyle = 'rgba(' + (130 + 80 * q[2] | 0) + ',' + (180 + 50 * q[2] | 0) + ',255,' + (.2 + .65 * q[2]).toFixed(2) + ')'; c.fillRect(q[0] - 1.6, q[1] - 1.6, 3.2, 3.2); });
      if (o.lat != null) {
        var q = proj(o.lat, o.lng), gg = c.createRadialGradient(q[0], q[1], 0, q[0], q[1], 70); gg.addColorStop(0, 'rgba(243,216,148,.95)'); gg.addColorStop(1, 'rgba(243,216,148,0)'); c.fillStyle = gg; c.beginPath(); c.arc(q[0], q[1], 70, 0, 7); c.fill();
        c.fillStyle = '#fff3cf'; c.beginPath(); c.arc(q[0], q[1], 9, 0, 7); c.fill();
      }
      var l = c.createRadialGradient(cx, cy, R * .55, cx, cy, R); l.addColorStop(0, 'rgba(0,0,0,0)'); l.addColorStop(1, 'rgba(2,6,20,.6)'); c.fillStyle = l; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();

      c.textBaseline = 'alphabetic'; c.fillStyle = '#eaf0ff'; c.font = '600 46px "Fraunces", Georgia, serif'; c.fillText('Trillion', 72, 112);
      var tw = c.measureText('Trillion').width; c.fillStyle = '#d8b46a'; c.fillText('€', 72 + tw, 112); var ew = c.measureText('€').width; c.fillStyle = '#eaf0ff'; c.fillText('uro', 72 + tw + ew, 112);

      var tag = o.tag; if (tag) {
        c.font = '600 27px "Inter Tight", system-ui, sans-serif'; var label = tag.toUpperCase(), fl = o.countryCode ? MV.flag(o.countryCode) + '  ' : '';
        var wl = c.measureText(label).width + (fl ? 62 : 0) + 60; rr(c, 72, 930, Math.min(wl, W - 144), 70, 35); c.fillStyle = 'rgba(216,180,106,.14)'; c.fill(); c.strokeStyle = 'rgba(216,180,106,.7)'; c.lineWidth = 2; c.stroke();
        var x = 102; if (fl) { c.font = '34px "Twemoji Flags", "Inter Tight", sans-serif'; c.fillStyle = '#fff'; c.fillText(MV.flag(o.countryCode), x, 978); x += 62; }
        c.font = '600 27px "Inter Tight", system-ui, sans-serif'; c.fillStyle = '#f3d894'; c.fillText(label, x, 977);
      }
      c.fillStyle = '#eaf0ff'; c.font = '500 86px "Fraunces", Georgia, serif';
      var lines = o.lines || ['ONE TRILLION.', 'ONE WORLD.', 'A BETTER FUTURE.'], y = 1080;
      lines.forEach(function (t, i) { if (i === lines.length - 1) { var gr = c.createLinearGradient(72, 0, 900, 0); gr.addColorStop(0, '#f3d894'); gr.addColorStop(1, '#6cc3ff'); c.fillStyle = gr; } c.fillText(t, 72, y); y += 92; });
      c.fillStyle = '#93a0c0'; c.font = '600 24px "Inter Tight", system-ui, sans-serif'; c.fillText('JOIN FREE · TRILLIONEURO.COM', 72, 1306);
      c.textAlign = 'right'; c.font = '500 20px "Inter Tight", system-ui, sans-serif'; c.fillText('A long-term mission — not an investment', W - 72, 1306); c.textAlign = 'left';
      return cv;
    });
  }
  function blob(cv) { return new Promise(function (res) { cv.toBlob(res, 'image/png'); }); }
  function download(cv, name) { var a = document.createElement('a'); a.download = name || 'trillion-euro.png'; a.href = cv.toDataURL('image/png'); document.body.appendChild(a); a.click(); a.remove(); }
  function shareFile(cv, text, url) {
    return blob(cv).then(function (b) {
      var f = new File([b], 'trillion-euro.png', { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [f] })) return navigator.share({ files: [f], text: text, url: url });
      download(cv); return null;
    });
  }
  window.MVShare = { card: card, download: download, shareFile: shareFile };
})();
