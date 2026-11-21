/* Hero globe + starfield. Canvas 2D, no dependencies (a dotted orthographic globe needs nothing more than that —
   WebGL would add weight, not beauty). Pauses offscreen / in background tabs; one still frame under reduced motion.
   Gold nodes and bright arcs are countries with REAL registered contributors (MVGlobe.setNodes); the dim arcs
   between world hubs are decorative and the page says so. */
(function () {
  'use strict';
  var RAD = Math.PI / 180;
  var HUBS = { dub: [53.3, -6.3], lon: [51.5, -0.1], nyc: [40.7, -74], sao: [-23.5, -46.6], los: [6.5, 3.4], nbo: [-1.3, 36.8], cai: [30, 31.2],
    bom: [19, 72.8], sin: [1.35, 103.8], tyo: [35.7, 139.7], syd: [-33.9, 151.2], sfo: [37.8, -122.4], mex: [19.4, -99.1], ber: [52.5, 13.4], ist: [41, 29] };
  var LINKS = [['dub', 'nyc'], ['lon', 'bom'], ['nyc', 'sfo'], ['sfo', 'tyo'], ['tyo', 'syd'], ['syd', 'sin'], ['sin', 'bom'], ['bom', 'nbo'], ['nbo', 'los'],
    ['los', 'sao'], ['sao', 'nyc'], ['ber', 'ist'], ['ist', 'cai'], ['cai', 'nbo'], ['mex', 'nyc'], ['lon', 'los'], ['dub', 'ber'], ['sfo', 'mex']];

  function vec(lat, lng) { var p = lat * RAD, l = lng * RAD, c = Math.cos(p); return [c * Math.sin(l), Math.sin(p), c * Math.cos(l)]; }
  function slerp(a, b, t) {
    var dot = Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])), om = Math.acos(dot), s = Math.sin(om) || 1;
    var k1 = Math.sin((1 - t) * om) / s, k2 = Math.sin(t * om) / s;
    return [a[0] * k1 + b[0] * k2, a[1] * k1 + b[1] * k2, a[2] * k1 + b[2] * k2];
  }
  function arcPoints(a, b, n) {
    var out = [], om = Math.acos(Math.max(-1, Math.min(1, a[0] * b[0] + a[1] * b[1] + a[2] * b[2])));
    for (var i = 0; i <= n; i++) { var t = i / n, p = slerp(a, b, t), h = 1 + Math.sin(Math.PI * t) * 0.22 * Math.min(om / 1.6, 1); out.push([p[0] * h, p[1] * h, p[2] * h]); }
    return out;
  }

  function mount(canvas, opts) {
    opts = opts || {};
    var ctx = canvas.getContext('2d'), dots = null, W = 0, H = 0, R = 0, dpr = 1, rot = -0.6 * 0 + 0.2, tilt = 0.38, vel = 0.0016, raf = 0, running = false, drag = null, nodes = [], t0 = performance.now();
    var arcs = LINKS.map(function (l, i) { return { pts: arcPoints(vec.apply(0, HUBS[l[0]]), vec.apply(0, HUBS[l[1]]), 48), off: i * 0.173, real: false }; });
    var realArcs = [];

    function resize() {
      var r = canvas.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2);
      W = Math.max(1, r.width); H = Math.max(1, r.height); canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr); R = Math.min(W, H) * 0.4;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); if (!running) draw(performance.now());
    }
    function project(v) {                                   // rotate around Y (spin) then X (tilt); orthographic
      var cy = Math.cos(rot), sy = Math.sin(rot), x = v[0] * cy + v[2] * sy, z = -v[0] * sy + v[2] * cy, y = v[1];
      var ct = Math.cos(tilt), st = Math.sin(tilt), y2 = y * ct - z * st, z2 = y * st + z * ct;
      return [W / 2 + x * R, H / 2 - y2 * R, z2];
    }
    function setNodes(list) {
      nodes = (list || []).filter(function (n) { return n.lat != null && n.n > 0; }).map(function (n) { return { v: vec(n.lat, n.lng), n: n.n, name: n.name }; });
      realArcs = [];
      var top = nodes.slice().sort(function (a, b) { return b.n - a.n; }).slice(0, 18);
      for (var i = 0; i < top.length; i++) for (var j = i + 1; j < top.length && j < i + 4; j++) realArcs.push({ pts: arcPoints(top[i].v, top[j].v, 48), off: (i * 7 + j) * 0.11, real: true });
    }
    function drawArc(a, now, real) {
      var p = a.pts, head = ((now / (real ? 5200 : 7600)) + a.off) % 1.4, n = p.length - 1, trail = real ? 0.34 : 0.26;
      var prev = null;
      for (var i = 0; i <= n; i++) {
        var q = project(p[i]); var s = i / n;
        if (prev && q[2] > -0.05 && prev[2] > -0.05) {
          var d = head - s, glow = d >= 0 && d < trail ? 1 - d / trail : 0;
          var base = real ? 0.28 : 0.09;
          ctx.strokeStyle = real ? 'rgba(243,216,148,' + (base + glow * 0.75) + ')' : 'rgba(108,195,255,' + (base + glow * 0.8) + ')';
          ctx.lineWidth = real ? 1.3 + glow * 1.4 : 0.8 + glow * 1.2;
          ctx.beginPath(); ctx.moveTo(prev[0], prev[1]); ctx.lineTo(q[0], q[1]); ctx.stroke();
        }
        prev = q;
      }
    }
    function draw(now) {
      ctx.clearRect(0, 0, W, H);
      var cx = W / 2, cy = H / 2;
      var g = ctx.createRadialGradient(cx, cy, R * 0.92, cx, cy, R * 1.24);
      g.addColorStop(0, 'rgba(59,140,255,.30)'); g.addColorStop(.5, 'rgba(59,140,255,.08)'); g.addColorStop(1, 'rgba(59,140,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      var b = ctx.createRadialGradient(cx - R * .35, cy - R * .4, R * .1, cx, cy, R);
      b.addColorStop(0, '#102a63'); b.addColorStop(.7, '#07142f'); b.addColorStop(1, '#030a1d');
      ctx.fillStyle = b; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(108,195,255,.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.stroke();
      if (dots) {                                           // land
        var ct = Math.cos(tilt), st = Math.sin(tilt), cr = Math.cos(rot), sr = Math.sin(rot), sz = Math.max(1.8, R / 140);
        for (var i = 0; i < dots.length; i += 3) {
          var x0 = dots[i], y0 = dots[i + 1], z0 = dots[i + 2];
          var x = x0 * cr + z0 * sr, z = -x0 * sr + z0 * cr, y2 = y0 * ct - z * st, z2 = y0 * st + z * ct;
          if (z2 < 0) continue;
          ctx.fillStyle = 'rgba(' + (120 + 90 * z2 | 0) + ',' + (170 + 60 * z2 | 0) + ',255,' + (0.3 + 0.7 * z2).toFixed(2) + ')';
          ctx.fillRect(cx + x * R - sz / 2, cy - y2 * R - sz / 2, sz, sz);
        }
      }
      ctx.lineCap = 'round';
      for (var k = 0; k < arcs.length; k++) drawArc(arcs[k], now, false);
      for (k = 0; k < realArcs.length; k++) drawArc(realArcs[k], now, true);
      for (k = 0; k < nodes.length; k++) {                  // real contributor countries
        var p = project(nodes[k].v); if (p[2] < 0) continue;
        var pulse = (Math.sin(now / 600 + k) + 1) / 2, r = 2.6 + Math.min(Math.log10(nodes[k].n + 1) * 2.2, 6);
        var gg = ctx.createRadialGradient(p[0], p[1], 0, p[0], p[1], r * 5); gg.addColorStop(0, 'rgba(243,216,148,' + (0.55 + pulse * 0.25) + ')'); gg.addColorStop(1, 'rgba(243,216,148,0)');
        ctx.fillStyle = gg; ctx.beginPath(); ctx.arc(p[0], p[1], r * 5, 0, 7); ctx.fill();
        ctx.fillStyle = '#fff3cf'; ctx.beginPath(); ctx.arc(p[0], p[1], r, 0, 7); ctx.fill();
      }
      var l = ctx.createRadialGradient(cx, cy, R * .55, cx, cy, R);  // limb darkening
      l.addColorStop(0, 'rgba(0,0,0,0)'); l.addColorStop(1, 'rgba(2,6,20,.55)');
      ctx.fillStyle = l; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 7); ctx.fill();
    }
    function frame(now) {
      if (!running) return;
      if (!drag) { rot += vel; if (Math.abs(vel) > 0.0016) vel += (0.0016 - vel) * 0.04; }
      draw(now); raf = requestAnimationFrame(frame);
    }
    function start() { if (running || opts.still) return; running = true; raf = requestAnimationFrame(frame); }
    function stop() { running = false; cancelAnimationFrame(raf); }

    canvas.style.touchAction = 'pan-y'; canvas.style.cursor = 'grab';
    canvas.addEventListener('pointerdown', function (e) { drag = { x: e.clientX, rot: rot, t: performance.now(), lx: e.clientX }; canvas.setPointerCapture(e.pointerId); canvas.style.cursor = 'grabbing'; });
    canvas.addEventListener('pointermove', function (e) { if (!drag) return; var dx = e.clientX - drag.x; rot = drag.rot + dx / R * 0.9; vel = (e.clientX - drag.lx) / R * 0.9 / Math.max(1, performance.now() - drag.t) * 16; drag.lx = e.clientX; drag.t = performance.now(); if (!running) draw(performance.now()); });
    function up() { drag = null; canvas.style.cursor = 'grab'; }
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);

    fetch('/assets/mv/land.json').then(function (r) { return r.json(); }).then(function (m) {
      var bin = atob(m.land), out = [];
      for (var i = 0; i < m.lw * m.lh; i++) if (bin.charCodeAt(i >> 3) & (1 << (i & 7))) {
        var r = (i / m.lw) | 0, c = i % m.lw, v = vec(90 - (r + 0.5) * 1.5, -180 + (c + 0.5) * 1.5); out.push(v[0], v[1], v[2]);
      }
      dots = new Float32Array(out); draw(performance.now());
    }).catch(function () {});

    new ResizeObserver(resize).observe(canvas); resize();
    var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) opts.still = true;
    if ('IntersectionObserver' in window) new IntersectionObserver(function (es) { if (es[0].isIntersecting && !document.hidden) start(); else stop(); }).observe(canvas); else start();
    document.addEventListener('visibilitychange', function () { if (document.hidden) stop(); else if (canvas.getBoundingClientRect().bottom > 0) start(); });
    return { setNodes: function (l) { setNodes(l); if (!running) draw(performance.now()); } };
  }

  function stars(canvas) {
    var ctx = canvas.getContext('2d'), W = 0, H = 0, dpr = 1, pts = [], raf = 0, running = false, mx = 0, my = 0;
    function resize() {
      var r = canvas.getBoundingClientRect(); dpr = Math.min(window.devicePixelRatio || 1, 2); W = r.width; H = r.height;
      canvas.width = W * dpr; canvas.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      var n = Math.round(Math.min(160, W * H / 9000)); pts = [];
      for (var i = 0; i < n; i++) pts.push({ x: Math.random() * W, y: Math.random() * H, z: Math.random() * 0.8 + 0.2, tw: Math.random() * 6 });
      draw(0);
    }
    function draw(t) {
      ctx.clearRect(0, 0, W, H);
      for (var i = 0; i < pts.length; i++) {
        var p = pts[i], a = 0.25 + 0.55 * ((Math.sin(t / 1400 + p.tw) + 1) / 2) * p.z;
        var x = (p.x + mx * 14 * p.z + W) % W, y = (p.y - t * 0.004 * p.z + my * 10 * p.z + H * 4) % H;
        ctx.fillStyle = (i % 9 === 0 ? 'rgba(243,216,148,' : 'rgba(190,215,255,') + a.toFixed(2) + ')';
        ctx.fillRect(x, y, p.z * 1.7, p.z * 1.7);
      }
    }
    function frame(t) { if (!running) return; draw(t); raf = requestAnimationFrame(frame); }
    addEventListener('pointermove', function (e) { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; }, { passive: true });
    new ResizeObserver(resize).observe(canvas); resize();
    var reduced = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!reduced && 'IntersectionObserver' in window) new IntersectionObserver(function (es) { running = es[0].isIntersecting && !document.hidden; cancelAnimationFrame(raf); if (running) raf = requestAnimationFrame(frame); }).observe(canvas);
  }

  window.MVGlobe = { mount: mount, stars: stars, vec: vec, project: null };
})();
