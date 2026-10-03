// The creature brain (design.md §8). Phase 1: toy targets (tap = walk + reach
// target for every creature), idle look-around, and the face state machine.
// The eyes always lead: a new decision moves the pupils first and the body
// starts BRAIN.eyeLead + ACT.anticipation later.
import { ACT, BRAIN, LOCO, LOOK, WORLD } from '../tuning';
import type { Creature } from './creature';
import { hashNoise } from './rng';
import type { World } from './world';

export function senseRange(cr: Creature) {
  return 2 * cr.stats.size + BRAIN.senseBase;
}

export function think(w: World, cr: Creature) {
  const b = cr.brain,
    f = cr.face;
  const dt = WORLD.dt;
  const c = w.centroid(cr);
  const head = w.headPos(cr);

  // ---- decisions
  const tgt = w.toyTarget;
  if (tgt && (b.targetX !== tgt.x || b.reachY !== tgt.y || !b.hasReach)) {
    b.targetX = tgt.x;
    b.reachX = tgt.x;
    b.reachY = tgt.y;
    b.hasReach = true;
    b.actAt = Math.max(w.t + BRAIN.eyeLead + ACT.anticipation, cr.bornAt + 0.35);
    b.intentAt = w.t;
    b.intentX = tgt.x;
    b.intentY = tgt.y;
    f.saccade = 1;
  }
  let focusX: number, focusY: number;
  if (b.targetX !== null) {
    const dx = b.targetX - c.x;
    const reachable = Math.hypot(b.reachX - head.x, b.reachY - head.y) < senseRange(cr);
    if (Math.abs(dx) > LOCO.arriveDist + cr.stats.w * 0.15) {
      b.mode = 'walk';
      b.dir = Math.sign(dx) || 1;
    } else b.mode = reachable ? 'reach' : 'idle';
    focusX = b.reachX;
    focusY = b.reachY;
  } else {
    b.mode = 'idle';
    // idle look-around: a new glance every 1.2–3 s, sometimes at the player
    const slot = Math.floor((w.t + (cr.seed % 97) / 30) / 1.8);
    const r1 = hashNoise(cr.seed, slot, 1),
      r2 = hashNoise(cr.seed, slot, 2);
    if (r1 > 0.55) {
      focusX = head.x;
      focusY = head.y; // straight out of the page, at the player
    } else {
      focusX = head.x + r1 * 220;
      focusY = head.y + r2 * 120 + 40;
    }
  }
  f.wantX = focusX;
  f.wantY = focusY;

  // ---- face (keyed animation, deterministic)
  // saccade: pupils jump most of the way in a couple of frames
  const k = f.saccade > 0 ? 0.55 : 0.35;
  f.lookX += (f.wantX - f.lookX) * k;
  f.lookY += (f.wantY - f.lookY) * k;
  f.saccade = Math.max(0, f.saccade - dt * 6);
  // blinking: a double blink at birth, then every 2–5 s
  const age = w.t - cr.bornAt;
  if (f.doubleBlink) {
    if (age > 0.62) f.doubleBlink = false;
  } else {
    f.blink -= dt;
    if (f.blink <= 0) {
      f.blinkT = 0.12;
      f.blink = LOOK.blinkMin + (LOOK.blinkMax - LOOK.blinkMin) * (0.5 + 0.5 * hashNoise(cr.seed, w.steps, 3));
    }
  }
  f.blinkT = Math.max(0, f.blinkT - dt);
  f.squash = Math.max(0, f.squash - dt / 0.12);
  f.surprise = Math.max(0, f.surprise - dt * 0.8);
  f.hurt = Math.max(0, f.hurt - dt * 1.5);
  f.happy = Math.max(0, f.happy - dt * 0.5);
  const ang = Math.abs((cr as Creature & { angle?: number }).angle ?? 0);
  f.upsideT = ang > 2.0 ? f.upsideT + dt : 0;
  f.dizzy = f.upsideT > 1 ? 1 : Math.max(0, f.dizzy - dt);
}

/** Is the creature blinking right now? (includes the birth double blink) */
export function isBlinking(w: World, cr: Creature): boolean {
  const age = w.t - cr.bornAt;
  if (cr.face.doubleBlink) return (age > 0.18 && age < 0.28) || (age > 0.42 && age < 0.52);
  return cr.face.blinkT > 0;
}
