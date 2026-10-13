/* TrillionEuro core runtime — tiny, dependency-free. Exposes window.TE. */
(function () {
  'use strict';
  var SUPABASE_URL = 'https://kxzywyflylkcqoidiqmo.supabase.co';
  var KEY = 'sb_publishable_37yXvakYMXdpz2e3Hf_zng__oGOVC-g';
  var SITE = 'https://www.trillioneuro.com';

  function rpc(fn, args, opts) {
    opts = opts || {};
    var headers = { apikey: KEY, 'Content-Type': 'application/json' };
    if (opts.token) headers.Authorization = 'Bearer ' + opts.token;
    return fetch(SUPABASE_URL + '/rest/v1/rpc/' + fn, {
      method: 'POST', headers: headers, body: JSON.stringify(args || {})
    }).then(function (r) {
      return r.text().then(function (t) {
        var d = null; try { d = t ? JSON.parse(t) : null; } catch (e) { d = t; }
        if (!r.ok) {
          var msg = (d && d.message) || 'Something went wrong. Please try again.';
          var err = new Error(friendly(msg)); err.code = String(msg).split(':')[0]; err.status = r.status; throw err;
        }
        return d;
      });
    });
  }
  function friendly(msg) {
    var i = String(msg).indexOf(':');
    var code = i > 0 ? msg.slice(0, i) : msg;
    if (/^[A-Z_]+$/.test(code) && i > 0) return msg.slice(i + 1).trim().replace(/^./, function (c) { return c.toUpperCase(); });
    if (code === 'RATE_LIMIT') return 'Too many attempts. Please wait a while and try again.';
    if (code === 'FORBIDDEN') return 'You do not have access to that.';
    return msg;
  }

  var ESC = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ESC[c]; }); }
  function flag(code) {
    if (!/^[A-Z]{2}$/.test(code || '')) return '';
    return String.fromCodePoint(0x1F1A5 + code.charCodeAt(0), 0x1F1A5 + code.charCodeAt(1));
  }
  function pad(n) { return String(n).padStart(6, '0'); }
  function no(n) { return 'Nº ' + pad(n); }
  var nf = new Intl.NumberFormat('en-IE');
  function num(n) { return nf.format(n); }
  function money(cents, cur) {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: (cur || 'eur').toUpperCase() }).format(cents / 100);
  }
  function bigEur(n, cur) {
    return new Intl.NumberFormat('en-IE', { style: 'currency', currency: (cur || 'EUR').toUpperCase(), notation: 'compact', maximumFractionDigits: 2 }).format(n);
  }
  function date(d, opts) {
    if (!d) return '';
    return new Date(d).toLocaleDateString('en-IE', opts || { day: 'numeric', month: 'long', year: 'numeric' });
  }
  function qs(name) { return new URLSearchParams(location.search).get(name); }
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }

  function toast(msg) {
    var t = $('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; t.className = 'toast'; t.setAttribute('role', 'status'); t.setAttribute('aria-live', 'polite'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 2600);
  }

  // Share-button interactions are counted with Vercel Analytics custom events
  // (first-party, no cookies) and carry only the channel + page type — never names.
  function track(name, props) { try { if (window.va) window.va('event', { name: name, data: props || {} }); } catch (e) {} }

  function copy(text) {
    var p = navigator.clipboard && navigator.clipboard.writeText ? navigator.clipboard.writeText(text) : Promise.reject();
    return p.then(function () { toast('Link copied'); }, function () {
      var ta = document.createElement('textarea'); ta.value = text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.opacity = '0';
      document.body.appendChild(ta); ta.select();
      try { document.execCommand('copy'); toast('Link copied'); } catch (e) { toast('Copy failed — select the link manually'); }
      ta.remove();
    });
  }
  function shareButtons(container, o) {
    // o: {url, text, kind}
    var enc = encodeURIComponent;
    var html = '';
    if (navigator.share) html += '<button type="button" class="btn btn-gold btn-sm" data-sh="native">Share</button>';
    html += '<button type="button" class="btn btn-line btn-sm" data-sh="copy">Copy link</button>' +
      '<a class="btn btn-line btn-sm" data-sh="x" target="_blank" rel="noopener" href="https://twitter.com/intent/tweet?text=' + enc(o.text) + '&url=' + enc(o.url) + '">X</a>' +
      '<a class="btn btn-line btn-sm" data-sh="whatsapp" target="_blank" rel="noopener" href="https://wa.me/?text=' + enc(o.text + ' ' + o.url) + '">WhatsApp</a>' +
      '<a class="btn btn-line btn-sm" data-sh="linkedin" target="_blank" rel="noopener" href="https://www.linkedin.com/sharing/share-offsite/?url=' + enc(o.url) + '">LinkedIn</a>' +
      '<a class="btn btn-line btn-sm" data-sh="facebook" target="_blank" rel="noopener" href="https://www.facebook.com/sharer/sharer.php?u=' + enc(o.url) + '">Facebook</a>';
    container.innerHTML = html;
    container.addEventListener('click', function (e) {
      var b = e.target.closest('[data-sh]'); if (!b) return;
      var ch = b.getAttribute('data-sh');
      track('share', { channel: ch, kind: o.kind || 'page' });
      if (ch === 'copy') { e.preventDefault(); copy(o.url); }
      if (ch === 'native') { e.preventDefault(); navigator.share({ title: 'Beat Elon — TrillionEuro.com', text: o.text, url: o.url }).catch(function () {}); }
    });
  }

  // Referral capture: ?ref=CODE is remembered for 30 days (localStorage, this
  // device only) and a click is logged once. Last valid click wins.
  function captureRef() {
    var ref = qs('ref');
    if (!ref || !/^[0-9a-f]{10}$/.test(ref)) return;
    try { localStorage.setItem('te_ref', JSON.stringify({ code: ref, at: Date.now() })); } catch (e) {}
    rpc('te_track_referral', { p_ref: ref, p_ua: navigator.userAgent.slice(0, 200) }).catch(function () {});
    var u = new URL(location.href); u.searchParams.delete('ref'); history.replaceState(null, '', u.pathname + u.search + u.hash);
  }
  function getRef() {
    try {
      var r = JSON.parse(localStorage.getItem('te_ref') || 'null');
      if (r && Date.now() - r.at < 30 * 864e5) return r.code;
    } catch (e) {}
    return null;
  }

  var countriesP = null;
  function countries() {
    if (!countriesP) countriesP = fetch('/lib/countries.json').then(function (r) { return r.json(); });
    return countriesP;
  }
  var settingsP = null;
  function settings() {
    if (!settingsP) settingsP = rpc('te_public_settings');
    return settingsP;
  }

  function entryCard(e) {
    var real = e.real_name ? '<div class="entry-real">' + esc(e.real_name) + '</div>' : '';
    var msg = e.message ? '<p class="entry-msg">“' + esc(e.message) + '”</p>' : '<p class="entry-msg muted">—</p>';
    return '<a class="entry" href="/record/' + e.entry_number + '">' +
      '<span class="entry-no">' + no(e.entry_number) + '</span>' +
      '<span class="entry-nick">' + esc(e.nickname) + '</span>' + real + msg +
      '<span class="entry-meta"><span><span class="flag" aria-hidden="true">' + flag(e.country) + '</span> ' + esc(e.country_name || e.country) + '</span>' +
      '<time datetime="' + esc(e.entered_at) + '">' + date(e.entered_at, { day: 'numeric', month: 'short', year: 'numeric' }) + '</time></span></a>';
  }
  function skeletonCards(n) {
    var s = ''; for (var i = 0; i < n; i++) s += '<div class="entry" aria-hidden="true"><span class="skeleton" style="width:90px;height:12px"></span><span class="skeleton" style="width:70%;height:26px"></span><span class="skeleton" style="width:100%;height:44px"></span></div>';
    return s;
  }

  function reveal(root) {
    var els = $$('.reveal:not(.in)', root);
    if (!('IntersectionObserver' in window)) { els.forEach(function (e) { e.classList.add('in'); }); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('in'); io.unobserve(x.target); } });
    }, { rootMargin: '0px 0px -8% 0px' });
    els.forEach(function (e) { io.observe(e); });
  }

  function errorBlock(msg, retry) {
    return '<div class="empty" role="alert"><h3>That didn’t load.</h3><p>' + esc(msg || 'The record could not be reached.') + '</p>' +
      (retry ? '<button class="btn btn-line btn-sm" type="button" data-retry>Try again</button>' : '') + '</div>';
  }

  function initNav() {
    var t = $('.nav-toggle'), n = $('#site-nav');
    if (t && n) t.addEventListener('click', function () {
      var open = n.classList.toggle('open'); t.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
  }

  window.TE = { rpc: rpc, esc: esc, flag: flag, no: no, pad: pad, num: num, money: money, bigEur: bigEur, date: date,
    qs: qs, $: $, $$: $$, toast: toast, copy: copy, shareButtons: shareButtons, track: track, getRef: getRef,
    countries: countries, settings: settings, entryCard: entryCard, skeletonCards: skeletonCards, reveal: reveal,
    errorBlock: errorBlock, SITE: SITE, SUPABASE_URL: SUPABASE_URL, KEY: KEY };

  initNav(); captureRef();
  document.addEventListener('DOMContentLoaded', function () { reveal(); });
  if (document.readyState !== 'loading') reveal();
})();
