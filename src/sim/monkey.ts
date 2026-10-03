// Seeded random drawings for the monkey and no-noise tearing checks.
import * as F from './fmath';
import { mulberry32, Rng } from './rng';
import type { Pt } from './geom';
import { arc, circle, line, poly, scribbleBlob, springLine } from './canon';

function wobble(r: Rng, pts: Pt[], amp: number): Pt[] {
  const ph = r() * 6.28,
    f = 1 + r() * 3;
  return pts.map((p, i) => ({ x: p.x + F.sin(i * 0.07 * f + ph) * amp, y: p.y + F.cos(i * 0.05 * f + ph) * amp }));
}

/** One random stroke near (cx, cy). */
export function randomStroke(r: Rng, cx: number, cy: number, size: number): Pt[] {
  const k = r();
  const a = r() * Math.PI * 2;
  const L = size * (0.3 + r() * 0.9);
  if (k < 0.4) return wobble(r, line(cx, cy, cx + F.cos(a) * L, cy + F.sin(a) * L), r() * 6);
  if (k < 0.6) return wobble(r, circle(cx, cy, 15 + r() * size * 0.3), r() * 3);
  if (k < 0.72) return springLine(cx, cy, cx + F.cos(a) * L, cy + F.sin(a) * L, 4 + Math.floor(r() * 4), 8 + r() * 8);
  if (k < 0.82) return [...line(cx, cy, cx + F.cos(a) * L * 0.6, cy + F.sin(a) * L * 0.6), ...scribbleBlob(cx + F.cos(a) * L * 0.7, cy + F.sin(a) * L * 0.7, 14 + r() * 16, 14)];
  if (k < 0.92) return wobble(r, arc(cx, cy, L * 0.5, a, a + 1 + r() * 3), 2);
  // a random polyline
  const vs: Pt[] = [{ x: cx, y: cy }];
  for (let i = 0; i < 2 + Math.floor(r() * 5); i++) vs.push({ x: cx + (r() - 0.5) * size, y: cy + (r() - 0.5) * size });
  return poly(vs);
}

/** A random creature: 1–6 strokes clustered so most of them touch. */
export function randomCreature(r: Rng, cx: number, cy: number): Pt[][] {
  const n = 1 + Math.floor(r() * 6);
  const size = 60 + r() * 260;
  const out: Pt[][] = [];
  for (let i = 0; i < n; i++) {
    const s = out.length ? out[Math.floor(r() * out.length)] : null;
    const anchor = s ? s[Math.floor(r() * s.length)] : { x: cx, y: cy };
    out.push(randomStroke(r, anchor.x, anchor.y, size));
  }
  return out.map((s) => s.map((p) => ({ x: Math.max(8, Math.min(712, p.x)), y: Math.max(20, Math.min(1180, p.y)) })));
}

export function rngFor(seed: number) {
  return mulberry32(seed);
}
