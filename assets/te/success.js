(function () {
  'use strict';
  var T = window.TE, box = T.$('#status');
  var sid = T.qs('session_id');
  if (!sid || !/^cs_(test|live)_[A-Za-z0-9]+$/.test(sid)) {
    box.innerHTML = '<p class="kicker">Nothing to confirm</p><h1 style="font-size:clamp(36px,6vw,64px);margin:16px 0">No payment session found.</h1><p class="lede">This page only confirms entries after a Stripe payment. <a href="/join">Start an entry</a>.</p>';
    return;
  }
  var tries = 0, started = Date.now();
  function poll() {
    tries++;
    T.rpc('te_entry_by_session', { p_session: sid }).then(function (r) {
      if (r.status === 'paid' && r.entry) return done(r);
      if (r.status === 'expired' || r.status === 'failed' || r.status === 'cancelled') {
        box.innerHTML = '<p class="kicker">Payment ' + T.esc(r.status) + '</p><h1 style="font-size:clamp(36px,6vw,64px);margin:16px 0">No entry was created.</h1><p class="lede">The payment did not complete, so nothing was issued. If your card was charged, <a href="/contact?topic=payment">contact us</a> and it will be refunded in full.</p><a class="btn btn-gold" href="/join#step-7">Try again</a>';
        return;
      }
      if (Date.now() - started < 90000) return setTimeout(poll, Math.min(1000 + tries * 500, 5000));
      box.innerHTML = '<p class="kicker">Still confirming</p><h1 style="font-size:clamp(36px,6vw,64px);margin:16px 0">We haven’t received confirmation yet.</h1><p class="lede">Stripe has not yet told our server the payment succeeded. Some payment methods take longer. Your number is issued the moment it does — keep this page’s address and reload it later.</p><button class="btn btn-line" onclick="location.reload()">Check again</button>';
    }).catch(function (e) {
      if (Date.now() - started < 90000) return setTimeout(poll, 4000);
      box.innerHTML = T.errorBlock(e.message);
    });
  }
  function done(r) {
    var e = r.entry, url = T.SITE + '/record/' + e.entry_number, ref = T.SITE + '/?ref=' + r.ref_code;
    try { sessionStorage.removeItem('te_join'); } catch (x) {}
    T.track('entry_confirmed', {});
    var manage = r.manage_key ? T.SITE + '/manage#k=' + r.manage_key : null;
    box.innerHTML = '<div class="join-grid"><div><p class="kicker">Payment verified</p>' +
      '<h1 style="font-size:clamp(40px,7vw,80px);margin:16px 0">You’re ' + T.esc(T.no(e.entry_number)) + '.</h1>' +
      '<p class="lede">Your entry is permanent in the Founders’ Record. A receipt comes from Stripe by email.</p>' +
      (manage ? '<div class="notice warn" style="margin:24px 0"><strong>Save your private management link now.</strong> It is shown only once and lets you change what’s public on your entry.<div class="share-row"><input type="text" readonly value="' + T.esc(manage) + '" aria-label="Private management link" style="flex:1;min-width:200px" id="mk"><button class="btn btn-line btn-sm" type="button" id="mkc">Copy</button></div></div>'
        : '<p class="small muted">Your management link was shown when this page first loaded. Lost it? <a href="/manage">Request access</a>.</p>') +
      '<h3 style="margin-top:28px">Share your place</h3><div class="share-row" id="share"></div>' +
      '<div class="share-row"><button class="btn btn-line btn-sm" type="button" id="dl">Download certificate (PNG)</button><a class="btn btn-line btn-sm" href="/record/' + e.entry_number + '">View public entry</a></div>' +
      '<h3 style="margin-top:28px">Your referral link</h3><p class="small muted">Earn recognition titles — Ally, Herald, Standard-Bearer, Vanguard, Legend — for verified entries you bring in. Titles only: never money, commission or reward.</p>' +
      '<div class="share-row"><input type="text" readonly value="' + T.esc(ref) + '" aria-label="Your referral link" style="flex:1;min-width:200px"><button class="btn btn-line btn-sm" type="button" id="refc">Copy</button></div></div>' +
      '<div>' + window.TECert.html(e) + '</div></div>';
    T.shareButtons(T.$('#share'), { url: ref, text: 'I just became ' + T.no(e.entry_number) + ' in the Founders’ Record. BEAT ELON.', kind: 'entry_new' });
    T.$('#dl').onclick = function () { window.TECert.download(e); };
    T.$('#refc').onclick = function () { T.copy(ref); };
    if (manage) T.$('#mkc').onclick = function () { T.copy(manage); };
  }
  poll();
})();
