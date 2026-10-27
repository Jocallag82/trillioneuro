/* RipeStream landing — progressive enhancement only. The page reads fully
   without this file; everything here adds motion, the interactive concept
   demos, the live founding-place counter and the join submit. No dependencies. */
(function () {
  'use strict';

  /* Same Supabase project as the other sites in this repo. Publishable key:
     meant to ship in the browser. anon can only call the rs_* RPCs, which
     validate, rate-limit and enforce every rule server-side — founding
     places, invitations, limits (see supabase-setup.sql, FOUNDING MEMBERS).
     Nothing this file decides is trusted by the database. */
  var RPC = 'https://kxzywyflylkcqoidiqmo.supabase.co/rest/v1/rpc/';
  var KEY = 'sb_publishable_37yXvakYMXdpz2e3Hf_zng__oGOVC-g';
  var STORE = 'rs_join_v1';
  var MEMBER_KEY = 'rs_member_key';
  var EMAIL_RE = /^[^@\s]+@[^@\s.]+(\.[^@\s.]+)+$/;

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(pointer: fine)').matches;
  var hasIO = 'IntersectionObserver' in window;

  function store(get, val) {
    try {
      if (get) return JSON.parse(localStorage.getItem(STORE) || 'null');
      localStorage.setItem(STORE, JSON.stringify(val));
    } catch (e) { return null; }
  }
  var registered = store(true);

  // Cookie-free Vercel Web Analytics custom events; no personal data is sent.
  // Tag signups with the platform that sent them (?utm_source=x), within rs_join's 20-char limit.
  var UTM = (function () {
    try { var u = (new URLSearchParams(location.search).get('utm_source') || '').toLowerCase(); return /^[a-z0-9_-]{1,12}$/.test(u) ? u : ''; } catch (e) { return ''; }
  })();
  function joinSource(form) { var s = form.getAttribute('data-source') || ''; return UTM ? s + ':' + UTM : s; }
  function track(name, data) { try { if (window.va) window.va('event', data ? { name: name, data: data } : { name: name }); } catch (e) {} }

  function rpc(name, args, timeoutMs) {
    var ctrl = 'AbortController' in window ? new AbortController() : null;
    var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, timeoutMs || 15000);
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

  /* ── founding state: open or closed (invite-only) ────
     Everything written in two versions carries data-when="open|closed".
     The default (open) is what no-JS visitors see; the counter below flips
     it from the live number. The server refuses a join without an
     invitation once places are gone, whatever this page shows. */
  // phase: 'unknown' until the server answers (the static default), then
  // 'open' or 'closed'. founding.open stays null while unknown, so nothing
  // claims a founding place or demands an invitation on a guess.
  var founding = { state: null, open: null, phase: 'unknown' };
  function setPhase(phase) {
    founding.phase = phase;
    founding.open = phase === 'unknown' ? null : phase === 'open';
    document.documentElement.classList.toggle('fm-closed', phase === 'closed');
    $$('[data-when]').forEach(function (el) {
      if (el.getAttribute('data-when') === phase) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
    });
    $$('.rs-form').forEach(function (f) { syncForm(f); });
  }

  /* The claimed/remaining count is deliberately never shown. The page only
     uses the server's open/closed flag and the invitation settings. */
  function renderCounter(st) {
    $$('[data-fm-per-month]').forEach(function (el) { el.textContent = st.invites_per_month; });
    $$('[data-fm-ttl]').forEach(function (el) { if (st.invite_ttl_days) el.textContent = st.invite_ttl_days; });
  }

  var lastFetch = 0;
  function loadFounding() {
    lastFetch = Date.now();
    return rpc('rs_founding_status', {}, 10000).then(function (st) {
      if (!st || typeof st.claimed !== 'number') throw new Error('bad status');
      founding.state = st;
      renderCounter(st);
      setPhase(st.open ? 'open' : 'closed');
    }).catch(function () {
      // Status unknown: say so instead of guessing. Joining still works —
      // rs_join decides, and its INVITE_REQUIRED answer is handled below.
      if (founding.phase !== 'unknown') return;
      $$('[data-status-msg]').forEach(function (el) { el.textContent = "Couldn't check membership status just now. You can still join; we'll tell you if an invitation is needed."; });
    });
  }
  loadFounding();
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden && Date.now() - lastFetch > 60000) loadFounding();
  });

  /* ── invitation from the link (?invite=CODE) ──────── */
  var INVITE_MSG = {
    used: 'That invitation has already been used. Each one works once.',
    expired: 'That invitation has expired. Ask whoever sent it for a new one.',
    revoked: 'That invitation was withdrawn by the person who sent it.',
    invalid: "That invitation code doesn't exist. Check it was copied in full."
  };
  var inviteFromUrl = null;
  try { inviteFromUrl = new URLSearchParams(location.search).get('invite'); } catch (e) {}
  function normCode(v) {
    var c = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
    return c.length === 8 ? c.slice(0, 4) + '-' + c.slice(4) : c;
  }
  if (inviteFromUrl) {
    var code = normCode(inviteFromUrl);
    $$('input[name=invite]').forEach(function (i) { i.value = code; });
    $$('[data-invite-field]').forEach(function (d) { d.open = true; });
    rpc('rs_check_invite', { p_code: code }, 10000).then(function (r) {
      var banner = $('#invite-banner');
      if (r && r.status === 'valid') {
        var who = r.inviter ? String(r.inviter).replace(/[<>&"]/g, '') : 'A member';
        if (banner) {
          var span = document.createElement('span'), b = document.createElement('b');
          b.textContent = who; span.appendChild(b); span.appendChild(document.createTextNode(' invited you to RipeStream.'));
          banner.replaceChildren(span); banner.hidden = false;
        }
        track('invite_link_valid');
        $$('[data-invite-intro]').forEach(function (p) { p.textContent = who + "'s invitation is ready below. Add your email to use it."; });
        setInviteMsg(who + "'s invitation · " + code, 'ok');
      } else {
        var msg = INVITE_MSG[r && r.status] || INVITE_MSG.invalid;
        if (banner) { banner.textContent = msg; banner.classList.add('bad'); banner.hidden = false; }
        track('invite_link_invalid', { status: (r && r.status) || 'invalid' });
        setInviteMsg(msg, 'bad');
      }
    }).catch(function () { /* the join call re-checks it anyway */ });
  }
  function setInviteMsg(text, cls) {
    $$('.invite-msg').forEach(function (m) { m.textContent = text || ''; m.className = 'invite-msg' + (cls ? ' ' + cls : ''); });
  }

  // Closed phase: the invitation field is required and always open.
  function syncForm(form) {
    var d = $('[data-invite-field]', form), inp = $('input[name=invite]', form);
    var closed = founding.open === false;
    if (d) { d.classList.toggle('req', closed); if (closed) d.open = true; }
    if (inp) { if (closed) inp.setAttribute('required', ''); else inp.removeAttribute('required'); }
    var opt = $('[data-invite-opt]', form); if (opt) opt.textContent = closed ? 'Required' : 'Optional';
    var lbl = $('.lbl', form);
    if (lbl && !$('button[type=submit]', form).disabled) {
      lbl.textContent = lbl.getAttribute('data-label-' + founding.phase);
    }
  }

  /* ── nav ───────────────────────────────────────────── */
  var nav = $('#nav');
  try {
    if (localStorage.getItem(MEMBER_KEY)) {       // a member on this device: straight to their invitations
      var cta = $('[data-nav-cta]');
      if (cta) { cta.href = '/app'; cta.removeAttribute('data-focus-form'); cta.removeAttribute('data-nav-cta'); cta.textContent = 'Open your stream'; var si = $('[data-nav-signin]'); if (si) si.hidden = true; }
    }
  } catch (e) {}
  function onScroll() { nav.classList.toggle('scrolled', window.scrollY > 24); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

  /* ── hero: the stream (generative flow field) ──────── */
  /* Drawing lives in flow.js, in a worker on an OffscreenCanvas where
     supported, so it never competes with scrolling. Pauses off-screen and in
     background tabs; with reduced motion it paints one still frame. */
  (function () {
    var cv = $('#flow');
    if (!cv || !cv.getContext) return;
    var hero = cv.parentNode, lanes = $('.stream', hero);
    var small = window.innerWidth < 760;
    // Soft glowing strokes gain nothing from extra pixels; a full-res canvas
    // at 125–150% Windows scaling is what made desktops stutter.
    var DPR = small ? Math.min(window.devicePixelRatio || 1, 1.25) : 1;
    function dims() {
      var r = hero.getBoundingClientRect();
      return { w: r.width, h: r.height, band: lanes ? lanes.offsetTop + lanes.offsetHeight * 0.4 : 0 };
    }
    var send, flow;
    var init = dims();
    init.small = small; init.reduced = reduced; init.dpr = DPR;

    if (cv.transferControlToOffscreen && window.Worker) {
      try {
        var off = cv.transferControlToOffscreen();
        var w = new Worker('/flow.js');
        init.type = 'init'; init.canvas = off;
        w.postMessage(init, [off]);
        send = function (m) { w.postMessage(m); };
      } catch (e) { send = null; }
    }
    if (!send) {
      var s = document.createElement('script');
      s.src = '/flow.js';
      s.onload = function () { flow = window.RSFlow(cv, init); ready(); };
      document.head.appendChild(s);
      send = function (m) {
        if (!flow) return;
        if (m.type === 'resize') flow.resize(m);
        else if (m.type === 'mouse') flow.mouse(m.x, m.y);
        else if (m.type === 'run') flow.run(m.on);
      };
    } else ready();

    function ready() {
      cv.classList.add('on');
      var rt; window.addEventListener('resize', function () {
        clearTimeout(rt); rt = setTimeout(function () { var d = dims(); d.type = 'resize'; send(d); }, 150);
      });
      if (finePointer) {
        var mx = 0, my = 0, queued = false;
        var push = function () {
          queued = false;
          var r = hero.getBoundingClientRect();
          send({ type: 'mouse', x: mx - r.left, y: my - r.top });
        };
        hero.addEventListener('pointermove', function (e) {
          mx = e.clientX; my = e.clientY;
          if (!queued) { queued = true; requestAnimationFrame(push); }
        });
        hero.addEventListener('pointerleave', function () { send({ type: 'mouse', x: -9999, y: -9999 }); });
      }
      var visible = true;
      var sync = function () { send({ type: 'run', on: visible && !document.hidden }); };
      if (hasIO) new IntersectionObserver(function (es) { visible = es[0].isIntersecting; sync(); }).observe(hero);
      document.addEventListener('visibilitychange', sync);
      sync();
    }
  })();

  /* ── reveal on scroll ──────────────────────────────── */
  var revealables = $$('.rv, [data-reveal]');
  if (!hasIO || reduced) {
    revealables.forEach(function (el) { el.classList.add('in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.08 });
    revealables.forEach(function (el) { io.observe(el); });
  }

  /* ── "register" links: scroll to the form and focus it ─ */
  $$('[data-focus-form]').forEach(function (a) {
    a.addEventListener('click', function (e) {
      var from = a.closest('nav, header, .dock, section');
      track('cta_click', { from: from ? (from.id || from.className.split(' ')[0] || from.tagName.toLowerCase()) : 'page' });
      var host = $('#join');
      if (!host) return;
      e.preventDefault();
      host.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'start' });
      var input = $('#join-email');
      if (input && finePointer) input.focus({ preventScroll: true });
      if (history.replaceState) history.replaceState(null, '', '#join');
    });
  });

  /* ── mobile dock: visible between hero and the forms ─ */
  var dock = $('#dock');
  if (dock && hasIO) {
    var heroGone = false, formsVisible = 0;
    var update = function () {
      dock.classList.toggle('show', heroGone && formsVisible === 0 && !registered);
    };
    new IntersectionObserver(function (es) {
      heroGone = !es[0].isIntersecting; update();
    }, { threshold: 0.05 }).observe($('.hero'));
    var formIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { formsVisible += e.isIntersecting ? 1 : -1; });
      formsVisible = Math.max(0, formsVisible); update();
    });
    $$('[data-form-host]').forEach(function (h) { formIO.observe(h); });
    dock.hideForGood = function () { registered = registered || {}; update(); };
  }

  /* ── join ──────────────────────────────────────────── */
  var tpl = $('#done-tpl');

  function showDone(host, d) {
    var node = tpl.content.firstElementChild.cloneNode(true);
    var title = $('[data-title]', node), body = $('[data-body]', node);
    if (d.already) {
      title.textContent = 'You already started joining.';
      body.textContent = "If you haven't confirmed yet, the link in your email still works — or ask for a fresh one below.";
    } else {
      title.textContent = d.name ? 'Check your inbox, ' + d.name + '.' : 'Check your inbox.';
      body.textContent = d.invite
        ? "We've emailed " + (d.email || 'you') + ' a link. Open it to confirm your email and take the place your invitation holds.'
        : founding.open === true
          ? "We've emailed " + (d.email || 'you') + ' a link. Open it to confirm your email — that\'s the moment your founding place is claimed. Places go in the order people confirm.'
          : "We've emailed " + (d.email || 'you') + ' a link. Open it to confirm your email.';
    }
    var again = $('[data-again]', node);
    if (again && d.already) {
      again.hidden = false;
      $('[data-reset]', again).addEventListener('click', function () {
        // Someone else on this device, or a different address: put the form back.
        registered = null; store(false, null);
        host.replaceChildren(host._form);
        var f = $('input[name=email]', host); if (f) f.focus();
      });
    }
    if (!host._form) host._form = host.firstElementChild;
    host.replaceChildren(node);
    return node;
  }

  function setError(form, msg, field) {
    var err = $('.err', form);
    err.textContent = msg || '';
    $$('input', form).forEach(function (i) { i.removeAttribute('aria-invalid'); });
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  }

  function setLoading(form, on) {
    var btn = $('button[type=submit]', form), lbl = $('.lbl', btn);
    btn.disabled = on;
    btn.classList.toggle('loading', on);
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
    lbl.textContent = on ? 'Joining…' : lbl.getAttribute('data-label-' + founding.phase);
  }

  $$('.rs-form').forEach(function (form) {
    var email = $('input[name=email]', form);
    var invite = $('input[name=invite]', form);
    var busy = false, started = false;
    syncForm(form);
    form.addEventListener('focusin', function () {
      if (!started) { started = true; track('join_form_start', { source: form.getAttribute('data-source') }); }
    });

    email.addEventListener('input', function () {
      if (email.getAttribute('aria-invalid') && EMAIL_RE.test(email.value.trim())) setError(form, '');
    });
    if (invite) invite.addEventListener('input', function () {
      if (invite.getAttribute('aria-invalid')) { invite.removeAttribute('aria-invalid'); setError(form, ''); setInviteMsg(''); }
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;                                   // no double submits

      var host = form.closest('[data-form-host]');
      var value = email.value.trim();
      var name = $('input[name=first_name]', form).value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);
      var code = invite ? normCode(invite.value) : '';

      if (!value) return setError(form, 'Enter your email address.', email);
      if (!EMAIL_RE.test(value) || value.length > 254) {
        return setError(form, "That doesn't look like a valid email address.", email);
      }
      if (code && !/^[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(code)) {
        $('[data-invite-field]', form).open = true;
        return setError(form, 'Invitation codes look like ABCD-2345.', invite);
      }
      if (!code && founding.open === false) {
        $('[data-invite-field]', form).open = true;
        return setError(form, 'Founding membership is closed, so joining needs an invitation code from a member.', invite);
      }
      setError(form, '');

      // Honeypot filled: a bot. Look successful, send nothing.
      if ($('input[name=website]', form).value) { showDone(host, { name: name }); return; }

      busy = true;
      setLoading(form, true);
      rpc('rs_join', { p_email: value, p_first_name: name || null, p_invite: code || null, p_source: joinSource(form) })
      .then(function () {
        registered = { name: name, at: Date.now() };
        store(false, registered);
        var done = showDone(host, { name: name, email: value, invite: !!code });
        done.focus({ preventScroll: true });
        if (dock && dock.hideForGood) dock.hideForGood();
        track('join_submitted', { source: joinSource(form), invited: !!code, phase: founding.phase });
      }).catch(function (err) {
        busy = false;
        setLoading(form, false);
        var msg = String(err && err.message || '');
        var inv = msg.match(/^INVITE_(USED|EXPIRED|REVOKED|INVALID)/);
        track('join_error', { reason: (err && err.name === 'AbortError') ? 'timeout' : (msg.match(/^[A-Z_]+/) || ['other'])[0] });
        if (err && err.code === '54000' || msg.indexOf('RATE_LIMIT') === 0) {
          setError(form, 'Too many attempts from this connection. Give it a few minutes and try again.');
        } else if (msg.indexOf('INVALID_EMAIL') === 0) {
          setError(form, "That doesn't look like a valid email address.", email);
        } else if (inv) {
          $('[data-invite-field]', form).open = true;
          setError(form, INVITE_MSG[inv[1].toLowerCase()], invite);
        } else if (msg.indexOf('INVITE_REQUIRED') === 0) {
          // The last founding place went while this page was open.
          var wasOpen = founding.open === true;
          loadFounding();
          setPhase('closed');
          setError(form, wasOpen
            ? 'The last founding place has just been claimed. RipeStream is now invite-only — add an invitation code from a member to join.'
            : 'Founding places are all taken, so joining needs an invitation code from a member.', invite);
        } else if (err && err.name === 'AbortError') {
          setError(form, 'That took too long. Check your connection and try again.');
        } else if (err instanceof TypeError) {
          setError(form, "Couldn't reach us. Check your connection and try again.");
        } else {
          setError(form, 'Something went wrong on our side. Please try again in a moment.');
        }
      });
    });
  });

  if (registered && !inviteFromUrl) $$('[data-form-host]').forEach(function (h) { showDone(h, { already: true }); });

  /* ── feed preview ─────────────────────────────────────
     Mirrors the real app's controls (stream.js modePanel + muted words):
     the same three sources, the same "why" labels, newest first. The posts
     are fixed samples; nothing here talks to the server. */
  var demo = $('#demo-app');
  if (demo) {
    var POSTS = [
      { a: 'Aoife', i: 'AB', g: 'g1', t: '4m', w: 'following', b: 'Golden hour on the pier. Portra 400, no edits.' },
      { a: 'Tomás', i: 'TO', g: 'g4', c: 'Home Lab', t: '9m', w: 'community', b: 'Quietest mini PC you have actually lived with? Fan noise is all that matters now.' },
      { a: 'Jordan', i: 'JD', g: 'g3', t: '15m', w: 'everyone', b: 'Is anyone else completely done with crypto adverts on every podcast?' },
      { a: 'Priya', i: 'PR', g: 'g2', t: '22m', w: 'following', b: 'No spoiler, but that finale. Ring me when you have watched it.' },
      { a: 'Kofi', i: 'KM', g: 'g5', c: 'Bedroom Producers', t: '31m', w: 'community', b: 'Made a whole beat from ten minutes of the bus stop outside my flat. Stems in the replies.' },
      { a: 'You', i: 'ME', g: 'g6', t: '48m', w: 'yours', b: 'Trying out RipeStream. Following-only feed is very calm.' },
      { a: 'Sam', i: 'SM', g: 'g1', c: 'Sunday League', t: '1h', w: 'community', b: 'Transfer window gossip thread, then back to finding a keeper for Sunday.' },
      { a: 'Lena', i: 'LN', g: 'g4', t: '2h', w: 'everyone', b: 'First sourdough that actually rose. Photographic evidence to follow.' },
      { a: 'Mina', i: 'MJ', g: 'g2', t: '3h', w: 'following', b: 'Week 9 of marathon training. Legs: questionable. Spirit: intact.' }
    ];
    var WHY = { yours: 'Your post', following: 'You follow them', community: 'From a community you joined', everyone: 'Everyone · newest first' };
    var SRC = {
      following: ['Following', 'Only people you follow, plus your own posts.', ['following', 'yours']],
      communities: ['Communities', 'Only communities you’ve joined.', ['community']],
      all: ['Everyone', 'Every member’s posts, newest first.', ['following', 'yours', 'community', 'everyone']]
    };
    var st = { src: 'following', mutes: {} };
    var feedEl = $('#feed');
    var el = function (tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; };
    function card(p) {
      var li = el('li', 'post'), ph = el('div', 'ph');
      var av = el('span', 'av ' + p.g, p.i); av.setAttribute('aria-hidden', 'true');
      ph.appendChild(av); ph.appendChild(el('b', null, p.a));
      ph.appendChild(el('span', 't', (p.c ? 'in ' + p.c + ' · ' : '· ') + p.t));
      li.appendChild(ph); li.appendChild(el('p', 'body', p.b));
      li.appendChild(el('span', 'why', WHY[p.w] + (p.c && p.w === 'community' ? ' · ' + p.c : '')));
      return li;
    }
    var swapT = 0;
    function draw(animate) {
      var s = SRC[st.src], words = Object.keys(st.mutes).filter(function (k) { return st.mutes[k]; });
      var inSrc = POSTS.filter(function (p) { return s[2].indexOf(p.w) > -1; });
      var shown = inSrc.filter(function (p) {
        var b = p.b.toLowerCase();
        return !words.some(function (w) { return b.indexOf(w) > -1; });
      });
      var hidden = inSrc.length - shown.length;
      $('#scr-title').textContent = s[0];
      $('#src-desc').textContent = s[1];
      $('#scr-count').textContent = shown.length + (shown.length === 1 ? ' post' : ' posts');
      $('#hidden-note').textContent = hidden ? hidden + (hidden === 1 ? ' post' : ' posts') + ' hidden by your muted words.' : '';
      var render = function () {
        feedEl.replaceChildren.apply(feedEl, shown.length ? shown.map(card) : [el('li', 'empty-feed', 'Nothing here — every post matched a muted word.')]);
        if (animate && !reduced) {
          var kids = Array.prototype.slice.call(feedEl.children);
          kids.forEach(function (k, n) { k.classList.add('enter'); k.style.transitionDelay = (n * 35) + 'ms'; });
          requestAnimationFrame(function () { requestAnimationFrame(function () { kids.forEach(function (k) { k.classList.remove('enter'); }); }); });
        }
      };
      clearTimeout(swapT);
      if (animate && !reduced && feedEl.children.length) {
        Array.prototype.forEach.call(feedEl.children, function (k) { k.style.transitionDelay = '0ms'; k.classList.add('leave'); });
        swapT = setTimeout(render, 180);
      } else render();
    }
    $$('#src button').forEach(function (b) {
      b.addEventListener('click', function () {
        if (st.src === b.getAttribute('data-src')) return;
        st.src = b.getAttribute('data-src');
        $$('#src button').forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
        draw(true);
        track('demo_interact', { control: 'source', value: st.src });
      });
    });
    $$('#mutes .chip').forEach(function (b) {
      b.addEventListener('click', function () {
        var w = b.getAttribute('data-mute'), on = !st.mutes[w];
        st.mutes[w] = on;
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        b.setAttribute('aria-label', (on ? 'Unmute ' : 'Mute ') + w);
        draw(true);
        track('demo_interact', { control: 'mute' });
      });
      b.setAttribute('aria-label', 'Mute ' + b.getAttribute('data-mute'));
    });
    draw(false);
  }
})();
