// Measurement course shared by verify (distinct bodies) and metrics.
import { World } from '../src/sim/world';
import { CANON, GROUND_Y } from '../src/sim/canon';
import { WORLD } from '../src/tuning';
import type { Pt } from '../src/sim/geom';

export function spawn(w: World, strokes: Pt[][]) {
  // canon strokes have no pen times; give them a steady 900 px/s
  const timed = strokes.map((s) => {
    let t = 0;
    return s.map((p, i) => {
      if (i) t += Math.hypot(p.x - s[i - 1].x, p.y - s[i - 1].y) / 900;
      return { x: p.x, y: p.y, t, p: 0.5 };
    });
  });
  return w.addStrokes(timed);
}

export function run(w: World, seconds: number, each?: () => void) {
  const n = Math.round(seconds / WORLD.dt);
  for (let i = 0; i < n; i++) {
    w.step();
    each?.();
  }
}

/** Walking speed on flat ground (px/s), measured from 0.6 s to 3.6 s. */
export function walkSpeed(name: string): number {
  const w = new World({ seed: 1 });
  const [cr] = spawn(w, CANON[name](140));
  if (!cr) return 0;
  w.toyTarget = { x: 715, y: GROUND_Y - 10 };
  run(w, 0.6);
  const x0 = w.centroid(cr).x;
  run(w, 3);
  return (w.centroid(cr).x - x0) / 3;
}

/** Highest point reached (px above ground) with a reach target straight up. */
export function reachHeight(name: string): number {
  const w = new World({ seed: 1 });
  const [cr] = spawn(w, CANON[name](360));
  if (!cr) return 0;
  w.toyTarget = { x: w.centroid(cr).x, y: -400 };
  let top = Infinity;
  const hands = cr.limbs.filter((l) => !l.foot);
  run(w, 3, () => {
    if (hands.length) for (const l of hands) top = Math.min(top, w.P.y[l.tip]);
    else for (const i of cr.ids) top = Math.min(top, w.P.y[i]);
  });
  return GROUND_Y - top;
}

/** Max rise of the lowest particle above ground over 3 s with a target above (jump). */
export function jumpHeight(name: string): number {
  const w = new World({ seed: 1 });
  const [cr] = spawn(w, CANON[name](360));
  if (!cr) return 0;
  w.toyTarget = { x: w.centroid(cr).x, y: 100 };
  let best = 0;
  run(w, 3, () => {
    let low = -Infinity;
    for (const i of cr.ids) low = Math.max(low, w.P.y[i]);
    best = Math.max(best, GROUND_Y - 5 - low);
  });
  return best;
}
