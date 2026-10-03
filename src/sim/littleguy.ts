// Little Guy (design.md §10): a 6-particle felt-tip ragdoll. He can't fight; he
// stands (a gentle upright servo while a foot touches ground), cowers, flails
// when grabbed or flung, and dies in a comic poof. Pure and deterministic.
import * as F from './fmath';
import { GUY, WORLD } from '../tuning';
import { CT, PF } from './store';
import type { World } from './world';

export const GUY_OWNER = -2;

export type GuyHat = 'none' | 'crown' | 'party' | 'gyoji';
export type GuyMood = 'idle' | 'startle' | 'cower' | 'flail' | 'happy' | 'dead';

export interface Guy {
  head: number;
  chest: number;
  hip: number;
  footL: number;
  footR: number;
  hand: number;
  ids: number[];
  cons: number[];
  hat: GuyHat;
  mood: GuyMood;
  moodT: number; // time the mood started
  facing: number; // -1 / 1
  alive: boolean;
  diedAt: number;
  cause: string;
  heldBy: number; // creature id holding him, -1
  hugging: number; // creature id he is hugging, -1
  lookX: number;
  lookY: number;
  seenBorn: Set<number>; // creatures he has already looked at
  kick: number; // leg-kick phase while held
}

/** Stand Little Guy with his feet on y = groundY at x. */
export function spawnGuy(w: World, x: number, groundY: number, hat: GuyHat = 'none'): Guy {
  const P = w.P,
    C = w.C;
  const m = GUY.mass / 6;
  const at = (dx: number, dy: number) => {
    const i = P.add(x + dx, groundY - GUY.radius + dy, m);
    P.owner[i] = GUY_OWNER;
    P.flags[i] |= PF.GUY;
    return i;
  };
  const footL = at(-5, 0),
    footR = at(5, 0),
    hip = at(0, -12),
    chest = at(0, -22),
    head = at(0, -32),
    hand = at(7, -16);
  const cons: number[] = [];
  const link = (a: number, b: number, k: number, type: number = CT.LINK) => {
    cons.push(C.add(a, b, F.hypot(P.x[b] - P.x[a], P.y[b] - P.y[a]), k, type));
  };
  link(head, chest, 1);
  link(chest, hip, 1);
  link(hip, footL, 1);
  link(hip, footR, 1);
  link(chest, hand, 1);
  link(footL, footR, 0.4, CT.BEND);
  link(head, hip, 0.6, CT.BEND);
  link(chest, footL, 0.3, CT.BEND);
  link(chest, footR, 0.3, CT.BEND);
  link(hand, hip, 0.2, CT.BEND);
  return {
    head,
    chest,
    hip,
    footL,
    footR,
    hand,
    ids: [footL, footR, hip, chest, head, hand],
    cons,
    hat,
    mood: 'idle',
    moodT: 0,
    facing: 1,
    alive: true,
    diedAt: -1,
    cause: '',
    heldBy: -1,
    hugging: -1,
    lookX: x + 40,
    lookY: groundY - 30,
    seenBorn: new Set(),
    kick: 0,
  };
}

export function guyCentre(w: World, g: Guy) {
  const P = w.P;
  let x = 0,
    y = 0;
  for (const i of g.ids) {
    x += P.x[i];
    y += P.y[i];
  }
  return { x: x / g.ids.length, y: y / g.ids.length };
}

export function setMood(w: World, g: Guy, mood: GuyMood) {
  if (g.mood === mood || g.mood === 'dead') return;
  g.mood = mood;
  g.moodT = w.t;
}

/** Per substep: balance while standing, cower crouch, kicks while held. */
export function actuateGuy(w: World, g: Guy, h: number) {
  if (!g.alive) return;
  const P = w.P;
  const grounded = (P.flags[g.footL] | P.flags[g.footR]) & PF.GROUND;
  if (!grounded || g.heldBy >= 0) {
    g.kick += h * 14;
    return;
  }
  const hx = P.x[g.hip],
    hy = P.y[g.hip];
  const crouch = g.mood === 'cower' ? GUY.cowerDrop : 0;
  const pull = (i: number, tx: number, ty: number, k: number) => {
    const vx = (P.x[i] - P.px[i]) / h,
      vy = (P.y[i] - P.py[i]) / h;
    const wx = (tx - P.x[i]) * GUY.standRate,
      wy = (ty - P.y[i]) * GUY.standRate;
    P.px[i] = P.x[i] - (vx + (wx - vx) * k) * h;
    P.py[i] = P.y[i] - (vy + (wy - vy) * k) * h;
  };
  // only while roughly upright: knocked flat, he lies there until he rolls back
  const up = hy - P.y[g.head];
  if (up > 4) {
    pull(g.head, (P.x[g.footL] + P.x[g.footR]) / 2, hy - 20 + crouch, GUY.standGain);
    pull(g.chest, (P.x[g.footL] + P.x[g.footR]) / 2, hy - 10 + crouch * 0.5, GUY.standGain);
  }
  void hx;
}

/** Per frame: where he looks, startle at big newborns, cower at threats, hold the hug. */
export function thinkGuy(w: World, g: Guy, threat: { x: number; y: number } | null) {
  if (!g.alive) return;
  const c = guyCentre(w, g);
  // look at every newborn; leap with a "!" at a big one
  for (const cr of w.creatures) {
    if (!cr.alive || cr.isPiece || g.seenBorn.has(cr.id)) continue;
    g.seenBorn.add(cr.id);
    const ce = w.centroid(cr);
    g.lookX = ce.x;
    g.lookY = ce.y;
    g.facing = Math.sign(ce.x - c.x) || g.facing;
    if (cr.stats.h > GUY.height * 3 && g.mood !== 'cower') {
      setMood(w, g, 'startle');
      const P = w.P;
      for (const i of g.ids) P.py[i] = P.y[i] + GUY.startleHop * (WORLD.dt / WORLD.substeps);
    }
  }
  if (g.heldBy >= 0) setMood(w, g, w.t - g.moodT > 1 && g.mood === 'flail' ? 'idle' : 'flail');
  else if (g.hugging >= 0) setMood(w, g, 'happy');
  else if (threat && F.hypot(threat.x - c.x, threat.y - c.y) < GUY.cowerDist) {
    setMood(w, g, 'cower');
    g.lookX = threat.x;
    g.lookY = threat.y;
    g.facing = Math.sign(threat.x - c.x) || g.facing;
  } else if (g.mood === 'cower' || (g.mood === 'startle' && w.t - g.moodT > 0.8) || (g.mood === 'flail' && w.t - g.moodT > 1)) setMood(w, g, 'idle');
}

/** The comic poof: he bursts into a scribble cloud. */
export function killGuy(w: World, g: Guy, cause: string) {
  if (!g.alive) return;
  g.alive = false;
  g.diedAt = w.t;
  g.cause = cause;
  g.mood = 'dead';
  const c = guyCentre(w, g);
  w.emit({ type: 'guyDied', x: c.x, y: c.y, text: cause });
  for (const k of g.cons) w.C.remove(k);
  for (const i of g.ids) w.P.remove(i);
}
