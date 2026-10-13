// Red Teddy in the bakery: the brand's plush renders, with a code-drawn fallback.
const RED = 0xa3171f;
const RED_D = 0x7d0f17;
const RED_L = 0xc8353d;
const IVORY = 0xfaf5ec;
const NAVY = 0x0e1830;
const GOLD = 0xd9a441;
const INK = 0x1d1a1a;

// Teddy is the brand's own 3D plush renders (game/art/teddy-think.webp, teddy-cheer.webp),
// cut out of their studio backgrounds. Two poses: thinking (calm, working) and cheering.
export const TEDDY_POSES = ['think', 'cheer'];
const POSE_FOR = { smile: 'think', think: 'think', oops: 'think', happy: 'cheer', celebrate: 'cheer' };
const TEDDY_HEIGHT = 640; // game units at scale 1, feet to ears

// Returns a controller for one Teddy in a Phaser scene. Uses the renders when they
// loaded, and the drawn version otherwise, with the same controls either way.
// `calm` disables all movement (reduced-motion mode); poses still change.
export function createTeddy(scene, x, y, scale = 1, calm = false) {
  if (!TEDDY_POSES.every((p) => scene.textures.exists(`teddy-${p}`))) return createDrawnTeddy(scene, x, y, scale, calm);
  const S = scale * 0.62;
  const root = scene.add.container(x, y).setScale(S);
  // Feet sit on a fixed line, so swapping poses of different widths never jumps.
  const img = scene.add.image(0, 270, 'teddy-think').setOrigin(0.5, 1);
  root.add(img);
  let mood = 'think';
  const blinkEvent = null;

  const show = (pose) => {
    img.setTexture(`teddy-${pose}`);
    img.setScale(TEDDY_HEIGHT / img.frame.realHeight);
  };
  function setMood(name) {
    mood = POSE_FOR[name] || 'think';
    show(mood);
  }
  // Teddy stands still. The rendered poses carry the emotion; motion would cheapen it.
  function idle() {}
  function startBlinking() {}
  function react(name) {
    const before = mood;
    setMood(name);
    if (calm || before === mood) return;
    // A short cross-fade into the new pose, nothing more.
    scene.tweens.killTweensOf(img);
    img.setAlpha(0.35);
    scene.tweens.add({ targets: img, alpha: 1, duration: 180, ease: 'Quad.easeOut' });
  }
  setMood('think');
  idle();
  startBlinking();
  return {
    root,
    setMood,
    react,
    setPosition(px, py) { x = px; y = py; scene.tweens.killTweensOf(root); root.setPosition(px, py); idle(); },
    destroy() {
      blinkEvent?.remove(false);
      scene.tweens.killTweensOf(root);
      root.destroy(true);
    },
  };
}

// The original code-drawn Teddy, kept as the fallback when the art cannot load.
function createDrawnTeddy(scene, x, y, scale = 1, calm = false) {
  const root = scene.add.container(x, y).setScale(scale);
  const body = scene.add.graphics();
  body.fillStyle(RED_D); body.fillCircle(-54, -74, 24); body.fillCircle(54, -74, 24);
  body.fillStyle(IVORY); body.fillCircle(-54, -74, 12); body.fillCircle(54, -74, 12);
  body.fillStyle(RED); body.fillEllipse(0, 6, 172, 156);
  body.fillStyle(RED_L); body.fillEllipse(-40, -20, 28, 22); // soft highlight
  body.fillStyle(IVORY); body.fillEllipse(0, 34, 86, 66);
  body.fillStyle(RED_D); body.fillEllipse(-66, 72, 40, 30); body.fillEllipse(66, 72, 40, 30);
  body.fillStyle(NAVY); body.fillRoundedRect(-64, 46, 128, 24, 12);
  body.fillStyle(GOLD); body.fillRect(-12, 46, 24, 24);
  body.fillStyle(NAVY); body.fillTriangle(-6, 66, 6, 66, 0, 88);
  const eyes = scene.add.graphics();
  const face = scene.add.graphics();
  root.add([body, eyes, face]);

  let mood = null;
  let blinkEvent = null;

  function drawEyes(open = true, look = 0) {
    eyes.clear();
    if (!open) {
      eyes.lineStyle(5, INK, 1);
      eyes.beginPath(); eyes.arc(-34, -6, 9, Math.PI * 0.1, Math.PI * 0.9, false); eyes.strokePath();
      eyes.beginPath(); eyes.arc(34, -6, 9, Math.PI * 0.1, Math.PI * 0.9, false); eyes.strokePath();
      return;
    }
    eyes.fillStyle(INK);
    eyes.fillCircle(-34 + look, -6, 10); eyes.fillCircle(34 + look, -6, 10);
    eyes.fillStyle(0xffffff);
    eyes.fillCircle(-30 + look, -10, 3.5); eyes.fillCircle(38 + look, -10, 3.5);
  }

  function drawMouth(kind) {
    face.clear();
    face.lineStyle(4, INK, 1);
    if (kind === 'smile') {
      face.beginPath(); face.arc(0, 32, 14, 0.15 * Math.PI, 0.85 * Math.PI, false); face.strokePath();
    } else if (kind === 'big') {
      face.fillStyle(INK); face.beginPath(); face.arc(0, 30, 18, 0, Math.PI, false); face.closePath(); face.fillPath();
      face.fillStyle(0xe26b72); face.fillCircle(0, 40, 8);
    } else if (kind === 'gentle') {
      face.beginPath(); face.arc(0, 48, 12, 1.15 * Math.PI, 1.85 * Math.PI, false); face.strokePath();
    } else if (kind === 'think') {
      face.fillStyle(INK); face.fillCircle(6, 36, 5);
    }
  }

  function setMood(name) {
    mood = name;
    if (name === 'happy') { drawEyes(false); drawMouth('big'); }
    else if (name === 'oops') { drawEyes(true, 0); drawMouth('gentle'); }
    else if (name === 'think') { drawEyes(true, 8); drawMouth('think'); }
    else { drawEyes(true); drawMouth('smile'); }
  }

  function startBlinking() {
    if (calm || blinkEvent) return;
    blinkEvent = scene.time.addEvent({
      delay: 2600 + Math.random() * 1800, loop: true,
      callback: () => {
        if (mood === 'happy') return;
        drawEyes(false);
        scene.time.delayedCall(120, () => { if (mood !== 'happy') drawEyes(true, mood === 'think' ? 8 : 0); });
      },
    });
  }

  function idle() {
    if (calm) return;
    scene.tweens.add({ targets: root, y: y - 7, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // One-shot reactions. Calm mode only changes the expression.
  function react(name) {
    setMood(name === 'celebrate' ? 'happy' : name);
    if (calm) return;
    scene.tweens.killTweensOf(root);
    root.setPosition(x, y);
    root.setAngle(0);
    if (name === 'happy' || name === 'celebrate') {
      scene.tweens.add({ targets: root, y: y - 34, duration: 220, yoyo: true, repeat: 2, ease: 'Quad.easeOut', onComplete: idle });
    } else if (name === 'oops') {
      scene.tweens.add({ targets: root, angle: -6, duration: 260, yoyo: true, onComplete: idle });
    } else if (name === 'think') {
      scene.tweens.add({ targets: root, angle: 4, duration: 300, yoyo: true, onComplete: idle });
    } else {
      idle();
    }
  }

  setMood('smile');
  idle();
  startBlinking();

  return {
    root,
    setMood,
    react,
    setPosition(px, py) { x = px; y = py; scene.tweens.killTweensOf(root); root.setPosition(px, py); idle(); },
    destroy() {
      blinkEvent?.remove(false);
      scene.tweens.killTweensOf(root);
      root.destroy(true);
    },
  };
}
