(function () {
  'use strict';
  var T = window.TE, box = T.$('#manage');
  var key = (location.hash.match(/k=([0-9a-f]{48})/) || [])[1];
  if (key) load();
  window.addEventListener('hashchange', function () {
    var k = (location.hash.match(/k=([0-9a-f]{48})/) || [])[1];
    if (k && k !== key) { key = k; load(); }
  });
  function load() {
    box.innerHTML = '<span class="skeleton" style="display:block;height:120px"></span>';
    T.rpc('te_manage_get', { p_key: key }).then(render).catch(function (e) {
      box.innerHTML = '<div class="notice warn" role="alert">' + T.esc(e.message) + ' Use the request form below instead.</div>';
    });
  }
  function render(m) {
    var e = m.entry;
    box.innerHTML = '<div class="card"><p class="entry-no">' + T.esc(T.no(e.entry_number)) + (m.status !== 'active' ? ' · ' + T.esc(m.status) : '') + '</p>' +
      '<h2 style="font-size:36px;margin:8px 0 16px">' + T.esc(e.nickname) + '</h2>' +
      '<form id="mf">' +
      (m.real_name ? '<label class="check"><input type="checkbox" id="m-real"' + (m.show_real_name ? ' checked' : '') + '> <span>Show my real name (“' + T.esc(m.real_name) + '”) publicly</span></label>' : '') +
      (m.message ? '<label class="check"><input type="checkbox" id="m-msg"' + (m.message_hidden ? ' checked' : '') + '> <span>Hide my message from the public record</span></label>' : '') +
      '<label class="check"><input type="checkbox" id="m-ref"' + (m.public_referrals ? ' checked' : '') + '> <span>Show my referral count and title publicly</span></label>' +
      '<button class="btn btn-gold btn-sm" type="submit">Save changes</button></form>' +
      '<hr class="rule" style="margin:24px 0">' +
      '<p class="small"><strong>Referrals:</strong> ' + T.num(m.referred_entries) + ' verified entries · ' + T.num(m.referral_clicks) + ' counted visits · ' + T.num(m.referral_flagged) + ' visits not counted (duplicates, bots or bursts)</p>' +
      '<div class="share-row"><input type="text" readonly value="' + T.esc(T.SITE + '/?ref=' + m.ref_code) + '" aria-label="Referral link" style="flex:1;min-width:200px"></div>' +
      '<p class="small" style="margin-top:16px"><a href="/record/' + e.entry_number + '">View public entry</a> · To change your nickname, country or message text, or to remove your entry, use the request form below.</p></div>';
    T.$('#mf').addEventListener('submit', function (ev) {
      ev.preventDefault();
      T.rpc('te_manage_update', { p_key: key, p_show_real_name: T.$('#m-real') ? T.$('#m-real').checked : null,
        p_message_hidden: T.$('#m-msg') ? T.$('#m-msg').checked : null, p_public_referrals: T.$('#m-ref').checked })
        .then(function (m2) { render(m2); T.toast('Saved'); }).catch(function (e2) { T.toast(e2.message); });
    });
  }
  var rf = T.$('#req');
  var pre = T.qs('entry'); if (pre) T.$('#r-entry').value = pre;
  rf.addEventListener('submit', function (ev) {
    ev.preventDefault();
    var email = T.$('#r-email').value.trim();
    if (!/^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/.test(email)) { T.$('#r-err').textContent = 'Enter the email you used.'; T.$('#r-email').focus(); return; }
    T.$('#r-err').textContent = '';
    var n = parseInt(T.$('#r-entry').value, 10);
    T.rpc('te_privacy_request', { p_email: email, p_kind: T.$('#r-kind').value, p_entry: n > 0 ? n : null, p_details: T.$('#r-details').value })
      .then(function () { rf.outerHTML = '<p class="notice ok" role="status">Request received. We’ll reply to ' + T.esc(email) + ' — within 30 days at the latest.</p>'; })
      .catch(function (e) { T.$('#r-err').textContent = e.message; });
  });
})();
