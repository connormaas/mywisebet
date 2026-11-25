// Dealer games where everyone bets on one shared outcome: roulette, craps and baccarat.
// Each game registers its bets, 3D props and bot styles. This file runs the table around them:
// seating, the betting board, the coach, payouts and the AI chat context.

const TGAMES = {};
const TG = {
  def: null,
  started: false,
  players: [],
  me: null,
  dealer: null,
  round: 0,
  phase: 'idle',
  group: null,
  focus: V3(0, 1, -2.5),
  state: {},
  chip: 25,
  last: [],
  rounds: 0,
  good: 0,
};
const TG_SPOTS = [125, 55, 155, 25];
const TG_MAX = 500;
let tgResolve = null;

const gameStarted = () => (MODE === 'blackjack' ? BJ.started : TGAMES[MODE] ? TG.started : started);
const seatTable = () => (MODE === 'blackjack' ? bjSeat() : tgSeat());
const tgStack = p => !TG.def.noTable && bjStackPile(p);
const tgName = p => (p.human ? '<b>You</b>' : `<b style="color:${p.P.css}">${p.P.name}</b>`);
const tgOn = p => p.bets.reduce((a, b) => a + b.amt, 0);
const tgEdge = e => (e < 0.0005 ? '0%' : (e * 100).toFixed(e < 0.1 ? 2 : 1) + '%');
const tgBetText = (bets, def = TG.def) => bets.map(b => `${def.bets[b.id].short} ${fmt(b.amt)}`).join(' · ');

function feltText(g, text, w, h, font, pos, col = 'rgba(240,210,143,.85)') {
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
  return m;
}

/* ----- entering a game ----- */
function tgInit(key) {
  const d = (TG.def = TGAMES[key]);
  MODE = key;
  [felt, apron, rail, ped, foot, deckMesh, dealerBtn, ring, ...slotMeshes].forEach(o => (o.visible = false));
  for (let i = 1; i < 6; i++) {
    const p = G.players[i];
    if (p.av) (scene.remove(p.av.root), (p.av = null));
    if (p.chair) (scene.remove(p.chair), (p.chair = null));
    p.sitting = false;
    p.el.hidden = true;
  }
  const g = (TG.group = new THREE.Group());
  scene.add(g);
  if (!d.noTable) halfTable(g, ...d.felt);
  if (d.rack !== false && !d.noTable) {
    const rack = new THREE.Mesh(
      new THREE.BoxGeometry(2.3, 0.1, 0.5),
      new THREE.MeshStandardMaterial({ color: 0x1d120c, roughness: 0.4 }),
    );
    rack.position.copy(RACK_POS).setY(0.08);
    g.add(rack);
    [1000, 500, 100, 25, 5, 1].forEach((v, i) => {
      const p = makePile(v * 6, { den: [v], perCol: 6, maxCols: 1 });
      p.position.set(-0.9 + i * 0.35, 0.13, RACK_POS.z);
      g.add(p);
    });
  }
  d.build(g);
  TG.dealer = null;
  if (!d.solo) {
    const av = makeAvatar({ key: 'dealer', name: 'Dealer', color: 0x1f4d3a, skin: 0xd9a882, acc: 'bowtie' });
    av.root.position.set(0, 0.35, BJC.z - 0.95);
    av.root.lookAt(0, 0.35, 5);
    scene.add(av.root);
    TG.dealer = {
      dealer: true,
      av,
      seat: 20,
      P: { name: 'Dealer', key: 'dealer', css: '#f0d28f' },
      el: bjMakeTag('Dealer', d.dealerStyle, '#f0d28f'),
    };
  }
  if (d.solo) {
    ['#setOpps', '#setXray'].forEach(s => ($(s).closest('.setrow').hidden = true));
    ['#tgIntroCastHead', '#tgIntroCast', '#tgClear', '#tgRebet', '#xrayBtn'].forEach(
      s => ($(s).hidden = true),
    );
  }
  TG.me = { human: true, deg: 90, stack: START, bets: [], P: { name: 'You', key: 'you' } };
  TG.state = d.fresh();

  $('#handInfo').textContent = `${d.name} · Bets $5 to $500`;
  ['#rankBtn', '#bombBtn', '#bombNextBtn', '#bombRow', '#adviceBox', '#raiseRange'].forEach(
    s => ($(s).hidden = true),
  );
  $('#actionbar .actions').hidden = true;
  $('#actionbar .presets').hidden = true;
  $('#tgActions').hidden = false;
  $('#tgChips').hidden = false;
  $('#tgGo').innerHTML = `${d.go}<kbd>Enter</kbd>`;
  $('#sizerNote').textContent = d.autoBet
    ? 'Each spin bets the chip you pick.'
    : 'Pick a chip, then tap the board.';
  $('#oppHelp').textContent =
    'Up to 4 players can sit with you. They take seats around the table in this order, alternating left and right of you.';
  $('#askInput').placeholder = `Ask about this round or anything in ${d.name.toLowerCase()}`;
  const rs = $('#readLabel').closest('.coach-section');
  rs.querySelector('.eyebrow').textContent = 'Your decisions';
  $('#readLabel').textContent = 'No bets yet';
  $('#readText').textContent = d.readIntro;
  [...$('#trackLabels').children].forEach((el, i) => (el.textContent = d.track[i]));
  $('#stageTitle').textContent = 'Take a seat';
  $('#stageText').textContent = 'Choose your settings and who joins you, then press "Start game".';
  lastMove('The dealer is getting the table ready.');
  $('#tgbLayout').innerHTML = d.board();
  $('#tgbLayout').className = 'tgb-' + key;
  tgIntroFill();
  tgSeat();
  tgRenderBar();
  tgSetButtons(false);
}

function tgSeat() {
  TG.players.forEach(p => {
    [p.av && p.av.root, p.chair, p.stackPile, p.pile].forEach(o => o && scene.remove(o));
    p.el && p.el.remove();
  });
  const chosen = (TG.def.solo ? [] : SETUP.order)
    .filter(k => SETUP.on[k])
    .slice(0, 4)
    .map(k => PERSONAS.find(P => P.key === k));
  TG.players = chosen.map((P, i) => {
    const deg = TG_SPOTS[i];
    const p = {
      P,
      deg,
      seat: 10 + i,
      stack: START,
      bets: [],
      tilt: 0,
      hot: 0,
      losses: 0,
      thinking: false,
      thought: '',
      last: '',
      winT: -9,
      mem: {},
    };
    p.chair = makeChair();
    p.chair.position.copy(bjAt(deg, 1.25, 0));
    p.chair.lookAt(0, 0, BJC.z + 0.4);
    scene.add(p.chair);
    p.av = makeAvatar(P);
    p.av.root.position.copy(bjAt(deg, 1.25, 0));
    p.av.root.lookAt(0, 0, BJC.z + 0.4);
    scene.add(p.av.root);
    p.el = bjMakeTag(P.name, TG.def.meta[P.key].style, P.css);
    return p;
  });
  if (TG.me.pile) (scene.remove(TG.me.pile), (TG.me.pile = null));
  TG.me.stack = START;
  TG.me.bets = [];
  [TG.me, ...TG.players].forEach(p => {
    tgStack(p);
    tgBetPile(p);
  });
  tgUpdateTags();
}

/* ----- chips on the felt ----- */
function tgBetPile(p) {
  if (p.pile) scene.remove(p.pile);
  p.pile = null;
  if (TG.def.noTable) return;
  const on = tgOn(p);
  if (on > 0) {
    p.pile = makePile(on);
    p.pile.position.copy(bjAt(p.deg, 0.6, 0.055));
    scene.add(p.pile);
  }
}
function tgPlace(p, id, amt) {
  const spec = TG.def.bets[id];
  if (!spec) return 0;
  let b = p.bets.find(x => x.id === id);
  const cap = spec.max ? spec.max(TG.state, p) : TG_MAX;
  amt = Math.min(amt, p.stack, cap - (b ? b.amt : 0));
  if (amt <= 0) return 0;
  if (!b) p.bets.push((b = { id, amt: 0, fresh: 0 }));
  b.amt += amt;
  b.fresh += amt;
  p.stack -= amt;
  return amt;
}
const tgOpen = (id, p = TG.me) => {
  const s = TG.def.bets[id];
  return !!s && (!s.open || s.open(TG.state, p));
};

/* ----- the betting board (you) ----- */
function tgBoardSync() {
  const me = TG.me,
    pick = G.hints ? TG.def.pick(TG.state, me).ids : [];
  document.querySelectorAll('#tgbLayout [data-bet]').forEach(el => {
    const id = el.dataset.bet,
      b = me.bets.find(x => x.id === id),
      amt = b ? b.amt : 0;
    el.classList.toggle('has', amt > 0);
    el.dataset.amt = amt ? fmt(amt) : '';
    el.classList.toggle('pick', pick.includes(id));
    el.disabled = !tgOpen(id) && !amt;
    el.classList.toggle('locked', !!b && b.amt > b.fresh);
  });
  const fresh = me.bets.reduce((a, b) => a + b.fresh, 0);
  $('#tgClear').disabled = !fresh || !tgResolve;
  $('#tgRebet').disabled = !tgResolve || !TG.last.length || fresh > 0;
  $('#tgbTotal').textContent = tgOn(me) ? 'On the table ' + fmt(tgOn(me)) : 'No bets yet';
}
// Keeps the board just above the action bar, whose height changes with what it shows.
const tgFitBoard = () => $('#tgBoard').style.setProperty('--ab-h', $('#actionbar').offsetHeight + 'px');
window.addEventListener('resize', () => TGAMES[MODE] && tgFitBoard());
function tgTouch(p) {
  tgBetPile(p);
  tgStack(p);
  tgBoardSync();
  tgAdvice();
  tgRenderBar();
  tgFitBoard();
}
function tgAdd(id) {
  if (!tgResolve || TG.phase !== 'bet' || !tgOpen(id)) return;
  if (tgPlace(TG.me, id, TG.chip)) tgTouch(TG.me);
}
function tgTake(id) {
  if (!tgResolve || TG.phase !== 'bet') return;
  const me = TG.me,
    b = me.bets.find(x => x.id === id);
  if (!b || !b.fresh) return;
  const amt = Math.min(TG.chip, b.fresh);
  b.amt -= amt;
  b.fresh -= amt;
  me.stack += amt;
  if (!b.amt) me.bets.splice(me.bets.indexOf(b), 1);
  tgTouch(me);
}
function tgClear() {
  const me = TG.me;
  me.bets.forEach(b => {
    me.stack += b.fresh;
    b.amt -= b.fresh;
    b.fresh = 0;
  });
  me.bets = me.bets.filter(b => b.amt > 0);
  tgTouch(me);
}
function tgRebet() {
  TG.last.forEach(({ id, amt }) => tgOpen(id) && tgPlace(TG.me, id, amt));
  tgTouch(TG.me);
}
function tgSetButtons(on) {
  $('#actionbar').classList.toggle('myturn', on);
  $('#tgGo').disabled = !on;
  document.querySelectorAll('#tgChips button').forEach(b => {
    b.setAttribute('aria-pressed', String(+b.dataset.v === TG.chip));
    b.disabled = !on;
  });
  tgBoardSync();
}
function tgHumanBet() {
  return new Promise(res => {
    const me = TG.me;
    if (me.stack + tgOn(me) < 5) {
      me.stack = START;
      me.start = START + tgOn(me);
      tgStack(me);
      log('You rebuy for $1,000.', 'sys');
    }
    $('#tgBoard').hidden = !!TG.def.autoBet;
    $('#tgbLayout').scrollTop = 0;
    $('#turnStatus').innerHTML = TG.def.autoBet
      ? `<b>Pick a chip,</b> then press ${TG.def.go}.`
      : `<b>Place your bets.</b> Then press ${TG.def.go}.`;
    tgResolve = () => {
      tgResolve = null;
      $('#tgBoard').hidden = true;
      tgSetButtons(false);
      $('#turnStatus').textContent = '';
      res();
    };
    tgSetButtons(true);
    tgAdvice();
    tgFitBoard();
  });
}

/* ----- coach panel ----- */
function tgOdds(bets) {
  const d = TG.def;
  if (!d.outcomes || !bets.length) return null;
  let up = 0,
    settled = 0;
  for (const { p, o } of d.outcomes(TG.state)) {
    let net = 0,
      done = false;
    for (const b of bets) {
      const r = d.settle(b, o, TG.state);
      if (r.res === 'stay') continue;
      done = true;
      net += r.res === 'win' ? r.pay : r.res === 'lose' ? -b.amt : 0;
    }
    if (done) settled += p;
    if (net > 0) up += p;
  }
  return settled ? up : null;
}
function tgAdvice() {
  const d = TG.def,
    me = TG.me,
    bets = me.bets.filter(b => b.amt > 0),
    on = tgOn(me);
  $('#tgAdvice').hidden = false;
  $('#tgYou').textContent = on ? tgBetText(bets) : 'No bets yet';
  const cost = bets.reduce((a, b) => a + b.amt * d.bets[b.id].edge, 0),
    edge = on ? cost / on : 0;
  $('#tgEdgeV').textContent = on ? tgEdge(edge) : '–';
  $('#tgEdgeBar').style.width = Math.min(100, (edge / 0.17) * 100) + '%';
  $('#tgCost').textContent = on ? '$' + cost.toFixed(2) : '–';
  const w = tgOdds(bets);
  $('#tgWinRow').hidden = w === null;
  if (w !== null) {
    $('#tgWin').textContent = pct(w);
    $('#tgWinBar').style.width = pct(w);
  }
  const pk = d.pick(TG.state, me);
  $('#tgRecRow').hidden = !G.hints;
  $('#tgRecChip').textContent = pk.label;
  $('#tgRecWhy').textContent = pk.why;
}
function tgUpdateDecisions() {
  if (!TG.rounds) return;
  $('#readLabel').textContent = `${TG.good} of ${TG.rounds} rounds on the smart bets`;
  const r = TG.good / TG.rounds;
  $('#readText').textContent =
    r >= 0.9
      ? 'You keep to the bets with the smallest house edge. That makes your chips last the longest.'
      : r >= 0.6
        ? 'Mostly smart bets. The coach pick on the board shows the cheapest bet each round.'
        : 'Most of your chips go on bets with a big house edge. Fun, but they drain chips fastest.';
}
function tgStage(i, title, text) {
  $('#stageTitle').textContent = title;
  $('#stageText').textContent = text;
  [...$('#track').children].forEach((el, k) => (el.className = k < i ? 'done' : k === i ? 'now' : ''));
  [...$('#trackLabels').children].forEach((el, k) => (el.className = k === i ? 'now' : ''));
}

/* ----- tags and the bar under the table ----- */
function tgUpdateTags() {
  const d = TG.def;
  if (TG.dealer) {
    TG.dealer.el.querySelector('.stk').textContent = d.dealerInfo(TG.state);
    TG.dealer.el.querySelector('.xray').hidden = true;
  }
  for (const p of TG.players) {
    const el = p.el;
    el.querySelector('.stk').textContent = fmt(p.stack);
    const ab = el.querySelector('.act-badge');
    ab.textContent = p.last;
    ab.className = 'act-badge ' + ({ Win: 'Call', Lose: 'Fold', Push: 'Check', Bet: 'Raise' }[p.last] || '');
    el.querySelector('.dots').hidden = !p.thinking;
    const mood = el.querySelector('.mood');
    mood.hidden = !(p.tilt > 0.4 || p.hot > 0.6);
    mood.className = 'mood ' + (p.tilt > 0.4 ? 'tilt' : 'hot');
    mood.textContent = p.tilt > 0.4 ? 'On tilt' : 'Running hot';
    const xr = el.querySelector('.xray');
    xr.hidden = !(G.xray && p.thought);
    if (!xr.hidden) {
      xr.querySelector('.xc').innerHTML = '';
      const th = xr.querySelector('.thought');
      th.textContent = p.thought;
      th.hidden = false;
    }
  }
}
function tgRenderBar() {
  const me = TG.me,
    bets = me.bets.filter(b => b.amt);
  const chips = bets.length
    ? bets.map(b => `<span class="betchip">${TG.def.bets[b.id].short}<b>${fmt(b.amt)}</b></span>`).join('')
    : '<span class="betchip none">No bets yet</span>';
  $('#myCards').innerHTML =
    `<div class="cg"><span class="cg-l">Your bets</span><div class="cg-c tgchips">${chips}</div></div>` +
    (TG.def.bar ? `<span class="cdiv"></span>${TG.def.bar(TG.state)}` : '');
  $('#myHandName').textContent =
    TG.phase === 'bet'
      ? TG.def.autoBet
        ? 'Choose your bet'
        : 'Place your bets'
      : bets.length
        ? 'Bets are in'
        : 'Watching';
  $('#myStack').textContent = fmt(me.stack);
  $('#myRole').textContent = tgOn(me) ? ' · On the table ' + fmt(tgOn(me)) : '';
}

/* ----- one round ----- */
async function tgRound() {
  const d = TG.def,
    st = TG.state,
    all = [TG.me, ...TG.players];
  TG.round++;
  TG.phase = 'bet';
  $('#handInfo').textContent = `${d.name} · Round ${TG.round}${d.info ? ' · ' + d.info(st) : ''}`;
  log(`Round ${TG.round}${d.info ? ' · ' + d.info(st) : ''}`, 'hand');
  tgStage(0, ...d.stage(0, st));
  lastMove(d.betHint(st));
  for (const p of all) {
    p.bets.forEach(b => (b.fresh = 0));
    p.last = '';
    p.thought = '';
    p.start = p.stack + tgOn(p);
  }
  for (const p of TG.players)
    if (p.stack + tgOn(p) < 5) {
      p.stack = START;
      p.start = START + tgOn(p);
      log(`${tgName(p)} rebuys for $1,000.`, 'sys');
      say(p, 'rebuy', 1);
      tgStack(p);
    }
  tgRenderBar();
  tgUpdateTags();
  for (const p of TG.players) {
    p.thinking = true;
    tgUpdateTags();
    await wait(220 + p.P.think * 220 + Math.random() * 200);
    const plan = d.bot(p, st);
    p.thinking = false;
    p.thought = plan.why;
    const placed = [];
    plan.bets.forEach(({ id, amt }) => {
      const a = tgOpen(id, p) ? tgPlace(p, id, round5(amt)) : 0;
      if (a) placed.push({ id, amt: a });
    });
    if (placed.length) {
      p.last = 'Bet';
      log(`${tgName(p)} bets ${tgBetText(placed)}.`);
    }
    tgBetPile(p);
    tgStack(p);
    tgUpdateTags();
  }
  await tgHumanBet();
  const mine = TG.me.bets.filter(b => b.fresh > 0).map(b => ({ id: b.id, amt: b.fresh }));
  if (mine.length) {
    TG.last = mine;
    TG.rounds++;
    const good = d.goodEdge(st) + 1e-9,
      bad = mine.find(b => d.bets[b.id].edge > good);
    if (!bad) TG.good++;
    if (!d.read) tgUpdateDecisions();
    log(`You bet ${tgBetText(mine)}.`, 'sys');
    if (bad)
      log(
        `<span style="color:var(--muted)">Coach: ${esc(d.bets[bad.id].label)} carries a ${tgEdge(d.bets[bad.id].edge)} house edge. ${esc(d.pick(st, TG.me).why)}</span>`,
        'lesson',
      );
  } else if (!tgOn(TG.me)) log('You sit this one out.', 'sys');
  TG.phase = 'play';
  tgRenderBar();
  tgStage(1, ...d.stage(1, st));
  const out = await d.play(st);
  TG.phase = 'pay';
  const rows = [];
  for (const p of all)
    for (const b of [...p.bets]) {
      const r = d.settle(b, out, st);
      if (r.res === 'stay') continue;
      rows.push({ p, b, ...r });
      p.bets.splice(p.bets.indexOf(b), 1);
    }
  tgStage(2, ...d.stage(2, st, out));
  log(d.describe(out, st), 'sys');
  lastMove(d.explain(out, st));
  await wait(500);
  tgStage(3, ...d.stage(3, st, out));
  await tgPay(rows);
  tgAdvice();
  const before = { ...st };
  d.after && d.after(out, st, rows);
  for (const p of TG.players) {
    const net = p.stack + tgOn(p) - p.start;
    if (!rows.some(r => r.p === p)) continue;
    p.last = net > 0 ? 'Win' : net < 0 ? 'Lose' : 'Push';
    if (net < 0) {
      p.losses++;
      p.hot *= 0.5;
      if (p.P.key === 'rico' && p.losses >= 2 && p.tilt < 0.4) {
        p.tilt = 0.8;
        log(
          `${tgName(p)} is <b>on tilt</b> after ${p.losses} losses in a row and starts betting bigger to win it back. That is called chasing losses.`,
          'lesson',
        );
        say(p, 'tilt', 0.9);
      } else say(p, 'lose', 0.25);
    } else if (net > 0) {
      p.losses = 0;
      p.tilt *= 0.4;
      if (net >= 100) p.hot = 1;
      p.winT = gameNow() / 1000;
      say(p, 'win', 0.3);
    }
  }
  tgUpdateTags();
  tgRenderBar();
  const myRows = rows.filter(r => r.p.human);
  if (d.quiet && d.quiet(out, before, myRows)) {
    await wait(900);
  } else {
    tgStage(4, ...d.stage(4, st, out));
    tgBanner(out, before, rows, myRows);
    await new Promise(res => {
      $('#banner').hidden = false;
      $('#bNext').focus({ preventScroll: true });
      nextResolve = res;
      $('#turnStatus').textContent = 'Round over.';
    });
  }
  TG.phase = 'idle';
  d.clear && (await d.clear(st));
}
async function tgPay(rows) {
  const by = new Map();
  for (const r of rows) {
    const e = by.get(r.p) || { lost: 0, back: 0, won: 0 };
    if (r.res === 'lose') e.lost += r.b.amt;
    else {
      e.back += r.b.amt;
      if (r.res === 'win') e.won += r.pay;
    }
    by.set(r.p, e);
  }
  const jobs = [];
  for (const [p, e] of by) {
    tgBetPile(p);
    if (TG.def.noTable) {
      p.stack += e.back + e.won;
      continue;
    }
    const at = bjAt(p.deg, 0.6, 0.055);
    jobs.push(
      (async () => {
        if (e.lost) {
          const l = makePile(e.lost);
          l.position.copy(at);
          scene.add(l);
          await moveTo(l, RACK_POS, 500, 0.3);
          scene.remove(l);
        }
        if (e.won) {
          const w = makePile(e.won);
          w.position.copy(RACK_POS);
          scene.add(w);
          await moveTo(w, at.clone().add(V3(0.25, 0, 0)), 450, 0.3);
          scene.remove(w);
        }
        if (e.back + e.won) {
          const b = makePile(e.back + e.won);
          b.position.copy(at);
          scene.add(b);
          await moveTo(b, p.stackPile.position.clone(), 450, 0.3);
          scene.remove(b);
        }
        p.stack += e.back + e.won;
        tgStack(p);
      })(),
    );
  }
  await Promise.all(jobs);
}
function tgBanner(out, st, rows, myRows) {
  const d = TG.def,
    me = TG.me,
    net = me.stack + tgOn(me) - me.start;
  $('#bEyebrow').textContent = `Round ${TG.round} result`;
  $('#bTitle').textContent =
    net > 0
      ? `You win ${fmt(net)}`
      : net < 0
        ? `You lose ${fmt(-net)}`
        : myRows.length
          ? 'You break even'
          : tgOn(me)
            ? 'Your bets ride'
            : 'You sat this one out';
  $('#bSub').textContent = d.headline(out, st);
  const list = $('#bList');
  list.innerHTML = `<li class="potline"><span class="who">${d.name}</span><span class="hn">${d.outcomeHTML(out, st)}</span></li>`;
  [TG.me, ...TG.players].forEach(p => {
    const rs = rows.filter(r => r.p === p);
    if (!rs.length) return;
    const n = rs.reduce((a, r) => a + (r.res === 'win' ? r.pay : r.res === 'lose' ? -r.b.amt : 0), 0);
    const txt = rs
      .map(
        r =>
          `${d.bets[r.b.id].short} ${fmt(r.b.amt)} ${r.res === 'win' ? '+' + fmt(r.pay) : r.res === 'lose' ? 'lost' : 'push'}`,
      )
      .join(' · ');
    list.insertAdjacentHTML(
      'beforeend',
      `<li class="${n > 0 ? 'won' : ''}"><span class="who" style="color:${p.human ? 'var(--ink)' : p.P.css}">${p.human ? 'You' : p.P.name}</span><span class="hn">${txt}</span></li>`,
    );
  });
  $('#bLesson').textContent = d.lesson(out, st, myRows);
  $('#bNext').innerHTML = 'Next round<kbd>Space</kbd>';
}

/* ----- game lifecycle ----- */
async function tgLoop() {
  const g = GEN;
  try {
    while (g === GEN) await tgRound();
  } catch (e) {
    if (!(e instanceof Reset)) console.error(e);
  }
}
function tgStart() {
  if (TG.started) return;
  tgSeat();
  TG.started = true;
  TG.round = TG.rounds = TG.good = 0;
  TG.last = [];
  TG.state = TG.def.fresh();
  $('#readLabel').textContent = 'No bets yet';
  tgLoop();
}
function tgNewGame() {
  GEN++;
  anims.clear();
  nextResolve = null;
  tgResolve = null;
  TG.def.clear && TG.def.clear(TG.state, true);
  G.userPaused = false;
  app.classList.remove('paused');
  setPauseLabel();
  ['#banner', '#tgBoard', '#tgAdvice'].forEach(s => ($(s).hidden = true));
  $('#logList').innerHTML = '';
  TG.started = false;
  TG.phase = 'idle';
  TG.state = TG.def.fresh();
  tgSeat();
  tgSetButtons(false);
  $('#stageTitle').textContent = 'New game';
  $('#stageText').textContent = 'Choose your settings and who joins you, then press "Start game".';
  lastMove('Everyone is back to $1,000.');
  renderStartCard();
  $('#startCard').hidden = false;
  tgRenderBar();
}

/* ----- frame hook ----- */
function tgFrame(t) {
  const tags = [];
  for (const p of [...TG.players, TG.dealer]) {
    if (!p || !p.av) continue;
    const av = p.av;
    av.body.scale.y = 1 + Math.sin(t * 1.6 + p.seat) * 0.01;
    const local = av.root.worldToLocal(TG.focus.clone());
    const ty = clamp(Math.atan2(local.x, local.z), -0.9, 0.9);
    av.headPivot.rotation.y += (ty - av.headPivot.rotation.y) * 0.06;
    const tz = p.thinking ? Math.sin(t * 2.2) * 0.14 : 0;
    av.headPivot.rotation.z += (tz - av.headPivot.rotation.z) * 0.1;
    av.headPivot.rotation.x += ((p.thinking ? 0.25 : 0.1) - av.headPivot.rotation.x) * 0.06;
    if (!p.dealer) {
      const dt = t - p.winT;
      av.body.position.y = -1.0 + (dt < 1.6 ? Math.abs(Math.sin(dt * 7)) * 0.14 * (1 - dt / 1.6) : 0);
      av.skin.emissive.setRGB(p.tilt * 0.22, 0, 0);
    }
    tags.push(p);
  }
  layoutTags(tags);
  TG.def.frame && TG.def.frame(t);
}

/* ----- coach chat context ----- */
function tgRules() {
  const d = TG.def;
  return `You are the friendly coach inside "My Wise Bet", an app where a complete beginner learns ${d.name.toLowerCase()} by playing with pretend chips at a 3D table, alongside computer players. ${d.rules} Teach the house edge honestly: no betting system or pattern beats it, and the smart bets are the ones that lose the least over time. Answer in plain, encouraging language, usually 2 to 5 sentences unless asked for more. Use the real bets and amounts in the game state when it helps. You may point to parts of the app: the betting board, the "Coach pick" tag on the board, the house-edge bar in the coach panel, the X-ray option in the More menu, the Speed menu, Pause, and the table log. Write plain text with no markdown headings, bold or tables.`;
}
function tgSnapshot() {
  const d = TG.def,
    L = [];
  L.push(`Game: ${d.name}. Round ${TG.round}. Stage: ${TG.phase}. ${d.snapshot(TG.state)}`);
  L.push(`The player has ${fmt(TG.me.stack)} in chips, plus ${fmt(tgOn(TG.me))} on the table.`);
  const mb = TG.me.bets.filter(b => b.amt);
  L.push(
    mb.length
      ? "Player's bets: " +
          mb
            .map(
              b =>
                `${d.bets[b.id].label} ${fmt(b.amt)} (pays ${d.bets[b.id].pays}, house edge ${tgEdge(d.bets[b.id].edge)})`,
            )
            .join('; ') +
          '.'
      : 'The player has no bets on the table.',
  );
  const pk = d.pick(TG.state, TG.me);
  L.push(`Coach pick right now: ${pk.label}. ${pk.why}`);
  L.push('Other players at the table:');
  TG.players.forEach(p =>
    L.push(
      `- ${p.P.name}, ${d.meta[p.P.key].style} (${d.meta[p.P.key].blurb}) Stack ${fmt(p.stack)}.${p.bets.length ? ' Bets: ' + tgBetText(p.bets) + '.' : ''}${p.tilt > 0.4 ? ' Currently ON TILT.' : ''}`,
    ),
  );
  L.push(`Player's rounds on the smart bets so far: ${TG.good} of ${TG.rounds}.`);
  const logs = [...document.querySelectorAll('#logList li')].slice(-25).map(li => li.textContent);
  if (logs.length) L.push('Recent table log:\n' + logs.join('\n'));
  return L.join('\n');
}

/* ----- intro modal ----- */
function tgIntroFill() {
  const d = TG.def;
  $('#tgIntroEyebrow').textContent = d.name;
  $('#tgIntroTitle').textContent = d.title;
  $('#tgIntroLede').textContent = d.lede;
  $('#tgIntroSteps').innerHTML = d.steps
    .map(([h, t]) => `<div class="step"><span class="eyebrow">${h}</span>${t}</div>`)
    .join('');
  $('#tgIntroCast').innerHTML = (d.solo ? [] : PERSONAS.slice(1))
    .map(
      P =>
        `<div><span class="swatch" style="background:${P.css}"></span><span><b>${P.name}</b> · <span style="color:${P.css}">${d.meta[P.key].style}</span><br>${d.meta[P.key].blurb}</span></div>`,
    )
    .join('');
  $('#tgIntroNote').textContent = d.note;
}
function tgOpenIntro() {
  $('#tgIntro').hidden = false;
  $('#tgEnter').textContent = TG.started ? 'Back to the table' : 'Enter';
}

/* ----- wiring ----- */
$('#tgbLayout').addEventListener('click', e => {
  const el = e.target.closest('[data-bet]');
  if (el) tgAdd(el.dataset.bet);
});
$('#tgbLayout').addEventListener('contextmenu', e => {
  const el = e.target.closest('[data-bet]');
  if (!el) return;
  e.preventDefault();
  tgTake(el.dataset.bet);
});
document.querySelectorAll('#tgChips button').forEach(
  b =>
    (b.onclick = () => {
      TG.chip = +b.dataset.v;
      tgSetButtons(!!tgResolve);
    }),
);
$('#tgClear').onclick = () => tgResolve && tgClear();
$('#tgRebet').onclick = () => tgResolve && tgRebet();
$('#tgGo').onclick = () => {
  if (!tgResolve || TG.phase !== 'bet') return;
  const a = TG.def.autoBet;
  if (a && !TG.me.bets.some(b => b.fresh)) tgPlace(TG.me, a, TG.chip) && tgTouch(TG.me);
  tgResolve();
};
document.addEventListener('keydown', e => {
  if (!TGAMES[MODE] || !tgResolve || e.target.tagName === 'INPUT') return;
  const k = e.key.toLowerCase();
  if (k === 'enter') {
    e.preventDefault();
    $('#tgGo').click();
  } else if (k === 'x') $('#tgClear').click();
  else if (k === 'r') $('#tgRebet').click();
});
$('#xrayBtn').addEventListener('click', () => TGAMES[MODE] && tgUpdateTags());
$('#hintBtn').addEventListener('click', () => {
  if (!TGAMES[MODE]) return;
  tgBoardSync();
  if (!$('#tgAdvice').hidden) tgAdvice();
});
$('#tgEnter').onclick = () => {
  $('#tgIntro').hidden = true;
  if (!TG.started) {
    renderStartCard();
    $('#startCard').hidden = false;
  }
};
document.querySelectorAll('[data-game]').forEach(
  b =>
    (b.onclick = () => {
      tgInit(b.dataset.game);
      $('#home').hidden = true;
      tgOpenIntro();
    }),
);
