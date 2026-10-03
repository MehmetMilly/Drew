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
import type { Body, Terrain, World } from './world';
import { strikers } from './hazards';
import { guyCentre } from './littleguy';

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
  | { type: 'water'; x0: number; x1: number; y: number; rise?: number; at?: number; top?: number; current?: number }
  /** a log raft of half-length `len` floating at (x, y): it carries what stands on it */
  | { type: 'raft'; x: number; y: number; len: number }
  /** a kraken tentacle rising from (x, y) under the water at `at`: it reaches for Little Guy,
   *  latches on and hauls him toward its root; a hard hit makes it let go and recoil */
  | { type: 'tentacle'; x: number; y: number; at: number; reach?: number };

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
  rafts: Raft[];
  tentacles: Tentacle[];
}

export interface Raft {
  x: number;
  y: number;
  px: number;
  py: number;
  len: number;
}

export interface Tentacle {
  prop: Extract<Prop, { type: 'tentacle' }>;
  body: Body; // the tip: a threat the brain sees (and hands can hit)
  mode: 'wait' | 'reach' | 'hold' | 'recoil';
  until: number; // recoil ends
  heldT: number; // s holding him
}

export interface Pool {
  prop: Extract<Prop, { type: 'water' }>;
  y: number; // the surface now
}

export function startProps(w: World, defs: Prop[]): PropState {
  const S: PropState = { defs, slabs: [], planks: [], vy: new Float32Array(w.P.cap), pools: [], lift: new Float32Array(w.P.cap), underT: 0, rafts: [], tentacles: [] };
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
    } else if (p.type === 'raft') {
      S.rafts.push({ x: p.x, y: p.y, px: p.x, py: p.y, len: p.len });
    } else if (p.type === 'tentacle') {
      const body = w.addBody({ kind: 'tentacle', x: p.x, y: p.y, r: PROP.tipR, m: 50, data: { threat: 1, sleep: p.at, ax: p.x, ay: p.y, kin: 1 } });
      S.tentacles.push({ prop: p, body, mode: 'wait', until: 0, heldT: 0 });
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

// ------------------------------------------------------------------ rafts

/** Per substep: a raft falls, floats on the water it is in, drifts with the current, and stops
 *  against the ground (a bank, the bottom). Past the end of the water it simply falls. */
export function floatRafts(w: World, S: PropState, h: number) {
  for (const r of S.rafts) {
    let vx = (r.x - r.px) / h,
      vy = (r.y - r.py) / h;
    vy += w.gravity * h;
    const surf = surfaceAt(S, r.x);
    if (r.y + PROP.raftHalf > surf) {
      const depth = Math.min(1, (r.y + PROP.raftHalf - surf) / (2 * PROP.raftHalf));
      vy -= WATER.floatAccel * depth * h;
      const pool = S.pools.find((q) => r.x >= q.prop.x0 && r.x <= q.prop.x1);
      const cur = pool?.prop.current ?? 0;
      const k = Math.min(1, WATER.drag * h * depth);
      vx += (cur - vx) * k;
      vy *= 1 - k;
    }
    r.px = r.x;
    r.py = r.y;
    r.x += vx * h;
    r.y += vy * h;
    // the ground under or beside it (a bank, the riverbed)
    for (const ex of [-r.len, 0, r.len]) {
      const d = w.terrainDepth(r.x + ex, r.y, PROP.raftHalf);
      if (d > 0) {
        r.y -= d;
        if (r.py > r.y) r.py = r.y;
        // a bank beside it stops it
        if (ex !== 0 && w.terrainDepth(r.x + ex, r.y - 2, PROP.raftHalf) > 0) r.x = r.px;
      }
    }
  }
}

/** In the constraint loop: particles against rafts. A raft is heavy, so most of the push goes
 *  to the particle; what stands on it is carried along (contact friction). */
export function collideRafts(w: World, S: PropState, h: number) {
  if (!S.rafts.length) return;
  const P = w.P;
  const R = BODY.radius + PROP.raftHalf;
  for (const r of S.rafts) {
    const rvx = (r.x - r.px) / h;
    for (let i = 0; i < P.n; i++) {
      if (!(P.flags[i] & PF.ALIVE)) continue;
      const dx = P.x[i] - r.x,
        dy = P.y[i] - r.y;
      if (Math.abs(dx) > r.len + R || Math.abs(dy) > R) continue;
      const u = Math.max(-r.len, Math.min(r.len, dx));
      let nx = P.x[i] - (r.x + u),
        ny = P.y[i] - r.y;
      const d = F.hypot(nx, ny);
      if (d >= R) continue;
      if (d < 1e-6) (nx = 0), (ny = -1);
      else (nx /= d), (ny /= d);
      const depth = R - d;
      const wp = P.im[i],
        wr = 1 / PROP.raftMass;
      P.x[i] += nx * depth * (wp / (wp + wr));
      P.y[i] += ny * depth * (wp / (wp + wr));
      r.x -= nx * depth * (wr / (wp + wr));
      r.y -= ny * depth * (wr / (wp + wr));
      if (ny < -0.5) {
        P.flags[i] |= PF.GROUND;
        P.nx[i] = nx;
        P.ny[i] = ny;
        const vx = (P.x[i] - P.px[i]) / h;
        P.px[i] = P.x[i] - (vx + (rvx - vx) * PROP.raftGrip) * h;
      }
    }
  }
}

// ------------------------------------------------------------------ the kraken

/** Per substep: tentacles rise and reach for him, latch on and haul toward the root (his
 *  carrier is hauled with him), and let go, recoiling, when a hand, fist or spring hits them. */
export function tentacles(w: World, S: PropState, h: number) {
  const g = w.guy;
  const P = w.P;
  for (const T of S.tentacles) {
    const b = T.body;
    const p = T.prop;
    const reach = p.reach ?? PROP.tentacleReach;
    if (w.t < p.at || !g?.alive) {
      b.px = b.x;
      b.py = b.y;
      continue;
    }
    if (T.mode === 'wait') T.mode = 'reach';
    // a hard hit on the tip: it lets go and sinks back for a while
    if (T.mode !== 'recoil' && struck(w, b, h)) {
      T.mode = 'recoil';
      T.until = w.t + PROP.tentacleRecoil;
      w.emit({ type: 'knock', x: b.x, y: b.y });
    }
    const c = guyCentre(w, g);
    let tx: number, ty: number, speed: number;
    if (T.mode === 'recoil') {
      tx = p.x;
      ty = p.y;
      speed = PROP.tentacleBack;
      if (w.t >= T.until) T.mode = 'reach';
    } else if (T.mode === 'reach') {
      // toward him, as far as it stretches
      const dx = c.x - p.x,
        dy = c.y - p.y;
      const d = F.hypot(dx, dy) || 1;
      const L = Math.min(d, reach);
      tx = p.x + (dx / d) * L;
      ty = p.y + (dy / d) * L;
      speed = PROP.tentacleSpeed;
      if (F.hypot(b.x - c.x, b.y - c.y) < PROP.tipR + GUY_GRAB) {
        T.mode = 'hold';
        T.heldT = 0;
        w.emit({ type: 'grab', x: b.x, y: b.y });
      }
    } else {
      // hold: the tip stays on him and hauls him (and whoever holds him) toward its root
      T.heldT += h;
      tx = c.x;
      ty = c.y;
      speed = 2000;
      haul(w, g, p.x, p.y, h);
    }
    const dx = tx - b.x,
      dy = ty - b.y;
    const d = F.hypot(dx, dy);
    const step = Math.min(d, speed * h);
    const nx = d > 0 ? (b.x + (dx / d) * step) : b.x,
      ny = d > 0 ? (b.y + (dy / d) * step) : b.y;
    b.px = b.x;
    b.py = b.y;
    b.x = nx;
    b.y = ny;
    void P;
  }
}

const GUY_GRAB = 10;

/** The haul: a limited force toward the root, shared by him and whoever carries him (a heavy,
 *  planted carrier wins the tug of war). */
function haul(w: World, g: NonNullable<World['guy']>, ax: number, ay: number, h: number) {
  const P = w.P;
  const carrier = g.ride >= 0 ? w.creatures[g.ride] : g.heldBy >= 0 ? w.creatures[g.heldBy] : null;
  const ids = carrier && carrier.alive ? carrier.ids.concat(g.ids) : g.ids;
  let m = 0,
    cx = 0,
    cy = 0;
  for (const i of ids) (m += P.m[i]), (cx += P.x[i] * P.m[i]), (cy += P.y[i] * P.m[i]);
  cx /= m;
  cy /= m;
  const dx = ax - cx,
    dy = ay - cy;
  const d = F.hypot(dx, dy) || 1;
  // the planted feet of a carrier hold some of it (friction on the ground)
  let grip = 0;
  if (carrier) for (const l of carrier.limbs) if (l.foot && P.flags[l.tip] & PF.GROUND) grip += PROP.tentacleGrip * carrier.stats.strength;
  const f = Math.max(0, PROP.tentaclePull - grip);
  const dv = (f / m) * h;
  for (const i of ids) {
    P.px[i] -= (dx / d) * dv * h;
    P.py[i] -= (dy / d) * dv * h;
  }
}

/** Is a hand, fist or spring hitting the tentacle tip hard right now? */
function struck(w: World, b: Body, h: number): boolean {
  const P = w.P;
  const reach = b.r + BODY.radius + 8;
  for (const cr of w.creatures) {
    if (!cr.alive || w.t < cr.brain.actAt) continue;
    for (const i of strikers(w, cr)) {
      const dx = b.x - P.x[i],
        dy = b.y - P.y[i];
      const d = F.hypot(dx, dy);
      if (d > reach || d < 1e-6) continue;
      const vx = (P.x[i] - P.px[i]) / h - (b.x - b.px) / h,
        vy = (P.y[i] - P.py[i]) / h - (b.y - b.py) / h;
      if ((vx * dx + vy * dy) / d > PROP.tentacleHit) return true;
    }
  }
  return false;
}
