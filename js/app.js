// My Wise Bet: the 3D room, the Hold'em engine, the bots, the coach and the UI.

/* ===== Helpers ===== */
const $ = s => document.querySelector(s);
const rand = (a, b) => a + Math.random() * (b - a);
const pick = a => a[Math.floor(Math.random() * a.length)];
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const fmt = n => '$' + Math.round(n).toLocaleString('en-US');
const pct = x => Math.round(x * 100) + '%';
const round5 = x => Math.max(5, Math.round(x / 5) * 5);
let MODE = null;
const isTable = () => !!MODE && MODE !== 'poker';
let speedMul = 2.2;
try {
  const v = +localStorage.getItem('holdem-speed2');
  if (v > 0) speedMul = v;
} catch (e) {}
let GEN = 0;
class Reset extends Error {}
const sleep = ms => new Promise(r => setTimeout(r, ms));
const isPaused = () => G.userPaused || G.askPaused;
let pauseStart = null,
  pausedTotal = 0;
function syncPause() {
  const p = isPaused(),
    n = performance.now();
  if (p && pauseStart === null) pauseStart = n;
  else if (!p && pauseStart !== null) {
    pausedTotal += n - pauseStart;
    pauseStart = null;
  }
}
/* game clock: stands still while paused */
function gameNow() {
  syncPause();
  const n = performance.now();
  return n - pausedTotal - (pauseStart !== null ? n - pauseStart : 0);
}
const wait = async ms => {
  const g = GEN;
  const end = gameNow() + ms * (G.ff ? 0.05 : speedMul);
  while (gameNow() < end || isPaused()) {
    await sleep(isPaused() ? 100 : Math.max(10, Math.min(100, end - gameNow())));
    if (g !== GEN) throw new Reset();
  }
  if (g !== GEN) throw new Reset();
};
const cardHTML = (c, cls = '') =>
  `<span class="pc ${isRed(c.s) ? 'red' : ''} ${cls}"><b>${RANK_CH[c.r]}</b><i>${SUIT_CH[c.s]}</i></span>`;
const miniHTML = c => `<span class="mini ${isRed(c.s) ? 'red' : ''}">${RANK_CH[c.r]}${SUIT_CH[c.s]}</span>`;
const esc = s =>
  String(s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]);

/* ===== Cast ===== */
const PERSONAS = [
  { key: 'you', name: 'You', human: true },
  {
    key: 'marge',
    name: 'Marge',
    style: 'The Rock',
    blurb: 'Retired librarian. Plays very few hands. A raise from Marge almost always means a strong hand.',
    color: 0x7d63a8,
    css: '#b29be0',
    skin: 0xe9c6aa,
    acc: 'bun',
    playRel: 1.6,
    raiseRel: 2.3,
    aggr: 0.4,
    bluff: 0.02,
    callF: 1.2,
    slow: 0.05,
    noise: 0.07,
    think: 1.4,
    adapt: 0.5,
    tiltK: 0.7,
  },
  {
    key: 'rico',
    name: 'Rico',
    style: 'The Maniac',
    blurb: 'Loves action. Raises and bluffs constantly, and gets wilder after losing.',
    color: 0xb8352a,
    css: '#ec7b6c',
    skin: 0xc68e6a,
    acc: 'shades',
    playRel: 0.75,
    raiseRel: 1.15,
    aggr: 0.85,
    bluff: 0.32,
    callF: 0.85,
    slow: 0.02,
    noise: 0.18,
    think: 0.55,
    adapt: 0.3,
    tiltK: 1.25,
  },
  {
    key: 'dev',
    name: 'Dev',
    style: 'The Shark',
    blurb: 'Patient and aggressive with good hands. Studies how you play and adjusts the fastest.',
    color: 0x2c6e8f,
    css: '#6db8dd',
    skin: 0x9a6b4f,
    acc: 'hood',
    playRel: 1.25,
    raiseRel: 1.6,
    aggr: 0.72,
    bluff: 0.1,
    callF: 1.0,
    slow: 0.1,
    noise: 0.06,
    think: 1.0,
    adapt: 1.0,
    tiltK: 0.45,
  },
  {
    key: 'gus',
    name: 'Gus',
    style: 'Calling Station',
    blurb: 'Friendly and curious. Hates folding, rarely raises, and will call you down with almost anything.',
    color: 0xc98428,
    css: '#efb562',
    skin: 0xf0c9a6,
    acc: 'cap',
    playRel: 0.85,
    raiseRel: 2.1,
    aggr: 0.2,
    bluff: 0.03,
    callF: 0.5,
    slow: 0,
    noise: 0.12,
    think: 0.9,
    adapt: 0.1,
    tiltK: 0.4,
  },
  {
    key: 'yuki',
    name: 'Yuki',
    style: 'The Trapper',
    blurb: 'Quiet and tricky. Checks big hands on purpose, then raises after you bet.',
    color: 0x3c8a5e,
    css: '#7fd1a2',
    skin: 0xf2d3b8,
    acc: 'beanie',
    playRel: 1.2,
    raiseRel: 1.5,
    aggr: 0.6,
    bluff: 0.12,
    callF: 0.95,
    slow: 0.5,
    noise: 0.08,
    think: 1.2,
    adapt: 0.8,
    tiltK: 0.6,
  },
];
const LINES = {
  marge: {
    raise: ['I have a nice one, dear.', 'Raise, please.', "I think I'll raise."],
    allin: ['All of it. Yes, all of it.'],
    win: ['Patience pays.', 'Thank you kindly.', 'Slow and steady.'],
    lose: ['Oh, fiddlesticks.', 'Well, that was unlucky.'],
    tilt: ['Three times today! Honestly!', 'I am getting rather cross.'],
    fold: ['Not this one.', "I'll wait."],
    bluffShow: ["Don't tell anyone."],
    adapt: ["You do raise an awful lot, don't you?"],
    rebuy: ['Back to the bank, I suppose.'],
  },
  rico: {
    raise: ["Let's gamble!", "Raise! Who's brave?", "Pot's too small.", 'Make it bigger!'],
    allin: ['ALL IN, baby!', 'Pushing it all!'],
    win: ['Read you like a book!', 'Ship it!', "That's how it's done."],
    lose: ['Rigged. Totally rigged.', 'Lucky card, pal.'],
    tilt: ["Okay, now I'm mad.", 'No more Mr. Nice Rico.'],
    fold: ['Fine. Take it.', "Next one's mine."],
    bluffShow: ['Had nothing. Nothing!', 'Look at this garbage. Ha!'],
    adapt: ['You keep folding to me. I love it.'],
    rebuy: ["Reload! I'm not done."],
  },
  dev: {
    raise: ['Raise.', "I'll make it bigger."],
    allin: ["I'm all in."],
    win: ['Nice hand.', 'Good game.'],
    lose: ['Nice hand.', 'Variance.'],
    tilt: ['...deep breath.'],
    fold: ['Fold.'],
    bluffShow: ['Had to try.'],
    adapt: ["I see what you're doing. Adjusting."],
    rebuy: ['Rebuying.'],
  },
  gus: {
    raise: ["Ooh, I'll raise this time!", 'Feeling lucky!'],
    allin: ['Why not? All in!'],
    win: ['Hey, I won one!', "Ha! Didn't see that coming, did ya?"],
    lose: ['Aw shucks.', 'I just had to see it!'],
    tilt: ['Dang it all.'],
    fold: ['Aw, okay.', 'Too rich for me.'],
    bluffShow: ["Was I bluffing? I don't even know."],
    adapt: ['You sure like betting, friend!'],
    rebuy: ['Good thing I brought extra!'],
  },
  yuki: {
    raise: ['Raise.', 'Hm. Raise.'],
    allin: ['All in.'],
    win: ['Thanks.', 'Mm.'],
    lose: ['Unlucky.'],
    tilt: ['Hmph.'],
    fold: ['Fold.'],
    bluffShow: ['Gotcha.'],
    adapt: ['Noted.'],
    rebuy: ['Again.'],
  },
};

/* ===== Three.js scene ===== */
const app = $('#app'),
  stage = $('#stage'),
  canvas = $('#scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0e0808);
scene.fog = new THREE.Fog(0x0e0808, 17, 36);
const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
const FLOOR = -2.4;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);

scene.add(new THREE.HemisphereLight(0xffe6c4, 0x1a0c0c, 0.55));
scene.add(new THREE.AmbientLight(0x3a2620, 0.35));
const spot = new THREE.SpotLight(0xffe0b0, 1.15, 32, 0.66, 0.55, 1.1);
spot.position.set(0, 9, 0.4);
spot.target.position.set(0, 0, 0);
spot.castShadow = true;
spot.shadow.mapSize.set(1024, 1024);
spot.shadow.bias = -0.0006;
scene.add(spot, spot.target);
const fill = new THREE.DirectionalLight(0xffd2a0, 0.25);
fill.position.set(-6, 7, 9);
scene.add(fill);

function canvasTex(w, h, draw, repeat) {
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  draw(cv.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(cv);
  t.anisotropy = renderer.capabilities.getMaxAnisotropy();
  if (repeat) {
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(repeat[0], repeat[1]);
  }
  return t;
}
function rr(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

/* room */
const floorTex = canvasTex(
  512,
  512,
  (g, w, h) => {
    for (let i = 0; i < 8; i++) {
      const y = i * 64;
      g.fillStyle = `hsl(22,${32 + Math.random() * 10}%,${14 + Math.random() * 5}%)`;
      g.fillRect(0, y, w, 64);
      g.strokeStyle = 'rgba(0,0,0,.45)';
      g.lineWidth = 2;
      g.strokeRect(0, y, w, 64);
      const off = Math.random() * w;
      g.beginPath();
      g.moveTo(off, y);
      g.lineTo(off, y + 64);
      g.stroke();
      for (let k = 0; k < 40; k++) {
        g.strokeStyle = `rgba(255,220,180,${Math.random() * 0.04})`;
        g.beginPath();
        const yy = y + Math.random() * 64;
        g.moveTo(0, yy);
        g.lineTo(w, yy + rand(-3, 3));
        g.stroke();
      }
    }
  },
  [6, 6],
);
const floor = new THREE.Mesh(
  new THREE.PlaneGeometry(40, 40),
  new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.75 }),
);
floor.rotation.x = -Math.PI / 2;
floor.position.y = FLOOR;
floor.receiveShadow = true;
scene.add(floor);
const wallTex = canvasTex(
  256,
  256,
  (g, w, h) => {
    g.fillStyle = '#3b1417';
    g.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x += 32) {
      g.fillStyle = 'rgba(0,0,0,.18)';
      g.fillRect(x, 0, 14, h);
    }
    g.fillStyle = 'rgba(212,173,98,.08)';
    for (let x = 16; x < w; x += 32) g.fillRect(x + 6, 0, 2, h);
  },
  [10, 3],
);
const room = new THREE.Mesh(
  new THREE.BoxGeometry(32, 13, 32),
  new THREE.MeshStandardMaterial({ map: wallTex, side: THREE.BackSide, roughness: 0.9 }),
);
room.position.y = FLOOR + 6.5;
scene.add(room);
// wainscot band
const wainMat = new THREE.MeshStandardMaterial({ color: 0x2a160f, roughness: 0.6 });
[
  [0, -15.9, 0],
  [0, 15.9, 0],
  [-15.9, 0, Math.PI / 2],
  [15.9, 0, Math.PI / 2],
].forEach(([x, z, ry]) => {
  const m = new THREE.Mesh(new THREE.BoxGeometry(32, 2.2, 0.2), wainMat);
  m.position.set(x, FLOOR + 1.1, z);
  m.rotation.y = ry;
  scene.add(m);
});
// back-wall bar shelf with bottles and sconces
const shelfMat = new THREE.MeshStandardMaterial({ color: 0x3a2014, roughness: 0.5 });
for (let s = 0; s < 2; s++) {
  const sh = new THREE.Mesh(new THREE.BoxGeometry(8, 0.12, 0.6), shelfMat);
  sh.position.set(0, FLOOR + 3.6 + s * 1.3, -15.6);
  scene.add(sh);
  for (let b = 0; b < 11; b++) {
    const hue = [0x2f6b3a, 0x8a4a14, 0x6f1a22, 0x2b4a7a, 0xc9a45c][b % 5];
    const bm = new THREE.MeshStandardMaterial({
      color: hue,
      emissive: hue,
      emissiveIntensity: 0.35,
      roughness: 0.2,
      metalness: 0.1,
      transparent: true,
      opacity: 0.9,
    });
    const h = rand(0.6, 0.95);
    const bt = new THREE.Mesh(new THREE.CylinderGeometry(0.11, 0.13, h, 12), bm);
    bt.position.set(-3.6 + b * 0.72 + rand(-0.08, 0.08), FLOOR + 3.66 + s * 1.3 + h / 2, -15.5);
    scene.add(bt);
  }
}
[-7, 7].forEach(x => {
  const sc = new THREE.Mesh(
    new THREE.SphereGeometry(0.22, 16, 12),
    new THREE.MeshBasicMaterial({ color: 0xffd59a }),
  );
  sc.position.set(x, FLOOR + 5, -15.7);
  scene.add(sc);
  const pl = new THREE.PointLight(0xffb870, 0.6, 10, 1.5);
  pl.position.set(x, FLOOR + 5, -15);
  scene.add(pl);
});
// framed pictures on side walls
[
  [-15.85, -4],
  [-15.85, 4],
  [15.85, -4],
  [15.85, 4],
].forEach(([x, z], i) => {
  const art = canvasTex(128, 160, (g, w, h) => {
    g.fillStyle = '#1a1210';
    g.fillRect(0, 0, w, h);
    const cols = ['#c9a45c', '#7a2a2a', '#2c5f4a', '#e8dcc0'];
    for (let k = 0; k < 5; k++) {
      g.fillStyle = cols[(k + i) % 4];
      g.globalAlpha = 0.7;
      g.beginPath();
      g.arc(rand(20, 108), rand(20, 140), rand(12, 40), 0, 7);
      g.fill();
    }
  });
  const fr = new THREE.Mesh(
    new THREE.BoxGeometry(0.12, 2.6, 2.1),
    new THREE.MeshStandardMaterial({ color: 0x9a7a3a, metalness: 0.5, roughness: 0.4 }),
  );
  fr.position.set(x, FLOOR + 4.6, z);
  scene.add(fr);
  const pic = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 2.3), new THREE.MeshStandardMaterial({ map: art }));
  pic.position.set(x + (x < 0 ? 0.08 : -0.08), FLOOR + 4.6, z);
  pic.rotation.y = x < 0 ? Math.PI / 2 : -Math.PI / 2;
  scene.add(pic);
});
// rug
const rugTex = canvasTex(512, 512, (g, w, h) => {
  g.fillStyle = '#4a1a1e';
  g.fillRect(0, 0, w, h);
  g.strokeStyle = '#c9a45c';
  g.lineWidth = 10;
  g.beginPath();
  g.arc(256, 256, 236, 0, 7);
  g.stroke();
  g.lineWidth = 3;
  g.beginPath();
  g.arc(256, 256, 212, 0, 7);
  g.stroke();
  g.strokeStyle = 'rgba(201,164,92,.25)';
  for (let a = 0; a < 24; a++) {
    g.beginPath();
    g.arc(256 + Math.cos((a / 24) * 6.283) * 224, 256 + Math.sin((a / 24) * 6.283) * 224, 8, 0, 7);
    g.stroke();
  }
});
const rug = new THREE.Mesh(
  new THREE.CircleGeometry(1, 64),
  new THREE.MeshStandardMaterial({ map: rugTex, roughness: 1 }),
);
rug.rotation.x = -Math.PI / 2;
rug.scale.set(7.6, 4.9, 1);
rug.position.y = FLOOR + 0.01;
rug.receiveShadow = true;
scene.add(rug);
// lamp
const lampMat = new THREE.MeshStandardMaterial({
  color: 0x2b3a2a,
  metalness: 0.6,
  roughness: 0.35,
  side: THREE.DoubleSide,
});
const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.6, 0.7, 40, 1, true), lampMat);
shade.position.set(0, 6.6, 0.2);
scene.add(shade);
const bulb = new THREE.Mesh(
  new THREE.SphereGeometry(0.25, 16, 12),
  new THREE.MeshBasicMaterial({ color: 0xfff0cf }),
);
bulb.position.set(0, 6.4, 0.2);
scene.add(bulb);
const cord = new THREE.Mesh(
  new THREE.CylinderGeometry(0.02, 0.02, 4, 6),
  new THREE.MeshStandardMaterial({ color: 0x111111 }),
);
cord.position.set(0, 8.9, 0.2);
scene.add(cord);

/* table */
const feltTex = canvasTex(1024, 1024, (g, w, h) => {
  const gr = g.createRadialGradient(512, 512, 40, 512, 512, 520);
  gr.addColorStop(0, '#24704f');
  gr.addColorStop(1, '#123f2c');
  g.fillStyle = gr;
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 9000; i++) {
    g.fillStyle = `rgba(${Math.random() < 0.5 ? 0 : 255},${Math.random() < 0.5 ? 40 : 255},0,${Math.random() * 0.05})`;
    g.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  }
  g.strokeStyle = 'rgba(240,210,143,.45)';
  g.lineWidth = 5;
  g.beginPath();
  g.arc(512, 512, 350, 0, 7);
  g.stroke();
  g.strokeStyle = 'rgba(240,210,143,.18)';
  g.lineWidth = 2;
  g.beginPath();
  g.arc(512, 512, 338, 0, 7);
  g.stroke();
});
const woodMat = new THREE.MeshStandardMaterial({ color: 0x4a2614, roughness: 0.45, metalness: 0.1 });
const feltMat = new THREE.MeshStandardMaterial({ map: feltTex, roughness: 0.95 });
const felt = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.1, 96), [woodMat, feltMat, woodMat]);
felt.scale.set(4.0, 1, 2.4);
felt.receiveShadow = true;
scene.add(felt);
const apron = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.95, 0.34, 96), woodMat);
apron.scale.set(4.32, 1, 2.72);
apron.position.y = -0.13;
apron.castShadow = true;
scene.add(apron);
class Ellipse3 extends THREE.Curve {
  constructor(rx, rz, y) {
    super();
    this.rx = rx;
    this.rz = rz;
    this.y = y;
  }
  getPoint(t, target = new THREE.Vector3()) {
    const a = t * Math.PI * 2;
    return target.set(Math.cos(a) * this.rx, this.y, Math.sin(a) * this.rz);
  }
}
const rail = new THREE.Mesh(
  new THREE.TubeGeometry(new Ellipse3(4.14, 2.54, 0.08), 160, 0.18, 16, true),
  new THREE.MeshStandardMaterial({ color: 0x2a1510, roughness: 0.42 }),
);
rail.castShadow = true;
rail.receiveShadow = true;
scene.add(rail);
const ped = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.75, 2.1, 32), woodMat);
ped.position.y = (FLOOR - 0.3) / 2;
scene.add(ped);
const foot = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.5, 0.14, 40), woodMat);
foot.position.y = FLOOR + 0.07;
scene.add(foot);

/* seat geometry */
const seatAngle = i => Math.PI / 2 + (i * Math.PI) / 3;
const onEllipse = (i, rx, rz, y = 0, off = 0) => {
  const a = seatAngle(i) + off;
  return V3(Math.cos(a) * rx, y, Math.sin(a) * rz);
};
const faceYaw = i => {
  const a = seatAngle(i);
  return Math.atan2(Math.cos(a), Math.sin(a));
};
const DECK_POS = V3(-0.95, 0.07, -0.95),
  MUCK_POS = V3(0.95, 0.07, -0.95),
  POT_POS = V3(0, 0.06, 0.72);
const betPos = i => onEllipse(i, 2.3, 1.28, 0.055);
const stackPos = i => onEllipse(i, 3.55, 2.0, 0.055, i === 0 ? 0.42 : 0.3);
const btnPos = i => onEllipse(i, 2.75, 1.58, 0.08, -0.32);
function holePos(i, k) {
  const b = onEllipse(i, 2.98, 1.7, 0.066 + k * 0.012);
  const y = faceYaw(i);
  const sp = i === 0 ? 0.56 : 0.42;
  b.x += Math.cos(y) * (k - 0.5) * sp;
  b.z += -Math.sin(y) * (k - 0.5) * sp;
  return b;
}
const boardPos = k => V3(-1.24 + k * 0.62, 0.066, -0.12);
/* outlined slots that show where the 5 shared cards will land */
const slotMeshes = [];
['FLOP', 'FLOP', 'FLOP', 'TURN', 'RIVER'].forEach((lbl, k) => {
  const tex = canvasTex(160, 224, g => {
    g.fillStyle = 'rgba(0,0,0,.12)';
    rr(g, 6, 6, 148, 212, 16);
    g.fill();
    g.strokeStyle = 'rgba(240,210,143,.8)';
    g.lineWidth = 6;
    g.setLineDash([14, 10]);
    rr(g, 6, 6, 148, 212, 16);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(240,210,143,.9)';
    g.font = 'bold 32px Georgia, serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(lbl, 80, 112);
  });
  const m = new THREE.Mesh(
    new THREE.PlaneGeometry(0.52, 0.72),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false }),
  );
  m.rotation.x = -Math.PI / 2;
  m.position.copy(boardPos(k)).setY(0.053);
  scene.add(m);
  slotMeshes.push(m);
});

/* deck prop + dealer button */
const backTex = canvasTex(256, 358, (g, w, h) => {
  g.fillStyle = '#fbf8f1';
  rr(g, 2, 2, 252, 354, 22);
  g.fill();
  g.fillStyle = '#6b1d24';
  rr(g, 16, 16, 224, 326, 12);
  g.fill();
  g.strokeStyle = 'rgba(212,173,98,.5)';
  g.lineWidth = 2;
  for (let x = -360; x < 360; x += 18) {
    g.beginPath();
    g.moveTo(16 + x, 16);
    g.lineTo(16 + x + 326, 342);
    g.stroke();
    g.beginPath();
    g.moveTo(240 - x, 16);
    g.lineTo(240 - x - 326, 342);
    g.stroke();
  }
  g.strokeStyle = '#d4ad62';
  g.lineWidth = 5;
  rr(g, 16, 16, 224, 326, 12);
  g.stroke();
  g.fillStyle = '#d4ad62';
  g.beginPath();
  g.arc(128, 179, 30, 0, 7);
  g.fill();
  g.fillStyle = '#6b1d24';
  g.font = 'bold 36px Georgia';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('H', 128, 181);
});
const edgeMat = new THREE.MeshStandardMaterial({ color: 0xf3eee2, roughness: 0.6 });
const backMat = new THREE.MeshStandardMaterial({ map: backTex, roughness: 0.55 });
const cardGeo = new THREE.BoxGeometry(0.5, 0.008, 0.7);
const deckMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.22, 0.7), [
  edgeMat,
  edgeMat,
  backMat,
  edgeMat,
  edgeMat,
  edgeMat,
]);
deckMesh.position.copy(DECK_POS).setY(0.16);
deckMesh.rotation.y = 0.6;
deckMesh.castShadow = true;
scene.add(deckMesh);
const btnTex = canvasTex(128, 128, g => {
  g.fillStyle = '#fbf8f1';
  g.beginPath();
  g.arc(64, 64, 62, 0, 7);
  g.fill();
  g.strokeStyle = '#1b1b22';
  g.lineWidth = 4;
  g.beginPath();
  g.arc(64, 64, 52, 0, 7);
  g.stroke();
  g.fillStyle = '#1b1b22';
  g.font = 'bold 30px Georgia';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('DEALER', 64, 66);
});
const dealerBtn = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.05, 32), [
  edgeMat,
  new THREE.MeshStandardMaterial({ map: btnTex }),
  edgeMat,
]);
dealerBtn.castShadow = true;
dealerBtn.position.set(0, 0.08, 0);
scene.add(dealerBtn);

/* cards */
const faceMats = {};
function faceMat(c) {
  if (faceMats[c.id]) return faceMats[c.id];
  const tex = canvasTex(256, 358, g => {
    g.fillStyle = '#fbf8f1';
    rr(g, 2, 2, 252, 354, 22);
    g.fill();
    g.strokeStyle = '#d6cdbb';
    g.lineWidth = 3;
    g.stroke();
    const col = isRed(c.s) ? '#c22a2f' : '#1b1b22';
    g.fillStyle = col;
    g.textAlign = 'center';
    const corner = () => {
      g.textBaseline = 'top';
      g.font = 'bold 62px Georgia, serif';
      g.fillText(RANK_CH[c.r], 42, 16);
      g.font = '50px serif';
      g.fillText(SUIT_CH[c.s], 42, 80);
    };
    corner();
    g.save();
    g.translate(256, 358);
    g.rotate(Math.PI);
    corner();
    g.restore();
    g.textBaseline = 'middle';
    if (c.r > 10) {
      g.font = 'bold 120px Georgia, serif';
      g.fillText(RANK_CH[c.r], 128, 160);
      g.font = '70px serif';
      g.fillText(SUIT_CH[c.s], 128, 250);
    } else {
      g.font = '150px serif';
      g.fillText(SUIT_CH[c.s], 128, 186);
    }
  });
  faceMats[c.id] = new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5, emissive: 0x000000 });
  return faceMats[c.id];
}
let cardObjs = [];
function makeCard(c) {
  const yaw = new THREE.Group();
  const mesh = new THREE.Mesh(cardGeo, [edgeMat, edgeMat, faceMat(c), backMat, edgeMat, edgeMat]);
  mesh.castShadow = true;
  mesh.rotation.z = Math.PI;
  yaw.add(mesh);
  yaw.position.copy(DECK_POS).setY(0.3);
  scene.add(yaw);
  const o = { c, yaw, mesh };
  cardObjs.push(o);
  return o;
}

/* chips */
const DENOMS = { 1000: '#d9822b', 500: '#6c3fa0', 100: '#24242b', 25: '#2e8b57', 5: '#b83228', 1: '#e8e4da' };
const chipGeo = new THREE.CylinderGeometry(0.115, 0.115, 0.04, 28);
const chipMats = {};
Object.entries(DENOMS).forEach(([v, col]) => {
  const side = canvasTex(128, 16, (g, w, h) => {
    g.fillStyle = col;
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#f4efe4';
    for (let i = 0; i < 6; i++) g.fillRect(i * 21 + 4, 0, 9, h);
  });
  const top = canvasTex(128, 128, g => {
    g.fillStyle = col;
    g.beginPath();
    g.arc(64, 64, 64, 0, 7);
    g.fill();
    g.strokeStyle = '#f4efe4';
    g.lineWidth = 10;
    g.setLineDash([14, 12]);
    g.beginPath();
    g.arc(64, 64, 54, 0, 7);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(255,255,255,.18)';
    g.beginPath();
    g.arc(64, 64, 34, 0, 7);
    g.fill();
    g.fillStyle = '#f4efe4';
    g.font = 'bold 28px Georgia';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(v, 64, 66);
  });
  const tm = new THREE.MeshStandardMaterial({ map: top, roughness: 0.5 });
  chipMats[v] = [new THREE.MeshStandardMaterial({ map: side, roughness: 0.5 }), tm, tm];
});
const SPOTS = [
  [0, 0],
  [0.25, 0.02],
  [0.12, 0.23],
  [-0.13, 0.21],
  [-0.25, -0.02],
  [0.37, 0.24],
];
function makePile(amount, opts = {}) {
  const den = opts.den || [1000, 500, 100, 25, 5, 1],
    perCol = opts.perCol || 8,
    maxCols = opts.maxCols || 4;
  const g = new THREE.Group();
  let rem = Math.round(amount);
  const cols = [];
  for (const v of den) {
    let n = Math.floor(rem / v);
    if (!n) continue;
    rem -= n * v;
    while (n > 0 && cols.length < maxCols) {
      const k = Math.min(n, perCol);
      cols.push({ v, k });
      n -= k;
    }
  }
  if (!cols.length && amount > 0) cols.push({ v: 1, k: 1 });
  cols.forEach((col, ci) => {
    const [x, z] = SPOTS[ci % SPOTS.length];
    for (let j = 0; j < col.k; j++) {
      const m = new THREE.Mesh(chipGeo, chipMats[col.v]);
      m.position.set(x + rand(-0.008, 0.008), 0.02 + j * 0.041, z + rand(-0.008, 0.008));
      m.rotation.y = Math.random() * 6.28;
      m.castShadow = true;
      g.add(m);
    }
  });
  return g;
}

/* avatars */
function cyl(a, b, r, mat) {
  const d = new THREE.Vector3().subVectors(b, a);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 0.9, d.length(), 12), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(V3(0, 1, 0), d.clone().normalize());
  return m;
}
const chairMat = new THREE.MeshStandardMaterial({ color: 0x2a140c, roughness: 0.5 });
const cushionMat = new THREE.MeshStandardMaterial({ color: 0x5a1a1e, roughness: 0.85 });
function makeChair() {
  const c = new THREE.Group();
  const seat = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.14, 0.9), cushionMat);
  seat.position.set(0, -1.05, -0.1);
  c.add(seat);
  const back = new THREE.Mesh(new THREE.BoxGeometry(1.0, 1.5, 0.14), chairMat);
  back.position.set(0, -0.25, -0.55);
  back.castShadow = true;
  c.add(back);
  const pad = new THREE.Mesh(new THREE.BoxGeometry(0.82, 1.1, 0.06), cushionMat);
  pad.position.set(0, -0.2, -0.47);
  c.add(pad);
  [
    [-0.42, -0.5],
    [0.42, -0.5],
    [-0.42, 0.28],
    [0.42, 0.28],
  ].forEach(([x, z]) => {
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.3, 0.08), chairMat);
    l.position.set(x, FLOOR + 0.65, z);
    c.add(l);
  });
  return c;
}
function makeAvatar(P) {
  const root = new THREE.Group();
  const body = new THREE.Group();
  body.position.y = -1.0;
  root.add(body);
  const shirt = new THREE.MeshStandardMaterial({ color: P.color, roughness: 0.85 });
  const skin = new THREE.MeshStandardMaterial({ color: P.skin, roughness: 0.65, emissive: 0x000000 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x151012, roughness: 0.4 });
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.5, 1.25, 24), shirt);
  torso.position.y = 0.63;
  torso.castShadow = true;
  body.add(torso);
  const sh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 24, 16), shirt);
  sh.scale.set(1.08, 0.42, 0.78);
  sh.position.y = 1.25;
  sh.castShadow = true;
  body.add(sh);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.2, 12), skin);
  neck.position.y = 1.42;
  body.add(neck);
  const headPivot = new THREE.Group();
  headPivot.position.y = 1.5;
  body.add(headPivot);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.33, 32, 24), skin);
  head.position.y = 0.3;
  head.scale.set(1, 1.08, 1);
  head.castShadow = true;
  headPivot.add(head);
  [-0.12, 0.12].forEach(x => {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.038, 10, 8), dark);
    e.position.set(x, 0.36, 0.29);
    headPivot.add(e);
  });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), skin);
  nose.position.set(0, 0.28, 0.33);
  headPivot.add(nose);
  // arms resting on the rail
  [-1, 1].forEach(sd => {
    const sP = V3(sd * 0.46, 1.22, 0.05),
      eP = V3(sd * 0.52, 0.72, 0.42),
      hP = V3(sd * 0.3, 1.28, 0.95);
    body.add(cyl(sP, eP, 0.12, shirt));
    body.add(cyl(eP, hP, 0.1, shirt));
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 10), skin);
    hand.position.copy(hP);
    hand.castShadow = true;
    body.add(hand);
  });
  // accessories so each player is easy to spot
  if (P.acc === 'bun') {
    const hair = new THREE.MeshStandardMaterial({ color: 0xb9b4b0, roughness: 0.9 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.345, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), hair);
    cap.position.y = 0.33;
    cap.rotation.x = -0.25;
    headPivot.add(cap);
    const bun = new THREE.Mesh(new THREE.SphereGeometry(0.15, 16, 12), hair);
    bun.position.set(0, 0.62, -0.2);
    headPivot.add(bun);
    const gl = new THREE.Mesh(
      new THREE.TorusGeometry(0.07, 0.012, 8, 20),
      new THREE.MeshStandardMaterial({ color: 0xd4ad62, metalness: 0.8, roughness: 0.3 }),
    );
    [-0.12, 0.12].forEach(x => {
      const g2 = gl.clone();
      g2.position.set(x, 0.36, 0.31);
      headPivot.add(g2);
    });
  }
  if (P.acc === 'shades') {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.1, 0.06), dark);
    s.position.set(0, 0.37, 0.3);
    headPivot.add(s);
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2.2),
      new THREE.MeshStandardMaterial({ color: 0x1a120e }),
    );
    hair.position.y = 0.36;
    headPivot.add(hair);
    const chain = new THREE.Mesh(
      new THREE.TorusGeometry(0.2, 0.018, 8, 30),
      new THREE.MeshStandardMaterial({ color: 0xe2b94e, metalness: 0.9, roughness: 0.25 }),
    );
    chain.rotation.x = Math.PI / 2.4;
    chain.position.set(0, 1.32, 0.12);
    body.add(chain);
  }
  if (P.acc === 'hood') {
    const hood = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.11, 10, 24, Math.PI * 1.2), shirt);
    hood.rotation.set(0, Math.PI / 2, Math.PI * 0.9);
    hood.position.set(0, 1.42, -0.2);
    body.add(hood);
    const hp = new THREE.MeshStandardMaterial({ color: 0x222226, roughness: 0.4 });
    const band = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 8, 30, Math.PI), hp);
    band.position.y = 0.32;
    headPivot.add(band);
    [-1, 1].forEach(sd => {
      const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.07, 16), hp);
      cup.rotation.z = Math.PI / 2;
      cup.position.set(sd * 0.34, 0.3, 0);
      headPivot.add(cup);
    });
  }
  if (P.acc === 'cap') {
    const cm = new THREE.MeshStandardMaterial({ color: 0x1f4e8a, roughness: 0.8 });
    const cap = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2), cm);
    cap.position.y = 0.36;
    headPivot.add(cap);
    const brim = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 20, 1, false, 0, Math.PI), cm);
    brim.position.set(0, 0.4, 0.28);
    brim.rotation.y = -Math.PI / 2;
    brim.scale.set(1, 1, 1.3);
    headPivot.add(brim);
  }
  if (P.acc === 'bowtie') {
    const bt = new THREE.MeshStandardMaterial({ color: 0xc9a45c, metalness: 0.4, roughness: 0.4 });
    [-1, 1].forEach(sd => {
      const w = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.14, 4), bt);
      w.rotation.z = (sd * Math.PI) / 2;
      w.position.set(sd * 0.07, 1.36, 0.36);
      body.add(w);
    });
    const shirt2 = new THREE.Mesh(
      new THREE.CylinderGeometry(0.16, 0.22, 0.5, 16, 1, false, -0.6, 1.2),
      new THREE.MeshStandardMaterial({ color: 0xf3efe6, roughness: 0.8 }),
    );
    shirt2.position.set(0, 1.05, 0.06);
    body.add(shirt2);
    const hair = new THREE.Mesh(
      new THREE.SphereGeometry(0.34, 24, 16, 0, Math.PI * 2, 0, Math.PI / 2.3),
      new THREE.MeshStandardMaterial({ color: 0x2b1d14 }),
    );
    hair.position.y = 0.36;
    headPivot.add(hair);
  }
  if (P.acc === 'beanie') {
    const bm = new THREE.MeshStandardMaterial({ color: 0xe0d6c6, roughness: 0.95 });
    const b = new THREE.Mesh(new THREE.SphereGeometry(0.35, 24, 16, 0, Math.PI * 2, 0, Math.PI / 1.9), bm);
    b.position.y = 0.36;
    headPivot.add(b);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(0.09, 12, 10), bm);
    pom.position.y = 0.72;
    headPivot.add(pom);
    const rim = new THREE.Mesh(
      new THREE.TorusGeometry(0.34, 0.05, 8, 30),
      new THREE.MeshStandardMaterial({ color: 0x3c8a5e }),
    );
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.4;
    headPivot.add(rim);
  }
  return { root, body, headPivot, skin };
}

/* turn ring */
const ring = new THREE.Mesh(
  new THREE.RingGeometry(0.62, 0.72, 48),
  new THREE.MeshBasicMaterial({ color: 0xf0d28f, transparent: true, opacity: 0.0, side: THREE.DoubleSide }),
);
ring.rotation.x = -Math.PI / 2;
ring.position.y = 0.058;
ring.scale.set(1.25, 1, 1);
scene.add(ring);

/* ===== Animation ===== */
const anims = new Set();
const easeIO = t => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
function animate(dur, fn, ease = easeIO) {
  const g = GEN;
  return new Promise(res => {
    const a = { t0: gameNow(), dur: Math.max(1, dur * (G.ff ? 0.05 : speedMul)), fn, ease, res };
    anims.add(a);
    const guard = () => {
      if (!anims.has(a)) return;
      if (gameNow() - a.t0 >= a.dur + 120) {
        anims.delete(a);
        a.fn(1);
        a.res();
      } else setTimeout(guard, 150);
    };
    setTimeout(guard, a.dur + 120);
  }).then(() => {
    if (g !== GEN) throw new Reset();
  });
}
function moveTo(obj, to, dur, arc = 0) {
  const from = obj.position.clone();
  return animate(dur, k => {
    obj.position.lerpVectors(from, to, k);
    obj.position.y += Math.sin(Math.PI * k) * arc;
  });
}

/* ===== Game state ===== */
const SB = 5,
  BB = 10,
  START = 1000;
const G = {
  players: [],
  button: -1,
  board: [],
  deck: [],
  currentBet: 0,
  minRaise: BB,
  handNo: 0,
  street: 'idle',
  lastAggr: null,
  raises: 0,
  acting: -1,
  xray: false,
  autoplay: false,
  muck: 0,
  potPile: null,
  focus: POT_POS.clone(),
  revealed: false,
};
const BOMB_ANTE = 50;
G.bomb = false;
G.bombNext = false;
G.bombEvery = 0;
G.bombLast = 5;
try {
  const v = +localStorage.getItem('holdem-bomb');
  if ([1, 3, 5, 10].includes(v)) {
    G.bombEvery = v;
    G.bombLast = v;
  }
} catch (e) {}
const U = { hands: 0, vpip: 0, pfr: 0, aggr: 0, passive: 0, said: new Set() };

PERSONAS.forEach((P, i) => {
  const p = {
    seat: i,
    P,
    human: !!P.human,
    stack: START,
    hole: [],
    cards: [],
    folded: false,
    allIn: false,
    bet: 0,
    contrib: 0,
    acted: false,
    last: '',
    tilt: 0,
    hot: 0,
    startStack: START,
    thinking: false,
    thought: '',
    bluffing: false,
    vol: false,
    pfr: false,
    winT: -9,
    betPile: null,
    stackPile: null,
    av: null,
    shown: false,
  };
  if (!P.human) {
    const chair = makeChair();
    chair.position.copy(onEllipse(i, 5.0, 3.35, 0));
    chair.lookAt(0, 0, 0);
    scene.add(chair);
    p.chair = chair;
  }
  if (!p.human) {
    p.av = makeAvatar(P);
    p.av.root.position.copy(onEllipse(i, 5.0, 3.35, 0));
    p.av.root.lookAt(0, 0, 0);
    scene.add(p.av.root);
  }
  p.sitting = true;
  G.players.push(p);
});
const HUMAN = G.players[0];
const next = i => {
  let j = i;
  for (let k = 0; k < 6; k++) {
    j = (j + 1) % 6;
    if (G.players[j].sitting) return j;
  }
  return j;
};
const inHand = () => G.players.filter(p => !p.folded);
const canAct = () => G.players.filter(p => !p.folded && !p.allIn);
const potTotal = () => G.players.reduce((s, p) => s + p.contrib, 0);
const potCollected = () => G.players.reduce((s, p) => s + p.contrib - p.bet, 0);
const nm = p => (p.human ? 'You' : p.P.name);
const vb = (p, a, b) => (p.human ? a : b);

/* ===== Labels (HTML projected over 3D) ===== */
const labelsEl = $('#labels');
G.players.forEach(p => {
  if (!p.human) {
    const el = document.createElement('div');
    el.className = 'seat';
    el.style.setProperty('--pc', p.P.css);
    el.innerHTML = `<div class="bubble" hidden></div><div class="plate"><div class="prow"><span class="pname">${p.P.name}</span><span class="pos" hidden></span></div><div class="pstyle">${p.P.style}</div><div class="pmeta"><span class="stk">$1,000</span><span class="act-badge"></span><span class="mood" hidden></span><span class="dots" hidden><i></i><i></i><i></i></span></div><div class="xray" hidden><span class="xc"></span><span class="thought" hidden></span></div></div>`;
    labelsEl.appendChild(el);
    p.el = el;
  }
  const b = document.createElement('div');
  b.className = 'betlbl';
  b.hidden = true;
  labelsEl.appendChild(b);
  p.betEl = b;
});
const potEl = document.createElement('div');
potEl.className = 'betlbl potlbl';
potEl.hidden = true;
labelsEl.appendChild(potEl);

function roleOf(i) {
  if (G.button < 0 || !G.players[i].sitting) return '';
  const order = [];
  let j = G.button;
  do {
    order.push(j);
    j = next(j);
  } while (j !== G.button && order.length < 6);
  const n = order.length,
    k = order.indexOf(i);
  if (n === 2) return k === 0 ? 'BTN' : 'BB';
  if (k === 0) return 'BTN';
  if (k === 1) return 'SB';
  if (k === 2) return 'BB';
  if (k === n - 1) return 'CO';
  if (k === n - 2) return 'MP';
  return 'UTG';
}
function roleText(i) {
  return {
    BTN: 'Dealer button: the best seat, you act last after the flop',
    SB: 'Small blind: you act first after the flop',
    BB: 'Big blind: you act last before the flop, first after',
    UTG: 'Early position: you act first before the flop, so play tight',
    MP: 'Middle position',
    CO: 'Cutoff: late position, a good seat',
  }[roleOf(i)];
}

function updateSeat(p) {
  if (p.human) {
    $('#myStack').textContent = fmt(p.stack);
  } else {
    const el = p.el;
    el.hidden = !p.sitting;
    el.querySelector('.stk').textContent = fmt(p.stack);
    const ab = el.querySelector('.act-badge');
    ab.textContent = p.last;
    ab.className = 'act-badge ' + (p.last || '');
    el.classList.toggle('folded', p.folded && G.street !== 'idle');
    el.classList.toggle('acting', G.acting === p.seat);
    el.querySelector('.dots').hidden = !p.thinking;
    const mood = el.querySelector('.mood');
    if (p.tilt > 0.4) {
      mood.hidden = false;
      mood.className = 'mood tilt';
      mood.textContent = 'On tilt';
    } else if (p.hot > 0.6) {
      mood.hidden = false;
      mood.className = 'mood hot';
      mood.textContent = 'Running hot';
    } else mood.hidden = true;
    const pos = el.querySelector('.pos');
    const r = G.button >= 0 ? roleOf(p.seat) : '';
    if (r === 'BTN' || (!G.bomb && (r === 'SB' || r === 'BB'))) {
      pos.hidden = false;
      pos.textContent = r === 'BTN' ? 'D' : r;
      pos.className = 'pos' + (r === 'BTN' ? ' d' : '');
    } else pos.hidden = true;
    const xr = el.querySelector('.xray');
    if (G.xray && p.hole.length && !p.folded) {
      xr.hidden = false;
      xr.querySelector('.xc').innerHTML = p.hole.map(miniHTML).join('');
      const th = xr.querySelector('.thought');
      th.textContent = p.thought || '';
      th.hidden = !(p.thought && G.lastBot === p.seat);
    } else xr.hidden = true;
  }
  p.betEl.hidden = !(p.bet > 0);
  p.betEl.textContent = fmt(p.bet);
}
function updateAll() {
  G.players.forEach(updateSeat);
  const pc = potCollected();
  potEl.hidden = !(pc > 0);
  potEl.textContent = (G.bomb ? 'Bomb pot ' : 'Pot ') + fmt(pc);
  potEl.classList.toggle('bomb', G.bomb);
}

const bubbleTimers = {};
function say(p, kind, prob = 1) {
  if (p.human || Math.random() > prob) return;
  const arr = (LINES[p.P.key] || {})[kind];
  if (!arr || !arr.length) return;
  const txt = pick(arr);
  const b = p.el.querySelector('.bubble');
  b.textContent = txt;
  b.hidden = false;
  clearTimeout(bubbleTimers[p.seat]);
  bubbleTimers[p.seat] = setTimeout(() => (b.hidden = true), 2900 * Math.max(speedMul, 0.7));
  log(`<b style="color:${p.P.css}">${p.P.name}:</b> “${esc(txt)}”`, 'chat');
}

/* ===== Log + coach ===== */
function log(html, cls = '') {
  const li = document.createElement('li');
  li.className = cls;
  li.innerHTML = html;
  const ol = $('#logList');
  ol.appendChild(li);
  while (ol.children.length > 120) ol.removeChild(ol.firstChild);
  const L = $('#log');
  L.scrollTop = L.scrollHeight;
}
const STAGES = {
  pre: {
    i: 0,
    title: 'Pre-flop',
    text: 'Everyone has 2 private cards. Betting starts with the player to the left of the big blind and moves clockwise. To stay in, you must at least match the biggest bet so far.',
  },
  flop: {
    i: 1,
    title: 'The flop',
    text: 'Three shared cards are dealt face up in the middle. Everyone combines them with their own 2 cards. A new betting round starts with the first player left of the dealer button.',
  },
  turn: {
    i: 2,
    title: 'The turn',
    text: 'A fourth shared card. Another betting round. Bets usually get bigger from here.',
  },
  river: { i: 3, title: 'The river', text: 'The fifth and final shared card. Last chance to bet.' },
  bomb: {
    i: 0,
    title: 'Bomb pot',
    text: 'No blinds and no betting before the flop this hand: everyone put in the same ante, so the pot is already big. The first betting round happens after the flop and starts left of the dealer button.',
  },
  showdown: {
    i: 4,
    title: 'Showdown',
    text: 'Players still in the hand turn over their cards. The best 5-card hand, using any mix of their 2 cards and the 5 shared cards, wins the pot.',
  },
};
function setStage(key, extra) {
  const s = STAGES[key];
  $('#stageTitle').textContent = s.title;
  $('#stageText').textContent = (extra ? extra + ' ' : '') + s.text;
  [...$('#track').children].forEach((el, i) => {
    el.className = i < s.i ? 'done' : i === s.i ? 'now' : '';
  });
  [...$('#trackLabels').children].forEach((el, i) => {
    el.className = i === s.i ? 'now' : '';
  });
}
function lastMove(html) {
  $('#lastMove').innerHTML = html;
}

function userRead() {
  if (U.hands < 4)
    return {
      known: false,
      label: 'Unknown',
      text: "The other players haven't figured you out yet. They watch how often you play and raise, and adjust.",
    };
  const vp = U.vpip / U.hands,
    af = U.aggr / Math.max(1, U.aggr + U.passive);
  const loose = vp > 0.42,
    tight = vp < 0.24,
    aggressive = af > 0.5 && U.aggr >= 3,
    passive = af < 0.25;
  let label = 'Balanced',
    text = 'You mix it up. The table has no clear read on you, which is a good thing.';
  if (tight && aggressive) {
    label = 'Tight and aggressive';
    text = 'You play few hands but bet them hard. The others respect your raises and fold more often.';
  } else if (loose && aggressive) {
    label = 'Loose and aggressive';
    text = 'You play lots of hands and bet a lot. Dev and Yuki now call your bets with weaker hands.';
  } else if (tight && passive) {
    label = 'Tight and careful';
    text =
      'You rarely play and rarely raise. The others try to steal your blinds and fold quickly when you finally bet.';
  } else if (loose && passive) {
    label = 'Loose and passive';
    text = 'You call a lot but rarely raise. The others bet into you for value and bluff you less.';
  } else if (aggressive) {
    label = 'Aggressive';
    text = 'You raise a lot. Expect more calls from the sharper players.';
  } else if (tight) {
    label = 'Tight';
    text = 'You wait for good hands. Your raises get respect.';
  }
  return { known: true, label, text, vp, af, loose, tight, aggressive, passive };
}
function updateRead() {
  const r = userRead();
  $('#readLabel').textContent = r.label;
  $('#readText').textContent =
    r.text + (r.known ? ` (You've played ${Math.round(r.vp * 100)}% of hands.)` : '');
}

function handNow(p) {
  if (!p.hole.length) return '–';
  if (G.board.length < 3) return holeDesc(p.hole);
  const ev = evaluate(p.hole.concat(G.board));
  const d = draws(p.hole, G.board);
  return describe(ev) + (d.length ? ' + ' + d.join(' + ') : '');
}
function renderMyCards() {
  const h = HUMAN.hole;
  const mine =
    h.length === 2 && HUMAN.cards.length === 2 && HUMAN.cards.every(o => o.up)
      ? h.map(c => cardHTML(c, HUMAN.hl && HUMAN.hl.has(c.id) ? 'hl' : '')).join('')
      : '<span class="pc back"></span><span class="pc back"></span>';
  const bd =
    G.board.map(c => cardHTML(c, G.hl && G.hl.has(c.id) ? 'hl' : '')).join('') +
    '<span class="pc slot"></span>'.repeat(5 - G.board.length);
  $('#myCards').innerHTML =
    `<div class="cg"><span class="cg-l">Your cards</span><div class="cg-c">${mine}</div></div><span class="cdiv"></span><div class="cg"><span class="cg-l">Table</span><div class="cg-c">${bd}</div></div>`;
  $('#myHandName').textContent = HUMAN.folded
    ? 'Folded'
    : h.length && HUMAN.cards.every(o => o.up)
      ? handNow(HUMAN)
      : 'Waiting for cards';
  $('#myStack').textContent = fmt(HUMAN.stack);
  $('#myRole').textContent =
    G.button >= 0
      ? G.bomb && roleOf(0) !== 'BTN'
        ? 'Bomb pot'
        : {
            BTN: 'Dealer button',
            SB: 'Small blind',
            BB: 'Big blind',
            UTG: 'Early position',
            MP: 'Middle position',
            CO: 'Cutoff',
          }[roleOf(0)]
      : '';
  if ($('#myRole').textContent) $('#myRole').textContent = ' · ' + $('#myRole').textContent;
}
function updateCoachHand() {
  const box = $('#adviceBox');
  if (!HUMAN.hole.length) {
    box.hidden = true;
    return;
  }
  box.hidden = false;
  $('#advHole').innerHTML = HUMAN.hole.map(miniHTML).join(' ');
  $('#advMade').textContent = HUMAN.folded
    ? 'You folded'
    : G.board.length
      ? handNow(HUMAN)
      : holeDesc(HUMAN.hole);
  $('#advPos').textContent =
    roleOf(0) === 'BTN'
      ? 'Dealer button'
      : { SB: 'Small blind', BB: 'Big blind', UTG: 'Early', MP: 'Middle', CO: 'Cutoff' }[roleOf(0)];
  if (HUMAN.folded) {
    $('#advEq').textContent = '–';
    $('#advEqBar').style.width = '0%';
    $('#recRow').hidden = true;
    $('#advOdds').textContent =
      "You are out of this hand. Watch how it plays out. Turn on X-ray in the More menu to see everyone's cards.";
    return;
  }
  const n = inHand().length - 1;
  const eq = equity(HUMAN.hole, G.board, n, 600);
  $('#advEq').textContent = `${pct(eq)} vs ${n} player${n === 1 ? '' : 's'}`;
  $('#advEqBar').style.width = pct(eq);
}
function coachAdvice(p) {
  const n = inHand().length - 1,
    eq = equity(p.hole, G.board, n, 900),
    rel = eq * (n + 1);
  const toCall = G.currentBet - p.bet,
    pot = potTotal(),
    potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
  const canRaise = G.players.some(q => q !== p && !q.folded && !q.allIn) && p.stack > toCall;
  let rec,
    why,
    raiseTo = null;
  const pre = G.board.length === 0;
  if (pre) {
    const tier = rel > 2.1 ? 'premium' : rel > 1.55 ? 'strong' : rel > 1.15 ? 'playable' : 'weak';
    const facingRaise = G.currentBet > BB;
    if (tier === 'premium') {
      rec = 'raise';
      raiseTo = facingRaise ? G.currentBet * 3 : BB * 3;
      why = `${holeDesc(p.hole)} is one of the best starting hands. Raise to build the pot while you're likely ahead.`;
    } else if (tier === 'strong') {
      if (!facingRaise) {
        rec = 'raise';
        raiseTo = BB * 3;
        why = `${holeDesc(p.hole)} is a strong hand. Raising first takes control and pushes out weaker hands.`;
      } else if (toCall <= p.stack * 0.15) {
        rec = 'call';
        why = 'Strong enough to see a flop against a raise, but not strong enough to re-raise.';
      } else {
        rec = 'fold';
        why = 'A good hand, but this raise costs a big piece of your chips. Wait for a better spot.';
      }
    } else if (tier === 'playable') {
      if (toCall === 0) {
        rec = 'check';
        why = 'Nobody raised, so you can see the flop for free. Take it.';
      } else if (!facingRaise) {
        rec = 'call';
        why = 'Playable, and it\'s cheap to see the flop. Calling just the big blind is called "limping".';
      } else if (toCall <= BB * 3 && n >= 2) {
        rec = 'call';
        why =
          'A speculative hand. Calling a small raise is fine when several players are in, because you could win a big pot if the flop hits you.';
      } else {
        rec = 'fold';
        why = 'Decent, but not worth calling a raise. Good players fold most hands before the flop.';
      }
    } else {
      if (toCall === 0) {
        rec = 'check';
        why = 'Weak hand, but checking costs nothing. See the flop for free.';
      } else {
        rec = 'fold';
        why = `${holeDesc(p.hole)} is a weak starting hand. Folding hands like this is how good players save money.`;
      }
    }
  } else {
    if (eq > 0.62 || (rel > 2 && eq > 0.45)) {
      rec = 'raise';
      raiseTo = G.currentBet === 0 ? pot * 0.66 : G.currentBet * 2.5;
      why = `You're probably ahead with ${describe(evaluate(p.hole.concat(G.board)))}. ${G.currentBet === 0 ? 'Bet' : 'Raise'} so worse hands pay you.`;
    } else if (toCall === 0) {
      rec = 'check';
      why =
        eq > 0.35
          ? 'Medium strength. Checking keeps the pot small and lets you see the next card for free.'
          : 'Not much here yet. Checking is free.';
    } else if (eq >= potOdds + 0.04) {
      rec = 'call';
      why = `To call ${fmt(toCall)} into a pot of ${fmt(pot)}, you need to win at least ${pct(potOdds)} of the time. You're at about ${pct(eq)}, so calling pays off over time.`;
    } else {
      rec = 'fold';
      why = `To call ${fmt(toCall)} you'd need to win ${pct(potOdds)} of the time, but you're only at about ${pct(eq)}. Folding saves chips.`;
    }
  }
  if (rec === 'raise' && !canRaise) rec = toCall > 0 ? 'call' : 'check';
  if (rec === 'check' && toCall > 0) rec = 'call';
  if (rec === 'raise') {
    const minTo = G.currentBet + G.minRaise;
    raiseTo = clamp(round5(raiseTo), Math.min(minTo, p.bet + p.stack), p.bet + p.stack);
  }
  return { eq, n, toCall, pot, potOdds, rec, why, raiseTo };
}
function showAdvice(A) {
  $('#advEq').textContent = `${pct(A.eq)} vs ${A.n} player${A.n === 1 ? '' : 's'}`;
  $('#advEqBar').style.width = pct(A.eq);
  $('#advOddsMark').style.left = pct(A.potOdds);
  $('#advOdds').textContent =
    A.toCall > 0
      ? `It costs ${fmt(A.toCall)} to call. The gold line marks ${pct(A.potOdds)}: the win chance you need for a call to pay off. Green past the line means calling is profitable.`
      : 'Nobody has bet, so you can check for free.';
  const label = { raise: G.currentBet === 0 ? 'Bet' : 'Raise', call: 'Call', check: 'Check', fold: 'Fold' }[
    A.rec
  ];
  $('#recRow').hidden = !G.hints;
  $('#recChip').textContent = label + (A.rec === 'raise' ? ' ' + fmt(A.raiseTo) : '');
  $('#recChip').className = 'rec-chip ' + A.rec;
  $('#recWhy').textContent = A.why;
}

/* ===== Visual table ops ===== */
function setBetPile(p) {
  if (p.betPile) {
    scene.remove(p.betPile);
    p.betPile = null;
  }
  if (p.bet > 0) {
    p.betPile = makePile(p.bet);
    p.betPile.position.copy(betPos(p.seat));
    scene.add(p.betPile);
  }
}
function setStackPile(p) {
  if (p.stackPile) scene.remove(p.stackPile);
  p.stackPile = null;
  if (!p.sitting) return;
  p.stackPile = makePile(p.stack, { den: [100, 25, 5], perCol: 10, maxCols: 5 });
  p.stackPile.position.copy(stackPos(p.seat));
  scene.add(p.stackPile);
}
function setPotPile() {
  if (G.potPile) {
    scene.remove(G.potPile);
    G.potPile = null;
  }
  const v = potCollected();
  if (v > 0) {
    G.potPile = makePile(v, { maxCols: 6 });
    G.potPile.position.copy(POT_POS);
    scene.add(G.potPile);
  }
}
async function dealTo(o, pos, yaw, up, dur = 260) {
  o.yaw.rotation.y = yaw + rand(-0.6, 0.6);
  const y0 = o.yaw.rotation.y;
  await animate(dur, k => {
    o.yaw.position.lerpVectors(DECK_POS.clone().setY(0.3), pos, k);
    o.yaw.position.y += Math.sin(Math.PI * k) * 0.25;
    o.yaw.rotation.y = y0 + (yaw - y0) * k;
  });
  if (up) await flip(o, true);
}
async function flip(o, up, toYaw) {
  const z0 = o.mesh.rotation.z,
    z1 = up ? 0 : Math.PI,
    y0 = o.yaw.rotation.y,
    y1 = toYaw === undefined ? y0 : toYaw,
    base = o.yaw.position.y;
  await animate(260, k => {
    o.mesh.rotation.z = z0 + (z1 - z0) * k;
    o.yaw.rotation.y = y0 + (y1 - y0) * k;
    o.yaw.position.y = base + Math.sin(Math.PI * k) * 0.25;
  });
  o.up = up;
}
async function revealHand(p) {
  if (p.shown) return;
  p.shown = true;
  await Promise.all(p.cards.map(o => flip(o, true, 0)));
}
async function collectBets() {
  const piles = G.players.filter(p => p.betPile);
  if (piles.length) {
    await Promise.all(piles.map(p => moveTo(p.betPile, POT_POS, 380, 0.2)));
  }
  G.players.forEach(p => {
    p.bet = 0;
    setBetPile(p);
  });
  setPotPile();
  updateAll();
}
async function clearTable() {
  const objs = cardObjs;
  cardObjs = [];
  objs.forEach(o => o.mesh.material[2].emissive.setHex(0));
  await Promise.all(objs.map((o, i) => moveTo(o.yaw, DECK_POS.clone().setY(0.3 + i * 0.004), 300, 0.3)));
  objs.forEach(o => scene.remove(o.yaw));
  G.players.forEach(p => {
    p.cards = [];
    p.hl = null;
  });
}

/* ===== Actions ===== */
function putIn(p, amt) {
  amt = Math.min(amt, p.stack);
  p.stack -= amt;
  p.bet += amt;
  p.contrib += amt;
  if (p.stack === 0) p.allIn = true;
  setBetPile(p);
  setStackPile(p);
}
function applyAction(p, a) {
  const toCall = G.currentBet - p.bet;
  let type = a.type,
    amount = a.amount;
  if (type === 'check' && toCall > 0) type = 'call';
  if (type === 'call' && toCall === 0) type = 'check';
  if (type === 'raise') {
    const maxTo = p.bet + p.stack;
    let to = Math.round(Math.min(amount, maxTo));
    if (to <= G.currentBet) type = toCall > 0 ? 'call' : 'check';
    else {
      const minTo = G.currentBet + G.minRaise;
      if (to < minTo) to = Math.min(minTo, maxTo);
      amount = to;
    }
  }
  const wasOpen = G.currentBet === 0;
  let label = '';
  if (type === 'fold') {
    p.folded = true;
    label = 'Fold';
    foldCards(p);
  } else if (type === 'check') {
    label = 'Check';
  } else if (type === 'call') {
    putIn(p, toCall);
    label = p.allIn ? 'All-in' : 'Call';
    amount = p.bet;
  } else if (type === 'raise') {
    const inc = amount - G.currentBet;
    if (inc >= G.minRaise) G.minRaise = inc;
    putIn(p, amount - p.bet);
    G.currentBet = Math.max(G.currentBet, p.bet);
    G.raises++;
    G.lastAggr = p;
    G.players.forEach(q => {
      if (q !== p && !q.folded && !q.allIn) q.acted = false;
    });
    label = p.allIn ? 'All-in' : wasOpen ? 'Bet' : 'Raise';
  }
  p.acted = true;
  p.last = label;
  return { type, amount: p.bet, label, toCall, wasOpen };
}
async function foldCards(p) {
  for (const o of p.cards) {
    G.muck++;
    const to = MUCK_POS.clone().add(V3(rand(-0.08, 0.08), G.muck * 0.009, rand(-0.08, 0.08)));
    const z0 = o.mesh.rotation.z;
    const from = o.yaw.position.clone();
    const y0 = o.yaw.rotation.y,
      y1 = rand(-1, 1);
    animate(320, k => {
      o.yaw.position.lerpVectors(from, to, k);
      o.yaw.position.y += Math.sin(Math.PI * k) * 0.2;
      o.mesh.rotation.z = z0 + (Math.PI - z0) * k;
      o.yaw.rotation.y = y0 + (y1 - y0) * k;
    }).catch(() => {});
  }
}
function describeAction(p, r) {
  const n = nm(p);
  const c = p.human ? '' : `<b style="color:${p.P.css}">${n}</b>`;
  const who = p.human ? '<b>You</b>' : c;
  switch (r.label) {
    case 'Fold':
      return {
        s: `${who} ${vb(p, 'fold', 'folds')}.`,
        l: `${who} folded: ${vb(p, 'you give', 'gives')} up the hand. Chips already bet stay in the pot.`,
      };
    case 'Check':
      return {
        s: `${who} ${vb(p, 'check', 'checks')}.`,
        l: `${who} checked: stayed in without betting. You can only check when nobody has bet this round.`,
      };
    case 'Call':
      return {
        s: `${who} ${vb(p, 'call', 'calls')} ${fmt(r.toCall)}.`,
        l: `${who} called ${fmt(r.toCall)}: matched the current bet to stay in the hand.`,
      };
    case 'Bet':
      return {
        s: `${who} ${vb(p, 'bet', 'bets')} ${fmt(r.amount)}.`,
        l: `${who} bet ${fmt(r.amount)}: the first chips in this round. Everyone else must call ${fmt(r.amount)}, raise, or fold.`,
      };
    case 'Raise':
      return {
        s: `${who} ${vb(p, 'raise', 'raises')} to ${fmt(r.amount)}.`,
        l: `${who} raised to ${fmt(r.amount)}: made it more expensive to stay in. Everyone else now needs ${fmt(r.amount)} in front of them to continue.`,
      };
    case 'All-in':
      return {
        s: `${who} ${vb(p, 'go', 'goes')} <b>all-in</b> (${fmt(r.amount)}).`,
        l: `${who} went all-in: bet every chip. ${vb(p, 'You', 'They')} can't be forced out of the hand now, but can only win as much as ${vb(p, 'you', 'they')} put in from each opponent.`,
      };
  }
  return { s: '', l: '' };
}

/* ===== Bots ===== */
function thinkDelay(P, eq, po) {
  const close = 1 - Math.min(1, Math.abs(eq - po) * 3);
  return 450 + P.think * 550 + close * 900 * P.think + Math.random() * 600;
}
function botDecide(p) {
  const P = p.P,
    opps = inHand().filter(q => q !== p),
    n = opps.length;
  const eq = equity(p.hole, G.board, n, 320),
    rel = eq * (n + 1);
  const toCall = G.currentBet - p.bet,
    pot = potTotal(),
    potOdds = toCall > 0 ? toCall / (pot + toCall) : 0;
  const pre = G.board.length === 0;
  const canRaise = G.players.some(q => q !== p && !q.folded && !q.allIn) && p.stack > toCall;
  const tilt = p.tilt,
    hot = p.hot;
  let playRel = P.playRel - tilt * 0.45 - hot * 0.12,
    raiseRel = P.raiseRel - tilt * 0.35,
    aggr = clamp(P.aggr + tilt * 0.25, 0, 0.95),
    bluff = P.bluff + tilt * 0.18,
    callF = P.callF - tilt * 0.2;
  const read = userRead();
  let note = '';
  if (G.lastAggr && G.lastAggr.human && read.known && P.adapt > 0.25) {
    if (read.aggressive) {
      callF -= 0.25 * P.adapt;
      note = " You bet a lot, so I'll call lighter.";
    } else if (read.tight) {
      callF += 0.25 * P.adapt;
      note = ' You only bet good hands. Respect.';
    }
  }
  if (!HUMAN.folded && read.known && (read.passive || read.tight) && n <= 2) bluff += 0.12 * P.adapt;
  const s = rel * (1 + (Math.random() * 2 - 1) * P.noise);
  const hd = pre ? holeDesc(p.hole) : handNow(p);
  const mk = (type, amount, reason) => {
    if (type === 'raise' && !canRaise) type = toCall > 0 ? 'call' : 'check';
    p.bluffing = type === 'raise' && rel < 0.85;
    return {
      type,
      amount,
      delay: thinkDelay(P, eq, potOdds),
      thought: `${hd}. ~${pct(eq)} to win vs ${n}. ${reason}${note}${tilt > 0.4 ? ' Still steaming about that last pot.' : ''}`,
    };
  };
  const stackBB = (p.stack + p.bet) / BB,
    allTo = p.bet + p.stack;
  if (pre && stackBB < 12) {
    if (s > playRel + 0.2) return mk('raise', allTo, 'Short on chips. Shove time.');
    if (toCall === 0) return mk('check', 0, 'Free look.');
    if (s > playRel + 0.5) return mk('call', 0, 'Short, but good enough to call.');
    return mk('fold', 0, 'Short stack. Waiting for a better hand.');
  }
  if (pre) {
    const facing = G.raises;
    if (facing === 0) {
      if (s > playRel + 0.35 && Math.random() < aggr + 0.15) {
        const limpers = G.players.filter(q => q !== p && q.bet === BB && q.acted && !q.folded).length;
        return mk('raise', round5(BB * rand(2.5, 3.5) + BB * limpers), 'Good hand. Raising first.');
      }
      if (s > playRel)
        return toCall === 0
          ? mk('check', 0, "Free flop, I'll take it.")
          : mk('call', 0, 'Playable. Cheap to see a flop.');
      if (toCall === 0) return mk('check', 0, 'Weak, but checking is free.');
      const late = ['BTN', 'CO'].includes(roleOf(p.seat));
      if (late && Math.random() < bluff * 1.6 && inHand().length <= 4)
        return mk('raise', round5(BB * 3), "Weak hand, but I'll try to steal the blinds.");
      return mk('fold', 0, 'Not worth playing.');
    } else {
      if (s > raiseRel + 0.35 * (facing - 1) && Math.random() < aggr)
        return mk('raise', round5(G.currentBet * rand(2.6, 3.2)), 'Very strong. Re-raising.');
      if (s > playRel + 0.4 * facing || (toCall <= BB * 2 && s > playRel))
        return mk('call', 0, 'Good enough to call the raise.');
      if (Math.random() < bluff * 0.3)
        return mk('raise', round5(G.currentBet * 3), "Re-raise bluff. Let's see if they fold.");
      return mk('fold', 0, "Someone raised and my hand isn't good enough.");
    }
  }
  const strong = s > raiseRel,
    decent = s > 1.05,
    street = G.board.length;
  if (toCall === 0) {
    if (strong) {
      if (Math.random() < P.slow && street < 5) return mk('check', 0, 'Very strong. Checking to set a trap.');
      return mk(
        'raise',
        round5(pot * (s > raiseRel + 0.8 ? rand(0.7, 1) : rand(0.5, 0.75))),
        'Strong hand. Betting for value.',
      );
    }
    if (decent && Math.random() < aggr * 0.55)
      return mk('raise', round5(pot * rand(0.4, 0.6)), 'Probably ahead. Small bet to protect it.');
    if (Math.random() < bluff * (n <= 2 ? 1.4 : 0.5))
      return mk('raise', round5(pot * rand(0.5, 0.8)), 'Not much, but nobody showed strength. Bluffing.');
    return mk('check', 0, decent ? 'Decent hand. Keeping the pot small.' : 'Nothing yet. Check.');
  }
  const betFrac = toCall / Math.max(pot - toCall, 1);
  const eqAdj = eq * (P.callF < 0.7 ? 1 : 1 - 0.12 * Math.min(betFrac, 1.5));
  if (strong && Math.random() < aggr * (P.slow > 0.3 ? 1.25 : 1))
    return mk(
      'raise',
      round5(G.currentBet + pot * rand(0.6, 1)),
      P.slow > 0.3 ? 'The trap is sprung. Raising!' : 'Strong. Raising for value.',
    );
  if (eqAdj > potOdds * callF + 0.02) return mk('call', 0, `Calling needs ${pct(potOdds)}. Worth it.`);
  if (Math.random() < bluff * 0.3 && n === 1 && street < 5)
    return mk('raise', round5(G.currentBet * 2.5), 'Bluff raise. Representing a big hand.');
  return mk('fold', 0, `Calling needs ${pct(potOdds)} and I'm not there. Folding.`);
}

/* ===== Human input ===== */
let humanResolve = null,
  curAdvice = null;
const btnFold = $('#bFold'),
  btnCall = $('#bCall'),
  btnRaise = $('#bRaise'),
  range = $('#raiseRange');
function setControls(on) {
  $('#actionbar').classList.toggle('myturn', on);
  [btnFold, btnCall, btnRaise, range, ...document.querySelectorAll('.presets button')].forEach(
    b => (b.disabled = !on),
  );
  [btnFold, btnCall, btnRaise].forEach(b => b.classList.remove('pick'));
}
function updateRaiseLabel() {
  const v = +range.value;
  const all = v >= HUMAN.bet + HUMAN.stack;
  btnRaise.innerHTML =
    (all ? 'All-in ' + fmt(v) : (G.currentBet === 0 ? 'Bet ' : 'Raise to ') + fmt(v)) + '<kbd>R</kbd>';
}
function humanTurn(p) {
  return new Promise(async res => {
    const A = coachAdvice(p);
    curAdvice = A;
    showAdvice(A);
    const toCall = A.toCall;
    const canRaise = G.players.some(q => q !== p && !q.folded && !q.allIn) && p.stack > toCall;
    if (G.autoplay) {
      $('#turnStatus').innerHTML = '<b>Your turn.</b> The coach is choosing…';
      try {
        await wait(2000);
      } catch (e) {
        return;
      }
      if (G.autoplay) return res({ type: A.rec, amount: A.raiseTo, coach: true });
    }
    humanResolve = res;
    setControls(true);
    btnFold.disabled = toCall === 0;
    btnFold.title = toCall === 0 ? 'Checking is free, so there is no reason to fold.' : '';
    btnCall.innerHTML =
      (toCall === 0 ? 'Check' : toCall >= p.stack ? 'Call all-in ' + fmt(p.stack) : 'Call ' + fmt(toCall)) +
      '<kbd>C</kbd>';
    const minTo = Math.min(G.currentBet + G.minRaise, p.bet + p.stack),
      maxTo = p.bet + p.stack;
    range.min = minTo;
    range.max = maxTo;
    range.step = 5;
    range.value = G.hints && A.rec === 'raise' ? A.raiseTo : minTo;
    btnRaise.disabled = !canRaise;
    range.disabled = !canRaise;
    document.querySelectorAll('.presets button').forEach(b => (b.disabled = !canRaise));
    updateRaiseLabel();
    if (G.hints)
      ({ fold: btnFold, check: btnCall, call: btnCall, raise: btnRaise })[A.rec].classList.add('pick');
    $('#turnStatus').innerHTML =
      `<b>Your turn.</b> ${toCall > 0 ? `It costs ${fmt(toCall)} to stay in.` : 'You can check for free or bet.'}`;
  });
}
function humanDo(a) {
  if (!humanResolve) return;
  const r = humanResolve;
  humanResolve = null;
  setControls(false);
  $('#turnStatus').textContent = '';
  r(a);
}
btnFold.onclick = () => humanDo({ type: 'fold' });
btnCall.onclick = () => humanDo({ type: 'call' });
btnRaise.onclick = () => humanDo({ type: 'raise', amount: +range.value });
range.oninput = updateRaiseLabel;
document.querySelectorAll('.presets button').forEach(
  b =>
    (b.onclick = () => {
      const p = HUMAN,
        toCall = G.currentBet - p.bet,
        pot = potTotal() + toCall,
        minTo = +range.min,
        maxTo = +range.max;
      const v = { min: minTo, half: G.currentBet + pot / 2, pot: G.currentBet + pot, all: maxTo }[
        b.dataset.p
      ];
      range.value = clamp(round5(v), minTo, maxTo);
      if (b.dataset.p === 'all') range.value = maxTo;
      updateRaiseLabel();
    }),
);

/* ===== Turn flow ===== */
function setTurnRing(p) {
  if (!p) {
    ring.material.opacity = 0;
    return;
  }
  ring.position.copy(onEllipse(p.seat, 2.98, 1.7, 0.058));
  ring.rotation.z = faceYaw(p.seat);
  ring.material.opacity = 0.8;
}
async function takeTurn(p) {
  G.acting = p.seat;
  setTurnRing(p);
  G.focus = p.human ? V3(0, 0.9, 3.3) : p.av.root.position.clone().setY(1.0);
  updateAll();
  let a;
  if (p.human) {
    a = await humanTurn(p);
  } else {
    lastMove(`Waiting for <b style="color:${p.P.css}">${p.P.name}</b> (${p.P.style})…`);
    $('#turnStatus').innerHTML = `<b>${p.P.name}</b> is thinking…`;
    p.thinking = true;
    updateSeat(p);
    await wait(250);
    a = botDecide(p);
    p.thought = a.thought;
    G.lastBot = p.seat;
    await wait(a.delay);
    p.thinking = false;
  }
  const r = applyAction(p, a);
  const d = describeAction(p, r);
  log(d.s + (a.coach ? ' <span style="color:var(--muted)">(coach)</span>' : ''));
  lastMove(d.l);
  if (p.human) {
    if (G.street === 'pre' && (r.type === 'call' || r.type === 'raise')) p.vol = true;
    if (G.street === 'pre' && r.type === 'raise') p.pfr = true;
    if (r.type === 'raise') U.aggr++;
    else if (r.type === 'call') U.passive++;
    $('#turnStatus').textContent = '';
  } else {
    if (r.label === 'All-in') say(p, 'allin', 0.7);
    else if (r.type === 'raise') say(p, 'raise', 0.25);
    else if (r.type === 'fold') say(p, 'fold', 0.08);
  }
  if (p.human && r.type === 'fold' && inHand().length > 1 && !G.ff) $('#skipBtn').hidden = false;
  if (p.human && a.coach && curAdvice)
    log(`<span style="color:var(--muted)">Coach: ${esc(curAdvice.why)}</span>`, 'lesson');
  G.acting = -1;
  p.thinking = false;
  updateAll();
  renderMyCards();
  if (p.human) updateCoachHand();
  await wait(p.human ? 250 : 750);
}
function roundDone() {
  const act = canAct();
  if (act.length === 0) return true;
  if (act.length === 1) return act[0].bet >= G.currentBet;
  return act.every(p => p.acted && p.bet === G.currentBet);
}
async function bettingRound(start) {
  let i = start,
    guard = 0;
  while (guard++ < 300) {
    if (inHand().length <= 1) break;
    if (roundDone()) break;
    const p = G.players[i];
    if (!p.folded && !p.allIn && (!p.acted || p.bet < G.currentBet)) {
      const others = G.players.filter(q => q !== p && !q.folded && !q.allIn);
      if (others.length === 0 && p.bet >= G.currentBet) p.acted = true;
      else await takeTurn(p);
    }
    i = next(i);
  }
  setTurnRing(null);
  G.focus = POT_POS.clone();
}
function buildPots() {
  const levels = [...new Set(G.players.filter(p => p.contrib > 0 && !p.folded).map(p => p.contrib))].sort(
    (a, b) => a - b,
  );
  const pots = [];
  let prev = 0;
  for (const L of levels) {
    let amt = 0;
    for (const p of G.players) amt += Math.max(0, Math.min(p.contrib, L) - prev);
    const elig = G.players.filter(p => !p.folded && p.contrib >= L);
    if (amt > 0) pots.push({ amount: amt, elig });
    prev = L;
  }
  const left = potTotal() - pots.reduce((s, p) => s + p.amount, 0);
  if (left > 0 && pots.length) pots[pots.length - 1].amount += left;
  return pots;
}
async function payOut(winners, amount) {
  const share = Math.floor(amount / winners.length / 5) * 5;
  let rem = amount - share * winners.length;
  const order = [];
  for (let k = 1; k <= 6; k++) {
    const q = G.players[(G.button + k) % 6];
    if (winners.includes(q)) order.push(q);
  }
  const pays = order.map((w, i) => ({ w, amt: share + (i === 0 ? rem : 0) }));
  await Promise.all(
    pays.map(({ w, amt }) => {
      const pile = makePile(amt, { maxCols: 6 });
      pile.position.copy(POT_POS);
      scene.add(pile);
      return moveTo(pile, stackPos(w.seat), 600, 0.5).then(() => {
        scene.remove(pile);
        w.stack += amt;
        setStackPile(w);
      });
    }),
  );
  if (G.potPile) {
    scene.remove(G.potPile);
    G.potPile = null;
  }
  pays.forEach(({ w }) => {
    w.winT = gameNow() / 1000;
  });
  return pays;
}

/* ===== One hand ===== */
async function playHand() {
  G.handNo++;
  G.board = [];
  G.hl = null;
  G.muck = 0;
  G.revealed = false;
  G.street = 'pre';
  G.bomb = G.bombNext || (G.bombEvery > 0 && G.handNo % G.bombEvery === 0);
  G.bombNext = false;
  syncBombMenu();
  for (const p of G.players) {
    if (p.sitting && p.stack <= 0) {
      p.stack = START;
      setStackPile(p);
      if (p.human) log('You rebuy for $1,000.', 'sys');
      else {
        log(`<b style="color:${p.P.css}">${p.P.name}</b> busted and rebuys for $1,000.`, 'sys');
        say(p, 'rebuy', 1);
      }
    }
    Object.assign(p, {
      hole: [],
      cards: [],
      folded: false,
      allIn: false,
      bet: 0,
      contrib: 0,
      acted: false,
      last: '',
      startStack: p.stack,
      thinking: false,
      thought: '',
      bluffing: false,
      vol: false,
      pfr: false,
      shown: false,
      hl: null,
    });
  }
  G.players.forEach(p => {
    if (!p.sitting) Object.assign(p, { folded: true, hole: [], cards: [], bet: 0, contrib: 0, last: '' });
  });
  const seated = G.players.filter(p => p.sitting);
  G.button = G.button < 0 || !G.players[G.button].sitting ? pick(seated).seat : next(G.button);
  await moveTo(dealerBtn, btnPos(G.button), 450, 0.3);
  G.deck = shuffle(FULL_DECK.slice());
  const sbI = seated.length === 2 ? G.button : next(G.button),
    bbI = next(sbI);
  $('#handInfo').textContent = G.bomb
    ? `Hand ${G.handNo} · Bomb pot · Ante $${BOMB_ANTE}`
    : `Hand ${G.handNo} · Blinds $5 / $10`;
  log(G.bomb ? `Hand ${G.handNo} · Bomb pot` : `Hand ${G.handNo}`, 'hand');
  const bn = i => (G.players[i].human ? 'You' : G.players[i].P.name);
  if (G.bomb) return playBombStart(seated);
  setStage(
    'pre',
    `New hand. ${bn(G.button)} ${G.button === 0 ? 'have' : 'has'} the dealer button. ${bn(sbI)} ${sbI === 0 ? 'post' : 'posts'} the small blind ($5) and ${bn(bbI)} ${bbI === 0 ? 'post' : 'posts'} the big blind ($10).`,
  );
  lastMove(
    `Blinds are forced bets that rotate around the table, so there is always something to win. Right now you are in the <b>${roleText(0)}</b>.`,
  );
  renderMyCards();
  updateAll();
  updateCoachHand();
  $('#recRow').hidden = true;
  await wait(500);
  const post = (i, amt) => {
    const p = G.players[i];
    putIn(p, Math.min(amt, p.stack));
    log(
      `${p.human ? '<b>You</b> post' : '<b style="color:' + p.P.css + '">' + p.P.name + '</b> posts'} the ${amt === SB ? 'small' : 'big'} blind (${fmt(p.bet)}).`,
      'sys',
    );
  };
  post(sbI, SB);
  post(bbI, BB);
  G.currentBet = BB;
  G.minRaise = BB;
  G.raises = 0;
  G.lastAggr = null;
  updateAll();
  await wait(400);
  for (let r = 0; r < 2; r++)
    for (let k = 0; k < 6; k++) {
      const p = G.players[(sbI + k) % 6];
      if (!p.sitting) continue;
      const c = G.deck.pop();
      p.hole.push(c);
      const o = makeCard(c);
      p.cards.push(o);
      await dealTo(o, holePos(p.seat, r), faceYaw(p.seat), false, 220);
    }
  await Promise.all(HUMAN.cards.map(o => flip(o, true)));
  renderMyCards();
  updateAll();
  updateCoachHand();
  log(`You are dealt ${HUMAN.hole.map(miniHTML).join(' ')} (${holeDesc(HUMAN.hole)}).`, 'sys');
  await bettingRound(next(bbI));
  await collectBets();
  return playStreets();
}
async function playBombStart(seated) {
  const n = seated.length;
  setStage('bomb', `Bomb pot! Everyone puts in $${BOMB_ANTE}.`);
  lastMove(
    `<b>Bomb pot.</b> Instead of blinds, all ${n} players put in a $${BOMB_ANTE} ante, so the pot starts at ${fmt(n * BOMB_ANTE)}. Nobody can fold before the flop, so everyone sees it.`,
  );
  renderMyCards();
  updateAll();
  updateCoachHand();
  $('#recRow').hidden = true;
  const fl = $('#bombFlash');
  $('#bombFlashSub').textContent = `Everyone antes $${BOMB_ANTE} · straight to the flop`;
  fl.classList.remove('go');
  void fl.offsetWidth;
  fl.classList.add('go');
  await wait(900);
  for (const p of seated) {
    putIn(p, BOMB_ANTE);
  }
  log(`Everyone antes ${fmt(BOMB_ANTE)}. No blinds and no pre-flop betting this hand.`, 'sys');
  const talker = pick(seated.filter(p => !p.human));
  if (talker) sayText(talker, pick(BOMB_LINES));
  updateAll();
  await wait(700);
  await collectBets();
  G.currentBet = 0;
  G.minRaise = BB;
  G.raises = 0;
  G.lastAggr = null;
  for (let r = 0; r < 2; r++)
    for (let k = 1; k <= 6; k++) {
      const p = G.players[(G.button + k) % 6];
      if (!p.sitting) continue;
      const c = G.deck.pop();
      p.hole.push(c);
      const o = makeCard(c);
      p.cards.push(o);
      await dealTo(o, holePos(p.seat, r), faceYaw(p.seat), false, 220);
    }
  $('#bombFlash').classList.remove('go');
  await Promise.all(HUMAN.cards.map(o => flip(o, true)));
  renderMyCards();
  updateAll();
  updateCoachHand();
  log(
    `You are dealt ${HUMAN.hole.map(miniHTML).join(' ')} (${holeDesc(HUMAN.hole)}). No betting yet: straight to the flop.`,
    'sys',
  );
  lastMove(
    `You have <b>${holeDesc(HUMAN.hole)}</b>. In a bomb pot you can't fold or raise before the flop, so even weak cards get to see three shared cards for free. Your ante is already in.`,
  );
  await wait(900);
  return playStreets();
}
const BOMB_LINES = [
  "Bomb pot! Let's gamble.",
  'Free flop for everybody.',
  'Big pot, here we go.',
  'Love a bomb pot.',
  'Anything can happen now.',
];
function sayText(p, txt) {
  if (p.human || !p.el) return;
  const b = p.el.querySelector('.bubble');
  b.textContent = txt;
  b.hidden = false;
  clearTimeout(bubbleTimers[p.seat]);
  bubbleTimers[p.seat] = setTimeout(() => (b.hidden = true), 2900 * Math.max(speedMul, 0.7));
  log(`<b style="color:${p.P.css}">${p.P.name}:</b> “${esc(txt)}”`, 'chat');
}
async function playStreets() {
  for (const [name, n] of [
    ['flop', 3],
    ['turn', 1],
    ['river', 1],
  ]) {
    if (inHand().length < 2) break;
    if (canAct().length < 2 && !G.revealed) {
      G.revealed = true;
      log(
        'Everyone left is all-in, so the cards are turned face up and the rest of the board is dealt.',
        'lesson',
      );
      lastMove(
        'Nobody can bet any more, because at least one player is all-in. All hands are turned face up and the remaining cards are dealt.',
      );
      for (const p of inHand()) if (!p.human) await revealHand(p);
    }
    await wait(400);
    G.street = name;
    setStage(name);
    // burn one card, then deal the street
    const burn = makeCard(G.deck.pop());
    G.muck++;
    await dealTo(burn, MUCK_POS.clone().setY(0.07 + G.muck * 0.009), rand(-1, 1), false, 200);
    for (let k = 0; k < n; k++) {
      const c = G.deck.pop();
      const idx = G.board.length;
      G.board.push(c);
      const o = makeCard(c);
      o.board = true;
      await dealTo(o, boardPos(idx), 0, true, 240);
      renderMyCards();
    }
    log(`${name[0].toUpperCase() + name.slice(1)}: ${G.board.map(miniHTML).join(' ')}`, 'sys');
    if (!HUMAN.folded)
      lastMove(`New shared card${n > 1 ? 's' : ''} on the table. You now have <b>${handNow(HUMAN)}</b>.`);
    G.players.forEach(p => {
      p.bet = 0;
      p.acted = false;
      if (!p.folded && !p.allIn) p.last = '';
    });
    G.currentBet = 0;
    G.minRaise = BB;
    G.raises = 0;
    G.lastAggr = null;
    renderMyCards();
    updateAll();
    updateCoachHand();
    $('#recRow').hidden = true;
    if (canAct().length >= 2) await bettingRound(next(G.button));
    await collectBets();
  }
  return showdown();
}

async function showdown() {
  const alive = inHand();
  const total = potTotal();
  const results = [];
  if (alive.length === 1) {
    const w = alive[0];
    G.street = 'showdown';
    await payOut([w], total);
    const lines = [];
    if (!w.human && w.bluffing && Math.random() < (w.P.key === 'rico' ? 0.6 : 0.25)) {
      await revealHand(w);
      say(w, 'bluffShow', 1);
      log(
        `<b style="color:${w.P.css}">${w.P.name}</b> shows ${w.hole.map(miniHTML).join(' ')}. That was a bluff!`,
        'lesson',
      );
      lines.push({ p: w, hand: holeDesc(w.hole) + ' (a bluff!)', won: true });
    } else if (!w.human) say(w, 'win', 0.35);
    log(
      `${w.human ? '<b>You</b> win' : '<b style="color:' + w.P.css + '">' + w.P.name + '</b> wins'} ${fmt(total)}. Everyone else folded.`,
      'win',
    );
    results.push({ winners: [w], amount: total, uncontested: true, lines });
  } else {
    G.street = 'showdown';
    setStage('showdown');
    for (let k = 1; k <= 6; k++) {
      const p = G.players[(G.button + k) % 6];
      if (!p.folded && !p.human) {
        await revealHand(p);
        await wait(150);
      }
    }
    const evs = new Map(alive.map(p => [p, evaluate(p.hole.concat(G.board))]));
    const pots = buildPots();
    for (const pot of pots) {
      const best = Math.max(...pot.elig.map(p => evs.get(p).score));
      const winners = pot.elig.filter(p => evs.get(p).score === best);
      await payOut(winners, pot.amount);
      results.push({ winners, amount: pot.amount, elig: pot.elig });
    }
    // highlight main winner's best five cards
    const mw = results[0].winners[0];
    const five = bestFive(mw.hole.concat(G.board));
    const ids = new Set(five.map(c => c.id));
    mw.hl = ids;
    G.hl = ids;
    cardObjs.forEach(o => {
      if (ids.has(o.c.id) && (o.board || mw.cards.includes(o))) {
        o.mesh.material[2].emissive.setHex(0x5a4310);
        moveTo(o.yaw, o.yaw.position.clone().setY(o.yaw.position.y + 0.06), 200).catch(() => {});
      }
    });
    if (mw.human) HUMAN.hl = ids;
    let potNo = 0;
    for (const r of results) {
      const names = r.winners.map(w => (w.human ? 'You' : w.P.name)).join(' and ');
      if (r.elig.length === 1) {
        log(`${fmt(r.amount)} goes back to ${names}: nobody else had enough chips to match it.`, 'win');
        continue;
      }
      const label =
        potNo++ === 0
          ? results.filter(x => x.elig.length > 1).length > 1
            ? 'Main pot: '
            : ''
          : 'Side pot: ';
      log(
        `${label}${names} ${r.winners.length > 1 ? 'split' : r.winners[0].human ? 'win' : 'wins'} ${fmt(r.amount)} with ${describe(evs.get(r.winners[0]))}.`,
        'win',
      );
    }
    alive.forEach(p => {
      if (!p.human) {
        const won = results.some(r => r.winners.includes(p));
        say(p, won ? 'win' : 'lose', 0.45);
      }
    });
    results.evs = evs;
  }
  renderMyCards();
  updateAll();
  postHand(results);
  return results;
}

function postHand(results) {
  const winnersAll = new Set(results.filter(r => !r.elig || r.elig.length > 1).flatMap(r => r.winners));
  // mood: tilt and confidence
  G.players.forEach(p => {
    if (p.human || !p.sitting) return;
    const net = p.stack - p.startStack;
    if (net <= -Math.max(220, p.startStack * 0.3)) {
      const before = p.tilt;
      p.tilt = Math.min(1, p.tilt + 0.75 * p.P.tiltK);
      p.hot = 0;
      if (p.tilt > 0.4 && before <= 0.4) {
        log(
          `<b style="color:${p.P.css}">${p.P.name}</b> is <b>on tilt</b>: upset after losing ${fmt(-net)}. Expect looser, wilder play for a few hands.`,
          'lesson',
        );
        say(p, 'tilt', 0.9);
      }
    } else if (net >= 220) {
      p.hot = 1;
      p.tilt *= 0.5;
    } else {
      p.tilt *= 0.72;
      p.hot *= 0.6;
    }
    if (p.tilt < 0.12) p.tilt = 0;
    if (p.hot < 0.1) p.hot = 0;
  });
  // user profile
  if (HUMAN.hole.length && !G.bomb) {
    U.hands++;
    if (HUMAN.vol) U.vpip++;
    if (HUMAN.pfr) U.pfr++;
  }
  const read = userRead();
  if (read.known && read.label !== 'Balanced' && !U.said.has(read.label)) {
    U.said.add(read.label);
    const sharp = G.players.filter(p => !p.human && p.sitting && p.P.adapt >= 0.8);
    const p = pick(sharp);
    if (p) {
      say(p, 'adapt', 1);
      log(`The table is adjusting to you: they now see you as <b>${read.label.toLowerCase()}</b>.`, 'lesson');
    }
  }
  updateRead();
  updateAll();
  // banner
  const r0 = results[0];
  const evs = results.evs;
  const wn = r0.winners.map(w => (w.human ? 'You' : w.P.name)).join(' and ');
  const total = results.reduce((s, r) => s + r.amount, 0);
  $('#bEyebrow').textContent = G.bomb ? `Hand ${G.handNo} · Bomb pot result` : `Hand ${G.handNo} result`;
  const contested = results.filter(r => !r.elig || r.elig.length > 1),
    refunds = results.filter(r => r.elig && r.elig.length === 1);
  if (contested.length > 1) $('#bTitle').textContent = 'Main pot and side pot';
  else {
    const c = contested[0] || r0;
    const n = c.winners.map(w => (w.human ? 'You' : w.P.name)).join(' and ');
    $('#bTitle').textContent =
      c.winners.length > 1
        ? `${n} split ${fmt(c.amount)}`
        : `${n} ${c.winners[0].human ? 'win' : 'wins'} ${fmt(c.amount)}`;
  }
  const list = $('#bList');
  list.innerHTML = '';
  let lesson = '';
  if (r0.uncontested) {
    $('#bSub').textContent = 'Everyone else folded, so no cards had to be shown.';
    (r0.lines || []).forEach(l => {
      list.insertAdjacentHTML(
        'beforeend',
        `<li class="won"><span class="who">${l.p.P.name}</span>${l.p.hole.map(miniHTML).join('')}<span class="hn">${esc(l.hand)}</span></li>`,
      );
    });
    if (r0.winners[0].human)
      lesson = 'You won without a showdown. Betting can win pots even when nobody sees your cards.';
    else if (G.bomb && HUMAN.folded)
      lesson = `In a bomb pot your $${BOMB_ANTE} ante was already in. Folding after the flop only made sense if you had little chance; the ante alone is not a reason to keep calling.`;
    else if (G.bomb)
      lesson =
        'In a bomb pot the pot is big before any betting, so one strong bet after the flop often takes it down.';
    else if (HUMAN.folded && HUMAN.contrib > BB)
      lesson = `You folded after putting in ${fmt(HUMAN.contrib)}. Folding early, before chips go in, is usually cheaper.`;
    else lesson = 'Most pots end like this: one bet, and everyone else folds.';
  } else {
    const ev = evs.get(r0.winners[0]);
    $('#bSub').textContent = `Winning hand: ${describe(ev)}.`;
    const alive = [...evs.keys()].sort((a, b) => evs.get(b).score - evs.get(a).score);
    alive.forEach(p => {
      const won = winnersAll.has(p);
      list.insertAdjacentHTML(
        'beforeend',
        `<li class="${won ? 'won' : ''}"><span class="who" style="color:${p.human ? 'var(--ink)' : p.P.css}">${p.human ? 'You' : p.P.name}</span>${p.hole.map(miniHTML).join('')}<span class="hn">${esc(describe(evs.get(p)))}</span></li>`,
      );
    });
    if (evs.has(HUMAN)) {
      const mine = evs.get(HUMAN);
      if (winnersAll.has(HUMAN))
        lesson = `Your ${describe(mine)} won. The winning cards are lit up on the table.`;
      else
        lesson = `Your ${describe(mine)} lost to ${describe(ev)}. Check the Hand rankings to see why it ranks higher.`;
    } else if (HUMAN.folded)
      lesson = 'You folded this one. Compare the hands above to see whether folding was right.';
  }
  // pot-by-pot breakdown and what this hand did to your chips
  if (contested.length > 1 || refunds.length) {
    const rows = [];
    contested.forEach((r, i) => {
      const names = r.winners.map(w => (w.human ? 'You' : w.P.name));
      rows.push(
        `<li class="potline"><span class="who">${i === 0 ? 'Main pot' : 'Side pot'}</span><span class="amt">${fmt(r.amount)}</span><span class="hn">${names.length > 1 ? names.join(' & ') + ' split it (' + fmt(r.amount / names.length) + ' each)' : names[0] + (names[0] === 'You' ? ' win it' : ' wins it')}</span></li>`,
      );
    });
    refunds.forEach(r => {
      const n = r.winners[0].human ? 'You' : r.winners[0].P.name;
      rows.push(
        `<li class="potline"><span class="who">Returned</span><span class="amt">${fmt(r.amount)}</span><span class="hn">back to ${n}: nobody could match it</span></li>`,
      );
    });
    list.insertAdjacentHTML('afterbegin', rows.join(''));
    if (contested.length > 1)
      lesson =
        'A player who is all-in can only win as much as they put in from each opponent. Chips bet above that go into a side pot that only the players who matched them can win.' +
        (lesson ? ' ' + lesson : '');
    else if (refunds.length)
      lesson =
        'When you bet more than anyone can call, the extra is simply handed back.' +
        (lesson ? ' ' + lesson : '');
  }
  if (HUMAN.sitting && HUMAN.hole.length) {
    const net = HUMAN.stack - HUMAN.startStack;
    $('#bSub').textContent +=
      ` You ${net > 0 ? 'won' : net < 0 ? 'lost' : 'broke even'}${net ? ' ' + fmt(Math.abs(net)) : ''} this hand (${fmt(HUMAN.startStack)} → ${fmt(HUMAN.stack)}).`;
  }
  if (G.bomb && lesson && !r0.uncontested)
    lesson += ` Bomb pots mean everyone sees the flop, so hands like this come up more often than usual.`;
  $('#bLesson').textContent = lesson;
}

/* ===== Main loop ===== */
let nextResolve = null;
function waitNext() {
  return new Promise(res => {
    G.ff = false;
    $('#skipBtn').hidden = true;
    $('#banner').hidden = false;
    $('#bNext').focus({ preventScroll: true });
    $('#turnStatus').textContent = 'Hand over.';
    nextResolve = res;
    if (G.autoplay)
      setTimeout(() => {
        if (nextResolve === res && G.autoplay) doNext();
      }, 6000 * speedMul);
  });
}
function doNext() {
  if (!nextResolve) return;
  const r = nextResolve;
  nextResolve = null;
  $('#banner').hidden = true;
  $('#peekBar').hidden = true;
  r();
}
$('#skipBtn').onclick = () => {
  G.ff = true;
  $('#skipBtn').hidden = true;
  $('#turnStatus').textContent = 'Skipping to the result…';
  log('You skip ahead to the end of the hand.', 'sys');
};
$('#bPeek').onclick = () => {
  $('#banner').hidden = true;
  $('#peekNext').textContent = $('#bNext').firstChild.textContent;
  $('#peekBar').hidden = false;
};
$('#peekShow').onclick = () => {
  $('#peekBar').hidden = true;
  $('#banner').hidden = false;
};
$('#peekNext').onclick = doNext;
new MutationObserver(() => {
  if (!$('#banner').hidden) $('#peekBar').hidden = true;
}).observe($('#banner'), { attributes: true, attributeFilter: ['hidden'] });
$('#bNext').onclick = doNext;
async function gameLoop() {
  const g = GEN;
  G.players.forEach(setStackPile);
  updateAll();
  try {
    while (g === GEN) {
      await playHand();
      await waitNext();
      await clearTable();
      G.players.forEach(p => {
        p.last = '';
      });
      updateAll();
    }
  } catch (e) {
    if (!(e instanceof Reset)) console.error(e);
  }
}
function newGame() {
  GEN++;
  humanResolve = null;
  nextResolve = null;
  anims.clear();
  G.userPaused = false;
  $('#pauseBtn').setAttribute('aria-pressed', 'false');
  setPauseLabel();
  cardObjs.forEach(o => {
    o.mesh.material[2].emissive.setHex(0);
    scene.remove(o.yaw);
  });
  cardObjs = [];
  if (G.potPile) {
    scene.remove(G.potPile);
    G.potPile = null;
  }
  G.players.forEach(p => {
    Object.assign(p, {
      stack: START,
      hole: [],
      cards: [],
      folded: false,
      allIn: false,
      bet: 0,
      contrib: 0,
      acted: false,
      last: '',
      tilt: 0,
      hot: 0,
      startStack: START,
      thinking: false,
      thought: '',
      bluffing: false,
      vol: false,
      pfr: false,
      shown: false,
      hl: null,
      winT: -9,
    });
    setBetPile(p);
  });
  Object.assign(G, {
    bomb: false,
    bombNext: false,
    hl: null,
    button: -1,
    board: [],
    handNo: 0,
    street: 'idle',
    acting: -1,
    lastAggr: null,
    raises: 0,
    currentBet: 0,
    minRaise: BB,
    muck: 0,
    revealed: false,
  });
  G.focus = POT_POS.clone();
  Object.assign(U, { hands: 0, vpip: 0, pfr: 0, aggr: 0, passive: 0, said: new Set() });
  dealerBtn.position.set(0, 0.08, 0);
  G.ff = false;
  $('#skipBtn').hidden = true;
  $('#peekBar').hidden = true;
  $('#bombFlash').classList.remove('go');
  $('#logList').innerHTML = '';
  $('#banner').hidden = true;
  setControls(false);
  setTurnRing(null);
  document.querySelectorAll('.bubble').forEach(b => (b.hidden = true));
  $('#adviceBox').hidden = true;
  $('#recRow').hidden = true;
  setStage('pre');
  $('#stageTitle').textContent = 'New game';
  $('#stageText').textContent = 'Fresh chips for everyone. Dealing the first hand.';
  lastMove('Everyone is back to $1,000, and the other players have forgotten how you play.');
  $('#handInfo').textContent = "No-Limit Texas Hold'em · Blinds $5 / $10";
  $('#turnStatus').textContent = '';
  log('New game started.', 'sys');
  updateRead();
  renderMyCards();
  updateAll();
  started = false;
  renderStartCard();
  $('#startCard').hidden = false;
  $('#stageText').textContent = 'Choose your settings and opponents, then press "Start game".';
}

/* ===== UI wiring ===== */
const cast = $('#cast');
PERSONAS.slice(1).forEach(P =>
  cast.insertAdjacentHTML(
    'beforeend',
    `<div><span class="swatch" style="background:${P.css}"></span><span><b>${P.name}</b> · <span style="color:${P.css}">${P.style}</span><br>${P.blurb}</span></div>`,
  ),
);
let started = false;
const SEAT_SETS = { 1: [3], 2: [2, 4], 3: [1, 3, 5], 4: [1, 2, 4, 5], 5: [1, 2, 3, 4, 5] };
const SETUP = { order: PERSONAS.slice(1).map(P => P.key), on: {} };
SETUP.order.forEach(k => (SETUP.on[k] = true));
try {
  const sv = JSON.parse(localStorage.getItem('holdem-seats') || 'null');
  if (
    sv &&
    Array.isArray(sv.order) &&
    sv.order.length === 5 &&
    SETUP.order.every(k => sv.order.includes(k))
  ) {
    SETUP.order = sv.order;
    SETUP.on = sv.on;
  }
} catch (e) {}
function saveSetup() {
  try {
    localStorage.setItem('holdem-seats', JSON.stringify(SETUP));
  } catch (e) {}
}
function applySeating() {
  const chosen = SETUP.order.filter(k => SETUP.on[k]).map(k => PERSONAS.find(P => P.key === k));
  const seats = SEAT_SETS[chosen.length];
  for (let i = 1; i < 6; i++) {
    const p = G.players[i];
    if (p.av) {
      scene.remove(p.av.root);
      p.av = null;
    }
    if (p.chair) {
      scene.remove(p.chair);
      p.chair = null;
    }
    if (p.betPile) {
      scene.remove(p.betPile);
      p.betPile = null;
    }
    const at = seats.indexOf(i);
    p.sitting = at >= 0;
    if (!p.sitting) {
      p.el.hidden = true;
      p.betEl.hidden = true;
      setStackPile(p);
      continue;
    }
    const P = chosen[at];
    p.P = P;
    Object.assign(p, { stack: START, tilt: 0, hot: 0, thought: '', last: '' });
    p.chair = makeChair();
    p.chair.position.copy(onEllipse(i, 5.0, 3.35, 0));
    p.chair.lookAt(0, 0, 0);
    scene.add(p.chair);
    p.av = makeAvatar(P);
    p.av.root.position.copy(onEllipse(i, 5.0, 3.35, 0));
    p.av.root.lookAt(0, 0, 0);
    scene.add(p.av.root);
    p.el.hidden = false;
    p.el.style.setProperty('--pc', P.css);
    p.el.querySelector('.pname').textContent = P.name;
    p.el.querySelector('.pstyle').textContent = P.style;
    setStackPile(p);
  }
  updateAll();
}
function renderOpps() {
  const n = SETUP.order.filter(k => SETUP.on[k]).length;
  let seatNo = 0;
  if (isTable() && n > 4) {
    let c = 0;
    SETUP.order.forEach(k => {
      if (SETUP.on[k] && ++c > 4) SETUP.on[k] = false;
    });
    return renderOpps();
  }
  $('#setOpps').innerHTML = SETUP.order
    .map((k, i) => {
      const P = PERSONAS.find(x => x.key === k);
      const on = !!SETUP.on[k];
      if (on) seatNo++;
      return `<li class="opp${on ? '' : ' off'}"><button type="button" class="switch sm" data-k="${k}" aria-pressed="${on}" aria-label="Seat ${P.name}"${!isTable() && on && n === 1 ? ' disabled title="At least one opponent is needed"' : ''}${isTable() && !on && n >= 4 ? ' disabled title="Up to 4 players can join you at this table"' : ''}></button>
      <span class="opp-n">${on ? seatNo : '–'}</span><span class="opp-name"><b style="color:${P.css}">${P.name}</b><small>${P.style}</small></span>
      <button type="button" class="mv" data-up="${i}" aria-label="Move ${P.name} up"${i === 0 ? ' disabled' : ''}><svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></button>
      <button type="button" class="mv" data-down="${i}" aria-label="Move ${P.name} down"${i === 4 ? ' disabled' : ''}><svg viewBox="0 0 24 24"><path d="M6 9l6 6 6-6"/></svg></button></li>`;
    })
    .join('');
  $('#oppCount').textContent = isTable()
    ? n === 0
      ? 'just you and the dealer'
      : n === 1
        ? '1 other player'
        : n + ' other players'
    : n === 1
      ? '1 opponent'
      : n + ' opponents';
}
$('#setOpps').addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.dataset.k) {
    const k = b.dataset.k;
    SETUP.on[k] = !SETUP.on[k];
  } else if (b.dataset.up !== undefined) {
    const i = +b.dataset.up;
    [SETUP.order[i - 1], SETUP.order[i]] = [SETUP.order[i], SETUP.order[i - 1]];
  } else if (b.dataset.down !== undefined) {
    const i = +b.dataset.down;
    [SETUP.order[i + 1], SETUP.order[i]] = [SETUP.order[i], SETUP.order[i + 1]];
  }
  saveSetup();
  renderOpps();
  if (isTable()) {
    if (!gameStarted()) seatTable();
  } else if (!started) applySeating();
});
$('#oppShuffle').onclick = e => {
  const b = e.currentTarget,
    before = SETUP.order.join();
  do {
    shuffle(SETUP.order);
  } while (SETUP.order.join() === before);
  b.classList.remove('spin');
  void b.offsetWidth;
  b.classList.add('spin');
  saveSetup();
  renderOpps();
  if (isTable()) {
    if (!gameStarted()) seatTable();
  } else if (!started) applySeating();
};
function renderStartCard() {
  renderOpps();
  if (isTable()) {
    if (!gameStarted()) seatTable();
  } else if (!started) applySeating();
  document
    .querySelectorAll('#setSpeed button')
    .forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === speedMul)));
  $('#setHints').setAttribute('aria-pressed', G.hints);
  $('#setXray').setAttribute('aria-pressed', G.xray);
}
function start() {
  $('#intro').hidden = true;
  if (!started) {
    renderStartCard();
    $('#startCard').hidden = false;
    $('#playBtn').focus({ preventScroll: true });
  }
}
document.querySelectorAll('#setSpeed button').forEach(
  b =>
    (b.onclick = () => {
      speedMul = +b.dataset.v;
      $('#speedSel').value = b.dataset.v;
      try {
        localStorage.setItem('holdem-speed2', b.dataset.v);
      } catch (e) {}
      renderStartCard();
    }),
);
const FREQ_TXT = { 1: 'Every hand', 3: 'Every 3rd', 5: 'Every 5th', 10: 'Every 10th' };
function setBomb(v) {
  G.bombEvery = v;
  if (v) G.bombLast = v;
  try {
    localStorage.setItem('holdem-bomb', String(v));
  } catch (e) {}
  syncBombMenu();
  if (!isTable()) renderBombRow();
}
function renderBombRow() {
  $('#setBomb').setAttribute('aria-pressed', G.bombEvery > 0);
  $('#setBombFreq').hidden = !G.bombEvery;
  document
    .querySelectorAll('#setBombFreq button')
    .forEach(b => b.setAttribute('aria-pressed', String(+b.dataset.v === G.bombEvery)));
}
function syncBombMenu() {
  const b = $('#bombBtn');
  b.dataset.pill = G.bombEvery ? FREQ_TXT[G.bombEvery] : 'Off';
  b.dataset.on = G.bombEvery > 0;
  const n = $('#bombNextBtn');
  n.dataset.pill = G.bombNext ? 'Queued' : '';
  n.dataset.on = G.bombNext;
}
$('#setBomb').onclick = () => setBomb(G.bombEvery ? 0 : G.bombLast);
document.querySelectorAll('#setBombFreq button').forEach(b => (b.onclick = () => setBomb(+b.dataset.v)));
function syncBombOpts() {
  document
    .querySelectorAll('#bombMenu .opt')
    .forEach(b => b.setAttribute('aria-checked', String(+b.dataset.v === G.bombEvery)));
}
$('#bombBtn').onclick = e => {
  e.stopPropagation();
  syncBombOpts();
  $('#moreMenu').hidden = true;
  $('#bombMenu').hidden = false;
  $('#bombMenu .opt[aria-checked="true"]').focus({ preventScroll: true });
};
$('#bombBack').onclick = e => {
  e.stopPropagation();
  $('#bombMenu').hidden = true;
  $('#moreMenu').hidden = false;
};
document.querySelectorAll('#bombMenu .opt').forEach(
  b =>
    (b.onclick = () => {
      const v = +b.dataset.v,
        was = G.bombEvery;
      setBomb(v);
      syncBombOpts();
      if (v !== was)
        log(
          v ? `Bomb pots: ${FREQ_TXT[v].toLowerCase()}${v === 1 ? '' : ' hand'}.` : 'Bomb pots turned off.',
          'sys',
        );
      $('#bombMenu').hidden = true;
      $('#moreBtn').setAttribute('aria-expanded', 'false');
    }),
);
$('#bombNextBtn').onclick = () => {
  G.bombNext = !G.bombNext;
  syncBombMenu();
  if (G.bombNext) log('The next hand will be a bomb pot.', 'sys');
};
syncBombMenu();
renderBombRow();
$('#setHints').onclick = () => {
  $('#hintBtn').click();
  renderStartCard();
};
$('#setXray').onclick = () => {
  $('#xrayBtn').click();
  renderStartCard();
};
$('#playBtn').onclick = () => {
  $('#startCard').hidden = true;
  if (MODE === 'blackjack') {
    bjStart();
    return;
  }
  if (TGAMES[MODE]) {
    tgStart();
    return;
  }
  if (!started) {
    applySeating();
    started = true;
    gameLoop();
  }
};
$('#startBtn').onclick = () => start(false);
let newArm = 0;
function setNewLabel(b, arm) {
  b.classList.toggle('arm', arm);
  b.querySelector('.tx').textContent = arm ? 'Confirm restart' : 'New game';
}
function setPauseLabel() {
  const b = $('#pauseBtn');
  b.querySelector('.tx').textContent = G.userPaused ? 'Resume' : 'Pause';
  b.title = G.userPaused ? 'Resume' : 'Pause';
  b.querySelector('.ic').innerHTML = G.userPaused
    ? '<path d="M7 4l13 8-13 8z"/>'
    : '<path d="M9 5v14M15 5v14"/>';
}
$('#newBtn').onclick = e => {
  const b = e.currentTarget;
  if (!gameStarted()) return;
  if (newArm && Date.now() - newArm < 3000) {
    newArm = 0;
    setNewLabel(b, false);
    MODE === 'blackjack' ? bjNewGame() : TGAMES[MODE] ? tgNewGame() : newGame();
    return;
  }
  newArm = Date.now();
  setNewLabel(b, true);
  setTimeout(() => {
    if (newArm && Date.now() - newArm >= 2900) {
      newArm = 0;
      setNewLabel(b, false);
    }
  }, 3000);
};
G.hints = true;
try {
  if (localStorage.getItem('holdem-hints') === 'off') G.hints = false;
} catch (e) {}
function applyHints() {
  $('#hintBtn').setAttribute('aria-pressed', G.hints);
  [btnFold, btnCall, btnRaise].forEach(b => b.classList.remove('pick'));
  if (humanResolve && curAdvice && !btnRaise.disabled) {
    range.value = G.hints && curAdvice.rec === 'raise' ? curAdvice.raiseTo : range.min;
    updateRaiseLabel();
  }
  if (G.hints && humanResolve && curAdvice) {
    showAdvice(curAdvice);
    ({ fold: btnFold, check: btnCall, call: btnCall, raise: btnRaise })[curAdvice.rec].classList.add('pick');
  } else $('#recRow').hidden = true;
}
$('#hintBtn').onclick = () => {
  G.hints = !G.hints;
  try {
    localStorage.setItem('holdem-hints', G.hints ? 'on' : 'off');
  } catch (e) {}
  applyHints();
};
applyHints();
let logOn = true;
try {
  if (localStorage.getItem('holdem-log') === 'off') logOn = false;
} catch (e) {}
function setLog(on) {
  logOn = on;
  app.classList.toggle('log-off', !on);
  syncPanelBtns();
  try {
    localStorage.setItem('holdem-log', on ? 'on' : 'off');
  } catch (e) {}
  resize();
}
$('#logBtn2').onclick = () => {
  if (isMob()) {
    toggleSheet('log');
    return;
  }
  setLog(!logOn);
};
setLog(logOn);
$('#pauseBtn').onclick = e => {
  G.userPaused = !G.userPaused;
  app.classList.toggle('paused', G.userPaused);
  e.currentTarget.setAttribute('aria-pressed', G.userPaused);
  setPauseLabel();
  if (G.userPaused) $('#turnStatus').textContent = 'Paused. Press Resume to continue.';
  else $('#turnStatus').textContent = '';
};
$('#helpBtn').onclick = () => {
  $('#moreMenu').hidden = true;
  if (TGAMES[MODE]) return tgOpenIntro();
  if (MODE === 'blackjack') {
    $('#bjIntro').hidden = false;
    $('#bjEnter').textContent = BJ.started ? 'Back to the table' : 'Enter';
    return;
  }
  $('#intro').hidden = false;
  $('#startBtn').textContent = started ? 'Back to the table' : 'Enter';
};
const RANKINGS = [
  ['Royal Flush', 'A, K, Q, J, 10, all the same suit.', 'A♠ K♠ Q♠ J♠ 10♠'],
  ['Straight Flush', 'Five in a row, all the same suit.', '9♥ 8♥ 7♥ 6♥ 5♥'],
  ['Four of a Kind', 'Four cards of the same rank.', 'Q♣ Q♦ Q♥ Q♠ 7♦'],
  ['Full House', 'Three of a kind plus a pair.', '8♠ 8♦ 8♥ K♣ K♠'],
  ['Flush', 'Any five cards of the same suit.', 'A♦ J♦ 9♦ 6♦ 2♦'],
  ['Straight', 'Five in a row, mixed suits. An ace can be high or low.', '10♣ 9♦ 8♠ 7♥ 6♣'],
  ['Three of a Kind', 'Three cards of the same rank.', '7♠ 7♥ 7♦ K♣ 2♠'],
  ['Two Pair', 'Two different pairs.', 'J♥ J♣ 4♠ 4♦ A♥'],
  ['One Pair', 'Two cards of the same rank.', '10♠ 10♥ K♦ 6♣ 3♠'],
  ['High Card', 'Nothing else. Your highest card plays.', 'A♣ J♦ 8♠ 5♥ 3♦'],
];
function renderRanks() {
  let row = -1;
  if (HUMAN.hole.length && G.board.length >= 3 && !HUMAN.folded) {
    const ev = evaluate(HUMAN.hole.concat(G.board));
    row = ev.cat === 8 ? (ev.ks[0] === 14 ? 0 : 1) : 9 - ev.cat;
  } else if (HUMAN.hole.length && !HUMAN.folded) row = HUMAN.hole[0].r === HUMAN.hole[1].r ? 8 : 9;
  $('#ranksList').innerHTML = RANKINGS.map(
    (r, i) =>
      `<li class="${i === row ? 'you' : ''}"><span class="n">${i + 1}</span><span class="t"><b>${r[0]}</b><span>${r[1]}</span></span><span class="ex">${r[2]
        .split(' ')
        .map(t => {
          const s = t.slice(-1),
            rk = t.slice(0, -1);
          return `<span class="mini ${s === '♥' || s === '♦' ? 'red' : ''}">${rk}${s}</span>`;
        })
        .join('')}</span></li>`,
  ).join('');
}
$('#rankBtn').onclick = () => {
  $('#moreMenu').hidden = true;
  renderRanks();
  $('#ranksModal').hidden = false;
  $('#ranksClose').focus();
};
document.querySelectorAll('[data-about]').forEach(b => {
  b.onclick = () => {
    $('#moreMenu').hidden = true;
    $('#aboutModal').hidden = false;
    $('#aboutClose').focus({ preventScroll: true });
  };
});
$('#aboutClose').onclick = () => ($('#aboutModal').hidden = true);
$('#aboutModal').onclick = e => {
  if (e.target.id === 'aboutModal') $('#aboutModal').hidden = true;
};

$('#ranksClose').onclick = () => {
  $('#ranksModal').hidden = true;
};
$('#ranksModal').onclick = e => {
  if (e.target.id === 'ranksModal') $('#ranksModal').hidden = true;
};
$('#xrayBtn').onclick = e => {
  G.xray = !G.xray;
  e.currentTarget.setAttribute('aria-pressed', G.xray);
  updateAll();
};
$('#speedSel').value = String(speedMul);
if (!$('#speedSel').value) {
  speedMul = 2.2;
  $('#speedSel').value = '2.2';
}
$('#speedSel').onchange = e => {
  speedMul = +e.target.value;
  try {
    localStorage.setItem('holdem-speed2', e.target.value);
  } catch (err) {}
};
let view = 'seat';
$('#moreBtn').onclick = e => {
  e.stopPropagation();
  const m = $('#moreMenu');
  const sub = !$('#bombMenu').hidden;
  $('#bombMenu').hidden = true;
  m.hidden = sub ? true : !m.hidden;
  e.currentTarget.setAttribute('aria-expanded', !m.hidden);
};
document.addEventListener('click', e => {
  const m = $('#moreMenu');
  if (!e.target.closest('.menuwrap')) $('#bombMenu').hidden = true;
  if (!m.hidden && !e.target.closest('.menuwrap')) {
    m.hidden = true;
    $('#moreBtn').setAttribute('aria-expanded', 'false');
  }
});
function setSide(on) {
  app.classList.toggle('side-off', !on);
  syncPanelBtns();
  resize();
}
const mq = window.matchMedia('(max-width: 860px)');
function isMob() {
  return window.matchMedia('(max-width: 860px)').matches;
}
function syncPanelBtns() {
  const sd = $('#side');
  if (isMob()) {
    $('#sideBtn').setAttribute(
      'aria-pressed',
      sd.classList.contains('open') && sd.classList.contains('sheet-coach'),
    );
    $('#logBtn2').setAttribute(
      'aria-pressed',
      sd.classList.contains('open') && sd.classList.contains('sheet-log'),
    );
  } else {
    $('#sideBtn').setAttribute('aria-pressed', !app.classList.contains('side-off'));
    $('#logBtn2').setAttribute('aria-pressed', !app.classList.contains('log-off'));
  }
}
function closeSheets() {
  $('#side').classList.remove('open');
  app.classList.remove('sheet-open');
  syncPanelBtns();
  resize();
}
function openSheet(kind) {
  $('#moreMenu').hidden = true;
  const sd = $('#side');
  sd.classList.remove('sheet-coach', 'sheet-log');
  sd.classList.add('open', 'sheet-' + kind);
  app.classList.add('sheet-open');
  syncPanelBtns();
  resize();
}
function toggleSheet(kind) {
  const sd = $('#side');
  sd.classList.contains('open') && sd.classList.contains('sheet-' + kind) ? closeSheets() : openSheet(kind);
}
if (mq.addEventListener) mq.addEventListener('change', closeSheets);
$('#sheetShade').onclick = closeSheets;
document.querySelectorAll('[data-close]').forEach(b => (b.onclick = closeSheets));
$('#sideBtn').onclick = () => {
  if (isMob()) {
    toggleSheet('coach');
    return;
  }
  setSide(app.classList.contains('side-off'));
};
$('#coachToggle').onclick = () => {
  if (mq.matches) closeSheets();
  else setSide(false);
};
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' && e.target.type !== 'range') return;
  const k = e.key.toLowerCase();
  if (k === 'escape' && !$('#bombMenu').hidden) {
    $('#bombMenu').hidden = true;
    return;
  }
  if (!$('#ranksModal').hidden && k === 'escape') {
    $('#ranksModal').hidden = true;
    return;
  }
  if (humanResolve) {
    if (k === 'f' && !btnFold.disabled) btnFold.click();
    else if (k === 'c') btnCall.click();
    else if (k === 'r' && !btnRaise.disabled) btnRaise.click();
  }
  if ((k === ' ' || k === 'enter' || k === 'n') && nextResolve) {
    e.preventDefault();
    doNext();
  }
});

/* camera drag */
let yaw = 0,
  tyaw = 0,
  drag = null;
canvas.addEventListener('pointerdown', e => {
  drag = { x: e.clientX, y0: tyaw };
  canvas.setPointerCapture(e.pointerId);
});
canvas.addEventListener('pointermove', e => {
  if (!drag) return;
  tyaw = clamp(drag.y0 - (e.clientX - drag.x) * 0.005, -1.0, 1.0);
});
canvas.addEventListener('pointerup', () => {
  drag = null;
});
canvas.addEventListener('dblclick', () => {
  tyaw = 0;
});

/* ===== Render loop ===== */
const tmpV = new THREE.Vector3(),
  camPos = V3(0, 6, 9),
  camLook = V3(0, 0, 0.5);
function resize() {
  const w = stage.clientWidth,
    h = stage.clientHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
if (window.ResizeObserver) new ResizeObserver(resize).observe(stage);
resize();
function project(v, el, dx = 0, dy = 0, anchor = 'bottom') {
  tmpV.copy(v).project(camera);
  if (tmpV.z > 1) {
    el.style.visibility = 'hidden';
    return;
  }
  el.style.visibility = '';
  const x = ((tmpV.x + 1) / 2) * stage.clientWidth + dx;
  let y = ((-tmpV.y + 1) / 2) * stage.clientHeight + dy;
  if (anchor === 'bottom') {
    const minY = ($('.topbar').offsetHeight || 60) + el.offsetHeight;
    if (y < minY) y = minY;
  }
  el.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,${anchor === 'bottom' ? '-100%' : '-50%'})`;
}
function layoutTags(ps) {
  const W = stage.clientWidth,
    H = stage.clientHeight,
    top = ($('.topbar').offsetHeight || 60) + 4,
    boxes = [];
  for (const p of ps) {
    tmpV.copy(p.av.root.position).setY(1.7).project(camera);
    if (tmpV.z > 1) {
      p.el.style.visibility = 'hidden';
      continue;
    }
    p.el.style.visibility = '';
    const w = p.el.offsetWidth,
      h = p.el.offsetHeight;
    boxes.push({
      el: p.el,
      x: clamp(((tmpV.x + 1) / 2) * W, w / 2 + 4, W - w / 2 - 4),
      y: Math.max(((-tmpV.y + 1) / 2) * H, top + h),
      w,
      h,
    });
  }
  for (let it = 0; it < 4; it++)
    for (let i = 0; i < boxes.length; i++)
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i],
          b = boxes[j];
        if ((a.w + b.w) / 2 + 6 - Math.abs(a.x - b.x) <= 0) continue;
        const oy = Math.min(a.y, b.y) - Math.max(a.y - a.h, b.y - b.h) + 6;
        if (oy > 0) {
          if (a.y >= b.y) a.y += oy;
          else b.y += oy;
        }
      }
  for (const b of boxes)
    b.el.style.transform = `translate(${b.x.toFixed(1)}px,${b.y.toFixed(1)}px) translate(-50%,-100%)`;
}
function frame(now) {
  requestAnimationFrame(frame);
  if (!$('#home').hidden) return; // the homepage covers the table, so skip rendering
  now = gameNow();
  for (const a of anims) {
    const k = clamp((now - a.t0) / a.dur, 0, 1);
    a.fn(a.ease(k));
    if (k >= 1) {
      anims.delete(a);
      a.res();
    }
  }
  const t = now / 1000,
    w = stage.clientWidth,
    h = stage.clientHeight,
    portrait = w / h < 0.9;
  yaw += (tyaw - yaw) * 0.08;
  let tp, tl;
  if (view === 'top') {
    tp = V3(Math.sin(yaw) * 2, portrait ? 19 : 12.5, portrait ? 3.4 : 2.2);
    tl = V3(0, 0, portrait ? 0.9 : 0.35);
  } else {
    const refW = window.innerWidth <= 860 ? w : Math.max(320, window.innerWidth - 370);
    const f = portrait ? 1 : clamp(1.8 / (refW / h), 1, 2.1);
    const d = portrait ? 17.5 : 9.8 * f,
      hh = portrait ? 11.8 : 6.4 * f;
    tp = V3(Math.sin(yaw) * d, hh, Math.cos(yaw) * d);
    tl = V3(0, -0.5, portrait ? 1.4 : 0.9);
  }
  camPos.lerp(tp, 0.07);
  camLook.lerp(tl, 0.07);
  camera.position.copy(camPos);
  camera.lookAt(camLook);
  ring.material.opacity = ring.material.opacity > 0 ? 0.55 + Math.sin(t * 4) * 0.25 : 0;
  const tags = [];
  for (const p of G.players) {
    if (p.av) {
      const av = p.av;
      av.body.scale.y = 1 + Math.sin(t * 1.6 + p.seat) * 0.01;
      const local = av.root.worldToLocal(G.focus.clone());
      let ty = clamp(Math.atan2(local.x, local.z), -0.9, 0.9);
      if (G.focus.distanceTo(av.root.position) < 1.5) ty = 0;
      av.headPivot.rotation.y += (ty - av.headPivot.rotation.y) * 0.06;
      const tz = p.thinking ? Math.sin(t * 2.2) * 0.14 : 0;
      av.headPivot.rotation.z += (tz - av.headPivot.rotation.z) * 0.1;
      const tx = p.thinking ? 0.25 : p.folded && G.street !== 'idle' ? -0.05 : 0.08;
      av.headPivot.rotation.x += (tx - av.headPivot.rotation.x) * 0.06;
      const lean = p.folded && G.street !== 'idle' ? -0.14 : p.thinking ? 0.06 : 0;
      av.body.rotation.x += (lean - av.body.rotation.x) * 0.05;
      const dt = t - p.winT;
      av.body.position.y = -1.0 + (dt < 1.6 ? Math.abs(Math.sin(dt * 7)) * 0.14 * (1 - dt / 1.6) : 0);
      av.skin.emissive.setRGB(p.tilt * 0.22, 0, 0);
      tags.push(p);
    }
    if (!p.betEl.hidden) project(betPos(p.seat).setY(0.35), p.betEl, 0, 0, 'center');
  }
  layoutTags(tags);
  if (!potEl.hidden) project(POT_POS.clone().setY(0.06), potEl, 0, 26, 'center');
  if (MODE === 'blackjack') bjFrame(t);
  else if (TGAMES[MODE]) tgFrame(t);
  renderer.render(scene, camera);
}
requestAnimationFrame(frame);
renderMyCards();
updateRead();

/* ===== Ask your coach ===== */
const COACH_RULES = `You are the friendly coach inside "My Wise Bet", an app where a complete beginner learns No-Limit Texas Hold'em by playing against five computer players. The player learns best visually and by example. Answer the player's question in plain, encouraging language. Keep it short: usually 2 to 5 sentences or a few short dash points, unless they ask for more. When it helps, tie the answer to the current hand using the real cards and amounts in the game state. Never claim to know other players' hidden cards unless the state lists them. You may point to parts of the app: the win-chance bar in the coach panel (green fill versus the gold break-even line), the "Coach pick" tag on the action buttons, the Hand rankings button, the X-ray option in the More menu (shows everyone's cards and thoughts), the Speed menu, Pause, and the table log. Write plain text with no markdown headings, bold or tables.`;
const csTxt = cs => cs.map(c => RANK_CH[c.r] + SUIT_CH[c.s]).join(' ');
function gameSnapshot() {
  const L = [];
  if (G.handNo === 0) L.push('No hand has been dealt yet.');
  else {
    L.push(
      `Hand ${G.handNo}. Stage: ${G.street === 'pre' ? 'pre-flop' : G.street}. Blinds $5/$10. Everyone started with $1,000.`,
    );
    if (G.bomb)
      L.push(
        `THIS HAND IS A BOMB POT: no blinds; every player put in a $${BOMB_ANTE} ante, there was no pre-flop betting, and the flop was dealt straight away. Betting starts after the flop with the first player left of the dealer button.`,
      );
    if (G.button >= 0 && !G.bomb)
      L.push(
        `Dealer button: ${nm(G.players[G.button])}. Small blind: ${nm(G.players[next(G.button)])}. Big blind: ${nm(G.players[next(next(G.button))])}.`,
      );
    if (HUMAN.hole.length)
      L.push(
        `The player's cards: ${csTxt(HUMAN.hole)} (${holeDesc(HUMAN.hole)}). ${HUMAN.folded ? 'The player has FOLDED this hand.' : 'Their best hand right now: ' + handNow(HUMAN) + '.'}`,
      );
    L.push(
      `Shared board: ${G.board.length ? csTxt(G.board) : 'none yet'}. Pot: ${fmt(potTotal())}. Biggest bet this round: ${fmt(G.currentBet)}. The player has ${fmt(HUMAN.bet)} in this round and ${fmt(HUMAN.stack)} left. Player's seat: ${G.button >= 0 ? roleText(0) : 'not set'}.`,
    );
    L.push(
      humanResolve
        ? "It is the PLAYER's turn right now."
        : G.acting >= 0
          ? `It is ${nm(G.players[G.acting])}'s turn.`
          : 'Nobody is acting right now.',
    );
    if (curAdvice && humanResolve)
      L.push(
        `Built-in coach numbers: win chance about ${pct(curAdvice.eq)} against ${curAdvice.n} opponent(s). Calling costs ${fmt(curAdvice.toCall)} and needs a ${pct(curAdvice.potOdds)} win chance to break even. Suggested move: ${curAdvice.rec}${curAdvice.rec === 'raise' ? ' to ' + fmt(curAdvice.raiseTo) : ''}. Reason: ${curAdvice.why}`,
      );
  }
  L.push(
    G.bombEvery
      ? `Bomb pots are ON: every ${G.bombEvery === 1 ? 'hand' : G.bombEvery + (G.bombEvery === 3 ? 'rd' : 'th') + ' hand'} is a bomb pot.`
      : 'Bomb pots are off unless the player queues one.',
  );
  L.push('Other players:');
  G.players
    .slice(1)
    .filter(p => p.sitting)
    .forEach(p => {
      const st = p.folded ? 'folded' : p.allIn ? 'all-in' : p.hole.length ? 'still in the hand' : 'waiting';
      L.push(
        `- ${p.P.name}, ${p.P.style} (${p.P.blurb}) Stack ${fmt(p.stack)}, ${st}${p.last ? ', last action: ' + p.last : ''}${p.bet ? ', has bet ' + fmt(p.bet) + ' this round' : ''}${p.tilt > 0.4 ? ', currently ON TILT' : ''}${p.hot > 0.6 ? ', running hot' : ''}.${G.xray && p.hole.length ? ' X-ray shows their cards: ' + csTxt(p.hole) + '.' : ''}`,
      );
    });
  const r = userRead();
  L.push(`How the table reads the player: ${r.label}. ${r.text}`);
  const banner = $('#banner');
  if (!banner.hidden)
    L.push(
      'Last hand result shown on screen: ' +
        banner.innerText.replace(/\s+/g, ' ').replace('Deal next hand', '').trim(),
    );
  const logs = [...document.querySelectorAll('#logList li')].slice(-30).map(li => li.textContent);
  if (logs.length) L.push('Recent table log (oldest first):\n' + logs.join('\n'));
  return L.join('\n');
}
let chatTurns = [],
  askBusy = false,
  askCtl = null;
function addMsg(cls, text) {
  const d = document.createElement('div');
  d.className = 'msg ' + cls;
  d.textContent = text;
  const c = $('#chat');
  c.appendChild(d);
  c.scrollTop = c.scrollHeight;
  return d;
}
function setAskUI(busy) {
  $('#askSend').hidden = busy;
  $('#askStop').hidden = !busy;
  $('#askInput').disabled = busy;
}
/* Reveal streamed text smoothly, a few letters at a time, with a blinking cursor.
   It speeds up when a lot of text is waiting, so long answers never lag far behind. */
function makeTyper(el, onStep) {
  const node = document.createTextNode(''),
    caret = document.createElement('span');
  caret.className = 'caret';
  el.textContent = '';
  el.append(node, caret);
  const instant = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let target = '',
    shown = 0,
    done = false,
    raf = 0,
    last = performance.now(),
    resolve;
  const finished = new Promise(r => (resolve = r));
  const end = () => {
    cancelAnimationFrame(raf);
    node.data = target;
    shown = target.length;
    caret.remove();
    onStep();
    resolve();
  };
  function tick(now) {
    const dt = Math.min(80, now - last);
    last = now;
    const backlog = target.length - shown;
    if (backlog > 0) {
      shown = Math.min(
        target.length,
        shown + Math.max(1, Math.round((Math.max(55, backlog * 2.5) * dt) / 1000)),
      );
      node.data = target.slice(0, shown);
      onStep();
    }
    if (done && shown >= target.length) {
      end();
      return;
    }
    raf = requestAnimationFrame(tick);
  }
  raf = requestAnimationFrame(tick);
  return {
    set(t) {
      target = t;
      if (instant) {
        node.data = t;
        shown = t.length;
        onStep();
      }
    },
    finish() {
      done = true;
      return finished;
    },
    stop() {
      done = true;
      end();
    },
    get text() {
      return target;
    },
  };
}
async function askCoach(q) {
  q = q.trim();
  if (!q || askBusy || !COACH_URL) return;
  addMsg('me', q);
  const bubble = addMsg('coach wait', 'Thinking…');
  askBusy = true;
  setAskUI(true);
  G.askPaused = true;
  askCtl = new AbortController();
  let typer = null;
  const scrollChat = () => {
    const c = $('#chat');
    c.scrollTop = c.scrollHeight;
  };
  const input = [
    ...chatTurns.slice(-6),
    {
      role: 'user',
      content: `${MODE === 'blackjack' ? BJ_RULES : TGAMES[MODE] ? tgRules() : COACH_RULES}\n\nCURRENT GAME STATE\n${MODE === 'blackjack' ? bjSnapshot() : TGAMES[MODE] ? tgSnapshot() : gameSnapshot()}\n\nTHE PLAYER ASKS\n${q}`,
    },
  ];
  try {
    const onText = ({ text }) => {
      if (!typer) {
        bubble.classList.remove('wait');
        typer = makeTyper(bubble, scrollChat);
      }
      typer.set(text);
    };
    const { text } = await askFreeCoach(input, askCtl.signal, onText);
    if (!typer) {
      bubble.classList.remove('wait');
      typer = makeTyper(bubble, scrollChat);
      typer.set(text);
    }
    await typer.finish();
    chatTurns.push({ role: 'user', content: q }, { role: 'assistant', content: text });
  } catch (e) {
    if (typer) typer.stop();
    bubble.classList.remove('wait');
    if (e.code === 'cancelled') bubble.textContent = e.text || 'Stopped.';
    else if (e.code === 'daily_limit') {
      bubble.textContent = 'The free coach is busy or out of answers for now. Try again in a little while.';
      bubble.classList.add('err');
    } else if (e.code === 'rate_limited') {
      bubble.textContent = 'Too many questions at once. Wait a few seconds, then ask again.';
      bubble.classList.add('err');
    } else {
      bubble.textContent =
        (e.text ? e.text + '\n\n' : '') + 'The coach could not finish that answer. Try asking again.';
      bubble.classList.add('err');
    }
  } finally {
    askBusy = false;
    askCtl = null;
    setAskUI(false);
    G.askPaused = false;
    $('#chat').scrollTop = $('#chat').scrollHeight;
  }
}
$('#askForm').addEventListener('submit', e => {
  e.preventDefault();
  const v = $('#askInput').value;
  $('#askInput').value = '';
  askCoach(v);
});
$('#askStop').onclick = () => askCtl && askCtl.abort();
/* ===== Free coach =====
   Questions go to a small Cloudflare Worker (see worker/ in the repo) that holds the AI key and streams back plain text. */
const COACH_URL = 'https://mywisebet-coach.connor-d56.workers.dev';
async function askFreeCoach(messages, signal, onText) {
  let res;
  try {
    res = await fetch(COACH_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ messages }),
      signal,
    });
  } catch (e) {
    if (e.name === 'AbortError') throw { code: 'cancelled', text: '' };
    throw { code: 'network', text: '' };
  }
  if (res.status === 429) throw { code: 'rate_limited' };
  if (res.status === 503) throw { code: 'daily_limit' };
  if (!res.ok) throw { code: 'http', text: '' };
  const rd = res.body.getReader(),
    dec = new TextDecoder();
  let text = '';
  try {
    for (;;) {
      const { done, value } = await rd.read();
      if (done) break;
      text += dec.decode(value, { stream: true });
      onText({ text });
    }
  } catch (e) {
    if (e && e.name === 'AbortError') throw { code: 'cancelled', text };
    throw { code: 'network', text };
  }
  if (!text.trim()) throw { code: 'http', text: '' };
  return { text };
}
if (COACH_URL) {
  $('#ask').hidden = false;
  $('#askNote').textContent =
    'The coach sees the cards on the table and recent moves. The game pauses while it answers. Free AI answers, limited per day.';
}
