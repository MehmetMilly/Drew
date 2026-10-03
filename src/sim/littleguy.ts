// Little Guy (design.md §10): a 6-particle felt-tip ragdoll. He can't fight; he
// stands (a gentle upright servo while a foot touches ground), cowers, flails
// when grabbed or flung, and dies in a comic poof. Pure and deterministic.
import * as F from './fmath';
import { BODY, GUY, WORLD } from '../tuning';
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
  /** HOME: the creature he rides (-1) and the particle he perches on */
  ride: number;
  perch: number;
  /** HOME: the hand tip holding him (heldBy is the creature) */
  heldTip: number;
  /** HOME: x he is walking to (a creature waiting for him), null when standing */
  walkTo: number | null;
  /** s the ridden creature has been upside down */
  upsideT: number;
  rideAt: number; // when he climbed on (the hop up is forgiven the slip test)
  hopFrom: number; // the carrier he just hopped off (no collision with it until hopUntil)
  hopUntil: number;
  climbFor: number; // s the climb may take (a scramble up a giant takes longer)
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
    ride: -1,
    perch: -1,
    heldTip: -1,
    walkTo: null,
    upsideT: 0,
    rideAt: -9,
    climbFor: 0,
    hopFrom: -1,
    hopUntil: -9,
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
  if (g.ride >= 0 && ride(w, g, h)) return;
  if (g.heldBy >= 0 && g.heldTip >= 0 && held(w, g, h)) {
    g.kick += h * 14;
    return;
  }
  if (!grounded || g.heldBy >= 0) {
    g.kick += h * 14;
    return;
  }
  // his slow walk to a creature that waits for him
  if (g.walkTo !== null) {
    const dir = Math.sign(g.walkTo - P.x[g.hip]);
    g.facing = dir || g.facing;
    for (const i of g.ids) servoV(w, i, dir * GUY.walkSpeed, null, GUY.walkGain, h);
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

/** Velocity servo on one of his particles (vy null: leave vertical alone). */
function servoV(w: World, i: number, vx: number, vy: number | null, k: number, h: number) {
  const P = w.P;
  const cx = (P.x[i] - P.px[i]) / h,
    cy = (P.y[i] - P.py[i]) / h;
  P.px[i] = P.x[i] - (cx + (vx - cx) * k) * h;
  if (vy !== null) P.py[i] = P.y[i] - (cy + (vy - cy) * k) * h;
}

/** Riding: feet servo softly onto the perch, body upright above it. False once he falls off. */
function ride(w: World, g: Guy, h: number): boolean {
  const P = w.P;
  const p = g.perch;
  if (!(P.flags[p] & PF.ALIVE)) return (dismount(g), false);
  // his carrier came apart: he rides whichever piece his perch is on now
  if (P.owner[p] !== g.ride && w.creatures[P.owner[p]]?.alive) g.ride = P.owner[p];
  const cr = w.creatures[g.ride];
  if (!cr || !cr.alive) return (dismount(g), false);
  const top = P.y[p] - BODY.radius - GUY.radius;
  const fx = (P.x[g.footL] + P.x[g.footR]) / 2,
    fy = (P.y[g.footL] + P.y[g.footR]) / 2;
  const climbing = w.t - g.rideAt < g.climbFor;
  if ((!climbing && F.hypot(fx - P.x[p], fy - top) > GUY.rideSlip) || g.upsideT > GUY.upsideFall) return (dismount(g), false);
  const to = (i: number, tx: number, ty: number) => {
    let vx = (tx - P.x[i]) * GUY.rideRate,
      vy = (ty - P.y[i]) * GUY.rideRate;
    // the hop up is quick but not a teleport; a tall one is a scramble
    const cap = top < P.y[g.footL] - GUY.climbMax ? GUY.scrambleSpeed : GUY.climbSpeed;
    const s = F.hypot(vx, vy);
    if (s > cap) (vx *= cap / s), (vy *= cap / s);
    servoV(w, i, vx + (P.x[p] - P.px[p]) / h, vy + (P.y[p] - P.py[p]) / h, GUY.rideGain, h);
  };
  to(g.footL, P.x[p] - 5, top);
  to(g.footR, P.x[p] + 5, top);
  to(g.hip, P.x[p], top - 12);
  to(g.chest, P.x[p], top - 22);
  to(g.head, P.x[p], top - 32);
  return true;
}

/** Carried in a hand: his chest hangs from the tip; he kicks. False once the hold breaks. */
function held(w: World, g: Guy, h: number): boolean {
  const P = w.P;
  const t = g.heldTip;
  const cr = w.creatures[g.heldBy];
  if (!cr || !cr.alive || !(P.flags[t] & PF.ALIVE) || F.hypot(P.x[g.chest] - P.x[t], P.y[g.chest] - P.y[t]) > GUY.holdSlip) {
    g.heldBy = -1;
    g.heldTip = -1;
    return false;
  }
  const vx = (P.x[t] - P.px[t]) / h,
    vy = (P.y[t] - P.py[t]) / h;
  servoV(w, g.chest, vx + (P.x[t] - P.x[g.chest]) * GUY.rideRate, vy + (P.y[t] + 6 - P.y[g.chest]) * GUY.rideRate, GUY.rideGain, h);
  servoV(w, g.hand, vx + (P.x[t] - P.x[g.hand]) * GUY.rideRate, vy + (P.y[t] - P.y[g.hand]) * GUY.rideRate, GUY.rideGain, h);
  return true;
}

/** Hop off the carrier toward x (the flag): a little leap that passes through the carrier. */
export function hopDown(w: World, g: Guy, x: number) {
  const dir = Math.sign(x - guyCentre(w, g).x) || 1;
  g.hopFrom = g.ride >= 0 ? g.ride : g.heldBy;
  g.hopUntil = w.t + GUY.hopClear;
  dismount(g);
  g.heldBy = -1;
  const h = WORLD.dt / WORLD.substeps;
  for (const i of g.ids) servoV(w, i, dir * GUY.hopVx, -GUY.hopVy, 1, h);
}

export function dismount(g: Guy) {
  g.ride = -1;
  g.perch = -1;
  g.upsideT = 0;
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
