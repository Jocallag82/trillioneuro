// The bakery scene. It draws what the mount tells it to draw and reports what the
// child does. It never stores progress and never decides whether an answer is right.
//
// Inbound (game.events):  'show-map' | 'show-round' | 'show-feedback' | 'show-result' | 'show-ending'
// Outbound (game.events): 'map-pick' {levelId} | 'answer' {choice} | 'next' {action}
import { createTeddy, TEDDY_POSES } from './teddy.js';

const W = 960;
const H = 600;
const C = {
  paper: 0xfbf3e7, red: 0xa3171f, redL: 0xc8353d, ivory: 0xfaf5ec, navy: 0x0e1830,
  gold: 0xd9a441, wood: 0xd9b48c, woodD: 0xb98d5f, ink: 0x1d1a1a, grey: 0xb9b2a6,
  blue: 0x2f6fb3, yellow: 0xf2c230, green: 0x3c9a5f, cake: 0xf6d7b0, icing: 0xfff6ee,
};
const COLOR_HEX = { red: C.red, blue: C.blue, yellow: C.yellow, green: C.green };
const SHAPE_LABEL = { circle: 'Circle', square: 'Square', triangle: 'Triangle', rectangle: 'Rectangle' };
const SERIF = 'Fraunces, Georgia, serif';
const SANS = '"Atkinson Hyperlegible", system-ui, sans-serif';
const ART = '/learn/game/art/';
const BUNS = ['bun', 'bun-pink', 'bun-choc'];
// Original illustrations (scripts/build-bakery-art.mjs). Rasterised at 1.5x for sharp edges.
const ART_FILES = {
  bun: [240, 225], 'bun-pink': [240, 225], 'bun-choc': [240, 225],
  ...Object.fromEntries(['circle', 'square', 'triangle', 'rectangle'].flatMap((s) => [[`tin-${s}`, [270, 270]], [`cookie-${s}`, [270, 270]]])),
  'macaron-red': [180, 180], 'macaron-blue': [180, 180], 'macaron-yellow': [180, 180], 'macaron-green': [180, 180],
  tray: [780, 360], plate: [480, 345], shop: [1440, 900],
};

export class BakeryScene extends Phaser.Scene {
  constructor() { super('bakery'); }

  // Missing art is not fatal: every drawing has a code-drawn fallback.
  preload() {
    this.load.on('loaderror', (file) => console.warn(`[bakery] art missing: ${file.key}`));
    for (const [key, [width, height]] of Object.entries(ART_FILES)) this.load.svg(key, `${ART}${key}.svg`, { width, height });
    for (const pose of TEDDY_POSES) this.load.image(`teddy-${pose}`, `${ART}teddy-${pose}.webp`);
  }

  has(key) { return this.textures.exists(key); }

  create() {
    this.calm = !!this.registry.get('calm');
    this.timers = [];
    this.stageObjs = [];
    this.env = this.add.container(0, 0);
    this.drawEnvironment();
    this.layer = this.add.container(0, 0);
    this.teddy = null;
    this.onEvent = {
      'show-map': (d) => this.showMap(d),
      'show-round': (d) => this.showRound(d),
      'show-feedback': (d) => this.showFeedback(d),
      'show-result': (d) => this.showResult(d),
      'show-ending': (d) => this.showEnding(d),
    };
    Object.entries(this.onEvent).forEach(([name, fn]) => this.game.events.on(name, fn));
    this.events.once('shutdown', () => this.teardown());
    this.events.once('destroy', () => this.teardown());
    this.game.events.emit('scene-ready');
  }

  teardown() {
    if (this.onEvent) Object.entries(this.onEvent).forEach(([name, fn]) => this.game.events.off(name, fn));
    this.timers.forEach((t) => t.remove?.(false));
    this.timers = [];
    this.teddy?.destroy();
    this.teddy = null;
  }

  later(ms, fn) {
    const t = this.time.delayedCall(ms, fn);
    this.timers.push(t);
    return t;
  }

  // ---------- Shop front ----------
  drawEnvironment() {
    if (this.has('shop')) {
      this.env.add(this.add.image(W / 2, H / 2, 'shop').setDisplaySize(W, H));
      return;
    }
    const g = this.add.graphics();
    g.fillStyle(C.paper); g.fillRect(0, 0, W, H);
    // Warm window light on the back wall.
    g.fillStyle(C.gold, 0.12); g.fillCircle(W * 0.5, 220, 360);
    // Shelves.
    g.fillStyle(C.woodD); g.fillRect(40, 206, W - 80, 10); g.fillRect(40, 300, W - 80, 10);
    for (let i = 0; i < 9; i++) {
      g.fillStyle(i % 2 ? C.cake : C.icing, 1);
      g.fillRoundedRect(70 + i * 96, 164, 60, 40, 8);
      g.fillStyle(C.red, 1); g.fillCircle(100 + i * 96, 162, 6);
    }
    this.env.add(g);
    // Striped awning with scalloped edge.
    const awning = this.add.graphics();
    for (let i = 0; i < 16; i++) {
      awning.fillStyle(i % 2 ? C.ivory : C.red, 1);
      awning.fillRect(i * (W / 16), 0, W / 16 + 1, 64);
      awning.fillStyle(i % 2 ? C.ivory : C.red, 1);
      awning.fillCircle(i * (W / 16) + W / 32, 64, W / 32);
    }
    this.env.add(awning);
    this.awning = awning;
    // Counter and floor.
    const floor = this.add.graphics();
    floor.fillStyle(C.wood); floor.fillRect(0, 500, W, H - 500);
    floor.lineStyle(2, C.woodD, 0.5);
    for (let y = 520; y < H; y += 26) floor.lineBetween(0, y, W, y);
    floor.fillStyle(C.navy); floor.fillRect(0, 430, W, 70);
    floor.fillStyle(C.gold); floor.fillRect(0, 430, W, 6);
    this.env.add(floor);
    // Dust motes catching the light. Still in calm mode.
    if (!this.calm) {
      for (let i = 0; i < 14; i++) {
        const m = this.add.circle(Phaser.Math.Between(60, W - 60), Phaser.Math.Between(120, 420), 2.5, C.gold, 0.6);
        this.env.add(m);
        this.tweens.add({
          targets: m, y: m.y - 40, alpha: 0.1, duration: Phaser.Math.Between(3000, 6000),
          yoyo: true, repeat: -1, delay: i * 180, ease: 'Sine.easeInOut',
        });
      }
      this.tweens.add({ targets: awning, scaleY: 1.02, duration: 2400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  addMotes() {
    if (this.calm) return;
    for (let i = 0; i < 12; i++) {
      const m = this.add.circle(Phaser.Math.Between(60, W - 60), Phaser.Math.Between(140, 420), 2.5, C.gold, 0.55);
      this.env.add(m);
      this.tweens.add({ targets: m, y: m.y - 40, alpha: 0.1, duration: Phaser.Math.Between(3000, 6000), yoyo: true, repeat: -1, delay: i * 200, ease: 'Sine.easeInOut' });
    }
  }

  clearStage() {
    this.layer.removeAll(true);
    this.stageObjs.forEach((o) => o.destroy?.());
    this.stageObjs = [];
    this.teddy?.destroy();
    this.teddy = null;
    this.tweens.getTweens().forEach((tw) => {
      const targets = tw.targets || [];
      if (targets.some((o) => o && this.layer.list.includes(o))) tw.stop();
    });
  }

  stage(obj) { this.layer.add(obj); return obj; }

  button(x, y, w, h, label, onClick, style = 'red') {
    const fill = style === 'red' ? C.red : style === 'navy' ? C.navy : C.ivory;
    const textColour = style === 'line' ? '#1d1a1a' : '#ffffff';
    const bg = this.add.rectangle(x, y, w, h, fill).setStrokeStyle(style === 'line' ? 3 : 0, C.ink);
    const t = this.add.text(x, y, label, { fontFamily: SANS, fontSize: '24px', fontStyle: '700', color: textColour }).setOrigin(0.5);
    const hit = this.add.zone(x, y, w, h).setInteractive({ useHandCursor: true });
    hit.on('pointerdown', () => { bg.setScale(0.97); this.later(90, () => bg.setScale(1)); onClick(); });
    this.layer.add([bg, t, hit]);
    return [bg, t, hit];
  }

  drawStar(x, y, r, filled) {
    const pts = [];
    for (let i = 0; i < 10; i++) {
      const rad = i % 2 ? r * 0.45 : r;
      const a = -Math.PI / 2 + (i * Math.PI) / 5;
      pts.push(new Phaser.Math.Vector2(x + Math.cos(a) * rad, y + Math.sin(a) * rad));
    }
    const g = this.add.graphics();
    g.fillStyle(filled ? C.gold : C.grey, 1);
    g.fillPoints(pts, true);
    this.layer.add(g);
    return g;
  }

  // ---------- Map ----------
  showMap({ levels, boss, bossOpen, headline }) {
    this.clearStage();
    this.teddy = createTeddy(this, 98, 336, 0.56, this.calm);
    this.layer.add(this.teddy.root);
    this.stage(this.add.rectangle(W / 2, 130, 540, 50, C.ivory).setStrokeStyle(3, C.red));
    this.stage(this.add.text(W / 2, 130, headline || 'Teddy\u2019s Bakery', {
      fontFamily: SERIF, fontSize: '30px', fontStyle: '700', color: '#1d1a1a',
    }).setOrigin(0.5));
    // Two rows of signs, then the Grand Opening sign on the counter.
    levels.forEach((lv, i) => {
      const x = i % 2 ? 640 : 320;
      const y = 262 + Math.floor(i / 2) * 104;
      this.signpost(x, y, lv);
    });
    this.signpost(W / 2 + 60, 470, { ...boss, locked: !bossOpen, stars: boss.stars ?? 0, passed: boss.done });
    this.teddy.react('happy');
  }

  signpost(x, y, lv) {
    const locked = !!lv.locked;
    const ropes = this.add.graphics();
    ropes.lineStyle(3, 0x8a6a44, 1); ropes.lineBetween(x - 90, y - 46, x - 70, y - 70); ropes.lineBetween(x + 90, y - 46, x + 70, y - 70);
    this.layer.add(ropes);
    const shadow = this.add.rectangle(x + 4, y + 5, 250, 92, 0x000000, 0.12);
    const card = this.add.rectangle(x, y, 250, 92, locked ? 0xd8d0c2 : 0xfffaf0, 1).setStrokeStyle(4, locked ? 0x9c9384 : 0x7a4f2a);
    this.layer.add([shadow, card]);
    this.layer.add(this.add.text(x, y - 14, lv.title, {
      fontFamily: SERIF, fontSize: '23px', fontStyle: '700', color: locked ? '#5d5650' : '#1d1a1a',
    }).setOrigin(0.5));
    if (locked) {
      this.layer.add(this.add.text(x, y + 22, 'Solve the sign before this', { fontFamily: SANS, fontSize: '15px', color: '#5d5650' }).setOrigin(0.5));
    } else {
      for (let s = 0; s < 3; s++) this.drawStar(x - 40 + s * 40, y + 26, 13, s < (lv.stars ?? 0));
    }
    if (!locked) {
      const hit = this.add.zone(x, y, 250, 92).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.game.events.emit('map-pick', { levelId: lv.id }));
      this.layer.add(hit);
      // No idle pulsing: an open sign answers the pointer instead.
      hit.on('pointerover', () => card.setStrokeStyle(5, C.red));
      hit.on('pointerout', () => card.setStrokeStyle(4, 0x7a4f2a));
    }
  }

  // ---------- Rounds ----------
  showRound({ round, index, total, levelTitle, boss }) {
    this.clearStage();
    // A calm work surface in front of the busy shop, so the puzzle is what stands out.
    const veil = this.add.graphics();
    veil.fillStyle(0xfffaf0, 0.9); veil.fillRoundedRect(222, 116, 718, 312, 22);
    veil.lineStyle(2, 0xe3d6c2, 1); veil.strokeRoundedRect(222, 116, 718, 312, 22);
    this.layer.add(veil);
    this.stage(this.add.text(244, 132, `${levelTitle}  ·  ${index + 1} of ${total}`, {
      fontFamily: SANS, fontSize: '17px', fontStyle: '700', color: '#7a4f2a',
    }));
    this.teddy = createTeddy(this, 120, 330, 0.55, this.calm);
    this.layer.add(this.teddy.root);
    this.roundCounted = 0;
    this.roundObjs = [];
    this.roundDone = false;
    this.roundId = `${index}-${Date.now()}`;
    switch (round.kind) {
      case 'count': this.drawCount(round); break;
      case 'compare': this.drawCompare(round); break;
      case 'shape': this.drawShape(round); break;
      case 'pattern': this.drawPattern(round); break;
      default: break;
    }
  }

  cakeAt(x, y, scale, colour = C.cake, kind = 0) {
    if (this.has('bun')) {
      const img = this.add.image(x, y, BUNS[kind % BUNS.length]).setScale(scale * 0.32);
      this.layer.add(img);
      return img;
    }
    const g = this.add.graphics();
    g.fillStyle(colour); g.fillRoundedRect(-26, -4, 52, 30, 8);
    g.fillStyle(C.icing); g.fillRoundedRect(-30, -14, 60, 16, 8);
    g.fillStyle(C.red); g.fillCircle(0, -20, 7);
    g.setPosition(x, y).setScale(scale);
    this.layer.add(g);
    return g;
  }

  drawCount(round) {
    const n = round.data.count;
    const cols = Math.min(n, 5);
    const rows = Math.ceil(n / cols);
    const cx = 580; const cy = 292;
    if (this.has('tray')) this.layer.add(this.add.image(cx, cy - 15, 'tray').setDisplaySize(500, 230));
    else {
      const tray = this.add.graphics();
      tray.fillStyle(C.woodD); tray.fillRoundedRect(cx - 230, cy - 120 + 0, 460, 210, 22);
      this.layer.add(tray);
    }
    const counter = this.add.text(900, 132, 'Counted: 0', { fontFamily: SANS, fontSize: '24px', fontStyle: '700', color: '#1d1a1a' }).setOrigin(1, 0);
    this.layer.add(counter);
    for (let i = 0; i < n; i++) {
      const col = i % cols; const row = Math.floor(i / cols);
      const x = cx - ((cols - 1) * 96) / 2 + col * 96;
      const y = cy - 15 + row * 100 - ((rows - 1) * 100) / 2;
      const cake = this.cakeAt(x, y, cols <= 3 && rows === 1 ? 1.75 : cols === 4 ? 1.25 : 1.22, C.cake, n % 3);
      if (cake.type === 'Image') cake.setInteractive({ useHandCursor: true });
      else cake.setInteractive(new Phaser.Geom.Rectangle(-32, -30, 64, 60), Phaser.Geom.Rectangle.Contains);
      cake.on('pointerdown', () => {
        if (cake.counted) return;
        cake.counted = true;
        this.roundCounted += 1;
        counter.setText(`Counted: ${this.roundCounted}`);
        this.game.events.emit('sfx', 'pop');
        const base = cake.scale;
        this.tweens.add({ targets: cake, scale: base * 1.2, duration: this.calm ? 0 : 140, yoyo: true });
        // A counted bun gets a numbered gold tag, so a child can see which ones are done.
        const tag = this.add.circle(cake.x + 26, cake.y - 26, 13, C.gold).setStrokeStyle(3, 0xffffff);
        this.layer.add(tag);
        this.layer.add(this.add.text(tag.x, tag.y, String(this.roundCounted), { fontFamily: SANS, fontSize: '15px', fontStyle: '700', color: '#1d1a1a' }).setOrigin(0.5));
      });
      this.roundObjs.push(cake);
    }
    this.teddy.setMood('think');
  }

  drawCompare(round) {
    const draw = (cx, count, id) => {
      if (this.has('plate')) this.layer.add(this.add.image(cx, 268, 'plate').setDisplaySize(300, 210));
      else {
        const frame = this.add.graphics();
        frame.fillStyle(C.woodD); frame.fillRoundedRect(cx - 150, 190, 300, 220, 22);
        frame.fillStyle(C.ivory, 0.85); frame.fillRoundedRect(cx - 136, 204, 272, 192, 16);
        this.layer.add(frame);
      }
      const cols = Math.min(count, 4);
      for (let i = 0; i < count; i++) {
        const col = i % cols; const row = Math.floor(i / cols);
        const x = cx - ((cols - 1) * 60) / 2 + col * 60;
        const y = 262 + row * 58 - (Math.ceil(count / cols) - 1) * 26;
        this.cakeAt(x, y, 1.0, C.cake, id === 'left' ? 0 : 1);
      }
      const zone = this.add.zone(cx, 268, 300, 220).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.game.events.emit('answer', { choice: id }));
      this.layer.add(zone);
      this.roundObjs.push(zone);
    };
    draw(420, round.data.left, 'left');
    draw(750, round.data.right, 'right');
    this.stage(this.add.text(585, 404, 'Tap the plate you choose', { fontFamily: SANS, fontSize: '20px', color: '#5d5650' }).setOrigin(0.5));
    this.teddy.setMood('think');
  }

  drawShape(round) {
    const holes = round.data.holes;
    const spacing = 680 / holes.length;
    const startX = 250 + spacing / 2;
    const holeY = 230;
    holes.forEach((id, i) => {
      const x = startX + i * spacing;
      const outline = this.shapeGfx(id, x, holeY, 62, false);
      outline.setData('hole', id);
      this.layer.add(outline);
      this.stage(this.add.text(x, holeY + 84, SHAPE_LABEL[id], { fontFamily: SANS, fontSize: '18px', color: '#5d5650' }).setOrigin(0.5));
      this.roundObjs.push({ id, x, y: holeY, hole: true });
    });
    const sx = 585; const sy = 468;
    const piece = this.shapeGfx(round.answer, sx, sy, 56, true);
    // An image's hit area is its whole frame; the drawn fallback needs one centred on it.
    if (piece.type === 'Image') piece.setInteractive({ useHandCursor: true });
    else piece.setInteractive(new Phaser.Geom.Rectangle(-60, -60, 120, 120), Phaser.Geom.Rectangle.Contains);
    this.input.setDraggable(piece);
    this.layer.add(piece);
    this.stage(this.add.text(585, 400, 'Drag the biscuit up into the tin it fits', { fontFamily: SANS, fontSize: '20px', color: '#5d5650' }).setOrigin(0.5));
    piece.on('drag', (p, dx, dy) => { piece.x = dx; piece.y = dy; });
    piece.on('dragend', () => {
      const hit = this.roundObjs.find((h) => h.hole && Phaser.Math.Distance.Between(piece.x, piece.y, h.x, h.y) < 80);
      if (hit && !this.roundDone) {
        this.game.events.emit('answer', { choice: hit.id });
      }
      if (this.roundDone) return;
      this.tweens.add({ targets: piece, x: sx, y: sy, duration: this.calm ? 0 : 260, ease: 'Back.easeOut' });
    });
    this.teddy.setMood('think');
  }

  shapeGfx(id, x, y, r, filled) {
    const key = `${filled ? 'cookie' : 'tin'}-${id}`;
    if (this.has(key)) return this.add.image(x, y, key).setDisplaySize(r * 2.5, r * 2.5);
    const g = this.add.graphics();
    const colour = filled ? C.red : C.ivory;
    const stroke = filled ? 0 : C.red;
    g.fillStyle(colour, 1); g.lineStyle(filled ? 0 : 6, stroke, 1);
    if (id === 'circle') { if (filled) g.fillCircle(0, 0, r); else g.strokeCircle(0, 0, r); }
    if (id === 'square') { if (filled) g.fillRect(-r, -r, r * 2, r * 2); else g.strokeRect(-r, -r, r * 2, r * 2); }
    if (id === 'rectangle') {
      if (filled) g.fillRect(-r * 1.4, -r * 0.7, r * 2.8, r * 1.4); else g.strokeRect(-r * 1.4, -r * 0.7, r * 2.8, r * 1.4);
    }
    if (id === 'triangle') {
      const pts = [0, -r, r, r * 0.9, -r, r * 0.9];
      if (filled) g.fillTriangle(...pts); else g.strokeTriangle(...pts);
    }
    g.setPosition(x, y);
    return g;
  }

  drawPattern(round) {
    const seq = round.data.seq;
    const startX = 585 - ((seq.length - 1) * 96) / 2;
    seq.forEach((item, i) => {
      const x = startX + i * 96;
      const y = 214;
      if (i === round.data.gap) {
        const slot = this.add.rectangle(x, y, 80, 80, C.ivory).setStrokeStyle(4, C.ink);
        this.layer.add(slot);
        this.layer.add(this.add.text(x, y, '?', { fontFamily: SERIF, fontSize: '44px', fontStyle: '700', color: '#1d1a1a' }).setOrigin(0.5));
      } else {
        this.patternTile(x, y, item);
      }
    });
    this.stage(this.add.text(585, 286, 'Tap the piece that fills the gap', { fontFamily: SANS, fontSize: '20px', color: '#5d5650' }).setOrigin(0.5));
    round.options.forEach((opt, i) => {
      const x = 585 - ((round.options.length - 1) * 130) / 2 + i * 130;
      const tile = this.patternTile(x, 352, opt, true);
      tile.on('pointerdown', () => this.game.events.emit('answer', { choice: opt }));
    });
    this.teddy.setMood('think');
  }

  patternTile(x, y, item, interactive = false) {
    const bg = this.add.rectangle(x, y, 80, 80, 0xfffaf0).setStrokeStyle(3, interactive ? 0x7a4f2a : 0xe3d6c2);
    const key = `macaron-${item}`;
    const dot = this.has(key) ? this.add.image(x, y, key).setDisplaySize(72, 72) : this.add.circle(x, y, 26, COLOR_HEX[item] ?? C.red);
    this.layer.add([bg, dot]);
    if (interactive) {
      bg.setInteractive({ useHandCursor: true });
      this.layer.add(this.add.text(x, y + 56, item.charAt(0).toUpperCase() + item.slice(1), { fontFamily: SANS, fontSize: '16px', color: '#5d5650' }).setOrigin(0.5));
      return bg;
    }
    return bg;
  }

  // ---------- Feedback ----------
  showFeedback({ type, hint, answer }) {
    // Only a finished round locks the shapes. A wrong try or a hint leaves them movable.
    if (type === 'correct' || type === 'reveal') this.roundDone = true;
    if (type === 'hint') {
      this.teddy?.react('think');
      this.bubble(`Hint: ${hint}`);
    } else if (type === 'correct') {
      this.teddy?.react('happy');
      this.burst(W / 2, 300, C.gold);
      this.game.events.emit('sfx', 'right');
      this.bubble('Yes! Well done!');
    } else if (type === 'wrong') {
      this.teddy?.react('oops');
      this.shake();
      this.game.events.emit('sfx', 'wrong');
      this.bubble(hint ? `Let’s look again. ${hint}` : 'Let’s look again.');
    } else if (type === 'reveal') {
      this.teddy?.react('think');
      this.game.events.emit('sfx', 'reveal');
      this.bubble(`The answer is ${answer}. Let’s try the next one together.`);
    }
  }

  bubble(text) {
    const width = Math.min(560, 16 * text.length + 60);
    const b = this.add.graphics();
    b.fillStyle(C.ivory, 0.97); b.lineStyle(3, C.red, 1);
    b.fillRoundedRect(300 - 40, 40, width, 62, 16);
    b.strokeRoundedRect(300 - 40, 40, width, 62, 16);
    this.layer.add(b);
    const t = this.add.text(300 - 40 + 22, 71, text, { fontFamily: SANS, fontSize: '20px', color: '#1d1a1a', wordWrap: { width: width - 40 } }).setOrigin(0, 0.5);
    this.layer.add(t);
    this.stageObjs.push({ destroy: () => { b.destroy(); t.destroy(); } });
    this.later(3200, () => { b.destroy(); t.destroy(); });
  }

  burst(x, y, colour) {
    if (this.calm) return;
    for (let i = 0; i < 16; i++) {
      const p = this.add.circle(x, y, Phaser.Math.Between(4, 8), colour);
      const a = (i / 16) * Math.PI * 2;
      this.tweens.add({ targets: p, x: x + Math.cos(a) * 140, y: y + Math.sin(a) * 110, alpha: 0, duration: 700, onComplete: () => p.destroy() });
    }
  }

  shake() {
    if (this.calm) return;
    this.tweens.add({ targets: this.layer, x: 10, duration: 40, yoyo: true, repeat: 3, onComplete: () => this.layer.setX(0) });
  }

  // ---------- Results and ending ----------
  card(x, y, w, h) {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.1); g.fillRoundedRect(x + 5, y + 7, w, h, 24);
    g.fillStyle(0xfffaf0, 0.96); g.fillRoundedRect(x, y, w, h, 24);
    g.lineStyle(3, 0x7a4f2a, 1); g.strokeRoundedRect(x, y, w, h, 24);
    this.layer.add(g);
    return g;
  }

  showResult({ passed, correctFirst, total, levelTitle, nextTitle, boss }) {
    this.clearStage();
    this.card(300, 118, 620, 360);
    this.teddy = createTeddy(this, 165, 318, 0.78, this.calm);
    this.layer.add(this.teddy.root);
    // Not passing is never a telling-off: Teddy stays warm and encouraging.
    this.teddy.react(passed ? 'celebrate' : 'oops');
    const headline = passed
      ? (boss ? 'The bakery is open!' : 'Sign finished!')
      : 'The oven needs a little more warmth.';
    const body = passed
      ? `You got ${correctFirst} of ${total} right first time. ${nextTitle ? `Next up: ${nextTitle}.` : ''}`
      : `You got ${correctFirst} of ${total} right first time. Practice makes the oven hot. Let’s try again. Hints are there whenever you need them.`;
    const cx = 610;
    this.stage(this.add.text(cx, 178, headline, { fontFamily: SERIF, fontSize: '34px', fontStyle: '700', color: '#1d1a1a', wordWrap: { width: 540 }, align: 'center' }).setOrigin(0.5));
    this.stage(this.add.text(cx, 262, body, { fontFamily: SANS, fontSize: '20px', color: '#3d3833', wordWrap: { width: 540 }, align: 'center', lineSpacing: 4 }).setOrigin(0.5));
    if (passed) {
      this.game.events.emit('sfx', 'sticker');
      this.burst(cx, 178, C.gold);
      this.sticker(cx, 350);
      this.button(cx, 430, 300, 56, nextTitle ? 'Next sign' : 'Back to the map', () => this.game.events.emit('next', { action: 'map' }));
    } else {
      this.button(cx - 140, 420, 250, 56, 'Try again', () => this.game.events.emit('next', { action: 'retry' }));
      this.button(cx + 140, 420, 250, 56, 'Back to the map', () => this.game.events.emit('next', { action: 'map' }), 'line');
    }
  }

  sticker(x, y) {
    const g = this.add.graphics();
    g.fillStyle(C.gold); g.fillCircle(x, y, 44);
    g.lineStyle(4, C.red); g.strokeCircle(x, y, 44);
    this.layer.add(g);
    this.layer.add(this.add.text(x, y, '★', { fontSize: '44px', color: '#ffffff' }).setOrigin(0.5));
  }

  showEnding({ summary }) {
    this.clearStage();
    this.card(300, 110, 620, 380);
    this.teddy = createTeddy(this, 165, 318, 0.86, this.calm);
    this.layer.add(this.teddy.root);
    this.teddy.react('celebrate');
    this.game.events.emit('sfx', 'win');
    this.burst(610, 170, C.gold);
    this.stage(this.add.text(610, 166, 'The bakery is open!', { fontFamily: SERIF, fontSize: '40px', fontStyle: '700', color: '#1d1a1a' }).setOrigin(0.5));
    const lines = summary.lines;
    this.stage(this.add.text(610, 218, lines.join('\n'), {
      fontFamily: SANS, fontSize: '19px', color: '#3d3833', align: 'center', lineSpacing: 6, wordWrap: { width: 540 },
    }).setOrigin(0.5, 0));
    this.button(610, 440, 300, 54, 'Back to the map', () => this.game.events.emit('next', { action: 'map' }));
  }
}
