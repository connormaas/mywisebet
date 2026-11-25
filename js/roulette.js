// American roulette: 38 pockets (1 to 36, 0 and 00). Every bet but one has the same 5.26% house edge.

const RL_ORDER = [
  0, 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1, 37, 27, 10, 25, 29, 12, 8, 19, 31, 18,
  6, 21, 33, 16, 4, 23, 35, 14, 2,
]; // 37 stands for 00
const RL_RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const rlName = n => (n === 37 ? '00' : String(n));
const rlColor = n => (n === 0 || n === 37 ? 'green' : RL_RED.has(n) ? 'red' : 'black');
const RL_EDGE = 2 / 38;
const RL_WHEEL = V3(0, 0.06, BJC.z + 0.85);
const RL = { rotor: null, ball: null, ballR: 0.6, idle: 0.25, hist: [] };

const rlBets = {};
for (let n = 0; n <= 37; n++)
  rlBets['n' + n] = {
    label: 'Straight up on ' + rlName(n),
    short: rlName(n),
    pays: '35 to 1',
    edge: RL_EDGE,
    hit: x => x === n,
    mult: 35,
  };
const rlOut = (id, label, short, pays, mult, hit) =>
  (rlBets[id] = { label, short, pays, edge: RL_EDGE, mult, hit: x => x !== 0 && x !== 37 && hit(x) });
rlOut('red', 'Red', 'Red', '1 to 1', 1, x => RL_RED.has(x));
rlOut('black', 'Black', 'Black', '1 to 1', 1, x => !RL_RED.has(x));
rlOut('odd', 'Odd', 'Odd', '1 to 1', 1, x => x % 2 === 1);
rlOut('even', 'Even', 'Even', '1 to 1', 1, x => x % 2 === 0);
rlOut('low', '1 to 18', '1–18', '1 to 1', 1, x => x <= 18);
rlOut('high', '19 to 36', '19–36', '1 to 1', 1, x => x >= 19);
[1, 2, 3].forEach(k => {
  rlOut(
    'd' + k,
    `Dozen ${k} (${k * 12 - 11} to ${k * 12})`,
    `Dozen ${k}`,
    '2 to 1',
    2,
    x => Math.ceil(x / 12) === k,
  );
  rlOut('c' + k, `Column ${k}`, `Col ${k}`, '2 to 1', 2, x => ((x - 1) % 3) + 1 === k);
});
rlBets.top = {
  label: 'Top line (0, 00, 1, 2, 3)',
  short: 'Top line',
  pays: '6 to 1',
  edge: 3 / 38,
  mult: 6,
  hit: x => x === 0 || x === 37 || x <= 3,
};

TGAMES.roulette = {
  name: 'Roulette',
  rack: false,
  go: 'Spin',
  felt: ['#2a7d58', '#154a33'],
  dealerStyle: 'Spins the wheel',
  track: ['Bets', 'Spin', 'Result', 'Payout', 'Recap'],
  title: 'Where the house edge lives',
  lede: 'Bet on where the ball lands. Every number pays as if the wheel had 36 pockets, but it has 38. Those two green pockets, 0 and 00, are the whole house edge, and your coach shows it on every bet.',
  steps: [
    [
      'The goal',
      'Guess where the ball stops. Bet on one number, a color, odd or even, or a group of numbers.',
    ],
    [
      'The wheel',
      'Numbers 1 to 36 are red or black. 0 and 00 are green, and almost every bet loses when they hit.',
    ],
    ['The payouts', 'One number pays 35 to 1. Red or black pays 1 to 1. Dozens and columns pay 2 to 1.'],
    [
      'The edge',
      'Almost every bet loses 5.26% on average. The top line loses 7.89%. No system changes that.',
    ],
  ],
  note: 'Watch how each player bets: the same wheel treats them all the same in the long run. Turn on X-ray in the More menu to see why they bet what they bet.',
  readIntro: 'Each round, the coach checks whether your bets avoid the one bet with the bigger edge.',
  meta: {
    marge: {
      style: 'Plays It Safe',
      blurb: 'Small bets on red or black so her chips last. Wins about half the time.',
    },
    rico: {
      style: 'Doubles Up',
      blurb:
        'Uses the "double after a loss" system on red. It feels sure to win, until a losing streak hits.',
    },
    dev: {
      style: 'Knows the Math',
      blurb: 'Bets small, spreads across dozens, and never touches the top line, the worst bet on the table.',
    },
    gus: {
      style: 'Lucky Numbers',
      blurb: 'Birthdays and anniversaries, straight up. Long shots that rarely land.',
    },
    yuki: { style: 'Hot Numbers', blurb: 'Bets on numbers that just hit, convinced the wheel has a memory.' },
  },
  fresh: () => ({ hist: [] }),
  bets: rlBets,
  outcomes: () => RL_ORDER.map(o => ({ p: 1 / 38, o })),
  goodEdge: () => RL_EDGE,
  pick: () => ({
    ids: ['red', 'black', 'odd', 'even', 'low', 'high'],
    label: 'Even-money bets',
    why: 'Every bet except the top line costs the same 5.26%. Even-money bets win almost half the time, so your chips last longest.',
  }),
  settle: (b, x) => (rlBets[b.id].hit(x) ? { res: 'win', pay: b.amt * rlBets[b.id].mult } : { res: 'lose' }),
  stage: (i, st, x) =>
    [
      ['Place your bets', 'Tap the board to place chips. Everyone bets before the spin.'],
      ['The spin', 'The dealer spins the wheel one way and the ball the other. No more bets.'],
      ['Result', `The ball lands on ${x !== undefined ? rlName(x) + ' ' + rlColor(x) : 'a number'}.`],
      ['Payout', 'Losing bets go to the house. Winning bets are paid at the listed odds.'],
      ['Recap', 'See who won, who lost, and why the house still comes out ahead.'],
    ][i],
  betHint: () => 'Bets go down before the spin. The board shows what each bet pays.',
  info: st => (st.hist.length ? 'Last ' + rlName(st.hist[0]) : 'New wheel'),
  dealerInfo: st => (st.hist.length ? 'Last: ' + rlName(st.hist[0]) : ''),
  snapshot: st =>
    `American wheel with 0 and 00. Recent results, newest first: ${st.hist.map(rlName).join(', ') || 'none yet'}.`,
  rules:
    'Table: American roulette, 38 pockets (1 to 36, 0, 00). Straight up pays 35 to 1; red, black, odd, even, 1 to 18 and 19 to 36 pay 1 to 1; dozens and columns pay 2 to 1; the top line (0, 00, 1, 2, 3) pays 6 to 1. Every bet has a 5.26% house edge except the top line at 7.89%. A European wheel with a single 0 has a 2.7% edge. Past results never change the next spin.',
  board() {
    let g =
      '<div class="rl-zero"><button class="spot g" data-bet="n37">00</button><button class="spot g" data-bet="n0">0</button></div>';
    for (let n = 1; n <= 36; n++)
      g += `<button class="spot ${rlColor(n)[0]}" data-bet="n${n}" style="--r:${Math.ceil(n / 3)};--c:${((n - 1) % 3) + 1}">${n}</button>`;
    g += [1, 2, 3]
      .map(k => `<button class="spot o col" data-bet="c${k}" style="--c:${k}">2 to 1</button>`)
      .join('');
    g += [1, 2, 3]
      .map(
        k =>
          `<button class="spot o doz" data-bet="d${k}" style="--k:${k}">${k * 12 - 11} to ${k * 12}</button>`,
      )
      .join('');
    g += [
      ['low', '1–18'],
      ['even', 'Even'],
      ['red', 'Red'],
      ['black', 'Black'],
      ['odd', 'Odd'],
      ['high', '19–36'],
    ]
      .map(
        ([id, t], i) =>
          `<button class="spot o even-money ${id}" data-bet="${id}" style="--k:${i + 1}">${t}</button>`,
      )
      .join('');
    return (
      g +
      '<button class="spot o top" data-bet="top" title="0, 00, 1, 2 and 3">Top line<small>6 to 1</small></button>'
    );
  },
  bot(p, st) {
    const k = p.P.key,
      m = p.mem;
    if (k === 'marge')
      return {
        bets: [{ id: Math.random() < 0.5 ? 'red' : 'black', amt: 10 }],
        why: 'Even money. Slow and steady.',
      };
    if (k === 'rico') {
      m.unit = m.unit || 10;
      const amt = p.losses ? Math.min(500, m.unit * 2 ** p.losses) : round5(rand(10, 40));
      return {
        bets: [{ id: 'red', amt }],
        why: p.losses
          ? `Lost ${p.losses} in a row, so I double to ${fmt(amt)}. Red is due!`
          : 'Red again. If I lose, I just double.',
      };
    }
    if (k === 'dev')
      return {
        bets: [
          { id: 'd2', amt: 10 },
          { id: 'd3', amt: 10 },
        ],
        why: 'Two dozens cover 24 numbers. Same 5.26% edge as anything else, just smoother.',
      };
    if (k === 'gus') {
      const ns = [7, 14, 23, 31];
      return {
        bets: ns.slice(0, 2 + Math.floor(Math.random() * 2)).map(n => ({ id: 'n' + n, amt: 5 })),
        why: 'Grandkids birthdays. One of them has to hit eventually.',
      };
    }
    const hot = st.hist[0];
    if (hot === undefined)
      return { bets: [{ id: 'odd', amt: 15 }], why: 'Waiting to see which numbers run hot.' };
    return {
      bets: [{ id: 'n' + hot, amt: 10 }],
      why: `${rlName(hot)} just hit. Hot numbers keep hitting, right? (They don't. Every spin is fresh.)`,
    };
  },
  async play(st) {
    const x = RL_ORDER[Math.floor(Math.random() * 38)];
    TG.focus = RL_WHEEL.clone().setY(0.4);
    await rlSpin(x);
    return x;
  },
  describe: x => `The ball lands on <b>${rlName(x)} ${rlColor(x)}</b>.`,
  explain: x =>
    x === 0 || x === 37
      ? `${rlName(x)} is green. Red, black, odd, even, dozens and columns all lose. This is where the house edge comes from.`
      : `${x} is ${rlColor(x)}, ${x % 2 ? 'odd' : 'even'}, ${x <= 18 ? 'low (1 to 18)' : 'high (19 to 36)'}, in dozen ${Math.ceil(x / 12)} and column ${((x - 1) % 3) + 1}.`,
  headline: x => `The ball landed on ${rlName(x)} ${rlColor(x)}.`,
  outcomeHTML: x => `<span class="rl-ball ${rlColor(x)}">${rlName(x)}</span>`,
  after: (x, st) => st.hist.unshift(x) && st.hist.length > 12 && st.hist.pop(),
  bar: st =>
    `<div class="cg"><span class="cg-l">Last spins</span><div class="cg-c tgchips">${
      st.hist.length
        ? st.hist
            .slice(0, 6)
            .map(n => `<span class="rl-ball ${rlColor(n)}">${rlName(n)}</span>`)
            .join('')
        : '<span class="betchip none">None yet</span>'
    }</div></div>`,
  lesson(x, st, mine) {
    const green = x === 0 || x === 37;
    if (green && mine.length)
      return 'Green hit. Every outside bet lost at once. Two green pockets out of 38 is exactly the 5.26% house edge.';
    if (mine.some(r => r.res === 'win' && rlBets[r.b.id].mult === 35))
      return 'A straight-up hit pays 35 to 1, but the true odds are 37 to 1. That gap is the house edge, even on a win.';
    if (st.hist.length >= 2 && st.hist[0] === st.hist[1])
      return 'The same number twice in a row is no more or less likely next time. The wheel has no memory.';
    const tips = [
      'Doubling after a loss feels safe, but a run of 7 losses (about 1 in 100 spins) needs 128 times your first bet.',
      'A European wheel with only one 0 cuts the edge almost in half, to 2.7%. Look for it if you ever play for real.',
      'Every bet on this table except the top line loses the same 5.26% on average. Bet size matters more than bet choice.',
      'Red came up after a run of black? Coincidence. Each spin is 18 in 38 for red, every single time.',
    ];
    return tips[TG.round % tips.length];
  },
  build: g => rlBuild(g),
  frame() {
    if (RL.rotor) RL.rotor.rotation.y += RL.idle * 0.016;
  },
  clear() {},
};

function rlBuild(g) {
  feltText(g, 'AMERICAN ROULETTE', 3.4, 0.42, 'bold 92px Georgia, serif', V3(0, 0.054, 1.2));
  feltText(
    g,
    '0 · 00 · 1 to 36  ·  Bets $5 to $500',
    3.2,
    0.26,
    'italic 54px Georgia, serif',
    V3(0, 0.054, 1.6),
    'rgba(240,210,143,.6)',
  );
  const wood = new THREE.MeshStandardMaterial({ color: 0x3a1e10, roughness: 0.4, metalness: 0.15 });
  const bowl = new THREE.Mesh(new THREE.CylinderGeometry(0.82, 0.72, 0.2, 64), wood);
  bowl.position.copy(RL_WHEEL).setY(0.13);
  bowl.castShadow = true;
  g.add(bowl);
  const track = new THREE.Mesh(
    new THREE.TorusGeometry(0.71, 0.045, 10, 64),
    new THREE.MeshStandardMaterial({ color: 0x2a1408, roughness: 0.3 }),
  );
  track.rotation.x = -Math.PI / 2;
  track.position.copy(RL_WHEEL).setY(0.25);
  g.add(track);
  const tex = canvasTex(1024, 1024, (c, W) => {
    const R = W / 2;
    c.translate(R, R);
    for (let i = 0; i < 38; i++) {
      const a0 = ((i - 0.5) / 38) * Math.PI * 2,
        a1 = ((i + 0.5) / 38) * Math.PI * 2,
        n = RL_ORDER[i];
      c.fillStyle = { red: '#b8262b', black: '#17171c', green: '#1f7a4a' }[rlColor(n)];
      c.beginPath();
      c.moveTo(0, 0);
      c.arc(0, 0, R, a0, a1);
      c.fill();
      c.save();
      c.rotate((i / 38) * Math.PI * 2);
      c.translate(R * 0.86, 0);
      c.rotate(Math.PI / 2);
      c.fillStyle = '#f4ecdc';
      c.font = 'bold 40px Georgia';
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      c.fillText(rlName(n), 0, 0);
      c.restore();
    }
    c.strokeStyle = '#d4ad62';
    c.lineWidth = 6;
    for (let i = 0; i < 38; i++) {
      const a = ((i - 0.5) / 38) * Math.PI * 2;
      c.beginPath();
      c.moveTo(Math.cos(a) * R * 0.55, Math.sin(a) * R * 0.55);
      c.lineTo(Math.cos(a) * R * 0.76, Math.sin(a) * R * 0.76);
      c.stroke();
    }
    const gr = c.createRadialGradient(0, 0, 0, 0, 0, R * 0.55);
    gr.addColorStop(0, '#6b3a1a');
    gr.addColorStop(1, '#2a1408');
    c.fillStyle = gr;
    c.beginPath();
    c.arc(0, 0, R * 0.55, 0, 7);
    c.fill();
  });
  RL.rotor = new THREE.Group();
  RL.rotor.position.copy(RL_WHEEL).setY(0.235);
  const face = new THREE.Mesh(
    new THREE.CircleGeometry(0.66, 76),
    new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }),
  );
  face.rotation.x = -Math.PI / 2;
  RL.rotor.add(face);
  const brass = new THREE.MeshStandardMaterial({ color: 0xd4ad62, metalness: 0.7, roughness: 0.3 });
  const turret = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.2, 24), brass);
  turret.position.y = 0.11;
  RL.rotor.add(turret);
  for (let i = 0; i < 4; i++) {
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.013, 0.013, 0.42, 8), brass);
    arm.rotation.z = Math.PI / 2;
    arm.rotation.y = (i * Math.PI) / 4;
    arm.position.y = 0.16;
    RL.rotor.add(arm);
  }
  g.add(RL.rotor);
  RL.ball = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 16, 12),
    new THREE.MeshStandardMaterial({ color: 0xf7f4ec, roughness: 0.2 }),
  );
  RL.ball.castShadow = true;
  rlBallAt(Math.PI * 0.5, 0.68, 0.28);
  g.add(RL.ball);
}
function rlBallAt(a, r, y) {
  RL.ball.position.set(RL_WHEEL.x + Math.cos(a) * r, y, RL_WHEEL.z + Math.sin(a) * r);
}
async function rlSpin(x) {
  const k = RL_ORDER.indexOf(x),
    phi = (k / 38) * Math.PI * 2,
    r0 = RL.rotor.rotation.y,
    turns = Math.PI * 2 * 2.5,
    rEnd = r0 + turns;
  if (RL.ball.parent !== TG.group) {
    RL.rotor.remove(RL.ball);
    TG.group.add(RL.ball);
  }
  const a0 = Math.atan2(RL.ball.position.z - RL_WHEEL.z, RL.ball.position.x - RL_WHEEL.x);
  let aEnd = phi - rEnd;
  while (aEnd > a0 - Math.PI * 7) aEnd -= Math.PI * 2;
  while (aEnd < a0 - Math.PI * 9) aEnd += Math.PI * 2;
  RL.idle = 0;
  log('No more bets. The ball is spinning.', 'sys');
  const out = k2 => 1 - Math.pow(1 - k2, 3);
  await animate(
    1700,
    t => {
      RL.rotor.rotation.y = r0 + turns * out(t);
      const a = a0 + (aEnd - a0) * out(t);
      const drop = clamp((t - 0.62) / 0.3, 0, 1);
      const bounce = drop > 0 && drop < 1 ? Math.abs(Math.sin(drop * Math.PI * 3)) * 0.05 * (1 - drop) : 0;
      rlBallAt(a, 0.68 - drop * 0.16, 0.28 - drop * 0.02 + bounce);
    },
    t => t,
  );
  RL.ball.position.set(Math.cos(phi) * 0.52, 0.025, Math.sin(phi) * 0.52);
  TG.group.remove(RL.ball);
  RL.rotor.add(RL.ball);
  RL.idle = 0.25;
}
