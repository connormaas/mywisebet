// Baccarat (punto banco): bet on Player, Banker or Tie. The cards follow fixed rules, so the only
// real decision is which bet to make, and the math says Banker.

const BC = { objs: [] };
const BC_SHOE = V3(2.35, 0.42, BJC.z + 0.85),
  BC_DISCARD = V3(-2.35, 0.2, BJC.z + 0.85),
  BC_P = V3(-0.85, 0.066, BJC.z + 1.45),
  BC_B = V3(0.85, 0.066, BJC.z + 1.45);
const bcVal = c => (c.r >= 10 && c.r <= 13 ? 0 : c.r === 14 ? 1 : c.r);
const bcTot = cs => cs.reduce((a, c) => a + bcVal(c), 0) % 10;
const BC_NAME = { P: 'Player', B: 'Banker', T: 'Tie' };

TGAMES.baccarat = {
  name: 'Baccarat',
  go: 'Deal',
  felt: ['#7a2a34', '#4a141c'],
  dealerStyle: 'Follows the drawing rules',
  track: ['Bets', 'Deal', 'Result', 'Payout', 'Recap'],
  title: 'The simplest bet in the casino',
  lede: 'Two hands are dealt, Player and Banker, and you bet on which one ends closer to 9. You make no choices once the cards come out, so the whole lesson is which bet to make, and why the scorecards people keep mean nothing.',
  steps: [
    [
      'The goal',
      'Bet on the Player hand, the Banker hand, or a Tie. Whichever hand totals closer to 9 wins.',
    ],
    [
      'Card values',
      'Aces count 1, 2 to 9 count as shown, and 10s and face cards count 0. Only the last digit counts: 7 + 8 = 5.',
    ],
    [
      'The draw',
      'Each hand gets 2 cards. A third card follows fixed rules nobody chooses. An 8 or 9 stops everything.',
    ],
    [
      'The payouts',
      'Player pays 1 to 1. Banker pays 1 to 1 minus 5%. Tie pays 8 to 1, and Player and Banker bets push.',
    ],
  ],
  note: "Banker wins slightly more often, which is why the house takes a 5% commission on it. Turn on X-ray in the More menu to see the hunches behind everyone else's bets.",
  readIntro: 'Each round, the coach checks whether you skipped the tie bet, which loses more than 14%.',
  meta: {
    marge: {
      style: 'Banker Only',
      blurb: 'Small bets on Banker every hand. Boring, and the cheapest bet on the table.',
    },
    rico: { style: 'Chases Streaks', blurb: 'Bets on whichever side just won, doubling after every loss.' },
    dev: {
      style: 'Knows the Math',
      blurb: 'Banker every time. 1.06% house edge, even after the commission.',
    },
    gus: {
      style: 'Loves the Tie',
      blurb: 'Tie pays 8 to 1, so he bets it every hand. It hits less than 1 time in 10.',
    },
    yuki: {
      style: 'Reads the Scorecard',
      blurb: 'Bets the opposite of the last result, sure the shoe is "due" to switch.',
    },
  },
  fresh: () => ({ shoe: [], hist: [], last: null }),
  bets: {
    player: { label: 'Player', short: 'Player', pays: '1 to 1', edge: 0.0124 },
    banker: { label: 'Banker', short: 'Banker', pays: '1 to 1 minus 5% commission', edge: 0.0106 },
    tie: { label: 'Tie', short: 'Tie', pays: '8 to 1', edge: 0.1436 },
  },
  outcomes: () => [
    { p: 0.4462, o: { w: 'P' } },
    { p: 0.4586, o: { w: 'B' } },
    { p: 0.0952, o: { w: 'T' } },
  ],
  goodEdge: () => 0.0124,
  pick: () => ({
    ids: ['banker'],
    label: 'Banker',
    why: "Banker wins 45.9% of hands to Player's 44.6%. Even after the 5% commission, it loses the least: 1.06%. Never bet the tie.",
  }),
  settle(b, o) {
    if (b.id === 'tie') return o.w === 'T' ? { res: 'win', pay: b.amt * 8 } : { res: 'lose' };
    if (o.w === 'T') return { res: 'push' };
    if (b.id === 'player') return o.w === 'P' ? { res: 'win', pay: b.amt } : { res: 'lose' };
    return o.w === 'B' ? { res: 'win', pay: Math.round(b.amt * 95) / 100 } : { res: 'lose' };
  },
  stage: (i, st, o) =>
    [
      ['Place your bets', 'Player, Banker or Tie. Nobody makes a choice after this: the cards decide.'],
      ['The deal', 'Two cards to Player, two to Banker. A third card may follow, by fixed rules.'],
      [
        'Result',
        o ? `${BC_NAME[o.w]}${o.w === 'T' ? '' : ' wins'}, ${o.pt} to ${o.bt}.` : 'The hands are compared.',
      ],
      [
        'Payout',
        'Player pays 1 to 1. Banker pays 1 to 1 minus 5%. Tie pays 8 to 1, and the other bets push.',
      ],
      ['Recap', 'See who won and which bet the math favors.'],
    ][i],
  betHint: () => 'Bets go on Player, Banker or Tie before the deal.',
  info: st => (st.last ? 'Last ' + BC_NAME[st.last.w] : 'Fresh shoe'),
  dealerInfo: st => (st.last ? BC_NAME[st.last.w] + ' won' : ''),
  snapshot: st =>
    `Eight-deck shoe, ${st.shoe.length} cards left. Last results, newest first: ${st.hist.map(w => BC_NAME[w]).join(', ') || 'none yet'}.${
      st.last
        ? ` Last hand: Player ${bcTxt(st.last.pc)} = ${st.last.pt}, Banker ${bcTxt(st.last.bc)} = ${st.last.bt}.`
        : ''
    }`,
  rules:
    'Table: punto banco baccarat, 8 decks. Aces count 1, 10s and face cards 0, totals use only the last digit. A natural 8 or 9 on two cards ends the hand. Otherwise Player draws on 0 to 5 and stands on 6 or 7; Banker draws by the standard tableau depending on its total and the Player third card. Player pays 1 to 1 (1.24% edge), Banker pays 1 to 1 minus a 5% commission (1.06% edge), Tie pays 8 to 1 (14.36% edge) and Player and Banker bets push on a tie. Players make no decisions after betting, and past results (scorecards, streaks) never predict the next hand.',
  board: () =>
    `<button class="spot o bc-p" data-bet="player">Player<small>1 to 1 · 1.24%</small></button>
     <button class="spot o bc-t" data-bet="tie">Tie<small>8 to 1 · 14.4%</small></button>
     <button class="spot o bc-b" data-bet="banker">Banker<small>1 to 1, minus 5% · 1.06%</small></button>`,
  bot(p, st) {
    const k = p.P.key,
      last = st.hist[0];
    if (k === 'marge') return { bets: [{ id: 'banker', amt: 10 }], why: 'Banker again. Small and steady.' };
    if (k === 'dev')
      return { bets: [{ id: 'banker', amt: 25 }], why: 'Banker has the lowest edge. Nothing else matters.' };
    if (k === 'gus')
      return {
        bets: [
          { id: 'tie', amt: 5 },
          { id: 'player', amt: 10 },
        ],
        why: "A tie pays 8 to 1! Haven't seen one in a while, so it's due.",
      };
    if (k === 'rico') {
      const side = last === 'P' ? 'player' : 'banker',
        amt = p.losses ? Math.min(400, 10 * 2 ** p.losses) : 20;
      return {
        bets: [{ id: side, amt }],
        why: p.losses
          ? `Lost ${p.losses} straight. Doubling to ${fmt(amt)} on the hot side.`
          : `${BC_NAME[last || 'B']} is hot. Riding the streak.`,
      };
    }
    const side = last === 'B' ? 'player' : 'banker';
    return {
      bets: [{ id: side, amt: 15 }],
      why: last
        ? `${BC_NAME[last]} just won, so the other side is due. (It isn't. Each hand is independent.)`
        : 'Starting on Banker.',
    };
  },
  async play(st) {
    if (st.shoe.length < 40) {
      const s = [];
      for (let d = 0; d < 8; d++) s.push(...FULL_DECK);
      st.shoe = shuffle(s);
      log('The dealer shuffles a fresh 8-deck shoe.', 'sys');
    }
    TG.focus = V3(0, 0.3, BJC.z + 1.45);
    const pc = [],
      bc = [];
    const deal = async (hand, to, k) => {
      const c = st.shoe.pop();
      hand.push(c);
      const o = makeCard(c);
      BC.objs.push(o);
      o.yaw.position.copy(BC_SHOE);
      const pos = to.clone().add(k < 2 ? V3((k - 0.5) * 0.55, 0, 0) : V3(0, 0, 0.62));
      await animate(260, e => {
        o.yaw.position.lerpVectors(BC_SHOE, pos, e);
        o.yaw.position.y += Math.sin(Math.PI * e) * 0.3;
        if (k === 2) o.yaw.rotation.y = (Math.PI / 2) * e;
      });
      await flip(o, true);
      st.live = { pc, bc };
      tgRenderBar();
    };
    await deal(pc, BC_P, 0);
    await deal(bc, BC_B, 0);
    await deal(pc, BC_P, 1);
    await deal(bc, BC_B, 1);
    let pt = bcTot(pc),
      bt = bcTot(bc);
    if (pt < 8 && bt < 8) {
      let p3 = null;
      if (pt <= 5) {
        await wait(400);
        log(`Player has ${pt} and draws.`, 'sys');
        await deal(pc, BC_P, 2);
        p3 = bcVal(pc[2]);
      } else log(`Player stands on ${pt}.`, 'sys');
      const draws =
        p3 === null
          ? bt <= 5
          : bt <= 2 ||
            (bt === 3 && p3 !== 8) ||
            (bt === 4 && p3 >= 2 && p3 <= 7) ||
            (bt === 5 && p3 >= 4 && p3 <= 7) ||
            (bt === 6 && p3 >= 6 && p3 <= 7);
      if (draws) {
        await wait(400);
        log(`Banker has ${bt} and draws.`, 'sys');
        await deal(bc, BC_B, 2);
      } else log(`Banker stands on ${bt}.`, 'sys');
      pt = bcTot(pc);
      bt = bcTot(bc);
    } else log(`A natural ${Math.max(pt, bt)}. No more cards.`, 'sys');
    return { w: pt > bt ? 'P' : bt > pt ? 'B' : 'T', pt, bt, pc, bc };
  },
  describe: o =>
    `Player <b>${o.pt}</b>, Banker <b>${o.bt}</b>: <b>${o.w === 'T' ? 'Tie' : BC_NAME[o.w] + ' wins'}</b>.`,
  explain: o =>
    o.w === 'T'
      ? `Both hands made ${o.pt}. Tie bets win 8 to 1; Player and Banker bets push and come back.`
      : `${BC_NAME[o.w]} wins ${Math.max(o.pt, o.bt)} to ${Math.min(o.pt, o.bt)}.${o.pc.length + o.bc.length === 4 ? ' No third cards were needed.' : ' The third-card rules decided who drew, not anyone at the table.'}`,
  headline: o => `Player ${o.pt}, Banker ${o.bt}. ${o.w === 'T' ? 'A tie.' : BC_NAME[o.w] + ' wins.'}`,
  outcomeHTML: o => `Player ${o.pc.map(mini2).join('')} ${o.pt} · Banker ${o.bc.map(mini2).join('')} ${o.bt}`,
  after(o, st) {
    st.last = o;
    st.hist.unshift(o.w);
    if (st.hist.length > 20) st.hist.pop();
  },
  bar(st) {
    const L = st.live || (st.last && { pc: st.last.pc, bc: st.last.bc });
    if (!L)
      return '<div class="cg"><span class="cg-l">Player · Banker</span><div class="cg-c"><span class="pc slot"></span><span class="pc slot"></span></div></div>';
    const g = (n, cs) =>
      `<div class="cg"><span class="cg-l">${n} · ${bcTot(cs)}</span><div class="cg-c">${cs.map(c => cardHTML(c)).join('')}</div></div>`;
    return g('Player', L.pc) + '<span class="cdiv"></span>' + g('Banker', L.bc);
  },
  lesson(o, st, mine) {
    const ids = mine.map(r => r.b.id);
    if (ids.includes('tie') && o.w === 'T')
      return 'The tie hit and paid 8 to 1. But ties come about 1 hand in 10.5, so fair odds would be 9.5 to 1. That gap is a 14% house edge.';
    if (ids.includes('tie'))
      return 'The tie bet loses 14.4% over time, more than 10 times worse than Banker. It is the trap on this table.';
    if (st.hist.length >= 3 && st.hist[0] === st.hist[1] && st.hist[1] === st.hist[2])
      return 'Streaks feel meaningful, but each hand is independent. Scorecards help casinos sell the feeling of a pattern.';
    if (ids.includes('banker') && o.w === 'B')
      return 'Banker wins pay 95 cents per dollar. That 5% commission is why Banker wins more often but still loses 1.06% over time.';
    if (ids.includes('player'))
      return 'Player is a fine bet at 1.24%, just a bit worse than Banker. The difference is small, but it adds up.';
    return 'With no decisions after the bet, baccarat comes down to two choices: bet Banker, and bet an amount you are happy to lose.';
  },
  build(g) {
    const boxes = canvasTex(1536, 512, (c, W, H) => {
      c.strokeStyle = 'rgba(240,210,143,.75)';
      c.lineWidth = 6;
      c.fillStyle = 'rgba(240,210,143,.85)';
      c.font = 'bold 84px Georgia';
      c.textAlign = 'center';
      [
        ['PLAYER', 40],
        ['BANKER', W / 2 + 40],
      ].forEach(([t, x]) => {
        c.strokeRect(x, 20, W / 2 - 80, H - 40);
        c.fillText(t, x + (W / 2 - 80) / 2, H - 60);
      });
    });
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(3.6, 1.2),
      new THREE.MeshBasicMaterial({ map: boxes, transparent: true, depthWrite: false }),
    );
    m.rotation.x = -Math.PI / 2;
    m.position.set(0, 0.054, BJC.z + 1.7);
    g.add(m);
    feltText(g, 'TIE PAYS 8 TO 1', 3.0, 0.36, 'bold 92px Georgia, serif', V3(0, 0.054, 1.32));
    feltText(
      g,
      'Banker wins pay 19 to 20  ·  5% commission',
      3.4,
      0.26,
      'italic 54px Georgia, serif',
      V3(0, 0.054, 1.68),
      'rgba(240,210,143,.6)',
    );
    const shoe = new THREE.Mesh(
      new THREE.BoxGeometry(0.62, 0.38, 0.92),
      new THREE.MeshStandardMaterial({ color: 0x1d120c, roughness: 0.5 }),
    );
    shoe.position.copy(BC_SHOE).setY(0.24);
    shoe.rotation.y = -0.45;
    shoe.castShadow = true;
    g.add(shoe);
    const tray = new THREE.Mesh(
      new THREE.BoxGeometry(0.64, 0.08, 0.86),
      new THREE.MeshStandardMaterial({ color: 0x1d120c }),
    );
    tray.position.copy(BC_DISCARD).setY(0.08);
    tray.rotation.y = 0.45;
    g.add(tray);
  },
  async clear(st, hard) {
    const objs = BC.objs;
    BC.objs = [];
    if (st) st.live = null;
    if (!hard)
      await Promise.all(
        objs.map((o, i) => moveTo(o.yaw, BC_DISCARD.clone().setY(0.2 + i * 0.004), 320, 0.3)),
      );
    objs.forEach(o => scene.remove(o.yaw));
    cardObjs = [];
  },
};
const bcTxt = cs => cs.map(c => RANK_CH[c.r] + SUIT_CH[c.s]).join(' ');
