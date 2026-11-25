// Craps: one shooter, two dice. The pass line and its odds are among the best bets in any casino;
// the middle of the table is among the worst.

const CR = { dice: [], puck: null, boxes: {} };
const CR_ODDS = { 4: 2, 10: 2, 5: 1.5, 9: 1.5, 6: 1.2, 8: 1.2 };
const CR_FACES = ['', '⚀', '⚁', '⚂', '⚃', '⚄', '⚅'];
const crShooter = st => {
  const seats = [...TG.players, TG.me];
  return seats[st.shooter % seats.length];
};
const crWho = p => (p.human ? 'You' : p.P.name);
const crMoney = (b, k) => Math.round(b.amt * k * 100) / 100;

const crBets = {
  pass: {
    label: 'Pass line',
    short: 'Pass',
    pays: '1 to 1',
    edge: 0.0141,
    open: st => !st.point,
    settle(b, s, st) {
      if (!st.point) return s === 7 || s === 11 ? 'win' : s === 2 || s === 3 || s === 12 ? 'lose' : 'stay';
      return s === st.point ? 'win' : s === 7 ? 'lose' : 'stay';
    },
  },
  dpass: {
    label: "Don't pass",
    short: "Don't pass",
    pays: '1 to 1',
    edge: 0.0136,
    open: st => !st.point,
    settle(b, s, st) {
      if (!st.point)
        return s === 2 || s === 3 ? 'win' : s === 12 ? 'push' : s === 7 || s === 11 ? 'lose' : 'stay';
      return s === 7 ? 'win' : s === st.point ? 'lose' : 'stay';
    },
  },
  odds: {
    label: 'Odds behind the pass line',
    short: 'Odds',
    pays: 'true odds',
    edge: 0,
    open: (st, p) => !!st.point && p.bets.some(b => b.id === 'pass'),
    max: (st, p) => 3 * (p.bets.find(b => b.id === 'pass') || { amt: 0 }).amt,
    settle: (b, s, st) => (s === st.point ? 'win' : s === 7 ? 'lose' : 'stay'),
    mult: st => CR_ODDS[st.point] || 1,
  },
  place6: {
    label: 'Place 6',
    short: 'Place 6',
    pays: '7 to 6',
    edge: 0.0152,
    open: st => !!st.point,
    settle: (b, s, st) => (!st.point ? 'stay' : s === 6 ? 'win' : s === 7 ? 'lose' : 'stay'),
    mult: () => 7 / 6,
  },
  place8: {
    label: 'Place 8',
    short: 'Place 8',
    pays: '7 to 6',
    edge: 0.0152,
    open: st => !!st.point,
    settle: (b, s, st) => (!st.point ? 'stay' : s === 8 ? 'win' : s === 7 ? 'lose' : 'stay'),
    mult: () => 7 / 6,
  },
  field: {
    label: 'Field',
    short: 'Field',
    pays: '1 to 1, 2 pays double, 12 triple',
    edge: 0.0278,
    settle: (b, s) => ([2, 3, 4, 9, 10, 11, 12].includes(s) ? 'win' : 'lose'),
    mult: (st, s) => (s === 2 ? 2 : s === 12 ? 3 : 1),
  },
  any7: {
    label: 'Any seven',
    short: 'Any 7',
    pays: '4 to 1',
    edge: 0.1667,
    settle: (b, s) => (s === 7 ? 'win' : 'lose'),
    mult: () => 4,
  },
  craps: {
    label: 'Any craps (2, 3 or 12)',
    short: 'Any craps',
    pays: '7 to 1',
    edge: 0.1111,
    settle: (b, s) => ([2, 3, 12].includes(s) ? 'win' : 'lose'),
    mult: () => 7,
  },
  yo: {
    label: 'Yo-leven (11)',
    short: 'Yo 11',
    pays: '15 to 1',
    edge: 0.1111,
    settle: (b, s) => (s === 11 ? 'win' : 'lose'),
    mult: () => 15,
  },
};

TGAMES.craps = {
  name: 'Craps',
  go: 'Roll',
  felt: ['#2f6f8f', '#173c52'],
  dealerStyle: 'Runs the dice',
  track: ['Bets', 'Roll', 'Result', 'Payout', 'Recap'],
  title: 'Smart bets and sucker bets',
  lede: 'Craps looks wild, but it hides some of the best bets in any casino right next to some of the worst. Your coach shows the house edge on every spot, so you learn which is which.',
  steps: [
    [
      'The come-out',
      'The first roll. 7 or 11 wins on the pass line. 2, 3 or 12 loses. Anything else becomes the point.',
    ],
    [
      'The point',
      'Once a point is set, the shooter keeps rolling. Roll the point again to win. Roll a 7 first and pass loses.',
    ],
    [
      'The odds bet',
      'After a point, you can add odds behind your pass bet. It pays true odds: zero house edge.',
    ],
    [
      'The middle',
      'Any 7, any craps and yo-leven pay big and lose 11% to 17%. The flashier the bet, the worse it is.',
    ],
  ],
  note: 'The dice pass around the table: when a shooter rolls a 7 after the point is set, the next player shoots. Turn on X-ray in the More menu to see why each player bets what they bet.',
  readIntro:
    "Each roll, the coach checks whether your new bets are the low-edge ones: pass, don't pass, odds, or place 6 and 8.",
  meta: {
    marge: {
      style: 'Pass Line Only',
      blurb: 'One small pass line bet, every time. Simple and cheap at 1.41%.',
    },
    rico: {
      style: 'Middle of the Table',
      blurb: 'Any seven, the field, any craps. Big payouts, big house edge, and he doubles after losses.',
    },
    dev: {
      style: 'Takes Full Odds',
      blurb: 'Pass line plus three times odds. Most of his money sits on a bet with no house edge at all.',
    },
    gus: {
      style: 'Long Shots',
      blurb: 'Yo-leven and any craps on every roll, because 15 to 1 sounds great.',
    },
    yuki: {
      style: 'Places the 6 and 8',
      blurb: 'Waits for a point, then places the 6 and 8 at a small 1.52% edge.',
    },
  },
  fresh: () => ({ point: 0, shooter: 0, roll: null, hist: [] }),
  bets: Object.fromEntries(Object.entries(crBets).map(([k, v]) => [k, v])),
  goodEdge: () => 0.0152,
  pick(st, me) {
    const pass = me.bets.find(b => b.id === 'pass'),
      odds = me.bets.find(b => b.id === 'odds');
    if (!st.point)
      return {
        ids: ['pass', 'dpass'],
        label: 'Pass line',
        why: 'The pass line loses only 1.41% over time. Make it before the come-out roll.',
      };
    if (pass && (!odds || odds.amt < 3 * pass.amt))
      return {
        ids: ['odds'],
        label: 'Take the odds',
        why: 'Odds behind your pass bet pay true odds: zero house edge, the best bet in the casino.',
      };
    return {
      ids: ['place6', 'place8'],
      label: 'Place 6 or 8',
      why: 'With a point on, placing the 6 or 8 costs only 1.52%. Skip the middle bets, which lose 11% to 17%.',
    };
  },
  settle(b, out, st) {
    const spec = crBets[b.id],
      r = spec.settle(b, out.s, st);
    if (r !== 'win') return { res: r };
    const k = b.id === 'pass' || b.id === 'dpass' ? 1 : spec.mult(st, out.s);
    return { res: 'win', pay: crMoney(b, k) };
  },
  stage(i, st, out) {
    const who = st && TG.players ? crWho(crShooter(st)) : 'The shooter';
    return [
      st.point
        ? [
            'Point is ' + st.point,
            `Pass wins if ${st.point} comes before 7. You can now take odds behind your pass bet.`,
          ]
        : ['Come-out roll', 'Bet the pass line before the first roll. 7 or 11 wins it right away.'],
      ['The roll', `${who} ${who === 'You' ? 'throw' : 'throws'} the dice.`],
      ['Result', out ? `Rolled ${out.a} and ${out.b}: ${out.s}.` : 'The dice come to rest.'],
      ['Payout', 'Bets this roll decides are paid or collected. The rest stay on the table.'],
      ['Recap', 'See which bets won, which lost, and which are still working.'],
    ][i];
  },
  betHint: st =>
    st.point
      ? `The point is ${st.point}. Pass bets ride until ${st.point} or 7 rolls.`
      : 'New come-out roll. Pass line bets go down now.',
  info: st => (st.point ? 'Point ' + st.point : 'Come-out'),
  dealerInfo: st => (st.point ? 'Point ' + st.point : 'Point off'),
  snapshot: st =>
    `${st.point ? 'The point is ' + st.point + '.' : 'Come-out roll: no point yet.'} Shooter: ${TG.players ? crWho(crShooter(st)) : 'unknown'}. Recent rolls, newest first: ${st.hist.join(', ') || 'none yet'}.`,
  rules:
    "Table: standard craps. Pass line: come-out 7 or 11 wins, 2, 3 or 12 loses, other numbers set the point; then the point wins and 7 loses (1.41% edge). Don't pass is the reverse, with 12 a push on the come-out (1.36%). Odds behind pass, up to 3 times the pass bet, pay true odds (2 to 1 on 4 and 10, 3 to 2 on 5 and 9, 6 to 5 on 6 and 8) with no edge. Place 6 and 8 pay 7 to 6 (1.52%) and only work while a point is on. Field is a one-roll bet on 2, 3, 4, 9, 10, 11, 12 with 2 paying double and 12 triple (2.78%). Any seven pays 4 to 1 (16.67%), any craps 7 to 1 (11.11%), yo-leven 15 to 1 (11.11%). In this app, place bets come down after they win.",
  board: () =>
    `<div class="cr-row cr-line">
      <button class="spot o" data-bet="pass">Pass line<small>1 to 1 · 1.41%</small></button>
      <button class="spot o" data-bet="dpass">Don't pass<small>1 to 1 · 1.36%</small></button>
      <button class="spot o" data-bet="odds">Odds<small>true odds · 0%</small></button>
    </div>
    <div class="cr-row">
      <button class="spot o" data-bet="place6">Place 6<small>7 to 6 · 1.52%</small></button>
      <button class="spot o" data-bet="place8">Place 8<small>7 to 6 · 1.52%</small></button>
      <button class="spot o" data-bet="field">Field<small>2·3·4·9·10·11·12 · 2.78%</small></button>
    </div>
    <div class="cr-row cr-mid">
      <button class="spot o" data-bet="any7">Any 7<small>4 to 1 · 16.7%</small></button>
      <button class="spot o" data-bet="craps">Any craps<small>7 to 1 · 11.1%</small></button>
      <button class="spot o" data-bet="yo">Yo 11<small>15 to 1 · 11.1%</small></button>
    </div>`,
  bot(p, st) {
    const k = p.P.key,
      has = id => p.bets.some(b => b.id === id);
    if (k === 'marge')
      return !st.point && !has('pass')
        ? { bets: [{ id: 'pass', amt: 10 }], why: 'Pass line, $10. That is all I need.' }
        : { bets: [], why: st.point ? `Waiting on the ${st.point}.` : 'My bet is already working.' };
    if (k === 'rico') {
      const unit = p.losses ? Math.min(200, 10 * 2 ** p.losses) : 10;
      return {
        bets: [
          { id: 'any7', amt: unit },
          { id: 'field', amt: 10 },
        ],
        why: p.losses
          ? `Down ${p.losses} in a row. Doubling up on any 7!`
          : 'Any seven pays 4 to 1. Easy money.',
      };
    }
    if (k === 'dev') {
      if (!st.point)
        return has('pass')
          ? { bets: [], why: 'Pass is down.' }
          : { bets: [{ id: 'pass', amt: 10 }], why: 'Pass line now, odds later.' };
      return has('pass') && !has('odds')
        ? {
            bets: [{ id: 'odds', amt: 30 }],
            why: `Point ${st.point}. Full odds: no house edge on this money.`,
          }
        : { bets: [], why: 'All my money is working at the lowest edge.' };
    }
    if (k === 'gus')
      return {
        bets: [
          { id: 'yo', amt: 5 },
          { id: 'craps', amt: 5 },
        ],
        why: '15 to 1 on yo-leven! It is bound to come up.',
      };
    if (!st.point) return { bets: [], why: 'I wait for a point before betting.' };
    const b = [];
    if (!has('place6')) b.push({ id: 'place6', amt: 30 });
    if (!has('place8')) b.push({ id: 'place8', amt: 30 });
    return {
      bets: b,
      why: b.length ? 'Place 6 and 8: the cheapest numbers to bet on.' : 'My 6 and 8 are working.',
    };
  },
  async play(st) {
    const a = 1 + Math.floor(Math.random() * 6),
      b = 1 + Math.floor(Math.random() * 6);
    const who = crShooter(st);
    TG.focus = V3(0, 0.3, -0.1);
    await crThrow(who, a, b);
    return { a, b, s: a + b };
  },
  describe: (o, st) =>
    `${crWho(crShooter(st))} ${crShooter(st).human ? 'roll' : 'rolls'} <b>${o.a} + ${o.b} = ${o.s}</b>.`,
  explain(o, st) {
    const s = o.s;
    if (!st.point) {
      if (s === 7 || s === 11) return `${s} on the come-out is a natural. Pass wins, don't pass loses.`;
      if (s === 2 || s === 3) return `${s} is craps. Pass loses, don't pass wins.`;
      if (s === 12)
        return "12 is craps. Pass loses, and don't pass is a push (that tie is where its edge comes from).";
      return `${s} becomes the point. Now the shooter needs another ${s} before a 7.`;
    }
    if (s === st.point) return `The shooter made the point! Pass and odds win, don't pass loses.`;
    if (s === 7)
      return "Seven out. Pass, odds and place bets lose; don't pass wins. The dice move to the next shooter.";
    return `${s} doesn't decide the pass line. One-roll bets settle; everything else keeps riding.`;
  },
  headline: (o, st) => `${crWho(crShooter(st))} rolled ${o.a} and ${o.b} for ${o.s}.`,
  outcomeHTML: o => `<span class="cr-dice">${CR_FACES[o.a]}${CR_FACES[o.b]}</span> ${o.s}`,
  after(o, st) {
    st.hist.unshift(o.s);
    if (st.hist.length > 12) st.hist.pop();
    st.roll = o;
    if (!st.point) {
      if (![2, 3, 7, 11, 12].includes(o.s)) {
        st.point = o.s;
        log(`The point is <b>${o.s}</b>. The dealer moves the puck to ON.`, 'sys');
      }
    } else if (o.s === st.point) {
      log(`Point made. The puck goes back to OFF for a new come-out.`, 'sys');
      st.point = 0;
    } else if (o.s === 7) {
      st.point = 0;
      st.shooter++;
      log(`Seven out. ${crWho(crShooter(st))} ${crShooter(st).human ? 'get' : 'gets'} the dice.`, 'sys');
    }
    crPuck(st.point);
  },
  quiet: (o, before, mine) => !mine.length,
  bar: st =>
    `<div class="cg"><span class="cg-l">${st.point ? 'Point ' + st.point : 'Come-out'}</span><div class="cg-c tgchips">${
      st.roll
        ? `<span class="cr-dice">${CR_FACES[st.roll.a]}${CR_FACES[st.roll.b]}</span>`
        : '<span class="betchip none">No roll yet</span>'
    }</div></div>`,
  lesson(o, st, mine) {
    const ids = mine.map(r => r.b.id);
    if (ids.some(i => ['any7', 'craps', 'yo'].includes(i)) && mine.some(r => r.res === 'win'))
      return 'A middle bet hit, and it feels great. But any seven pays 4 to 1 on a 5 to 1 shot. Over time it keeps 16.7% of every bet.';
    if (ids.some(i => ['any7', 'craps', 'yo'].includes(i)))
      return 'Middle bets lose 11% to 17% on average. The pass line plus odds loses under 1%. Same dice, very different math.';
    if (ids.includes('odds'))
      return 'Odds pay exactly what they should: 6 to 5 on a 6 or 8, 2 to 1 on a 4 or 10. It is the only casino bet with no house edge.';
    if (ids.includes('dpass'))
      return "Don't pass wins slightly more often than pass, because 12 is a tie instead of a win on the come-out.";
    if (ids.includes('field'))
      return 'The field covers 7 numbers, but those numbers come up only 16 times in 36 rolls. The double and triple payouts on 2 and 12 shrink the edge to 2.78%.';
    if (!st.point && (o.s === 7 || o.s === 11))
      return 'A natural on the come-out: pass line players win 1 to 1 before any point is set.';
    return 'The pass line wins about 49.3% of the time. That tiny gap from 50% is the whole house edge.';
  },
  build: g => crBuild(g),
  clear() {},
};

function crBuild(g) {
  const boxes = canvasTex(1536, 256, (c, W, H) => {
    const nums = ['4', '5', 'SIX', '8', 'NINE', '10'],
      w = W / 6;
    c.strokeStyle = 'rgba(240,210,143,.8)';
    c.lineWidth = 6;
    c.fillStyle = 'rgba(240,210,143,.85)';
    c.font = 'bold 110px Georgia';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    nums.forEach((n, i) => {
      c.strokeRect(i * w + 8, 8, w - 16, H - 16);
      c.fillText(n, i * w + w / 2, H / 2 + 6);
    });
  });
  const bm = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 0.6),
    new THREE.MeshBasicMaterial({ map: boxes, transparent: true, depthWrite: false }),
  );
  bm.rotation.x = -Math.PI / 2;
  bm.position.set(0, 0.054, BJC.z + 0.95);
  g.add(bm);
  [4, 5, 6, 8, 9, 10].forEach((n, i) => (CR.boxes[n] = V3(-1.5 + i * 0.6, 0.07, BJC.z + 0.95)));
  feltText(
    g,
    'FIELD  2 · 3 · 4 · 9 · 10 · 11 · 12',
    3.4,
    0.32,
    'bold 70px Georgia, serif',
    V3(0, 0.054, 0.45),
  );
  feltText(g, 'PASS LINE', 3.0, 0.42, 'bold 100px Georgia, serif', V3(0, 0.054, 1.35));
  feltText(
    g,
    "DON'T PASS BAR  ·  ODDS PAY TRUE",
    3.4,
    0.26,
    'italic 58px Georgia, serif',
    V3(0, 0.054, 1.72),
    'rgba(240,210,143,.6)',
  );
  const puckTex = (on, bg, fg) =>
    new THREE.MeshStandardMaterial({
      map: canvasTex(128, 128, c => {
        c.fillStyle = bg;
        c.beginPath();
        c.arc(64, 64, 64, 0, 7);
        c.fill();
        c.fillStyle = fg;
        c.font = 'bold 44px Georgia';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(on, 64, 68);
      }),
    });
  CR.puck = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.05, 32), [
    new THREE.MeshStandardMaterial({ color: 0x222222 }),
    puckTex('ON', '#f4f1ea', '#1b1b22'),
    puckTex('OFF', '#1b1b22', '#f4f1ea'),
  ]);
  CR.puck.castShadow = true;
  g.add(CR.puck);
  crPuck(0, true);
  const pips = {
    1: [[0.5, 0.5]],
    2: [
      [0.25, 0.25],
      [0.75, 0.75],
    ],
    3: [
      [0.25, 0.25],
      [0.5, 0.5],
      [0.75, 0.75],
    ],
    4: [
      [0.25, 0.25],
      [0.75, 0.25],
      [0.25, 0.75],
      [0.75, 0.75],
    ],
    5: [
      [0.25, 0.25],
      [0.75, 0.25],
      [0.5, 0.5],
      [0.25, 0.75],
      [0.75, 0.75],
    ],
    6: [
      [0.25, 0.22],
      [0.75, 0.22],
      [0.25, 0.5],
      [0.75, 0.5],
      [0.25, 0.78],
      [0.75, 0.78],
    ],
  };
  const face = v =>
    new THREE.MeshStandardMaterial({
      roughness: 0.35,
      map: canvasTex(128, 128, c => {
        c.fillStyle = '#b3242b';
        c.fillRect(0, 0, 128, 128);
        c.fillStyle = '#f7f3ea';
        pips[v].forEach(([x, y]) => {
          c.beginPath();
          c.arc(x * 128, y * 128, 12, 0, 7);
          c.fill();
        });
      }),
    });
  const mats = [2, 5, 1, 6, 3, 4].map(face);
  CR.dice = [0, 1].map(i => {
    const yaw = new THREE.Group(),
      die = new THREE.Mesh(new THREE.BoxGeometry(0.17, 0.17, 0.17), mats);
    die.castShadow = true;
    yaw.add(die);
    yaw.position.set(-0.12 + i * 0.26, 0.14, -0.05);
    g.add(yaw);
    return { yaw, die };
  });
}
const CR_REST = {
  1: [0, 0],
  6: [Math.PI, 0],
  2: [0, Math.PI / 2],
  5: [0, -Math.PI / 2],
  3: [-Math.PI / 2, 0],
  4: [Math.PI / 2, 0],
};
function crPuck(point, now) {
  const to = point ? CR.boxes[point].clone().setY(0.085) : V3(1.85, 0.085, BJC.z + 0.95);
  CR.puck.rotation.x = point ? 0 : Math.PI;
  if (now) CR.puck.position.copy(to);
  else moveTo(CR.puck, to, 400, 0.2).catch(() => {});
}
async function crThrow(who, a, b) {
  const from = bjAt(who.deg, 0.75, 0.5);
  await Promise.all(
    CR.dice.map(({ yaw, die }, i) => {
      const v = i ? b : a,
        [fx, fz] = CR_REST[v],
        to = V3(-0.2 + i * 0.36 + rand(-0.08, 0.08), 0.14, -0.15 + rand(-0.12, 0.12)),
        y0 = yaw.rotation.y,
        y1 = y0 + rand(-1.2, 1.2),
        nx = 2 + Math.floor(Math.random() * 2),
        nz = 1 + Math.floor(Math.random() * 2);
      yaw.position.copy(from);
      return animate(
        900,
        k => {
          const e = 1 - Math.pow(1 - k, 2);
          yaw.position.lerpVectors(from, to, e);
          yaw.position.y = 0.14 + Math.abs(Math.sin(k * Math.PI * 2.2)) * 0.45 * (1 - k);
          yaw.rotation.y = y0 + (y1 - y0) * e;
          die.rotation.x = fx + Math.PI * 2 * nx * (1 - e);
          die.rotation.z = fz + Math.PI * 2 * nz * (1 - e);
        },
        t => t,
      );
    }),
  );
}
