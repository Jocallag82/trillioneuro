/* RipeStream member area — founding status and invitations.
   There are no passwords yet. A member's way in is a personal key emailed
   as https://ripestream.com/member#k=… (the fragment never reaches a server
   log or a Referer). It's kept in this browser so the page works on return.
   Every rule — who is a member, founding numbers, the monthly invitation
   allowance, single-use codes — is enforced by the rs_* functions in the
   database. This file only displays what they return. */
(function () {
  'use strict';

  var RPC = 'https://kxzywyflylkcqoidiqmo.supabase.co/rest/v1/rpc/';
  var KEY = 'sb_publishable_37yXvakYMXdpz2e3Hf_zng__oGOVC-g';
  var STORE = 'rs_member_key';
  var SITE = 'https://ripestream.com';
  var EMAIL_RE = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;
  var app = document.getElementById('app');
  var state = null;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var nf = function (n) { return Number(n).toLocaleString('en-GB'); };
  function day(iso) { try { return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long' }); } catch (e) { return ''; } }
  function pad(n) { return String(n).length >= 4 ? String(n) : ('0000' + n).slice(-4); }

  function rpc(name, args) {
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);
    return fetch(RPC + name, {
      method: 'POST',
      headers: { 'apikey': KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
      body: JSON.stringify(args || {}),
      signal: ctrl ? ctrl.signal : undefined
    }).then(function (res) {
      clearTimeout(timer);
      return res.json().catch(function () { return null; }).then(function (body) {
        if (res.ok) return body;
        var err = new Error((body && body.message) || 'HTTP ' + res.status);
        err.code = body && body.code;
        throw err;
      });
    }, function (e) { clearTimeout(timer); throw e; });
  }
  function friendly(err) {
    var m = String(err && err.message || '');
    if (m.indexOf('RATE_LIMIT') === 0) return 'Too many attempts from this connection. Give it a few minutes and try again.';
    if (m.indexOf('INVITES_EXHAUSTED') === 0) return "You've used this month's invitations.";
    if (m.indexOf('INVITE_NOT_OPEN') === 0) return 'That invitation has already been used or has expired, so it can’t be withdrawn.';
    if (m.indexOf('NOT_MEMBER') === 0) return 'Only confirmed members can invite people.';
    if (m.indexOf('INVALID_EMAIL') === 0) return "That doesn't look like a valid email address.";
    if (err && err.name === 'AbortError') return 'That took too long. Check your connection and try again.';
    if (err instanceof TypeError) return "Couldn't reach RipeStream. Check your connection and try again.";
    return 'Something went wrong on our side. Please try again in a moment.';
  }

  var memo = null;                 // survives storage being blocked (private windows)
  function getKey() {
    if (memo) return memo;
    var k = null;
    var m = location.hash.match(/[#&]k=([A-Za-z0-9_-]{40,64})/);
    if (m) {
      k = m[1];
      try { localStorage.setItem(STORE, k); } catch (e) {}
      // Take the key out of the address bar: screenshots, screen-shares and bookmarks don't carry it.
      if (history.replaceState) history.replaceState(null, '', location.pathname);
    } else {
      try { k = localStorage.getItem(STORE); } catch (e) {}
    }
    memo = k;
    return k;
  }
  function forget() { memo = null; try { localStorage.removeItem(STORE); } catch (e) {} }

  function paint(html) {
    app.innerHTML = html;
    app.setAttribute('aria-busy', 'false');
  }

  /* ── no key / bad key: ask for a fresh link ───────── */
  function linkForm(opts) {
    paint(
      '<div class="card">' +
        '<h1 class="display">' + esc(opts.title) + '</h1>' +
        '<p class="lede">' + opts.body + '</p>' +
        '<form class="linkform" novalidate>' +
          '<div class="field"><label for="lf-email">Email address</label>' +
          '<input id="lf-email" name="email" type="email" autocomplete="email" inputmode="email" required maxlength="254" placeholder="you@example.com" aria-describedby="lf-msg"></div>' +
          '<button class="btn" type="submit">Email my link</button>' +
        '</form>' +
        '<p class="err" id="lf-msg" aria-live="polite"></p><p class="ok" id="lf-ok" aria-live="polite"></p>' +
      '</div>' +
      '<p class="note"><svg aria-hidden="true"><use href="#i-info"/></svg><span>Not a member yet? <a href="/#join">Join RipeStream</a>. The first 10,000 people to confirm become Founding Members; after that, joining is by invitation.</span></p>'
    );
    var form = $('.linkform', app), input = $('input', form), btn = $('button', form);
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var v = input.value.trim();
      $('#lf-msg').textContent = ''; $('#lf-ok').textContent = '';
      input.removeAttribute('aria-invalid');
      if (!EMAIL_RE.test(v)) { input.setAttribute('aria-invalid', 'true'); input.focus(); $('#lf-msg').textContent = "That doesn't look like a valid email address."; return; }
      btn.disabled = true; btn.classList.add('busy'); btn.textContent = 'Sending…';
      rpc('rs_request_link', { p_email: v }).then(function () {
        // Same message whether or not the address is a member — this page can't be used to check.
        $('#lf-ok').textContent = 'If ' + v + ' is on RipeStream, a fresh link is on its way. It can take a few minutes — check spam too.';
        btn.textContent = 'Sent';
      }).catch(function (err) {
        btn.disabled = false; btn.classList.remove('busy'); btn.textContent = 'Email my link';
        $('#lf-msg').textContent = friendly(err);
      });
    });
  }

  function errorState(err) {
    paint(
      '<div class="card"><h1 class="display">We couldn’t load your membership.</h1>' +
      '<p class="lede">' + esc(friendly(err)) + '</p>' +
      '<p style="margin-top:24px"><button class="btn" type="button" id="retry">Try again</button></p></div>'
    );
    $('#retry').addEventListener('click', load);
  }

  /* ── the member ───────────────────────────────────── */
  function identity(s) {
    var name = s.first_name ? esc(s.first_name) : '';
    var justNow = s.confirmed_at && Date.now() - new Date(s.confirmed_at).getTime() < 3 * 60 * 1000;
    if (s.status === 'waitlist') {
      return '<div class="card id">' +
        '<h1 class="display">You confirmed just after the last founding place went.</h1>' +
        '<p class="lede">Founding membership is now closed and <b>RipeStream is currently invite-only.</b> Your email is confirmed and kept. If someone you know is a member, ask them for an invitation — then <a href="/#join">join with their code</a> using this same email, and you’re in.</p>' +
        '</div>';
    }
    if (s.founding) {
      return '<div class="card id">' +
        '<span class="fm-badge"><svg aria-hidden="true"><use href="#mark"/></svg>Founding Member</span>' +
        '<h1 class="display">' + (justNow ? 'Confirmed. ' : '') + 'You’re one of the first ' + nf(s.founding_limit) + ' people shaping RipeStream.</h1>' +
        '<p class="fm-no"><small>' + (name ? name + ' · ' : '') + 'Founding Member</small>#' + pad(s.founding_number) + '</p>' +
        '<p class="meta">Numbered in the order members confirmed' + (s.confirmed_at ? ' · since ' + day(s.confirmed_at) + ' ' + new Date(s.confirmed_at).getFullYear() : '') + '. Yours for good.</p>' +
        '</div>';
    }
    return '<div class="card id">' +
      '<h1 class="display">' + (justNow ? 'Confirmed. ' : '') + 'You’re in' + (name ? ', ' + name : '') + '.</h1>' +
      '<p class="lede">' + (s.invited_by ? '<b>' + esc(s.invited_by) + '</b> invited you. ' : '') + 'RipeStream is invite-only now, so everyone here was brought in by someone who wanted them here.</p>' +
      '</div>';
  }

  var STATUS = { open: 'Waiting', used: 'Used', expired: 'Expired', revoked: 'Withdrawn' };
  function inviteLink(code) { return SITE + '/?invite=' + encodeURIComponent(code) + '#join'; }

  function invitations(s) {
    var q = s.invites;
    if (!q) return '';
    var list = s.invitations || [];
    var items = list.map(function (i) {
      var who = i.status === 'used'
        ? (i.joined ? (i.used_by ? esc(i.used_by) + ' joined' : 'Joined') + ' · ' + day(i.used_at)
                    : (i.used_by ? esc(i.used_by) : 'Someone') + ' used it · waiting for them to confirm')
        : i.status === 'open' ? (i.label ? 'For ' + esc(i.label) + ' · ' : '') + 'expires ' + day(i.expires_at)
        : i.status === 'expired' ? (i.label ? 'For ' + esc(i.label) + ' · ' : '') + 'expired ' + day(i.expires_at)
        : (i.label ? 'For ' + esc(i.label) + ' · ' : '') + 'withdrawn';
      var acts = i.status === 'open'
        ? '<button class="btn quiet" type="button" data-copy="' + esc(i.code) + '">Copy link</button>' +
          (navigator.share ? '<button class="btn quiet" type="button" data-share="' + esc(i.code) + '">Share</button>' : '') +
          '<button class="btn quiet" type="button" data-revoke="' + esc(i.code) + '" aria-label="Withdraw invitation ' + esc(i.code) + '">Withdraw</button>'
        : '';
      return '<li class="item' + (i.status === 'open' || i.status === 'used' ? '' : ' dim') + '">' +
        '<div><span class="code">' + esc(i.code) + '</span><span class="chip ' + esc(i.status) + '">' + STATUS[i.status] + '</span>' +
        '<p class="who">' + who + '</p></div><div class="acts">' + acts + '</div></li>';
    }).join('');

    var make = q.available > 0
      ? '<form class="make" novalidate>' +
          '<div class="field"><label for="inv-label">Who’s it for? <span>Optional · only you see this</span></label>' +
          '<input id="inv-label" name="label" type="text" maxlength="40" autocomplete="off" placeholder="e.g. Sam from climbing"></div>' +
          '<button class="btn" type="submit">Invite friends</button>' +
        '</form>'
      : '<p class="exhausted">You’ve used this month’s invitations. ' + q.per_month + ' more on ' + day(q.resets_at) + '. Withdrawn invitations that were never used come back to you.</p>';

    return '<section class="card inv" aria-labelledby="inv-title">' +
      '<div class="inv-top"><div>' +
        '<h2 class="display" id="inv-title">Who should be here with you?</h2>' +
        '<p class="k" style="margin-top:14px">Your invitations</p>' +
        '<p class="avail"><b>' + q.available + '</b> of ' + q.per_month + ' available this month</p>' +
        '<p class="sub">Invite people you actually want on RipeStream. Each code works once, for one person, and expires after ' + q.ttl_days + ' days.</p>' +
      '</div></div>' +
      make +
      '<p class="err" id="inv-err" aria-live="polite"></p><p class="ok" id="inv-ok" aria-live="polite"></p>' +
      (list.length ? '<ul class="list" role="list">' + items + '</ul>'
                   : '<p class="empty">No invitations yet. When you create one, it appears here with its link, and you’ll see when they join.</p>') +
      '</section>';
  }

  function render(s) {
    state = s;
    paint(
      identity(s) +
      invitations(s) +
      '<p class="note"><svg aria-hidden="true"><use href="#i-info"/></svg><span>RipeStream is still being built. Your place' + (s.status === 'member' ? ' and your invitations are' : ' is') + ' real and kept — the app itself isn’t open yet. We’ll email you when it is.</span></p>' +
      '<p class="foot-acts">Using a shared computer? <button type="button" id="forget">Remove your link from this browser</button></p>'
    );
    wire();
  }

  function flash(ok, msg) {
    var e = $('#inv-err'), o = $('#inv-ok');
    if (e) e.textContent = ok ? '' : msg;
    if (o) o.textContent = ok ? msg : '';
  }

  function copy(text, btn) {
    var done = function () { var t = btn.textContent; btn.textContent = 'Copied'; setTimeout(function () { btn.textContent = t; }, 1800); };
    if (navigator.clipboard && window.isSecureContext) navigator.clipboard.writeText(text).then(done, function () { fallback(); });
    else fallback();
    function fallback() { window.prompt('Copy this invitation link:', text); }
  }

  function wire() {
    var key = getKey();
    var form = $('.make', app);
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = $('button', form), label = $('input', form).value.replace(/[<>]/g, '').trim().slice(0, 40);
      btn.disabled = true; btn.classList.add('busy'); btn.textContent = 'Creating…';
      rpc('rs_create_invite', { p_key: key, p_label: label || null }).then(function (s) {
        render(s);
        var first = s.invitations && s.invitations[0];
        if (first) {
          flash(true, 'Invitation ' + first.code + ' is ready. Copy the link and send it yourself — we never email anyone on your behalf.');
          var c = $('[data-copy="' + first.code + '"]', app); if (c) c.focus();
        }
      }).catch(function (err) {
        btn.disabled = false; btn.classList.remove('busy'); btn.textContent = 'Invite friends';
        if (/^INVITES_EXHAUSTED/.test(err.message)) return load();
        flash(false, friendly(err));
      });
    });
    $$('[data-copy]', app).forEach(function (b) {
      b.addEventListener('click', function () { copy(inviteLink(b.getAttribute('data-copy')), b); });
    });
    $$('[data-share]', app).forEach(function (b) {
      b.addEventListener('click', function () {
        navigator.share({ title: 'Join me on RipeStream', text: 'I have an invitation to RipeStream for you — a social network where you control your feed.', url: inviteLink(b.getAttribute('data-share')) }).catch(function () {});
      });
    });
    $$('[data-revoke]', app).forEach(function (b) {
      b.addEventListener('click', function () {
        var code = b.getAttribute('data-revoke');
        if (!window.confirm('Withdraw invitation ' + code + '? The link will stop working and the invitation comes back to you.')) return;
        b.disabled = true;
        rpc('rs_revoke_invite', { p_key: key, p_code: code }).then(function (s) {
          render(s); flash(true, 'Invitation ' + code + ' withdrawn.');
        }).catch(function (err) { b.disabled = false; flash(false, friendly(err)); });
      });
    });
    var f = $('#forget');
    if (f) f.addEventListener('click', function () {
      forget();
      linkForm({ title: 'Link removed from this browser.', body: 'Your membership is unaffected. To come back, open the link in your email or ask for a fresh one.' });
    });
  }

  function load() {
    var key = getKey();
    if (!key) {
      return linkForm({
        title: 'Your member link',
        body: 'RipeStream doesn’t use passwords yet. Your way in is a personal link we email you — enter the address you joined with and we’ll send a fresh one.'
      });
    }
    app.setAttribute('aria-busy', 'true');
    rpc('rs_member_open', { p_key: key }).then(function (s) {
      if (!s || !s.status) throw new Error('bad payload');
      render(s);
    }).catch(function (err) {
      if (/^INVALID_KEY/.test(String(err && err.message))) {
        forget();
        return linkForm({
          title: 'That link doesn’t work any more.',
          body: 'Member links are replaced when a newer one is sent, and only the five most recent work. Enter your email and we’ll send a fresh one.'
        });
      }
      errorState(err);
    });
  }

  load();
})();
