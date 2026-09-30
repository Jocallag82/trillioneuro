/* RipeStream hero — "the stream" flow field. A river of light that runs
   through the hero, carrying the post cards. Canvas 2D, no library.

   Runs in a Web Worker on an OffscreenCanvas where the browser supports it,
   so the drawing never competes with scrolling on the main thread. The same
   file is loaded as a plain script as the fallback (window.RSFlow). */
(function (root) {
  'use strict';

  function createFlow(cv, o) {
    var ctx = cv.getContext('2d');
    var small = o.small, reduced = o.reduced, DPR = o.dpr;
    var W = 0, H = 0, band = 0, spread = 0, t = 0, running = false, raf = 0, last = 0, acc = 0;
    var mouse = { x: -9999, y: -9999 };
    // Colour groups: one path + one stroke per group per frame (cheap).
    var GROUPS = [
      ['255,91,31', .55, 1.3], ['255,91,31', .32, 2.6], ['255,120,60', .45, 1],
      ['255,179,138', .38, 1], ['200,245,90', .5, 1.1], ['243,238,230', .28, .8]
    ];
    var WEIGHTS = [0, 0, 0, 0, 1, 2, 2, 3, 3, 4, 5];
    var N = small ? 320 : 640, P = [];
    var raf_ = root.requestAnimationFrame ? root.requestAnimationFrame.bind(root) : function (f) { return setTimeout(function () { f(performance.now()); }, 16); };
    var caf_ = root.cancelAnimationFrame ? root.cancelAnimationFrame.bind(root) : clearTimeout;

    function size(s) {
      W = s.w; H = s.h;
      cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      // The river enters bottom-left under the post cards and sweeps up to the right.
      band = s.band || H * 0.72;
      spread = Math.max(80, H * (small ? 0.13 : 0.15));
    }
    function centreAt(x) { return band - (x / W) * H * (small ? 0.22 : 0.42) + Math.sin(x * 0.0042 + t * 0.012) * spread * 0.45; }
    function spawn(p, anywhere) {
      p.x = anywhere ? Math.random() * W : -20 - Math.random() * 120;
      var g = (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;   // ~gaussian
      p.y = centreAt(p.x) + g * spread * (0.6 + Math.random() * 0.8);
      p.v = 1 + Math.random() * 2.2;
      p.g = WEIGHTS[(Math.random() * WEIGHTS.length) | 0];
      p.o = Math.random() * 6.28;
      return p;
    }
    function step() {
      t += 1;
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = 'rgba(0,0,0,0.06)';
      ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      ctx.lineCap = 'round';
      var paths = GROUPS.map(function () { return []; });
      for (var i = 0; i < N; i++) {
        var p = P[i], x0 = p.x, y0 = p.y;
        var c = centreAt(p.x), slope = (centreAt(p.x + 30) - c) / 30;
        var ang = Math.atan(slope) + Math.sin(p.x * 0.006 + p.o + t * 0.01) * 0.22;
        var vx = Math.cos(ang) * p.v * 1.7, vy = Math.sin(ang) * p.v * 1.7 + (c - p.y) * 0.0035;
        var dx = p.x - mouse.x, dy = p.y - mouse.y, d2 = dx * dx + dy * dy;
        if (d2 < 26000) { var f = (26000 - d2) / 26000; vx += dx * f * 0.03; vy += dy * f * 0.06; }
        p.x += vx; p.y += vy;
        paths[p.g].push(x0, y0, p.x, p.y);
        if (p.x > W + 20 || p.y < -60 || p.y > H + 60) spawn(p, false);
      }
      for (var g = 0; g < GROUPS.length; g++) {
        var seg = paths[g]; if (!seg.length) continue;
        ctx.strokeStyle = 'rgba(' + GROUPS[g][0] + ',' + GROUPS[g][1] + ')';
        ctx.lineWidth = GROUPS[g][2];
        ctx.beginPath();
        for (var j = 0; j < seg.length; j += 4) { ctx.moveTo(seg[j], seg[j + 1]); ctx.lineTo(seg[j + 2], seg[j + 3]); }
        ctx.stroke();
      }
    }
    // Fixed 60 steps/s whatever the display rate: 120/144 Hz laptop panels
    // otherwise run the field faster and pay for twice the frames.
    var STEP = 1000 / 60;
    function loop(ts) {
      raf = raf_(loop);
      acc = Math.min(acc + (last ? ts - last : STEP), STEP * 3); last = ts;
      if (acc < STEP - 1) return;
      acc = Math.max(0, acc - STEP);
      step();
    }
    function still() { for (var k = 0; k < 140; k++) step(); }

    size(o);
    for (var i = 0; i < N; i++) P.push(spawn({}, true));
    if (reduced) still();

    return {
      resize: function (s) {
        var oldW = W; size(s);
        if (Math.abs(oldW - W) > 40) P.forEach(function (p) { spawn(p, true); });
        if (reduced) still();
      },
      mouse: function (x, y) { mouse.x = x; mouse.y = y; },
      run: function (on) {
        if (on && !running && !reduced) { running = true; last = 0; acc = 0; raf = raf_(loop); }
        else if (!on && running) { running = false; caf_(raf); }
      }
    };
  }

  if (typeof WorkerGlobalScope !== 'undefined' && root instanceof WorkerGlobalScope) {
    var flow = null;
    root.onmessage = function (e) {
      var m = e.data;
      if (m.type === 'init') flow = createFlow(m.canvas, m);
      else if (!flow) return;
      else if (m.type === 'resize') flow.resize(m);
      else if (m.type === 'mouse') flow.mouse(m.x, m.y);
      else if (m.type === 'run') flow.run(m.on);
    };
  } else {
    root.RSFlow = createFlow;
  }
})(self);
