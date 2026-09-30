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
  var founding = { state: null, open: true };
  function setPhase(open) {
    founding.open = open;
    document.documentElement.classList.toggle('fm-closed', !open);
    $$('[data-when]').forEach(function (el) {
      var want = el.getAttribute('data-when') === 'open';
      if (want === open) el.removeAttribute('hidden'); else el.setAttribute('hidden', '');
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
      setPhase(!!st.open);
    }).catch(function () { /* keep the static copy; the server still enforces the rules */ });
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
        if (banner) { banner.innerHTML = '<span><b>' + who + '</b> invited you to RipeStream.</span>'; banner.hidden = false; }
        $$('[data-invite-intro]').forEach(function (p) { p.textContent = who + "'s invitation is ready below. Add your email to use it."; });
        setInviteMsg(who + "'s invitation · " + code, 'ok');
      } else {
        var msg = INVITE_MSG[r && r.status] || INVITE_MSG.invalid;
        if (banner) { banner.textContent = msg; banner.classList.add('bad'); banner.hidden = false; }
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
    if (d) { d.classList.toggle('req', !founding.open); if (!founding.open) d.open = true; }
    if (inp) { if (founding.open) inp.removeAttribute('required'); else inp.setAttribute('required', ''); }
    var opt = $('[data-invite-opt]', form); if (opt) opt.textContent = founding.open ? 'Optional' : 'Required';
    var lbl = $('.lbl', form);
    if (lbl && !$('button[type=submit]', form).disabled) {
      lbl.textContent = lbl.getAttribute(founding.open ? 'data-label-open' : 'data-label-closed');
    }
  }

  /* ── nav ───────────────────────────────────────────── */
  var nav = $('#nav');
  try {
    if (localStorage.getItem(MEMBER_KEY)) {       // a member on this device: straight to their invitations
      var cta = $('[data-nav-cta]');
      if (cta) { cta.href = '/member'; cta.removeAttribute('data-focus-form'); cta.removeAttribute('data-nav-cta'); cta.innerHTML = '<span>Your invitations</span>'; }
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

  /* ── cursor spotlight on cards ─────────────────────── */
  // One style write per frame, not per mouse event (mice report at 125–1000 Hz).
  if (finePointer) $$('.spot').forEach(function (el) {
    var px = 0, py = 0, queued = false;
    function paint() {
      queued = false;
      var r = el.getBoundingClientRect();
      el.style.setProperty('--mx', (px - r.left) + 'px');
      el.style.setProperty('--my', (py - r.top) + 'px');
    }
    el.addEventListener('pointermove', function (e) {
      px = e.clientX; py = e.clientY;
      if (!queued) { queued = true; requestAnimationFrame(paint); }
    });
  });

  /* ── pause looping animations in off-screen sections ─ */
  if (hasIO) {
    var idleIO = new IntersectionObserver(function (es) {
      es.forEach(function (e) { e.target.classList.toggle('idle', !e.isIntersecting); });
    }, { rootMargin: '200px 0px' });
    $$('main > section, .ticker').forEach(function (el) { idleIO.observe(el); });
  }

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
        : "We've emailed " + (d.email || 'you') + ' a link. Open it to confirm your email — that\'s the moment your founding place is claimed. Places go in the order people confirm.';
    }
    host.innerHTML = '';
    host.appendChild(node);
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
    lbl.textContent = on ? 'Joining…' : lbl.getAttribute(founding.open ? 'data-label-open' : 'data-label-closed');
  }

  $$('.rs-form').forEach(function (form) {
    var email = $('input[name=email]', form);
    var invite = $('input[name=invite]', form);
    var busy = false;
    syncForm(form);

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
      if (!code && !founding.open) {
        $('[data-invite-field]', form).open = true;
        return setError(form, 'Founding membership is closed, so joining needs an invitation code from a member.', invite);
      }
      setError(form, '');

      // Honeypot filled: a bot. Look successful, send nothing.
      if ($('input[name=website]', form).value) { showDone(host, { name: name }); return; }

      busy = true;
      setLoading(form, true);
      rpc('rs_join', { p_email: value, p_first_name: name || null, p_invite: code || null, p_source: form.getAttribute('data-source') })
      .then(function () {
        registered = { name: name, at: Date.now() };
        store(false, registered);
        var done = showDone(host, { name: name, email: value, invite: !!code });
        done.focus({ preventScroll: true });
        if (dock && dock.hideForGood) dock.hideForGood();
        if (window.va) window.va('event', { name: 'founding_join', data: { source: form.getAttribute('data-source'), invited: !!code } });
      }).catch(function (err) {
        busy = false;
        setLoading(form, false);
        var msg = String(err && err.message || '');
        var inv = msg.match(/^INVITE_(USED|EXPIRED|REVOKED|INVALID)/);
        if (err && err.code === '54000' || msg.indexOf('RATE_LIMIT') === 0) {
          setError(form, 'Too many attempts from this connection. Give it a few minutes and try again.');
        } else if (msg.indexOf('INVALID_EMAIL') === 0) {
          setError(form, "That doesn't look like a valid email address.", email);
        } else if (inv) {
          $('[data-invite-field]', form).open = true;
          setError(form, INVITE_MSG[inv[1].toLowerCase()], invite);
        } else if (msg.indexOf('INVITE_REQUIRED') === 0) {
          // The last founding place went while this page was open.
          loadFounding();
          setPhase(false);
          setError(form, 'The last founding place has just been claimed. RipeStream is now invite-only — add an invitation code from a member to join.', invite);
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

  /* ── social graph ──────────────────────────────────── */
  var graph = $('#graph');
  if (graph) {
    var info = {
      you: ['You', 'At the centre. Everything connects through you — and only as much as you choose.'],
      people: ['People', 'Friends, family and the people you actually follow. First, by default.'],
      communities: ['Communities', 'Spaces around anything — from film cameras to five-a-side.'],
      creators: ['Creators', 'Follow the people who make things, without losing them in the noise.'],
      events: ['Events', 'From a gig to a 5k — see it, share it, bring your people.'],
      local: ['Local', "What's on near you, wherever you are in the world."],
      interests: ['Interests', 'Topics you choose, not just topics chosen for you.'],
      conversations: ['Conversations', 'Messages and discussions, connected to where they started.']
    };
    var cross = [['people', 'conversations'], ['communities', 'conversations'], ['communities', 'events'],
                 ['local', 'events'], ['creators', 'interests'], ['interests', 'people'], ['creators', 'communities'], ['local', 'interests']];
    var flowing = { people: 1, communities: 1, local: 1, creators: 1 };
    var nodes = {};
    $$('.node', graph).forEach(function (n) {
      var cs = n.style;
      nodes[n.getAttribute('data-k')] = { el: n, x: parseFloat(cs.getPropertyValue('--x')), y: parseFloat(cs.getPropertyValue('--y')) };
    });
    var g = $('#edges', graph), NS = 'http://www.w3.org/2000/svg', edges = [];
    function line(a, b, cls, i) {
      var A = nodes[a], B = nodes[b];
      var p = document.createElementNS(NS, 'path');
      var mx = (A.x + B.x) / 2, my = (A.y + B.y) / 2 * 0.82;
      var bend = cls.indexOf('x') > -1 ? 6 : 0;
      p.setAttribute('d', 'M' + A.x + ' ' + A.y * 0.82 + ' Q' + (mx + bend) + ' ' + (my - bend) + ' ' + B.x + ' ' + B.y * 0.82);
      p.setAttribute('class', 'edge ' + cls);
      p.setAttribute('vector-effect', 'non-scaling-stroke');
      p.style.setProperty('--d', (i * 0.06) + 's');
      g.appendChild(p);
      edges.push({ a: a, b: b, el: p });
    }
    var i = 0;
    Object.keys(nodes).forEach(function (k) { if (k !== 'you') line('you', k, flowing[k] ? 'flow' : '', i++); });
    cross.forEach(function (c) { line(c[0], c[1], 'x', i++); });

    var cap = $('#world-cap');
    function select(k) {
      Object.keys(nodes).forEach(function (n) { nodes[n].el.setAttribute('aria-pressed', n === k ? 'true' : 'false'); });
      edges.forEach(function (e) { e.el.classList.toggle('on', k !== 'you' && (e.a === k || e.b === k)); });
      $('b', cap).textContent = info[k][0];
      $('p', cap).textContent = info[k][1];
    }
    Object.keys(nodes).forEach(function (k) {
      nodes[k].el.addEventListener('click', function () { select(k); });
      if (finePointer) nodes[k].el.addEventListener('mouseenter', function () { select(k); });
    });
  }

  /* ── control demo ──────────────────────────────────── */
  var pv = $('#pv');
  if (pv) {
    var items = [
      { who: 'Aoife Brennan', i: 'AB', g: 'g1', f: true, t: 'Photography', v: false, text: 'Golden hour on the pier. Portra 400, no edits.' },
      { who: 'Sunday League', s: 'Sunday League', i: 'SL', g: 'g5', f: true, t: 'Football', v: false, text: "Kick-off moves to 11:30. You're welcome." },
      { who: 'Kofi Mensah', i: 'KM', g: 'g3', f: false, t: 'Tech', v: true, text: 'Made a beat from a bus stop recording. 58 seconds.' },
      { who: 'Tomás Ruiz', i: 'TR', g: 'g4', f: true, t: 'Tech', v: false, text: 'Home lab, finally racked. Cable management is a lifestyle.' },
      { who: 'Street Food Hunters', s: 'Street Food Hunters', i: 'SF', g: 'g6', f: false, t: 'Food', v: true, text: 'The stall with no sign has a queue round the corner again.' },
      { who: 'Celeb Daily', i: 'CD', g: 'g2', f: false, t: 'Celebrity', v: false, text: "You won't believe what happened at the premiere." },
      { who: 'Maya Chen', i: 'MC', g: 'g2', f: true, t: 'Food', v: false, text: 'Sourdough attempt four. Getting there.' },
      { who: 'Match Clips', i: 'MC', g: 'g1', f: false, t: 'Football', v: true, text: 'Every goal from the weekend, in 60 seconds.' }
    ];
    var state = { mode: 'following', topics: { Photography: 1, Football: 1, Tech: 1, Food: 1, Celebrity: 0 }, video: true, reply: 'Everyone' };
    var modeName = { following: 'Following first', balanced: 'Balanced', discovery: 'Discovery' };

    var render = function () {
      var list = items.filter(function (x) { return state.topics[x.t] && (state.video || !x.v); });
      var fol = list.filter(function (x) { return x.f; }), rest = list.filter(function (x) { return !x.f; });
      var out = [];
      if (state.mode === 'following') out = fol.concat(rest.slice(0, 1));
      else if (state.mode === 'discovery') out = rest.concat(fol.slice(0, 1));
      else { for (var k = 0; k < Math.max(fol.length, rest.length); k++) { if (fol[k]) out.push(fol[k]); if (rest[k]) out.push(rest[k]); } }
      out = out.slice(0, 4);
      pv.innerHTML = out.length ? out.map(function (x, n) {
        var why = x.f ? 'You follow ' + (x.s || x.who.split(' ')[0]) : 'Suggested · because you like ' + x.t;
        return '<div class="pv-item" style="--d:' + (reduced ? 0 : n * 0.06) + 's"><span class="av ' + x.g + '">' + x.i + '</span><div><b>' + x.who +
          (x.v ? ' <span>· video</span>' : '') + '</b><p>' + x.text + '</p><span class="why-tag' + (x.f ? '' : ' d') + '">' + why + '</span></div></div>';
      }).join('') : '<p class="pv-empty">Nothing matches right now. That\'s allowed — a quiet feed is a feature.</p>';
      $('#pv-mode').textContent = modeName[state.mode];
      $('#pv-reply').textContent = state.reply;
    };

    var seg = function (id, attr, key) {
      $$('#' + id + ' button').forEach(function (b) {
        b.addEventListener('click', function () {
          $$('#' + id + ' button').forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
          state[key] = b.getAttribute(attr); render();
        });
      });
    };
    seg('mode', 'data-mode', 'mode');
    seg('reply', 'data-reply', 'reply');
    $$('#topics .tg').forEach(function (b) {
      b.addEventListener('click', function () {
        var on = b.getAttribute('aria-pressed') !== 'true';
        b.setAttribute('aria-pressed', on ? 'true' : 'false');
        state.topics[b.getAttribute('data-topic')] = on ? 1 : 0; render();
      });
    });
    var sw = $('#sw-video');
    sw.addEventListener('click', function () {
      state.video = sw.getAttribute('aria-checked') !== 'true';
      sw.setAttribute('aria-checked', state.video ? 'true' : 'false'); render();
    });
    render();
  }

  /* ── local city switcher ───────────────────────────── */
  var cities = {
    dublin: ['Dublin', [
      ['#SeaSwimSeason', 'Photos from the morning swimmers'], ['New cycle lane', 'The debate continues']],
      [['Outdoor film night', 'Thu · 8pm · 0.8 km'], ['Saturday food market', 'Sat · 10am']],
      [['Sea Swimmers', 'Tide times, meet-ups, bravery'], ['Northside Runners', 'Easy pace, every Tuesday']],
      [['A bike repair pop-up by the canal', 'Open weekends']],
      [["“Where's a quiet pint that isn't a tourist trap?”", 'Local discussion']],
      [['Photographers near you', 'Who share what you shoot']]],
    lagos: ['Lagos', [
      ['Beach day this weekend', 'Plans are forming'], ['Traffic this morning', 'Shortcuts, shared live']],
      [['Rooftop Afrobeats night', 'Fri · 9pm'], ['Founders breakfast', 'Sat · 9am']],
      [['Lagos Film Photographers', 'Golden hour, every hour'], ['Lekki Runners', 'Before the heat, 6am']],
      [['A new suya spot near you', 'Opened this week']],
      [['“Best place to work remotely with reliable power?”', 'Local discussion']],
      [['Designers near you', 'Portfolios worth following']]],
    lisbon: ['Lisbon', [
      ['Miradouro sunsets', 'Tonight looks good'], ['Surf forecast', 'Clean waves on Saturday']],
      [['Fado night', 'Thu · 9:30pm'], ['Flea market morning', 'Sat · 9am']],
      [['Surf Carpool', 'Seats to the coast'], ['Language Swap', 'Portuguese ⇄ English']],
      [['A new speciality coffee roaster nearby', 'Tasting flights on Fridays']],
      [['“Onde se come o melhor pastel de nata?”', 'Translated · Where do locals actually go?']],
      [['Surfers near you', 'Same break, same mornings']]],
    toronto: ['Toronto', [
      ['First snow predictions', 'Everyone has a theory'], ['Best patios still open', 'Last call for the season']],
      [['Night market', 'Fri · 6pm'], ['Ravine clean-up', 'Sun · 10am']],
      [['Pickup Basketball', 'Courts, times, teams'], ['Board Game Nights East End', 'New players welcome']],
      [['A new ramen bar near you', 'Opened on your street']],
      [['“Winter tyres — worth it downtown?”', 'Local discussion']],
      [['Climbers near you', 'Looking for a belay partner']]],
    melbourne: ['Melbourne', [
      ['Four seasons in one day', 'Again'], ['The laneway coffee debate', 'Strong opinions only']],
      [['Rooftop cinema', 'Sat · 8pm'], ['Riverside 5k', 'Sat · 8am']],
      [['Coffee Nerds', 'Beans, grinders, gossip'], ['Bayside Cyclists', 'Sunday coastal loop']],
      [['A new dumpling place near you', 'Handmade, open late']],
      [['“Best op shops in the north?”', 'Local discussion']],
      [['Musicians near you', 'Looking for a drummer']]],
    seoul: ['Seoul', [
      ['Han River picnic weather', 'Blankets out'], ['New café street', 'Everyone went this weekend']],
      [['Indie gig', 'Fri · 8pm'], ['Night hike', 'Sat · 7pm']],
      [['Film Photographers', 'Scans from the old town'], ['Language Exchange', 'Korean ⇄ English']],
      [['A new bakery near you', 'Salt bread sells out by noon']],
      [['“Best late-night food near the station?”', 'Translated from Korean']],
      [['Runners near you', 'River loop at 6am']]]
  };
  var heads = [['Trending locally', 'var(--ripe)'], ['Events', 'var(--lime)'], ['Local communities', 'var(--sky)'],
               ['Businesses', '#ffd166'], ['Discussions', '#b69cff'], ['People', '#ff9fc6']];
  var lf = $('#localfeed');
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  $$('#cities button').forEach(function (b) {
    b.addEventListener('click', function () {
      if (b.getAttribute('aria-pressed') === 'true') return;
      $$('#cities button').forEach(function (o) { o.setAttribute('aria-pressed', o === b ? 'true' : 'false'); });
      var c = cities[b.getAttribute('data-city')];
      lf.classList.add('swap');
      setTimeout(function () {
        $('#lf-name').textContent = c[0];
        $('#lf-grid').innerHTML = heads.map(function (h, n) {
          return '<div class="lf" style="--c:' + h[1] + '"><h3>' + h[0] + '</h3><ul>' + c[n + 1].map(function (x) {
            return '<li>' + esc(x[0]) + '<small>' + esc(x[1]) + '</small></li>';
          }).join('') + '</ul></div>';
        }).join('');
        requestAnimationFrame(function () { lf.classList.remove('swap'); });
      }, reduced ? 0 : 220);
    });
  });

  /* ── AI demos ──────────────────────────────────────── */
  var sb = $('#sum-btn');
  if (sb) sb.addEventListener('click', function () {
    var out = $('#sum-out'), open = out.hasAttribute('hidden');
    if (open) out.removeAttribute('hidden'); else out.setAttribute('hidden', '');
    sb.setAttribute('aria-expanded', open ? 'true' : 'false');
    $('span', sb).textContent = open ? 'Show the full thread' : 'Summarise 212 replies';
  });
  var tb = $('#tr-btn');
  if (tb) {
    var pt = 'Alguém sabe onde se come o melhor pastel de nata fora das zonas turísticas?';
    var en = 'Does anyone know where to get the best pastel de nata outside the tourist areas?';
    tb.addEventListener('click', function () {
      var on = tb.getAttribute('aria-pressed') !== 'true';
      tb.setAttribute('aria-pressed', on ? 'true' : 'false');
      var t = $('#tr-text');
      t.style.opacity = 0;
      setTimeout(function () {
        t.textContent = on ? en : pt;
        $('#tr-meta').textContent = on ? 'Inês · Lisbon · Translated from Portuguese' : 'Inês · Lisbon · Portuguese';
        $('span', tb).textContent = on ? 'Show original' : 'Translate to English';
        t.style.opacity = 1;
      }, reduced ? 0 : 200);
    });
  }
})();
