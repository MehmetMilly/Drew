// Anatomy read (design.md §5–6): head, tips → hands/feet, springs, lumps, stats,
// kind and name. Runs at birth and after every graft or sever. Geometry only.
import * as F from './fmath';
import { KIND, LOCO, LOOK, SHAPE, STRENGTH, WORLD } from '../tuning';
import { CT, PF, STRUCTURAL } from './store';
import type { Creature, Limb, Spring } from './creature';
import { EPITHET, Kind, NAMES, PIECE_NAMES } from './names';
import { fnv } from './rng';
import type { World } from './world';

export function adjacency(w: World, cr: Creature): Map<number, { to: number; c: number }[]> {
  const C = w.C;
  const adj = new Map<number, { to: number; c: number }[]>();
  for (const i of cr.ids) adj.set(i, []);
  for (const c of cr.cons) {
    if (C.dead[c] || !STRUCTURAL(C.type[c])) continue;
    const a = C.a[c],
      b = C.b[c];
    const la = adj.get(a),
      lb = adj.get(b);
    if (!la || !lb) continue;
    la.push({ to: b, c });
    lb.push({ to: a, c });
  }
  return adj;
}

function loopIntact(w: World, ring: number[], links: number[], owner: number) {
  for (const c of links) if (w.C.dead[c]) return false;
  for (const i of ring) if (w.P.owner[i] !== owner || !w.P.isAlive(i)) return false;
  return true;
}

export function readAnatomy(w: World, cr: Creature) {
  const P = w.P,
    C = w.C;
  const adj = adjacency(w, cr);
  // keep only intact loops / lumps / springs that belong to this creature
  cr.loops = cr.loops.filter((l) => loopIntact(w, l.ring, l.links, cr.id));
  cr.lumps = cr.lumps.filter((l) => P.owner[l.centre] === cr.id);
  cr.springs = cr.springs.filter((s) => !C.dead[s.c] && P.owner[s.a] === cr.id && P.owner[s.b] === cr.id);

  // bounds (current pose, which is the drawn pose at birth)
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity,
    cx = 0,
    cy = 0,
    mass = 0;
  for (const i of cr.ids) {
    const x = P.x[i],
      y = P.y[i];
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    cx += x * P.m[i];
    cy += y * P.m[i];
    mass += P.m[i];
  }
  cx /= mass;
  cy /= mass;
  const W = maxX - minX,
    H = maxY - minY;
  // a creature lying flat has its "up" relative to its rest frame; use rest coordinates for up/down
  let rminY = Infinity,
    rmaxY = -Infinity,
    rcy = 0;
  for (const i of cr.ids) {
    rminY = Math.min(rminY, P.ry[i]);
    rmaxY = Math.max(rmaxY, P.ry[i]);
    rcy += P.ry[i] * P.m[i];
  }
  rcy /= mass;
  const rH = rmaxY - rminY;

  // head: largest loop
  let headLoop = -1;
  cr.loops.forEach((l, k) => {
    if (headLoop < 0 || l.area > cr.loops[headLoop].area) headLoop = k;
  });

  // tips: degree-1 particles outside loops and lumps
  const tips: number[] = [];
  for (const i of cr.ids) {
    if (P.flags[i] & (PF.LOOP | PF.LUMP)) continue;
    if ((adj.get(i)?.length ?? 0) === 1) tips.push(i);
  }
  tips.sort((a, b) => a - b);
  const isFootPos = (i: number) => P.ry[i] > rcy + 0.25 * rH && P.ry[i] > rmaxY - 0.35 * rH;

  let eyePoint = -1;
  if (headLoop < 0) {
    // highest line end gets the eyes, unless every end is a foot (a roof arch): then its apex
    let best = -1;
    for (const t of tips) if (best < 0 || P.ry[t] < P.ry[best] - 1e-6) best = t;
    if (best >= 0 && !isFootPos(best)) {
      eyePoint = best;
    } else {
      let top = cr.ids[0];
      for (const i of cr.ids) if (P.ry[i] < P.ry[top] || (P.ry[i] === P.ry[top] && Math.abs(P.rx[i] - cx) < Math.abs(P.rx[top] - cx))) top = i;
      eyePoint = top;
    }
  }
  const limbTips = tips.filter((t) => t !== eyePoint);
  // a lump hanging off a single joint is a fist (or a club foot): its centre is a tip
  const lumpTip = new Map<number, number>(); // centre → particle just outside the lump
  for (const l of cr.lumps) {
    const ringSet = new Set([l.centre, ...l.ring]);
    const outs: number[] = [];
    for (const i of l.ring) for (const e of adj.get(i) ?? []) if (!ringSet.has(e.to)) outs.push(e.to);
    if (outs.length === 1 && !(P.flags[outs[0]] & PF.LUMP)) {
      lumpTip.set(l.centre, outs[0]);
      limbTips.push(l.centre);
    }
  }

  // limbs: walk inward from each tip until a junction
  const springByC = new Map<number, number>();
  cr.springs.forEach((s, k) => springByC.set(s.c, k));
  const limbs: Limb[] = [];
  for (const tip of limbTips) {
    const fistOut = lumpTip.get(tip);
    const chain = fistOut !== undefined ? [tip, fistOut] : [tip];
    let prev = -1,
      cur = fistOut ?? tip,
      len = fistOut !== undefined ? F.hypot(P.rx[fistOut] - P.rx[tip], P.ry[fistOut] - P.ry[tip]) : 0,
      spring = -1;
    if (fistOut !== undefined) {
      // walk on from the joint, away from the lump
      const back = (adj.get(fistOut) ?? []).find((e) => P.flags[e.to] & PF.LUMP);
      prev = back ? back.to : -1;
    }
    let root = tip;
    let reachedTip = false;
    for (let guard = 0; guard < 400; guard++) {
      const nb = (adj.get(cur) ?? []).filter((e) => e.to !== prev);
      if (nb.length !== 1) {
        root = cur;
        break;
      }
      const e = nb[0];
      len += C.rest[e.c];
      if (springByC.has(e.c)) spring = springByC.get(e.c)!;
      const nxt = e.to;
      const deg = adj.get(nxt)?.length ?? 0;
      if (P.flags[nxt] & (PF.LOOP | PF.LUMP) || deg >= 3 || C.type[e.c] === CT.WELD) {
        root = nxt;
        break;
      }
      if (deg === 1) {
        reachedTip = true;
        root = nxt;
        chain.push(nxt);
        break;
      }
      prev = cur;
      cur = nxt;
      chain.push(cur);
      root = cur;
    }
    if (reachedTip || (eyePoint >= 0 && chain.includes(eyePoint))) {
      // a bare chain (worm): this end's limb is the half nearest it
      let cut = Math.max(2, Math.floor(chain.length / 2));
      if (eyePoint >= 0) {
        const e = chain.indexOf(eyePoint);
        if (e >= 0) cut = Math.max(2, Math.min(cut, e - 1));
      }
      chain.length = Math.min(chain.length, cut);
      root = chain[chain.length - 1];
      len = 0;
      for (let k = 1; k < chain.length; k++) len += F.hypot(P.rx[chain[k]] - P.rx[chain[k - 1]], P.ry[chain[k]] - P.ry[chain[k - 1]]);
    }
    if (chain.length < 2 && len < 15) continue;
    limbs.push({
      tip,
      chain,
      root,
      len: Math.max(len, 10),
      foot: isFootPos(tip),
      spring,
      group: 0,
      swing: false,
      swingT: 0,
      fromX: 0,
      fromY: 0,
      toX: 0,
      toY: 0,
      reaching: false,
      grab: -1,
      grabBody: -1,
    });
  }
  // feet alternate in two groups by x
  const feet = limbs.filter((l) => l.foot).sort((a, b) => P.rx[a.tip] - P.rx[b.tip]);
  feet.forEach((l, k) => (l.group = (k % 2) as 0 | 1));
  cr.limbs = limbs;

  // springs: which side is distal, axis, is it a leg
  for (const s of cr.springs) finishSpring(w, cr, s, adj, headLoop >= 0 ? cr.loops[headLoop].ring[0] : eyePoint);
  for (const l of limbs) if (l.spring >= 0) cr.springs[l.spring].leg = l.foot;

  // shape weights: core 1, falling toward tips (physics.md §5)
  for (const i of cr.ids) P.w[i] = 1;
  for (const l of limbs) {
    const n = l.chain.length;
    const tipW = l.foot ? SHAPE.footTipW : SHAPE.handTipW;
    l.chain.forEach((id, k) => (P.w[id] = Math.min(P.w[id], tipW + (1 - tipW) * (k / Math.max(1, n)))));
  }

  // head
  if (headLoop >= 0) {
    const l = cr.loops[headLoop];
    cr.head = { kind: 'loop', loop: headLoop, point: l.ring[0], r: Math.sqrt(l.area / Math.PI) };
  } else cr.head = { kind: 'point', loop: -1, point: eyePoint, r: 12 }; // r resized from stats below

  // stats from geometry only
  let ink = 0;
  for (const c of cr.cons) if (!C.dead[c] && (C.type[c] === CT.LINK || C.type[c] === CT.SPRING)) ink += C.rest0[c];
  for (const l of cr.lumps) ink += l.ink;
  ink = Math.max(ink, 10);
  const strength = F.pow(ink / STRENGTH.ref, STRENGTH.exp);
  const feetN = feet.length;
  const legLen = feetN ? feet.reduce((s, l) => s + l.len, 0) / feetN : 0;
  const size = Math.max(W, H);
  const legF = feetN ? Math.min(LOCO.legMax, Math.max(LOCO.legMin, LOCO.legMin + legLen / 75)) : LOCO.footless;
  const speed = (LOCO.speedBase * legF) / F.pow(Math.max(size, 60) / 250, 0.45);
  const balance = feetN >= 2 ? SHAPE.balance2 : feetN === 1 ? SHAPE.balance1 : SHAPE.balance0;
  const hands = limbs.filter((l) => !l.foot);
  const reach = hands.reduce((m, l) => Math.max(m, l.len), 0);
  let buoy = 0;
  for (const l of cr.loops) buoy += l.area;
  const stride = feetN ? Math.max(14, legLen * 0.7) : 0;
  const cadence = feetN ? (LOCO.cadenceBase / Math.sqrt(Math.max(legLen, 20) / 60)) * (feetN >= 4 ? LOCO.scurry : 1) : LOCO.wriggleFreq;
  cr.stats = { ink, mass, w: W, h: H, size, strength, speed, balance, legLen, reach, buoyancy: buoy, stride, cadence };
  if (cr.head.kind === 'point') cr.head.r = Math.min(LOOK.pointHeadMax, Math.max(LOOK.pointHeadMin, size * LOOK.pointHeadK));

  // kind: first match (design.md §6)
  const loops = cr.loops.length;
  const tipCount = limbs.length;
  let kind: Kind;
  if (H > KIND.giantFrac * WORLD.H || W > KIND.giantFrac * WORLD.W) kind = 'giant';
  else if (size < KIND.tinyPx) kind = 'tiny';
  else if (cr.springs.length) kind = 'springy';
  else if (cr.lumps.length) kind = 'heavy';
  else if (loops >= 2) kind = 'floaty';
  else if (!loops && tipCount <= 1) kind = 'worm';
  else if (feetN >= 3) kind = 'many-legged';
  else if (hands.some((l) => l.len > H)) kind = 'long-armed';
  else if (!loops) kind = 'headless';
  else kind = 'biped';
  cr.kind = kind;
  if (!cr.firstName) {
    cr.firstName = cr.isPiece ? PIECE_NAMES[cr.seed % PIECE_NAMES.length] : NAMES[cr.seed % NAMES.length];
  }
  cr.name = `${cr.firstName} ${EPITHET[kind]}`;
}

function finishSpring(w: World, _cr: Creature, s: Spring, adj: Map<number, { to: number; c: number }[]>, headParticle: number) {
  const P = w.P;
  // BFS from b without the spring; if we meet a, the spring is inside a cycle
  const side = (start: number, avoid: number) => {
    const seen = new Set<number>([start]);
    const q = [start];
    while (q.length) {
      const i = q.pop()!;
      for (const e of adj.get(i) ?? []) {
        if (e.c === s.c || seen.has(e.to)) continue;
        if (e.to === avoid) return null;
        seen.add(e.to);
        q.push(e.to);
      }
    }
    return seen;
  };
  const sb = side(s.b, s.a);
  if (!sb) {
    s.distal = [];
  } else {
    const sa = side(s.a, s.b) ?? new Set<number>();
    let massA = 0,
      massB = 0;
    for (const i of sa) massA += P.m[i];
    for (const i of sb) massB += P.m[i];
    const bHasHead = headParticle >= 0 && sb.has(headParticle);
    const aHasHead = headParticle >= 0 && sa.has(headParticle);
    const flip = bHasHead || (!aHasHead && massB > massA);
    if (flip) {
      const t = s.a;
      s.a = s.b;
      s.b = t;
      s.distal = [...sa].sort((x, y) => x - y);
    } else s.distal = [...sb].sort((x, y) => x - y);
  }
  const dx = P.rx[s.b] - P.rx[s.a],
    dy = P.ry[s.b] - P.ry[s.a];
  const L = F.hypot(dx, dy) || 1;
  s.ax = dx / L;
  s.ay = dy / L;
}

export function makeSprings(w: World, raw: { c: number; a: number; b: number; skin: number }[]): Spring[] {
  return raw.map((r) => ({
    c: r.c,
    a: r.a,
    b: r.b,
    distal: [],
    ax: 0,
    ay: 1,
    len0: w.C.rest0[r.c],
    state: 'idle' as const,
    t: 0,
    cool: 0,
    leg: false,
    zig: [r.skin],
  }));
}

export function seedOf(strokes: { x: number; y: number }[][]): number {
  const words: number[] = [];
  for (const s of strokes) for (const p of s) words.push(Math.round(p.x * 4), Math.round(p.y * 4));
  return fnv(words);
}

