// The four-mark classifier (design.md §4, physics.md §3). It reads geometry only.
// A stroke is cut into an ordered list of parts; consecutive parts join end to start.
// Loops start and end at the same point (the closing vertex), so tails attach there.

import { CLASSIFY, BODY } from '../tuning';
import { Pt, centroidOf, dist, pathLength, polyArea, rdp, resample, segIntersect, turnAngle, convexHull } from './geom';

export type MarkKind = 'line' | 'loop' | 'zigzag' | 'scribble';

export interface Part {
  kind: MarkKind;
  /** Full-resolution points of this part. A loop's ring does not repeat its first point. */
  pts: Pt[];
  /** For a loop: enclosed area. For a scribble: hull area. */
  area: number;
  /** Ink length of the drawn points that made this part (for mass). */
  ink: number;
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
    for (const p of hull) rad = Math.max(rad, Math.hypot(p.x - cx, p.y - cy));
    const lim = rad * 1.25 + 8;
    let a = r.a,
      b = r.b;
    while (a > 0 && Math.hypot(even[a - 1].x - cx, even[a - 1].y - cy) < lim) a--;
    while (b < n - 1 && Math.hypot(even[b + 1].x - cx, even[b + 1].y - cy) < lim) b++;
    // a short leftover tail at either end is part of the scribble
    const tailMax = Math.max(26, 0.12 * (b - a) * SP);
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
  const idx = rdp(p, CLASSIFY.rdpEps);
  if (idx.length < CLASSIFY.zigMinVerts + 2) return null;
  const v = idx.map((i) => p[i]);
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
    const okSeg = dist(v[k - 1], v[k]) < CLASSIFY.zigMaxSeg && dist(v[k], v[k + 1]) < CLASSIFY.zigMaxSeg;
    const sharp = Math.abs(ang) > thr;
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
  if (pathLength(head) > 4) splitZigzags(head, out);
  out.push(mkPart('loop', ringPts, cut.area));
  if (pathLength(tail) > 4) splitLoops(tail, out);
}

function splitZigzags(p: Pt[], out: Part[]) {
  const z = findZigzag(p);
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
    if (a > cursor) splitLoops(pts.slice(cursor, a + 1), parts);
    const sp = pts.slice(a, Math.min(pts.length, b + 1));
    const hull = convexHull(sp);
    parts.push(mkPart('scribble', sp, polyArea(hull)));
    cursor = b;
  }
  if (cursor < pts.length - 1) splitLoops(pts.slice(cursor), parts);
  // short slop tails that start or end inside a lump belong to it
  for (let k = 0; k < parts.length; k++) {
    const q = parts[k];
    if (q.kind !== 'scribble') continue;
    const c = centroidOf(q.pts);
    let rad = 0;
    for (const p of q.pts) rad = Math.max(rad, Math.hypot(p.x - c.x, p.y - c.y));
    const inside = (p: Pt) => Math.hypot(p.x - c.x, p.y - c.y) < rad * 1.1 + 10;
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
  return c.parts.filter((p) => p.kind !== 'line' || p.ink >= minLine).map((p) => p.kind);
}
