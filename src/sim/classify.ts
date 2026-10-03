// The four-mark classifier (design.md §4, physics.md §3). It reads geometry only.
// A stroke is cut into an ordered list of parts; consecutive parts join end to start.
// Loops start and end at the same point (the closing vertex), so tails attach there.

import * as F from './fmath';
import { CLASSIFY, BODY } from '../tuning';
import { Pt, centroidOf, closestOnSeg, dist, pathLength, polyArea, rdp, resample, segIntersect, turnAngle, convexHull } from './geom';

export type MarkKind = 'line' | 'loop' | 'zigzag' | 'scribble';

export interface Part {
  kind: MarkKind;
  /** Full-resolution points of this part. A loop's ring does not repeat its first point. */
  pts: Pt[];
  /** For a loop: enclosed area. For a scribble: hull area. */
  area: number;
  /** Ink length of the drawn points that made this part (for mass). */
  ink: number;
  /** A short overshoot that runs along its loop's ring: part of the loop, welded flat to it. */
  hug?: boolean;
}

export interface Classified {
  parts: Part[];
  ink: number;
}

/** Remove consecutive duplicates and NaNs. */
function clean(pts: readonly Pt[]): Pt[] {
  const out: Pt[] = [];
  for (const p of pts) {
    if (!isFinite(p.x) || !isFinite(p.y)) continue;
    const q = out[out.length - 1];
    if (q && Math.abs(q.x - p.x) < 0.01 && Math.abs(q.y - p.y) < 0.01) continue;
    out.push(p);
  }
  return out;
}

export function closeDist(len: number): number {
  return Math.max(BODY.closeMin, BODY.closeFrac * len);
}

// ---------------------------------------------------------------- scribble

interface Range {
  a: number;
  b: number;
} // inclusive index range on the dense array

/** Find dense regions. Works on an evenly resampled copy (3px) and maps back by arclength. */
function findScribbles(pts: Pt[]): { ranges: Range[]; even: Pt[]; arc: number[] } {
  const SP = 3;
  const even = resample(pts, SP);
  const n = even.length;
  // density at two scales: the documented 30px window, and a half-size window
  // so a small scribbled fist reads as a lump too
  const dense = new Uint8Array(n);
  for (const [R, ratio] of [
    [CLASSIFY.scribbleRadius, CLASSIFY.scribbleRatio],
    [CLASSIFY.scribbleRadius / 2, CLASSIFY.scribbleRatioSmall],
  ]) {
    const need = ratio * 2 * R;
    if (n * SP <= need) continue;
    const R2 = R * R;
    for (let i = 0; i < n; i++) {
      if (dense[i]) continue;
      let c = 0;
      const pi = even[i];
      for (let j = 0; j < n; j++) {
        const dx = even[j].x - pi.x,
          dy = even[j].y - pi.y;
        if (dx * dx + dy * dy < R2) c++;
      }
      if (c * SP > need) dense[i] = 1;
    }
  }
  // runs of dense points; bridge small gaps (a scribble's turnarounds)
  const ranges: Range[] = [];
  let i = 0;
  const GAP = Math.round(18 / SP);
  while (i < n) {
    if (!dense[i]) {
      i++;
      continue;
    }
    let j = i;
    let k = i;
    while (k < n) {
      if (dense[k]) {
        j = k;
        k++;
      } else {
        let g = k;
        while (g < n && !dense[g] && g - k <= GAP) g++;
        if (g < n && dense[g] && g - k <= GAP) k = g;
        else break;
      }
    }
    ranges.push({ a: i, b: j });
    i = j + 1;
  }
  // expand each range outward while points stay inside the dense hull (+margin)
  const out: Range[] = [];
  for (const r of ranges) {
    const hull = convexHull(even.slice(r.a, r.b + 1));
    if (hull.length < 3 || polyArea(hull) < CLASSIFY.scribbleMinHull) continue;
    const cx = hull.reduce((s, p) => s + p.x, 0) / hull.length;
    const cy = hull.reduce((s, p) => s + p.y, 0) / hull.length;
    let rad = 0;
    for (const p of hull) rad = Math.max(rad, F.hypot(p.x - cx, p.y - cy));
    const lim = rad * 1.25 + 8;
    let a = r.a,
      b = r.b;
    while (a > 0 && F.hypot(even[a - 1].x - cx, even[a - 1].y - cy) < lim) a--;
    while (b < n - 1 && F.hypot(even[b + 1].x - cx, even[b + 1].y - cy) < lim) b++;
    // a short leftover tail at either end is part of the scribble
    const tailMax = 26;
    if (a * SP < tailMax) a = 0;
    if ((n - 1 - b) * SP < tailMax) b = n - 1;
    // a regular back-and-forth is a spring, not a lump
    const sub = even.slice(a, b + 1);
    const z = findZigzag(sub);
    if (z && pathLength(sub.slice(z.a, z.b + 1)) > 0.6 * pathLength(sub) && zigAdvance(sub.slice(z.a, z.b + 1)) > CLASSIFY.zigMinAdvance) continue;
    const prev = out[out.length - 1];
    if (prev && a <= prev.b + 2) prev.b = Math.max(prev.b, b);
    else out.push({ a, b });
  }
  const arc: number[] = [0];
  for (let k = 1; k < n; k++) arc.push(arc[k - 1] + dist(even[k - 1], even[k]));
  return { ranges: out, even, arc };
}

/** Map an arclength on the resampled copy to an index on the original points. */
function indexAtArc(pts: Pt[], cum: number[], s: number): number {
  let lo = 0,
    hi = pts.length - 1;
  while (lo < hi) {
    const m = (lo + hi) >> 1;
    if (cum[m] < s) lo = m + 1;
    else hi = m;
  }
  return lo;
}

// ---------------------------------------------------------------- loops

interface LoopCut {
  a: number; // first index of ring (inclusive)
  b: number; // last index of ring (inclusive)
  join?: Pt; // intersection point that closes the ring
  area: number;
}

/** Find the earliest loop in a run of points: crossing, end-near-earlier-point, or start-near-later-point. */
function findLoop(p: Pt[]): LoopCut | null {
  const n = p.length;
  if (n < 6) return null;
  const L = pathLength(p);
  // 1) whole stroke closes on itself
  const cd = closeDist(L);
  if (dist(p[0], p[n - 1]) < cd) {
    const area = polyArea(p);
    if (area > BODY.minLoopArea) return { a: 0, b: n - 1, area };
  }
  // 2) self-intersection: earliest closing pair with enough area
  let best: LoopCut | null = null;
  for (let j = 2; j < n - 1 && !best; j++) {
    for (let i = 0; i < j - 1; i++) {
      const hit = segIntersect(p[i], p[i + 1], p[j], p[j + 1]);
      if (!hit) continue;
      const join = { x: p[i].x + (p[i + 1].x - p[i].x) * hit.t, y: p[i].y + (p[i + 1].y - p[i].y) * hit.t };
      const ring = [join, ...p.slice(i + 1, j + 1)];
      const area = polyArea(ring);
      if (area > BODY.minLoopArea) {
        best = { a: i + 1, b: j, join, area };
        break;
      }
    }
  }
  if (best) return best;
  // 3) sloppy closures: an end that stops near an earlier part of the stroke (a "6" or "P")
  let cum = 0;
  const arc = [0];
  for (let k = 1; k < n; k++) arc.push((cum += dist(p[k - 1], p[k])));
  for (let k = 0; k < n - 4; k++) {
    const ringLen = arc[n - 1] - arc[k];
    if (ringLen < 60) break;
    if (dist(p[k], p[n - 1]) < Math.min(cd, closeDist(ringLen))) {
      const ring = p.slice(k);
      const area = polyArea(ring);
      if (area > BODY.minLoopArea) return { a: k, b: n - 1, area };
    }
  }
  for (let k = n - 1; k > 4; k--) {
    const ringLen = arc[k];
    if (ringLen < 60) break;
    if (dist(p[0], p[k]) < Math.min(cd, closeDist(ringLen))) {
      const ring = p.slice(0, k + 1);
      const area = polyArea(ring);
      if (area > BODY.minLoopArea) return { a: 0, b: k, area };
    }
  }
  return null;
}

// ---------------------------------------------------------------- zigzag

function findZigzag(p: Pt[]): { a: number; b: number } | null {
  if (p.length < 5) return null;
  const raw = rdp(p, CLASSIFY.rdpEps);
  // a rounded tooth tip often simplifies to two close vertices (72° + 35°): merge any pair
  // joined by a very short segment into one corner at their midpoint, so the turn adds up
  const idx: number[] = [];
  const v: Pt[] = [];
  for (let k = 0; k < raw.length; k++) {
    const q = p[raw[k]];
    const inner = k > 0 && k < raw.length - 1 && idx.length > 1;
    const prev = v[v.length - 1];
    if (inner && k < raw.length - 1 && dist(prev, q) < CLASSIFY.zigCornerSpan && idx[idx.length - 1] !== raw[0]) {
      v[v.length - 1] = { x: (prev.x + q.x) / 2, y: (prev.y + q.y) / 2 };
      continue;
    }
    idx.push(raw[k]);
    v.push(q);
  }
  if (idx.length < CLASSIFY.zigMinVerts + 2) return null;
  const thr = (CLASSIFY.zigTurnDeg * Math.PI) / 180;
  let runStart = -1,
    runLen = 0,
    lastSign = 0;
  let bestA = -1,
    bestB = -1,
    bestLen = 0;
  for (let k = 1; k < v.length - 1; k++) {
    const ang = turnAngle(v[k - 1], v[k], v[k + 1]);
    const s = Math.sign(ang);
    const short = dist(v[k - 1], v[k]) < CLASSIFY.zigMaxSeg && dist(v[k], v[k + 1]) < CLASSIFY.zigMaxSeg;
    const okSeg = short || (dist(v[k - 1], v[k]) < CLASSIFY.zigMaxLongSeg && dist(v[k], v[k + 1]) < CLASSIFY.zigMaxLongSeg);
    const sharp = Math.abs(ang) > (short ? thr : (CLASSIFY.zigLongTurnDeg * Math.PI) / 180);
    if (sharp && okSeg && (runLen === 0 || s === -lastSign)) {
      if (runLen === 0) runStart = k;
      runLen++;
      lastSign = s;
    } else if (sharp && okSeg) {
      // same sign twice: restart run here
      runStart = k;
      runLen = 1;
      lastSign = s;
    } else {
      runLen = 0;
      lastSign = 0;
    }
    if (runLen >= CLASSIFY.zigMinVerts && runLen > bestLen) {
      bestLen = runLen;
      bestA = runStart;
      bestB = k;
    }
  }
  if (bestLen < CLASSIFY.zigMinVerts) return null;
  // the half-teeth on either side of the first and last turn belong to the spring
  let a = bestA,
    b = bestB;
  if (a > 0 && dist(v[a - 1], v[a]) < CLASSIFY.zigMaxSeg * 0.75) a--;
  if (b < v.length - 1 && dist(v[b], v[b + 1]) < CLASSIFY.zigMaxSeg * 0.75) b++;
  return { a: idx[a], b: idx[b] };
}

/** Rounded springs: most people draw a spring as a wiggle, not sharp teeth. Track the
 *  stroke's cumulative heading on a smoothed copy; every swing of the heading by at
 *  least waveSwingDeg (with hysteresis) is one bend. Four or more alternating bends of
 *  bounded size that make forward progress are a spring. */
function findWave(p: Pt[]): { a: number; b: number } | null {
  const SP = CLASSIFY.waveSpacing;
  let q = resample(p, SP);
  if (q.length < 12) return null;
  for (let pass = 0; pass < 2; pass++)
    q = q.map((v, k) => (k === 0 || k === q.length - 1 ? v : { x: (q[k - 1].x + 2 * v.x + q[k + 1].x) / 4, y: (q[k - 1].y + 2 * v.y + q[k + 1].y) / 4 }));
  const n = q.length;
  // cumulative heading θ at each segment
  const th: number[] = [F.atan2(q[1].y - q[0].y, q[1].x - q[0].x)];
  for (let k = 1; k < n - 1; k++) {
    let d = F.atan2(q[k + 1].y - q[k].y, q[k + 1].x - q[k].x) - F.atan2(q[k].y - q[k - 1].y, q[k].x - q[k - 1].x);
    while (d > Math.PI) d -= 2 * Math.PI;
    while (d < -Math.PI) d += 2 * Math.PI;
    th.push(th[k - 1] + d);
  }
  // heading extrema with hysteresis = inflection points between bends
  const H = (CLASSIFY.waveHystDeg * Math.PI) / 180;
  const ext: number[] = [0];
  let dir = 0,
    hi = 0,
    lo = 0;
  for (let k = 1; k < th.length; k++) {
    if (th[k] > th[hi]) hi = k;
    if (th[k] < th[lo]) lo = k;
    if (dir >= 0 && th[hi] - th[k] > H) {
      if (hi > 0) ext.push(hi);
      dir = -1;
      lo = k;
    } else if (dir <= 0 && th[k] - th[lo] > H) {
      if (lo > 0) ext.push(lo);
      dir = 1;
      hi = k;
    }
  }
  ext.push(th.length - 1);
  // longest run of good swings
  const minSw = (CLASSIFY.waveMinSwingDeg * Math.PI) / 180,
    maxSw = (CLASSIFY.waveMaxSwingDeg * Math.PI) / 180;
  let best = { a: -1, b: -1, len: 0 },
    runA = -1,
    run = 0;
  for (let i = 1; i < ext.length; i++) {
    const sw = Math.abs(th[ext[i]] - th[ext[i - 1]]);
    const arc = (ext[i] - ext[i - 1]) * SP;
    // end pieces count only when they are a full bend themselves (a lead-in turns far less)
    if (sw >= minSw && sw <= maxSw && arc <= CLASSIFY.waveMaxBendFrac * (n - 1) * SP) {
      if (run === 0) runA = i - 1;
      run++;
      if (run > best.len) best = { a: runA, b: i, len: run };
    } else run = 0;
  }
  if (best.len < CLASSIFY.waveMinBends) return null;
  // the spring runs to the stroke's ends, unless an end is a straight lead-in longer than a
  // typical tooth: that's a line attached to the spring (a tooth's own flank is shorter)
  const W = Math.max(2, Math.round(CLASSIFY.waveStraightLen / SP));
  const flat = (CLASSIFY.waveStraightDeg * Math.PI) / 180;
  const bends: number[] = [];
  for (let i = best.a + 1; i <= best.b; i++) bends.push((ext[i] - ext[i - 1]) * SP);
  bends.sort((x, y) => x - y);
  const tooth = bends[bends.length >> 1];
  let s0 = 0;
  while (s0 + W < ext[best.a] && Math.abs(th[s0 + W] - th[s0]) < flat) s0++;
  const isLead = (len: number) => len >= CLASSIFY.waveLeadMin && len > CLASSIFY.waveLeadMul * tooth;
  const a = s0 > 0 && isLead((s0 + W) * SP) ? s0 + (W >> 1) : 0;
  let s1 = th.length - 1;
  while (s1 - W > ext[best.b] && Math.abs(th[s1] - th[s1 - W]) < flat) s1--;
  const b = s1 < th.length - 1 && isLead((th.length - 1 - s1 + W) * SP) ? s1 - (W >> 1) : n - 1;
  let arcLen = 0;
  for (let k = a + 1; k <= b; k++) arcLen += dist(q[k - 1], q[k]);
  const chord = dist(q[a], q[b]);
  if (chord / arcLen < CLASSIFY.waveMinAdvance) return null; // shading, not a spring
  // teeth must be tall for their spacing: a hand wobble has big turns but low waves
  const ux = (q[b].x - q[a].x) / chord,
    uy = (q[b].y - q[a].y) / chord;
  let mn = Infinity,
    mx = -Infinity;
  for (let k = a; k <= b; k++) {
    const off = (q[k].x - q[a].x) * -uy + (q[k].y - q[a].y) * ux;
    mn = Math.min(mn, off);
    mx = Math.max(mx, off);
  }
  const ia0 = ext[best.a],
    ib0 = ext[best.b];
  const spacing = Math.abs((q[ib0].x - q[ia0].x) * ux + (q[ib0].y - q[ia0].y) * uy) / best.len;
  const aspect = (mx - mn) / Math.max(1, spacing);
  if (aspect < CLASSIFY.waveMinAspect) return null;
  // map back to indices on p by arclength
  const cum: number[] = [0];
  for (let k = 1; k < p.length; k++) cum.push(cum[k - 1] + dist(p[k - 1], p[k]));
  const at = (s: number) => {
    let k = 0;
    while (k < p.length - 1 && cum[k] < s) k++;
    return k;
  };
  const ia = a === 0 ? 0 : at(a * SP),
    ib = b === n - 1 ? p.length - 1 : at(b * SP);
  return ib - ia >= 4 ? { a: ia, b: ib } : null;
}

/** How far a zigzag progresses per tooth relative to its tooth length (springs ~0.3+, shading ~0.1). */
function zigAdvance(p: Pt[]): number {
  const idx = rdp(p, CLASSIFY.rdpEps);
  const v = idx.map((i) => p[i]);
  if (v.length < 4) return 1;
  let adv = 0,
    seg = 0;
  for (let k = 2; k < v.length; k++) adv += dist(v[k - 2], v[k]);
  for (let k = 1; k < v.length; k++) seg += dist(v[k - 1], v[k]);
  return adv / (v.length - 2) / (seg / (v.length - 1));
}

// ---------------------------------------------------------------- assemble

function mkPart(kind: MarkKind, pts: Pt[], area = 0): Part {
  const ink = kind === 'loop' ? pathLength(pts) + dist(pts[pts.length - 1], pts[0]) : pathLength(pts);
  return { kind, pts, area, ink };
}

/** A spring that dominates a run wins over loops: sloppy teeth often cross each other,
 *  which would otherwise read as small closed loops. */
function splitRun(p: Pt[], out: Part[]) {
  const z = p.length >= 5 ? (findZigzag(p) ?? findWave(p)) : null;
  if (!z || pathLength(p.slice(z.a, z.b + 1)) < CLASSIFY.springDominates * pathLength(p)) {
    splitLoops(p, out);
    return;
  }
  if (z.a > 0) splitLoops(p.slice(0, z.a + 1), out);
  out.push(mkPart('zigzag', p.slice(z.a, z.b + 1)));
  if (z.b < p.length - 1) splitLoops(p.slice(z.b), out);
}

/** Split a non-scribble run into loops and lines (recursive on the remaining tail). */
function splitLoops(p: Pt[], out: Part[]) {
  if (p.length < 2) return;
  const cut = findLoop(p);
  if (!cut) {
    splitZigzags(p, out);
    return;
  }
  const ringPts = cut.join ? [cut.join, ...p.slice(cut.a, cut.b + 1)] : p.slice(cut.a, cut.b + 1);
  const head = cut.join ? [...p.slice(0, cut.a), cut.join] : p.slice(0, cut.a + 1);
  const tail = cut.join ? [cut.join, ...p.slice(cut.b + 1)] : p.slice(cut.b);
  const ringInk = pathLength(ringPts);
  if (pathLength(head) > 4) {
    if (hugs(head, ringPts, ringInk)) out.push({ ...mkPart('line', head), hug: true });
    else splitZigzags(head, out);
  }
  out.push(mkPart('loop', ringPts, cut.area));
  if (pathLength(tail) > 4) {
    if (hugs(tail, ringPts, ringInk)) out.push({ ...mkPart('line', tail), hug: true });
    else splitLoops(tail, out);
  }
}

/** Is this piece a sloppy overshoot of the ring: short, and never leaving the ring's side? */
function hugs(piece: Pt[], ring: Pt[], ringInk: number): boolean {
  if (pathLength(piece) > CLASSIFY.hugMaxFrac * ringInk) return false;
  for (const q of resample(piece, 6)) {
    let best = Infinity;
    for (let k = 0; k < ring.length; k++) {
      const a = ring[k],
        b = ring[(k + 1) % ring.length];
      const c = closestOnSeg(q.x, q.y, a.x, a.y, b.x, b.y);
      best = Math.min(best, F.hypot(q.x - c.x, q.y - c.y));
    }
    if (best > CLASSIFY.hugDist) return false;
  }
  return true;
}

function splitZigzags(p: Pt[], out: Part[]) {
  const z = findZigzag(p) ?? findWave(p);
  if (!z) {
    out.push(mkPart('line', p));
    return;
  }
  // extend to the neighbouring rdp vertices so the spring spans first..last turn
  const a = z.a,
    b = z.b;
  if (a > 0) out.push(mkPart('line', p.slice(0, a + 1)));
  out.push(mkPart('zigzag', p.slice(a, b + 1)));
  if (b < p.length - 1) splitZigzags(p.slice(b), out);
}

export function classifyStroke(raw: readonly Pt[]): Classified {
  const pts = clean(raw);
  const total = pathLength(pts);
  if (pts.length < 2) return { parts: pts.length ? [mkPart('line', pts)] : [], ink: total };
  const cum: number[] = [0];
  for (let k = 1; k < pts.length; k++) cum.push(cum[k - 1] + dist(pts[k - 1], pts[k]));

  const { ranges, arc } = findScribbles(pts);
  const parts: Part[] = [];
  let cursor = 0;
  for (const r of ranges) {
    const a = indexAtArc(pts, cum, arc[r.a]);
    const b = Math.max(a + 1, indexAtArc(pts, cum, arc[r.b]));
    if (a > cursor) splitRun(pts.slice(cursor, a + 1), parts);
    const sp = pts.slice(a, Math.min(pts.length, b + 1));
    const hull = convexHull(sp);
    parts.push(mkPart('scribble', sp, polyArea(hull)));
    cursor = b;
  }
  if (cursor < pts.length - 1) splitRun(pts.slice(cursor), parts);
  // short slop tails that start or end inside a lump belong to it
  for (let k = 0; k < parts.length; k++) {
    const q = parts[k];
    if (q.kind !== 'scribble') continue;
    const c = centroidOf(q.pts);
    let rad = 0;
    for (const p of q.pts) rad = Math.max(rad, F.hypot(p.x - c.x, p.y - c.y));
    const inside = (p: Pt) => F.hypot(p.x - c.x, p.y - c.y) < rad * 1.1 + 10;
    for (const nb of [k - 1, k + 1]) {
      const l = parts[nb];
      if (!l || l.kind !== 'line' || l.ink > 60) continue;
      const share = l.pts.filter(inside).length / l.pts.length;
      const isEnd = nb === 0 || nb === parts.length - 1;
      if (isEnd && share > 0.6) {
        q.pts = nb < k ? l.pts.concat(q.pts) : q.pts.concat(l.pts);
        q.ink += l.ink;
        l.pts = [];
      }
    }
  }
  // merge adjacent line parts and drop zero-length bits
  const merged: Part[] = [];
  for (const q of parts) {
    if (q.pts.length < 2) continue;
    const last = merged[merged.length - 1];
    if (last && last.kind === 'line' && q.kind === 'line') {
      last.pts = last.pts.concat(q.pts.slice(1));
      last.ink = pathLength(last.pts);
    } else merged.push(q);
  }
  return { parts: merged, ink: total };
}

/** Kinds of the significant parts (ignores slop tails under 20px), for fixtures and nameplates. */
export function partSummary(c: Classified, minLine = 20): MarkKind[] {
  return c.parts.filter((p) => !p.hug && (p.kind !== 'line' || p.ink >= minLine)).map((p) => p.kind);
}
