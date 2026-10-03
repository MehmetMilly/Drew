// Small geometry kit. Pure functions over {x,y} points.
import * as F from './fmath';

export interface Pt {
  x: number;
  y: number;
}

/** A captured stroke point: position, sim/pen time (s), pressure 0..1. */
export interface InkPt extends Pt {
  t: number;
  p: number;
}

export const dist = (a: Pt, b: Pt) => F.hypot(b.x - a.x, b.y - a.y);

export function pathLength(p: readonly Pt[]): number {
  let l = 0;
  for (let i = 1; i < p.length; i++) l += dist(p[i - 1], p[i]);
  return l;
}

/** Resample a polyline at a fixed spacing. Keeps the first point; keeps the last if far enough. */
export function resample(pts: readonly Pt[], sp: number, closed = false): Pt[] {
  if (pts.length === 0) return [];
  const src = closed ? [...pts, pts[0]] : pts;
  const out: Pt[] = [{ x: src[0].x, y: src[0].y }];
  let acc = 0;
  for (let i = 1; i < src.length; i++) {
    let ax = src[i - 1].x,
      ay = src[i - 1].y;
    const bx = src[i].x,
      by = src[i].y;
    let seg = F.hypot(bx - ax, by - ay);
    while (acc + seg >= sp && seg > 1e-9) {
      const t = (sp - acc) / seg;
      ax += (bx - ax) * t;
      ay += (by - ay) * t;
      out.push({ x: ax, y: ay });
      seg = F.hypot(bx - ax, by - ay);
      acc = 0;
    }
    acc += seg;
  }
  if (closed) {
    // drop a final point that sits on top of the first
    if (out.length > 2 && dist(out[out.length - 1], out[0]) < sp * 0.5) out.pop();
  } else {
    const last = src[src.length - 1];
    if (dist(out[out.length - 1], last) > sp * 0.4) out.push({ x: last.x, y: last.y });
    else if (out.length > 1) out[out.length - 1] = { x: last.x, y: last.y };
  }
  return out;
}

/** Signed shoelace area (positive = clockwise in screen coords). */
export function signedArea(p: readonly Pt[]): number {
  let a = 0;
  for (let i = 0; i < p.length; i++) {
    const j = (i + 1) % p.length;
    a += p[i].x * p[j].y - p[j].x * p[i].y;
  }
  return a / 2;
}
export const polyArea = (p: readonly Pt[]) => Math.abs(signedArea(p));

export function centroidOf(p: readonly Pt[]): Pt {
  let x = 0,
    y = 0;
  for (const q of p) {
    x += q.x;
    y += q.y;
  }
  return { x: x / p.length, y: y / p.length };
}

export function bounds(p: readonly Pt[]) {
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const q of p) {
    if (q.x < minX) minX = q.x;
    if (q.y < minY) minY = q.y;
    if (q.x > maxX) maxX = q.x;
    if (q.y > maxY) maxY = q.y;
  }
  return { minX, minY, maxX, maxY, w: maxX - minX, h: maxY - minY };
}

/** Ramer–Douglas–Peucker; returns indices into the input. */
export function rdp(p: readonly Pt[], eps: number): number[] {
  if (p.length < 3) return p.map((_, i) => i);
  const keep = new Uint8Array(p.length);
  keep[0] = keep[p.length - 1] = 1;
  const stack: [number, number][] = [[0, p.length - 1]];
  while (stack.length) {
    const [a, b] = stack.pop()!;
    let best = -1,
      bd = eps;
    const ax = p[a].x,
      ay = p[a].y,
      dx = p[b].x - ax,
      dy = p[b].y - ay;
    const L = F.hypot(dx, dy);
    for (let i = a + 1; i < b; i++) {
      const d = L < 1e-9 ? F.hypot(p[i].x - ax, p[i].y - ay) : Math.abs((p[i].x - ax) * dy - (p[i].y - ay) * dx) / L;
      if (d > bd) {
        bd = d;
        best = i;
      }
    }
    if (best >= 0) {
      keep[best] = 1;
      stack.push([a, best], [best, b]);
    }
  }
  const out: number[] = [];
  for (let i = 0; i < p.length; i++) if (keep[i]) out.push(i);
  return out;
}

/** Andrew's monotone chain convex hull. */
export function convexHull(pts: readonly Pt[]): Pt[] {
  const p = pts.slice().sort((a, b) => a.x - b.x || a.y - b.y);
  if (p.length < 3) return p;
  const cross = (o: Pt, a: Pt, b: Pt) => (a.x - o.x) * (b.y - o.y) - (a.y - o.y) * (b.x - o.x);
  const lo: Pt[] = [];
  for (const q of p) {
    while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], q) <= 0) lo.pop();
    lo.push(q);
  }
  const up: Pt[] = [];
  for (let i = p.length - 1; i >= 0; i--) {
    const q = p[i];
    while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], q) <= 0) up.pop();
    up.push(q);
  }
  lo.pop();
  up.pop();
  return lo.concat(up);
}

/** Segment intersection param (t on ab, u on cd) or null. */
export function segIntersect(a: Pt, b: Pt, c: Pt, d: Pt): { t: number; u: number } | null {
  const rx = b.x - a.x,
    ry = b.y - a.y,
    sx = d.x - c.x,
    sy = d.y - c.y;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-12) return null;
  const qx = c.x - a.x,
    qy = c.y - a.y;
  const t = (qx * sy - qy * sx) / den;
  const u = (qx * ry - qy * rx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return null;
  return { t, u };
}

export function pointInPoly(x: number, y: number, poly: readonly Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i],
      b = poly[j];
    if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}

/** Closest point on segment ab to p. */
export function closestOnSeg(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax,
    dy = by - ay;
  const L2 = dx * dx + dy * dy;
  let t = L2 > 0 ? ((px - ax) * dx + (py - ay) * dy) / L2 : 0;
  if (t < 0) t = 0;
  else if (t > 1) t = 1;
  return { x: ax + dx * t, y: ay + dy * t, t };
}

export function turnAngle(a: Pt, b: Pt, c: Pt): number {
  const a1 = F.atan2(b.y - a.y, b.x - a.x);
  const a2 = F.atan2(c.y - b.y, c.x - b.x);
  let d = a2 - a1;
  while (d > Math.PI) d -= 2 * Math.PI;
  while (d < -Math.PI) d += 2 * Math.PI;
  return d;
}

export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
export const clamp = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);
