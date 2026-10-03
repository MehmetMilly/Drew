// Strokes → particles, constraints and skins (physics.md §4). Returns connected
// groups; world.ts turns each group into a creature via anatomy.ts.
import * as F from './fmath';
import { BODY, WORLD } from '../tuning';
import { classifyStroke, Part } from './classify';
import { Pt, convexHull, dist, pathLength, resample, centroidOf, clamp, pointInPoly } from './geom';
import { CT, PF, STRUCTURAL } from './store';
import { makeSkin, SkinPart } from './skin';
import type { Loop, Lump } from './creature';
import type { World } from './world';

export interface PenPt extends Pt {
  t?: number;
  p?: number;
}

export interface RawSpring {
  c: number;
  a: number;
  b: number;
  skin: number;
}

export interface Built {
  particles: number[];
  cons: number[];
  skins: number[];
  loops: Loop[];
  lumps: Lump[];
  springs: RawSpring[];
  ink: number;
}

/** Ink of a set of strokes (for budgets). */
export function inkOf(strokes: readonly (readonly Pt[])[]): number {
  let s = 0;
  for (const st of strokes) s += pathLength(st);
  return s;
}

function penWidth(pts: PenPt[], i: number): number {
  const a = pts[Math.max(0, i - 1)],
    b = pts[Math.min(pts.length - 1, i + 1)];
  const dt = (b.t ?? 0) - (a.t ?? 0);
  const v = dt > 1e-4 ? dist(a, b) / dt : 500;
  // slower is wider; pressure (when meaningful) adds
  let w = clamp(1 - v / 1600, 0, 1);
  const p = pts[i].p;
  if (p !== undefined && p > 0 && p !== 0.5) w = 0.5 * w + 0.5 * clamp(p, 0, 1);
  return w;
}

export function buildBodies(w: World, strokes: readonly (readonly PenPt[])[]): Built {
  const P = w.P,
    C = w.C;
  const out: Built = { particles: [], cons: [], skins: [], loops: [], lumps: [], springs: [], ink: 0 };
  const classified = strokes.map((s) => classifyStroke(s));
  const totalInk = classified.reduce((s, c) => s + c.ink, 0);
  out.ink = totalInk;
  if (totalInk < BODY.minCreatureInk) return out;
  // spacing: 10px, wider when the drawing would exceed the per-creature/world budget
  const budget = Math.max(24, Math.min(WORLD.maxParticles - P.alive, WORLD.maxPerCreature * Math.max(1, strokes.length)));
  const sp = Math.max(BODY.spacing, totalInk / budget);
  const unitM = sp / BODY.spacing;
  const strokeIds: number[][] = []; // particles per stroke (for welds)
  const strokeEnds: number[][] = [];

  const link = (a: number, b: number, k: number, type: number) => {
    const c = C.add(a, b, Math.max(1, F.hypot(P.x[b] - P.x[a], P.y[b] - P.y[a])), k, type);
    out.cons.push(c);
    return c;
  };
  const addP = (x: number, y: number, m: number, si: number) => {
    const i = P.add(x, y, m);
    P.stroke[i] = si;
    out.particles.push(i);
    return i;
  };

  classified.forEach((cl, si) => {
    const serial = w.strokeSerial++;
    const ids: number[] = [];
    const ends: number[] = [];
    let prevEnd = -1;
    const firstPts = strokes[si] as PenPt[];
    const hugs: number[][] = []; // overshoot pieces to weld flat onto their ring
    const t0 = firstPts[0]?.t ?? 0;
    cl.parts.forEach((part: Part, pi) => {
      const pts = part.pts as PenPt[];
      const sk = makeSkin(part.kind, serial, pts.length, part.kind === 'loop');
      let lastT = 0;
      for (let k = 0; k < pts.length; k++) {
        sk.dx[k] = pts[k].x;
        sk.dy[k] = pts[k].y;
        const tt = pts[k].t;
        sk.time[k] = tt !== undefined ? (lastT = tt - t0) : lastT;
        sk.width[k] = pts[k].t !== undefined ? penWidth(pts, k) : 0.5;
      }
      const skinId = w.skins.length;
      w.skins.push(sk);
      out.skins.push(skinId);

      const joinTo = (first: number) => {
        if (prevEnd >= 0 && prevEnd !== first) link(prevEnd, first, 1, CT.JOINT);
      };
      const reuse = (x: number, y: number) => prevEnd >= 0 && F.hypot(P.x[prevEnd] - x, P.y[prevEnd] - y) < sp * 0.35;

      if (part.kind === 'line' || part.kind === 'loop') {
        const closed = part.kind === 'loop';
        const rs = resample(pts, sp, closed);
        if (rs.length < 2 && !closed) {
          // a dot: one particle
          rs.push({ x: rs[0].x + 0.5, y: rs[0].y });
        }
        const pid: number[] = [];
        const m = closed ? BODY.loopMass * unitM : unitM;
        rs.forEach((q, k) => {
          if (k === 0 && reuse(q.x, q.y)) pid.push(prevEnd);
          else pid.push(addP(q.x, q.y, m, si));
        });
        if (pid[0] !== prevEnd) joinTo(pid[0]);
        const segC: number[] = [];
        for (let k = 1; k < pid.length; k++) segC.push(link(pid[k - 1], pid[k], 1, CT.LINK));
        if (closed && pid.length > 2) segC.push(link(pid[pid.length - 1], pid[0], 1, CT.LINK));
        for (let k = 2; k < pid.length; k++) link(pid[k - 2], pid[k], BODY.bendK, CT.BEND);
        if (closed && pid.length > 3) {
          link(pid[pid.length - 2], pid[0], BODY.bendK, CT.BEND);
          link(pid[pid.length - 1], pid[1], BODY.bendK, CT.BEND);
        }
        if (closed) {
          for (const i of pid) {
            P.flags[i] |= PF.LOOP;
            P.tag[i] = out.loops.length;
          }
          out.loops.push({ ring: pid.slice(), links: segC.slice(), area: part.area });
        }
        if (part.hug) hugs.push(pid);
        // skin: arclength of each particle along the drawn path
        bindChain(sk, pts, pid, segC, closed, P);
        for (const i of pid) if (!ids.includes(i)) ids.push(i);
        if (!closed) {
          if (pi === 0) ends.push(pid[0]);
          if (pi === cl.parts.length - 1) ends.push(pid[pid.length - 1]);
        }
        prevEnd = closed ? pid[0] : pid[pid.length - 1];
      } else if (part.kind === 'zigzag') {
        const a0 = pts[0],
          b0 = pts[pts.length - 1];
        let a: number;
        if (reuse(a0.x, a0.y)) a = prevEnd;
        else {
          a = addP(a0.x, a0.y, unitM, si);
          joinTo(a);
          ids.push(a);
          if (pi === 0) ends.push(a);
        }
        const b = addP(b0.x, b0.y, unitM, si);
        ids.push(b);
        const c = link(a, b, 1, CT.SPRING);
        C.rest[c] = C.rest0[c] = Math.max(BODY.spacing, C.rest[c]);
        out.springs.push({ c, a, b, skin: skinId });
        // skin along the spring axis
        const ax = b0.x - a0.x,
          ay = b0.y - a0.y;
        const L2 = ax * ax + ay * ay || 1;
        const L = Math.sqrt(L2);
        for (let k = 0; k < pts.length; k++) {
          const qx = pts[k].x - a0.x,
            qy = pts[k].y - a0.y;
          sk.pa[k] = a;
          sk.pb[k] = b;
          sk.cid[k] = c;
          sk.t[k] = (qx * ax + qy * ay) / L2;
          sk.off[k] = (ax * qy - ay * qx) / L;
        }
        if (pi === cl.parts.length - 1) ends.push(b);
        prevEnd = b;
      } else {
        // scribble → lump: ring around the hull + a centre, five times the mass
        const hull = convexHull(pts);
        const c0 = centroidOf(hull);
        let ring = resample(hull, Math.max(sp, 12), true);
        if (ring.length > 20) ring = resample(hull, pathLength([...hull, hull[0]]) / 20, true);
        if (ring.length < 3) {
          const r = 8;
          ring = [0, 1, 2, 3, 4, 5].map((k) => ({ x: c0.x + r * F.cos(k), y: c0.y + r * F.sin(k) }));
        }
        const total = BODY.lumpMassMul * (part.ink / BODY.spacing);
        const m = total / (ring.length + 1);
        const centre = addP(c0.x, c0.y, m, si);
        P.flags[centre] |= PF.LUMP | PF.LUMPC;
        P.tag[centre] = out.lumps.length;
        const rid = ring.map((q) => {
          const i = addP(q.x, q.y, m, si);
          P.flags[i] |= PF.LUMP;
          P.tag[i] = out.lumps.length;
          return i;
        });
        for (let k = 0; k < rid.length; k++) {
          link(rid[k], rid[(k + 1) % rid.length], 1, CT.LUMP);
          link(rid[k], centre, 1, CT.LUMP);
          if (rid.length >= 6) link(rid[k], rid[(k + 2) % rid.length], 1, CT.LUMP);
        }
        // join the previous part to the ring particle nearest its end
        const nearest = (x: number, y: number) => {
          let best = rid[0],
            bd = Infinity;
          for (const i of rid) {
            const d = F.hypot(P.x[i] - x, P.y[i] - y);
            if (d < bd) {
              bd = d;
              best = i;
            }
          }
          return best;
        };
        if (prevEnd >= 0) link(prevEnd, nearest(P.x[prevEnd], P.y[prevEnd]), 1, CT.JOINT);
        out.lumps.push({ centre, ring: rid, ink: part.ink });
        sk.lump = { centre, ring: rid, rcx: c0.x, rcy: c0.y };
        ids.push(centre, ...rid);
        const last = pts[pts.length - 1];
        prevEnd = nearest(last.x, last.y);
      }
    });
    // overshoots lie along their ring: weld each particle to the nearest ring particle so
    // the piece rides on the loop instead of becoming a free limb
    if (hugs.length) {
      const ring = out.loops.flatMap((l) => l.ring).filter((i) => P.stroke[i] === si);
      for (const pid of hugs)
        for (const i of pid) {
          let best = -1,
            bd = Infinity;
          for (const j of ring) {
            if (j === i) continue;
            const d = F.hypot(P.x[j] - P.x[i], P.y[j] - P.y[i]);
            if (d < bd) {
              bd = d;
              best = j;
            }
          }
          if (best >= 0) link(i, best, 1, CT.WELD);
        }
    }
    strokeIds.push(ids);
    strokeEnds.push(ends);
  });

  weld(w, strokeIds, strokeEnds, out);
  return out;
}

function bindChain(sk: SkinPart, pts: Pt[], pid: number[], segC: number[], closed: boolean, P: World['P']) {
  // arclength of drawn points
  const n = pts.length;
  const s: number[] = [0];
  for (let k = 1; k < n; k++) s.push(s[k - 1] + dist(pts[k - 1], pts[k]));
  // arclength of particles: project each particle onto the drawn path in order
  const ps: number[] = [];
  let k = 0;
  for (let j = 0; j < pid.length; j++) {
    const x = P.x[pid[j]],
      y = P.y[pid[j]];
    let best = k,
      bd = Infinity;
    for (let q = k; q < n; q++) {
      const d = F.hypot(pts[q].x - x, pts[q].y - y);
      if (d < bd) {
        bd = d;
        best = q;
      }
      if (d > bd + 25) break;
    }
    k = best;
    ps.push(s[best]);
  }
  const total = closed ? s[n - 1] + dist(pts[n - 1], pts[0]) : s[n - 1];
  if (closed) ps.push(total); // wrap segment back to particle 0
  let seg = 0;
  for (let q = 0; q < n; q++) {
    while (seg < ps.length - 2 && s[q] > ps[seg + 1]) seg++;
    const j0 = seg,
      j1 = closed ? (seg + 1) % pid.length : Math.min(seg + 1, pid.length - 1);
    const a = pid[j0],
      b = pid[j1];
    const span = ps[seg + 1] - ps[seg];
    const t = span > 1e-6 ? (s[q] - ps[seg]) / span : 0;
    const ax = P.x[a],
      ay = P.y[a],
      bx = P.x[b],
      by = P.y[b];
    const dx = bx - ax,
      dy = by - ay;
    const L = F.hypot(dx, dy);
    sk.pa[q] = a;
    sk.pb[q] = b;
    sk.cid[q] = a === b ? -1 : segC[Math.min(seg, segC.length - 1)] ?? -1;
    if (L > 1e-6) {
      const tt = ((pts[q].x - ax) * dx + (pts[q].y - ay) * dy) / (L * L);
      sk.t[q] = tt;
      sk.off[q] = (dx * (pts[q].y - ay) - dy * (pts[q].x - ax)) / L;
    } else {
      sk.t[q] = t;
      sk.off[q] = 0;
    }
  }
}

/** Welds between strokes: crossing particles (9px) and stroke ends near any other stroke (18px). */
function weld(w: World, strokeIds: number[][], strokeEnds: number[][], out: Built) {
  const P = w.P,
    C = w.C;
  const welds = new Map<number, number>();
  const can = (i: number) => (welds.get(i) ?? 0) < 2;
  const add = (i: number, j: number) => {
    const c = C.add(i, j, Math.max(1, F.hypot(P.x[j] - P.x[i], P.y[j] - P.y[i])), 1, CT.WELD);
    out.cons.push(c);
    welds.set(i, (welds.get(i) ?? 0) + 1);
    welds.set(j, (welds.get(j) ?? 0) + 1);
  };
  // inward neighbour of each stroke end (along its own chain)
  const inward = new Map<number, number>();
  for (const c of out.cons) {
    const t = C.type[c];
    if (t !== CT.LINK && t !== CT.SPRING && t !== CT.JOINT) continue;
    for (const ends of strokeEnds)
      for (const e of ends) {
        if (C.a[c] === e && !inward.has(e)) inward.set(e, C.b[c]);
        else if (C.b[c] === e && !inward.has(e)) inward.set(e, C.a[c]);
      }
  }
  // an end that starts inside another stroke's loop (a leg drawn from inside the body) joins it
  const insideLoop = (e: number, j: number) => {
    if (!(P.flags[j] & PF.LOOP)) return false;
    const ring = out.loops[P.tag[j]]?.ring;
    if (!ring) return false;
    return pointInPoly(P.x[e], P.y[e], ring.map((i) => ({ x: P.x[i], y: P.y[i] })));
  };
  const allEnds = new Set(strokeEnds.flat());
  const S = strokeIds.length;
  for (let a = 0; a < S; a++)
    for (let b = a + 1; b < S; b++) {
      const A = strokeIds[a],
        B = strokeIds[b];
      // ends first (finger slop), nearest particle in the other stroke
      for (const [ends, other] of [
        [strokeEnds[a], B],
        [strokeEnds[b], A],
      ] as const) {
        for (const e of ends) {
          // the end's outward direction: a sloppy join points *at* the other stroke;
          // a stroke merely passing alongside does not weld
          const q = inward.get(e);
          let ux = 0,
            uy = 0;
          if (q !== undefined) {
            const L = F.hypot(P.x[e] - P.x[q], P.y[e] - P.y[q]) || 1;
            ux = (P.x[e] - P.x[q]) / L;
            uy = (P.y[e] - P.y[q]) / L;
          }
          let best = -1,
            bd = BODY.weldEndDist;
          for (const j of other) {
            const dx = P.x[j] - P.x[e],
              dy = P.y[j] - P.y[e];
            const d = F.hypot(dx, dy);
            if (d >= bd) continue;
            // a longer reach only counts when the end aims right at the other stroke (a stroke
            // that stops short); a spider's foot lying beside the next leg does not
            // ...or when it meets the other stroke's own end (a hip: legs start at the body's end)
            const aim = d > BODY.weldEndNear && !allEnds.has(j) ? BODY.weldAimCos : 0.3;
            if (d > BODY.weldDist && q !== undefined && dx * ux + dy * uy < aim * d && !insideLoop(e, j)) continue;
            bd = d;
            best = j;
          }
          if (best >= 0 && can(e)) add(e, best);
        }
      }
      // crossings
      for (const i of A) {
        let best = -1,
          bd = BODY.weldDist;
        for (const j of B) {
          const d = F.hypot(P.x[j] - P.x[i], P.y[j] - P.y[i]);
          if (d < bd) {
            bd = d;
            best = j;
          }
        }
        if (best >= 0 && can(i) && can(best) && !hasCon(w, out.cons, i, best)) add(i, best);
      }
    }
}

function hasCon(w: World, cons: number[], i: number, j: number) {
  const C = w.C;
  for (const c of cons) if ((C.a[c] === i && C.b[c] === j) || (C.a[c] === j && C.b[c] === i)) return true;
  return false;
}

/** Connected components over live structural constraints. */
export function components(w: World, particles: number[], cons: number[]): number[][] {
  const C = w.C;
  const idx = new Map<number, number>();
  particles.forEach((p, k) => idx.set(p, k));
  const parent = particles.map((_, k) => k);
  const find = (x: number): number => {
    while (parent[x] !== x) {
      parent[x] = parent[parent[x]];
      x = parent[x];
    }
    return x;
  };
  for (const c of cons) {
    if (C.dead[c] || !STRUCTURAL(C.type[c])) continue;
    const a = idx.get(C.a[c]),
      b = idx.get(C.b[c]);
    if (a === undefined || b === undefined) continue;
    const ra = find(a),
      rb = find(b);
    if (ra !== rb) parent[Math.max(ra, rb)] = Math.min(ra, rb);
  }
  const groups = new Map<number, number[]>();
  particles.forEach((p, k) => {
    const r = find(k);
    let g = groups.get(r);
    if (!g) groups.set(r, (g = []));
    g.push(p);
  });
  return [...groups.values()];
}
