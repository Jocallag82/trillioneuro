// Red Teddy Tutor: the motion layer. Pure decoration; nothing here stores or sends anything.
// Runs only when the visitor has not asked for reduced motion (html.wow is set in <head>).
const root = document.documentElement;
if (root.classList.contains('wow')) boot();

function boot() {
  const $ = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];
  const fine = matchMedia('(hover:hover) and (pointer:fine)').matches;
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
  const lerp = (a, b, t) => a + (b - a) * t;

  const hero = $('.hx');
  const st = { px: innerWidth / 2, py: innerHeight / 2, mx: 0, my: 0, sx: 0, sy: 0, moved: 0, vel: 0, lastY: scrollY, down: false };

  /* ---------- 1. split text into masked words ---------- */
  const splitInto = (node, counter) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        for (const part of child.textContent.split(/(\s+)/)) {
          if (!part) continue;
          if (/^\s+$/.test(part)) { frag.append(part); continue; }
          const w = document.createElement('span'); w.className = 'w';
          const i = document.createElement('span'); i.textContent = part; i.style.setProperty('--i', counter.n++);
          w.append(i); frag.append(w);
        }
        child.replaceWith(frag);
      } else if (child.nodeType === 1) {
        if (child.id || child.hasAttribute('data-obj-count')) {
          // keep live nodes (the skill count is written by home.js) intact: wrap, don't clone
          const w = document.createElement('span'); w.className = 'w';
          const i = document.createElement('span'); i.style.setProperty('--i', counter.n++);
          child.replaceWith(w); w.append(i); i.append(child);
        } else splitInto(child, counter);
      }
    }
  };
  const heads = $$('main h1, main h2');
  heads.forEach((h) => splitInto(h, { n: 0 }));
  if (hero) requestAnimationFrame(() => requestAnimationFrame(() => hero.classList.add('ready')));

  /* ---------- 2. reveal choreography ---------- */
  const tag = (sel, kind, opts = {}) => $$(sel).forEach((el, idx) => {
    if (el.closest('.hx')) return;
    el.setAttribute('data-wow', kind);
    el.style.setProperty('--i', opts.stagger === false ? 0 : String(idx % (opts.mod || 4)));
    if (opts.rot) el.style.setProperty('--rot', idx % 2 ? '-3deg' : '3deg');
  });
  tag('.path-card', 'flip', { rot: true, mod: 3 });
  tag('.pz-games li', 'pop');
  tag('.age-pick li', 'rise', { mod: 5 });
  tag('.journey li', 'rise');
  tag('.subject', 'pop', { mod: 3 });
  tag('.plan', 'flip', { rot: true, mod: 2 });
  tag('.safety-list li', 'rise', { mod: 3 });
  tag('.evidence > div', 'rise');
  tag('.bakery-signs li', 'left', { mod: 5 });
  tag('.try-notes li', 'rise');
  tag('.faq-list details', 'fade', { mod: 3 });
  tag('.helper-grid > div', 'right', { stagger: false });
  tag('.helper-mark', 'left', { stagger: false });
  tag('.hero-facts li', 'fade');
  tag('.chooser', 'rise', { stagger: false });
  tag('.news-grid > *', 'rise', { mod: 2 });
  tag('.book', 'right', { stagger: false });
  tag('.sec-head > p, .sec-head > .eyebrow', 'fade', { stagger: false });
  $$('.pz-games li.reveal').forEach((el) => el.classList.add('in')); // paths.js reveal is replaced by ours

  const sections = new Set();
  const io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target;
      el.classList.add('in');
      if (el.matches('h1,h2')) el.classList.add('split-in');
      if (el.matches('.sec-head')) { el.classList.add('in-h'); const h = $('h2', el); if (h) h.classList.add('split-in'); }
      if (el.matches('.num')) countUp(el);
      if (el.matches('.mega')) el.classList.add('in');
      io.unobserve(el);
    }
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.12 });
  $$('[data-wow], main h2, .sec-head, .num, .mega').forEach((el) => io.observe(el));

  /* ---------- 3. count-up numbers ---------- */
  function countUp(card) {
    const out = $('[data-count]', card); if (!out || out.dataset.done) return;
    out.dataset.done = '1';
    const to = Number(out.dataset.count); const t0 = performance.now(); const dur = 1700;
    const step = (t) => {
      const k = clamp((t - t0) / dur, 0, 1); const e = 1 - Math.pow(1 - k, 4);
      out.textContent = String(Math.round(to * e));
      if (k < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }

  /* ---------- 4. marquee: scroll speed pushes it ---------- */
  const rows = $$('.mq').map((el) => ({ el, dir: el.dataset.dir === 'r' ? 1 : -1, speed: Number(el.dataset.speed || 60), x: 0, half: 0 }));
  const measure = () => rows.forEach((r) => { r.half = r.el.scrollWidth / 2; if (r.dir > 0 && !r.x) r.x = -r.half; });
  measure(); addEventListener('resize', measure); document.fonts && document.fonts.ready.then(measure);

  /* ---------- 5. closing wordmark ---------- */
  const mega = $('.mega p[data-text]');
  if (mega) {
    mega.setAttribute('aria-hidden', 'true');
    mega.textContent = '';
    [...mega.dataset.text].forEach((c, i) => {
      const s = document.createElement('span'); s.className = 'ch'; s.style.setProperty('--i', i);
      s.textContent = c === ' ' ? ' ' : c; mega.append(s);
    });
  }

  /* ---------- 6. tilt + glare, magnetic buttons ---------- */
  if (fine) {
    $$('.path-card, .plan, .subject, .age-pick a, .book').forEach((card) => {
      if (card.matches('.book')) return;
      card.classList.add('tilt');
      const max = card.matches('.path-card') ? 9 : 6;
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect(); const x = (e.clientX - r.left) / r.width; const y = (e.clientY - r.top) / r.height;
        card.style.transition = 'transform .08s linear, box-shadow .3s';
        card.style.transform = `perspective(900px) rotateX(${(0.5 - y) * max}deg) rotateY(${(x - 0.5) * max * 1.3}deg) translateZ(0)`;
        card.style.setProperty('--gx', `${x * 100}%`); card.style.setProperty('--gy', `${y * 100}%`);
      });
      card.addEventListener('pointerleave', () => { card.style.transition = 'transform .7s cubic-bezier(.16,1,.3,1), box-shadow .3s'; card.style.transform = ''; });
    });
    $$('.hx-ctas .btn, .news .btn, .plan .btn-red, .nav-play, nav .btn').forEach((b) => {
      b.addEventListener('pointermove', (e) => {
        const r = b.getBoundingClientRect();
        b.style.translate = `${(e.clientX - (r.left + r.width / 2)) * 0.25}px ${(e.clientY - (r.top + r.height / 2)) * 0.35}px`;
      });
      b.addEventListener('pointerleave', () => { b.style.translate = ''; });
    });
  }

  /* ---------- 7. spark canvas: cursor trail + click bursts ---------- */
  const spark = document.createElement('canvas'); spark.className = 'wow-spark'; spark.setAttribute('aria-hidden', 'true');
  document.body.append(spark);
  const sctx = spark.getContext('2d'); let sw = 0, sh = 0; const sdpr = Math.min(devicePixelRatio || 1, 2);
  const sizeSpark = () => { sw = innerWidth; sh = innerHeight; spark.width = sw * sdpr; spark.height = sh * sdpr; sctx.setTransform(sdpr, 0, 0, sdpr, 0, 0); };
  sizeSpark(); addEventListener('resize', sizeSpark);
  const sparks = []; let sparkRunning = false;
  const COLORS = ['#fff2c9', '#f3d79c', '#ffd166', '#ff8a8f', '#ffffff'];
  const addSpark = (x, y, opts = {}) => {
    const a = opts.a ?? Math.random() * Math.PI * 2; const sp = opts.sp ?? (0.4 + Math.random() * 1.4);
    sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (opts.lift ?? 0.3), life: 0, max: opts.max ?? 700 + Math.random() * 500, r: opts.r ?? 1.5 + Math.random() * 3, c: COLORS[(Math.random() * COLORS.length) | 0], star: opts.star ?? Math.random() < 0.55, rot: Math.random() * 6 });
    if (!sparkRunning) { sparkRunning = true; last = performance.now(); requestAnimationFrame(sparkTick); }
  };
  let last = 0;
  const starPath = (c, r) => { c.beginPath(); for (let i = 0; i < 8; i++) { const rr = i % 2 ? r * 0.4 : r; const a = (i * Math.PI) / 4; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); };
  function sparkTick(t) {
    const dt = Math.min(48, t - last); last = t;
    sctx.clearRect(0, 0, sw, sh); sctx.globalCompositeOperation = 'lighter';
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i]; p.life += dt; if (p.life > p.max) { sparks.splice(i, 1); continue; }
      const k = p.life / p.max; p.x += p.vx * dt * 0.06; p.y += p.vy * dt * 0.06; p.vy += dt * 0.0009; p.rot += dt * 0.004;
      sctx.globalAlpha = (1 - k) * 0.95; sctx.fillStyle = p.c; sctx.shadowColor = p.c; sctx.shadowBlur = 10;
      if (p.star) { sctx.save(); sctx.translate(p.x, p.y); sctx.rotate(p.rot); starPath(sctx, p.r * (1.6 - k * 0.8) * 1.6); sctx.fill(); sctx.restore(); }
      else { sctx.beginPath(); sctx.arc(p.x, p.y, p.r * (1 - k * 0.6), 0, 6.283); sctx.fill(); }
    }
    sctx.globalAlpha = 1; sctx.shadowBlur = 0;
    if (sparks.length) requestAnimationFrame(sparkTick); else { sparkRunning = false; sctx.clearRect(0, 0, sw, sh); }
  }
  const burst = (x, y, n = 26) => { for (let i = 0; i < n; i++) addSpark(x, y, { sp: 1.5 + Math.random() * 3.6, max: 800 + Math.random() * 700, lift: 0.8, star: Math.random() < 0.7 }); };
  addEventListener('pointerdown', (e) => { burst(e.clientX, e.clientY, e.target.closest('a,button') ? 14 : 28); st.down = true; orb && orb.classList.add('down'); });
  addEventListener('pointerup', () => { st.down = false; orb && orb.classList.remove('down'); });

  /* ---------- 8. cursor orb ---------- */
  let orb = null; let ox = st.px, oy = st.py; let trailT = 0;
  if (fine) { orb = $('.wow-orb'); }
  addEventListener('pointermove', (e) => {
    st.px = e.clientX; st.py = e.clientY; st.moved = performance.now();
    st.mx = (e.clientX / innerWidth) * 2 - 1; st.my = (e.clientY / innerHeight) * 2 - 1;
    if (orb) { orb.classList.add('on'); orb.classList.toggle('big', !!e.target.closest('a,button,summary,label,input,.tilt')); }
    if (fine && e.pointerType === 'mouse' && performance.now() - trailT > 38) { trailT = performance.now(); addSpark(e.clientX, e.clientY, { sp: 0.5, max: 600, r: 1.2 + Math.random() * 2, lift: 0.1 }); }
  }, { passive: true });
  document.addEventListener('pointerleave', () => orb && orb.classList.remove('on'));

  /* ---------- 9. hero particle theatre ---------- */
  const cv = $('.wow-fx'); let fxRunning = false; let heroVisible = true;
  if (cv && hero) {
    const ctx = cv.getContext('2d'); const dpr = Math.min(devicePixelRatio || 1, 2);
    let W = 0, H = 0; const parts = []; const GLYPHS = ['π', '∑', '√', '∞', '∫', 'Δ', 'A', 'B', 'C', '1', '2', '3', '+', '=', '%', '÷', 'x²', 'H₂O', 'Aa', '★'];
    const size = () => { const r = hero.getBoundingClientRect(); W = r.width; H = r.height; cv.width = W * dpr; cv.height = H * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); };
    size(); new ResizeObserver(size).observe(hero);
    const origin = () => {
      const cs = getComputedStyle(hero); const f = (v) => (v.trim().endsWith('%') ? parseFloat(v) / 100 : 0.5);
      return { x: f(cs.getPropertyValue('--ox')) * W, y: f(cs.getPropertyValue('--oy')) * H };
    };
    const spawn = (kind, at) => {
      const o = at || origin(); const a = -Math.PI / 2 + (Math.random() - 0.5) * 1.5;
      if (kind === 'glyph') parts.push({ k: 'g', x: o.x + (Math.random() - 0.5) * W * 0.12, y: o.y, vx: Math.cos(a) * 0.25, vy: -0.35 - Math.random() * 0.5, t: 0, max: 5200 + Math.random() * 3200, s: 18 + Math.random() * 30, ch: GLYPHS[(Math.random() * GLYPHS.length) | 0], ph: Math.random() * 6, rot: (Math.random() - 0.5) * 0.5 });
      else parts.push({ k: 'e', x: o.x + (Math.random() - 0.5) * W * 0.18, y: o.y + (Math.random() - 0.5) * 30, vx: (Math.random() - 0.5) * 0.18, vy: -0.25 - Math.random() * 0.55, t: 0, max: 3200 + Math.random() * 3600, s: 1 + Math.random() * 2.6, ph: Math.random() * 6 });
    };
    const dust = Array.from({ length: 70 }, () => ({ x: Math.random(), y: Math.random(), r: Math.random() * 1.4 + 0.3, ph: Math.random() * 6, z: Math.random() * 0.8 + 0.2 }));
    let acc = 0, accG = 0, lt = performance.now(); let lx = 0.66, ly = 0.48;
    const loop = (t) => {
      if (!heroVisible || document.hidden) { fxRunning = false; return; }
      const dt = Math.min(50, t - lt); lt = t; acc += dt; accG += dt;
      while (acc > 55 && parts.length < 140) { acc -= 55; spawn('e'); }
      while (accG > 520 && parts.length < 140) { accG -= 520; spawn('glyph'); }
      ctx.clearRect(0, 0, W, H); ctx.globalCompositeOperation = 'lighter';
      // twinkling dust, parallaxed against the cursor
      for (const d of dust) {
        const x = (d.x * W + st.sx * -30 * d.z + W) % W; const y = (d.y * H + st.sy * -20 * d.z + H) % H;
        ctx.globalAlpha = 0.25 + 0.5 * Math.abs(Math.sin(t * 0.001 * d.z + d.ph)); ctx.fillStyle = '#ffe9b8';
        ctx.beginPath(); ctx.arc(x, y, d.r, 0, 6.283); ctx.fill();
      }
      const hr = hero.getBoundingClientRect(); const px = st.px - hr.left; const py = st.py - hr.top;
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i]; p.t += dt; if (p.t > p.max) { parts.splice(i, 1); continue; }
        const k = p.t / p.max;
        const dx = p.x - px, dy = p.y - py, d2 = dx * dx + dy * dy;
        if (fine && d2 < 16000) { const f = (1 - d2 / 16000) * 0.9; const d = Math.sqrt(d2) || 1; p.vx += (dx / d) * f * 0.6; p.vy += (dy / d) * f * 0.6; }
        p.vx *= 0.985; p.x += (p.vx + Math.sin(t * 0.0012 + p.ph) * 0.18) * dt * 0.06 * 16; p.y += p.vy * dt * 0.06 * 16 * 0.5;
        const fade = Math.sin(Math.PI * Math.min(1, k * 1.05)); ctx.globalAlpha = Math.max(0, fade) * (p.k === 'g' ? 0.9 : 0.95);
        if (p.k === 'g') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot + Math.sin(t * 0.001 + p.ph) * 0.25); const sc = 0.6 + k * 0.7;
          ctx.font = `700 ${p.s * sc}px Fraunces, Georgia, serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.shadowColor = 'rgba(255,190,90,.95)'; ctx.shadowBlur = 18; ctx.fillStyle = '#ffe7a8'; ctx.fillText(p.ch, 0, 0); ctx.restore();
        } else {
          const g = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.s * 5); g.addColorStop(0, 'rgba(255,231,168,1)'); g.addColorStop(0.3, 'rgba(255,190,90,.5)'); g.addColorStop(1, 'rgba(255,160,60,0)');
          ctx.fillStyle = g; ctx.beginPath(); ctx.arc(p.x, p.y, p.s * 5, 0, 6.283); ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
      // the lamp follows the cursor; without one, it wanders on its own
      const idle = performance.now() - st.moved > 2500 || !fine;
      let tx, ty;
      if (idle) { tx = 0.6 + Math.sin(t * 0.00025) * 0.12; ty = 0.5 + Math.cos(t * 0.00031) * 0.14; } else { tx = clamp(px / W, 0, 1); ty = clamp(py / H, 0, 1); }
      lx = lerp(lx, tx, 0.06); ly = lerp(ly, ty, 0.06);
      hero.style.setProperty('--lx', `${(lx * 100).toFixed(1)}%`); hero.style.setProperty('--ly', `${(ly * 100).toFixed(1)}%`);
      requestAnimationFrame(loop);
    };
    const start = () => { if (!fxRunning && heroVisible && !document.hidden) { fxRunning = true; lt = performance.now(); requestAnimationFrame(loop); } };
    new IntersectionObserver(([e]) => { heroVisible = e.isIntersecting; if (heroVisible) start(); }).observe(hero);
    document.addEventListener('visibilitychange', start);
    start();
    // a click anywhere in the hero scene throws a fistful of glyphs and stars
    hero.addEventListener('pointerdown', (e) => {
      if (e.target.closest('a,button')) return;
      const r = hero.getBoundingClientRect(); const at = { x: e.clientX - r.left, y: e.clientY - r.top };
      for (let i = 0; i < 9; i++) { spawn('glyph', at); const p = parts[parts.length - 1]; const a = Math.random() * 6.283; p.vx = Math.cos(a) * 3; p.vy = Math.sin(a) * 2.2 - 1; p.max = 2600 + Math.random() * 1400; }
    });
  }

  /* ---------- 10. one shared frame loop: smoothing, parallax, progress, marquee ---------- */
  const progress = $('.wow-progress i'); const head = $('.site-head');
  const journey = $('.journey'); const journeyItems = $$('.journey li');
  const clouds = $$('.pz-cloud'); const helper = $('.helper-mark img');
  let prev = performance.now(); let headLast = scrollY;
  const frame = (now) => {
    const dt = Math.min(48, now - prev); prev = now;
    st.sx = lerp(st.sx, st.mx, 0.07); st.sy = lerp(st.sy, st.my, 0.07);
    if (hero) {
      hero.style.setProperty('--mx', st.sx.toFixed(3)); hero.style.setProperty('--my', st.sy.toFixed(3));
      const r = hero.getBoundingClientRect(); hero.style.setProperty('--hs', clamp(-r.top / Math.max(1, r.height), 0, 1).toFixed(3));
    }
    const y = scrollY; const v = y - st.lastY; st.lastY = y; st.vel = lerp(st.vel, v, 0.12);
    if (progress) progress.parentElement.style.setProperty('--p', (y / Math.max(1, document.documentElement.scrollHeight - innerHeight)).toFixed(4));
    if (head) { head.classList.toggle('scrolled', y > 40); head.classList.toggle('away', y > 320 && y > headLast + 2 && !document.querySelector('#nav.open')); if (y < headLast - 2 || y < 320) head.classList.remove('away'); headLast = y; }
    for (const r of rows) { r.x += (r.dir * (r.speed + Math.abs(st.vel) * 38) * dt) / 1000; if (r.half) { if (r.dir < 0 && r.x <= -r.half) r.x += r.half; if (r.dir > 0 && r.x >= 0) r.x -= r.half; } r.el.style.transform = `translate3d(${r.x.toFixed(1)}px,0,0) skewX(${clamp(-st.vel * 0.25, -7, 7).toFixed(2)}deg)`; }
    if (journey) {
      const jr = journey.getBoundingClientRect(); const k = clamp((innerHeight * 0.82 - jr.top) / (jr.height + innerHeight * 0.1), 0, 1);
      journey.style.setProperty('--draw', k.toFixed(3));
      journeyItems.forEach((li, i) => li.classList.toggle('lit', k > (i + 0.35) / journeyItems.length * 0.95));
    }
    clouds.forEach((c, i) => { const r = c.getBoundingClientRect(); c.style.setProperty('--px', `${((r.top - innerHeight / 2) * (i ? -0.12 : 0.12)).toFixed(1)}px`); });
    if (helper) { const r = helper.getBoundingClientRect(); helper.style.setProperty('--py', `${((r.top - innerHeight / 2) * -0.08).toFixed(1)}px`); }
    if (orb) { ox = lerp(ox, st.px, 0.2); oy = lerp(oy, st.py, 0.2); orb.style.transform = `translate3d(${ox.toFixed(1)}px,${oy.toFixed(1)}px,0)`; }
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
