// The bakery scene. It draws what the mount tells it to draw and reports what the
// child does. It never stores progress and never decides whether an answer is right.
//
// Inbound (game.events):  'show-map' | 'show-round' | 'show-feedback' | 'show-result' | 'show-ending'
// Outbound (game.events): 'map-pick' {levelId} | 'answer' {choice} | 'next' {action}
import { createTeddy } from './teddy.js';

const W = 960;
const H = 600;
const C = {
  paper: 0xfbf3e7, red: 0xa3171f, redL: 0xc8353d, ivory: 0xfaf5ec, navy: 0x0e1830,
  gold: 0xd9a441, wood: 0xd9b48c, woodD: 0xb98d5f, ink: 0x1d1a1a, grey: 0xb9b2a6,
  blue: 0x2f6fb3, yellow: 0xf2c230, green: 0x3c9a5f, cake: 0xf6d7b0, icing: 0xfff6ee,
};
const COLOR_HEX = { red: C.red, blue: C.blue, yellow: C.yellow, green: C.green };
const SHAPE_LABEL = { circle: 'Circle', square: 'Square', triangle: 'Triangle', rectangle: 'Rectangle' };

export class BakeryScene extends Phaser.Scene {
  constructor() { super('bakery'); }

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
    const t = this.add.text(x, y, label, { fontFamily: 'system-ui, sans-serif', fontSize: '24px', fontStyle: '700', color: textColour }).setOrigin(0.5);
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
    this.teddy = createTeddy(this, 110, 330, 0.62, this.calm);
    this.layer.add(this.teddy.root);
    this.stage(this.add.rectangle(W / 2, 130, 540, 50, C.ivory).setStrokeStyle(3, C.red));
    this.stage(this.add.text(W / 2, 130, headline || 'Teddy\u2019s Bakery', {
      fontFamily: 'Georgia, serif', fontSize: '30px', fontStyle: '700', color: '#1d1a1a',
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
    const card = this.add.rectangle(x, y, 250, 92, locked ? C.grey : C.ivory, 1).setStrokeStyle(3, locked ? 0x8f887d : C.red);
    this.layer.add(card);
    this.layer.add(this.add.text(x, y - 14, lv.title, {
      fontFamily: 'Georgia, serif', fontSize: '23px', fontStyle: '700', color: locked ? '#5d5650' : '#1d1a1a',
    }).setOrigin(0.5));
    if (locked) {
      this.layer.add(this.add.text(x, y + 22, 'Solve the sign before this', { fontFamily: 'system-ui, sans-serif', fontSize: '15px', color: '#5d5650' }).setOrigin(0.5));
    } else {
      for (let s = 0; s < 3; s++) this.drawStar(x - 40 + s * 40, y + 26, 13, s < (lv.stars ?? 0));
    }
    if (!locked) {
      const hit = this.add.zone(x, y, 250, 92).setInteractive({ useHandCursor: true });
      hit.on('pointerdown', () => this.game.events.emit('map-pick', { levelId: lv.id }));
      this.layer.add(hit);
      this.tweens.add({ targets: card, scaleX: 1.03, scaleY: 1.03, duration: this.calm ? 0 : 1200, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }
  }

  // ---------- Rounds ----------
  showRound({ round, index, total, levelTitle, boss }) {
    this.clearStage();
    this.stage(this.add.text(24, 16, `${levelTitle}  ·  ${index + 1} of ${total}`, {
      fontFamily: 'system-ui, sans-serif', fontSize: '18px', fontStyle: '700', color: '#5d5650',
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

  cakeAt(x, y, scale, colour = C.cake) {
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
    const cx = 580; const cy = 300;
    const tray = this.add.graphics();
    tray.fillStyle(C.woodD); tray.fillRoundedRect(cx - 230, cy - 120 + 0, 460, 210, 22);
    this.layer.add(tray);
    const counter = this.add.text(cx, 110, 'Counted: 0', { fontFamily: 'system-ui, sans-serif', fontSize: '26px', fontStyle: '700', color: '#1d1a1a' }).setOrigin(0.5);
    this.layer.add(counter);
    for (let i = 0; i < n; i++) {
      const col = i % cols; const row = Math.floor(i / cols);
      const x = cx - ((cols - 1) * 80) / 2 + col * 80;
      const y = cy - 40 + row * 90 - ((rows - 1) * 90) / 2 + 20;
      const cake = this.cakeAt(x, y, 1.2);
      cake.setInteractive(new Phaser.Geom.Rectangle(-32, -30, 64, 60), Phaser.Geom.Rectangle.Contains);
      cake.on('pointerdown', () => {
        if (cake.counted) return;
        cake.counted = true;
        this.roundCounted += 1;
        counter.setText(`Counted: ${this.roundCounted}`);
        this.game.events.emit('sfx', 'pop');
        this.tweens.add({ targets: cake, scale: 1.45, duration: this.calm ? 0 : 140, yoyo: true });
      });
      this.roundObjs.push(cake);
    }
    this.teddy.setMood('think');
  }

  drawCompare(round) {
    const draw = (cx, count, id) => {
      const frame = this.add.graphics();
      frame.fillStyle(C.woodD); frame.fillRoundedRect(cx - 150, 190, 300, 220, 22);
      frame.fillStyle(C.ivory, 0.85); frame.fillRoundedRect(cx - 136, 204, 272, 192, 16);
      this.layer.add(frame);
      const cols = Math.min(count, 4);
      for (let i = 0; i < count; i++) {
        const col = i % cols; const row = Math.floor(i / cols);
        const x = cx - ((cols - 1) * 66) / 2 + col * 66;
        const y = 270 + row * 70;
        this.cakeAt(x, y, 0.9);
      }
      const zone = this.add.zone(cx, 300, 300, 220).setInteractive({ useHandCursor: true });
      zone.on('pointerdown', () => this.game.events.emit('answer', { choice: id }));
      this.layer.add(zone);
      this.roundObjs.push(zone);
    };
    draw(330, round.data.left, 'left');
    draw(630, round.data.right, 'right');
    this.stage(this.add.text(W / 2, 470, 'Tap the tray you choose', { fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#5d5650' }).setOrigin(0.5));
    this.teddy.setMood('think');
  }

  drawShape(round) {
    const holes = round.data.holes;
    const spacing = 780 / holes.length;
    const startX = 260 + spacing / 2 - 20;
    const holeY = 260;
    holes.forEach((id, i) => {
      const x = startX + i * spacing;
      const outline = this.shapeGfx(id, x, holeY, 62, false);
      outline.setData('hole', id);
      this.layer.add(outline);
      this.stage(this.add.text(x, holeY + 84, SHAPE_LABEL[id], { fontFamily: 'system-ui, sans-serif', fontSize: '18px', color: '#5d5650' }).setOrigin(0.5));
      this.roundObjs.push({ id, x, y: holeY, hole: true });
    });
    const sx = 480; const sy = 430;
    const piece = this.shapeGfx(round.answer, sx, sy, 56, true);
    piece.setInteractive(new Phaser.Geom.Rectangle(-60, -60, 120, 120), Phaser.Geom.Rectangle.Contains);
    this.input.setDraggable(piece);
    this.layer.add(piece);
    this.stage(this.add.text(W / 2, 512, 'Drag the cake to its hole', { fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#5d5650' }).setOrigin(0.5));
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
    const startX = W / 2 - ((seq.length - 1) * 96) / 2;
    seq.forEach((item, i) => {
      const x = startX + i * 96;
      const y = 250;
      if (i === round.data.gap) {
        const slot = this.add.rectangle(x, y, 80, 80, C.ivory).setStrokeStyle(4, C.ink);
        this.layer.add(slot);
        this.layer.add(this.add.text(x, y, '?', { fontFamily: 'Georgia, serif', fontSize: '44px', fontStyle: '700', color: '#1d1a1a' }).setOrigin(0.5));
      } else {
        this.patternTile(x, y, item);
      }
    });
    this.stage(this.add.text(W / 2, 360, 'Tap the piece that fills the gap', { fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#5d5650' }).setOrigin(0.5));
    round.options.forEach((opt, i) => {
      const x = W / 2 - ((round.options.length - 1) * 130) / 2 + i * 130;
      const tile = this.patternTile(x, 450, opt, true);
      tile.on('pointerdown', () => this.game.events.emit('answer', { choice: opt }));
    });
    this.teddy.setMood('think');
  }

  patternTile(x, y, item, interactive = false) {
    const bg = this.add.rectangle(x, y, 80, 80, C.ivory).setStrokeStyle(3, C.ink);
    const dot = this.add.circle(x, y, 26, COLOR_HEX[item] ?? C.red);
    this.layer.add([bg, dot]);
    if (interactive) {
      bg.setInteractive({ useHandCursor: true });
      this.layer.add(this.add.text(x, y + 56, item.charAt(0).toUpperCase() + item.slice(1), { fontFamily: 'system-ui, sans-serif', fontSize: '16px', color: '#5d5650' }).setOrigin(0.5));
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
    const t = this.add.text(300 - 40 + 22, 71, text, { fontFamily: 'system-ui, sans-serif', fontSize: '20px', color: '#1d1a1a', wordWrap: { width: width - 40 } }).setOrigin(0, 0.5);
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
  showResult({ passed, correctFirst, total, levelTitle, nextTitle, boss }) {
    this.clearStage();
    this.teddy = createTeddy(this, 240, 330, 0.9, this.calm);
    this.layer.add(this.teddy.root);
    this.teddy.react(passed ? 'celebrate' : 'oops');
    const headline = passed
      ? (boss ? 'The bakery is open!' : 'Sign finished!')
      : 'The oven needs a little more warmth.';
    const body = passed
      ? `You got ${correctFirst} of ${total} right first time. ${nextTitle ? `Next up: ${nextTitle}.` : ''}`
      : `You got ${correctFirst} of ${total} right first time. Practice makes the oven hot. Let’s try again. Hints are there whenever you need them.`;
    this.stage(this.add.text(W / 2 + 60, 200, headline, { fontFamily: 'Georgia, serif', fontSize: '36px', fontStyle: '700', color: '#1d1a1a', wordWrap: { width: 560 }, align: 'center' }).setOrigin(0.5));
    this.stage(this.add.text(W / 2 + 60, 290, body, { fontFamily: 'system-ui, sans-serif', fontSize: '21px', color: '#3d3833', wordWrap: { width: 560 }, align: 'center' }).setOrigin(0.5));
    if (passed) {
      this.game.events.emit('sfx', 'sticker');
      this.burst(W / 2, 170, C.gold);
      this.sticker(W / 2 + 60, 420);
    }
    if (passed) {
      this.button(W / 2 + 60, 500, 300, 60, nextTitle ? 'Next sign' : 'Back to the map', () => this.game.events.emit('next', { action: 'map' }));
    } else {
      this.button(W / 2 - 110, 500, 240, 60, 'Try again', () => this.game.events.emit('next', { action: 'retry' }));
      this.button(W / 2 + 170, 500, 240, 60, 'Back to the map', () => this.game.events.emit('next', { action: 'map' }), 'line');
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
    this.teddy = createTeddy(this, W / 2, 330, 1.05, this.calm);
    this.layer.add(this.teddy.root);
    this.teddy.react('celebrate');
    this.game.events.emit('sfx', 'win');
    this.burst(W / 2, 200, C.gold);
    this.stage(this.add.text(W / 2, 50, 'The bakery is open!', { fontFamily: 'Georgia, serif', fontSize: '42px', fontStyle: '700', color: '#1d1a1a' }).setOrigin(0.5));
    const lines = summary.lines;
    this.stage(this.add.text(W / 2, 470, lines.join('\n'), {
      fontFamily: 'system-ui, sans-serif', fontSize: '19px', color: '#3d3833', align: 'center', lineSpacing: 6,
    }).setOrigin(0.5, 0));
    this.button(W / 2, 555, 300, 50, 'Back to the map', () => this.game.events.emit('next', { action: 'map' }));
  }
}
