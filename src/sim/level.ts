// Level runner (levels.md §8, design.md §2/§12): builds a level into a World,
// watches Little Guy's fate and the goal each step, and keeps an event log for
// epitaphs and money moments. Pure and deterministic.
import * as F from './fmath';
import { BODY, GUY, LEVEL, WORLD } from '../tuning';
import { spawnEntity, attacking, type Entity } from './hazards';
import { PF } from './store';
import { spawnGuy, thinkGuy, killGuy, guyCentre, type GuyHat } from './littleguy';
import type { Pt } from './geom';
import type { World, Body } from './world';

export type Goal = { type: 'hug' } | { type: 'save'; seconds: number };

export interface RefSolution {
  kind: string; // the hero kind it is meant to be (design §6)
  strokes: Pt[][];
}

export interface LevelDef {
  id: string;
  title: string;
  hint?: string;
  paper: string;
  goal: Goal;
  draw: number; // world time scale while ink is wet
  ink: number; // px budget
  terrain: Pt[][];
  /** false: no page floor; the level's terrain is all the ground there is (gaps are pits) */
  floor?: boolean;
  entities: Entity[];
  guy: { x: number; y: number; hat?: GuyHat };
  anatomyMatters: boolean;
  /** where the lazy baselines are drawn (levels.md §3): centre of Little Guy's spot */
  baseline?: { x: number; y: number };
  refs: RefSolution[];
  window?: [number, number]; // pacing: first touch → result, s
  notes?: string;
}

export interface LevelRun {
  def: LevelDef;
  /** level time the countdown started (first birth, or LEVEL.autoStart), -1 before */
  startedAt: number;
  result: 'play' | 'win' | 'fail';
  resultAt: number;
  cause: string;
  hugT: number;
  hugger: number;
  seen: number; // events processed
  squeezeT: number; // s he has been squeezed by ink a pusher is shoving
  log: { t: number; type: string; cr?: number; v?: number; text?: string }[];
}

export function startLevel(w: World, def: LevelDef) {
  // a level without the page floor has pits that open off the bottom of the page
  if (def.floor === false) w.terrain = w.terrain.filter((T) => T.kind !== 'floor');
  for (const t of def.terrain) w.addTerrain(t);
  w.guy = spawnGuy(w, def.guy.x, def.guy.y, def.guy.hat ?? 'none');
  for (const e of def.entities) spawnEntity(w, e);
  w.level = { def, startedAt: -1, result: 'play', resultAt: -1, cause: '', hugT: 0, hugger: -1, seen: 0, squeezeT: 0, log: [] };
}

/** Seconds left on the SAVE countdown (null when the goal has none or it hasn't started). */
export function countdown(w: World): number | null {
  const L = w.level;
  if (!L || L.def.goal.type !== 'save') return null;
  if (L.startedAt < 0) return L.def.goal.seconds;
  return Math.max(0, L.def.goal.seconds - (w.t - L.startedAt));
}

export function threats(w: World): Body[] {
  return w.bodies.filter((b) => b.alive && b.data.threat && (b.data.sleep ?? 0) <= w.t + LEVEL.foresee);
}

/** The threat that matters most to Little Guy right now: nearest, weighted by approach. */
export function mainThreat(w: World): Body | null {
  const g = w.guy;
  if (!g) return null;
  const c = g.alive ? guyCentre(w, g) : { x: w.level?.def.guy.x ?? 360, y: w.level?.def.guy.y ?? 1100 };
  let best: Body | null = null,
    bs = Infinity;
  for (const b of threats(w)) {
    const d = F.hypot(b.x - c.x, b.y - c.y) - b.r - (b.hw ?? 0);
    if (d < bs) (bs = d), (best = b);
  }
  return best;
}

export function levelStep(w: World) {
  const L = w.level!;
  const g = w.guy!;
  // log the world's events
  for (; L.seen < w.events.length; L.seen++) {
    const e = w.events[L.seen];
    if (e.type === 'born' && L.startedAt < 0) L.startedAt = w.t;
    if (e.type === 'boom' && g.alive && L.result === 'play') {
      const c = guyCentre(w, g);
      if (F.hypot(c.x - e.x!, c.y - e.y!) < GUY.blastKill) killGuy(w, g, 'blast');
    }
    if (['born', 'piece', 'graft', 'tear', 'boom', 'grab', 'throw', 'punch', 'knock', 'guyDied', 'ninjaLeap', 'fell'].includes(e.type)) L.log.push({ t: e.t, type: e.type, cr: e.cr, text: e.text });
  }
  if (L.startedAt < 0 && w.t >= LEVEL.autoStart) L.startedAt = w.t;
  const th = mainThreat(w);
  thinkGuy(w, g, th ? { x: th.x, y: th.y } : null);
  if (L.result !== 'play') return;

  if (g.alive) checkDeaths(w);
  if (!g.alive) {
    L.result = 'fail';
    L.resultAt = w.t;
    L.cause = g.cause;
    return;
  }
  const goal = L.def.goal;
  if (goal.type === 'save') {
    if (L.startedAt >= 0 && w.t - L.startedAt >= goal.seconds) win(w);
  } else if (goal.type === 'hug') {
    const c = guyCentre(w, g);
    let who = -1;
    for (const cr of w.creatures) {
      if (!cr.alive || w.t - cr.bornAt < 0.3) continue;
      for (const i of cr.ids)
        if (F.hypot(w.P.x[i] - c.x, w.P.y[i] - c.y) < GUY.hugDist + GUY.height / 2) {
          who = cr.id;
          break;
        }
      if (who >= 0) break;
    }
    L.hugT = who >= 0 ? L.hugT + WORLD.dt : 0;
    if (who >= 0 && L.hugT > LEVEL.hugHold) {
      g.hugging = who;
      L.hugger = who;
      win(w);
    }
  }
}

function win(w: World) {
  const L = w.level!;
  L.result = 'win';
  L.resultAt = w.t;
  const g = w.guy!;
  if (g.hugging < 0) {
    // he hugs the nearest creature
    const c = guyCentre(w, g);
    let bd = Infinity;
    for (const cr of w.creatures) {
      if (!cr.alive) continue;
      const ce = w.centroid(cr);
      const d = F.hypot(ce.x - c.x, ce.y - c.y);
      if (d < bd) (bd = d), (g.hugging = cr.id);
    }
  }
  for (const cr of w.creatures) if (cr.alive) cr.face.happy = 3;
  w.emit({ type: 'win', cr: g.hugging });
}

function checkDeaths(w: World) {
  const g = w.guy!;
  const P = w.P;
  const c = guyCentre(w, g);
  if (c.y > WORLD.killY - 100 || c.x < -40 || c.x > WORLD.W + 40) return killGuy(w, g, 'fell');
  const h = WORLD.dt;
  for (const b of w.bodies) {
    if (!b.alive || (b.data.sleep ?? 0) > w.t) continue;
    if (b.kind === 'boulder' || b.kind === 'ninja') {
      const reach = b.r + GUY.radius + 2 + (b.kind === 'ninja' ? GUY.bladeReach : 0);
      let touch = false;
      for (const i of g.ids) if (F.hypot(P.x[i] - b.x, P.y[i] - b.y) < reach) touch = true;
      b.data.touchT = touch ? (b.data.touchT ?? 0) + h : 0;
      if (!touch) continue;
      const rvx = (b.x - b.sx) / h - (P.x[g.hip] - P.sx[g.hip]) / h,
        rvy = (b.y - b.sy) / h - (P.y[g.hip] - P.sy[g.hip]) / h;
      const sp = F.hypot(rvx, rvy);
      if (b.kind === 'boulder' && sp > GUY.boulderKill) return killGuy(w, g, 'squashed');
      // a boulder that comes to rest against him has its weight on him (slowing it is not stopping it)
      if (b.kind === 'boulder' && b.data.touchT > GUY.pinTime) return killGuy(w, g, 'squashed');
      // a ninja in his leap or dash kills on a hard hit, or on a blade held against him (not while carried off or dizzy)
      if (b.kind === 'ninja' && attacking(b) && (sp > GUY.enemyKill || b.data.touchT > GUY.stabTime)) return killGuy(w, g, 'ninja');
    }
  }
  if (squeezed(w)) return killGuy(w, g, 'crushed');
  // crushed: a wall closes right up to him (ink in between has been squeezed out), or he is
  // trapped between two walls / a wall and the page edge
  const walls = w.bodies.filter((b) => b.alive && b.kind === 'crusher' && (b.data.sleep ?? 0) <= w.t);
  const left = walls.filter((b) => b.x < c.x).map((b) => b.x + b.hw!);
  const right = walls.filter((b) => b.x > c.x).map((b) => b.x - b.hw!);
  const lx = left.length ? Math.max(...left) : 0;
  const rx = right.length ? Math.min(...right) : WORLD.W;
  if ((left.length && c.x - lx < GUY.crushReach) || (right.length && rx - c.x < GUY.crushReach)) return killGuy(w, g, 'crushed');
  if ((left.length || right.length) && rx - lx < GUY.crushGap) return killGuy(w, g, 'crushed');
}

/** Squeezed (design §10, "gap narrower than his width"): ink that a pusher (wall, boulder) is
 *  shoving, or the pusher itself, stays deep inside him. He is light, so an overlap only
 *  lasts when he has nowhere left to go: against the page edge, a wall, the ground. */
function squeezed(w: World): boolean {
  const L = w.level!,
    g = w.guy!,
    P = w.P;
  const pushers = w.bodies.filter((b) => b.alive && b.data.pusher && (b.data.sleep ?? 0) <= w.t);
  if (!pushers.length) return false;
  const contact = BODY.radius + GUY.squeezeContact;
  const shoved = new Set<number>();
  for (const cr of w.creatures) {
    if (!cr.alive) continue;
    for (const b of pushers) {
      let hit = false;
      for (const i of cr.ids) {
        if (b.hw) hit = Math.abs(P.x[i] - b.x) < b.hw + contact && Math.abs(P.y[i] - b.y) < b.hh! + contact;
        else hit = F.hypot(P.x[i] - b.x, P.y[i] - b.y) < b.r + contact;
        if (hit) break;
      }
      if (hit) {
        shoved.add(cr.id);
        break;
      }
    }
  }
  let deep = 0;
  const r2 = 2 * BODY.radius;
  for (const i of g.ids) {
    if (shoved.size)
      w.forNear(P.x[i], P.y[i], (j) => {
        if (P.flags[j] & PF.GUY || !(P.flags[j] & PF.ALIVE) || !shoved.has(P.owner[j])) return;
        const ov = r2 - F.hypot(P.x[j] - P.x[i], P.y[j] - P.y[i]);
        if (ov > deep) deep = ov;
      });
    for (const b of pushers) if (!b.hw) deep = Math.max(deep, b.r + GUY.radius - F.hypot(P.x[i] - b.x, P.y[i] - b.y));
  }
  L.squeezeT = deep > GUY.squeezeDepth ? L.squeezeT + WORLD.dt : 0;
  return L.squeezeT > GUY.squeezeTime;
}
