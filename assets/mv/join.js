/* Registration / sign-in / password reset. One component, used on the homepage (#join) and on /join.
   Registration is a single Supabase Auth sign-up; the database turns the sign-up metadata into a contributor profile
   (trigger), validates it again, and attributes the referral. Nothing here is a control — the server re-checks it all. */
(function () {
  'use strict';
  var MV = window.MV, esc = MV.esc;

  function mount(root, o) {
    o = o || {};
    var mode = o.mode || 'join', startedAt = Date.now();
    var hashType = MV.hashType;
    if (hashType === 'recovery') mode = 'newpw';
    else if (MV.qs('mode') === 'signin') mode = 'signin';
    else if (MV.qs('mode') === 'reset') mode = 'reset';

    function field(id, label, input, hint) { return '<div class="fld" id="f-' + id + '"><label for="' + id + '">' + label + '</label>' + input + (hint ? '<div class="hint">' + hint + '</div>' : '') + '<div class="err" id="e-' + id + '" role="alert"></div></div>'; }
    function tabs() {
      return '<div class="tabs" role="tablist" aria-label="Account"><button role="tab" type="button" data-mode="join" aria-selected="' + (mode === 'join') + '">' + esc(MV.t('join.tab.join', 'Join')) + '</button>' +
        '<button role="tab" type="button" data-mode="signin" aria-selected="' + (mode === 'signin' || mode === 'reset') + '">' + esc(MV.t('join.tab.signin', 'Sign in')) + '</button></div>';
    }
    function view() {
      if (MV.session() && mode !== 'newpw') {
        root.innerHTML = '<div class="form glass"><h3>' + esc(MV.t('join.in.t', 'You are signed in.')) + '</h3><p class="muted" style="margin:12px 0 24px">' + esc(MV.t('join.in.d', 'Your contributor dashboard has your status, your invitation link and your votes.')) + '</p>' +
          '<div class="row-actions"><a class="btn btn-gold" href="/dashboard">' + esc(MV.t('nav.dashboard', 'My dashboard')) + ' <span class="arr">→</span></a><button class="btn btn-ghost" type="button" id="so">' + esc(MV.t('join.out', 'Sign out')) + '</button></div></div>';
        MV.$('#so', root).onclick = function () { MV.signOut().then(function () { location.reload(); }); }; return;
      }
      var h = '<div class="form glass">';
      if (mode === 'join') {
        h += tabs() + '<div class="invited" id="invited" role="status"></div><div class="msg" id="msg" role="alert"></div><form id="jf" novalidate autocomplete="on">' +
          '<div class="row2">' + field('fn', esc(MV.t('f.name', 'Full name')), '<input id="fn" name="name" autocomplete="name" maxlength="80" required>') +
          field('dn', esc(MV.t('f.display', 'Display name')) + '<small>' + esc(MV.t('f.opt', 'optional')) + '</small>', '<input id="dn" name="nickname" autocomplete="nickname" maxlength="40">', esc(MV.t('f.display.h', 'Shown to people you invite. Leave blank to stay private.'))) + '</div>' +
          field('em', esc(MV.t('f.email', 'Email address')), '<input id="em" name="email" type="email" autocomplete="email" inputmode="email" maxlength="254" required>') +
          field('co', esc(MV.t('f.country', 'Your country')), '<select id="co" name="country" autocomplete="country" required><option value="">' + esc(MV.t('f.country.ph', 'Choose your country…')) + '</option></select>', esc(MV.t('f.country.h', 'You will join your country’s community. You can change it later.'))) +
          field('pw', esc(MV.t('f.password', 'Password')), '<input id="pw" name="password" type="password" autocomplete="new-password" minlength="10" maxlength="72" required>', esc(MV.t('f.password.h', 'At least 10 characters.'))) +
          '<div class="hp" aria-hidden="true"><label>Website <input id="hp" name="website" tabindex="-1" autocomplete="off"></label></div>' +
          '<label class="chk"><input type="checkbox" id="terms"><span>' + MV.t('f.terms', 'I am 16 or over and I accept the <a href="/terms" target="_blank" rel="noopener">terms</a> and have read the <a href="/privacy" target="_blank" rel="noopener">privacy notice</a>.') + '</span></label><div class="err" id="e-terms" role="alert" style="color:var(--bad);font-size:13.5px;display:none;margin:-6px 0 10px"></div>' +
          '<label class="chk"><input type="checkbox" id="mk"><span>' + esc(MV.t('f.marketing', 'Send me occasional movement updates by email. Optional — unticked by default, and you can change it any time.')) + '</span></label>' +
          '<button class="btn btn-gold" type="submit" style="width:100%;margin-top:10px" id="go">' + esc(MV.t('join.go', 'Become a founding contributor')) + ' <span class="arr">→</span></button>' +
          '<p class="fine">' + esc(MV.t('join.free', 'Free. No payment, ever, to register. We collect your name, email and country to run your account and your country’s community — nothing else.')) + '</p></form></div>';
      } else if (mode === 'signin') {
        h += tabs() + '<div class="msg" id="msg" role="alert"></div><form id="sf" novalidate>' +
          field('em', esc(MV.t('f.email', 'Email address')), '<input id="em" type="email" autocomplete="email" inputmode="email" required>') +
          field('pw', esc(MV.t('f.password', 'Password')), '<input id="pw" type="password" autocomplete="current-password" required>') +
          '<button class="btn btn-gold" type="submit" style="width:100%" id="go">' + esc(MV.t('join.signin', 'Sign in')) + ' <span class="arr">→</span></button>' +
          '<p class="fine"><a href="#" id="forgot" class="link">' + esc(MV.t('join.forgot', 'Forgot your password?')) + '</a></p></form></div>';
      } else if (mode === 'reset') {
        h += '<h3>' + esc(MV.t('join.reset', 'Reset your password')) + '</h3><div class="msg" id="msg" role="alert" style="margin-top:16px"></div><form id="rf" novalidate style="margin-top:18px">' +
          field('em', esc(MV.t('f.email', 'Email address')), '<input id="em" type="email" autocomplete="email" required>') +
          '<button class="btn btn-gold" type="submit" style="width:100%" id="go">' + esc(MV.t('join.reset.go', 'Email me a reset link')) + '</button><p class="fine"><a href="#" id="back" class="link">← ' + esc(MV.t('join.back', 'Back to sign in')) + '</a></p></form></div>';
      } else if (mode === 'newpw') {
        h += '<h3>' + esc(MV.t('join.newpw', 'Choose a new password')) + '</h3><div class="msg" id="msg" role="alert" style="margin-top:16px"></div><form id="nf" novalidate style="margin-top:18px">' +
          field('pw', esc(MV.t('f.password', 'New password')), '<input id="pw" type="password" autocomplete="new-password" minlength="10" maxlength="72" required>', esc(MV.t('f.password.h', 'At least 10 characters.'))) +
          '<button class="btn btn-gold" type="submit" style="width:100%" id="go">' + esc(MV.t('join.newpw.go', 'Save password')) + '</button></form></div>';
      } else if (mode === 'sent') {
        h += '<h3>' + esc(MV.t('join.sent.t', 'Check your inbox.')) + '</h3><p style="color:var(--ink-2);margin:14px 0">' + MV.t('join.sent.d', 'We sent a confirmation link to <b>{email}</b>. Open it to activate your place — your founding number is issued the moment you confirm.', { email: esc(o.email || '') }) + '</p>' +
          '<p class="fine">' + esc(MV.t('join.sent.n', 'Nothing arrived? Check spam, or try again in a few minutes.')) + '</p></div>';
      }
      root.innerHTML = h;
      if (mode === 'join') fillCountries(); bind(); referral();
    }
    function fillCountries() {
      MV.countries().then(function (list) {
        var sel = MV.$('#co', root); if (!sel) return;
        sel.insertAdjacentHTML('beforeend', list.slice().sort(function (a, b) { return a.name.localeCompare(b.name); }).map(function (c) { return '<option value="' + c.code + '">' + esc(c.name) + '</option>'; }).join(''));
        var pre = (MV.qs('country') || o.country || '').toUpperCase(); if (pre) sel.value = pre;
      });
    }
    function referral() {
      var code = MV.getRef(), box = MV.$('#invited', root); if (!code || !box) return;
      MV.rpc('mv_ref_landing', { p_code: code }).then(function (r) {
        if (!r || !r.valid) return;
        box.innerHTML = r.display_name ? MV.t('ref.named', '<b>{name}</b>{from} invited you to join the movement.', { name: esc(r.display_name), from: r.country ? ' from ' + esc(r.country) : '' }) : MV.t('ref.anon', 'A contributor{from} invited you to join the movement.', { from: r.country ? ' from ' + esc(r.country) : '' });
        box.classList.add('show');
      }).catch(function () {});
    }
    function say(kind, text) { var m = MV.$('#msg', root); if (!m) return; m.className = 'msg ' + kind + ' show'; m.textContent = text; m.scrollIntoView({ block: 'nearest', behavior: MV.reduced() ? 'auto' : 'smooth' }); }
    function bad(id, text) { var f = MV.$('#f-' + id, root), e = MV.$('#e-' + id, root); if (id === 'terms') { e.style.display = text ? 'block' : 'none'; e.textContent = text || ''; return; } f.classList.toggle('bad', !!text); e.textContent = text || ''; }
    function busy(on, label) { var b = MV.$('#go', root); if (!b) return; b.disabled = on; if (label) b.setAttribute('data-l', b.getAttribute('data-l') || b.innerHTML), b.innerHTML = on ? esc(label) : b.getAttribute('data-l'); }
    var emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function bind() {
      MV.$$('[data-mode]', root).forEach(function (b) { b.onclick = function () { mode = b.getAttribute('data-mode'); view(); }; });
      var jf = MV.$('#jf', root), sf = MV.$('#sf', root), rf = MV.$('#rf', root), nf = MV.$('#nf', root);
      if (jf) jf.addEventListener('submit', function (e) {
        e.preventDefault(); var ok = true;
        var name = MV.$('#fn', root).value.trim(), email = MV.$('#em', root).value.trim(), cc = MV.$('#co', root).value, pw = MV.$('#pw', root).value;
        bad('fn', name ? '' : MV.t('v.name', 'Please enter your name.')); if (!name) ok = false;
        bad('em', emailRe.test(email) ? '' : MV.t('v.email', 'Please enter a valid email address.')); if (!emailRe.test(email)) ok = false;
        bad('co', cc ? '' : MV.t('v.country', 'Please choose your country.')); if (!cc) ok = false;
        bad('pw', pw.length >= 10 ? '' : MV.t('v.pw', 'Use at least 10 characters.')); if (pw.length < 10) ok = false;
        var terms = MV.$('#terms', root).checked; bad('terms', terms ? '' : MV.t('v.terms', 'Please accept the terms and confirm you are 16 or over.')); if (!terms) ok = false;
        if (!ok) { var first = MV.$('.fld.bad input, .fld.bad select', root); if (first) first.focus(); return; }
        if (MV.$('#hp', root).value) return;                                 // honeypot: silently stop bots
        busy(true, MV.t('join.working', 'Creating your place…'));
        var meta = { mv: '1', full_name: name, display_name: MV.$('#dn', root).value.trim(), country: cc, terms: '1', marketing: MV.$('#mk', root).checked ? '1' : '0', ref: MV.getRef() || '', hp: '', t: String(Date.now() - startedAt) };
        MV.signUp(email, pw, meta, MV.SITE + '/dashboard?welcome=1').then(function (r) {
          MV.track('register', { country: cc });
          if (r.session) { location.href = '/dashboard?welcome=1'; return; }
          o.email = email; mode = 'sent'; view();
        }).catch(function (err) { busy(false); say('err', err.message); });
      });
      if (sf) sf.addEventListener('submit', function (e) {
        e.preventDefault(); var email = MV.$('#em', root).value.trim(), pw = MV.$('#pw', root).value;
        if (!emailRe.test(email) || !pw) { say('err', MV.t('v.creds', 'Enter your email and password.')); return; }
        busy(true, MV.t('join.working2', 'Signing in…'));
        MV.signIn(email, pw).then(function () { location.href = '/dashboard'; }).catch(function (err) { busy(false); say('err', err.message); });
      });
      var fg = MV.$('#forgot', root); if (fg) fg.onclick = function (e) { e.preventDefault(); mode = 'reset'; view(); };
      var bk = MV.$('#back', root); if (bk) bk.onclick = function (e) { e.preventDefault(); mode = 'signin'; view(); };
      if (rf) rf.addEventListener('submit', function (e) {
        e.preventDefault(); var email = MV.$('#em', root).value.trim(); if (!emailRe.test(email)) { say('err', MV.t('v.email', 'Please enter a valid email address.')); return; }
        busy(true, MV.t('join.working3', 'Sending…'));
        MV.recover(email).then(function () { busy(false); say('ok', MV.t('join.reset.ok', 'If that address has an account, a reset link is on its way.')); }).catch(function (err) { busy(false); say('err', err.message); });
      });
      if (nf) nf.addEventListener('submit', function (e) {
        e.preventDefault(); var pw = MV.$('#pw', root).value; if (pw.length < 10) { say('err', MV.t('v.pw', 'Use at least 10 characters.')); return; }
        busy(true, MV.t('join.working4', 'Saving…'));
        MV.setPassword(pw).then(function () { location.href = '/dashboard'; }).catch(function (err) { busy(false); say('err', err.message); });
      });
    }
    view();
  }
  window.MVJoin = { mount: mount };
})();
