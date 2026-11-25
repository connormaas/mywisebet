// Blackjack mode. Reuses the room, labels, coach panel and action bar from app.js.

/* ===== Blackjack ===== */
const BJ_META = {
  marge: {
    style: 'Never Busts',
    blurb:
      'Stands on any 12 or more so one card can never push the hand over 21. Feels safe, but it loses money over time.',
  },
  rico: {
    style: 'The Gambler',
    blurb: 'Hits too often, doubles on almost anything, and bets bigger after every loss.',
  },
  dev: {
    style: 'Card Counter',
    blurb: 'Plays perfect basic strategy and bets more when the cards left in the shoe favor the players.',
  },
  gus: {
    style: 'Copies the Dealer',
    blurb: 'Hits until 17 every time, just like the dealer. Never doubles or splits.',
  },
  yuki: {
    style: 'By the Book',
    blurb: 'Follows basic strategy exactly, including the scary doubles and splits.',
  },
};
const BJ_SPOTS = [125, 55, 155, 25]; // seat angles in degrees; 90 is you
const BJC = { z: -1.25, rx: 4.35, rz: 3.45 };
const bjAt = (deg, f, y = 0.06) => {
  const a = (deg * Math.PI) / 180;
  return V3(Math.cos(a) * BJC.rx * f, y, BJC.z + Math.sin(a) * BJC.rz * f);
};
const bjYaw = deg => {
  const a = (deg * Math.PI) / 180;
  return Math.atan2(Math.cos(a) * BJC.rx, Math.sin(a) * BJC.rz);
};
const bjVal = c => (c.r === 14 ? 11 : Math.min(c.r, 10));
function bjTotal(cards) {
  let t = 0,
    a = 0;
  for (const c of cards) {
    t += c.r === 14 ? 1 : Math.min(c.r, 10);
    if (c.r === 14) a++;
  }
  const soft = a > 0 && t + 10 <= 21;
  return { t: soft ? t + 10 : t, soft };
}
const isBJ = cards => cards.length === 2 && bjTotal(cards).t === 21;
const bjDesc = h => {
  if (!h || !h.cards.length) return '';
  const v = bjTotal(h.cards);
  if (isBJ(h.cards) && !h.fromSplit) return 'Blackjack';
  if (v.t > 21) return 'Bust (' + v.t + ')';
  return (v.soft ? 'Soft ' : 'Hard ') + v.t;
};
const DEALER_BUST = {
  2: 0.35,
  3: 0.37,
  4: 0.4,
  5: 0.42,
  6: 0.42,
  7: 0.26,
  8: 0.24,
  9: 0.23,
  10: 0.23,
  11: 0.17,
};
const SHOE_POS = V3(2.45, 0.42, BJC.z + 0.6),
  DISCARD_POS = V3(-2.45, 0.2, BJC.z + 0.6),
  RACK_POS = V3(0, 0.18, BJC.z + 0.32);

const BJ = {
  started: false,
  players: [],
  me: null,
  dealer: null,
  shoe: [],
  cut: 0,
  running: 0,
  round: 0,
  decisions: 0,
  matched: 0,
  objs: [],
  group: null,
  focus: V3(0, 1, -2.5),
  phase: 'idle',
  discards: 0,
  lastBet: 25,
};

/* ----- basic strategy (6 decks, dealer stands on soft 17, double after split) ----- */
function basic(cards, u, canD, canP) {
  const v = bjTotal(cards),
    weak = u >= 2 && u <= 6,
    up = u === 11 ? 'an Ace' : u === 10 ? 'a 10' : 'a ' + u;
  if (canP && cards.length === 2 && bjVal(cards[0]) === bjVal(cards[1])) {
    const r = bjVal(cards[0]);
    if (r === 11)
      return { a: 'P', why: 'Always split Aces. Each Ace starts its own hand that can easily reach 21.' };
    if (r === 8)
      return {
        a: 'P',
        why: 'Always split 8s. 16 is the worst total in blackjack, but each 8 on its own is a decent start.',
      };
    if (r === 10) return { a: 'S', why: 'Never split 10s. 20 is already a great hand.' };
    if (r === 9 && u !== 7 && u !== 10 && u !== 11)
      return { a: 'P', why: `Split 9s against ${up}: two hands starting with 9 do better than one 18 here.` };
    if (r === 7 && u <= 7)
      return {
        a: 'P',
        why: `Split 7s against ${up}: 14 is a weak total, but two hands starting with 7 do better.`,
      };
    if (r === 6 && u <= 6)
      return {
        a: 'P',
        why: `Split 6s against ${up}: the dealer is likely to bust, so get more money on the table.`,
      };
    if (r === 4 && (u === 5 || u === 6))
      return { a: 'P', why: `Split 4s against ${up}, one of the dealer's weakest cards.` };
    if ((r === 2 || r === 3) && u <= 7) return { a: 'P', why: `Split small pairs against ${up}.` };
  }
  if (v.soft) {
    const t = v.t;
    if (t >= 19) return { a: 'S', why: `Soft ${t} is a strong hand. Stand.` };
    if (t === 18) {
      if (u >= 3 && u <= 6 && canD)
        return {
          a: 'D',
          why: `Soft 18 against ${up}: the dealer is weak, and with an Ace you can't bust on one card. Double.`,
        };
      if (u <= 8) return { a: 'S', why: `Soft 18 against ${up} is good enough. Stand.` };
      return {
        a: 'H',
        why: `Soft 18 is behind against ${up}. Hit: the Ace turns into a 1 if needed, so one card can't bust you.`,
      };
    }
    const lo = { 17: 3, 16: 4, 15: 4, 14: 5, 13: 5 }[t] || 99;
    if (canD && u >= lo && u <= 6)
      return {
        a: 'D',
        why: `Soft ${t} against ${up}: one card can't bust you and the dealer is weak. Double.`,
      };
    return { a: 'H', why: `Soft ${t} can't bust on one card (the Ace becomes a 1). Hit to improve.` };
  }
  const t = v.t;
  if (t >= 17) return { a: 'S', why: `Hard ${t}: most cards would bust you. Stand.` };
  if (t >= 13)
    return weak
      ? {
          a: 'S',
          why: `Hard ${t} against ${up}: the dealer has a weak card and busts often. Stand and let the dealer take the risk.`,
        }
      : {
          a: 'H',
          why: `Hard ${t} against ${up}: the dealer will usually finish with 17 or more, so standing loses most of the time. Hit.`,
        };
  if (t === 12)
    return u >= 4 && u <= 6
      ? { a: 'S', why: `12 against ${up}: the dealer busts often with this card. Stand.` }
      : { a: 'H', why: `12 against ${up}: only a 10-value card busts you. Hit.` };
  if (t === 11)
    return canD && u !== 11
      ? { a: 'D', why: '11 is the best total to double on: any 10-value card makes 21.' }
      : { a: 'H', why: "11 can't bust. Hit." };
  if (t === 10)
    return canD && u <= 9
      ? { a: 'D', why: `10 against ${up}: you're ahead of the dealer. Double.` }
      : { a: 'H', why: "10 can't bust. Hit." };
  if (t === 9)
    return canD && u >= 3 && u <= 6
      ? { a: 'D', why: `9 against a weak ${u}: double.` }
      : { a: 'H', why: "9 can't bust. Hit." };
  return { a: 'H', why: `${t} can't bust with one card. Hit.` };
}
const ACT_NAME = { H: 'Hit', S: 'Stand', D: 'Double', P: 'Split' };

/* ----- shoe ----- */
function bjNewShoe() {
  const s = [];
  for (let d = 0; d < 6; d++) s.push(...FULL_DECK);
  BJ.shoe = shuffle(s);
  BJ.cut = Math.floor(312 * 0.25);
  BJ.running = 0;
  BJ.discards = 0;
  bjDiscardVisual();
  log('The dealer shuffles a new shoe (6 decks).', 'sys');
}
const trueCount = () => BJ.running / Math.max(1, BJ.shoe.length / 52);
function bjDraw() {
  const c = BJ.shoe.pop();
  return c;
}
function bjCount(c) {
  const v = bjVal(c);
  if (v <= 6) BJ.running++;
  else if (v >= 10) BJ.running--;
}

/* ----- 3D table ----- */
let bjDiscardMesh = null;
function bjDiscardVisual() {
  if (!bjDiscardMesh) return;
  const h = Math.max(0.01, BJ.discards * 0.0025);
  bjDiscardMesh.scale.y = h / 0.1;
  bjDiscardMesh.position.y = 0.12 + h / 2;
}
// The half-oval table shared by every dealer game: felt, wood apron, padded rail and legs.
function halfTable(g, c0 = '#2a7d58', c1 = '#154a33') {
  const ft = canvasTex(512, 512, (c, w, h) => {
    const gr = c.createRadialGradient(256, 256, 30, 256, 256, 300);
    gr.addColorStop(0, c0);
    gr.addColorStop(1, c1);
    c.fillStyle = gr;
    c.fillRect(0, 0, w, h);
    for (let i = 0; i < 4000; i++) {
      c.fillStyle = `rgba(255,255,255,${Math.random() * 0.03})`;
      c.fillRect(Math.random() * w, Math.random() * h, 2, 2);
    }
  });
  const bjFelt = new THREE.MeshStandardMaterial({ map: ft, roughness: 0.95 });
  const top = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 0.1, 96, 1, false, -Math.PI / 2, Math.PI), [
    woodMat,
    bjFelt,
    woodMat,
  ]);
  top.scale.set(BJC.rx, 1, BJC.rz);
  top.position.z = BJC.z;
  top.receiveShadow = true;
  g.add(top);
  const ap = new THREE.Mesh(
    new THREE.CylinderGeometry(1, 0.95, 0.34, 96, 1, false, -Math.PI / 2, Math.PI),
    woodMat,
  );
  ap.scale.set(BJC.rx + 0.3, 1, BJC.rz + 0.3);
  ap.position.set(0, -0.13, BJC.z);
  ap.castShadow = true;
  g.add(ap);
  class Arc3 extends THREE.Curve {
    getPoint(t, tg = new THREE.Vector3()) {
      const a = t * Math.PI;
      return tg.set(Math.cos(a) * (BJC.rx + 0.14), 0.08, BJC.z + Math.sin(a) * (BJC.rz + 0.14));
    }
  }
  const rl = new THREE.Mesh(
    new THREE.TubeGeometry(new Arc3(), 120, 0.18, 14, false),
    new THREE.MeshStandardMaterial({ color: 0x2a1510, roughness: 0.42 }),
  );
  rl.castShadow = true;
  g.add(rl);
  const edge = new THREE.Mesh(new THREE.BoxGeometry(2 * (BJC.rx + 0.45), 0.4, 0.36), woodMat);
  edge.position.set(0, -0.1, BJC.z - 0.16);
  edge.castShadow = true;
  g.add(edge);
  [-1.6, 1.6].forEach(x => {
    const l = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.55, 2.1, 24), woodMat);
    l.position.set(x, (FLOOR - 0.3) / 2, 0.2);
    g.add(l);
  });
}
function bjBuildTable() {
  const g = new THREE.Group();
  scene.add(g);
  BJ.group = g;
  halfTable(g);
  const txt = (text, w, h, font, pos, col = 'rgba(240,210,143,.85)') => {
    const t = canvasTex(1024, Math.round((1024 * h) / w), (c, W, H) => {
      c.fillStyle = col;
      c.font = font;
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(text, W / 2, H / 2);
    });
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ map: t, transparent: true, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.copy(pos);
    g.add(m);
  };
  txt('BLACKJACK PAYS 3 TO 2', 3.9, 0.48, 'bold 92px Georgia, serif', V3(0, 0.054, 0.15));
  txt(
    'Dealer must stand on all 17s  ·  No insurance',
    3.6,
    0.28,
    'italic 54px Georgia, serif',
    V3(0, 0.054, 0.62),
    'rgba(240,210,143,.6)',
  );
  [90, ...BJ_SPOTS].forEach(d => {
    const r = new THREE.Mesh(
      new THREE.RingGeometry(0.3, 0.345, 40),
      new THREE.MeshBasicMaterial({
        color: 0xf0d28f,
        transparent: true,
        opacity: 0.6,
        side: THREE.DoubleSide,
      }),
    );
    r.rotation.x = -Math.PI / 2;
    r.position.copy(bjAt(d, 0.6, 0.054));
    g.add(r);
  });
  // dealer side: chip rack, shoe, discard tray
  const rack = new THREE.Mesh(
    new THREE.BoxGeometry(2.3, 0.1, 0.5),
    new THREE.MeshStandardMaterial({ color: 0x1d120c, roughness: 0.4 }),
  );
  rack.position.copy(RACK_POS).setY(0.08);
  g.add(rack);
  [
    [1000, -0.9],
    [500, -0.55],
    [100, -0.2],
    [25, 0.15],
    [5, 0.5],
    [1, 0.85],
  ].forEach(([v, x]) => {
    const p = makePile(v * 6, { den: [v], perCol: 6, maxCols: 1 });
    p.position.set(x, 0.13, RACK_POS.z);
    g.add(p);
  });
  const shoe = new THREE.Mesh(
    new THREE.BoxGeometry(0.62, 0.38, 0.92),
    new THREE.MeshStandardMaterial({ color: 0x4a1418, roughness: 0.5 }),
  );
  shoe.position.copy(SHOE_POS).setY(0.24);
  shoe.rotation.y = -0.45;
  shoe.castShadow = true;
  g.add(shoe);
  const shoeTop = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.02, 0.7), [
    edgeMat,
    edgeMat,
    backMat,
    edgeMat,
    edgeMat,
    edgeMat,
  ]);
  shoeTop.position.copy(SHOE_POS).setY(0.44);
  shoeTop.rotation.y = -0.45;
  g.add(shoeTop);
  const tray = new THREE.Mesh(
    new THREE.BoxGeometry(0.64, 0.08, 0.86),
    new THREE.MeshStandardMaterial({ color: 0x1d120c }),
  );
  tray.position.copy(DISCARD_POS).setY(0.08);
  tray.rotation.y = 0.45;
  g.add(tray);
  bjDiscardMesh = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.1, 0.7), [
    edgeMat,
    edgeMat,
    backMat,
    edgeMat,
    edgeMat,
    edgeMat,
  ]);
  bjDiscardMesh.position.copy(DISCARD_POS);
  bjDiscardMesh.rotation.y = 0.45;
  g.add(bjDiscardMesh);
  bjDiscardVisual();
  // the dealer
  const D = { key: 'dealer', name: 'Dealer', color: 0x1f4d3a, skin: 0xd9a882, acc: 'bowtie' };
  const av = makeAvatar(D);
  av.root.position.set(0, 0.35, BJC.z - 0.95);
  av.root.lookAt(0, 0.35, 5);
  scene.add(av.root);
  BJ.dealer = {
    dealer: true,
    av,
    P: { name: 'Dealer', key: 'dealer', css: '#f0d28f' },
    seat: 20,
    hands: [{ cards: [], objs: [] }],
    el: bjMakeTag('Dealer', 'Stands on all 17s', '#f0d28f'),
  };
}
function bjMakeTag(name, style, css) {
  const el = document.createElement('div');
  el.className = 'seat';
  el.style.setProperty('--pc', css);
  el.innerHTML = `<div class="bubble" hidden></div><div class="plate"><div class="prow"><span class="pname">${name}</span></div><div class="pstyle">${style}</div><div class="pmeta"><span class="stk"></span><span class="act-badge"></span><span class="mood" hidden></span><span class="dots" hidden><i></i><i></i><i></i></span></div><div class="xray" hidden><span class="xc"></span><span class="thought" hidden></span></div></div>`;
  labelsEl.appendChild(el);
  return el;
}
function bjLbl() {
  const b = document.createElement('div');
  b.className = 'betlbl';
  b.hidden = true;
  labelsEl.appendChild(b);
  return b;
}

/* ----- entering blackjack ----- */
function bjInit() {
  MODE = 'blackjack';
  [felt, apron, rail, ped, foot, deckMesh, dealerBtn, ring, ...slotMeshes].forEach(o => (o.visible = false));
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
    p.sitting = false;
    p.el.hidden = true;
  }
  bjBuildTable();
  BJ.me = { human: true, deg: 90, stack: START, hands: [], P: { name: 'You', key: 'you' }, lbls: [] };
  $('#handInfo').textContent = 'Blackjack · Bets $10 to $500';
  $('#rankBtn').hidden = true;
  $('#bombBtn').hidden = true;
  $('#bombNextBtn').hidden = true;
  $('#bombRow').hidden = true;
  $('#oppHelp').textContent =
    'Up to 4 players can sit with you. They take seats around the table in this order, alternating left and right of you.';
  $('#adviceBox').hidden = true;
  const rs = $('#readLabel').closest('.coach-section');
  rs.querySelector('.eyebrow').textContent = 'Your decisions';
  $('#readLabel').textContent = 'No decisions yet';
  $('#readText').textContent =
    'Each time you act, the coach checks it against basic strategy, the mathematically best way to play every hand.';
  [...$('#trackLabels').children].forEach(
    (el, i) => (el.textContent = ['Bet', 'Deal', 'Players', 'Dealer', 'Payout'][i]),
  );
  $('#stageTitle').textContent = 'Take a seat';
  $('#stageText').textContent = 'Choose your settings and who joins you, then press "Start game".';
  lastMove('The dealer is shuffling.');
  document.querySelector('#actionbar .actions:not(#bjActions)').hidden = true;
  document.querySelector('#actionbar .presets:not(#bjPresets)').hidden = true;
  $('#raiseRange').hidden = true;
  $('#bjActions').hidden = false;
  $('#bjPresets').hidden = false;
  $('#bjRange').hidden = false;
  $('#sizerNote').textContent = 'Choose your bet, then press Deal.';
  bjNewShoe();
  bjSeat();
  bjRenderBar();
  bjSetButtons('none');
}
function bjSeat() {
  BJ.players.forEach(p => {
    if (p.av) scene.remove(p.av.root);
    if (p.chair) scene.remove(p.chair);
    if (p.el) p.el.remove();
    (p.lbls || []).forEach(l => l.remove());
    if (p.stackPile) scene.remove(p.stackPile);
  });
  const chosen = SETUP.order
    .filter(k => SETUP.on[k])
    .slice(0, 4)
    .map(k => PERSONAS.find(P => P.key === k));
  BJ.players = chosen.map((P, i) => {
    const deg = BJ_SPOTS[i];
    const m = BJ_META[P.key];
    const p = {
      P,
      deg,
      seat: 10 + i,
      stack: START,
      hands: [],
      lbls: [],
      tilt: 0,
      hot: 0,
      losses: 0,
      lastBet: 0,
      thinking: false,
      thought: '',
      last: '',
      winT: -9,
    };
    p.chair = makeChair();
    p.chair.position.copy(bjAt(deg, 1.25, 0));
    p.chair.lookAt(0, 0, BJC.z + 0.4);
    scene.add(p.chair);
    p.av = makeAvatar(P);
    p.av.root.position.copy(bjAt(deg, 1.25, 0));
    p.av.root.lookAt(0, 0, BJC.z + 0.4);
    scene.add(p.av.root);
    p.el = bjMakeTag(P.name, m.style, P.css);
    return p;
  });
  BJ.me.stack = START;
  [BJ.me, ...BJ.players].forEach(bjStackPile);
  bjUpdateTags();
}
function bjStackPile(p) {
  if (p.stackPile) scene.remove(p.stackPile);
  p.stackPile = makePile(p.stack, { den: [100, 25, 5], perCol: 10, maxCols: 5 });
  p.stackPile.position.copy(bjAt(p.deg, 0.93, 0.055));
  const a = (p.deg * Math.PI) / 180;
  p.stackPile.position.x += Math.sin(a) * 0.55;
  p.stackPile.position.z -= Math.cos(a) * 0.4;
  scene.add(p.stackPile);
}

/* ----- positions ----- */
function bjCardPos(p, hi, k) {
  if (p.dealer) return V3(-0.29 + k * 0.6, 0.066 + k * 0.004, BJC.z + 0.95);
  const base = bjAt(p.deg, 0.82, 0.066 + k * 0.009),
    yaw = bjYaw(p.deg),
    n = p.hands.length;
  const off = (hi - (n - 1) / 2) * 0.78;
  base.x += Math.cos(yaw) * (off + k * 0.2) - Math.sin(yaw) * (k * 0.13);
  base.z += -Math.sin(yaw) * (off + k * 0.2) - Math.cos(yaw) * (k * 0.13);
  return base;
}
function bjBetPos(p, hi) {
  const b = bjAt(p.deg, 0.6, 0.055),
    yaw = bjYaw(p.deg),
    n = p.hands.length || 1,
    off = (hi - (n - 1) / 2) * 0.78;
  b.x += Math.cos(yaw) * off;
  b.z -= Math.sin(yaw) * off;
  return b;
}
async function bjDealCard(p, hi, up = true, count = true) {
  const c = bjDraw(),
    h = p.hands[hi];
  h.cards.push(c);
  if (up && count) bjCount(c);
  const o = makeCard(c);
  o.yaw.position.copy(SHOE_POS);
  BJ.objs.push(o);
  h.objs.push(o);
  const pos = bjCardPos(p, hi, h.cards.length - 1),
    yaw = p.dealer ? 0 : bjYaw(p.deg),
    y0 = rand(-0.5, 0.5);
  await animate(260, k => {
    o.yaw.position.lerpVectors(SHOE_POS, pos, k);
    o.yaw.position.y += Math.sin(Math.PI * k) * 0.3;
    o.yaw.rotation.y = y0 + (yaw - y0) * k;
  });
  if (up) await flip(o, true);
  bjRenderBar();
  bjUpdateTags();
  return c;
}
async function bjRelayout(p) {
  const moves = [];
  p.hands.forEach((h, hi) => {
    h.objs.forEach((o, k) => moves.push(moveTo(o.yaw, bjCardPos(p, hi, k), 260, 0.1)));
    if (h.pile) moves.push(moveTo(h.pile, bjBetPos(p, hi), 260, 0.05));
  });
  await Promise.all(moves);
}
function bjBetPile(p, hi) {
  const h = p.hands[hi];
  if (h.pile) scene.remove(h.pile);
  h.pile = makePile(h.bet);
  h.pile.position.copy(bjBetPos(p, hi));
  scene.add(h.pile);
}

/* ----- tags + action bar ----- */
const mini2 = c => miniHTML(c);
function bjUpdateTags() {
  const d = BJ.dealer;
  if (!d) return;
  const dh = d.hands[0],
    shown = dh.objs.filter(o => o.up).map(o => o.c);
  d.el.querySelector('.stk').textContent = dh.cards.length
    ? shown.length === dh.cards.length
      ? bjTotal(dh.cards).t
      : 'Shows ' + (shown.length ? bjVal(shown[0]) : '–')
    : '';
  const dx = d.el.querySelector('.xray');
  if (G.xray && dh.cards.length > 1 && shown.length < dh.cards.length) {
    dx.hidden = false;
    dx.querySelector('.xc').innerHTML = 'Hole card: ' + mini2(dh.cards[1]);
  } else dx.hidden = true;
  d.el.classList.toggle('acting', BJ.phase === 'dealer');
  for (const p of BJ.players) {
    const el = p.el;
    el.querySelector('.stk').textContent = fmt(p.stack);
    const ab = el.querySelector('.act-badge');
    ab.textContent = p.last;
    ab.className =
      'act-badge ' +
      ({
        Stand: 'Check',
        Hit: 'Call',
        Double: 'Raise',
        Split: 'Raise',
        Bust: 'Fold',
        Blackjack: 'Raise',
        Win: 'Call',
        Lose: 'Fold',
        Push: 'Check',
      }[p.last] || '');
    el.querySelector('.dots').hidden = !p.thinking;
    el.classList.toggle('acting', BJ.acting === p);
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
    const xr = el.querySelector('.xray');
    if (G.xray && p.thought) {
      xr.hidden = false;
      xr.querySelector('.xc').innerHTML = '';
      const th = xr.querySelector('.thought');
      th.textContent = p.thought;
      th.hidden = false;
    } else xr.hidden = true;
  }
  // hand totals and bets next to each hand
  for (const p of [BJ.me, ...BJ.players, d]) {
    p.hands.forEach((h, hi) => {
      if (!h.lbl) {
        h.lbl = bjLbl();
        p.lbls = p.lbls || [];
        p.lbls.push(h.lbl);
      }
      const shownC = h.objs.filter(o => o.up).map(o => o.c);
      if (!shownC.length) {
        h.lbl.hidden = true;
        return;
      }
      const v = bjTotal(shownC);
      h.lbl.hidden = false;
      h.lbl.textContent =
        (isBJ(h.cards) && !h.fromSplit && shownC.length === 2 && !p.dealer
          ? 'Blackjack'
          : v.t > 21
            ? 'Bust'
            : (v.soft && v.t < 21 ? 'Soft ' : '') + v.t) + (h.bet ? ' · ' + fmt(h.bet) : '');
      h.lbl.style.color = v.t > 21 ? 'var(--bad)' : '';
    });
  }
}
function bjRenderBar() {
  const me = BJ.me,
    d = BJ.dealer;
  const handHTML = h => h.cards.map(c => cardHTML(c)).join('');
  let groups = '';
  if (me.hands.length && me.hands[0].cards.length) {
    me.hands.forEach((h, i) => {
      const v = bjTotal(h.cards);
      groups += `<div class="cg${BJ.curHand === h ? ' cur' : ''}"><span class="cg-l">${me.hands.length > 1 ? 'Hand ' + (i + 1) : 'Your hand'} · ${v.t}</span><div class="cg-c">${handHTML(h)}</div></div>`;
    });
  } else
    groups = `<div class="cg"><span class="cg-l">Your hand</span><div class="cg-c"><span class="pc slot"></span><span class="pc slot"></span></div></div>`;
  const dh = d ? d.hands[0] : { cards: [], objs: [] };
  const dcards = dh.cards.length
    ? dh.objs.map(o => (o.up ? cardHTML(o.c) : '<span class="pc back"></span>')).join('')
    : '<span class="pc slot"></span><span class="pc slot"></span>';
  const shown = dh.objs.filter(o => o.up).map(o => o.c);
  $('#myCards').innerHTML =
    `${groups}<span class="cdiv"></span><div class="cg"><span class="cg-l">Dealer${shown.length ? ' · ' + bjTotal(shown).t : ''}</span><div class="cg-c">${dcards}</div></div>`;
  const cur = BJ.curHand || me.hands[0];
  $('#myHandName').textContent =
    BJ.phase === 'bet' || !cur || !cur.cards.length ? 'Place your bet' : bjDesc(cur);
  $('#myStack').textContent = fmt(me.stack);
  const tb = me.hands.reduce((a, h) => a + (h.bet || 0), 0);
  $('#myRole').textContent = tb ? ' · Bet ' + fmt(tb) : '';
}
function bjSetButtons(mode, opts = {}) {
  $('#actionbar').classList.toggle('myturn', mode === 'bet');
  const show = (id, on) => {
    $(id).hidden = !on;
  };
  show('#bjDeal', mode === 'bet');
  ['#bjHit', '#bjStand', '#bjDouble', '#bjSplit'].forEach(id => show(id, mode !== 'bet'));
  const play = mode === 'play';
  $('#bjHit').disabled = !play;
  $('#bjStand').disabled = !play;
  $('#bjDouble').disabled = !(play && opts.canD);
  $('#bjSplit').disabled = !(play && opts.canP);
  document.querySelectorAll('#bjActions .act').forEach(b => b.classList.remove('pick'));
  if (play && G.hints && opts.rec)
    ({ H: '#bjHit', S: '#bjStand', D: '#bjDouble', P: '#bjSplit' })[opts.rec] &&
      $({ H: '#bjHit', S: '#bjStand', D: '#bjDouble', P: '#bjSplit' }[opts.rec]).classList.add('pick');
  const betOn = mode === 'bet';
  $('#bjRange').disabled = !betOn;
  document
    .querySelectorAll('#bjPresets button')
    .forEach(b => (b.disabled = !betOn || +b.dataset.v > BJ.me.stack));
  $('#bjDeal').disabled = !betOn;
}
function bjStage(i, title, text) {
  $('#stageTitle').textContent = title;
  $('#stageText').textContent = text;
  [...$('#track').children].forEach((el, k) => (el.className = k < i ? 'done' : k === i ? 'now' : ''));
  [...$('#trackLabels').children].forEach((el, k) => (el.className = k === i ? 'now' : ''));
}
function bjShowAdvice(h, rec, opts) {
  const box = $('#bjAdvice');
  box.hidden = false;
  const up = BJ.dealer.hands[0].cards[0],
    u = bjVal(up),
    v = bjTotal(h.cards);
  $('#bjYou').textContent = bjDesc(h);
  $('#bjUp').innerHTML = mini2(up) + (u === 11 ? ' (Ace)' : '');
  // chance the next card busts you (counts unseen cards: the shoe plus the dealer's hole card)
  let bust = 0;
  if (!v.soft) {
    const unseen = BJ.shoe.concat([BJ.dealer.hands[0].cards[1]]);
    bust =
      unseen.filter(c => {
        const cv = c.r === 14 ? 1 : Math.min(c.r, 10);
        return v.t + cv > 21;
      }).length / unseen.length;
  }
  $('#bjBust').textContent = pct(bust);
  $('#bjBustBar').style.width = pct(bust);
  const db = DEALER_BUST[u];
  $('#bjDBust').textContent = pct(db);
  $('#bjDBustBar').style.width = pct(db);
  $('#bjRecRow').hidden = !G.hints;
  $('#bjRecChip').textContent = ACT_NAME[rec.a];
  $('#bjRecChip').className = 'rec-chip ' + { H: 'call', S: 'check', D: 'raise', P: 'raise' }[rec.a];
  $('#bjRecWhy').textContent = rec.why;
}
function bjUpdateDecisions() {
  if (!BJ.decisions) return;
  $('#readLabel').textContent = `${BJ.matched} of ${BJ.decisions} by the book`;
  const r = BJ.matched / BJ.decisions;
  $('#readText').textContent =
    r >= 0.9
      ? 'You are playing close to perfect basic strategy. The house edge against you is about half a percent.'
      : r >= 0.7
        ? 'Mostly by the book. Check the coach pick when a spot feels unclear.'
        : 'You often go against basic strategy. That is fine while learning, but it costs money over time.';
}

/* ----- waiting for the player ----- */
let bjResolve = null;
function bjHumanBet() {
  return new Promise(res => {
    const me = BJ.me;
    if (me.stack < 10) {
      me.stack = START;
      me.startStack = START;
      bjStackPile(me);
      log('You rebuy for $1,000.', 'sys');
    }
    const r = $('#bjRange');
    r.min = 10;
    r.max = Math.min(500, me.stack);
    r.step = 5;
    r.value = clamp(BJ.lastBet, 10, +r.max);
    bjDealLabel();
    bjSetButtons('bet');
    bjRenderBar();
    $('#turnStatus').innerHTML = '<b>Place your bet.</b> Then press Deal.';
    bjResolve = v => {
      bjResolve = null;
      res(v);
    };
  });
}
function bjDealLabel() {
  $('#bjDeal').innerHTML = 'Deal · ' + fmt(+$('#bjRange').value) + '<kbd>Enter</kbd>';
}
function bjHumanAct(h, opts, rec) {
  return new Promise(res => {
    bjSetButtons('play', { ...opts, rec: rec.a });
    bjShowAdvice(h, rec, opts);
    $('#turnStatus').innerHTML =
      `<b>Your turn.</b> ${bjDesc(h)} against the dealer's ${bjVal(BJ.dealer.hands[0].cards[0]) === 11 ? 'Ace' : bjVal(BJ.dealer.hands[0].cards[0])}.`;
    bjResolve = a => {
      bjResolve = null;
      bjSetButtons('none');
      $('#turnStatus').textContent = '';
      res(a);
    };
  });
}

/* ----- bots ----- */
function bjBotBet(p) {
  const k = p.P.key,
    tc = trueCount();
  let b;
  if (k === 'marge') b = 10;
  else if (k === 'rico') b = p.losses >= 1 && p.lastBet ? p.lastBet * 2 : round5(rand(25, 100));
  else if (k === 'dev') b = tc >= 2 ? Math.min(10 * Math.floor(tc) * 2, 200) : 10;
  else if (k === 'gus') b = 25;
  else b = round5(rand(20, 50));
  return Math.max(10, Math.min(round5(b), p.stack, 500));
}
function bjBotDecide(p, h, opts) {
  const k = p.P.key,
    v = bjTotal(h.cards),
    up = BJ.dealer.hands[0].cards[0],
    u = bjVal(up),
    book = basic(h.cards, u, opts.canD, opts.canP);
  const pair = opts.canP;
  let a, why;
  if (k === 'dev' || k === 'yuki') {
    a = book.a;
    why = book.why;
    if (k === 'dev' && Math.abs(trueCount()) >= 2)
      why += ` (Count is ${trueCount() > 0 ? '+' : ''}${trueCount().toFixed(1)}.)`;
  } else if (k === 'marge') {
    if (pair && bjVal(h.cards[0]) === 11) {
      a = 'P';
      why = 'Aces are worth splitting.';
    } else if (opts.canD && v.t === 11 && !v.soft) {
      a = 'D';
      why = '11 is the one hand worth doubling.';
    } else if (!v.soft && v.t >= 12) {
      a = 'S';
      why = `${v.t} could bust if I hit. I never risk that.`;
    } else if (v.soft && v.t >= 18) {
      a = 'S';
      why = 'Good enough.';
    } else {
      a = 'H';
      why = `${v.t} can't bust, so a card is safe.`;
    }
  } else if (k === 'rico') {
    if (pair) {
      a = 'P';
      why = 'A pair? Split it, more action!';
    } else if (opts.canD && v.t >= 9 && v.t <= 12) {
      a = 'D';
      why = `${v.t}? Double it up!`;
    } else if (v.t < (v.soft ? 19 : 17) || (v.t === 17 && Math.random() < 0.3)) {
      a = 'H';
      why = v.t >= 15 ? `Feeling a small card coming. Hit ${v.t}!` : 'Need more. Hit.';
    } else {
      a = 'S';
      why = `${v.t}, I'll take it.`;
    }
    if (p.tilt > 0.4) why += ' (Still mad about losing.)';
  } else {
    // gus copies the dealer
    if (v.t < 17) {
      a = 'H';
      why = `Dealer hits below 17, so I do too.`;
    } else {
      a = 'S';
      why = `17 or more: the dealer would stand, so I stand.`;
    }
  }
  if (a === 'D' && !opts.canD) a = 'H';
  if (a === 'P' && !opts.canP) a = v.t >= 17 ? 'S' : 'H';
  return {
    a,
    why: `${bjDesc(h)} vs ${u === 11 ? 'an Ace' : u}. ${why}${a !== book.a && k !== 'dev' && k !== 'yuki' ? ' (Book says ' + ACT_NAME[book.a].toLowerCase() + '.)' : ''}`,
  };
}

/* ----- one hand for one player ----- */
async function bjPlayHand(p, hi) {
  const h = p.hands[hi];
  if (h.cards.length === 1) {
    await bjDealCard(p, hi);
  }
  while (true) {
    const v = bjTotal(h.cards);
    if (isBJ(h.cards) && !h.fromSplit) {
      p.last = 'Blackjack';
      if (!p.human) say(p, 'win', 0.5);
      log(
        `${p.human ? '<b>You</b> have' : '<b style="color:' + p.P.css + '">' + p.P.name + '</b> has'} <b>Blackjack</b>!`,
        'win',
      );
      break;
    }
    if (v.t > 21) {
      p.last = 'Bust';
      h.bust = true;
      log(
        `${p.human ? '<b>You</b> bust' : '<b style="color:' + p.P.css + '">' + p.P.name + '</b> busts'} with ${v.t}.`,
      );
      lastMove(
        `${p.human ? 'You' : p.P.name} went over 21 and ${p.human ? 'lose' : 'loses'} the bet right away, even if the dealer busts later.`,
      );
      if (!p.human) say(p, 'lose', 0.4);
      break;
    }
    if (v.t === 21 || h.splitAces || h.doubled) break;
    const u = bjVal(BJ.dealer.hands[0].cards[0]);
    const opts = {
      canD: h.cards.length === 2 && p.stack >= h.bet,
      canP:
        h.cards.length === 2 &&
        bjVal(h.cards[0]) === bjVal(h.cards[1]) &&
        p.hands.length < 2 &&
        p.stack >= h.bet,
    };
    let a;
    BJ.acting = p;
    BJ.curHand = p.human ? h : BJ.curHand;
    BJ.focus = p.human ? V3(0, 0.9, 3.2) : p.av.root.position.clone().setY(1);
    if (p.human) {
      bjRenderBar();
      const rec = basic(h.cards, u, opts.canD, opts.canP);
      a = await bjHumanAct(h, opts, rec);
      BJ.decisions++;
      if (a === rec.a) BJ.matched++;
      bjUpdateDecisions();
      if (a !== rec.a)
        log(
          `<span style="color:var(--muted)">Coach: the book play was ${ACT_NAME[rec.a].toLowerCase()}. ${esc(rec.why)}</span>`,
          'lesson',
        );
    } else {
      p.thinking = true;
      bjUpdateTags();
      lastMove(`Waiting for <b style="color:${p.P.css}">${p.P.name}</b> (${BJ_META[p.P.key].style})…`);
      const d = bjBotDecide(p, h, opts);
      p.thought = d.why;
      await wait(500 + p.P.think * 600 + Math.random() * 500);
      p.thinking = false;
      a = d.a;
    }
    const who = p.human ? '<b>You</b>' : `<b style="color:${p.P.css}">${p.P.name}</b>`;
    p.last = ACT_NAME[a];
    if (a === 'S') {
      log(`${who} ${p.human ? 'stand' : 'stands'} on ${v.t}.`);
      lastMove(`${who} stood on ${v.t}: no more cards for this hand.`);
      break;
    }
    if (a === 'H') {
      log(`${who} ${p.human ? 'hit' : 'hits'}.`);
      lastMove(`${who} hit: took one more card.`);
      await bjDealCard(p, hi);
      continue;
    }
    if (a === 'D') {
      p.stack -= h.bet;
      h.bet *= 2;
      h.doubled = true;
      bjBetPile(p, hi);
      bjStackPile(p);
      log(`${who} ${p.human ? 'double' : 'doubles'} to ${fmt(h.bet)}.`);
      lastMove(`${who} doubled: the bet doubles to ${fmt(h.bet)} and the hand gets exactly one more card.`);
      if (!p.human) say(p, 'raise', 0.3);
      await bjDealCard(p, hi);
      continue;
    }
    if (a === 'P') {
      p.stack -= h.bet;
      bjStackPile(p);
      const c2 = h.cards.pop(),
        o2 = h.objs.pop();
      const nh = { cards: [c2], objs: [o2], bet: h.bet, fromSplit: true, splitAces: c2.r === 14 };
      h.fromSplit = true;
      h.splitAces = c2.r === 14;
      p.hands.splice(hi + 1, 0, nh);
      log(`${who} ${p.human ? 'split' : 'splits'} the pair into two hands of ${fmt(h.bet)} each.`);
      lastMove(
        `${who} split: the pair becomes two separate hands, each with its own bet. Each hand gets a second card.`,
      );
      bjBetPile(p, hi + 1);
      await bjRelayout(p);
      await bjDealCard(p, hi);
      if (h.splitAces) {
        break;
      }
      continue;
    }
  }
  BJ.acting = null;
  bjRenderBar();
  bjUpdateTags();
  await wait(p.human ? 250 : 500);
}

/* ----- one round ----- */
async function bjRound() {
  BJ.round++;
  BJ.phase = 'bet';
  BJ.curHand = null;
  if (BJ.shoe.length < BJ.cut) {
    await wait(300);
    bjNewShoe();
  }
  const all = [...BJ.players, BJ.me].sort((a, b) => a.deg - b.deg); // dealer's left (your right) goes first
  [BJ.me, ...BJ.players].forEach(p => {
    p.hands = [];
    p.last = '';
    p.thought = '';
    p.startStack = p.stack;
  });
  BJ.dealer.hands = [{ cards: [], objs: [] }];
  $('#handInfo').textContent = `Round ${BJ.round} · Bets $10 to $500`;
  log(`Round ${BJ.round}`, 'hand');
  bjStage(
    0,
    'Place your bet',
    'Choose how much to bet, then press Deal. The other players bet too. Everyone plays against the dealer, not each other.',
  );
  lastMove('The bet goes in the circle in front of you before any cards are dealt.');
  $('#bjAdvice').hidden = true;
  bjRenderBar();
  bjUpdateTags();
  for (const p of BJ.players) {
    if (p.stack < 10) {
      p.stack = START;
      p.startStack = START;
      log(`<b style="color:${p.P.css}">${p.P.name}</b> rebuys for $1,000.`, 'sys');
      say(p, 'rebuy', 1);
    }
    const b = bjBotBet(p);
    p.lastBet = b;
    p.stack -= b;
    p.hands = [{ cards: [], objs: [], bet: b }];
    bjBetPile(p, 0);
    bjStackPile(p);
  }
  bjUpdateTags();
  const bet = await bjHumanBet();
  BJ.lastBet = bet;
  BJ.me.stack -= bet;
  BJ.me.hands = [{ cards: [], objs: [], bet }];
  bjBetPile(BJ.me, 0);
  bjStackPile(BJ.me);
  log(`You bet ${fmt(bet)}.`, 'sys');
  bjSetButtons('none');
  $('#turnStatus').textContent = '';
  BJ.phase = 'deal';
  bjStage(
    1,
    'The deal',
    'Everyone gets two cards face up. The dealer gets one face up and one face down, called the hole card.',
  );
  for (let r = 0; r < 2; r++) {
    for (const p of all) await bjDealCard(p, 0);
    await bjDealCard(BJ.dealer, 0, r === 0);
  }
  const dh = BJ.dealer.hands[0],
    up = dh.cards[0],
    u = bjVal(up);
  lastMove(
    `The dealer shows ${u === 11 ? 'an Ace' : u === 10 ? 'a 10-value card' : 'a ' + u}. The dealer busts about ${pct(DEALER_BUST[u])} of the time with this card.`,
  );
  // peek for blackjack
  let dealerBJ = false;
  if (u >= 10) {
    await wait(600);
    log(`The dealer checks under the ${u === 11 ? 'Ace' : '10'} for Blackjack.`, 'sys');
    lastMove(
      `With ${u === 11 ? 'an Ace' : 'a 10-value card'} showing, the dealer checks the hole card for Blackjack before anyone acts.`,
    );
    await wait(900);
    if (isBJ(dh.cards)) {
      dealerBJ = true;
      await flip(dh.objs[1], true);
      bjCount(dh.cards[1]);
      log('The dealer has <b>Blackjack</b>.', 'win');
    } else log('No Blackjack. Play continues.', 'sys');
    bjRenderBar();
    bjUpdateTags();
  }
  if (!dealerBJ) {
    BJ.phase = 'play';
    bjStage(
      2,
      "Players' turns",
      "Starting on the dealer's left (your right), each player hits, stands, doubles or splits. Going over 21 is a bust and loses right away.",
    );
    for (const p of all) {
      for (let hi = 0; hi < p.hands.length; hi++) await bjPlayHand(p, hi);
    }
    $('#bjAdvice').hidden = true;
    BJ.phase = 'dealer';
    bjStage(
      3,
      "Dealer's turn",
      'The dealer turns over the hole card and must hit until reaching 17 or more. The dealer has no choices, only rules.',
    );
    BJ.focus = V3(0, 0.3, BJC.z + 0.9);
    await wait(400);
    await flip(dh.objs[1], true);
    bjCount(dh.cards[1]);
    bjRenderBar();
    bjUpdateTags();
    log(`The dealer turns over ${mini2(dh.cards[1])}: ${bjTotal(dh.cards).t}.`, 'sys');
    const live = all.some(p => p.hands.some(h => !h.bust && !(isBJ(h.cards) && !h.fromSplit)));
    if (live) {
      while (bjTotal(dh.cards).t < 17) {
        lastMove(`The dealer has ${bjTotal(dh.cards).t}, below 17, so the dealer must hit.`);
        await wait(700);
        await bjDealCard(BJ.dealer, 0);
      }
      const dv = bjTotal(dh.cards).t;
      lastMove(
        dv > 21
          ? `The dealer busts with ${dv}! Every hand that didn't bust wins.`
          : `The dealer stands on ${dv}. Hands above ${dv} win, equal hands push, lower hands lose.`,
      );
      log(dv > 21 ? `The dealer <b>busts</b> with ${dv}.` : `The dealer stands on ${dv}.`, 'sys');
    } else lastMove('Every player hand is already decided, so the dealer does not need to draw.');
    await wait(600);
  }
  // payout
  BJ.phase = 'pay';
  bjStage(
    4,
    'Payout',
    'Wins pay 1 to 1. Blackjack pays 3 to 2. A tie is a push: you get your bet back. Busted hands always lose.',
  );
  const dv = bjTotal(dh.cards).t,
    dBust = dv > 21;
  const rows = [];
  for (const p of all) {
    for (const h of p.hands) {
      const v = bjTotal(h.cards).t,
        pBJ = isBJ(h.cards) && !h.fromSplit;
      let res,
        win = 0;
      if (h.bust) {
        res = 'Lose';
      } else if (dealerBJ) {
        res = pBJ ? 'Push' : 'Lose';
      } else if (pBJ) {
        res = 'Blackjack';
        win = Math.floor(h.bet * 1.5);
      } else if (dBust || v > dv) {
        res = 'Win';
        win = h.bet;
      } else if (v === dv) {
        res = 'Push';
      } else res = 'Lose';
      h.result = res;
      h.win = win;
      rows.push({ p, h, res });
    }
  }
  const moves = [];
  for (const { p, h, res } of rows) {
    if (res === 'Lose') {
      moves.push(
        moveTo(h.pile, RACK_POS, 500, 0.3).then(() => {
          scene.remove(h.pile);
          h.pile = null;
        }),
      );
    } else {
      const back = h.bet + h.win;
      const go = async () => {
        if (h.win > 0) {
          const w = makePile(h.win);
          w.position.copy(RACK_POS);
          scene.add(w);
          await moveTo(w, bjBetPos(p, p.hands.indexOf(h)).add(V3(0.2, 0, 0)), 450, 0.3);
          await moveTo(w, p.stackPile.position.clone(), 450, 0.3);
          scene.remove(w);
        }
        await moveTo(h.pile, p.stackPile.position.clone(), 450, 0.3);
        scene.remove(h.pile);
        h.pile = null;
        p.stack += back;
        bjStackPile(p);
      };
      moves.push(go());
    }
  }
  await Promise.all(moves);
  // moods, chat, labels
  for (const p of all) {
    const net = p.stack - p.startStack;
    p.last = net > 0 ? 'Win' : net < 0 ? 'Lose' : 'Push';
    if (p.human) continue;
    if (net < 0) {
      p.losses++;
      if (p.P.key === 'rico' && p.losses >= 2 && p.tilt < 0.4) {
        p.tilt = 0.8;
        log(
          `<b style="color:${p.P.css}">${p.P.name}</b> is <b>on tilt</b> after losing ${p.losses} in a row and starts betting bigger to win it back. That is called chasing losses.`,
          'lesson',
        );
        say(p, 'tilt', 0.9);
      } else say(p, 'lose', 0.25);
    } else {
      if (net > 0) {
        p.losses = 0;
        p.tilt *= 0.4;
        if (net >= 100) p.hot = 1;
        say(p, 'win', 0.3);
      }
    }
    if (net <= 0) p.hot *= 0.5;
    if (net > 0) p.winT = gameNow() / 1000;
  }
  bjUpdateTags();
  bjRenderBar();
  // banner
  const mine = rows.filter(r => r.p.human),
    net = BJ.me.stack - BJ.me.startStack;
  $('#bEyebrow').textContent = `Round ${BJ.round} result`;
  $('#bTitle').textContent =
    net > 0 ? `You win ${fmt(net)}` : net < 0 ? `You lose ${fmt(-net)}` : 'Push: you get your bet back';
  $('#bSub').textContent = dealerBJ
    ? 'The dealer had Blackjack.'
    : dBust
      ? `The dealer busted with ${dv}.`
      : `The dealer finished with ${dv}.`;
  const list = $('#bList');
  list.innerHTML = '';
  list.insertAdjacentHTML(
    'beforeend',
    `<li class="potline"><span class="who">Dealer</span>${dh.cards.map(mini2).join('')}<span class="hn">${dealerBJ ? 'Blackjack' : dBust ? 'Bust (' + dv + ')' : dv}</span></li>`,
  );
  rows.forEach(({ p, h, res }) => {
    const won = res === 'Win' || res === 'Blackjack';
    list.insertAdjacentHTML(
      'beforeend',
      `<li class="${won ? 'won' : ''}"><span class="who" style="color:${p.human ? 'var(--ink)' : p.P.css}">${p.human ? 'You' : p.P.name}</span>${h.cards.map(mini2).join('')}<span class="hn">${bjDesc(h)} · ${res}${won ? ' +' + fmt(h.win) : res === 'Lose' ? ' −' + fmt(h.bet) : ''}</span></li>`,
    );
  });
  let lesson = '';
  const r0 = mine[0];
  if (r0) {
    if (r0.res === 'Blackjack')
      lesson =
        'A Blackjack is an Ace plus a 10-value card on the first two cards. It pays 3 to 2, so a $20 bet wins $30.';
    else if (r0.h.bust)
      lesson =
        'Busting loses even if the dealer busts afterward. That is the house advantage in blackjack: players act first.';
    else if (dBust)
      lesson =
        'The dealer busted. This is why standing on a stiff hand (12 to 16) against a weak dealer card can be right.';
    else if (r0.res === 'Push') lesson = 'A push is a tie. Nobody wins, and your bet comes back.';
    else if (r0.res === 'Lose')
      lesson =
        'Even perfect play loses plenty of hands. Basic strategy only cuts the house edge to about half a percent.';
    else lesson = 'Nice. Following basic strategy wins the most money over the long run.';
  }
  $('#bLesson').textContent = lesson;
  $('#bNext').innerHTML = 'Next round<kbd>Space</kbd>';
  await new Promise(res => {
    $('#banner').hidden = false;
    nextResolve = res;
    $('#turnStatus').textContent = 'Round over.';
  });
  // clear the table
  BJ.phase = 'idle';
  const objs = BJ.objs;
  BJ.objs = [];
  await Promise.all(objs.map((o, i) => moveTo(o.yaw, DISCARD_POS.clone().setY(0.3 + i * 0.003), 320, 0.3)));
  objs.forEach(o => scene.remove(o.yaw));
  cardObjs = [];
  BJ.discards += objs.length;
  bjDiscardVisual();
  [BJ.me, ...BJ.players, BJ.dealer].forEach(p => {
    (p.lbls || []).forEach(l => l.remove());
    p.lbls = [];
    p.hands = [];
  });
  BJ.dealer.hands = [{ cards: [], objs: [] }];
}
async function bjLoop() {
  const g = GEN;
  try {
    while (g === GEN) await bjRound();
  } catch (e) {
    if (!(e instanceof Reset)) console.error(e);
  }
}
function bjStart() {
  if (BJ.started) return;
  bjSeat();
  BJ.started = true;
  BJ.round = 0;
  BJ.decisions = 0;
  BJ.matched = 0;
  $('#readLabel').textContent = 'No decisions yet';
  bjLoop();
}
function bjNewGame() {
  GEN++;
  anims.clear();
  nextResolve = null;
  bjResolve = null;
  BJ.objs.forEach(o => scene.remove(o.yaw));
  BJ.objs = [];
  cardObjs = [];
  [BJ.me, ...BJ.players, BJ.dealer].forEach(p => {
    (p.hands || []).forEach(h => {
      if (h.pile) scene.remove(h.pile);
    });
    (p.lbls || []).forEach(l => l.remove());
    p.lbls = [];
    p.hands = [];
  });
  BJ.dealer.hands = [{ cards: [], objs: [] }];
  G.userPaused = false;
  app.classList.remove('paused');
  setPauseLabel();
  $('#banner').hidden = true;
  $('#bjAdvice').hidden = true;
  $('#logList').innerHTML = '';
  BJ.started = false;
  BJ.phase = 'idle';
  bjNewShoe();
  bjSetButtons('none');
  $('#stageTitle').textContent = 'New game';
  $('#stageText').textContent = 'Choose your settings and who joins you, then press "Start game".';
  lastMove('Everyone is back to $1,000.');
  renderStartCard();
  $('#startCard').hidden = false;
  bjRenderBar();
}

/* ----- frame hook ----- */
function bjFrame(t) {
  const tags = [];
  const anim = (p, isDealer) => {
    const av = p.av;
    av.body.scale.y = 1 + Math.sin(t * 1.6 + (p.seat || 0)) * 0.01;
    const local = av.root.worldToLocal(BJ.focus.clone());
    let ty = clamp(Math.atan2(local.x, local.z), -0.9, 0.9);
    av.headPivot.rotation.y += (ty - av.headPivot.rotation.y) * 0.06;
    const tz = p.thinking ? Math.sin(t * 2.2) * 0.14 : 0;
    av.headPivot.rotation.z += (tz - av.headPivot.rotation.z) * 0.1;
    const tx = p.thinking ? 0.25 : 0.1;
    av.headPivot.rotation.x += (tx - av.headPivot.rotation.x) * 0.06;
    if (!isDealer) {
      const dt = t - p.winT;
      av.body.position.y = -1.0 + (dt < 1.6 ? Math.abs(Math.sin(dt * 7)) * 0.14 * (1 - dt / 1.6) : 0);
      av.skin.emissive.setRGB(p.tilt * 0.22, 0, 0);
    }
    tags.push(p);
  };
  BJ.players.forEach(p => p.av && anim(p, false));
  if (BJ.dealer) anim(BJ.dealer, true);
  const avoid = [];
  for (const p of [BJ.me, ...BJ.players, BJ.dealer]) {
    if (!p) continue;
    (p.hands || []).forEach((h, hi) => {
      if (h.lbl && !h.lbl.hidden && h.cards.length) {
        const pos = p.dealer ? V3(0.3, 0.07, BJC.z + 0.35) : bjCardPos(p, hi, 0);
        if (!p.dealer) {
          const yaw = bjYaw(p.deg),
            out = p.human ? 0.55 : -0.42; // others: toward the middle, clear of their name tags
          pos.x += Math.sin(yaw) * out;
          pos.z += Math.cos(yaw) * out;
        }
        const r = project(pos, h.lbl, 0, 0, 'center');
        if (r) avoid.push(r);
      }
    });
  }
  layoutTags(tags, avoid);
}

/* ----- coach chat context ----- */
const BJ_RULES = `You are the friendly coach inside "My Wise Bet", an app where a complete beginner learns blackjack by playing against a dealer, with computer players at the same table. The player learns best visually and by example. Table rules: 6 decks, dealer stands on all 17s, Blackjack pays 3 to 2, double on any first two cards, one split per hand, split Aces get one card each, no insurance or surrender, bets $10 to $500. Answer in plain, encouraging language, usually 2 to 5 sentences unless asked for more. Use the real cards and amounts in the game state when it helps. Never claim to know the dealer's hole card unless the state lists it. You may point to parts of the app: the bust-chance bars in the coach panel, the "Coach pick" tag on the buttons, the X-ray option in the More menu, the Speed menu, Pause, and the table log. Write plain text with no markdown headings, bold or tables.`;
function bjSnapshot() {
  const L = [],
    cs = a => a.map(c => RANK_CH[c.r] + SUIT_CH[c.s]).join(' ');
  L.push(
    `Game: blackjack. Round ${BJ.round}. Stage: ${BJ.phase}. Cards left in the shoe: ${BJ.shoe.length}.`,
  );
  L.push(`The player has ${fmt(BJ.me.stack)} in chips.`);
  BJ.me.hands.forEach((h, i) =>
    L.push(
      `Player's hand ${i + 1}: ${cs(h.cards)} (${bjDesc(h)}), bet ${fmt(h.bet || 0)}${h.result ? ', result ' + h.result : ''}.`,
    ),
  );
  const dh = BJ.dealer.hands[0];
  if (dh.cards.length) {
    const shown = dh.objs.filter(o => o.up).map(o => o.c);
    L.push(
      `Dealer shows: ${cs(shown)}${shown.length < dh.cards.length ? ' plus one face-down hole card' + (G.xray ? ' (X-ray shows ' + cs([dh.cards[1]]) + ')' : '') : ''}.`,
    );
  }
  if (bjResolve && BJ.curHand && BJ.phase === 'play') {
    const u = bjVal(dh.cards[0]);
    const r = basic(BJ.curHand.cards, u, BJ.curHand.cards.length === 2, false);
    L.push(`It is the PLAYER's turn. Basic strategy says: ${ACT_NAME[r.a]}. Reason: ${r.why}`);
  }
  L.push('Other players at the table:');
  BJ.players.forEach(p =>
    L.push(
      `- ${p.P.name}, ${BJ_META[p.P.key].style} (${BJ_META[p.P.key].blurb}) Stack ${fmt(p.stack)}.${p.hands.map(h => ' Hand: ' + cs(h.cards) + ' (' + bjDesc(h) + '), bet ' + fmt(h.bet || 0) + '.').join('')}${p.tilt > 0.4 ? ' Currently ON TILT.' : ''}`,
    ),
  );
  L.push(`Player's decisions so far: ${BJ.matched} of ${BJ.decisions} matched basic strategy.`);
  const logs = [...document.querySelectorAll('#logList li')].slice(-25).map(li => li.textContent);
  if (logs.length) L.push('Recent table log:\n' + logs.join('\n'));
  return L.join('\n');
}

/* ----- wiring ----- */
const bjCast = $('#bjCast');
PERSONAS.slice(1).forEach(P =>
  bjCast.insertAdjacentHTML(
    'beforeend',
    `<div><span class="swatch" style="background:${P.css}"></span><span><b>${P.name}</b> · <span style="color:${P.css}">${BJ_META[P.key].style}</span><br>${BJ_META[P.key].blurb}</span></div>`,
  ),
);
$('#bjRange').oninput = bjDealLabel;
document.querySelectorAll('#bjPresets button').forEach(
  b =>
    (b.onclick = () => {
      $('#bjRange').value = Math.min(+b.dataset.v, +$('#bjRange').max);
      bjDealLabel();
    }),
);
$('#bjDeal').onclick = () => bjResolve && BJ.phase === 'bet' && bjResolve(+$('#bjRange').value);
[
  ['#bjHit', 'H'],
  ['#bjStand', 'S'],
  ['#bjDouble', 'D'],
  ['#bjSplit', 'P'],
].forEach(([id, a]) => ($(id).onclick = () => bjResolve && BJ.phase === 'play' && bjResolve(a)));
document.addEventListener('keydown', e => {
  if (MODE !== 'blackjack' || !bjResolve || (e.target.tagName === 'INPUT' && e.target.type !== 'range'))
    return;
  const k = e.key.toLowerCase();
  if (BJ.phase === 'bet' && k === 'enter') {
    e.preventDefault();
    $('#bjDeal').click();
  }
  if (BJ.phase === 'play') {
    const id = { h: '#bjHit', s: '#bjStand', d: '#bjDouble', p: '#bjSplit' }[k];
    if (id && !$(id).disabled) $(id).click();
  }
});
$('#xrayBtn').addEventListener('click', () => {
  if (MODE === 'blackjack') bjUpdateTags();
});
$('#hintBtn').addEventListener('click', () => {
  if (MODE === 'blackjack') {
    $('#bjRecRow').hidden = !G.hints;
    document.querySelectorAll('#bjActions .act').forEach(b => b.classList.remove('pick'));
  }
});
$('#bjEnter').onclick = () => {
  $('#bjIntro').hidden = true;
  if (!BJ.started) {
    renderStartCard();
    $('#startCard').hidden = false;
  }
};
$('#pickPoker').onclick = () => {
  MODE = 'poker';
  $('#home').hidden = true;
  $('#intro').hidden = false;
};
$('#pickBJ').onclick = () => {
  bjInit();
  $('#home').hidden = true;
  $('#bjIntro').hidden = false;
};
document.querySelectorAll('[data-go]').forEach(b => (b.onclick = () => $('#' + b.dataset.go).click()));

let homeArm = 0;
$('#homeBtn').onclick = e => {
  const b = e.currentTarget,
    busy = !!MODE && gameStarted();
  if (!MODE) {
    $('#home').hidden = false;
    return;
  }
  if (busy && !(homeArm && Date.now() - homeArm < 3000)) {
    homeArm = Date.now();
    b.classList.add('arm');
    b.querySelector('.tx').textContent = 'Leave this game?';
    setTimeout(() => {
      if (homeArm && Date.now() - homeArm >= 2900) {
        homeArm = 0;
        b.classList.remove('arm');
        b.querySelector('.tx').textContent = 'Home';
      }
    }, 3000);
    return;
  }
  location.reload();
};

function closeModal(w) {
  if (w.id === 'aboutModal' || gameStarted()) w.hidden = true;
  else location.reload();
}
document
  .querySelectorAll('[data-x]')
  .forEach(b => (b.onclick = () => closeModal(b.closest('.modal-wrap, #startCard'))));
document.addEventListener('keydown', e => {
  if (e.key !== 'Escape') return;
  const w = ['aboutModal', 'ranksModal', 'bjIntro', 'tgIntro', 'intro', 'startCard']
    .map(id => $('#' + id))
    .find(w => !w.hidden);
  if (w?.id === 'ranksModal') $('#ranksClose').click();
  else if (w) closeModal(w);
});
