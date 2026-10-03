// Sumo (design §12): a raised ring; the player's creatures (team 0) against a pre-drawn
// opponent (team 1). Both wake together, each side walks into the other and leans, hands
// and springs strike, and the first side shoved off the ring loses. At time-out the ring
// shrinks from both edges. Pure and deterministic.
import { SUMO } from '../tuning';
import type { Creature } from './creature';
import type { Terrain, World } from './world';

export interface SumoRing {
  x0: number;
  x1: number;
  y: number; // ring top
}

/** The ring's terrain (the first terrain piece whose top is the ring's). */
export function ringTerrain(w: World, ring: SumoRing): Terrain | undefined {
  return w.terrain.find((T) => T.kind !== 'floor' && Math.abs(T.minY - ring.y) < 2);
}

/** Spawn the opponent: called when the player's first creature is born. */
export function spawnFoes(w: World, strokes: { x: number; y: number }[][]) {
  // pre-drawn strokes have no pen times: a steady hand at SUMO.penSpeed px/s
  const timed = strokes.map((s) => {
    let t = 0;
    return s.map((p, i) => {
      if (i) t += Math.hypot(p.x - s[i - 1].x, p.y - s[i - 1].y) / SUMO.penSpeed;
      return { x: p.x, y: p.y, t, p: 0.5 };
    });
  });
  const made = w.addStrokes(timed);
  for (const cr of made) cr.team = 1;
  return made;
}

/** The brain: walk into the nearest enemy and lean on it, hands and springs going for its
 *  middle. Near the edge with the enemy outside it, hold the centre instead. */
export function planSumo(w: World, cr: Creature, c: { x: number; y: number }, ring: SumoRing) {
  let foe: Creature | null = null,
    bd = Infinity;
  for (const o of w.creatures) {
    if (!o.alive || o.team === cr.team || !onRing(w, o, ring)) continue;
    const oc = w.centroid(o);
    const d = Math.abs(oc.x - c.x);
    if (d < bd) (bd = d), (foe = o);
  }
  const mid = (ring.x0 + ring.x1) / 2;
  if (!foe) return { plan: 'sumo' as const, tx: mid, reach: null };
  const oc = w.centroid(foe);
  const side = Math.sign(oc.x - c.x) || 1;
  // drive through it: the target is beyond its far side, so the walk servo keeps pushing
  const tx = oc.x + side * SUMO.drive;
  return { plan: 'sumo' as const, tx, reach: { x: oc.x - side * 4, y: oc.y + SUMO.reachLow, body: -1 } };
}

/** Is it still on the ring: its centre of mass above the ring top and over it. */
export function onRing(w: World, cr: Creature, ring: SumoRing): boolean {
  const c = w.centroid(cr);
  const T = ringTerrain(w, ring);
  const x0 = T ? T.minX : ring.x0,
    x1 = T ? T.maxX : ring.x1;
  return c.y < ring.y + SUMO.outDepth && c.x > x0 - SUMO.edgeSlop && c.x < x1 + SUMO.edgeSlop;
}

/** Ink mass of a team still on the ring. */
export function teamOnRing(w: World, team: number, ring: SumoRing): number {
  let m = 0;
  for (const cr of w.creatures) if (cr.alive && cr.team === team && onRing(w, cr, ring)) m += w.centroid(cr).m;
  return m;
}

/** At time-out the ring shrinks from both edges toward the middle. */
export function shrinkRing(w: World, ring: SumoRing, h: number) {
  const T = ringTerrain(w, ring);
  if (!T) return;
  const mid = (ring.x0 + ring.x1) / 2;
  const d = SUMO.shrink * h;
  for (const p of T.pts) {
    if (p.x < mid) p.x = Math.min(mid - SUMO.minHalf, p.x + d);
    else p.x = Math.max(mid + SUMO.minHalf, p.x - d);
  }
  T.minX = Math.min(...T.pts.map((p) => p.x));
  T.maxX = Math.max(...T.pts.map((p) => p.x));
}
