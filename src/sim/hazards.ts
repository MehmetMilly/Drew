// Hazards (physics.md §10): boulders, bombs, crusher walls and the ninja. Each is a
// world Body with a kind; this module runs their motors, fuses and scripts each
// substep and builds them from level entities. Pure and deterministic.
import * as F from './fmath';
import { HAZ, WORLD } from '../tuning';
import { PF } from './store';
import type { Body, World } from './world';

export type Entity =
  | { type: 'boulder'; x: number; y: number; r?: number; vx?: number; at?: number }
  | { type: 'bomb'; x: number; y: number; vx?: number; vy?: number; at?: number; fuse?: number }
  | { type: 'crusher'; x: number; y: number; h: number; w?: number; dir: 1 | -1; at?: number; speed?: number; force?: number; teeth?: boolean }
  | { type: 'ninja'; x: number; y: number; tx: number; ty: number; at: number; apex?: number };

/** Create the body for a level entity. `at` is the level time it wakes up. */
export function spawnEntity(w: World, e: Entity): Body {
  switch (e.type) {
    case 'boulder':
      return w.addBody({ kind: 'boulder', x: e.x, y: e.y, r: e.r ?? HAZ.boulderR, m: HAZ.boulderMass, restitution: 0.05, friction: 1, data: { vx: e.vx ?? 0, threat: 1, sleep: e.at ?? 0 } });
    case 'bomb':
      return w.addBody({ kind: 'bomb', x: e.x, y: e.y, r: HAZ.bombR, m: HAZ.bombMass, restitution: HAZ.bombBounce, friction: 0.8, grabbable: true, data: { vx: e.vx ?? 0, vy: e.vy ?? 0, threat: 1, sleep: e.at ?? 0, fuse: e.fuse ?? HAZ.bombFuse } });
    case 'crusher':
      return w.addBody({ kind: 'crusher', x: e.x, y: e.y, r: 0, hw: (e.w ?? HAZ.crusherW) / 2, hh: e.h / 2, m: HAZ.crusherMass, data: { dir: e.dir, speed: e.speed ?? HAZ.crusherSpeed, force: e.force ?? HAZ.crusherForce, threat: 1, sleep: e.at ?? 0, teeth: e.teeth === false ? 0 : 1, rail: e.y } });
    case 'ninja':
      return w.addBody({ kind: 'ninja', x: e.x, y: e.y, r: HAZ.ninjaR, m: HAZ.ninjaMass, restitution: 0.2, friction: 0.5, data: { tx: e.tx, ty: e.ty, at: e.at, apex: e.apex ?? HAZ.ninjaApex, threat: 1, sleep: e.at, state: 0 } });
  }
}

export const asleep = (w: World, b: Body) => (b.data.sleep ?? 0) > w.t;

/** Per substep, before integration: motors, scripts, rolling. */
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
      // a motor with limited force: ink can genuinely hold it (physics.md §10)
      const v = (b.x - b.px) / h;
      const want = b.data.dir * b.data.speed;
      const dv = Math.max(-b.data.force / b.m, Math.min(b.data.force / b.m, (want - v) / h)) * h;
      b.px = b.x - (v + dv) * h;
      b.py = b.y;
    } else if (b.kind === 'ninja' && b.data.state === 0) {
      // telegraph (crouch) then leap on an arc through the apex onto the target
      if (w.t >= b.data.at + HAZ.ninjaTell) {
        b.data.state = 1;
        const g = w.gravity;
        const up = Math.max(10, b.y - (Math.min(b.y, b.data.ty) - b.data.apex));
        const vy = -Math.sqrt(2 * g * up);
        const down = b.data.ty - (b.y - up);
        const tFlight = -vy / g + Math.sqrt((2 * Math.max(1, down)) / g);
        const vx = (b.data.tx - b.x) / tFlight;
        b.px = b.x - vx * h;
        b.py = b.y - vy * h;
        w.emit({ type: 'ninjaLeap', x: b.x, y: b.y });
      } else {
        b.px = b.x;
        b.py = b.y;
      }
    }
  }
}

/** Per step, after the solve: fuses, rolling angle, out-of-page cleanup. */
export function postHazards(w: World) {
  for (const b of w.bodies) {
    if (!b.alive || asleep(w, b)) continue;
    if (b.r > 0 && b.data.grounded) b.angle += (b.x - b.sx) / b.r;
    b.data.grounded = 0;
    if (b.kind === 'bomb') {
      b.data.fuse -= WORLD.dt;
      if (b.data.fuse <= 0) explode(w, b);
    }
  }
}

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
