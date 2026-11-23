// Poker math: hand evaluation, draws and Monte Carlo equity. No DOM, no 3D.
const RANK_CH = {
  2: '2',
  3: '3',
  4: '4',
  5: '5',
  6: '6',
  7: '7',
  8: '8',
  9: '9',
  10: '10',
  11: 'J',
  12: 'Q',
  13: 'K',
  14: 'A',
};
const RANK_WORD = {
  2: 'Two',
  3: 'Three',
  4: 'Four',
  5: 'Five',
  6: 'Six',
  7: 'Seven',
  8: 'Eight',
  9: 'Nine',
  10: 'Ten',
  11: 'Jack',
  12: 'Queen',
  13: 'King',
  14: 'Ace',
};
const plural = r => (r === 6 ? 'Sixes' : RANK_WORD[r] + 's');
const SUIT_CH = ['♠', '♥', '♦', '♣'];
const isRed = s => s === 1 || s === 2;
const FULL_DECK = [];
for (let r = 2; r <= 14; r++) for (let s = 0; s < 4; s++) FULL_DECK.push({ r, s, id: r * 4 + s });

function S(cat, ks) {
  let v = cat * 759375;
  for (let i = 0; i < ks.length; i++) v += ks[i] * Math.pow(15, 4 - i);
  return v;
}
function straightHigh(mask) {
  if (mask & (1 << 14)) mask |= 2;
  for (let hi = 14; hi >= 5; hi--) {
    let ok = true;
    for (let k = 0; k < 5; k++) {
      if (!(mask & (1 << (hi - k)))) {
        ok = false;
        break;
      }
    }
    if (ok) return hi;
  }
  return 0;
}
function evaluate(cards) {
  const rc = new Array(15).fill(0),
    sc = [0, 0, 0, 0],
    sm = [0, 0, 0, 0];
  let mask = 0;
  for (const c of cards) {
    rc[c.r]++;
    sc[c.s]++;
    mask |= 1 << c.r;
    sm[c.s] |= 1 << c.r;
  }
  let fs = -1;
  for (let s = 0; s < 4; s++) if (sc[s] >= 5) fs = s;
  if (fs >= 0) {
    const sh = straightHigh(sm[fs]);
    if (sh) return { score: S(8, [sh]), cat: 8, ks: [sh] };
  }
  const quads = [],
    trips = [],
    pairs = [];
  for (let r = 14; r >= 2; r--) {
    const n = rc[r];
    if (n === 4) quads.push(r);
    else if (n === 3) trips.push(r);
    else if (n === 2) pairs.push(r);
  }
  const kick = (ex, n) => {
    const o = [];
    for (let r = 14; r >= 2 && o.length < n; r--) if (rc[r] && !ex.includes(r)) o.push(r);
    return o;
  };
  if (quads.length) {
    const q = quads[0];
    const ks = [q, ...kick([q], 1)];
    return { score: S(7, ks), cat: 7, ks };
  }
  if (trips.length && (trips.length > 1 || pairs.length)) {
    const t = trips[0];
    const p = Math.max(trips[1] || 0, pairs[0] || 0);
    return { score: S(6, [t, p]), cat: 6, ks: [t, p] };
  }
  if (fs >= 0) {
    const fr = [];
    for (let r = 14; r >= 2 && fr.length < 5; r--) if (sm[fs] & (1 << r)) fr.push(r);
    return { score: S(5, fr), cat: 5, ks: fr };
  }
  const sh = straightHigh(mask);
  if (sh) return { score: S(4, [sh]), cat: 4, ks: [sh] };
  if (trips.length) {
    const t = trips[0];
    const ks = [t, ...kick([t], 2)];
    return { score: S(3, ks), cat: 3, ks };
  }
  if (pairs.length >= 2) {
    const a = pairs[0],
      b = pairs[1];
    const ks = [a, b, ...kick([a, b], 1)];
    return { score: S(2, ks), cat: 2, ks };
  }
  if (pairs.length) {
    const p = pairs[0];
    const ks = [p, ...kick([p], 3)];
    return { score: S(1, ks), cat: 1, ks };
  }
  const ks = kick([], 5);
  return { score: S(0, ks), cat: 0, ks };
}
function describe(ev) {
  const k = ev.ks;
  switch (ev.cat) {
    case 8:
      return k[0] === 14 ? 'Royal Flush' : `Straight Flush, ${RANK_WORD[k[0]]} high`;
    case 7:
      return `Four ${plural(k[0])}`;
    case 6:
      return `Full House, ${plural(k[0])} full of ${plural(k[1])}`;
    case 5:
      return `Flush, ${RANK_WORD[k[0]]} high`;
    case 4:
      return `Straight, ${RANK_WORD[k[0]]} high`;
    case 3:
      return `Three ${plural(k[0])}`;
    case 2:
      return `Two Pair, ${plural(k[0])} and ${plural(k[1])}`;
    case 1:
      return `Pair of ${plural(k[0])}`;
    default:
      return `${RANK_WORD[k[0]]} high`;
  }
}
function bestFive(cards) {
  if (cards.length <= 5) return cards.slice();
  let best = null,
    bs = -1;
  const n = cards.length,
    idx = [];
  (function rec(st) {
    if (idx.length === 5) {
      const f = idx.map(i => cards[i]);
      const sc = evaluate(f).score;
      if (sc > bs) {
        bs = sc;
        best = f;
      }
      return;
    }
    for (let i = st; i < n; i++) {
      idx.push(i);
      rec(i + 1);
      idx.pop();
    }
  })(0);
  return best;
}
function holeDesc(h) {
  const [a, b] = h[0].r >= h[1].r ? h : [h[1], h[0]];
  if (a.r === b.r) return `Pocket ${plural(a.r)}`;
  return `${RANK_WORD[a.r]}-${RANK_WORD[b.r]} ${a.s === b.s ? 'suited' : 'offsuit'}`;
}
function draws(hole, board) {
  if (board.length === 0 || board.length === 5) return [];
  const all = hole.concat(board),
    out = [],
    sc = [0, 0, 0, 0];
  all.forEach(c => sc[c.s]++);
  const ev = evaluate(all);
  if (ev.cat < 5 && sc.some(n => n === 4)) out.push('flush draw');
  if (ev.cat < 4) {
    let mask = 0;
    all.forEach(c => (mask |= 1 << c.r));
    if (mask & (1 << 14)) mask |= 2;
    let best = 0;
    for (let lo = 1; lo <= 10; lo++) {
      let n = 0;
      for (let k = 0; k < 5; k++) if (mask & (1 << (lo + k))) n++;
      best = Math.max(best, n);
    }
    if (best === 4) out.push('straight draw');
  }
  return out;
}
function equity(hole, board, nOpp, trials) {
  if (nOpp <= 0) return 1;
  const used = new Set();
  hole.forEach(c => used.add(c.id));
  board.forEach(c => used.add(c.id));
  const rest = FULL_DECK.filter(c => !used.has(c.id));
  const nb = 5 - board.length,
    need = nOpp * 2 + nb;
  let won = 0;
  for (let t = 0; t < trials; t++) {
    for (let i = 0; i < need; i++) {
      const j = i + Math.floor(Math.random() * (rest.length - i));
      const tmp = rest[i];
      rest[i] = rest[j];
      rest[j] = tmp;
    }
    const fb = board.concat(rest.slice(0, nb));
    const my = evaluate(hole.concat(fb)).score;
    let ties = 0,
      lost = false;
    for (let o = 0; o < nOpp; o++) {
      const s = evaluate([rest[nb + 2 * o], rest[nb + 2 * o + 1], ...fb]).score;
      if (s > my) {
        lost = true;
        break;
      }
      if (s === my) ties++;
    }
    if (!lost) won += 1 / (ties + 1);
  }
  return won / trials;
}
function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
