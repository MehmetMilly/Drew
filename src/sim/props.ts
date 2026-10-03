// Chapter 3 props (physics.md §8, §10): wind regions, cracked floors that break above an
// impact, rope bridges that snap above a load, and see-saws (a hinged plank). They are
// part of the world, not threats: felt-tip, never red. Pure and deterministic.
//
// Floors and bridges are terrain slabs that can break, so everything that walks on
// ground walks on them. The see-saw is its own rigid plank, solved against particles
// in the constraint loop, and grounds what stands on it.
import * as F from './fmath';
import { BODY, PROP, WATER, WORLD } from '../tuning';
import { killGuy } from './littleguy';
import { PF } from './store';
import type { Pt } from './geom';
import type { Terrain, World } from './world';

export type Prop =
  /** wind blowing along +x (force < 0: along −x) inside a box, from `at` on */
  | { type: 'wind'; x0: number; y0: number; x1: number; y1: number; force: number; at?: number }
  /** a floor slab [x0, x1] with its top at y that breaks when something lands hard enough */
  | { type: 'crack'; x0: number; x1: number; y: number; h?: number; impulse: number }
  /** a plank bridge [x0, x1] at y that snaps when the weight on it passes `load` */
  | { type: 'bridge'; x0: number; x1: number; y: number; load: number }
  /** a see-saw: a plank of half-length `len` on a pivot at (x, y) */
  | { type: 'seesaw'; x: number; y: number; len: number; tilt?: number }
  /** water across [x0, x1] with its surface at y, rising `rise` px/s from `at` up to `top`,
   *  flowing at `current` px/s (+ = right) */
  | { type: 'water'; x0: number; x1: number; y: number; rise?: number; at?: number; top?: number; current?: number };

export interface Slab {
  prop: Extract<Prop, { type: 'crack' | 'bridge' }>;
  terrain: Terrain;
  load: number; // this step: mass resting on it (bridges) or impact (cracks)
  peak: number; // highest so far, as a share of its limit (for the sag / crack drawing)
  brokeAt: number; // level time it broke, -1
}

export interface Plank {
  x: number; // pivot
  y: number;
  len: number; // half-length
  th: number; // angle (rad, + = right end down)
  pth: number; // angle last substep
  tilt: number; // the most it tips before an end meets the ground
}

export interface PropState {
  defs: Prop[];
  slabs: Slab[];
  planks: Plank[];
  vy: Float32Array; // each particle's vertical speed last step (landing impacts)
  pools: Pool[];
  lift: Float32Array; // per particle: extra buoyancy from the loop it belongs to (this step)
  underT: number; // s Little Guy's head has been under water
}

export interface Pool {
  prop: Extract<Prop, { type: 'water' }>;
  y: number; // the surface now
}

export function startProps(w: World, defs: Prop[]): PropState {
  const S: PropState = { defs, slabs: [], planks: [], vy: new Float32Array(w.P.cap), pools: [], lift: new Float32Array(w.P.cap), underT: 0 };
  for (const p of defs) {
    if (p.type === 'crack' || p.type === 'bridge') {
      const h = p.type === 'crack' ? (p.h ?? PROP.crackH) : PROP.bridgeH;
      const pts: Pt[] = [
        { x: p.x0, y: p.y },
        { x: p.x1, y: p.y },
        { x: p.x1, y: p.y + h },
        { x: p.x0, y: p.y + h },
      ];
      w.addTerrain(pts, 1, p.type);
      S.slabs.push({ prop: p, terrain: w.terrain[w.terrain.length - 1], load: 0, peak: 0, brokeAt: -1 });
    } else if (p.type === 'water') {
      S.pools.push({ prop: p, y: p.y });
    } else if (p.type === 'seesaw') {
      const tilt = p.tilt ?? PROP.seesawTilt;
      S.planks.push({ x: p.x, y: p.y, len: p.len, th: -tilt, pth: -tilt, tilt });
    }
  }
  return S;
}

/** Per substep, before integration: wind pushes every particle (lumps resist through mass). */
export function windForces(w: World, S: PropState, h: number) {
  const P = w.P;
  for (const p of S.defs) {
    if (p.type !== 'wind' || w.t < (p.at ?? 0)) continue;
    // it gusts: never still, never constant
    const gust = 1 - PROP.gust * (0.5 + 0.5 * F.sin(w.t * 2.3 + F.sin(w.t * 0.7) * 2));
    const a = p.force * gust * h * h;
    // Little Guy sheltered: ink just upwind of him at his height takes the wind for him, and
    // riding he hunkers down and holds on
    const g = w.guy;
    let shelter = 1;
    if (g?.alive) {
      const gx = P.x[g.chest],
        gy = P.y[g.chest];
      const dir = Math.sign(p.force);
      for (const cr of w.creatures) {
        if (!cr.alive || shelter < 1) continue;
        for (const i of cr.ids) {
          const up = (gx - P.x[i]) * dir;
          if (up > 0 && up < PROP.shadeLen && Math.abs(P.y[i] - gy) < PROP.shadeH) {
            shelter = PROP.shade;
            break;
          }
        }
      }
      if (g.ride >= 0 || g.heldBy >= 0) shelter = Math.min(shelter, PROP.riderWind);
    }
    for (let i = 0; i < P.n; i++) {
      if (!(P.flags[i] & PF.ALIVE)) continue;
      const x = P.x[i],
        y = P.y[i];
      if (x < p.x0 || x > p.x1 || y < p.y0 || y > p.y1) continue;
      P.x[i] += a * P.im[i] * (P.flags[i] & PF.GUY ? shelter : 1);
    }
    for (const b of w.bodies) {
      if (!b.alive || b.held >= 0 || b.hw || b.x < p.x0 || b.x > p.x1 || b.y < p.y0 || b.y > p.y1) continue;
      b.x += (a * PROP.windBody) / b.m;
    }
  }
}

/** Per substep: the see-saw planks swing (Verlet on the angle, stops at the ground). */
export function swingPlanks(S: PropState) {
  for (const k of S.planks) {
    const v = (k.th - k.pth) * PROP.seesawDamp;
    k.pth = k.th;
    k.th += v;
    if (k.th > k.tilt) (k.th = k.tilt), (k.pth = k.tilt);
    if (k.th < -k.tilt) (k.th = -k.tilt), (k.pth = -k.tilt);
  }
}

/** In the constraint loop: particles against the planks. A push on the plank turns it about
 *  its pivot by its share (inverse inertia), so a heavy drop on one end flings the other. */
export function collidePlanks(w: World, S: PropState) {
  if (!S.planks.length) return;
  const P = w.P;
  const R = BODY.radius + PROP.plankHalf;
  for (const k of S.planks) {
    const I = (PROP.plankMass * k.len * k.len) / 3;
    const c = F.cos(k.th),
      s = F.sin(k.th);
    for (let i = 0; i < P.n; i++) {
      if (!(P.flags[i] & PF.ALIVE)) continue;
      const dx = P.x[i] - k.x,
        dy = P.y[i] - k.y;
      if (dx * dx + dy * dy > (k.len + R) * (k.len + R)) continue;
      // along the plank (u) and across it (v, + = below)
      const u = Math.max(-k.len, Math.min(k.len, dx * c + dy * s));
      const qx = k.x + u * c,
        qy = k.y + u * s;
      let nx = P.x[i] - qx,
        ny = P.y[i] - qy;
      const d = F.hypot(nx, ny);
      if (d >= R) continue;
      if (d < 1e-6) (nx = s), (ny = -c);
      else (nx /= d), (ny /= d);
      const depth = R - d;
      // lever: the contact point's motion per unit of turn, along the normal
      const rx = qx - k.x,
        ry = qy - k.y;
      const lever = -ry * nx + rx * ny;
      const wk = (lever * lever) / I;
      const wp = P.im[i];
      const ws = wp + wk;
      if (ws <= 0) continue;
      P.x[i] += nx * depth * (wp / ws);
      P.y[i] += ny * depth * (wp / ws);
      k.th -= (depth * lever) / I / ws;
      if (ny < -0.5) {
        P.flags[i] |= PF.GROUND;
        P.nx[i] = nx;
        P.ny[i] = ny;
      }
    }
    if (k.th > k.tilt) k.th = k.tilt;
    if (k.th < -k.tilt) k.th = -k.tilt;
  }
}

/** Per step, after the solve: weigh what rests on each slab and break what is overdone. */
export function stepProps(w: World, S: PropState) {
  const P = w.P;
  const r = BODY.radius;
  for (const sl of S.slabs) {
    if (sl.brokeAt >= 0) continue;
    const T = sl.terrain;
    const top = T.minY;
    let load = 0,
      hit = 0;
    for (let i = 0; i < P.n; i++) {
      if (!(P.flags[i] & PF.ALIVE)) continue;
      if (P.x[i] < T.minX - 2 || P.x[i] > T.maxX + 2 || P.y[i] < top - r - PROP.touch || P.y[i] > top + 2) continue;
      load += P.m[i];
      // a landing: it was coming down fast last step and has stopped on the slab
      const vy = (P.y[i] - P.sy[i]) / WORLD.dt;
      if (S.vy[i] > vy + PROP.landMin) hit += P.m[i] * (S.vy[i] - vy);
    }
    for (const b of w.bodies) {
      if (!b.alive || b.hw || b.x < T.minX || b.x > T.maxX || Math.abs(b.y + b.r - top) > PROP.touch + 2) continue;
      load += b.m;
    }
    const p = sl.prop;
    sl.load = p.type === 'bridge' ? load : hit;
    const limit = p.type === 'bridge' ? p.load : p.impulse;
    sl.peak = Math.max(sl.peak * PROP.peakFade, sl.load / limit);
    if (sl.load > limit) breakSlab(w, sl);
  }
  for (let i = 0; i < P.n; i++) S.vy[i] = (P.y[i] - P.sy[i]) / WORLD.dt;
}

function breakSlab(w: World, sl: Slab) {
  const T = sl.terrain;
  sl.brokeAt = w.t;
  T.broken = true;
  // the pieces fall away (felt chunks, not threats)
  const n = Math.max(2, Math.round((T.maxX - T.minX) / PROP.chunk));
  for (let k = 0; k < n; k++) {
    const x = T.minX + ((k + 0.5) * (T.maxX - T.minX)) / n;
    w.addBody({ kind: 'chunk', x, y: T.minY + 8, r: Math.min(PROP.chunk / 2, (T.maxY - T.minY) / 2 + 2), m: 2, restitution: 0.2, friction: 0.5, data: { vx: (x - (T.minX + T.maxX) / 2) * 0.6, vy: 40 + k * 7, spin: (k % 2 ? 1 : -1) * 0.2 } });
  }
  w.emit({ type: sl.prop.type === 'bridge' ? 'snap' : 'crack', x: (T.minX + T.maxX) / 2, y: T.minY });
}

// ------------------------------------------------------------------ water (physics.md §8)

/** The surface of the water at x (pools don't overlap), or Infinity where there is none. */
export function surfaceAt(S: PropState, x: number): number {
  for (const q of S.pools) if (x >= q.prop.x0 && x <= q.prop.x1) return q.y;
  return Infinity;
}

/** Per substep, before integration: buoyancy (ink floats a little short of its weight, loops
 *  float it by their area, lumps sink through mass, Little Guy can't swim), drag, the current,
 *  and paddling: a creature in the water that wants to go somewhere swims there. */
export function waterForces(w: World, S: PropState, h: number) {
  if (!S.pools.length) return;
  const P = w.P;
  const g = w.guy;
  for (const q of S.pools) {
    const p = q.prop;
    const cur = p.current ?? 0;
    for (let i = 0; i < P.n; i++) {
      if (!(P.flags[i] & PF.ALIVE)) continue;
      const x = P.x[i],
        y = P.y[i];
      if (x < p.x0 || x > p.x1 || y < q.y) continue;
      const depth = Math.min(1, (y - q.y) / WATER.full);
      const up = (P.flags[i] & PF.GUY ? WATER.guyBuoy : WATER.buoy + S.lift[i]) * depth;
      P.y[i] -= up * P.im[i] * h * h;
      const vx = (P.x[i] - P.px[i]) / h,
        vy = (P.y[i] - P.py[i]) / h;
      const k = Math.min(1, WATER.drag * h * depth);
      P.px[i] = P.x[i] - (vx + (cur - vx) * k) * h;
      P.py[i] = P.y[i] - vy * (1 - k) * h;
    }
    for (const b of w.bodies) {
      if (!b.alive || b.held >= 0 || b.hw || b.x < p.x0 || b.x > p.x1 || b.y + b.r < q.y) continue;
      const depth = Math.min(1, (b.y + b.r - q.y) / (2 * b.r));
      if (b.data.floats) b.y -= WATER.floatAccel * depth * h * h;
      const vx = (b.x - b.px) / h,
        vy = (b.y - b.py) / h;
      const k = Math.min(1, WATER.drag * h * depth);
      b.px = b.x - (vx + (cur - vx) * k) * h;
      b.py = b.y - vy * (1 - k) * h;
    }
  }
  // paddling: limbs churning in the water push the body the way it wants to go
  for (const cr of w.creatures) {
    if (!cr.alive || cr.brain.mode !== 'walk' || w.t < cr.brain.actAt) continue;
    let wet = 0;
    for (const i of cr.ids) if (P.y[i] > surfaceAt(S, P.x[i])) wet++;
    if (wet < cr.ids.length * WATER.swimWet) continue;
    const limbs = cr.limbs.length + cr.springs.length;
    const want = cr.brain.dir * WATER.swim * Math.min(1, WATER.swimBase + limbs * WATER.swimLimb);
    for (const i of cr.ids) {
      if (P.y[i] <= surfaceAt(S, P.x[i])) continue;
      const vx = (P.x[i] - P.px[i]) / h;
      P.px[i] = P.x[i] - (vx + (want - vx) * WATER.swimGain) * h;
    }
  }
  void g;
}

/** Per step: the tide rises, loops are weighed for their lift, and Little Guy drowns after a
 *  second with his head under. */
export function stepWater(w: World, S: PropState) {
  if (!S.pools.length) return;
  for (const q of S.pools) {
    const p = q.prop;
    if (p.rise && w.t >= (p.at ?? 0)) q.y = Math.max(p.top ?? -Infinity, q.y - p.rise * WORLD.dt);
  }
  S.lift.fill(0);
  for (const cr of w.creatures) {
    if (!cr.alive) continue;
    for (const L of cr.loops) {
      if (!L.ring.length) continue;
      const each = (WATER.loopBuoy * L.area) / L.ring.length;
      for (const i of L.ring) S.lift[i] = Math.min(WATER.loopMax, S.lift[i] + each);
    }
  }
  const g = w.guy;
  if (!g?.alive || !w.level || w.level.result !== 'play') return;
  const P = w.P;
  S.underT = P.y[g.head] > surfaceAt(S, P.x[g.head]) ? S.underT + WORLD.dt : 0;
  if (S.underT > WATER.drown) killGuy(w, g, 'drowned');
}
