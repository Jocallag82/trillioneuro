(function () {
  'use strict';
  var T = window.TE, EMAIL = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;
  var rp = T.$('#report');
  if (rp) {
    var pre = T.qs('entry'); if (pre) T.$('#rp-entry').value = pre;
    rp.addEventListener('submit', function (e) {
      e.preventDefault();
      var n = parseInt(T.$('#rp-entry').value, 10), email = T.$('#rp-email').value.trim();
      if (!(n > 0)) { T.$('#rp-err').textContent = 'Enter the entry number.'; T.$('#rp-entry').focus(); return; }
      if (email && !EMAIL.test(email)) { T.$('#rp-err').textContent = 'That email doesn’t look right.'; T.$('#rp-email').focus(); return; }
      T.rpc('te_report_entry', { p_entry: n, p_reason: T.$('#rp-reason').value, p_details: T.$('#rp-details').value, p_email: email || null })
        .then(function () { rp.outerHTML = '<p class="notice ok" role="status" style="margin-top:32px">Thank you. A person will review entry ' + T.esc(T.no(n)) + '.</p>'; })
        .catch(function (x) { T.$('#rp-err').textContent = x.message; });
    });
  }
  var ct = T.$('#contact');
  if (ct) {
    var tp = T.qs('topic'); if (tp) T.$('#ct-topic').value = tp;
    T.settings().then(function (s) {
      if (s.operator_name) T.$('#operator').textContent = 'Operator: ' + s.operator_name + (s.operator_address ? ', ' + s.operator_address : '');
    }).catch(function () {});
    ct.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = T.$('#ct-email').value.trim(), body = T.$('#ct-body').value.trim();
      if (!EMAIL.test(email)) { T.$('#ct-err').textContent = 'Enter a valid email so we can reply.'; T.$('#ct-email').focus(); return; }
      if (body.length < 5) { T.$('#ct-err').textContent = 'Please write a little more.'; T.$('#ct-body').focus(); return; }
      T.rpc('te_contact', { p_email: email, p_topic: T.$('#ct-topic').value, p_body: body, p_name: T.$('#ct-name').value || null })
        .then(function () { ct.outerHTML = '<p class="notice ok" role="status" style="margin-top:32px">Message received. We’ll reply to ' + T.esc(email) + '.</p>'; })
        .catch(function (x) { T.$('#ct-err').textContent = x.message; });
    });
  }
})();
