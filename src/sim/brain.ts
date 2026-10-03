// The creature brain (design.md §8). Phase 1: toy targets (tap = walk + reach
// target for every creature), idle look-around, and the face state machine.
// The eyes always lead: a new decision moves the pupils first and the body
// starts BRAIN.eyeLead + ACT.anticipation later.
import * as F from './fmath';
import { ACT, BRAIN, LOCO, LOOK, WORLD } from '../tuning';
import type { Creature } from './creature';
import { hashNoise } from './rng';
import { guyCentre } from './littleguy';
import { mainThreat } from './level';
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
  if (w.level && w.guy) planLevel(w, cr, c);
  const tgt = w.level ? null : w.toyTarget;
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
    f.surprise = Math.max(f.surprise, BRAIN.notice); // "oh!": eyes widen as they lock on
  }
  let focusX: number, focusY: number;
  if (b.targetX !== null) {
    const dx = b.targetX - c.x;
    const reachable = F.hypot(b.reachX - head.x, b.reachY - head.y) < senseRange(cr);
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
    if (age > 0.9) f.doubleBlink = false;
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
  f.upsideT = ang > 2.0 && cr.gait !== 'roll' ? f.upsideT + dt : 0;
  f.dizzy = f.upsideT > 1 ? 1 : Math.max(0, f.dizzy - dt);
  // facing: the eyes turn to the side the body is heading (and stay there after it stops)
  if (b.mode === 'walk' && w.t >= b.actAt - ACT.anticipation) f.side += (b.dir - f.side) * 0.18;
}

/** Level brain (design §8): brace against pushers, intercept threats between them and
 *  Little Guy (hands reach for the threat), else guard beside him; HUG goals walk into him. */
function planLevel(w: World, cr: Creature, c: { x: number; y: number }) {
  const b = cr.brain,
    f = cr.face;
  const g = w.guy!;
  const gc = g.alive ? guyCentre(w, g) : { x: w.level!.def.guy.x, y: w.level!.def.guy.y - 20 };
  const th = mainThreat(w);
  const half = cr.stats.w / 2;
  let plan: Creature['brain']['plan'] = 'guard';
  let tx = gc.x,
    reach: { x: number; y: number; body: number } | null = null;
  if (w.level!.def.goal.type === 'hug') {
    plan = 'hug';
    tx = gc.x;
    reach = { x: gc.x, y: gc.y, body: -1 };
  } else if (th) {
    const side = Math.sign(th.x - gc.x) || 1;
    const dist = F.hypot(th.x - gc.x, th.y - gc.y) - th.r - (th.hw ?? 0);
    const approach = F.hypot(th.x - th.sx, th.y - th.sy) / WORLD.dt;
    const soon = dist < senseRange(cr) + BRAIN.interceptExtra || dist < approach * BRAIN.predict;
    if (th.data.pusher) {
      // brace (walls, boulders): get between it and him, plant the feet and lean into it
      const face = th.x - side * (th.hw ?? th.r);
      const near = Math.abs(face - gc.x) < BRAIN.braceDist + cr.stats.w;
      plan = near || soon ? 'brace' : 'guard';
      tx = plan === 'brace' ? face - side * Math.max(4, half * 0.4) + side * BRAIN.bracePush : gc.x + side * (half + BRAIN.guardGap);
      // a boulder is met close in front of him, not chased up its slope
      if (plan === 'brace' && !th.hw) tx = side > 0 ? Math.min(tx, gc.x + half + BRAIN.braceMeet) : Math.max(tx, gc.x - half - BRAIN.braceMeet);
      if (plan === 'brace') reach = th.hw ? { x: face, y: Math.min(gc.y - 20, c.y), body: th.id } : { x: th.x, y: th.y, body: th.id };
    } else if (soon) {
      plan = 'intercept';
      tx = gc.x + side * (half + BRAIN.guardGap);
      // spring arms punch (design §8): a puncher keeps the threat one punch away, on his side of it
      let punch = 0;
      for (const l of cr.limbs) if (!l.foot && l.spring >= 0) punch = Math.max(punch, l.len);
      if (punch) tx = th.x - side * punch * BRAIN.punchStand;
      // hands go for where it will be, not where it was
      reach = { x: th.x + (th.x - th.sx) / WORLD.dt * BRAIN.lead, y: th.y + (th.y - th.sy) / WORLD.dt * BRAIN.lead, body: th.id };
    } else tx = gc.x + side * (half + BRAIN.guardGap);
  }
  // other creatures already guard that side: stand a little further out
  tx = Math.max(10, Math.min(WORLD.W - 10, tx));
  const changed = plan !== b.plan || (reach?.body ?? -2) !== b.targetBody;
  b.plan = plan;
  b.targetX = tx;
  b.hasReach = reach !== null;
  b.targetBody = reach?.body ?? -1;
  if (reach) {
    b.reachX = reach.x;
    b.reachY = reach.y;
  }
  if (changed) {
    b.actAt = Math.max(w.t + BRAIN.eyeLead + ACT.anticipation, cr.bornAt + 0.35);
    b.intentAt = w.t;
    b.intentX = reach ? reach.x : tx;
    b.intentY = reach ? reach.y : gc.y;
    f.saccade = 1;
    if (plan !== 'guard') f.surprise = Math.max(f.surprise, BRAIN.notice);
  }
}

/** Is the creature blinking right now? (includes the birth double blink) */
export function isBlinking(w: World, cr: Creature): boolean {
  const age = w.t - cr.bornAt;
  if (cr.face.doubleBlink) return (age > 0.55 && age < 0.64) || (age > 0.76 && age < 0.85);
  return cr.face.blinkT > 0;
}
