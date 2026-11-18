/* TrillionEuro — animation layer (progressive enhancement; no dependencies, no network).
   Molten-gold WebGL field, intro, split text, the pinned "Climb" from €1 to €1 trillion,
   velocity marquees, magnetic buttons, cursor, coin bursts. Does not touch data logic:
   home.js / core.js still own every number on the page. */
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
        } else if (n.nodeType === 1 && n.nodeName !== 'BR') walk(n);
      });
    })(el);
    el.classList.add('sx');
  }
  var heroH1 = $('.hero h1');
  if (heroH1) split(heroH1);
  var heads = $$('main h2').filter(function (h) { return !h.closest('.climb'); });
  heads.forEach(split);

  /* ── intro: the zeros count up, the doors open ───── */
  (function intro() {
    var cur = $('#curtain');
    function go() {
      root.classList.add('go');
      setTimeout(function () { if (heroH1) heroH1.classList.add('in'); }, reduced || !cur ? 0 : 250);
    }
    try { sessionStorage.setItem('te_intro', '1'); } catch (e) {}
    if (!cur || reduced || root.classList.contains('nocur')) { if (cur) cur.remove(); go(); return; }
    var num = $('.count span', cur), t0 = performance.now(), D = 1700;
    cur.classList.add('run');
    (function tick(now) {
      var p = clamp((now - t0) / D, 0, 1), e = Math.pow(p, 3.2);
      num.textContent = '€' + fmt(Math.pow(10, e * 12) * (p === 1 ? 1 : 1));
      if (p < 1) requestAnimationFrame(tick);
      else setTimeout(function () {
        cur.classList.add('out'); go();
        setTimeout(function () { cur.remove(); }, 1400);
      }, 380);
    })(t0);
  })();

  /* reveal split headings when they scroll into view */
  if (hasIO) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: .4 });
    heads.forEach(function (h) { io.observe(h); });
  } else heads.forEach(function (h) { h.classList.add('in'); });

  /* ── WebGL molten-gold field ─────────────────────── */
  var cv = $('#gl'), gl = null, U = {};
  var scale = vw < 760 ? .42 : .56;
  var FS = [
    '#ifdef GL_FRAGMENT_PRECISION_HIGH', 'precision highp float;', '#else', 'precision mediump float;', '#endif',
    'uniform vec2 uRes;uniform vec2 uM;uniform vec3 uC;uniform float uT;uniform float uK;uniform float uDim;',
    'float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}',
    'float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(h(i),h(i+vec2(1.,0.)),f.x),mix(h(i+vec2(0.,1.)),h(i+vec2(1.,1.)),f.x),f.y);}',
    'float fbm(vec2 p){float v=0.,a=.5;for(int i=0;i<5;i++){v+=a*n(p);p=p*2.03+vec2(1.7,9.2);a*=.5;}return v;}',
    'void main(){',
    ' vec2 uv=gl_FragCoord.xy/uRes;vec2 p=(gl_FragCoord.xy-.5*uRes)/uRes.y;',
    ' vec2 m=(uM-.5*uRes)/uRes.y;vec2 dm=p-m;float dd=length(dm);',
    ' p+=dm/(dd+.1)*.11*exp(-dd*2.4);',
    ' vec2 cp=(uC.xy-.5*uRes)/uRes.y;vec2 dc=p-cp;float cd=length(dc);float age=uC.z;',
    ' float ring=exp(-pow((cd-age*.9)*9.,2.))*clamp(1.-age*.5,0.,1.);',
    ' p+=dc/(cd+.001)*ring*.06;',
    ' float t=uT*.05;p*=1.5+uK*1.2;',
    ' vec2 q=vec2(fbm(p+t),fbm(p+vec2(5.2,1.3)-t));',
    ' vec2 r=vec2(fbm(p+3.*q+vec2(1.7,9.2)+t*1.3),fbm(p+3.*q+vec2(8.3,2.8)-t));',
    ' float f=fbm(p+3.*r);float ridge=1.-abs(2.*f-1.);',
    ' vec3 col=vec3(.018,.014,.01);',
    ' col=mix(col,vec3(.2,.115,.03),smoothstep(.3,.85,f));',
    ' col+=vec3(.85,.58,.18)*pow(ridge,7.)*(.75+uK*.5);',
    ' col+=vec3(1.,.9,.62)*pow(ridge,22.)*(.55+uK*1.1);',
    ' col+=vec3(1.,.85,.5)*ring*.5;',
    ' col+=vec3(.9,.6,.2)*exp(-dd*5.)*.14;',
    ' col*=1.-.6*dot(uv-.5,uv-.5)*2.;',
    ' col+=(h(gl_FragCoord.xy+uT)-.5)*.02;',
    ' gl_FragColor=vec4(col*uDim,1.);',
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
    var v = sh(gl.VERTEX_SHADER, 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}'), f = sh(gl.FRAGMENT_SHADER, FS);
    if (!v || !f) return false;
    var prog = gl.createProgram(); gl.attachShader(prog, v); gl.attachShader(prog, f); gl.linkProgram(prog);
    if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) return false;
    gl.useProgram(prog);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    var loc = gl.getAttribLocation(prog, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uRes', 'uT', 'uM', 'uC', 'uK', 'uDim'].forEach(function (n) { U[n] = gl.getUniformLocation(prog, n); });
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

  /* ── state ───────────────────────────────────────── */
  var sy = window.scrollY, lastSy = sy, vel = 0;
  var mx = vw * .7, my = vh * .45, tmx = mx, tmy = my, nx = 0, ny = 0, rx = 0, ry = 0;
  var click = { x: vw / 2, y: vh / 2, t: -99 };
  var climbEl = $('#climb'), cNum = $('#c-num span'), cZeros = $('#c-zeros'), cCap = $('#c-cap'), cRail = $('.c-rail i');
  var zeroEls = [], capEls = cCap ? $$('p', cCap) : [], capNow = -1, cp = 0, uK = 0, jackpot = false;
  if (cZeros) { for (var z = 0; z < 12; z++) { var zi = document.createElement('i'); zi.textContent = '0'; cZeros.appendChild(zi); zeroEls.push(zi); } }
  var bar = $('#prog');

  window.addEventListener('resize', function () { vw = window.innerWidth; vh = window.innerHeight; sizeGL(); sizeFx(); });
  window.addEventListener('scroll', function () { sy = window.scrollY; }, { passive: true });
  window.addEventListener('pointermove', function (e) { tmx = e.clientX; tmy = e.clientY; }, { passive: true });
  window.addEventListener('pointerdown', function (e) {
    click.x = e.clientX; click.y = e.clientY; click.t = performance.now() / 1000;
    if (!reduced) burst(e.clientX, e.clientY, e.target.closest && e.target.closest('.btn-gold') ? 34 : 10, e.target.closest && e.target.closest('.btn-gold') ? 9 : 5);
  }, { passive: true });

  /* ── coin bursts (2D canvas) ─────────────────────── */
  var fx = $('#fx'), fctx = fx && fx.getContext('2d'), coins = [], dpr = Math.min(window.devicePixelRatio || 1, 1.5);
  function sizeFx() { if (!fx) return; fx.width = vw * dpr; fx.height = vh * dpr; }
  sizeFx();
  function burst(x, y, n, power) {
    if (!fctx) return;
    for (var i = 0; i < n; i++) {
      var a = Math.random() * Math.PI * 2, s = power * (.4 + Math.random());
      coins.push({ x: x, y: y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - power * .7, r: 6 + Math.random() * 9, ph: Math.random() * 6.28, sp: .12 + Math.random() * .2, rot: Math.random() * 6.28, life: 1, e: Math.random() < .55 });
    }
  }
  function rain() {
    if (!fctx) return;
    for (var i = 0; i < 140; i++) coins.push({ x: Math.random() * vw, y: -20 - Math.random() * vh * .6, vx: (Math.random() - .5) * 2, vy: 1 + Math.random() * 4, r: 7 + Math.random() * 11, ph: Math.random() * 6.28, sp: .1 + Math.random() * .2, rot: Math.random() * 6.28, life: 1, e: Math.random() < .6 });
  }
  function drawFx() {
    if (!fctx) return;
    fctx.setTransform(dpr, 0, 0, dpr, 0, 0); fctx.clearRect(0, 0, vw, vh);
    if (!coins.length) return;
    for (var i = coins.length - 1; i >= 0; i--) {
      var c = coins[i];
      c.vy += .22; c.vx *= .992; c.x += c.vx; c.y += c.vy; c.ph += c.sp; c.rot += c.vx * .02; c.life -= .0075;
      if (c.life <= 0 || c.y > vh + 40) { coins.splice(i, 1); continue; }
      var sx = Math.cos(c.ph);
      fctx.save(); fctx.globalAlpha = clamp(c.life * 2, 0, 1); fctx.translate(c.x, c.y); fctx.rotate(c.rot); fctx.scale(sx, 1);
      var g = fctx.createRadialGradient(-c.r * .3, -c.r * .3, 1, 0, 0, c.r);
      g.addColorStop(0, '#fff4d6'); g.addColorStop(.55, '#e2c88f'); g.addColorStop(1, '#8f7238');
      fctx.fillStyle = g; fctx.beginPath(); fctx.arc(0, 0, c.r, 0, 6.2832); fctx.fill();
      if (c.e && Math.abs(sx) > .3) { fctx.fillStyle = '#5a4015'; fctx.font = '700 ' + (c.r * 1.25 | 0) + 'px Georgia,serif'; fctx.textAlign = 'center'; fctx.textBaseline = 'middle'; fctx.fillText('€', 0, 1); }
      fctx.restore();
    }
  }

  /* ── The Climb ───────────────────────────────────── */
  function updateClimb() {
    if (!climbEl || reduced) return;
    var r = climbEl.getBoundingClientRect(), span = r.height - vh;
    cp = clamp(-r.top / Math.max(1, span), 0, 1);
    var k = cp * 12, val = Math.pow(10, k);
    cNum.textContent = fmt(cp >= .999 ? 1e12 : val);
    climbEl.style.setProperty('--k', cp.toFixed(3));
    climbEl.style.setProperty('--p', cp.toFixed(4));
    var lit = Math.floor(k + 1e-6); lit = cp >= .999 ? 12 : lit;
    for (var i = 0; i < 12; i++) zeroEls[i].classList.toggle('on', i < lit);
    var idx = k < 3 ? 0 : k < 6 ? 1 : k < 9 ? 2 : k < 11.85 ? 3 : 4;
    if (idx !== capNow) { capNow = idx; capEls.forEach(function (p, j) { p.classList.toggle('on', j === idx); }); }
    climbEl.classList.toggle('deep', cp > .03);
    if (cp >= .995 && !jackpot) { jackpot = true; rain(); }
    if (cp < .9) jackpot = false;
  }

  /* ── marquees ────────────────────────────────────── */
  var mqs = $$('.mq').map(function (m, i) {
    var tr = $('.mq-track', m); if (!tr) return null;
    var w0 = tr.scrollWidth || 1, reps = Math.ceil((vw * 2.4) / w0) + 1;
    var html = tr.innerHTML; for (var j = 0; j < reps; j++) tr.insertAdjacentHTML('beforeend', html);
    return { tr: tr, w0: w0, x: 0, dir: i % 2 ? 1 : -1 };
  }).filter(Boolean);

  /* ── magnetic buttons + cursor + spotlight ───────── */
  var mags = fine && !reduced ? $$('main .btn, .nav .btn').map(function (b) { b.classList.add('mag'); return { el: b, x: 0, y: 0, tx: 0, ty: 0 }; }) : [];
  var cur = null, dot = null, cx = -100, cy = -100, dx = -100, dy = -100;
  if (fine && !reduced) {
    cur = document.createElement('div'); cur.className = 'cur'; dot = document.createElement('div'); dot.className = 'cur-dot';
    cur.setAttribute('aria-hidden', 'true'); dot.setAttribute('aria-hidden', 'true');
    document.body.appendChild(cur); document.body.appendChild(dot);
    window.addEventListener('pointermove', function (e) {
      root.classList.add('cur-on'); dx = e.clientX; dy = e.clientY;
      cur.classList.toggle('big', !!(e.target.closest && e.target.closest('a,button,.entry,input,select,textarea,summary')));
    }, { passive: true });
    document.addEventListener('mouseleave', function () { root.classList.remove('cur-on'); });
  }
  document.addEventListener('pointermove', function (e) {
    var t = e.target.closest && e.target.closest('.entry,.price-box');
    if (t) { var b = t.getBoundingClientRect(); t.style.setProperty('--mx', (e.clientX - b.left) + 'px'); t.style.setProperty('--my', (e.clientY - b.top) + 'px'); }
  }, { passive: true });

  /* ── live stats: count up when home.js fills them ─ */
  function countTo(el, target) {
    var t0 = performance.now(), D = 1600;
    (function step(now) {
      var p = clamp((now - t0) / D, 0, 1), e = p === 1 ? 1 : 1 - Math.pow(2, -10 * p);
      el.textContent = Math.round(target * e).toLocaleString('en-IE');
      if (p < 1) requestAnimationFrame(step);
    })(t0);
  }
  var statsEl = $('#stats');
  if (statsEl && 'MutationObserver' in window && !reduced) {
    new MutationObserver(function () {
      $$('.v.num', statsEl).forEach(function (el) {
        if (el._w || !/^\d[\d,\s.]*$/.test(el.textContent.trim())) return;
        el._w = true; var target = parseInt(el.textContent.replace(/[^\d]/g, ''), 10);
        if (target > 0) countTo(el, target);
      });
    }).observe(statsEl, { childList: true, subtree: true });
  }

  /* ── main loop ───────────────────────────────────── */
  var t0 = performance.now(), last = t0, vis = true, T = 7;
  document.addEventListener('visibilitychange', function () { vis = !document.hidden; last = performance.now(); });
  function draw() {
    if (!gl) return;
    var cr = climbEl ? climbEl.getBoundingClientRect() : null, dim;
    var heroDim = lerp(.95, .5, sm(0, vh * .8, sy));
    if (cr && !reduced) {
      var a = sm(vh, 0, cr.top), l = 1 - clamp(cr.bottom / vh, 0, 1);
      dim = lerp(heroDim, .6 + .4 * cp, a);
      dim = lerp(dim, .3, l);
    } else dim = lerp(heroDim, .3, sm(vh * .6, vh * 1.8, sy));
    uK = lerp(uK, cr && !reduced ? cp * a0(cr) : 0, .08);
    gl.uniform2f(U.uRes, cv.width, cv.height);
    gl.uniform1f(U.uT, T);
    gl.uniform2f(U.uM, mx * scale, (vh - my) * scale);
    var age = clamp(performance.now() / 1000 - click.t, 0, 3);
    gl.uniform3f(U.uC, click.x * scale, (vh - click.y) * scale, age);
    gl.uniform1f(U.uK, uK);
    gl.uniform1f(U.uDim, dim);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }
  function a0(cr) { return cr.top < vh && cr.bottom > 0 ? 1 : 0; }
  function frame(now) {
    requestAnimationFrame(frame);
    if (!vis) return;
    var dt = Math.min(.05, (now - last) / 1000); last = now; T += dt;
    vel = lerp(vel, (sy - lastSy) / Math.max(dt, .001), .12); lastSy = sy;
    mx = lerp(mx, tmx, .09); my = lerp(my, tmy, .09);
    nx = (mx / vw - .5); ny = (my / vh - .5); rx = lerp(rx, ny, .06); ry = lerp(ry, nx, .06);
    if (heroH1 && sy < vh * 1.1) { heroH1.style.setProperty('--rx', (-rx * 7).toFixed(2) + 'deg'); heroH1.style.setProperty('--ry', (ry * 9).toFixed(2) + 'deg'); }
    if (bar) bar.style.transform = 'scaleX(' + clamp(sy / Math.max(1, document.documentElement.scrollHeight - vh), 0, 1).toFixed(4) + ')';
    updateClimb();
    mqs.forEach(function (m) {
      m.x += m.dir * (50 + Math.abs(vel) * .45) * dt;
      if (m.x <= -m.w0) m.x += m.w0; if (m.x >= 0) m.x -= m.w0;
      m.tr.style.transform = 'translate3d(' + m.x.toFixed(1) + 'px,0,0)';
    });
    mags.forEach(function (m) {
      var b = m.el.getBoundingClientRect(), ex = tmx - (b.left + b.width / 2), ey = tmy - (b.top + b.height / 2);
      var near = Math.hypot(ex, ey) < Math.max(b.width, 130) * .75;
      m.tx = near ? ex * .28 : 0; m.ty = near ? ey * .38 : 0;
      m.x = lerp(m.x, m.tx, .16); m.y = lerp(m.y, m.ty, .16);
      if (Math.abs(m.x) > .05 || Math.abs(m.y) > .05 || m.tx || m.ty) m.el.style.transform = 'translate(' + m.x.toFixed(1) + 'px,' + m.y.toFixed(1) + 'px)';
    });
    if (cur) {
      cx = lerp(cx, dx, .18); cy = lerp(cy, dy, .18);
      cur.style.transform = 'translate3d(' + cx.toFixed(1) + 'px,' + cy.toFixed(1) + 'px,0)';
      dot.style.transform = 'translate3d(' + dx + 'px,' + dy + 'px,0)';
    }
    draw(); drawFx();
  }
  if (reduced) { draw(); }
  else requestAnimationFrame(frame);
})();
