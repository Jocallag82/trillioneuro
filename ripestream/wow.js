/* RipeStream — the animation layer. Progressive enhancement only: the page
   reads and works fully without this file (join form, copy, links). Adds:
   WebGL "ripening" background, intro, split-text, scroll-driven story, 3D phone,
   magnetic buttons, cursor, marquee, confetti. No dependencies, no network.
   Respects prefers-reduced-motion (no loops, no pinned scroll, one still frame). */
(function () {
  'use strict';

  var root = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var clamp = function (x, a, b) { return Math.min(b, Math.max(a, x)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var vw = window.innerWidth, vh = window.innerHeight;

  /* ── palette: raw lime → ripe orange → pink → plum (mirrored in the shader) ── */
  var CA = [200, 245, 90], CB = [255, 91, 31], CC = [240, 30, 128], CD = [122, 44, 255];
  function sm(a, b, x) { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); }
  function mixc(u, v, t) { return [lerp(u[0], v[0], t), lerp(u[1], v[1], t), lerp(u[2], v[2], t)]; }
  function pal(k) { return mixc(mixc(CA, CB, sm(0, .45, k)), mixc(CC, CD, sm(.55, 1, k)), sm(.35, .7, k)); }
  var rgb = function (c) { return 'rgb(' + (c[0] | 0) + ',' + (c[1] | 0) + ',' + (c[2] | 0) + ')'; };

  /* ── split text ──────────────────────────────────── */
  function labelOf(el) {
    var out = '';
    (function walk(n) {
      Array.prototype.forEach.call(n.childNodes, function (c) {
        if (c.nodeType === 3) out += c.nodeValue;
        else if (c.nodeName === 'BR') out += ' ';
        else walk(c);
      });
    })(el);
    return out.replace(/\s+/g, ' ').trim();
  }
  function split(el) {
    if (el.classList.contains('sx')) return;
    if (reduced) { el.classList.add('sx', 'in'); return; }
    el.setAttribute('aria-label', labelOf(el));
    var i = 0;
    (function walk(node) {
      Array.prototype.slice.call(node.childNodes).forEach(function (n) {
        if (n.nodeType === 3) {
          var frag = document.createDocumentFragment();
          n.nodeValue.split(/(\s+)/).forEach(function (tok) {
            if (!tok) return;
            if (/^\s+$/.test(tok)) { frag.appendChild(document.createTextNode(' ')); return; }
            var w = document.createElement('span');
            w.className = 'w'; w.setAttribute('aria-hidden', 'true');
            tok.split('').forEach(function (c) {
              var s = document.createElement('span');
              s.className = 'ch'; s.style.setProperty('--i', i++); s.textContent = c;
              w.appendChild(s);
            });
            frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.nodeName !== 'BR' && !n.classList.contains('sr')) walk(n);
      });
    })(el);
    el.classList.add('sx');
  }
  $$('[data-split]').forEach(split);

  /* scrubbed manifesto: words light up with scroll */
  var scrubEl = $('[data-scrub]'), scrubWords = [];
  if (scrubEl && !reduced) {
    var HOT = /^(someone|decision\.?)$/i;
    var words = labelOf(scrubEl).split(' ');
    scrubEl.setAttribute('aria-label', words.join(' '));
    scrubEl.textContent = '';
    words.forEach(function (w, n) {
      var s = document.createElement('span');
      s.className = 'wd' + (HOT.test(w.replace(/[’']s$/, '')) ? ' hot' : '');
      s.setAttribute('aria-hidden', 'true'); s.textContent = w;
      scrubEl.appendChild(s); if (n < words.length - 1) scrubEl.appendChild(document.createTextNode(' '));
      scrubWords.push(s);
    });
  }

  /* ── intro curtain ───────────────────────────────── */
  (function intro() {
    var cur = $('#curtain'), seen = false;
    function go() {
      root.classList.add('go');
      var h = $('#hero-title');
      if (h) setTimeout(function () { h.classList.add('in'); }, reduced ? 0 : 300);
    }
    try { seen = !!sessionStorage.getItem('rs_intro'); sessionStorage.setItem('rs_intro', '1'); } catch (e) {}
    if (!cur) { go(); return; }
    if (reduced || seen) { cur.remove(); go(); return; }
    setTimeout(function () {
      cur.classList.add('out'); go();
      setTimeout(function () { cur.remove(); }, 1600);
    }, 1250);
  })();

  /* ── reveal for split text, scramble, count-up ───── */
  var CH = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  function scramble(el) {
    var txt = el.textContent, n = txt.length, f = 0;
    el.setAttribute('aria-label', txt);
    var id = setInterval(function () {
      f++;
      var out = '';
      for (var i = 0; i < n; i++) out += (i < f * n / 14 || txt.charAt(i) === ' ') ? txt.charAt(i) : CH.charAt(Math.random() * CH.length | 0);
      el.textContent = out;
      if (f >= 14) { clearInterval(id); el.textContent = txt; }
    }, 42);
  }
  function countUp(el) {
    var target = +el.getAttribute('data-count') || 0, t0 = performance.now(), dur = 1900;
    (function step(now) {
      var p = clamp((now - t0) / dur, 0, 1), e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = Math.round(target * e).toLocaleString('en-GB');
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  if (!reduced) $$('[data-count]').forEach(function (el) { el.textContent = '0'; });
  if (hasIO) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (!e.isIntersecting) return;
        var el = e.target; io.unobserve(el);
        if (el.hasAttribute('data-split') && el.id !== 'hero-title') el.classList.add('in');
        if (el.hasAttribute('data-scramble') && !reduced) scramble(el);
        if (el.hasAttribute('data-count')) { if (reduced) el.textContent = (+el.getAttribute('data-count')).toLocaleString('en-GB'); else countUp(el); }
        if (el.classList.contains('col')) el.classList.add('in');
      });
    }, { threshold: .25 });
    $$('[data-split],[data-scramble],[data-count],.col.now').forEach(function (el) { if (el.id !== 'hero-title') io.observe(el); });
  } else {
    $$('[data-split]').forEach(function (el) { el.classList.add('in'); });
    $$('[data-count]').forEach(function (el) { el.textContent = (+el.getAttribute('data-count')).toLocaleString('en-GB'); });
  }

  /* ── WebGL ripening background ───────────────────── */
  var cv = $('#gl'), gl = null, prog = null, U = {};
  var scale = vw < 760 ? .38 : .5;
  var VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'uniform vec2 uRes;uniform float uT;uniform vec2 uM;uniform vec3 uC;uniform vec3 uA;uniform vec3 uB;',
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/uRes;vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;',
    ' vec2 m=(uM-.5*uRes)/uRes.y;float t=uT*.06;',
    ' vec2 dm=p-m;float dd=length(dm);p+=dm/(dd+.12)*.09*exp(-dd*2.2);',
    ' vec2 cp=(uC.xy-.5*uRes)/uRes.y;vec2 dc=p-cp;float cd=length(dc);float age=uC.z;',
    ' float ring=exp(-pow((cd-age*.85)*8.,2.))*clamp(1.-age*.55,0.,1.);',
    ' p+=dc/(cd+.001)*ring*.05;',
    ' vec2 q=vec2(fbm(p*1.6+t),fbm(p*1.6+vec2(5.2,1.3)-t));',
    ' vec2 r=vec2(fbm(p*1.6+3.*q+vec2(1.7,9.2)+t*1.4),fbm(p*1.6+3.*q+vec2(8.3,2.8)-t*1.1));',
    ' float f=fbm(p*1.6+3.*r);',
    ' vec3 col=vec3(.03,.02,.045);',
    ' col=mix(col,uA*.5,smoothstep(.3,.85,f)*.9);',
    ' col+=uB*pow(clamp(f*1.3-.42,0.,1.),2.4)*1.05;',
    ' col+=uB*ring*.45;',
    ' col*=1.-.5*dot(uv-.5,uv-.5)*2.;',
    ' gl_FragColor=vec4(col,1.);',
    '}'
  ].join('\n');

  function initGL() {
    if (!cv) return false;
    try { gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
    if (!gl) return false;
    function sh(type, src) {
      var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null;
    }
    var v = sh(gl.VERTEX_SHADER, VS), f = sh(gl.FRAGMENT_SHADER, FS);
    if (!v || !f) return false;
    prog = gl.createProgram(); gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    var buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uT', 'uM', 'uC', 'uA', 'uB'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); root.classList.add('nogl'); gl = null; });
    sizeGL();
    return true;
  }
  function sizeGL() {
    if (!gl) return;
    cv.width = Math.max(2, Math.floor(vw * scale)); cv.height = Math.max(2, Math.floor(vh * scale));
    gl.viewport(0, 0, cv.width, cv.height);
  }
  if (!initGL()) root.classList.add('nogl');

  /* ── shared state ────────────────────────────────── */
  var sy = window.scrollY, lastSy = sy, vel = 0, k = 0, kT = 0;
  var mx = vw * .68, my = vh * .5, tmx = mx, tmy = my;       // pointer, px
  var nx = 0, ny = 0, rx = 0, ry = 0;                          // pointer -.5..+.5 and its eased tilt
  var click = { x: vw / 2, y: vh / 2, t: -99 };
  var t0 = performance.now();
  var docMax = 1;
  function measure() { vw = window.innerWidth; vh = window.innerHeight; docMax = Math.max(1, root.scrollHeight - vh); }
  measure();

  var heroCopy = $('#heroCopy'), stage3d = $('#stage3d'), tilt3d = $('#tilt3d'), heroSec = $('#top');
  $$('.chipf', tilt3d).forEach(function (c) { c.style.transform = 'translateZ(' + (c.getAttribute('data-depth') || 60) + 'px)'; });

  /* ── marquees: speed follows scroll velocity ─────── */
  var mqs = [];
  if (!reduced) {
    $$('.mq').forEach(function (m) {
      var t = $('.t', m); if (!t) return;
      mqs.push({ el: t, dir: m.classList.contains('rev') ? -1 : 1, x: 0, half: 0 });
    });
    if (mqs.length) root.classList.add('js-mq');
  }
  function mqMeasure() { mqs.forEach(function (m) { m.half = m.el.scrollWidth / 2; if (m.dir < 0 && m.x === 0) m.x = -m.half; }); }
  mqMeasure();

  /* ── pinned scroll story ─────────────────────────── */
  var storySec = $('#how'), run = $('.story-run'), stage = $('#stage');
  var steps = $$('.step'), posts = $$('.sp'), progs = $$('.story-prog i');
  var seg = $('#stSeg'), segTabs = seg ? $$('span', seg) : [];
  var stSrc = $('#stSrc'), stOrder = $('#stOrder');
  var pinned = !!(storySec && run && stage && posts.length && !reduced);
  var row = 104, lastKey = '';
  var rankOrder = [5, 2, 4, 0, 3, 1];
  var timeOrder = posts.map(function (p, i) { return i; }).sort(function (a, b) { return +posts[a].getAttribute('data-m') - +posts[b].getAttribute('data-m'); });
  var SRC_NAME = { following: 'Following', communities: 'Communities', everyone: 'Everyone' };
  var SRC_TAB = { following: 0, communities: 1, everyone: 2 };
  if (pinned) {
    root.classList.add('pin'); stage.classList.add('pos');
    steps.forEach(function (s, i) { s.classList.toggle('on', i === 0); });
  }
  var copyCol = $('.story-copy');
  function fitStage() {
    if (!pinned) return;
    var narrow = vw <= 940, nat = stage.offsetHeight || 1;
    var avail = narrow ? vh - (copyCol ? copyCol.offsetHeight : 160) - 28 : vh - 150;
    stage.style.setProperty('--ss', clamp(avail / nat, .5, 1).toFixed(3));
  }
  function readRow() { row = parseFloat(getComputedStyle(root).getPropertyValue('--row')) || 104; lastKey = ''; fitStage(); }
  readRow();
  function storyUpdate(p) {
    var s = p < .333 ? 0 : p < .667 ? 1 : 2;
    var lf = clamp(s === 0 ? p / .333 : s === 1 ? (p - .333) / .334 : (p - .667) / .333, 0, 1);
    var src, sorted, why;
    if (s === 0) { src = lf < .34 ? 'following' : lf < .67 ? 'communities' : 'everyone'; sorted = false; why = false; }
    else if (s === 1) { src = 'everyone'; sorted = lf > .42; why = false; }
    else { src = lf < .3 ? 'following' : lf < .58 ? 'communities' : 'everyone'; sorted = true; why = lf > .08; }
    steps.forEach(function (el, i) { el.classList.toggle('on', i === s); });
    progs.forEach(function (el, i) { el.style.setProperty('--f', i < s ? 1 : i === s ? lf.toFixed(3) : 0); });
    var key = src + sorted + why;
    if (key === lastKey) return;
    lastKey = key;
    var order = sorted ? timeOrder : rankOrder, shown = 0;
    var vis = order.filter(function (i) { return src === 'everyone' || posts[i].getAttribute('data-src') === src; });
    var rest = order.filter(function (i) { return vis.indexOf(i) < 0; });   // filtered-out posts stay as faint ghosts underneath
    posts.forEach(function (el, i) {
      var r = vis.indexOf(i), g = rest.indexOf(i);
      if (r > -1) { el.style.transform = 'translate3d(0,' + (r * row) + 'px,0)'; el.style.opacity = 1; el.style.filter = 'none'; }
      else { el.style.transform = 'translate3d(0,' + ((vis.length + g) * row) + 'px,0) scale(.95)'; el.style.opacity = .1; el.style.filter = 'blur(2px)'; }
      el.classList.toggle('why-on', why && r > -1);
      el.classList.toggle('newest', sorted && r === 0);
    });
    if (stSrc) stSrc.textContent = SRC_NAME[src];
    if (stOrder) stOrder.textContent = sorted ? 'newest first' : 'engagement-ranked (illustration)';
    if (seg) {
      seg.style.setProperty('--tab', (SRC_TAB[src] * 100) + '%');
      segTabs.forEach(function (t, i) { t.classList.toggle('on', i === SRC_TAB[src]); });
    }
  }
  if (pinned) storyUpdate(0);

  /* the mobile join bar steps aside while the pinned story fills the screen */
  var dockEl = $('#dock');
  if (dockEl && hasIO && storySec) new IntersectionObserver(function (es) { dockEl.classList.toggle('hide', es[0].isIntersecting); }, { threshold: .15 }).observe(storySec);

  /* ── hero phone: auto-cycles the three sources ───── */
  var PH = {
    following: [['AB', 'g1', 'Aoife', '', '12m', 'Golden hour on the pier. Portra 400, no edits.', 'You follow them'], ['PR', 'g2', 'Priya', '', '22m', 'No spoiler, but that finale. Ring me when you have watched it.', 'You follow them'], ['MJ', 'g2', 'Mina', '', '3h', 'Week 9 of marathon training. Legs: questionable. Spirit: intact.', 'You follow them']],
    communities: [['KM', 'g5', 'Kofi', 'Bedroom Producers', '31m', 'Made a whole beat from ten minutes of the bus stop outside my flat. Stems in the replies.', 'From a community you joined'], ['TO', 'g4', 'Tomás', 'Home Lab', '40m', 'Quietest mini PC you have actually lived with? Fan noise is all that matters now.', 'From a community you joined'], ['SM', 'g1', 'Sam', 'Sunday League', '1h', 'Transfer window gossip thread, then back to finding a keeper for Sunday.', 'From a community you joined']],
    everyone: [['AB', 'g1', 'Aoife', '', '12m', 'Golden hour on the pier. Portra 400, no edits.', 'You follow them'], ['JD', 'g3', 'Jordan', '', '15m', 'Is anyone else completely done with crypto adverts on every podcast?', 'Everyone · newest first'], ['LN', 'g4', 'Lena', '', '2h', 'First sourdough that actually rose. Photographic evidence to follow.', 'Everyone · newest first']]
  };
  var phFeed = $('#phFeed'), phSeg = $('#phSeg');
  function el(tag, cls, text) { var n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
  function phCard(p) {
    var li = el('li', 'post'), ph = el('div', 'ph'), av = el('span', 'av ' + p[1], p[0]);
    ph.appendChild(av); ph.appendChild(el('b', null, p[2]));
    ph.appendChild(el('span', 't', (p[3] ? 'in ' + p[3] + ' · ' : '· ') + p[4]));
    li.appendChild(ph); li.appendChild(el('p', 'body', p[5])); li.appendChild(el('span', 'why', p[6]));
    return li;
  }
  var phOrder = ['communities', 'everyone', 'following'], phI = 0, phTimer = 0, phOn = true;
  function phStep() {
    if (!phOn || document.hidden) return;
    var key = phOrder[phI++ % 3], tab = { following: 0, communities: 1, everyone: 2 }[key];
    var kids = Array.prototype.slice.call(phFeed.children);
    kids.forEach(function (c, n) { c.style.transitionDelay = (n * 40) + 'ms'; c.classList.add('leave'); });
    setTimeout(function () {
      var cards = PH[key].map(phCard);
      phFeed.replaceChildren.apply(phFeed, cards);
      cards.forEach(function (c, n) { c.classList.add('enter'); c.style.transitionDelay = (n * 90) + 'ms'; });
      requestAnimationFrame(function () { requestAnimationFrame(function () { cards.forEach(function (c) { c.classList.remove('enter'); }); }); });
      phSeg.firstElementChild.style.transform = 'translateX(' + (tab * 100) + '%)';
      $$('span', phSeg).forEach(function (s, i) { s.classList.toggle('on', i === tab); });
    }, 380);
  }
  if (phFeed && phSeg && !reduced) {
    phTimer = setInterval(phStep, 3600);
    if (hasIO && heroSec) new IntersectionObserver(function (es) { phOn = es[0].isIntersecting; }).observe(heroSec);
  }

  /* ── pointer: cursor, tilt, spotlight, click shockwave ── */
  var cur = $('#cur'), cx = 0, cy = 0, tx = 0, ty = 0, seen = false;
  window.addEventListener('pointermove', function (e) {
    if (e.pointerType === 'touch') return;
    tx = e.clientX; ty = e.clientY; tmx = tx; tmy = ty;
    nx = tx / vw - .5; ny = ty / vh - .5;
    if (!seen && cur && fine) { seen = true; cx = tx; cy = ty; cur.classList.add('on'); }
    var g = e.target.closest ? e.target.closest('.glass') : null;
    if (g) { var r = g.getBoundingClientRect(); g.style.setProperty('--mx', (e.clientX - r.left) + 'px'); g.style.setProperty('--my', (e.clientY - r.top) + 'px'); }
    if (cur && fine) cur.classList.toggle('big', !!(e.target.closest && e.target.closest('a,button,summary,input,[data-hover]')));
    var mf = $('#megafoot');
    if (mf) { var fr = mf.getBoundingClientRect(); if (fr.bottom > 0 && fr.top < vh) { mf.style.setProperty('--fx', (e.clientX - fr.left) + 'px'); mf.style.setProperty('--fy', (e.clientY - fr.top) + 'px'); } }
  }, { passive: true });
  window.addEventListener('pointerdown', function (e) {
    click.x = e.clientX; click.y = e.clientY; click.t = performance.now();
    if (cur) cur.classList.add('down');
  }, { passive: true });
  window.addEventListener('pointerup', function () { if (cur) cur.classList.remove('down'); }, { passive: true });
  document.addEventListener('pointerleave', function () { if (cur) cur.classList.remove('on'); seen = false; });

  if (fine && !reduced) {
    $$('[data-mag]').forEach(function (b) {
      b.addEventListener('pointermove', function (e) {
        var r = b.getBoundingClientRect();
        b.style.transform = 'translate(' + ((e.clientX - r.left - r.width / 2) * .28).toFixed(1) + 'px,' + ((e.clientY - r.top - r.height / 2) * .4).toFixed(1) + 'px)';
      });
      b.addEventListener('pointerleave', function () { b.style.transform = ''; });
    });
    var cloud = $('#cloud');
    if (cloud) {
      var bubbles = $$('li>div', cloud);
      cloud.addEventListener('pointermove', function (e) {
        bubbles.forEach(function (b) {
          var r = b.getBoundingClientRect(), dx = r.left + r.width / 2 - e.clientX, dy = r.top + r.height / 2 - e.clientY, d = Math.sqrt(dx * dx + dy * dy), f = clamp(1 - d / 220, 0, 1);
          b.style.setProperty('--px', (dx / (d + 1) * f * 46).toFixed(1) + 'px'); b.style.setProperty('--py', (dy / (d + 1) * f * 46).toFixed(1) + 'px');
        });
      });
      cloud.addEventListener('pointerleave', function () { bubbles.forEach(function (b) { b.style.setProperty('--px', '0px'); b.style.setProperty('--py', '0px'); }); });
    }
  }

  /* ── confetti on a successful join ───────────────── */
  var cf = $('#confetti'), cctx = cf && cf.getContext ? cf.getContext('2d') : null, bits = [], cfRaf = 0;
  function burst(ox, oy) {
    if (!cctx || reduced) return;
    cf.width = vw; cf.height = vh;
    var cols = ['#c8f55a', '#ff5b1f', '#f01e80', '#7a2cff', '#f4efe7', '#ffb36b'];
    for (var i = 0; i < 190; i++) {
      var a = Math.random() * Math.PI * 2, s = 4 + Math.random() * 13;
      bits.push({ x: ox, y: oy, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 6, r: Math.random() * 6, vr: (Math.random() - .5) * .4, w: 6 + Math.random() * 9, h: 4 + Math.random() * 6, c: cols[i % cols.length], life: 1, round: Math.random() < .3 });
    }
    click.x = ox; click.y = oy; click.t = performance.now();
    if (!cfRaf) cfRaf = requestAnimationFrame(cfStep);
  }
  function cfStep() {
    cctx.clearRect(0, 0, cf.width, cf.height);
    bits = bits.filter(function (b) { return b.life > 0 && b.y < vh + 40; });
    bits.forEach(function (b) {
      b.vy += .32; b.vx *= .985; b.vy *= .992; b.x += b.vx; b.y += b.vy; b.r += b.vr; b.life -= .0055;
      cctx.save(); cctx.globalAlpha = clamp(b.life * 1.6, 0, 1); cctx.translate(b.x, b.y); cctx.rotate(b.r); cctx.fillStyle = b.c;
      if (b.round) { cctx.beginPath(); cctx.arc(0, 0, b.h / 1.3, 0, 6.3); cctx.fill(); } else cctx.fillRect(-b.w / 2, -b.h / 2, b.w, b.h);
      cctx.restore();
    });
    cfRaf = bits.length ? requestAnimationFrame(cfStep) : (cctx.clearRect(0, 0, cf.width, cf.height), 0);
  }
  var submitAt = 0;
  document.addEventListener('submit', function () { submitAt = Date.now(); }, true);
  $$('[data-form-host]').forEach(function (host) {
    new MutationObserver(function (list) {
      list.forEach(function (m) {
        Array.prototype.forEach.call(m.addedNodes, function (n) {
          if (n.nodeType === 1 && n.classList.contains('done') && Date.now() - submitAt < 30000) {
            var r = host.getBoundingClientRect(); burst(r.left + r.width / 2, r.top + Math.min(r.height / 2, vh / 2));
          }
        });
      });
    }).observe(host, { childList: true });
  });

  /* ── the loop ────────────────────────────────────── */
  var raf = 0, last = performance.now(), slow = 0, frames = 0, glOn = false, mqVel = 0, ko = -1;
  function draw(now) {
    sy = window.scrollY;
    var dv = sy - lastSy; lastSy = sy;
    vel = lerp(vel, dv, .14);
    kT = clamp(sy / docMax, 0, 1);
    k = lerp(k, kT, .07);

    /* palette → CSS (orb, meter) and GL */
    if (Math.abs(k - ko) > .002) {
      ko = k;
      var kk = .1 + .82 * k, a = pal(kk), b = pal(clamp(kk + .3, 0, 1));
      root.style.setProperty('--k', k.toFixed(3));
      root.style.setProperty('--o1', rgb(a)); root.style.setProperty('--o2', rgb(b));
      root._pa = a; root._pb = b;
    }
    var pa = root._pa || pal(.1), pb = root._pb || pal(.4);

    /* pointer easing */
    mx = lerp(mx, tmx, .06); my = lerp(my, tmy, .06);
    rx = lerp(rx, -ny * 14, .07); ry = lerp(ry, nx * 20, .07);

    /* hero parallax */
    if (heroCopy && sy < vh * 1.3) {
      var hp = clamp(sy / (vh * .9), 0, 1);
      heroCopy.style.transform = 'translate3d(0,' + (sy * .16).toFixed(1) + 'px,0)';
      heroCopy.style.opacity = (1 - hp * .85).toFixed(3);
      if (tilt3d) tilt3d.style.transform = 'translate3d(0,' + (sy * -.06).toFixed(1) + 'px,0) rotateY(' + (ry - hp * 18).toFixed(2) + 'deg) rotateX(' + (rx + hp * 10).toFixed(2) + 'deg) rotateZ(' + (hp * -6).toFixed(2) + 'deg)';
    }

    /* marquees */
    for (var i = 0; i < mqs.length; i++) {
      var m = mqs[i]; if (!m.half) continue;
      m.x -= (1.1 + Math.abs(vel) * .45) * m.dir;
      if (m.dir > 0) { if (m.x <= -m.half) m.x += m.half; if (m.x > 0) m.x -= m.half; }
      else { if (m.x >= 0) m.x -= m.half; if (m.x < -m.half) m.x += m.half; }
      m.el.style.transform = 'translate3d(' + m.x.toFixed(1) + 'px,0,0) skewX(' + clamp(-vel * .18, -9, 9).toFixed(2) + 'deg)';
    }

    /* pinned story */
    if (pinned && run) {
      var rr = run.getBoundingClientRect();
      if (rr.bottom > -50 && rr.top < vh + 50) storyUpdate(clamp(-rr.top / Math.max(1, rr.height - vh), 0, .9999));
    }

    /* manifesto words */
    if (scrubWords.length) {
      var sr = scrubEl.getBoundingClientRect();
      if (sr.bottom > 0 && sr.top < vh) {
        var sp = clamp((vh * .88 - sr.top) / (vh * .88 - vh * .42 + sr.height), 0, 1), lit = Math.round(sp * (scrubWords.length + 1));
        for (var w = 0; w < scrubWords.length; w++) { var on = w < lit; if (scrubWords[w]._on !== on) { scrubWords[w]._on = on; scrubWords[w].classList.toggle('lit', on); } }
      }
    }

    /* membership connector */
    var stp = $('#steps');
    if (stp) { var sr2 = stp.getBoundingClientRect(); stp.style.setProperty('--line', clamp((vh * .85 - sr2.top) / (vh * .5), 0, 1).toFixed(3)); }

    /* cursor */
    if (cur && seen) { cx = lerp(cx, tx, .2); cy = lerp(cy, ty, .2); cur.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)'; }

    /* GL */
    if (gl) {
      var age = (now - click.t) / 1000;
      gl.uniform2f(U.uRes, cv.width, cv.height);
      gl.uniform1f(U.uT, reduced ? 6 : (now - t0) / 1000);
      gl.uniform2f(U.uM, mx * scale, (vh - my) * scale);
      gl.uniform3f(U.uC, click.x * scale, (vh - click.y) * scale, age > 4 ? 99 : age);
      gl.uniform3f(U.uA, pa[0] / 255, pa[1] / 255, pa[2] / 255);
      gl.uniform3f(U.uB, pb[0] / 255, pb[1] / 255, pb[2] / 255);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
      if (!glOn) { glOn = true; cv.classList.add('on'); }
      // adaptive resolution: if frames are slow for ~1.5s, shrink the buffer
      var dt = now - last; frames++;
      if (frames > 20) { slow = dt > 30 ? slow + 1 : Math.max(0, slow - 1); if (slow > 70 && scale > .26) { scale *= .8; slow = 0; sizeGL(); } }
    }
    last = now;
  }
  function loop(now) { raf = requestAnimationFrame(loop); draw(now); }
  function start() { if (!raf) { last = performance.now(); raf = requestAnimationFrame(loop); } }
  function stop() { if (raf) { cancelAnimationFrame(raf); raf = 0; } }

  if (reduced) {
    // One still frame; repaint only when the scroll position (colour) changes.
    var pend = false;
    var still = function () { pend = false; draw(performance.now()); };
    still();
    window.addEventListener('scroll', function () { if (!pend) { pend = true; requestAnimationFrame(still); } }, { passive: true });
  } else {
    start();
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else start(); });
  }

  var rt = 0;
  window.addEventListener('resize', function () {
    clearTimeout(rt);
    rt = setTimeout(function () { measure(); sizeGL(); readRow(); mqMeasure(); if (reduced) draw(performance.now()); }, 140);
  });
  window.addEventListener('load', function () { measure(); mqMeasure(); setTimeout(measure, 600); });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(function () { measure(); mqMeasure(); });
})();
