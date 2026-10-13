/* Certificate: HTML rendering (screen + print) and a canvas PNG export.
   All text is drawn with fillText / textContent — never parsed as HTML. */
(function () {
  'use strict';
  var T = window.TE;
  function qrSvg(url) {
    if (!window.qrcode) return '';
    var q = window.qrcode(0, 'M'); q.addData(url); q.make();
    return q.createSvgTag({ cellSize: 4, margin: 0, scalable: true });
  }
  function html(e, opts) {
    opts = opts || {};
    var url = T.SITE + '/record/' + (e.entry_number || '');
    return '<div class="cert" id="cert" role="img" aria-label="Certificate for ' + T.esc(e.nickname) + (e.entry_number ? ', entry ' + e.entry_number : ', preview') + '">' +
      (opts.preview ? '<div class="cert-preview-tag" aria-hidden="true">PREVIEW</div>' : '') +
      '<div class="cert-in">' +
      '<div class="cert-top">TrillionEuro.com · The Founders’ Record</div>' +
      '<div class="cert-title">BEAT ELON.</div>' +
      '<div class="cert-sub">One impossible ambition. A place in the story.</div>' +
      '<div class="cert-no">' + (e.entry_number ? T.esc(T.no(e.entry_number)) : 'Nº ______ · assigned after payment') + '</div>' +
      '<div class="cert-nick">' + T.esc(e.nickname) + '</div>' +
      (e.real_name ? '<div class="cert-real">' + T.esc(e.real_name) + '</div>' : '') +
      '<div class="cert-real">' + T.flag(e.country) + ' ' + T.esc(e.country_name || e.country || '') + '</div>' +
      (e.message ? '<div class="cert-msg">“' + T.esc(e.message) + '”</div>' : '') +
      '<div class="cert-foot"><div>' + (e.entered_at ? 'Verified entry · ' + T.esc(T.date(e.entered_at)) : 'Not yet entered') + '<br>' +
      (e.entry_number ? T.esc(url.replace('https://', '')) : 'Not an investment · no financial return') + '</div>' +
      (e.entry_number ? '<div class="qr" aria-hidden="true">' + qrSvg(url) + '</div>' : '') + '</div>' +
      '</div></div>';
  }

  function wrapLines(ctx, text, maxW, maxLines) {
    var words = String(text).split(/\s+/), lines = [], cur = '';
    words.forEach(function (w) {
      var t = cur ? cur + ' ' + w : w;
      if (ctx.measureText(t).width > maxW && cur) { lines.push(cur); cur = w; } else cur = t;
      // break very long single tokens
      while (ctx.measureText(cur).width > maxW && cur.length > 1) {
        var i = cur.length; while (i > 1 && ctx.measureText(cur.slice(0, i)).width > maxW) i--;
        lines.push(cur.slice(0, i)); cur = cur.slice(i);
      }
    });
    if (cur) lines.push(cur);
    if (lines.length > maxLines) { lines = lines.slice(0, maxLines); lines[maxLines - 1] = lines[maxLines - 1].replace(/.{0,2}$/, '…'); }
    return lines;
  }
  function fitFont(ctx, text, family, weight, size, maxW, min) {
    var s = size; ctx.font = weight + ' ' + s + 'px ' + family;
    while (ctx.measureText(text).width > maxW && s > min) { s -= 2; ctx.font = weight + ' ' + s + 'px ' + family; }
    return s;
  }

  function png(e) {
    var W = 2400, H = 1697;
    var c = document.createElement('canvas'); c.width = W; c.height = H;
    var x = c.getContext('2d');
    var serif = '"Fraunces", Georgia, serif', sans = '"Inter Tight", system-ui, sans-serif', mono = 'ui-monospace, Menlo, Consolas, monospace';
    return (document.fonts ? document.fonts.ready : Promise.resolve()).then(function () {
      x.fillStyle = '#f5efe3'; x.fillRect(0, 0, W, H);
      x.strokeStyle = '#b99852'; x.lineWidth = 3; x.strokeRect(58, 58, W - 116, H - 116);
      x.strokeStyle = '#cdb78a'; x.lineWidth = 1.5; x.strokeRect(78, 78, W - 156, H - 156);
      x.textAlign = 'center'; x.textBaseline = 'alphabetic';
      x.fillStyle = '#7d6430'; x.font = '600 44px ' + sans;
      x.fillText('TRILLIONEURO.COM  ·  THE FOUNDERS’ RECORD', W / 2, 250);
      x.fillStyle = '#141414'; x.font = '500 160px ' + serif; x.fillText('BEAT ELON.', W / 2, 440);
      x.fillStyle = '#5d5446'; x.font = 'italic 400 56px ' + serif; x.fillText('One impossible ambition. A place in the story.', W / 2, 530);
      x.fillStyle = '#7d6430'; x.font = '500 58px ' + mono; x.fillText(T.no(e.entry_number), W / 2, 680);
      x.fillStyle = '#141414'; fitFont(x, e.nickname, serif, '500', 140, W - 400, 60); x.fillText(e.nickname, W / 2, 840);
      var yy = 910;
      x.fillStyle = '#5d5446'; x.font = '400 46px ' + sans;
      if (e.real_name) { x.fillText(e.real_name, W / 2, yy); yy += 66; }
      x.fillText(T.flag(e.country) + '  ' + (e.country_name || e.country), W / 2, yy); yy += 100;
      if (e.message) {
        x.fillStyle = '#2e2a24'; x.font = 'italic 400 54px ' + serif;
        wrapLines(x, '“' + e.message + '”', W - 640, 4).forEach(function (l) { x.fillText(l, W / 2, yy); yy += 76; });
      }
      x.textAlign = 'left'; x.fillStyle = '#5d5446'; x.font = '500 36px ' + sans;
      x.fillText('Verified entry · ' + T.date(e.entered_at), 180, H - 220);
      x.fillText((T.SITE + '/record/' + e.entry_number).replace('https://', ''), 180, H - 170);
      x.fillText('A record of participation. Not an investment; no financial return.', 180, H - 120);
      if (window.qrcode) {
        var q = window.qrcode(0, 'M'); q.addData(T.SITE + '/record/' + e.entry_number); q.make();
        var n = q.getModuleCount(), size = 260, cell = size / n, ox = W - 180 - size, oy = H - 120 - size;
        x.fillStyle = '#141414';
        for (var r = 0; r < n; r++) for (var col = 0; col < n; col++) if (q.isDark(r, col)) x.fillRect(ox + col * cell, oy + r * cell, Math.ceil(cell), Math.ceil(cell));
      }
      return new Promise(function (res) { c.toBlob(res, 'image/png'); });
    });
  }
  function download(e) {
    return png(e).then(function (blob) {
      var a = document.createElement('a'); a.href = URL.createObjectURL(blob);
      a.download = 'trillioneuro-founders-record-' + T.pad(e.entry_number) + '.png';
      document.body.appendChild(a); a.click(); a.remove(); setTimeout(function () { URL.revokeObjectURL(a.href); }, 4000);
      T.track('certificate_download', {});
    });
  }
  window.TECert = { html: html, png: png, download: download };
})();
