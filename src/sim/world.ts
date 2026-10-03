// The simulation world (physics.md §2). Fixed 60 Hz step, 2 substeps, 10 iterations,
// shape matching every 3rd iteration. Pure and deterministic.
import * as F from './fmath';
import { BODY, CREATURE_COLLIDE, LOCO, SHAPE, WORLD } from '../tuning';
import { Particles, Constraints, PF, CT, STRUCTURAL } from './store';
import { buildBodies, components, PenPt } from './build';
import { readAnatomy, makeSprings, seedOf } from './anatomy';
import { Creature, newBrain, newFace, Loop, Lump, Spring } from './creature';
import type { SkinPart } from './skin';
import { mulberry32, Rng, hashFloat } from './rng';
import { Pt } from './geom';
import { think } from './brain';
import { actuate } from './actuators';

export interface Terrain {
  pts: Pt[];
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  friction: number;
  kind: string;
}

export interface Body {
  id: number;
  kind: string;
  x: number;
  y: number;
  px: number;
  py: number;
  sx: number;
  sy: number;
  r: number;
  m: number;
  restitution: number;
  friction: number;
  alive: boolean;
  held: number; // creature id holding it, -1
  grabbable: boolean;
  angle: number;
  data: Record<string, number>;
}

export interface SimEvent {
  t: number;
  type: string;
  cr?: number;
  x?: number;
  y?: number;
  v?: number;
  name?: string;
  pts?: number[];
  text?: string;
}

export interface WorldOpts {
  seed?: number;
  terrain?: Pt[][];
  floor?: boolean;
}

const NO_HIT = -1;

export class World {
  readonly W = WORLD.W;
  readonly H = WORLD.H;
  P = new Particles(8192);
  C = new Constraints(65536);
  creatures: Creature[] = [];
  skins: SkinPart[] = [];
  terrain: Terrain[] = [];
  bodies: Body[] = [];
  events: SimEvent[] = [];
  t = 0;
  steps = 0;
  rng: Rng;
  strokeSerial = 0;
  gravity = WORLD.gravity;
  tearsThisStep = 0;
  totalTears = 0;
  maxSpeedSeen = 0;
  nanSeen = false;
  // toy / level hooks
  toyTarget: { x: number; y: number } | null = null;
  /** step time of the last step in ms (filled by callers that measure) */
  lastStepMs = 0;

  private pairs = new Int32Array(4096);
  private nPairs = 0;
  private smDx = new Float64Array(1024);
  private smDy = new Float64Array(1024);
  // spatial hash
  private cell = CREATURE_COLLIDE.cell;
  private gw: number;
  private gh: number;
  private gy0 = -1280;
  private head: Int32Array;
  private next: Int32Array;

  constructor(opts: WorldOpts = {}) {
    this.rng = mulberry32(opts.seed ?? 7);
    if (opts.floor !== false) {
      this.addTerrain([
        { x: -200, y: WORLD.floorY },
        { x: this.W + 200, y: WORLD.floorY },
        { x: this.W + 200, y: 1600 },
        { x: -200, y: 1600 },
      ]);
    }
    for (const t of opts.terrain ?? []) this.addTerrain(t);
    this.gw = Math.ceil(this.W / this.cell) + 2;
    this.gh = Math.ceil((this.H - this.gy0 + 400) / this.cell);
    this.head = new Int32Array(this.gw * this.gh);
    this.next = new Int32Array(this.P.cap);
  }

  addTerrain(pts: Pt[], friction = 1, kind = 'ground') {
    let minX = Infinity,
      minY = Infinity,
      maxX = -Infinity,
      maxY = -Infinity;
    for (const p of pts) {
      minX = Math.min(minX, p.x);
      minY = Math.min(minY, p.y);
      maxX = Math.max(maxX, p.x);
      maxY = Math.max(maxY, p.y);
    }
    this.terrain.push({ pts, minX, minY, maxX, maxY, friction, kind });
  }

  /** Top surface of terrain at x, at or below fromY (Infinity if none). */
  groundY(x: number, fromY: number): number {
    let best = Infinity;
    for (const T of this.terrain) {
      if (x < T.minX || x > T.maxX || T.maxY < fromY) continue;
      const pts = T.pts;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i],
          b = pts[j];
        if ((a.x <= x && b.x > x) || (b.x <= x && a.x > x)) {
          const y = a.y + ((x - a.x) / (b.x - a.x)) * (b.y - a.y);
          if (y >= fromY - 2 && y < best) best = y;
        }
      }
    }
    return best;
  }

  emit(e: Omit<SimEvent, 't'>) {
    this.events.push({ t: this.t, ...e });
  }

  // ------------------------------------------------------------------ creatures

  /** Birth: strokes that touch become one creature each. Returns new creatures. */
  addStrokes(strokes: readonly (readonly PenPt[])[]): Creature[] {
    const usable = strokes.filter((s) => s.length >= 2);
    if (!usable.length) return [];
    const built = buildBodies(this, usable);
    if (!built.particles.length) return [];
    const groups = components(this, built.particles, built.cons);
    const springs = makeSprings(this, built.springs);
    const made: Creature[] = [];
    for (const g of groups) {
      const cr = this.makeCreature(g, built.cons, built.loops, built.lumps, springs, built.skins, usable as PenPt[][]);
      if (cr) made.push(cr);
    }
    return made;
  }

  private makeCreature(
    ids: number[],
    cons: number[],
    loops: Loop[],
    lumps: Lump[],
    springs: Spring[],
    skins: number[],
    strokes: PenPt[][],
    piece = false,
  ): Creature | null {
    const P = this.P,
      C = this.C;
    const set = new Set(ids);
    let ink = 0;
    const myCons = cons.filter((c) => !C.dead[c] && set.has(C.a[c]) && set.has(C.b[c]));
    for (const c of myCons) if (C.type[c] === CT.LINK || C.type[c] === CT.SPRING) ink += C.rest0[c];
    for (const l of lumps) if (set.has(l.centre)) ink += l.ink;
    if (ink < BODY.minCreatureInk && ids.length < 3) {
      // a speck: dust
      this.dust(ids);
      return null;
    }
    const id = this.creatures.length;
    for (const i of ids) P.owner[i] = id;
    const myStrokes = strokes.filter((_, si) => ids.some((i) => P.stroke[i] === si));
    const seed = seedOf(myStrokes.length ? myStrokes : strokes);
    const cr: Creature = {
      id,
      alive: true,
      bornAt: this.t,
      ids: ids.slice().sort((a, b) => a - b),
      cons: myCons,
      loops: loops.filter((l) => set.has(l.ring[0])),
      lumps: lumps.filter((l) => set.has(l.centre)),
      springs: springs.filter((s) => set.has(s.a) && set.has(s.b)),
      limbs: [],
      head: { kind: 'point', loop: -1, point: ids[0], r: 10 },
      kind: 'biped',
      gait: 'walk',
      front: 0,
      flip: 1,
      flipTo: 1,
      rolling: false,
      name: '',
      firstName: '',
      seed,
      stats: null as unknown as Creature['stats'],
      brain: newBrain(),
      face: newFace(seed),
      skins: skins.filter((s) => {
        const sk = this.skins[s];
        for (let k = 0; k < sk.n; k++) if (set.has(sk.pa[k]) || (sk.lump && set.has(sk.lump.centre))) return true;
        return false;
      }),
      strokes: myStrokes.map((s) => s.map((p) => ({ x: p.x, y: p.y }))),
      isPiece: piece,
      grownFrom: -1,
      announce: null,
      wetUntil: 0,
    };
    this.creatures.push(cr);
    readAnatomy(this, cr);
    if (!piece) {
      this.liftOut(cr);
      for (const i of cr.ids) {
        P.px[i] = P.x[i];
        P.py[i] = P.y[i];
      }
      this.emit({ type: 'born', cr: id, name: cr.name });
    }
    // face looks where the head is to start
    const h = this.headPos(cr);
    cr.face.lookX = cr.face.wantX = h.x;
    cr.face.lookY = cr.face.wantY = h.y + 40;
    cr.brain.dir = 1;
    return cr;
  }

  /** If any particle starts inside terrain, lift the whole creature until none is. */
  private liftOut(cr: Creature) {
    const P = this.P;
    // keep inside the page horizontally
    let minX = Infinity,
      maxX = -Infinity;
    for (const i of cr.ids) {
      minX = Math.min(minX, P.x[i]);
      maxX = Math.max(maxX, P.x[i]);
    }
    let sx = 0;
    if (minX < BODY.radius) sx = BODY.radius - minX;
    else if (maxX > this.W - BODY.radius) sx = this.W - BODY.radius - maxX;
    if (maxX - minX > this.W - 2 * BODY.radius) sx = (this.W - (maxX + minX)) / 2;
    for (const i of cr.ids) P.x[i] += sx;
    for (let k = 0; k < 400; k++) {
      let hit = false;
      for (const i of cr.ids) {
        if (this.terrainDepth(P.x[i], P.y[i], BODY.radius) > 0) {
          hit = true;
          break;
        }
      }
      if (!hit) break;
      for (const i of cr.ids) P.y[i] -= 2;
    }
  }

  dust(ids: number[]) {
    const pts: number[] = [];
    for (const i of ids) {
      if (!this.P.isAlive(i)) continue;
      pts.push(this.P.x[i], this.P.y[i]);
      this.P.remove(i);
    }
    if (pts.length) this.emit({ type: 'dust', pts });
  }

  removeCreature(cr: Creature, asDust = true) {
    if (!cr.alive) return;
    cr.alive = false;
    for (const c of cr.cons) this.C.remove(c);
    if (asDust) this.dust(cr.ids);
    else for (const i of cr.ids) this.P.remove(i);
  }

  liveCreatures() {
    return this.creatures.filter((c) => c.alive);
  }

  headPos(cr: Creature): Pt {
    const P = this.P;
    if (cr.head.kind === 'loop' && cr.loops[cr.head.loop]) {
      const ring = cr.loops[cr.head.loop].ring;
      let x = 0,
        y = 0;
      for (const i of ring) {
        x += P.x[i];
        y += P.y[i];
      }
      return { x: x / ring.length, y: y / ring.length };
    }
    const i = cr.head.point;
    return { x: P.x[i], y: P.y[i] };
  }

  centroid(cr: Creature): Pt & { m: number } {
    const P = this.P;
    let x = 0,
      y = 0,
      m = 0;
    for (const i of cr.ids) {
      x += P.x[i] * P.m[i];
      y += P.y[i] * P.m[i];
      m += P.m[i];
    }
    return { x: x / m, y: y / m, m };
  }

  // ------------------------------------------------------------------ bodies

  addBody(b: Partial<Body> & { kind: string; x: number; y: number; r: number; m: number }): Body {
    const body: Body = {
      id: this.bodies.length,
      px: b.x - (b.data?.vx ?? 0) * WORLD.dt,
      py: b.y - (b.data?.vy ?? 0) * WORLD.dt,
      sx: b.x,
      sy: b.y,
      restitution: 0.1,
      friction: 0.3,
      alive: true,
      held: -1,
      grabbable: false,
      angle: 0,
      data: {},
      ...b,
    };
    this.bodies.push(body);
    return body;
  }

  // ------------------------------------------------------------------ step

  step() {
    const P = this.P;
    P.sx.set(P.x.subarray(0, P.n));
    P.sy.set(P.y.subarray(0, P.n));
    for (const b of this.bodies) {
      b.sx = b.x;
      b.sy = b.y;
    }
    this.tearsThisStep = 0;
    const live = this.liveCreatures();
    for (const cr of live) think(this, cr);
    const h = WORLD.dt / WORLD.substeps;
    for (let s = 0; s < WORLD.substeps; s++) {
      for (const cr of live) if (cr.alive) actuate(this, cr, h);
      this.integrate(h);
      this.buildHash();
      this.buildPairs();
      for (let it = 0; it < WORLD.iterations; it++) {
        const lastIt = it === WORLD.iterations - 1;
        // soft bending converges fine on every other pass
        this.solveConstraints(it % 2 === 0);
        if (it % WORLD.shapeEvery === 0) for (const cr of live) if (cr.alive) this.shapeMatch(cr);
        if (it % 2 === 1) this.collideParticles();
        this.collideBodies();
        if (it % 2 === 1 || lastIt) this.collideTerrain(lastIt);
      }
      this.contactFriction(h);
      this.checkTears();
    }
    if (this.tearsThisStep) this.sever();
    this.cleanup();
    this.t += WORLD.dt;
    this.steps++;
  }

  private integrate(h: number) {
    const P = this.P;
    const g = this.gravity * h * h;
    const vmax = WORLD.maxSpeed * h;
    const damp = WORLD.damping;
    for (let i = 0; i < P.n; i++) {
      if (!(P.flags[i] & PF.ALIVE)) continue;
      let vx = (P.x[i] - P.px[i]) * damp,
        vy = (P.y[i] - P.py[i]) * damp;
      const sp = F.hypot(vx, vy);
      if (sp > vmax) {
        vx *= vmax / sp;
        vy *= vmax / sp;
      }
      if (sp / h > this.maxSpeedSeen) this.maxSpeedSeen = sp / h;
      P.px[i] = P.x[i];
      P.py[i] = P.y[i];
      P.x[i] += vx;
      P.y[i] += vy + (P.im[i] > 0 ? g : 0);
      P.flags[i] &= ~PF.GROUND;
    }
    for (const b of this.bodies) {
      if (!b.alive || b.held >= 0) continue;
      const vx = (b.x - b.px) * 0.999,
        vy = (b.y - b.py) * 0.999;
      b.px = b.x;
      b.py = b.y;
      b.x += vx;
      b.y += vy + (b.m > 0 ? g : 0);
    }
  }

  private solveConstraints(bends: boolean) {
    const P = this.P,
      C = this.C;
    const T = C.type;
    const X = P.x,
      Y = P.y,
      IM = P.im;
    for (let c = 0; c < C.n; c++) {
      if (C.dead[c] || (!bends && T[c] === CT.BEND)) continue;
      const a = C.a[c],
        b = C.b[c];
      const dx = X[b] - X[a],
        dy = Y[b] - Y[a];
      const d = Math.sqrt(dx * dx + dy * dy) || 1e-9;
      const wa = IM[a],
        wb = IM[b];
      const ws = wa + wb;
      if (ws === 0) continue;
      const diff = ((d - C.rest[c]) / d) * C.k[c];
      const fa = (diff * wa) / ws,
        fb = (diff * wb) / ws;
      X[a] += dx * fa;
      Y[a] += dy * fa;
      X[b] -= dx * fb;
      Y[b] -= dy * fb;
    }
  }

  /** Shape matching with the balance (upright) cheat and spring-aware targets. */
  shapeMatch(cr: Creature) {
    const P = this.P,
      ids = cr.ids;
    const n = ids.length;
    if (n < 3) return;
    if (this.smDx.length < n) {
      this.smDx = new Float64Array(n * 2);
      this.smDy = new Float64Array(n * 2);
    }
    let cx = 0,
      cy = 0,
      rcx = 0,
      rcy = 0,
      m = 0;
    for (let k = 0; k < n; k++) {
      const i = ids[k],
        mi = P.m[i];
      cx += P.x[i] * mi;
      cy += P.y[i] * mi;
      rcx += P.rx[i] * mi;
      rcy += P.ry[i] * mi;
      m += mi;
    }
    cx /= m;
    cy /= m;
    rcx /= m;
    rcy /= m;
    // posed limbs: a reaching arm's shape target is its drawn pose swung about the root
    let pose: Map<number, [number, number]> | null = null;
    for (const l of cr.limbs) {
      if (Math.abs(l.turn) < 1e-4 && Math.abs(l.ext - 1) < 1e-4) continue;
      pose ??= new Map();
      const co = F.cos(l.turn) * l.ext,
        si = F.sin(l.turn) * l.ext;
      for (const i of l.chain) {
        if (i === l.root) continue;
        const ox = (P.rx[i] - P.rx[l.root]) * cr.flip,
          oy = P.ry[i] - P.ry[l.root];
        pose.set(i, [ox * co - oy * si - ox, ox * si + oy * co - oy]);
      }
    }
    let sc = 0,
      ss = 0;
    for (let k = 0; k < n; k++) {
      const i = ids[k],
        mi = P.m[i];
      const po = pose?.get(i);
      const rx = (P.rx[i] - rcx) * cr.flip + (po ? po[0] : 0),
        ry = P.ry[i] - rcy + (po ? po[1] : 0),
        qx = P.x[i] - cx,
        qy = P.y[i] - cy;
      sc += mi * (rx * qx + ry * qy);
      ss += mi * (rx * qy - ry * qx);
    }
    const raw = F.atan2(ss, sc);
    (cr as Creature & { angle?: number }).angle = raw;
    const ang = cr.rolling ? raw : raw * (1 - cr.stats.balance);
    const co = F.cos(ang),
      si = F.sin(ang);
    const k0 = SHAPE.k * (cr.flip !== cr.flipTo ? LOCO.turnShape : 1); // a turning body is led, not forced
    // spring offsets for distal particles
    let spOff: Map<number, [number, number]> | null = null;
    for (const s of cr.springs) {
      if (!s.distal.length) continue;
      const dl = this.C.rest[s.c] - s.len0;
      if (Math.abs(dl) < 0.01) continue;
      spOff ??= new Map();
      for (const i of s.distal) {
        const o = spOff.get(i) ?? [0, 0];
        o[0] += s.ax * dl;
        o[1] += s.ay * dl;
        spOff.set(i, o);
      }
    }
    let mdx = 0,
      mdy = 0;
    for (let k = 0; k < n; k++) {
      const i = ids[k];
      let rx = (P.rx[i] - rcx) * cr.flip,
        ry = P.ry[i] - rcy;
      if (spOff) {
        const o = spOff.get(i);
        if (o) {
          rx += o[0] * cr.flip;
          ry += o[1];
        }
      }
      const po = pose?.get(i);
      if (po) {
        rx += po[0];
        ry += po[1];
      }
      const tx = cx + rx * co - ry * si,
        ty = cy + rx * si + ry * co;
      const kk = k0 * (P.flags[i] & PF.SOFT ? SHAPE.drivenW : P.w[i]);
      const dx = (tx - P.x[i]) * kk,
        dy = (ty - P.y[i]) * kk;
      this.smDx[k] = dx;
      this.smDy[k] = dy;
      mdx += dx * P.m[i];
      mdy += dy * P.m[i];
    }
    // remove the net translation: shape holding is an internal force (no levitation)
    mdx /= m;
    mdy /= m;
    for (let k = 0; k < n; k++) {
      const i = ids[k];
      P.x[i] += this.smDx[k] - mdx;
      P.y[i] += this.smDy[k] - mdy;
    }
  }

  // ------------------------------------------------------------------ collisions

  /** Penetration depth of a circle into terrain (>0 = overlapping). */
  terrainDepth(x: number, y: number, r: number): number {
    const hit = this.terrainHit(x, y, r);
    return hit ? hit.depth : 0;
  }

  /** Closest terrain contact for a circle: push direction (nx,ny) and depth. */
  terrainHit(x: number, y: number, r: number): { nx: number; ny: number; depth: number; fr: number } | null {
    let best: { nx: number; ny: number; depth: number; fr: number } | null = null;
    for (const T of this.terrain) {
      if (x < T.minX - r || x > T.maxX + r || y < T.minY - r || y > T.maxY + r) continue;
      const pts = T.pts;
      let inside = false;
      let bd = Infinity,
        bx = 0,
        by = 0;
      for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const a = pts[i],
          b = pts[j];
        if (a.y > y !== b.y > y && x < ((b.x - a.x) * (y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
        const dx = b.x - a.x,
          dy = b.y - a.y;
        const L2 = dx * dx + dy * dy;
        let t = L2 > 0 ? ((x - a.x) * dx + (y - a.y) * dy) / L2 : 0;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = a.x + dx * t,
          qy = a.y + dy * t;
        const d2 = (x - qx) * (x - qx) + (y - qy) * (y - qy);
        if (d2 < bd) {
          bd = d2;
          bx = qx;
          by = qy;
        }
      }
      const d = Math.sqrt(bd);
      let nx: number, ny: number, depth: number;
      if (inside) {
        if (d < 1e-9) {
          nx = 0;
          ny = -1;
        } else {
          nx = (bx - x) / d;
          ny = (by - y) / d;
        }
        depth = d + r;
      } else {
        if (d >= r) continue;
        nx = (x - bx) / (d || 1e-9);
        ny = (y - by) / (d || 1e-9);
        depth = r - d;
      }
      if (!best || depth > best.depth) best = { nx, ny, depth, fr: T.friction };
    }
    return best;
  }

  private collideTerrain(last: boolean) {
    const P = this.P,
      r = BODY.radius;
    for (let i = 0; i < P.n; i++) {
      if (!(P.flags[i] & PF.ALIVE)) continue;
      const x = P.x[i],
        y = P.y[i];
      // page walls (left/right); the top is open
      if (x < r) P.x[i] = r;
      else if (x > this.W - r) P.x[i] = this.W - r;
      const hit = this.terrainHit(P.x[i], y, r);
      if (hit) {
        P.x[i] += hit.nx * hit.depth;
        P.y[i] += hit.ny * hit.depth;
        P.flags[i] |= PF.GROUND;
        P.nx[i] = hit.nx;
        P.ny[i] = hit.ny;
      }
    }
    if (last) {
      for (const b of this.bodies) {
        if (!b.alive || b.held >= 0) continue;
        this.bodyTerrain(b);
      }
    }
  }

  private bodyTerrain(b: Body) {
    if (b.x < b.r) b.x = b.r;
    if (b.x > this.W - b.r) b.x = this.W - b.r;
    for (let k = 0; k < 2; k++) {
      const hit = this.terrainHit(b.x, b.y, b.r);
      if (!hit) break;
      const vx = b.x - b.px,
        vy = b.y - b.py;
      b.x += hit.nx * hit.depth;
      b.y += hit.ny * hit.depth;
      const vn = vx * hit.nx + vy * hit.ny;
      let tx = vx - vn * hit.nx,
        ty = vy - vn * hit.ny;
      const fr = 1 - Math.min(0.5, b.friction * 0.1);
      tx *= fr;
      ty *= fr;
      const nvn = vn < 0 ? -vn * b.restitution : vn;
      b.px = b.x - (tx + nvn * hit.nx);
      b.py = b.y - (ty + nvn * hit.ny);
      b.data.grounded = 1;
    }
  }

  private contactFriction(h: number) {
    const P = this.P;
    const vmax = WORLD.maxSpeed * h;
    for (let i = 0; i < P.n; i++) {
      const f = P.flags[i];
      if (!(f & PF.ALIVE)) continue;
      // speed clamp after the solve too (physics.md §2: 3000 px/s)
      const ivx = P.x[i] - P.px[i],
        ivy = P.y[i] - P.py[i];
      const sp = Math.sqrt(ivx * ivx + ivy * ivy);
      if (sp > vmax) {
        P.px[i] = P.x[i] - (ivx * vmax) / sp;
        P.py[i] = P.y[i] - (ivy * vmax) / sp;
      }
      if (!(f & PF.GROUND)) continue;
      const nx = P.nx[i],
        ny = P.ny[i];
      const vx = P.x[i] - P.px[i],
        vy = P.y[i] - P.py[i];
      const vn = vx * nx + vy * ny;
      let tx = vx - vn * nx,
        ty = vy - vn * ny;
      let mu = Math.min(1, LOCO.friction * P.fr[i]);
      if (f & PF.PINNED) mu = Math.max(mu, LOCO.stanceFriction);
      tx *= 1 - mu;
      ty *= 1 - mu;
      const nvn = vn < 0 ? 0 : vn;
      P.px[i] = P.x[i] - (tx + nvn * nx);
      P.py[i] = P.y[i] - (ty + nvn * ny);
    }
  }

  private buildHash() {
    const P = this.P;
    this.head.fill(-1);
    const cs = this.cell;
    for (let i = 0; i < P.n; i++) {
      if (!(P.flags[i] & PF.ALIVE)) continue;
      const k = this.cellOf(P.x[i], P.y[i]);
      this.next[i] = this.head[k];
      this.head[k] = i;
    }
    void cs;
  }

  cellOf(x: number, y: number) {
    let cx = Math.floor(x / this.cell) + 1,
      cy = Math.floor((y - this.gy0) / this.cell);
    if (cx < 0) cx = 0;
    else if (cx >= this.gw) cx = this.gw - 1;
    if (cy < 0) cy = 0;
    else if (cy >= this.gh) cy = this.gh - 1;
    return cy * this.gw + cx;
  }

  /** Iterate particles near (x,y) within the 3×3 cells. */
  forNear(x: number, y: number, fn: (i: number) => void) {
    let cx = Math.floor(x / this.cell) + 1,
      cy = Math.floor((y - this.gy0) / this.cell);
    cx = Math.max(0, Math.min(this.gw - 1, cx));
    cy = Math.max(0, Math.min(this.gh - 1, cy));
    for (let yy = Math.max(0, cy - 1); yy <= Math.min(this.gh - 1, cy + 1); yy++)
      for (let xx = Math.max(0, cx - 1); xx <= Math.min(this.gw - 1, cx + 1); xx++) {
        for (let j = this.head[yy * this.gw + xx]; j !== NO_HIT; j = this.next[j]) fn(j);
      }
  }

  /** Broad phase once per substep: pairs of particles from different creatures
   *  within reach (+ margin). The iterations then only resolve those pairs. */
  private buildPairs() {
    const P = this.P;
    const reach = 2 * BODY.radius + 6;
    const R2 = reach * reach;
    const gw = this.gw,
      gh = this.gh;
    let n = 0;
    for (let cy = 0; cy < gh; cy++)
      for (let cx = 0; cx < gw; cx++) {
        for (let i = this.head[cy * gw + cx]; i !== NO_HIT; i = this.next[i]) {
          const oi = P.owner[i];
          for (let k = 0; k < 5; k++) {
            const nx = cx + (k === 1 ? 1 : k === 2 ? -1 : k === 4 ? 1 : 0);
            const ny = cy + (k >= 2 ? 1 : 0);
            if (nx < 0 || nx >= gw || ny >= gh) continue;
            for (let j = k === 0 ? this.next[i] : this.head[ny * gw + nx]; j !== NO_HIT; j = this.next[j]) {
              if (P.owner[j] === oi && oi >= 0) continue;
              const dx = P.x[j] - P.x[i],
                dy = P.y[j] - P.y[i];
              if (dx * dx + dy * dy >= R2) continue;
              if (n * 2 + 2 > this.pairs.length) {
                const np = new Int32Array(this.pairs.length * 2);
                np.set(this.pairs);
                this.pairs = np;
              }
              this.pairs[n * 2] = i;
              this.pairs[n * 2 + 1] = j;
              n++;
            }
          }
        }
      }
    this.nPairs = n;
  }

  private collideParticles() {
    const P = this.P;
    const r2 = 2 * BODY.radius;
    const R2 = r2 * r2;
    const pairs = this.pairs;
    for (let k = 0; k < this.nPairs; k++) {
      const i = pairs[k * 2],
        j = pairs[k * 2 + 1];
      const dx = P.x[j] - P.x[i],
        dy = P.y[j] - P.y[i];
      const d2 = dx * dx + dy * dy;
      if (d2 >= R2 || d2 < 1e-12) continue;
      const d = Math.sqrt(d2);
      const wi = P.im[i],
        wj = P.im[j];
      const ws = wi + wj;
      if (ws === 0) continue;
      // relaxed: a foot landing between two links of another body must not wedge them
      // apart faster than their own links can pull back together
      const push = ((r2 - d) / d) * CREATURE_COLLIDE.relax;
      P.x[i] -= dx * push * (wi / ws);
      P.y[i] -= dy * push * (wi / ws);
      P.x[j] += dx * push * (wj / ws);
      P.y[j] += dy * push * (wj / ws);
    }
  }

  private collideBodies() {
    const P = this.P;
    const pr = BODY.radius;
    for (const b of this.bodies) {
      if (!b.alive) continue;
      const bw = b.held >= 0 ? 0 : b.m > 0 ? 1 / b.m : 0;
      const reach = b.r + pr;
      // query cells covering the body
      const span = Math.ceil(reach / this.cell);
      let cx = Math.floor(b.x / this.cell) + 1,
        cy = Math.floor((b.y - this.gy0) / this.cell);
      for (let yy = cy - span; yy <= cy + span; yy++) {
        if (yy < 0 || yy >= this.gh) continue;
        for (let xx = cx - span; xx <= cx + span; xx++) {
          if (xx < 0 || xx >= this.gw) continue;
          for (let j = this.head[yy * this.gw + xx]; j !== NO_HIT; j = this.next[j]) {
            if (b.held >= 0 && P.owner[j] === b.held) continue;
            const dx = P.x[j] - b.x,
              dy = P.y[j] - b.y;
            const d2 = dx * dx + dy * dy;
            if (d2 >= reach * reach || d2 < 1e-12) continue;
            const d = Math.sqrt(d2);
            const wp = P.im[j];
            const ws = wp + bw;
            if (ws === 0) continue;
            const push = (reach - d) / d;
            P.x[j] += dx * push * (wp / ws);
            P.y[j] += dy * push * (wp / ws);
            b.x -= dx * push * (bw / ws);
            b.y -= dy * push * (bw / ws);
          }
        }
      }
      void cx;
      void cy;
    }
    // body vs body
    for (let a = 0; a < this.bodies.length; a++) {
      const A = this.bodies[a];
      if (!A.alive) continue;
      for (let c = a + 1; c < this.bodies.length; c++) {
        const B = this.bodies[c];
        if (!B.alive) continue;
        const dx = B.x - A.x,
          dy = B.y - A.y;
        const R = A.r + B.r;
        const d2 = dx * dx + dy * dy;
        if (d2 >= R * R || d2 < 1e-12) continue;
        const d = Math.sqrt(d2);
        const wa = A.held >= 0 ? 0 : 1 / A.m,
          wb = B.held >= 0 ? 0 : 1 / B.m;
        const ws = wa + wb;
        if (!ws) continue;
        const push = (R - d) / d;
        A.x -= dx * push * (wa / ws);
        A.y -= dy * push * (wa / ws);
        B.x += dx * push * (wb / ws);
        B.y += dy * push * (wb / ws);
      }
    }
  }

  // ------------------------------------------------------------------ tearing

  private checkTears() {
    const P = this.P,
      C = this.C;
    for (let c = 0; c < C.n; c++) {
      if (C.dead[c]) continue;
      const t = C.type[c];
      if (t === CT.BEND || t === CT.LUMP || t === CT.GRAB) continue;
      const a = C.a[c],
        b = C.b[c];
      const d = F.hypot(P.x[b] - P.x[a], P.y[b] - P.y[a]);
      const rest = C.rest[c];
      C.strain[c] = d / rest - 1;
      // short tail links (a stroke's last few px) tear by the same absolute stretch as a full link
      const broke = t === CT.WELD ? d > rest + BODY.tearWeld : d > Math.max(rest * BODY.tearLink, rest + BODY.spacing * (BODY.tearLink - 1));
      if (broke) this.cut(c, 'stretch');
    }
  }

  /** Cut a constraint (overstretch or hazard). */
  cut(c: number, why: string) {
    const C = this.C,
      P = this.P;
    if (C.dead[c]) return;
    C.remove(c);
    this.tearsThisStep++;
    this.totalTears++;
    const a = C.a[c],
      b = C.b[c];
    this.emit({ type: 'tear', cr: P.owner[a], x: (P.x[a] + P.x[b]) / 2, y: (P.y[a] + P.y[b]) / 2, text: why + ':' + C.type[c] + ':' + C.rest[c].toFixed(1) });
  }

  /** After tears: split creatures into pieces. Pieces ≥ 60px of ink grow eyes. */
  private sever() {
    const P = this.P,
      C = this.C;
    for (const cr of this.creatures) {
      if (!cr.alive) continue;
      cr.cons = cr.cons.filter((c) => !C.dead[c]);
      const groups = components(this, cr.ids, cr.cons);
      if (groups.length < 2) continue;
      // the piece with the head keeps the identity; else the heaviest
      const headP = cr.head.kind === 'loop' && cr.loops[cr.head.loop] ? cr.loops[cr.head.loop].ring[0] : cr.head.point;
      let keep = groups.findIndex((g) => g.includes(headP));
      if (keep < 0) {
        let bm = -1;
        groups.forEach((g, k) => {
          const m = g.reduce((s, i) => s + P.m[i], 0);
          if (m > bm) {
            bm = m;
            keep = k;
          }
        });
      }
      const oldStrokes = cr.strokes;
      const keepSet = new Set(groups[keep]);
      const others = groups.filter((_, k) => k !== keep);
      const allCons = cr.cons;
      cr.ids = groups[keep].slice().sort((a, b) => a - b);
      cr.cons = allCons.filter((c) => keepSet.has(C.a[c]) && keepSet.has(C.b[c]));
      // drop bends that now straddle pieces
      for (const c of allCons) if (!C.dead[c] && keepSet.has(C.a[c]) !== keepSet.has(C.b[c])) C.remove(c);
      const lostInk = others.reduce((s, g) => s + g.length * BODY.spacing, 0);
      const prevLimbs = cr.limbs.length;
      readAnatomy(this, cr);
      cr.announce = cr.limbs.length < prevLimbs ? 'lost' : null;
      cr.face.surprise = 1;
      for (const g of others) {
        const set = new Set(g);
        let ink = 0;
        const gc = allCons.filter((c) => set.has(C.a[c]) && set.has(C.b[c]));
        for (const c of gc) if (!C.dead[c] && (C.type[c] === CT.LINK || C.type[c] === CT.SPRING || C.type[c] === CT.JOINT)) ink += C.rest0[c];
        for (const l of cr.lumps) if (set.has(l.centre)) ink += l.ink;
        if (ink + BODY.spacing < BODY.severMinInk) {
          for (const c of gc) C.remove(c);
          this.dust(g);
          continue;
        }
        const piece = this.makeCreature(g, gc, cr.loops.concat(), cr.lumps.concat(), cr.springs.concat(), cr.skins, oldStrokes.map((s) => s), true);
        if (!piece) continue;
        piece.grownFrom = cr.id;
        piece.seed = (cr.seed * 31 + piece.id * 7) >>> 0;
        piece.firstName = '';
        readAnatomy(this, piece);
        piece.face.surprise = 1;
        piece.brain = { ...cr.brain, actAt: this.t + 0.4 };
        this.emit({ type: 'piece', cr: piece.id, name: piece.name, x: this.centroid(piece).x, y: this.centroid(piece).y });
      }
      void lostInk;
      // loops/lumps/springs on the original are re-filtered by readAnatomy
    }
  }

  private cleanup() {
    const P = this.P;
    for (const cr of this.creatures) {
      if (!cr.alive) continue;
      let any = false;
      for (const i of cr.ids)
        if (P.y[i] < WORLD.killY) {
          any = true;
          break;
        }
      if (!any) {
        this.emit({ type: 'fell', cr: cr.id });
        this.removeCreature(cr, false);
      }
      for (const i of cr.ids) if (!isFinite(P.x[i]) || !isFinite(P.y[i])) this.nanSeen = true;
    }
    for (const b of this.bodies) if (b.alive && b.y > WORLD.killY) b.alive = false;
  }

  /** Stable hash of the full state, for determinism checks. */
  hash(): number {
    const P = this.P;
    let h = 0x811c9dc5;
    for (let i = 0; i < P.n; i++) {
      if (!(P.flags[i] & PF.ALIVE)) continue;
      h = hashFloat(h, P.x[i]);
      h = hashFloat(h, P.y[i]);
      h = hashFloat(h, P.px[i]);
      h = hashFloat(h, P.py[i]);
    }
    for (const b of this.bodies) {
      h = hashFloat(h, b.x);
      h = hashFloat(h, b.y);
    }
    return h >>> 0;
  }
}

export { STRUCTURAL };
