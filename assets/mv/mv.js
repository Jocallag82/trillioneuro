/* Trillion Euro — core runtime. Dependency-free. Exposes window.MV.
   Auth talks to Supabase Auth (GoTrue) over REST; data goes through the mv_* RPCs only. */
(function () {
  'use strict';
  var SUPABASE_URL = 'https://kxzywyflylkcqoidiqmo.supabase.co';
  var KEY = 'sb_publishable_37yXvakYMXdpz2e3Hf_zng__oGOVC-g';
  var SITE = location.origin;
  var MV = window.MV = { SITE: SITE };
  var d = document;
  d.documentElement.classList.add('js'); d.documentElement.classList.remove('no-js');

  /* ── i18n: English strings live here; a locale file can replace window.MV_STR before this runs ── */
  var STR = window.MV_STR || {};
  MV.t = function (key, fb, vars) {
    var s = STR[key] || fb || key;
    return vars ? s.replace(/\{(\w+)\}/g, function (m, k) { return vars[k] == null ? m : vars[k]; }) : s;
  };

  /* ── helpers ── */
  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  MV.esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); };
  MV.$ = function (s, r) { return (r || d).querySelector(s); };
  MV.$$ = function (s, r) { return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  var nf = new Intl.NumberFormat('en-IE');
  MV.num = function (n) { return nf.format(n || 0); };
  MV.pad = function (n) { return String(n).padStart(6, '0'); };
  MV.flag = function (code) {
    if (!/^[A-Z]{2}$/.test(code || '')) return '';
    return String.fromCodePoint(0x1F1A5 + code.charCodeAt(0), 0x1F1A5 + code.charCodeAt(1));
  };
  MV.reduced = function () { return window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches; };
  MV.qs = function (k) { return new URLSearchParams(location.search).get(k); };
  MV.date = function (v, o) { return v ? new Date(v).toLocaleDateString('en-IE', o || { day: 'numeric', month: 'long', year: 'numeric' }) : ''; };
  MV.ordinal = function (n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

  MV.toast = function (msg) {
    var t = MV.$('#toast');
    if (!t) { t = d.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); d.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2800);
  };
  MV.track = function (name, props) { try { if (window.va) window.va('event', { name: name, data: props || {} }); } catch (e) {} };
  MV.copy = function (text) {
    var p = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject();
    return p.then(function () { MV.toast(MV.t('copied', 'Link copied')); return true; }, function () {
      var ta = d.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.cssText = 'position:fixed;opacity:0';
      d.body.appendChild(ta); ta.select(); var ok = false; try { ok = d.execCommand('copy'); } catch (e) {} ta.remove();
      MV.toast(ok ? MV.t('copied', 'Link copied') : MV.t('copyfail', 'Copy failed — select the link manually')); return ok;
    });
  };

  /* ── session (localStorage; every access guarded) ── */
  var SK = 'mv.session';
  function load() { try { return JSON.parse(localStorage.getItem(SK) || 'null'); } catch (e) { return null; } }
  function save(s) { try { if (s) localStorage.setItem(SK, JSON.stringify(s)); else localStorage.removeItem(SK); } catch (e) {} }
  function toSession(r) {
    if (!r || !r.access_token) return null;
    var exp = r.expires_at ? r.expires_at * 1000 : Date.now() + (r.expires_in || 3600) * 1000;
    return { access_token: r.access_token, refresh_token: r.refresh_token, expires_at: exp, user: r.user ? { id: r.user.id, email: r.user.email } : (load() || {}).user };
  }
  function authErr(r, body) {
    var code = (body && (body.error_code || body.code)) || '', msg = (body && (body.msg || body.message || body.error_description)) || '';
    var m = MV.t('err.generic', 'Something went wrong. Please try again.');
    if (code === 'invalid_credentials' || /invalid login/i.test(msg)) m = MV.t('err.creds', 'That email and password do not match.');
    else if (code === 'email_not_confirmed' || /not confirmed/i.test(msg)) m = MV.t('err.confirm', 'Please confirm your email first — check your inbox for the link.');
    else if (code === 'user_already_exists' || /already registered/i.test(msg)) m = MV.t('err.exists', 'That email is already registered. Try signing in instead.');
    else if (code === 'weak_password' || /password/i.test(msg) && r.status === 422) m = MV.t('err.weak', 'Choose a stronger password (at least 10 characters).');
    else if (code === 'over_request_rate_limit' || code === 'over_email_send_rate_limit' || r.status === 429) m = MV.t('err.rate', 'Too many attempts. Please wait a few minutes and try again.');
    else if (code === 'validation_failed' || /email/i.test(msg) && r.status === 400) m = MV.t('err.email', 'Please enter a valid email address.');
    else if (/database error saving new user/i.test(msg)) m = MV.t('err.signup', 'We could not complete your registration. Check your details and try again.');
    var e = new Error(m); e.status = r.status; e.code = code; return e;
  }
  function authFetch(path, opts) {
    opts = opts || {};
    var h = { apikey: KEY, 'Content-Type': 'application/json' };
    if (opts.token) h.Authorization = 'Bearer ' + opts.token;
    return fetch(SUPABASE_URL + '/auth/v1/' + path, { method: opts.method || 'POST', headers: h, body: opts.body ? JSON.stringify(opts.body) : undefined })
      .then(function (r) { return r.text().then(function (t) { var b = null; try { b = t ? JSON.parse(t) : null; } catch (e) {} if (!r.ok) throw authErr(r, b); return b; }); });
  }
  var refreshing = null;
  MV.session = function () { var s = load(); return s && s.access_token ? s : null; };
  MV.token = function () {
    var s = MV.session(); if (!s) return Promise.resolve(null);
    if (s.expires_at - Date.now() > 60000) return Promise.resolve(s.access_token);
    if (!refreshing) refreshing = authFetch('token?grant_type=refresh_token', { body: { refresh_token: s.refresh_token } })
      .then(function (r) { var n = toSession(r); save(n); return n; }, function (e) { if (e.status >= 400 && e.status < 500) save(null); return null; })
      .then(function (n) { refreshing = null; return n; });
    return refreshing.then(function (n) { return n ? n.access_token : null; });
  };
  MV.signUp = function (email, password, meta, redirectTo) {
    return authFetch('signup' + (redirectTo ? '?redirect_to=' + encodeURIComponent(redirectTo) : ''), { body: { email: email, password: password, data: meta } })
      .then(function (r) { var s = toSession(r); if (s) { save(s); return { session: true }; } return { session: false }; });
  };
  MV.signIn = function (email, password) {
    return authFetch('token?grant_type=password', { body: { email: email, password: password } }).then(function (r) { save(toSession(r)); return true; });
  };
  MV.signOut = function () {
    var s = MV.session(); save(null);
    return s ? authFetch('logout', { token: s.access_token }).catch(function () {}) : Promise.resolve();
  };
  MV.recover = function (email) { return authFetch('recover?redirect_to=' + encodeURIComponent(SITE + '/join?mode=reset'), { body: { email: email } }); };
  MV.setPassword = function (pw) { return MV.token().then(function (t) { if (!t) throw new Error(MV.t('err.session', 'Your session has expired. Please sign in again.')); return authFetch('user', { method: 'PUT', token: t, body: { password: pw } }); }); };
  // Email-confirmation and recovery links arrive as #access_token=…&type=… (implicit flow).
  MV.consumeHash = function () {
    if (!/access_token=/.test(location.hash)) return null;
    var p = new URLSearchParams(location.hash.slice(1)), t = p.get('type');
    if (p.get('access_token')) save(toSession({ access_token: p.get('access_token'), refresh_token: p.get('refresh_token'), expires_in: Number(p.get('expires_in') || 3600), expires_at: Number(p.get('expires_at') || 0) || null }));
    history.replaceState(null, '', location.pathname + location.search);
    return t || 'signin';
  };

  /* ── RPC ── */
  function friendly(msg) {
    var i = String(msg).indexOf(':'), code = i > 0 ? msg.slice(0, i) : '';
    if (/^[A-Z_]+$/.test(code)) return msg.slice(i + 1).trim();
    return MV.t('err.generic', 'Something went wrong. Please try again.');
  }
  MV.rpc = function (fn, args, o) {
    o = o || {};
    return (o.auth ? MV.token() : Promise.resolve(null)).then(function (tok) {
      if (o.auth && !tok) { var e = new Error(MV.t('err.signin', 'Please sign in first.')); e.code = 'AUTH_REQUIRED'; throw e; }
      var h = { apikey: KEY, 'Content-Type': 'application/json' }; if (tok) h.Authorization = 'Bearer ' + tok;
      return fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, { method: 'POST', headers: h, body: JSON.stringify(args || {}) });
    }).then(function (r) {
      return r.text().then(function (t) {
        var b = null; try { b = t ? JSON.parse(t) : null; } catch (e) { b = t; }
        if (!r.ok) { var m = (b && b.message) || ''; var err = new Error(friendly(m)); err.code = String(m).split(':')[0]; err.status = r.status; if (r.status === 401 && o.auth) save(null); throw err; }
        return b;
      });
    });
  };
  var cache = {};
  MV.cached = function (key, fn, ttl) {
    var c = cache[key]; if (c && Date.now() - c.t < (ttl || 20000)) return c.p;
    var p = fn(); cache[key] = { t: Date.now(), p: p }; p.catch(function () { delete cache[key]; }); return p;
  };
  MV.stats = function () { return MV.cached('stats', function () { return MV.rpc('mv_public_stats'); }); };
  MV.board = function () { return MV.cached('board', function () { return MV.rpc('mv_country_board'); }, 30000); };
  MV.countries = function () { return MV.cached('cl', function () { return fetch('/lib/countries.json').then(function (r) { return r.json(); }); }, 3600000); };
  MV.dashboard = function () { return MV.rpc('mv_my_dashboard', {}, { auth: true }); };

  /* ── referral capture: ?ref=CODE kept for 30 days on this device only ── */
  MV.captureRef = function () {
    var ref = (MV.qs('ref') || '').toLowerCase();
    if (/^[0-9a-f]{10}$/.test(ref)) {
      try { localStorage.setItem('mv.ref', JSON.stringify({ code: ref, at: Date.now() })); } catch (e) {}
      var u = new URL(location.href); u.searchParams.delete('ref'); history.replaceState(null, '', u.pathname + u.search + u.hash);
    }
  };
  MV.getRef = function () {
    try { var r = JSON.parse(localStorage.getItem('mv.ref') || 'null'); if (r && Date.now() - r.at < 30 * 864e5) return r.code; } catch (e) {} return null;
  };

  /* ── motion helpers ── */
  MV.countUp = function (el, to, o) {
    o = o || {}; to = Number(to) || 0;
    var fmt = o.format || MV.num;
    if (MV.reduced() || to === 0) { el.textContent = fmt(to); return; }
    var from = Number(el.getAttribute('data-v')) || 0, t0 = null, dur = o.duration || 1800;
    el.setAttribute('data-v', to);
    function step(ts) {
      if (t0 == null) t0 = ts; var k = Math.min((ts - t0) / dur, 1), e = 1 - Math.pow(1 - k, 4);
      el.textContent = fmt(Math.round(from + (to - from) * e)); if (k < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  };
  MV.onVisible = function (el, fn, margin) {
    if (!('IntersectionObserver' in window)) { fn(); return; }
    var io = new IntersectionObserver(function (es) { if (es[0].isIntersecting) { io.disconnect(); fn(); } }, { rootMargin: margin || '0px 0px -10% 0px' });
    io.observe(el);
  };
  MV.reveal = function (root) {
    var els = MV.$$('.rv:not(.in)', root);
    if (!('IntersectionObserver' in window) || MV.reduced()) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) { es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } }); }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });
  };

  /* ── sharing ── */
  var ICON = {
    whatsapp: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2Zm5.8 14.1c-.2.7-1.3 1.3-1.8 1.4-.5 0-1 .2-3.3-.7a11.700 11.700 0 0 1-4.800-4.200c-.4-.5-1.200-1.600-1.200-3 0-1.400.7-2 1-2.300.2-.3.600-.3.800-.3h.6c.2 0 .4 0 .6.500l.8 2c.1.200.1.300 0 .5l-.4.600c-.2.200-.3.300-.1.600.7 1.100 1.500 1.900 2.700 2.500.3.200.5.100.700-.1l.8-1c.2-.3.400-.2.600-.1l1.900.9c.3.100.5.200.5.300.1.200.1.700-.1 1.400Z"/></svg>',
    facebook: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13.500 22v-8.200h2.800l.4-3.300h-3.200V8.400c0-.9.300-1.600 1.600-1.600h1.700V3.900c-.3 0-1.300-.1-2.500-.1-2.500 0-4.200 1.500-4.200 4.300v2.400H7.300v3.300h2.800V22h3.400Z"/></svg>',
    linkedin: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4.500 9h3.700v11.500H4.500V9ZM6.400 3.500a2.150 2.150 0 1 1 0 4.300 2.150 2.150 0 0 1 0-4.300ZM10.400 9h3.500v1.600h.1c.5-.9 1.700-1.900 3.500-1.900 3.700 0 4.400 2.400 4.400 5.600v6.200h-3.700v-5.500c0-1.300 0-3-1.800-3s-2.100 1.400-2.100 2.900v5.600h-3.700V9Z"/></svg>',
    x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.800 3h3.100l-6.800 7.700L22 21h-6.200l-4.900-6.300L5.300 21H2.200l7.300-8.300L2 3h6.400l4.400 5.800L17.800 3Zm-1.100 16.200h1.700L7.300 4.700H5.500l11.200 14.500Z"/></svg>',
    copy: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 3h10a2 2 0 0 1 2 2v12h-2V5H9V3Zm-4 4h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2Zm0 2v10h10V9H5Z"/></svg>',
    share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M18 16a3 3 0 0 0-2.200 1L9 13.600a3 3 0 0 0 0-3.200L15.800 7A3 3 0 1 0 15 5a3 3 0 0 0 .1.800L8.300 9.200a3 3 0 1 0 0 5.600l6.800 3.400A3 3 0 1 0 18 16Z"/></svg>'
  };
  MV.icon = function (k) { return ICON[k] || ''; };
  MV.shareText = function () { return MV.t('share.text', "I've joined Trillion Euro. One trillion. One world. A better future. Join me and help shape what we tackle first."); };
  // Renders WhatsApp / Facebook / LinkedIn / X / copy (+ native share where available). Signed-in clicks are counted as private "invitations".
  MV.bindShare = function (box, o) {
    var e = encodeURIComponent, url = o.url, text = o.text || MV.shareText(), h = '';
    if (navigator.share) h += '<button type="button" class="btn btn-gold btn-sm" data-sh="native">' + ICON.share + MV.t('share.native', 'Share') + '</button>';
    h += '<a class="btn btn-ghost btn-sm" data-sh="whatsapp" target="_blank" rel="noopener" href="https://wa.me/?text=' + e(text + ' ' + url) + '">' + ICON.whatsapp + 'WhatsApp</a>' +
      '<a class="btn btn-ghost btn-sm" data-sh="facebook" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + e(url) + '&quote=' + e(text) + '">' + ICON.facebook + 'Facebook</a>' +
      '<a class="btn btn-ghost btn-sm" data-sh="linkedin" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=' + e(url) + '">' + ICON.linkedin + 'LinkedIn</a>' +
      '<a class="btn btn-ghost btn-sm" data-sh="x" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=' + e(text) + '&url=' + e(url) + '">' + ICON.x + 'X</a>' +
      '<button type="button" class="btn btn-ghost btn-sm" data-sh="copy">' + ICON.copy + MV.t('share.copy', 'Copy link') + '</button>';
    box.innerHTML = h;
    box.onclick = function (ev) {
      var b = ev.target.closest('[data-sh]'); if (!b) return; var ch = b.getAttribute('data-sh');
      MV.track('share', { channel: ch, kind: o.kind || 'page' });
      if (ch === 'copy') { ev.preventDefault(); MV.copy(url); }
      if (ch === 'native') { ev.preventDefault(); navigator.share({ title: 'Trillion Euro', text: text, url: url }).catch(function () {}); }
      if (MV.session() && o.log !== false) MV.rpc('mv_log_invite', { p_channel: ch }, { auth: true }).then(function (n) { if (o.onLog) o.onLog(n); }, function () {});
    };
  };

  /* ── header / nav ── */
  function initChrome() {
    var head = MV.$('.site-head'), tog = MV.$('.nav-toggle'), nav = MV.$('#site-nav');
    function onScroll() { head.classList.toggle('solid', window.scrollY > 24); }
    onScroll(); addEventListener('scroll', onScroll, { passive: true });
    if (tog) tog.addEventListener('click', function () { var o = nav.classList.toggle('open'); tog.setAttribute('aria-expanded', o); tog.textContent = o ? MV.t('nav.close', 'Close') : MV.t('nav.menu', 'Menu'); });
    if (nav) nav.addEventListener('click', function (e) { if (e.target.closest('a') && nav.classList.contains('open')) { nav.classList.remove('open'); tog.setAttribute('aria-expanded', 'false'); tog.textContent = MV.t('nav.menu', 'Menu'); } });
    if (MV.session()) MV.$$('[data-auth-cta]').forEach(function (a) { a.setAttribute('href', '/dashboard'); a.textContent = MV.t('nav.dashboard', 'My dashboard'); });
  }
  MV.init = function () { MV.hashType = MV.consumeHash(); MV.captureRef(); initChrome(); MV.reveal(); };
  if (d.readyState === 'loading') d.addEventListener('DOMContentLoaded', MV.init); else MV.init();
})();
