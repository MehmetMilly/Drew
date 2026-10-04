// Per-frame sound watchers for the props, hazards and modes the sim has no event for (audio.md
// §3). sfx.ts calls watchFrame once per rendered frame; it looks at the world state and fires
// one-shots on transitions (a ball bouncing, a plank meeting its stop, something entering the
// water, a tentacle rising, ink catching fire) and drives continuous loops (wind and fans, floor
// fire, flying scissors, the Big Eraser rubbing, the sharpener, the Sumo bully shoving).
// Nothing here changes the sim; it only reads it.
import type { World } from '../sim/world';
import { surfaceAt } from '../sim/props';
import { DMG, HAZ, WATER } from '../tuning';
import { audioCtx, rnd } from './mixer';
import { grindLoop, type LoopVoice } from './synth';
import * as M from './synth-more';
import { bullySays } from './voice';

const H = 1 / 120; // one physics substep (physics.md: 60 Hz, 2 substeps)

// ------------------------------------------------------------------ loop manager

interface LoopRec {
  v: LoopVoice;
  quietSince: number;
}
const loops = new Map<string, LoopRec>();
const seen = new Set<string>();

/** Create a loop on first use (when `a` is audible) and update it; unseen loops are swept. */
function drive(w: World, key: string, make: () => LoopVoice | null, a: number, a2 = 0, x?: number) {
  seen.add(key);
  let l = loops.get(key);
  if (!l) {
    if (a <= 0.02) return;
    const v = make();
    if (!v) return;
    l = { v, quietSince: w.t };
    loops.set(key, l);
  }
  l.v.update(a, a2, x);
  if (a > 0.02) l.quietSince = w.t;
}

function sweep(w: World) {
  for (const [k, l] of loops) {
    if (!seen.has(k) || w.t - l.quietSince > 0.6) {
      l.v.stop();
      loops.delete(k);
    }
  }
  seen.clear();
}

// ------------------------------------------------------------------ rate limits

const gates = new Map<string, number>();
/** True (and arms the gate) if `gap` seconds have passed since this gate last opened. */
export function gate(name: string, gap: number): boolean {
  const c = audioCtx();
  if (!c) return false;
  const now = c.currentTime;
  if (now - (gates.get(name) ?? -9) < gap) return false;
  gates.set(name, now);
  return true;
}

// ------------------------------------------------------------------ state

interface CrWet {
  frac: number;
  y: number;
  vy: number;
  next: number;
}

const vyPrev = new Map<number, number>(); // body id -> downward speed last frame
const wetBody = new Map<number, boolean>(); // body id -> was it under water
const cw = new Map<number, CrWet>(); // creature id (-1: Little Guy)
const stomps = new Map<number, { n: number; shoved: boolean; x: number; walked: number }>();
const snipAt = new Map<number, number>();
const timers = new Map<string, number>(); // next-allowed times for creaks and the like (level time)
const tmodes: string[] = [];
const planks: { th: number; d: number; atStop: boolean }[] = [];
let lastT = 0;
let lastBurnT = 0;
let whumphAt = -9;
let sumoWoke = false;
let grindAt = -9;
let grindX = 0;

export function watchReset(w: World) {
  for (const l of loops.values()) l.v.stop();
  loops.clear();
  seen.clear();
  vyPrev.clear();
  wetBody.clear();
  cw.clear();
  stomps.clear();
  snipAt.clear();
  timers.clear();
  tmodes.length = 0;
  planks.length = 0;
  lastT = w.t;
  lastBurnT = w.t;
  whumphAt = -9;
  sumoWoke = false;
  grindAt = -9;
}

export function watchStop() {
  for (const l of loops.values()) l.v.stop();
  loops.clear();
  seen.clear();
}

/** The sharpener grind event (emitted every step while the Eraser is in it). */
export function noteGrind(t: number, x: number) {
  grindAt = t;
  grindX = x;
}

/** True if a level-time timer has elapsed; arms it for `gap` more seconds. */
function due(w: World, key: string, gap: number): boolean {
  if (w.t < (timers.get(key) ?? -1)) return false;
  timers.set(key, w.t + gap);
  return true;
}

const clamp01 = (v: number) => Math.max(0, Math.min(1, v));

// ------------------------------------------------------------------ frame

export function watchFrame(w: World) {
  const S = w.props;
  const L = w.level;
  bodies(w);
  if (S) {
    planksFrame(w, S);
    slabsFrame(w, S);
    raftsFrame(w, S);
    tentaclesFrame(w, S);
    windFire(w, S);
    damageFrame(w, S);
    waterFrame(w, S);
  }
  sumoBully(w);
  // Sumo: both sides wake with a taiko and a clap
  if (L && L.def.goal.type === 'sumo' && L.foesAt >= 0 && !sumoWoke) {
    sumoWoke = true;
    if (w.t - L.foesAt < 0.5) M.sumoStart();
  }
  sweep(w);
  lastT = w.t;
}

// ------------------------------------------------------------------ bodies: bounces, splashes

// (broken-floor chunks tumble through everything, so only balls and ducks bounce)
const BOUNCERS = new Set(['ball', 'cargo']);

function bodies(w: World) {
  const S = w.props;
  const live = new Set<number>();
  for (const b of w.bodies) {
    if (!b.alive || b.hw || b.data.kin) continue;
    live.add(b.id);
    const vy = (b.y - b.py) / H;
    const prev = vyPrev.get(b.id) ?? 0;
    vyPrev.set(b.id, b.held >= 0 ? 0 : vy);
    if (b.held >= 0) {
      wetBody.set(b.id, false);
      continue;
    }
    // water entry: the centre crosses the surface going down
    if (S?.pools.length) {
      const surf = surfaceAt(S, b.x);
      const wet = b.y + b.r * 0.4 > surf;
      if (wet && !wetBody.get(b.id) && prev > 50) M.splash(b.x, clamp01(prev / 700) * clamp01(b.r / 22 + 0.3), Math.pow(18 / Math.max(b.r, 6), 0.3));
      wetBody.set(b.id, wet);
      if (wet) continue; // no bounce under water
    }
    // a bounce: falling fast one frame, rising the next
    if (BOUNCERS.has(b.kind) && prev > 150 && vy < -prev * 0.2) {
      const s = clamp01(prev / 650);
      if (b.kind === 'ball') M.rubberBounce(b.x, s);
      else if (b.data.duck) M.duckSqueak(b.x, 0.4 + 0.4 * s);
      else M.rubberBounce(b.x, s * 0.85, 1.12);
    }
  }
  for (const id of vyPrev.keys())
    if (!live.has(id)) {
      vyPrev.delete(id);
      wetBody.delete(id);
    }
}

// ------------------------------------------------------------------ props

function planksFrame(w: World, S: NonNullable<World['props']>) {
  S.planks.forEach((k, i) => {
    let p = planks[i];
    if (!p) p = planks[i] = { th: k.th, d: 0, atStop: k.th >= k.hi - 1e-3 || k.th <= k.lo + 1e-3 };
    const d = k.th - p.th;
    const atStop = k.th >= k.hi - 1e-3 || k.th <= k.lo + 1e-3;
    const speed = Math.max(Math.abs(d), Math.abs(p.d));
    if (atStop && !p.atStop && speed > 0.004) M.plankClunk(k.x + Math.sign(k.th) * k.len * 0.8, clamp01(speed / 0.045));
    else if (!atStop && Math.abs(d) > 0.008 && due(w, 'plank' + i, 0.55)) M.creak(k.x, clamp01(Math.abs(d) / 0.05), 170);
    p.th = k.th;
    p.d = d;
    p.atStop = atStop;
  });
}

/** A loaded rope bridge creaks as the weight nears what it can take. */
function slabsFrame(w: World, S: NonNullable<World['props']>) {
  S.slabs.forEach((sl, i) => {
    if (sl.brokeAt >= 0 || sl.prop.type !== 'bridge') return;
    const share = sl.load / sl.prop.load;
    if (share > 0.55 && due(w, 'bridge' + i, 0.9 - 0.4 * clamp01(share - 0.55))) M.creak((sl.terrain.minX + sl.terrain.maxX) / 2, clamp01(share), 150);
  });
}

function raftsFrame(w: World, S: NonNullable<World['props']>) {
  S.rafts.forEach((r, i) => {
    const v = Math.hypot(r.x - r.px, r.y - r.py) / H;
    if (v > 14 && due(w, 'raft' + i, 0.7 + rnd(0, 0.5) - 0.3 * clamp01(v / 90))) M.creak(r.x, 0.25 + 0.5 * clamp01(v / 90), 120);
  });
}

function tentaclesFrame(w: World, S: NonNullable<World['props']>) {
  S.tentacles.forEach((T, i) => {
    const was = tmodes[i];
    if (T.mode === 'reach' && (was === 'wait' || was === 'recoil')) M.tentacleRise(T.body.x, was === 'wait' ? 1 : 0.7);
    // hauling him in: it strains
    if (T.mode === 'hold' && due(w, 'tent' + i, 0.8)) M.creak(T.body.x, 0.6, 130);
    tmodes[i] = T.mode;
  });
}

function windFire(w: World, S: NonNullable<World['props']>) {
  S.defs.forEach((p, i) => {
    if (p.type !== 'wind') return;
    const on = w.t >= (p.at ?? 0);
    drive(w, 'wind' + i, M.windLoop, on ? clamp01(Math.abs(p.force) / 4000) * 0.75 + 0.25 : 0, 0, (p.x0 + p.x1) / 2);
  });
}

// ------------------------------------------------------------------ water

function waterFrame(w: World, S: NonNullable<World['props']>) {
  if (!S.pools.length) return;
  const P = w.P;
  const dt = w.t - lastT;
  const wetOf = (ids: readonly number[]) => {
    let n = 0;
    for (const i of ids) if (P.y[i] > surfaceAt(S, P.x[i])) n++;
    return n / Math.max(1, ids.length);
  };
  const live = new Set<number>();
  const visit = (id: number, ids: readonly number[], x: number, y: number, size: number, swimming: boolean) => {
    live.add(id);
    const frac = wetOf(ids);
    let t = cw.get(id);
    if (!t) {
      t = { frac, y, vy: 0, next: 0 };
      cw.set(id, t);
      return;
    }
    const vy = dt > 0 ? (y - t.y) / dt : t.vy;
    const entered = (t.frac < 0.12 && frac >= 0.12) || frac - t.frac > 0.35;
    if (entered) M.splash(x, clamp01(Math.max(vy, t.vy) / 700) * 0.8 + 0.2, Math.pow(150 / Math.max(size, 40), 0.25));
    else if (swimming && frac >= WATER.swimWet && w.t >= t.next) {
      M.slosh(x, 0.4 + 0.4 * clamp01(size / 300));
      t.next = w.t + 0.4 + rnd(0, 0.15);
    }
    t.frac = frac;
    t.y = y;
    t.vy = vy;
  };
  for (const cr of w.creatures) {
    if (!cr.alive) continue;
    const c = w.centroid(cr);
    visit(cr.id, cr.ids, c.x, c.y, cr.stats.size, cr.brain.mode === 'walk' && w.t >= cr.brain.actAt);
  }
  const g = w.guy;
  if (g?.alive) visit(-1, g.ids, P.x[g.hip], P.y[g.hip], 40, false);
  for (const id of cw.keys()) if (!live.has(id)) cw.delete(id);
}

// ------------------------------------------------------------------ Chapter 5

function damageFrame(w: World, S: NonNullable<World['props']>) {
  const D = S.dmg;
  if (!D) return;
  // fire: a crackle bed along the burning stretch of floor, and a "whumph" as ink catches
  D.fires.forEach((f, i) => {
    const d = f.def;
    if (w.t < d.at) return;
    const spread = Math.abs(f.front - d.x0);
    drive(w, 'fire' + i, M.crackleLoop, clamp01(0.3 + spread / 380), 0, (d.x0 + f.front) / 2);
  });
  if (D.fires.length) {
    const P = w.P;
    let n = 0;
    let sx = 0;
    for (let i = 0; i < P.n; i++) {
      if (D.burn[i] > lastBurnT - 0.001 && D.burn[i] > 0) {
        n++;
        sx += P.x[i];
      }
    }
    if (n > 0 && w.t - whumphAt > 0.9) {
      whumphAt = w.t;
      M.whumph(sx / n);
    }
    lastBurnT = w.t;
  }
  // scissors: snipping in place as a telegraph, then a whirr while they fly
  const live = new Set<number>();
  for (const b of w.bodies) {
    if (!b.alive) continue;
    if (b.kind === 'scissors' && b.data.kin && b.held < 0 && (b.data.sleep ?? 0) <= w.t) {
      live.add(b.id);
      if (w.t < (b.data.sleep ?? 0) + DMG.scissorsTell) {
        if (w.t - (snipAt.get(b.id) ?? -9) > 0.3) {
          snipAt.set(b.id, w.t);
          M.snip(b.x, 0.6);
        }
      } else {
        const stunned = w.t < (b.data.stunUntil ?? 0);
        const v = Math.hypot(b.x - b.px, b.y - b.py) / H;
        drive(w, 'whirr' + b.id, M.whirrLoop, stunned ? 0 : clamp01(v / Math.max(60, b.data.speed || DMG.scissorsSpeed)) * 0.9 + 0.1, 0, b.x);
      }
    } else if (b.kind === 'eraser' && b === D.boss && (b.data.sleep ?? 0) <= w.t) {
      // the Big Eraser rubs along the page while it pushes
      const v = Math.abs(b.x - b.px) / H;
      const sp = Math.max(1, b.data.speed || DMG.eraserSpeed);
      let a = 0;
      let strain = 0;
      if (D.bossPhase === 1) {
        a = 0.35 + 0.65 * clamp01(v / sp);
        strain = clamp01(1 - v / (sp * 0.5));
      } else if (D.bossPhase === 2 && !b.data.air) a = 0.7 * clamp01(v / 40);
      drive(w, 'rub', M.rubLoop, a, strain, b.x);
    }
  }
  for (const id of snipAt.keys()) if (!live.has(id)) snipAt.delete(id);
  // the sharpener whines while the Eraser is in it
  drive(w, 'sharp', M.sharpenLoop, w.t - grindAt < 0.25 ? 1 : 0, 0, grindX);
}

// ------------------------------------------------------------------ Sumo bully (Chapter 3)

function sumoBully(w: World) {
  const live = new Set<number>();
  for (const b of w.bodies) {
    if (!b.alive || b.kind !== 'sumo') continue;
    const at = b.data.at ?? b.data.sleep ?? 0;
    if (w.t < at) continue;
    live.add(b.id);
    let s = stomps.get(b.id);
    if (!s) {
      s = { n: 0, shoved: false, x: b.x, walked: 0 };
      stomps.set(b.id, s);
    }
    const t0 = w.t - at;
    if (t0 < HAZ.sumoStamp) {
      // stamping before the shove: three heavy feet, the first with a grunt
      const n = Math.min(3, Math.floor(t0 / 0.33) + 1);
      if (n > s.n) {
        s.n = n;
        M.bullyStomp(b.x, n === 3 ? 1 : 0.8);
        if (n === 1) bullySays('hmph', b.x);
      }
      continue;
    }
    if (!s.shoved) {
      s.shoved = true;
      M.bullyStomp(b.x, 1);
      bullySays('hoh', b.x);
    }
    // shoving: a heavy step every so often, and a scrape that strains when it is held up
    const v = Math.abs(b.x - b.px) / H;
    const sp = Math.max(1, b.data.speed || 1);
    s.walked += Math.abs(b.x - s.x);
    s.x = b.x;
    if (s.walked > 60 && v > 12) {
      s.walked = 0;
      M.bullyStomp(b.x, 0.4);
    }
    drive(w, 'sumo' + b.id, grindLoop, v > 8 ? 0.7 : 0, clamp01(1 - v / sp), b.x);
  }
  for (const id of stomps.keys()) if (!live.has(id)) stomps.delete(id);
}
