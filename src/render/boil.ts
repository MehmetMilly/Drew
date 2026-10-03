// Line boil (look-and-feel §3): every line re-jitters at 8 fps through 3 cycling
// precomputed noise frames, ~0.8 px. Offsets are smooth along the line (so the
// line wobbles rather than fizzes) and never re-randomised per tick.
import { LOOK } from '../tuning';
import { hashNoise } from '../sim/rng';

export const boilState = { enabled: true, frame: 0 };

export function boilFrame(timeS: number) {
  return boilState.enabled ? Math.floor(timeS * LOOK.boilFps) % LOOK.boilFrames : 0;
}

/** Smooth 1D noise along arclength s (px) for a given key and frame. */
export function boil1(key: number, s: number, frame: number, wavelength = 14): number {
  const u = s / wavelength;
  const i = Math.floor(u),
    f = u - i;
  const a = hashNoise(key, i, frame),
    b = hashNoise(key, i + 1, frame);
  const t = f * f * (3 - 2 * f);
  return a + (b - a) * t;
}

export interface BoilTable {
  ox: Float32Array[]; // per frame
  oy: Float32Array[];
}

/** Precompute per-vertex offsets for a polyline with arclengths s[]. */
export function makeBoil(key: number, s: ArrayLike<number>, amp = LOOK.boilAmp): BoilTable {
  const n = s.length;
  const ox: Float32Array[] = [],
    oy: Float32Array[] = [];
  for (let f = 0; f < LOOK.boilFrames; f++) {
    const x = new Float32Array(n),
      y = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      x[i] = boil1(key * 2 + 1, s[i], f) * amp;
      y[i] = boil1(key * 2 + 2, s[i], f) * amp;
    }
    ox.push(x);
    oy.push(y);
  }
  return { ox, oy };
}
