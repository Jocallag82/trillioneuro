/* QuadrillionEuro — animation layer (progressive enhancement; no dependencies, no network).
   Nebula-tunnel WebGL field, warp-speed stars that react to scroll and to every slider,
   a hyperjump intro, and the pinned Ascent through the powers of ten. The scenario
   maths in the page's module script is untouched. */
(function () {
  'use strict';
  window.__wow = true;
  var root = document.documentElement;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var fine = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  var hasIO = 'IntersectionObserver' in window;
  var clamp = function (x, a, b) { return Math.min(b, Math.max(a, x)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var sm = function (a, b, x) { x = clamp((x - a) / (b - a), 0, 1); return x * x * (3 - 2 * x); };
  var fmt = function (n) { return Math.floor(n).toLocaleString('en-IE'); };
  var vw = window.innerWidth, vh = window.innerHeight;
  root.classList.add('w');

  /* ── split text ──────────────────────────────────── */
  function labelOf(el) {
    var out = '';
    (function walk(n) {
      Array.prototype.forEach.call(n.childNodes, function (c) {
        if (c.nodeType === 3) out += c.nodeValue; else if (c.nodeName === 'BR') out += ' '; else walk(c);
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
            var w = document.createElement('span'); w.className = 'w'; w.setAttribute('aria-hidden', 'true');
            tok.split('').forEach(function (c) {
              var s = document.createElement('span'); s.className = 'ch'; s.style.setProperty('--i', i++); s.textContent = c; w.appendChild(s);
            });
            frag.appendChild(w);
          });
          node.replaceChild(frag, n);
        } else if (n.nodeType === 1 && n.nodeName !== 'BR') walk(n);
      });
    })(el);
    el.classList.add('sx');
  }
  var h1 = $('header h1');
  if (h1) split(h1);
  var heads = $$('section h2.serif').filter(function (h) { return !h.closest('.ascent'); });
  heads.forEach(split);
  if (hasIO) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: .4 });
    heads.forEach(function (h) { io.observe(h); });
  } else heads.forEach(function (h) { h.classList.add('in'); });

  /* ── shared state ────────────────────────────────── */
  var sy = window.scrollY, lastSy = sy, vel = 0;
  var mx = vw / 2, my = vh / 2, tmx = mx, tmy = my, rx = 0, ry = 0;
  var click = { x: vw / 2, y: vh / 2, t: -99 };
  var boost = 0, flash = 0, spd = .2, travelled = 0;
  var ascEl = $('#ascent'), cp = 0, capNow = -1, tierNow = -1, lastK = 0, uP = 0;

  /* ── intro: hyperjump ────────────────────────────── */
  (function intro() {
    var cur = $('#curtain'), fl = $('#flash');
    function go() { root.classList.add('go'); setTimeout(function () { if (h1) h1.classList.add('in'); }, reduced || !cur ? 0 : 150); }
    try { sessionStorage.setItem('qe_intro', '1'); } catch (e) {}
    if (!cur || reduced || root.classList.contains('nocur')) { if (cur) cur.remove(); go(); return; }
    var c = $('canvas', cur), x = c.getContext('2d'), cnt = $('.count', cur), t0 = performance.now(), D = 2100, ss = [];
    c.width = vw; c.height = vh;
    for (var i = 0; i < 260; i++) ss.push({ a: Math.random() * 6.283, d: Math.random(), z: Math.random() });
    (function tick(now) {
      var p = clamp((now - t0) / D, 0, 1), e = p * p * (3 - 2 * p);
      cnt.firstChild.nodeValue = '10';
      $('sup', cnt).textContent = Math.round(e * 15);
      x.fillStyle = 'rgba(2,2,10,.35)'; x.fillRect(0, 0, vw, vh);
      var sp = .004 + Math.pow(p, 3) * .09, cxx = vw / 2, cyy = vh / 2, R = Math.hypot(vw, vh) / 2;
      ss.forEach(function (s) {
        var d0 = s.d; s.d += sp * (.4 + s.z * 1.4) * (1 + s.d * 3);
        if (s.d > 1) { s.d = .01; s.a = Math.random() * 6.283; }
        x.strokeStyle = 'rgba(' + (s.z > .6 ? '232,200,105' : '180,190,255') + ',' + (.3 + s.d) + ')'; x.lineWidth = .6 + s.d * 1.8;
        x.beginPath(); x.moveTo(cxx + Math.cos(s.a) * d0 * R, cyy + Math.sin(s.a) * d0 * R); x.lineTo(cxx + Math.cos(s.a) * s.d * R, cyy + Math.sin(s.a) * s.d * R); x.stroke();
      });
      if (p < 1) requestAnimationFrame(tick);
      else {
        fl.classList.add('go'); boost = 1.6; flash = 1;
        setTimeout(function () { cur.classList.add('out'); go(); setTimeout(function () { cur.remove(); }, 1300); }, 120);
      }
    })(t0);
  })();

  /* ── WebGL nebula tunnel ─────────────────────────── */
  var cv = $('#gl'), gl = null, U = {};
  var scale = vw < 760 ? .4 : .55;
  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'uniform vec2 uRes;uniform vec2 uM;uniform vec3 uC;uniform float uT;uniform float uZ;uniform float uP;uniform float uDim;uniform float uF;',
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/uRes;vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;',
    ' vec2 m=(uM-.5*uRes)/uRes.y;p-=m*.16;',
    ' vec2 cp=(uC.xy-.5*uRes)/uRes.y;vec2 dc=p-cp;float cd=length(dc);',
    ' float ring0=exp(-pow((cd-uC.z*.9)*8.,2.))*clamp(1.-uC.z*.5,0.,1.);p+=dc/(cd+.001)*ring0*.05;',
    ' float r=length(p);float a=atan(p.y,p.x);',
    ' float z=.32/(r+.035);',
    ' float w=z-uZ;vec2 pc=vec2(cos(a),sin(a))*1.7;',
    ' float f=fbm(pc+vec2(w*.55,w*.35)+vec2(0.,uT*.015));',
    ' float g=fbm(pc*1.9+vec2(w*1.1,w*.7)+f*2.6);',
    ' vec3 c=mix(vec3(.012,.012,.05),vec3(.13,.07,.42),smoothstep(.25,.8,f));',
    ' c=mix(c,vec3(.02,.5,.6),smoothstep(.5,.95,g)*.5);',
    ' c+=vec3(.95,.72,.28)*pow(g,5.)*(.35+uP*.55);',
    ' float ring=pow(1.-abs(fract(w)*2.-1.),30.);',
    ' c+=vec3(.7,.8,1.)*ring*(.45+uF*.8)*smoothstep(.02,.3,r);',
    ' c+=vec3(.85,.75,1.)*exp(-r*5.)*(.28+uF*.9);',
    ' c+=vec3(1.,.9,.6)*ring0*.5;',
    ' c*=smoothstep(.0,.22,r)*.75+.25;',
    ' c*=1.-.5*dot(uv-.5,uv-.5)*2.;',
    ' c+=(h(gl_FragCoord.xy+uT)-.5)*.02;',
    ' gl_FragColor=vec4(c*uDim,1.);',
    '}'
  ].join('\n');
  function initGL() {
    if (!cv) return false;
    try { gl = cv.getContext('webgl', { alpha: false, antialias: false, depth: false, stencil: false, powerPreference: 'low-power' }); } catch (e) { gl = null; }
    if (!gl) return false;
    function sh(type, src) { var s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return gl.getShaderParameter(s, gl.COMPILE_STATUS) ? s : null; }
    var v = sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'), f = sh(gl.FRAGMENT_SHADER, FS);
    if (!v || !f) return false;
    var pr = gl.createProgram(); gl.attachShader(pr, v); gl.attachShader(pr, f); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return false;
    gl.useProgram(pr); gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uT', 'uM', 'uC', 'uZ', 'uP', 'uDim', 'uF'].forEach(function (n) { U[n] = gl.getUniformLocation(pr, n); });
    cv.addEventListener('webglcontextlost', function (e) { e.preventDefault(); root.classList.add('nogl'); gl = null; });
    sizeGL(); return true;
  }
  function sizeGL() { if (!gl) return; cv.width = Math.max(2, Math.floor(vw * scale)); cv.height = Math.max(2, Math.floor(vh * scale)); gl.viewport(0, 0, cv.width, cv.height); }
  if (!initGL()) root.classList.add('nogl');

  /* ── warp stars (2D) ─────────────────────────────── */
  var sc = $('#stars'), sx = sc && sc.getContext('2d'), dpr = Math.min(window.devicePixelRatio || 1, 1.5), stars = [];
  function sizeStars() { if (!sc) return; sc.width = vw * dpr; sc.height = vh * dpr; }
  sizeStars();
  var NS = vw < 760 ? 260 : 520;
  function reseed(s, far) { s.x = (Math.random() - .5) * 2; s.y = (Math.random() - .5) * 2; s.z = far ? 1 : Math.random(); s.c = Math.random(); return s; }
  for (var i = 0; i < NS; i++) stars.push(reseed({}, false));
  function drawStars(dt) {
    if (!sx) return;
    sx.setTransform(dpr, 0, 0, dpr, 0, 0); sx.clearRect(0, 0, vw, vh);
    var cx = vw / 2 - (mx - vw / 2) * .05, cy = vh / 2 - (my - vh / 2) * .05, F = Math.max(vw, vh) * .55, step = spd * dt * .55;
    for (var i = 0; i < stars.length; i++) {
      var s = stars[i], z0 = s.z; s.z -= step * (.35 + s.c);
      if (s.z <= .02) { reseed(s, true); continue; }
      var x0 = cx + s.x / z0 * F * .08 * 4, y0 = cy + s.y / z0 * F * .08 * 4, x1 = cx + s.x / s.z * F * .08 * 4, y1 = cy + s.y / s.z * F * .08 * 4;
      if (x1 < -50 || x1 > vw + 50 || y1 < -50 || y1 > vh + 50) { reseed(s, true); continue; }
      var a = clamp(1 - s.z, 0, 1);
      sx.strokeStyle = s.c > .8 ? 'rgba(232,200,105,' + (a * .95) + ')' : s.c > .45 ? 'rgba(160,230,255,' + (a * .8) + ')' : 'rgba(210,200,255,' + (a * .8) + ')';
      sx.lineWidth = .5 + a * 1.6; sx.beginPath(); sx.moveTo(x0, y0); sx.lineTo(x1, y1); sx.stroke();
    }
  }

  /* ── The Ascent ──────────────────────────────────── */
  var gArc = $('.arc'), ticks = $$('.tk'), tlabs = $$('.asc-gauge text'), aExp = $('#asc-exp'), aNum = $('#asc-num'), aName = $('#asc-name'), aCaps = $$('#asc-cap p');
  var NAMES = ['ones', 'thousands', 'millions', 'billions', 'trillions', 'quadrillion'];
  function updateAscent() {
    if (!ascEl || reduced) return;
    var r = ascEl.getBoundingClientRect();
    cp = clamp(-r.top / Math.max(1, r.height - vh) / .93, 0, 1);
    var k = cp * 15, kk = Math.floor(k + 1e-6);
    aExp.innerHTML = '10<sup>' + (cp >= .999 ? 15 : kk) + '</sup>';
    aNum.textContent = fmt(cp >= .999 ? 1e15 : Math.pow(10, k));
    var tier = cp >= .999 ? 5 : Math.floor(k / 3);
    if (tier !== tierNow) { tierNow = tier; aName.textContent = NAMES[tier]; }
    gArc.style.strokeDashoffset = (1000 * (1 - cp)).toFixed(1);
    ticks.forEach(function (t, i) { var on = k >= (i + 1) * 3 - 1e-6; t.classList.toggle('on', on); tlabs[i].classList.toggle('on', on); });
    var ci = tier;
    if (ci !== capNow) { capNow = ci; aCaps.forEach(function (p, j) { p.classList.toggle('on', j === ci); }); }
    if (Math.floor(k / 3 + 1e-6) !== Math.floor(lastK / 3 + 1e-6) && Math.abs(k - lastK) < 2) { flash = 1; boost = Math.max(boost, 1.2); }
    lastK = k; ascEl.classList.toggle('deep', cp > .03);
    ascEl.style.setProperty('--p', cp.toFixed(3));
  }
  if (ascEl && !reduced) {
    var g = $('.asc-gauge'), R = 176, ns = 'http://www.w3.org/2000/svg';
    [3, 6, 9, 12, 15].forEach(function (kv, i) {
      var ang = kv / 15 * Math.PI * 2, px = 200 + Math.cos(ang) * R, py = 200 + Math.sin(ang) * R;
      var c = document.createElementNS(ns, 'circle'); c.setAttribute('class', 'tk'); c.setAttribute('cx', px); c.setAttribute('cy', py); c.setAttribute('r', 9); g.appendChild(c);
      var t = document.createElementNS(ns, 'text'), lx = 200 + Math.cos(ang) * (R + 34), ly = 200 + Math.sin(ang) * (R + 34);
      t.setAttribute('x', lx); t.setAttribute('y', ly); t.setAttribute('text-anchor', 'middle'); t.setAttribute('dominant-baseline', 'middle');
      t.setAttribute('transform', 'rotate(90 ' + lx + ' ' + ly + ')'); t.textContent = '10' + ['³', '⁶', '⁹', '¹²', '¹⁵'][i]; g.appendChild(t);
    });
    ticks = $$('.tk'); tlabs = $$('.asc-gauge text');
  }

  /* ── marquee ─────────────────────────────────────── */
  var mq = $('.mq'), mtr = mq && $('.mq-track', mq), mw = 1, mxp = 0;
  if (mtr) { mw = mtr.scrollWidth || 1; var html = mtr.innerHTML, reps = Math.ceil(vw * 2.4 / mw) + 1; for (var q = 0; q < reps; q++) mtr.insertAdjacentHTML('beforeend', html); }

  /* ── input: sliders hit the thrusters ────────────── */
  document.addEventListener('input', function (e) { if (e.target.matches && e.target.matches('input[type=range],input[type=number]')) { boost = Math.max(boost, .9); flash = Math.max(flash, .45); } });
  var clockEl = $('#clock-out');
  if (clockEl && 'MutationObserver' in window && !reduced) {
    new MutationObserver(function () { clockEl.classList.remove('flip'); void clockEl.offsetWidth; clockEl.classList.add('flip'); }).observe(clockEl, { childList: true, characterData: true, subtree: true });
    var wrap = clockEl.parentNode; if (wrap && !wrap.classList.contains('clock-ring')) { var rg = document.createElement('div'); rg.className = 'clock-ring'; wrap.insertBefore(rg, clockEl); rg.appendChild(clockEl); }
  }

  /* ── pointer, orb, spotlight ─────────────────────── */
  window.addEventListener('resize', function () { vw = window.innerWidth; vh = window.innerHeight; sizeGL(); sizeStars(); });
  window.addEventListener('scroll', function () { sy = window.scrollY; }, { passive: true });
  window.addEventListener('pointermove', function (e) { tmx = e.clientX; tmy = e.clientY; }, { passive: true });
  window.addEventListener('pointerdown', function (e) { click.x = e.clientX; click.y = e.clientY; click.t = performance.now() / 1000; boost = Math.max(boost, .8); }, { passive: true });
  var orb = null, ox = -100, oy = -100, dx = -100, dy = -100;
  if (fine && !reduced) {
    orb = document.createElement('div'); orb.className = 'orb'; orb.setAttribute('aria-hidden', 'true'); document.body.appendChild(orb);
    window.addEventListener('pointermove', function (e) { root.classList.add('cur-on'); dx = e.clientX; dy = e.clientY; orb.classList.toggle('big', !!(e.target.closest && e.target.closest('a,button,summary,input'))); }, { passive: true });
  }
  document.addEventListener('pointermove', function (e) {
    var t = e.target.closest && e.target.closest('.card,.panel');
    if (t) { var b = t.getBoundingClientRect(); t.style.setProperty('--mx', (e.clientX - b.left) + 'px'); t.style.setProperty('--my', (e.clientY - b.top) + 'px'); }
  }, { passive: true });

  /* ── main loop ───────────────────────────────────── */
  var last = performance.now(), T = 5, vis = true, bar = $('#prog');
  document.addEventListener('visibilitychange', function () { vis = !document.hidden; last = performance.now(); });
  function draw() {
    if (!gl) return;
    var dim = lerp(.9, .42, sm(0, vh * .8, sy));
    if (ascEl && !reduced) {
      var r = ascEl.getBoundingClientRect(), a = sm(vh, 0, r.top), l = 1 - clamp(r.bottom / vh, 0, 1);
      dim = lerp(dim, .8, a); dim = lerp(dim, .34, l);
    } else dim = lerp(.9, .34, sm(vh * .5, vh * 1.6, sy));
    uP = lerp(uP, cp, .1);
    gl.uniform2f(U.uRes, cv.width, cv.height); gl.uniform1f(U.uT, T); gl.uniform1f(U.uZ, travelled);
    gl.uniform2f(U.uM, mx * scale, (vh - my) * scale);
    gl.uniform3f(U.uC, click.x * scale, (vh - click.y) * scale, clamp(performance.now() / 1000 - click.t, 0, 3));
    gl.uniform1f(U.uP, uP); gl.uniform1f(U.uDim, dim); gl.uniform1f(U.uF, flash);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function frame(now) {
    requestAnimationFrame(frame);
    if (!vis) return;
    var dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
    vel = lerp(vel, (sy - lastSy) / Math.max(dt, .001), .12); lastSy = sy;
    mx = lerp(mx, tmx, .08); my = lerp(my, tmy, .08);
    rx = lerp(rx, my / vh - .5, .06); ry = lerp(ry, mx / vw - .5, .06);
    boost *= Math.pow(.18, dt); flash *= Math.pow(.12, dt);
    var target = .22 + Math.min(2.2, Math.abs(vel) / 900) + boost * 2.2 + (ascEl && !reduced ? cp * 1.6 : 0);
    spd = lerp(spd, target, .06); travelled += dt * (.06 + spd * .55);
    if (h1 && sy < vh) { h1.style.setProperty('--rx', (-rx * 6).toFixed(2) + 'deg'); h1.style.setProperty('--ry', (ry * 8).toFixed(2) + 'deg'); }
    if (bar) bar.style.transform = 'scaleX(' + clamp(sy / Math.max(1, document.documentElement.scrollHeight - vh), 0, 1).toFixed(4) + ')';
    updateAscent();
    if (mtr) { mxp -= (60 + Math.abs(vel) * .5) * dt; if (mxp <= -mw) mxp += mw; mtr.style.transform = 'translate3d(' + mxp.toFixed(1) + 'px,0,0)'; }
    if (orb) { ox = lerp(ox, dx, .2); oy = lerp(oy, dy, .2); orb.style.transform = 'translate3d(' + ox.toFixed(1) + 'px,' + oy.toFixed(1) + 'px,0)'; }
    draw(); drawStars(dt);
  }
  if (reduced) { draw(); } else requestAnimationFrame(frame);
})();
