/* RipeStream landing — progressive enhancement only. The page reads fully
   without this file; everything here adds motion, the interactive concept
   demos and the interest-registration submit. No dependencies. */
(function () {
  'use strict';

  /* Same Supabase project as the other sites in this repo. Publishable key:
     meant to ship in the browser. anon can do exactly one thing with it
     here — call rs_register_interest(), which validates, rate-limits and
     de-duplicates server-side (see supabase-setup.sql, RIPESTREAM). */
  var API = 'https://kxzywyflylkcqoidiqmo.supabase.co/rest/v1/rpc/rs_register_interest';
  var KEY = 'sb_publishable_37yXvakYMXdpz2e3Hf_zng__oGOVC-g';
  var STORE = 'rs_interest_v1';
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

  /* ── nav ───────────────────────────────────────────── */
  var nav = $('#nav');
  function onScroll() { nav.classList.toggle('scrolled', window.scrollY > 24); }
  window.addEventListener('scroll', onScroll, { passive: true });
  onScroll();

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

  /* ── interest registration ─────────────────────────── */
  var tpl = $('#done-tpl');

  function showDone(host, name, already) {
    var node = tpl.content.firstElementChild.cloneNode(true);
    var title = $('[data-title]', node);
    if (already) title.textContent = "You're already on the list.";
    else if (name) title.textContent = "You're on the list, " + name + '.';
    host.innerHTML = '';
    host.appendChild(node);
    wireShare($('[data-share]', node));
    return node;
  }

  function markAllDone(exceptHost, name) {
    $$('[data-form-host]').forEach(function (h) {
      if (h !== exceptHost && $('form', h)) showDone(h, name, false);
    });
    if (dock && dock.hideForGood) dock.hideForGood();
  }

  function setError(form, msg, field) {
    var err = $('.err', form);
    err.textContent = msg || '';
    $$('input', form).forEach(function (i) { i.removeAttribute('aria-invalid'); });
    if (field) { field.setAttribute('aria-invalid', 'true'); field.focus(); }
  }

  function setLoading(form, on) {
    var btn = $('button[type=submit]', form);
    btn.disabled = on;
    btn.classList.toggle('loading', on);
    btn.setAttribute('aria-busy', on ? 'true' : 'false');
    $('.lbl', btn).textContent = on ? 'Adding you…' : btn.getAttribute('data-label');
  }

  $$('.rs-form').forEach(function (form) {
    var btn = $('button[type=submit]', form);
    btn.setAttribute('data-label', $('.lbl', btn).textContent);
    var email = $('input[name=email]', form);
    var busy = false;

    email.addEventListener('input', function () {
      if (email.getAttribute('aria-invalid') && EMAIL_RE.test(email.value.trim())) setError(form, '');
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      if (busy) return;                                   // no double submits

      var host = form.closest('[data-form-host]');
      var value = email.value.trim();
      var name = $('input[name=first_name]', form).value.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, 40);

      if (!value) return setError(form, 'Enter your email address.', email);
      if (!EMAIL_RE.test(value) || value.length > 254) {
        return setError(form, "That doesn't look like a valid email address.", email);
      }
      setError(form, '');

      // Honeypot filled: a bot. Look successful, send nothing.
      if ($('input[name=website]', form).value) { showDone(host, name, false); return; }

      busy = true;
      setLoading(form, true);
      var ctrl = 'AbortController' in window ? new AbortController() : null;
      var timer = setTimeout(function () { if (ctrl) ctrl.abort(); }, 15000);

      fetch(API, {
        method: 'POST',
        headers: { 'apikey': KEY, 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify({ p_email: value, p_first_name: name || null, p_source: form.getAttribute('data-source') }),
        signal: ctrl ? ctrl.signal : undefined
      }).then(function (res) {
        if (res.ok) return null;
        return res.json().catch(function () { return {}; }).then(function (body) {
          var err = new Error((body && body.message) || 'HTTP ' + res.status);
          err.code = body && body.code;
          throw err;
        });
      }).then(function () {
        clearTimeout(timer);
        registered = { name: name, at: Date.now() };
        store(false, registered);
        var done = showDone(host, name, false);
        done.focus({ preventScroll: true });
        markAllDone(host, name);
        if (window.va) window.va('event', { name: 'interest_registered', data: { source: form.getAttribute('data-source') } });
      }).catch(function (err) {
        clearTimeout(timer);
        busy = false;
        setLoading(form, false);
        var msg = String(err && err.message || '');
        if (err && err.code === '54000' || msg.indexOf('RATE_LIMIT') === 0) {
          setError(form, 'Too many attempts from this connection. Give it a few minutes and try again.');
        } else if (msg.indexOf('INVALID_EMAIL') === 0) {
          setError(form, "That doesn't look like a valid email address.", email);
        } else if (err && err.name === 'AbortError') {
          setError(form, 'That took too long. Check your connection and try again.');
        } else if (err instanceof TypeError) {
          setError(form, "Couldn't reach us. Check your connection and try again.");
        } else {
          setError(form, "Something went wrong on our side. Please try again in a moment.");
        }
      });
    });
  });

  if (registered) $$('[data-form-host]').forEach(function (h) { showDone(h, registered.name, true); });

  function wireShare(b) {
    if (!b) return;
    b.addEventListener('click', function () {
      var data = { title: 'RipeStream', text: 'A new kind of social network is being built. Register your interest:', url: 'https://ripestream.com/' };
      if (navigator.share) { navigator.share(data).catch(function () {}); return; }
      var done = function () { b.textContent = 'Link copied'; setTimeout(function () { b.textContent = 'Share RipeStream'; }, 2200); };
      if (navigator.clipboard) navigator.clipboard.writeText(data.url).then(done, function () { b.textContent = 'ripestream.com'; });
      else b.textContent = 'ripestream.com';
    });
  }

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
