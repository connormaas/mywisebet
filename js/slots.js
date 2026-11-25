// Slots: a three-reel machine with honest reel strips. No decisions change the odds, so the lesson is
// what the machine keeps over time, how often it pays, and why near misses feel closer than they are.

const SL_SYMS = {
  7: { draw: '7', color: '#d6262e', name: 'Seven' },
  B: { draw: 'BAR', color: '#1b1b22', name: 'BAR' },
  L: { draw: '🔔', name: 'Bell' },
  C: { draw: '🍒', name: 'Cherry' },
  M: { draw: '🍋', name: 'Lemon' },
  _: { draw: '', name: 'Blank' },
};
// 20 stops per reel: one 7, two BARs, three bells, four cherries, five lemons, five blanks
const SL_STRIP = '7_CMB_LMC_LMBC_MLC_M'.split('');
const SL_PAYS = [
  ['777', 250],
  ['BBB', 80],
  ['LLL', 30],
  ['CCC', 20],
  ['MMM', 10],
];
function slPay(s) {
  const k = s.join('');
  for (const [p, m] of SL_PAYS) if (k === p) return m;
  return s.filter(x => x === 'C').length === 2 ? 4 : 0;
}
const SL_ODDS = (() => {
  const by = {},
    n = SL_STRIP.length;
  for (const a of SL_STRIP)
    for (const b of SL_STRIP)
      for (const c of SL_STRIP) by[slPay([a, b, c])] = (by[slPay([a, b, c])] || 0) + 1;
  const out = Object.entries(by).map(([m, k]) => ({ p: k / n ** 3, o: { mult: +m } }));
  const rtp = out.reduce((a, x) => a + x.p * x.o.mult, 0);
  return { out, rtp, hit: out.filter(x => x.o.mult > 0).reduce((a, x) => a + x.p, 0) };
})();
const SL = { reels: [], lights: [], spinning: false, glow: 0 };
const slName = s => SL_SYMS[s].name;

TGAMES.slots = {
  name: 'Slots',
  go: 'Spin',
  solo: true,
  noTable: true,
  dealerStyle: '',
  track: ['Bet', 'Spin', 'Result', 'Payout', 'Recap'],
  title: 'How the machine wins',
  lede: `Slots have no strategy: every spin is random, and no button, rhythm or "hot machine" changes that. What you can learn is what the machine keeps. This one pays back ${(SL_ODDS.rtp * 100).toFixed(1)}% of what goes in, and your coach tracks how it really goes for you.`,
  steps: [
    [
      'The goal',
      'Pick a bet and spin. Three matching symbols on the middle line pay the amount in the paytable.',
    ],
    [
      'The paytable',
      '7 7 7 pays 250×, BAR BAR BAR 80×, bells 30×, cherries 20×, lemons 10×, and any two cherries 4×.',
    ],
    [
      'The payback',
      `Over time this machine returns ${(SL_ODDS.rtp * 100).toFixed(1)}% and keeps the rest. Real casino slots keep 2% to 15%.`,
    ],
    [
      'Near misses',
      'Two sevens and a blank feel close, but they are just a loss. Real machines are often built to show near misses more.',
    ],
  ],
  note: 'Watch the coach panel: it counts what you have put in and what came back, so you can see the payback percentage play out.',
  readIntro: 'The coach keeps a running count of what you put in and what the machine paid back.',
  meta: {},
  fresh: () => ({ spins: 0, inn: 0, back: 0, last: null, best: 0 }),
  bets: {
    spin: { label: 'Spin', short: 'Spin', pays: 'see the paytable', edge: 1 - SL_ODDS.rtp },
  },
  autoBet: 'spin',
  outcomes: () => SL_ODDS.out,
  goodEdge: () => 1,
  pick: () => ({
    ids: ['spin'],
    label: 'Bet small',
    why: `Every spin loses ${((1 - SL_ODDS.rtp) * 100).toFixed(1)}% on average, whatever you do. The only real choice is how much, so keep it small.`,
  }),
  settle: (b, o) =>
    o.mult > 1 ? { res: 'win', pay: b.amt * (o.mult - 1) } : o.mult === 1 ? { res: 'push' } : { res: 'lose' },
  stage: (i, st, o) =>
    [
      ['Choose your bet', 'Pick a chip for the size of each spin, then press Spin.'],
      ['The spin', 'The result was decided the instant you pressed Spin. The reels are just for show.'],
      ['Result', o ? `${o.s.map(slName).join(', ')}.` : 'The reels stop.'],
      ['Payout', 'Matching symbols on the middle line pay the paytable amount.'],
      ['Recap', 'The coach panel shows what the machine has kept so far.'],
    ][i],
  betHint: () =>
    `This machine hits about 1 spin in ${Math.round(1 / SL_ODDS.hit)} and pays back ${(SL_ODDS.rtp * 100).toFixed(1)}% over time.`,
  info: st => (st.spins ? `${st.spins} spins` : 'New machine'),
  dealerInfo: () => '',
  snapshot: st =>
    `Three-reel machine. Paytable: 777 pays 250x, BAR BAR BAR 80x, three bells 30x, three cherries 20x, three lemons 10x, any two cherries 4x (total return per unit bet). Long-run payback ${(SL_ODDS.rtp * 100).toFixed(1)}%, hit rate ${(SL_ODDS.hit * 100).toFixed(1)}%. The player has made ${st.spins} spins, put in ${fmt(st.inn)} and got back ${fmt(st.back)}.${st.last ? ' Last spin: ' + st.last.s.map(slName).join(', ') + '.' : ''}`,
  rules: `Table: a three-reel slot machine with one payline. Every spin is independent and random; there is no skill, timing or "due" machine. This machine pays back ${(SL_ODDS.rtp * 100).toFixed(1)}% over time (house edge ${((1 - SL_ODDS.rtp) * 100).toFixed(1)}%) and pays something on about ${(SL_ODDS.hit * 100).toFixed(0)}% of spins. Real casino slots usually pay back 85% to 98%, and many use weighted virtual reels that make jackpot symbols rarer than they look and show near misses more often.`,
  board: () => '',
  bot: () => ({ bets: [], why: '' }),
  async play(st) {
    const s = [0, 1, 2].map(() => SL_STRIP[Math.floor(Math.random() * SL_STRIP.length)]);
    await slSpin(s);
    return { s, mult: slPay(s) };
  },
  describe: o =>
    `The reels stop on <b>${o.s.map(slName).join(' · ')}</b>${o.mult ? `, paying <b>${o.mult}×</b>` : ''}.`,
  explain(o) {
    if (o.mult >= 30)
      return `A big hit: ${o.mult} times the bet. Wins like this are rare, and they are already counted inside the payback.`;
    if (o.mult > 0) return `A small win of ${o.mult}× the bet. Most wins on a slot are this size.`;
    const sevens = o.s.filter(x => x === '7').length;
    if (sevens === 2)
      return 'Two sevens and a miss. It feels close, but a near miss is just a loss, and it does not make a win more likely.';
    return 'No win this spin. About 7 spins in 8 pay nothing on this machine.';
  },
  headline: o => `${o.s.map(slName).join(', ')}.`,
  outcomeHTML: o => o.s.map(x => `<span class="sl-sym">${SL_SYMS[x].draw || '–'}</span>`).join(''),
  after(o, st, rows) {
    const mine = rows.filter(r => r.p.human);
    if (!mine.length) return;
    st.spins++;
    mine.forEach(r => {
      st.inn += r.b.amt;
      st.back += r.res === 'lose' ? 0 : r.b.amt + (r.pay || 0);
    });
    st.last = o;
    st.best = Math.max(st.best, o.mult);
    $('#readLabel').textContent =
      `Machine kept ${st.inn ? (((st.inn - st.back) / st.inn) * 100).toFixed(0) : 0}% so far`;
    $('#readText').textContent =
      `${st.spins} spins: ${fmt(st.inn)} in, ${fmt(st.back)} back. Over many spins this drifts toward ${((1 - SL_ODDS.rtp) * 100).toFixed(1)}%, the built-in edge.`;
  },
  read: true,
  quiet: o => o.mult < 20,
  bar: st =>
    `<div class="cg"><span class="cg-l">Last spin</span><div class="cg-c tgchips">${
      st.last
        ? st.last.s.map(x => `<span class="sl-sym">${SL_SYMS[x].draw || '–'}</span>`).join('')
        : '<span class="betchip none">No spins yet</span>'
    }</div></div>`,
  lesson(o, st) {
    if (o.mult >= 80)
      return 'A jackpot-size win. The machine planned for it: wins like this are paid for by thousands of losing spins.';
    return `This machine pays something about 1 spin in ${Math.round(1 / SL_ODDS.hit)}. Big wins feel common because they are loud and memorable, not because they are.`;
  },
  build: g => slBuild(g),
  frame(t) {
    SL.lights.forEach((l, i) => {
      const on = SL.spinning ? (Math.floor(t * 8) + i) % 2 : SL.glow > 0 ? Math.floor(t * 6 + i) % 2 : 1;
      l.material.emissiveIntensity = on ? 1.2 : 0.15;
    });
    if (SL.glow > 0) SL.glow -= 0.016;
  },
};

function slStripTex() {
  return canvasTex(2048, 256, (c, W, H) => {
    const w = W / SL_STRIP.length;
    c.fillStyle = '#f7f3ea';
    c.fillRect(0, 0, W, H);
    SL_STRIP.forEach((s, k) => {
      const sym = SL_SYMS[s];
      c.save();
      c.translate(k * w + w / 2, H / 2);
      c.rotate(Math.PI / 2);
      c.textAlign = 'center';
      c.textBaseline = 'middle';
      if (s === 'B') {
        c.fillStyle = '#1b1b22';
        c.fillRect(-62, -26, 124, 52);
        c.fillStyle = '#f0d28f';
        c.font = 'bold 40px Georgia';
        c.fillText('BAR', 0, 2);
      } else {
        c.fillStyle = sym.color || '#000';
        c.font = s === '7' ? 'bold 96px Georgia' : '72px serif';
        c.fillText(sym.draw, 0, 4);
      }
      c.restore();
    });
  });
}
function slMachine(g, x, live) {
  const m = new THREE.Group(),
    k = 1.4;
  m.scale.setScalar(k);
  m.position.set(x * k, FLOOR * (1 - k), 0.1 - Math.abs(x) * 0.35);
  m.rotation.y = -x * 0.14;
  g.add(m);
  const body = new THREE.MeshStandardMaterial({
    color: live ? 0x5a1a1e : 0x2e1214,
    roughness: 0.35,
    metalness: 0.3,
  });
  const trim = new THREE.MeshStandardMaterial({ color: 0xd4ad62, roughness: 0.3, metalness: 0.75 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x120b0b, roughness: 0.6 });
  const box = (w, h, d, mat, px, py, pz) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    b.position.set(px, py, pz);
    b.castShadow = true;
    m.add(b);
    return b;
  };
  box(1.5, 1.3, 0.9, body, 0, FLOOR + 0.65, 0);
  box(1.56, 0.08, 1.0, trim, 0, FLOOR + 1.32, 0.02);
  box(1.5, 2.1, 0.8, body, 0, FLOOR + 2.4, -0.05);
  box(1.2, 0.86, 0.06, dark, 0, FLOOR + 2.35, 0.36);
  [
    [1.3, 0.07, 0, 0.47],
    [1.3, 0.07, 0, -0.47],
    [0.07, 1.0, 0.63, 0],
    [0.07, 1.0, -0.63, 0],
  ].forEach(([w, h, px, py]) => box(w, h, 0.1, trim, px, FLOOR + 2.35 + py, 0.38));
  box(1.6, 0.55, 0.85, body, 0, FLOOR + 3.75, -0.05);
  const sign = new THREE.Mesh(
    new THREE.PlaneGeometry(1.4, 0.4),
    new THREE.MeshBasicMaterial({
      map: canvasTex(512, 146, (c, W, H) => {
        c.fillStyle = '#1d120c';
        c.fillRect(0, 0, W, H);
        c.fillStyle = '#f0d28f';
        c.font = 'bold 64px Georgia';
        c.textAlign = 'center';
        c.textBaseline = 'middle';
        c.fillText(live ? '7 · 7 · 7' : 'BAR · BAR', W / 2, H / 2);
      }),
    }),
  );
  sign.position.set(0, FLOOR + 3.75, 0.38);
  m.add(sign);
  for (let i = 0; i < 9; i++) {
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.035, 10, 8),
      new THREE.MeshStandardMaterial({
        color: 0xf0d28f,
        emissive: 0xf0b040,
        emissiveIntensity: live ? 1 : 0.3,
      }),
    );
    bulb.position.set(-0.72 + i * 0.18, FLOOR + 4.06, 0.38);
    m.add(bulb);
    if (live) SL.lights.push(bulb);
  }
  const tex = slStripTex(),
    reels = [];
  for (let i = 0; i < 3; i++) {
    const spin = new THREE.Group();
    spin.position.set(-0.38 + i * 0.38, FLOOR + 2.35, 0.18);
    const cyl = new THREE.Mesh(
      new THREE.CylinderGeometry(0.36, 0.36, 0.34, 40, 1, true),
      new THREE.MeshStandardMaterial({ map: tex, roughness: 0.5 }),
    );
    cyl.rotation.z = Math.PI / 2;
    spin.add(cyl);
    spin.rotation.x = slAngle(Math.floor(Math.random() * SL_STRIP.length));
    m.add(spin);
    reels.push(spin);
  }
  const line = box(
    1.18,
    0.012,
    0.02,
    new THREE.MeshBasicMaterial({ color: 0xe2665b }),
    0,
    FLOOR + 2.35,
    0.55,
  );
  line.castShadow = false;
  return reels;
}
const slAngle = k => ((k + 0.5) / SL_STRIP.length) * Math.PI * 2;
function slBuild(g) {
  SL.lights = [];
  SL.reels = slMachine(g, 0, true);
  slMachine(g, -1.75, false);
  slMachine(g, 1.75, false);
}
async function slSpin(s) {
  SL.spinning = true;
  TG.focus = V3(0, 0.3, -0.5);
  await Promise.all(
    SL.reels.map((r, i) => {
      const options = SL_STRIP.map((x, k) => k).filter(k => SL_STRIP[k] === s[i]),
        k = options[Math.floor(Math.random() * options.length)],
        from = r.rotation.x,
        base = slAngle(k);
      let to = base + Math.PI * 2 * Math.ceil((from - base) / (Math.PI * 2));
      to += Math.PI * 2 * (3 + i);
      return animate(
        650 + i * 300,
        t => {
          const e = t < 1 ? 1 - Math.pow(1 - t, 3) : 1;
          r.rotation.x = from + (to - from) * e + Math.sin(t * Math.PI) * 0.02 * (t > 0.85 ? 1 : 0);
        },
        t => t,
      );
    }),
  );
  SL.spinning = false;
  if (slPay(s) >= 10) SL.glow = 2.5;
}
