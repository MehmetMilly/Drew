// Hazards (physics.md §10): boulders, bombs, crusher walls and the ninja. Each is a
// world Body with a kind; this module runs their motors, fuses and scripts each
// substep and builds them from level entities. Pure and deterministic.
//
// The rule every hazard follows: threats beat passive geometry; creatures win by
// acting. Pushers (walls, boulders) shove whatever lies still in their way and are
// held only by creatures that brace (feet planted, pushing back). The ninja cuts
// through still ink and is stopped only by being caught, thrown, punched or knocked.
import * as F from './fmath';
import { ACT, BODY, HAZ, WORLD } from '../tuning';
import { CT, PF } from './store';
import type { Body, World } from './world';
import type { Creature, Limb } from './creature';
import { grab } from './actuators';

export type Entity =
  | { type: 'boulder'; x: number; y: number; r?: number; m?: number; vx?: number; at?: number }
  | { type: 'bomb'; x: number; y: number; vx?: number; vy?: number; at?: number; fuse?: number }
  | { type: 'crusher'; x: number; y: number; h: number; w?: number; dir: 1 | -1; at?: number; speed?: number; force?: number; teeth?: boolean }
  | { type: 'ninja'; x: number; y: number; tx: number; ty: number; at: number; apex?: number };

/** Ninja script states. */
export const NINJA = { CROUCH: 0, LEAP: 1, DASH: 2, DIZZY: 3 } as const;

/** Create the body for a level entity. `at` is the level time it wakes up. */
export function spawnEntity(w: World, e: Entity): Body {
  switch (e.type) {
    case 'boulder':
      return w.addBody({ kind: 'boulder', x: e.x, y: e.y, r: e.r ?? HAZ.boulderR, m: e.m ?? HAZ.boulderMass, restitution: 0.05, friction: HAZ.boulderFriction, data: { vx: e.vx ?? 0, threat: 1, pusher: 1, sleep: e.at ?? 0 } });
    case 'bomb':
      return w.addBody({ kind: 'bomb', x: e.x, y: e.y, r: HAZ.bombR, m: HAZ.bombMass, restitution: HAZ.bombBounce, friction: 0.8, grabbable: true, data: { vx: e.vx ?? 0, vy: e.vy ?? 0, threat: 1, sleep: e.at ?? 0, fuse: e.fuse ?? HAZ.bombFuse } });
    case 'crusher':
      return w.addBody({ kind: 'crusher', x: e.x, y: e.y, r: 0, hw: (e.w ?? HAZ.crusherW) / 2, hh: e.h / 2, m: HAZ.crusherMass, data: { dir: e.dir, speed: e.speed ?? HAZ.crusherSpeed, force: e.force ?? HAZ.crusherForce, threat: 1, pusher: 1, sleep: e.at ?? 0, teeth: e.teeth === false ? 0 : 1, rail: e.y } });
    case 'ninja':
      return w.addBody({ kind: 'ninja', x: e.x, y: e.y, r: HAZ.ninjaR, m: HAZ.ninjaMass, restitution: 0.2, friction: 0.5, grabbable: true, data: { tx: e.tx, ty: e.ty, at: e.at, apex: e.apex ?? HAZ.ninjaApex, threat: 1, sleep: e.at, state: NINJA.CROUCH, leapAt: -9, stunUntil: 0, wasHeld: 0, stallT: 0 } });
  }
}

export const asleep = (w: World, b: Body) => (b.data.sleep ?? 0) > w.t;

/** Is the ninja attacking (in his leap or dash, free, not dizzy)? While attacking his
 *  blade cuts and still ink does not stop him. */
export const attacking = (b: Body) => b.kind === 'ninja' && b.held < 0 && (b.data.state === NINJA.LEAP || b.data.state === NINJA.DASH);

/** Per substep, before integration: motors, scripts, bracing, strikes. */
export function preHazards(w: World, h: number) {
  for (const b of w.bodies) {
    if (!b.alive) continue;
    if (asleep(w, b)) {
      b.px = b.x;
      b.py = b.y;
      continue;
    }
    // first awake substep: launch with the entity's starting velocity
    if (!b.data.woke) {
      b.data.woke = 1;
      b.px = b.x - (b.data.vx ?? 0) * h;
      b.py = b.y - (b.data.vy ?? 0) * h;
    }
    if (b.kind === 'crusher') {
      // a motor with limited force: bracing creatures push back on it (physics.md §10)
      const v = (b.x - b.px) / h;
      const want = b.data.dir * b.data.speed;
      const lim = b.data.force / b.m;
      let a = Math.max(-lim, Math.min(lim, (want - v) / h));
      const brace = braceOn(w, b);
      const hold = brace / b.m;
      if (hold > 0) {
        a -= b.data.dir * hold;
        // a braced wall can be held and eased back, not hurled
        const vn = v + a * h;
        if (b.data.dir * vn < -HAZ.crusherBack) a = (-b.data.dir * HAZ.crusherBack - v) / h;
      }
      // stalled by ink that is not bracing it (the motor still out-pushes the bracers): the
      // saw teeth bite through what they press on
      b.data.sawing = b.data.teeth && b.data.dir * v < b.data.speed * HAZ.sawStall && brace < b.data.force ? 1 : 0;
      b.px = b.x - (v + a * h) * h;
      b.py = b.y;
    } else if (b.kind === 'boulder') {
      // bracers take the boulder's momentum out along the line from it to them
      brakeBoulder(w, b, h);
    } else if (b.kind === 'ninja') {
      ninjaScript(w, b, h);
    }
  }
}

/** Per step, after the solve: fuses, rolling angle, the ninja's blade, out-of-page cleanup. */
export function postHazards(w: World) {
  for (const b of w.bodies) {
    if (!b.alive || asleep(w, b)) continue;
    if (b.r > 0 && b.data.grounded) b.angle += (b.x - b.sx) / b.r;
    if (b.kind === 'ninja') ninjaStep(w, b);
    if (b.kind === 'crusher' && b.data.sawing) saw(w, b);
    if (b.kind === 'boulder' && b.data.grinding) grind(w, b);
    b.data.grounded = 0;
    if (b.kind === 'bomb') {
      b.data.fuse -= WORLD.dt;
      if (b.data.fuse <= 0) explode(w, b);
    }
  }
}

// ------------------------------------------------------------------ bracing

/** Creatures bracing against pusher `b` right now: in the brace plan for it, touching it,
 *  with a foot on the ground. */
function bracers(w: World, b: Body): Creature[] {
  const P = w.P;
  const out: Creature[] = [];
  const reach = BODY.radius + HAZ.braceContact;
  for (const cr of w.creatures) {
    if (!cr.alive || cr.brain.plan !== 'brace' || cr.brain.targetBody !== b.id || w.t < cr.brain.actAt) continue;
    if (!cr.limbs.some((l) => l.foot && P.flags[l.tip] & PF.GROUND)) continue;
    let touch = false;
    for (const i of cr.ids) {
      if (b.hw) {
        if (Math.abs(P.x[i] - b.x) < b.hw + reach && Math.abs(P.y[i] - b.y) < b.hh! + reach) touch = true;
      } else if (F.hypot(P.x[i] - b.x, P.y[i] - b.y) < b.r + reach) touch = true;
      if (touch) break;
    }
    if (touch) out.push(cr);
  }
  return out;
}

/** How hard a creature can brace: strength (square-cube) × how well its feet spread the load. */
export function braceForce(cr: Creature): number {
  const feet = cr.limbs.filter((l) => l.foot).length;
  if (!feet) return 0;
  return ACT.braceForce * cr.stats.strength * Math.min(ACT.braceFeetMax, ACT.braceFeetBase + ACT.braceFeetEach * feet);
}

/** Total brace force on pusher `b` this substep (mass × px/s²). */
function braceOn(w: World, b: Body): number {
  let f = 0;
  for (const cr of bracers(w, b)) f += braceForce(cr);
  if (f > 0) b.data.braced = w.t;
  return f;
}

function brakeBoulder(w: World, b: Body, h: number) {
  const crs = bracers(w, b);
  // held up by ink that is not bracing it: its weight grinds through what it presses on
  b.data.grinding = !crs.length && F.hypot(b.x - b.px, b.y - b.py) / h < HAZ.grindStall ? 1 : 0;
  if (!crs.length) return;
  const vx = (b.x - b.px) / h,
    vy = (b.y - b.py) / h;
  for (const cr of crs) {
    const c = w.centroid(cr);
    const dx = c.x - b.x,
      dy = c.y - b.y;
    const d = F.hypot(dx, dy) || 1;
    const ux = dx / d,
      uy = dy / d;
    const vin = vx * ux + vy * uy; // speed toward the bracer
    if (vin <= 0) continue;
    const dv = Math.min(vin, (braceForce(cr) / b.m) * h);
    b.px += ux * dv * h;
    b.py += uy * dv * h;
    b.data.braced = w.t;
  }
}

/** A stalled saw-toothed wall cuts every link with an end in its teeth (its leading face). */
function saw(w: World, b: Body) {
  const P = w.P,
    C = w.C;
  const face = b.x + b.data.dir * b.hw!;
  const inTeeth = (i: number) => Math.abs(P.x[i] - face) < HAZ.sawReach && Math.abs(P.y[i] - b.y) < b.hh! + BODY.radius;
  for (let c = 0; c < C.n; c++) {
    if (C.dead[c] || C.type[c] === CT.BEND) continue;
    const a = C.a[c],
      e = C.b[c];
    if (P.flags[a] & PF.GUY) continue;
    if (inTeeth(a) || inTeeth(e)) w.cut(c, 'saw');
  }
}

/** A stalled boulder grinds the ink it presses on: the links nearest its centre, a few each step. */
function grind(w: World, b: Body) {
  const P = w.P,
    C = w.C;
  const R = b.r + BODY.radius + HAZ.grindReach;
  for (let k = 0; k < HAZ.grindRate; k++) {
    let best = -1,
      bd = R * R;
    for (let c = 0; c < C.n; c++) {
      if (C.dead[c] || C.type[c] === CT.BEND) continue;
      const a = C.a[c],
        e = C.b[c];
      if (P.flags[a] & PF.GUY) continue;
      const d = Math.min((P.x[a] - b.x) ** 2 + (P.y[a] - b.y) ** 2, (P.x[e] - b.x) ** 2 + (P.y[e] - b.y) ** 2);
      if (d < bd) (bd = d), (best = c);
    }
    if (best < 0) return;
    w.cut(best, 'grind');
  }
}

// ------------------------------------------------------------------ the ninja

function leap(w: World, b: Body, tx: number, ty: number, apex: number, h: number) {
  const g = w.gravity;
  const up = Math.max(10, b.y - (Math.min(b.y, ty) - apex));
  const vy = -Math.sqrt(2 * g * up);
  const down = ty - (b.y - up);
  const tFlight = -vy / g + Math.sqrt((2 * Math.max(1, down)) / g);
  const vx = (tx - b.x) / tFlight;
  b.px = b.x - vx * h;
  b.py = b.y - vy * h;
  b.data.state = NINJA.LEAP;
  b.data.leapAt = w.t;
  w.emit({ type: 'ninjaLeap', x: b.x, y: b.y });
}

/** Ink that is acting on him: hands (and the lump fists on them) and springs firing. */
function strikers(w: World, cr: Creature): number[] {
  const out: number[] = [];
  const P = w.P;
  for (const l of cr.limbs) {
    if (l.foot) continue;
    out.push(...l.chain);
    if (P.flags[l.tip] & PF.LUMPC) {
      const lump = cr.lumps.find((u) => u.centre === l.tip);
      if (lump) out.push(...lump.ring);
    }
  }
  for (const s of cr.springs) if (s.state === 'extend') out.push(s.b, ...s.distal);
  return out;
}

/** A hand or a punch that meets him moving fast knocks him away and leaves him dizzy. */
function checkStrike(w: World, b: Body, h: number) {
  const P = w.P;
  const reach = b.r + BODY.radius + HAZ.strikeSlop;
  let best = 0,
    bx = 0,
    by = 0,
    who = -1;
  for (const cr of w.creatures) {
    if (!cr.alive || w.t < cr.brain.actAt) continue;
    const c = w.centroid(cr);
    if (F.hypot(c.x - b.x, c.y - b.y) > cr.stats.size + reach + 40) continue;
    for (const i of strikers(w, cr)) {
      const dx = b.x - P.x[i],
        dy = b.y - P.y[i];
      const d = F.hypot(dx, dy);
      if (d > reach || d < 1e-6) continue;
      const vx = (P.x[i] - P.px[i]) / h,
        vy = (P.y[i] - P.py[i]) / h;
      const toward = (vx * dx + vy * dy) / d;
      if (toward > best) (best = toward), (bx = vx), (by = vy), (who = cr.id);
    }
  }
  if (best < HAZ.strikeSpeed) return;
  const sp = F.hypot(bx, by) || 1;
  const kx = (bx / sp) * HAZ.ninjaKnock,
    ky = Math.min(0, (by / sp) * HAZ.ninjaKnock) - HAZ.ninjaKnockUp;
  b.px = b.x - kx * h;
  b.py = b.y - ky * h;
  b.data.state = NINJA.DIZZY;
  b.data.stunUntil = w.t + HAZ.ninjaStun;
  w.emit({ type: 'knock', cr: who, x: b.x, y: b.y, v: best });
}

/** The ninja's script, per substep: crouch → leap → dash (vaulting what blocks him), dizzy
 *  after a hit or a throw. */
function ninjaScript(w: World, b: Body, h: number) {
  const s = b.data.state;
  if (b.held >= 0) {
    b.data.wasHeld = 1;
    return;
  }
  if (b.data.wasHeld) {
    // just thrown: he tumbles through the air and lands dizzy
    b.data.wasHeld = 0;
    b.data.state = NINJA.DIZZY;
    b.data.stunUntil = w.t + HAZ.ninjaThrownStun;
    return;
  }
  if (s === NINJA.CROUCH) {
    // telegraph (crouch) then leap on an arc through the apex onto the target
    if (w.t >= b.data.at + HAZ.ninjaTell) leap(w, b, b.data.tx, b.data.ty, b.data.apex, h);
    else {
      b.px = b.x;
      b.py = b.y;
    }
    return;
  }
  if (s === NINJA.LEAP || s === NINJA.DASH) checkStrike(w, b, h);
  if (b.data.state === NINJA.DASH && w.guy?.alive) {
    // dash along the ground at him (a leap that missed is not the end of it)
    const dir = Math.sign(w.P.x[w.guy.hip] - b.x) || 1;
    const v = (b.x - b.px) / h;
    b.px = b.x - (v + (dir * HAZ.ninjaRun - v) * HAZ.ninjaRunGain) * h;
  }
}

/** Per step: land, vault, recover, and cut. */
function ninjaStep(w: World, b: Body) {
  const s = b.data.state;
  if (b.held >= 0) return;
  if (s === NINJA.LEAP && b.data.grounded && w.t > b.data.leapAt + 0.25) b.data.state = NINJA.DASH;
  if (s === NINJA.DIZZY && b.data.grounded && w.t >= b.data.stunUntil) {
    b.data.state = NINJA.DASH;
    b.data.stallT = 0;
  }
  if (b.data.state === NINJA.DASH && w.guy?.alive) {
    const g = w.guy;
    const gx = w.P.x[g.hip],
      gy = w.P.y[g.hip];
    const dir = Math.sign(gx - b.x) || 1;
    // stalled against something: the ground in his way, or a page edge
    b.data.stallT = Math.abs(b.x - b.sx) < HAZ.ninjaRun * WORLD.dt * 0.25 ? b.data.stallT + WORLD.dt : 0;
    const wallAhead = w.terrainDepth(b.x + dir * (b.r + HAZ.ninjaLook), b.y - 4, 4) > 0;
    const above = b.y - gy > HAZ.ninjaVaultRise && Math.abs(gx - b.x) < HAZ.ninjaVaultRange;
    if (b.data.grounded && w.t > b.data.leapAt + HAZ.ninjaVaultCool && (wallAhead || above || b.data.stallT > 0.25)) {
      // vault: leap at where he stands now, clearing whatever is between
      leap(w, b, gx, gy, HAZ.ninjaVault, WORLD.dt / WORLD.substeps);
      b.data.stallT = 0;
    }
  }
  if (attacking(b)) slash(w, b);
}

/** The ninja's blade: every link that passes within reach of him is cut while he attacks
 *  (ink is not armour, and a dense scribble is no thicker to a blade). A hand that closes on
 *  him first catches him instead. */
function slash(w: World, b: Body) {
  const P = w.P,
    C = w.C;
  // the catch beats the blade
  for (const cr of w.creatures) {
    if (!cr.alive || cr.brain.targetBody !== b.id || w.t < cr.brain.actAt) continue;
    for (const l of cr.limbs as Limb[]) {
      if (l.foot || l.spring >= 0 || l.grabBody >= 0 || w.t - (b.data.thrownAt ?? -9) <= ACT.regrab) continue;
      if (F.hypot(P.x[l.tip] - b.x, P.y[l.tip] - b.y) < b.r + ACT.grabSlop) {
        grab(w, cr, l, b);
        return;
      }
    }
  }
  const R = b.r + HAZ.ninjaCut;
  for (let c = 0; c < C.n; c++) {
    if (C.dead[c] || C.type[c] === CT.BEND) continue;
    const a = C.a[c],
      e = C.b[c];
    if (P.flags[a] & PF.GUY) continue;
    // distance from his centre to the link segment
    const ax = P.x[a],
      ay = P.y[a];
    const sx = P.x[e] - ax,
      sy = P.y[e] - ay;
    const L2 = sx * sx + sy * sy;
    let t = L2 > 0 ? ((b.x - ax) * sx + (b.y - ay) * sy) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + sx * t - b.x,
      qy = ay + sy * t - b.y;
    if (qx * qx + qy * qy < R * R) w.cut(c, 'slash');
  }
}

// ------------------------------------------------------------------ bombs

/** Bomb blast: outward impulse falling off over HAZ.blastRadius, links cut close by. */
export function explode(w: World, b: Body) {
  b.alive = false;
  if (b.held >= 0) b.held = -1;
  const P = w.P,
    C = w.C;
  const R = HAZ.blastRadius;
  const h = WORLD.dt / WORLD.substeps;
  for (let i = 0; i < P.n; i++) {
    if (!(P.flags[i] & PF.ALIVE)) continue;
    const dx = P.x[i] - b.x,
      dy = P.y[i] - b.y;
    const d = F.hypot(dx, dy) || 1;
    if (d > R) continue;
    const s = (HAZ.blastSpeed * (1 - d / R)) / d;
    P.px[i] -= dx * s * h;
    P.py[i] -= dy * s * h;
  }
  for (const o of w.bodies) {
    if (!o.alive || o === b || o.kind === 'crusher') continue;
    const dx = o.x - b.x,
      dy = o.y - b.y;
    const d = F.hypot(dx, dy) || 1;
    if (d > R) continue;
    const s = ((HAZ.blastSpeed * 0.5 * (1 - d / R)) / d) * Math.min(1, 10 / o.m);
    o.px -= dx * s * h;
    o.py -= dy * s * h;
  }
  // links right at the blast are cut
  for (let c = 0; c < C.n; c++) {
    if (C.dead[c]) continue;
    const a = C.a[c],
      e = C.b[c];
    if (P.flags[a] & PF.GUY) continue;
    const mx = (P.x[a] + P.x[e]) / 2 - b.x,
      my = (P.y[a] + P.y[e]) / 2 - b.y;
    if (mx * mx + my * my < HAZ.blastCut * HAZ.blastCut) w.cut(c, 'blast');
  }
  w.emit({ type: 'boom', x: b.x, y: b.y });
}
