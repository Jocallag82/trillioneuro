(function () {
  'use strict';
  var T = window.TE, box = T.$('#entry');
  var m = location.pathname.match(/^\/record\/(\d{1,12})\/?$/);
  if (!m) { box.innerHTML = T.errorBlock('That is not a valid entry number.'); return; }
  var n = parseInt(m[1], 10);
  T.rpc('te_entry', { p_number: n }).then(function (e) {
    if (!e) {
      document.title = 'Entry not found — TrillionEuro.com';
      box.innerHTML = '<div class="empty" style="margin-top:28px"><h3>No public entry ' + T.esc(T.no(n)) + '.</h3><p>This number has not been issued, or the entry is not public. Numbers are only issued after a verified payment.</p><a class="btn btn-line btn-sm" href="/record">Browse the record</a></div>';
      return;
    }
    var url = T.SITE + '/record/' + e.entry_number;
    box.innerHTML = '<div class="join-grid" style="margin-top:28px">' +
      '<div><p class="entry-no" style="font-size:16px">' + T.esc(T.no(e.entry_number)) + ' <span class="badge" style="margin-left:8px">Verified</span>' +
      (e.title ? ' <span class="badge">' + T.esc(e.title) + '</span>' : '') + '</p>' +
      '<h1 style="font-size:clamp(40px,7vw,84px);margin:18px 0 12px;overflow-wrap:anywhere">' + T.esc(e.nickname) + '</h1>' +
      (e.real_name ? '<p class="lede" style="margin-bottom:6px">' + T.esc(e.real_name) + '</p>' : '') +
      '<p class="muted"><a href="/countries/' + T.esc(e.country) + '"><span class="flag" aria-hidden="true">' + T.flag(e.country) + '</span> ' + T.esc(e.country_name) + '</a> · Entered ' + T.esc(T.date(e.entered_at)) + '</p>' +
      (e.message ? '<blockquote class="article-body" style="margin:32px 0;border-left:2px solid var(--gold);padding-left:20px;font-style:italic">“' + T.esc(e.message) + '”</blockquote>' : '') +
      (e.referrals ? '<p class="small muted">Brought ' + T.num(e.referrals) + ' verified ' + (e.referrals === 1 ? 'entry' : 'entries') + ' into the record.</p>' : '') +
      '<div class="share-row" id="share"></div>' +
      '<div class="share-row"><button class="btn btn-line btn-sm" type="button" id="dl">Download PNG</button><button class="btn btn-line btn-sm" type="button" id="pr">Print</button></div>' +
      '<p class="small muted" style="margin-top:32px"><a href="/report?entry=' + e.entry_number + '">Report this entry</a> · <a href="/manage">Is this yours? Manage it</a></p></div>' +
      '<div>' + window.TECert.html(e) + '</div></div>';
    T.shareButtons(T.$('#share'), { url: url, text: T.no(e.entry_number) + ' in the Founders’ Record. BEAT ELON.', kind: 'entry' });
    T.$('#dl').onclick = function () { window.TECert.download(e).catch(function () { T.toast('Download failed — try Print instead'); }); };
    T.$('#pr').onclick = function () { T.track('certificate_print', {}); window.print(); };
  }).catch(function (err) { box.innerHTML = T.errorBlock(err.message); });
})();
