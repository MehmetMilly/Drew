// Seeded PRNG and stable hashing. The only randomness the simulation may use.

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** FNV-1a over 32-bit words. */
export function fnv(words: ArrayLike<number>, h = 0x811c9dc5): number {
  for (let i = 0; i < words.length; i++) {
    h ^= words[i] & 0xffffffff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

const f64 = new Float64Array(1);
const u32 = new Uint32Array(f64.buffer);
/** Hash a float exactly (bit pattern). */
export function hashFloat(h: number, v: number): number {
  f64[0] = v;
  h ^= u32[0];
  h = Math.imul(h, 0x01000193) >>> 0;
  h ^= u32[1];
  return Math.imul(h, 0x01000193) >>> 0;
}

/** Hash floats rounded to a grid (stable seed from stroke data). */
export function hashPoints(pts: ArrayLike<{ x: number; y: number }>, h = 0x811c9dc5): number {
  for (let i = 0; i < pts.length; i++) {
    h ^= Math.round(pts[i].x) & 0xffff;
    h = Math.imul(h, 0x01000193) >>> 0;
    h ^= Math.round(pts[i].y) & 0xffff;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h >>> 0;
}

/** Deterministic value noise in [-1,1] from an integer key. */
export function hashNoise(a: number, b = 0, c = 0): number {
  let h = Math.imul(a | 0, 0x27d4eb2d) ^ Math.imul(b | 0, 0x165667b1) ^ Math.imul(c | 0, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967295) * 2 - 1;
}
