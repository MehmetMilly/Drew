// Level runner (levels.md §8, design.md §2/§12): builds a level into a World,
// watches Little Guy's fate and the goal each step, and keeps an event log for
// epitaphs and money moments. Pure and deterministic.
import * as F from './fmath';
import { ACT, BODY, GUY, HAZ, LEVEL, WORLD } from '../tuning';
import { spawnEntity, attacking, type Entity } from './hazards';
import { CT, PF } from './store';
import { spawnGuy, thinkGuy, killGuy, guyCentre, dismount, hopDown, type Guy, type GuyHat } from './littleguy';
import type { Pt } from './geom';
import type { World, Body } from './world';
import type { Creature } from './creature';

/** HOME: the flag's foot stands at (x, y) on the ground; the pole is LEVEL.flagH tall. */
/** SCORE: n balls dropped down through the hoop (rim centre x, y) within `seconds`. */
export type Goal =
  | { type: 'hug' }
  | { type: 'save'; seconds: number }
  | { type: 'home'; x: number; y: number }
  | { type: 'score'; n: number; seconds: number; hoop: { x: number; y: number } };

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
  stallT?: number; // HOME: s his carrier has made no progress
  score: number; // SCORE: balls through the hoop so far
  log: { t: number; type: string; cr?: number; v?: number; text?: string }[];
}

export function startLevel(w: World, def: LevelDef) {
  // a level without the page floor has pits that open off the bottom of the page
  if (def.floor === false) w.terrain = w.terrain.filter((T) => T.kind !== 'floor');
  for (const t of def.terrain) w.addTerrain(t);
  w.guy = spawnGuy(w, def.guy.x, def.guy.y, def.guy.hat ?? 'none');
  for (const e of def.entities) spawnEntity(w, e);
  w.level = { def, startedAt: -1, result: 'play', resultAt: -1, cause: '', hugT: 0, hugger: -1, seen: 0, squeezeT: 0, score: 0, log: [] };
}

/** Seconds left on the SAVE countdown (null when the goal has none or it hasn't started). */
export function countdown(w: World): number | null {
  const L = w.level;
  if (!L || (L.def.goal.type !== 'save' && L.def.goal.type !== 'score')) return null;
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
    if (['born', 'piece', 'graft', 'tear', 'boom', 'grab', 'throw', 'punch', 'knock', 'guyDied', 'ninjaLeap', 'fell', 'board', 'jump', 'score'].includes(e.type)) L.log.push({ t: e.t, type: e.type, cr: e.cr, text: e.text });
  }
  if (L.startedAt < 0 && w.t >= LEVEL.autoStart) L.startedAt = w.t;
  const th = mainThreat(w);
  if (L.def.goal.type === 'home' && g.alive && L.result === 'play') board(w, g);
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
  } else if (goal.type === 'score') {
    scoreCheck(w, goal);
    if (L.score >= goal.n) win(w);
    else if (L.startedAt >= 0 && w.t - L.startedAt >= goal.seconds) {
      L.result = 'fail';
      L.resultAt = w.t;
      L.cause = 'time';
    }
  } else if (goal.type === 'home') {
    const c = guyCentre(w, g);
    // carried too high over the flag (a giant's shoulder): he is let down and drops to it
    if (Math.abs(c.x - goal.x) < GUY.homeDist && c.y <= goal.y - LEVEL.flagH - GUY.height && (g.ride >= 0 || g.heldBy >= 0)) {
      dismount(g);
      g.heldBy = -1;
      g.heldTip = -1;
    }
    if (Math.abs(c.x - goal.x) < GUY.homeDist && c.y < goal.y + 10 && c.y > goal.y - LEVEL.flagH - GUY.height) {
      dismount(g);
      g.heldBy = -1;
      g.heldTip = -1;
      win(w);
    }
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

/** The highest point of a creature's body (not a limb tip): where he perches. */
export function perchOf(w: World, cr: { ids: number[]; limbs: { chain: number[]; root: number }[] }): number {
  const limb = new Set<number>();
  for (const l of cr.limbs) for (const i of l.chain) if (i !== l.root) limb.add(i);
  let best = -1;
  for (const i of cr.ids) if (!limb.has(i) && (best < 0 || w.P.y[i] < w.P.y[best])) best = i;
  return best;
}

/** Can one of this creature's (non-spring) hands reach him where he stands? */
export function handCanReach(w: World, cr: (typeof w.creatures)[number], g: Guy): boolean {
  const P = w.P;
  return cr.limbs.some((l) => !l.foot && l.spring < 0 && F.hypot(P.x[g.chest] - P.x[l.root], P.y[g.chest] - P.y[l.root]) < l.len * ACT.reachEnvelope * 0.95);
}

/** HOME (design §8 Carry, §10): he walks slowly to a creature that waits for him, and climbs on
 *  when it is low enough; a taller one has to lift him with a hand (the brain reaches). */
/** HOME: can Little Guy get onto this creature (a hand lifts him, or the top is scrambleable)? */
export function canCarry(w: World, cr: Creature, g: Guy) {
  const P = w.P;
  const feet = Math.max(P.y[g.footL], P.y[g.footR]);
  return feet - P.y[perchOf(w, cr)] <= GUY.scrambleMax || handCanReach(w, cr, g);
}

function board(w: World, g: Guy) {
  const P = w.P;
  if (g.ride >= 0) {
    const cr = w.creatures[g.ride];
    g.upsideT = cr ? cr.face.upsideT : 99;
    g.walkTo = null;
    // a carrier stalled near the flag (a wall, the page edge) lets him hop down for the last steps
    const goal = w.level!.def.goal as { x: number; y: number };
    const c = guyCentre(w, g);
    const ce = cr ? w.centroid(cr) : c;
    const moving = cr ? Math.abs(cr.brain.wantVx) > 5 && F.hypot(ce.x - (cr.lastX ?? ce.x), 0) > 0.3 : false;
    if (cr) cr.lastX = ce.x;
    w.level!.stallT = moving ? 0 : (w.level!.stallT ?? 0) + WORLD.dt;
    if (Math.abs(c.x - goal.x) < GUY.flagWalk && w.level!.stallT > GUY.stallDrop && w.t - g.rideAt > g.climbFor) hopDown(w, g, goal.x);
    return;
  }
  if (g.heldBy >= 0) return void (g.walkTo = null);
  const grounded = (P.flags[g.footL] | P.flags[g.footR]) & PF.GROUND;
  const c = guyCentre(w, g);
  const goal = w.level!.def.goal as { x: number; y: number };
  // the last few steps home he walks himself (a carrier that can't get closer set him down)
  if (Math.abs(c.x - goal.x) < GUY.flagWalk && Math.abs(c.y - (goal.y - GUY.height / 2)) < GUY.height) return void (g.walkTo = goal.x);
  const feet = Math.max(P.y[g.footL], P.y[g.footR]);
  let best: { cr: (typeof w.creatures)[number]; gap: number; x: number } | null = null;
  for (const cr of w.creatures) {
    if (!cr.alive || cr.brain.plan !== 'carry' || w.t < cr.brain.actAt) continue;
    let x0 = Infinity,
      x1 = -Infinity;
    for (const i of cr.ids) (x0 = Math.min(x0, P.x[i])), (x1 = Math.max(x1, P.x[i]));
    const gap = c.x < x0 ? x0 - c.x : c.x > x1 ? c.x - x1 : 0;
    if (!best || gap < best.gap) best = { cr, gap, x: (x0 + x1) / 2 };
  }
  // nobody can carry him but someone is leading him: he walks home behind it
  if (!best) return void (g.walkTo = w.creatures.some((cr) => cr.alive && cr.brain.plan === 'escort') ? goal.x : null);
  if (best.gap > LEVEL.boardSee) return void (g.walkTo = null);
  const p = perchOf(w, best.cr);
  const tall = feet - P.y[p] > GUY.climbMax;
  const lift = tall && handCanReach(w, best.cr, g);
  // too tall to scramble up and no hand to lift him: he walks home with it beside him
  if (!lift && feet - P.y[p] > GUY.scrambleMax) return void (g.walkTo = goal.x);
  if (best.gap < GUY.boardDist && grounded && !lift) {
    // climb on: a quick hop onto a low top, a scramble up a tall one (the soft attachment pulls)
    g.ride = best.cr.id;
    g.perch = p;
    g.rideAt = w.t;
    g.climbFor = tall ? (feet - P.y[p]) / GUY.scrambleSpeed + GUY.climbTime : GUY.climbTime;
    g.walkTo = null;
    w.emit({ type: 'board', cr: best.cr.id, x: c.x, y: c.y });
    return;
  }
  // walk to it unless it is lifting him or already right here
  g.walkTo = lift || best.gap < GUY.boardDist ? null : best.x;
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

/** SCORE: a ball that drops down through the rim (centre within the rim, moving down) scores. */
function scoreCheck(w: World, goal: { hoop: { x: number; y: number } }) {
  const L = w.level!;
  const { x, y } = goal.hoop;
  for (const b of w.bodies) {
    if (!b.alive || b.kind !== 'cargo' || b.data.parked || w.t - (b.data.scoredAt ?? -9) < 1) continue;
    if (b.sy < y && b.y >= y && Math.abs(b.x - x) < LEVEL.hoopW / 2 - b.r * 0.3) {
      L.score++;
      b.data.scoredAt = w.t;
      b.data.backAt = w.t + LEVEL.scoreBack;
      // who put it in: whoever held or threw it last
      w.emit({ type: 'score', cr: b.data.by ?? -1, x, y, v: L.score });
    }
  }
}

function onSpikes(w: World): ((i: number) => boolean) | null {
  const P = w.P;
  const S = w.level!.def.entities.filter((e) => e.type === 'spikes') as { x0: number; x1: number; y: number }[];
  if (!S.length) return null;
  return (i: number) => S.some((s) => P.x[i] > s.x0 && P.x[i] < s.x1 && P.y[i] > s.y - HAZ.spikeH - BODY.radius);
}

/** Spike floors, per step before the sever pass: every tie to a point on the teeth is cut
 *  (feet and tips that land on them come off). */
export function spikeCut(w: World) {
  const P = w.P,
    C = w.C;
  const on = onSpikes(w);
  if (!on) return;
  let any = false;
  for (const cr of w.creatures) if (cr.alive) for (const i of cr.ids) if (on(i)) any = true;
  if (!any) return;
  for (let c = 0; c < C.n; c++) {
    if (C.dead[c] || C.type[c] === CT.GRAB) continue;
    if (P.flags[C.a[c]] & PF.GUY) continue;
    // every tie to a point on the teeth goes (bends too, or the tip hangs on by them)
    if (on(C.a[c]) || on(C.b[c])) w.cut(c, 'spike');
  }
}

function checkDeaths(w: World) {
  const g = w.guy!;
  const P = w.P;
  const c = guyCentre(w, g);
  if (c.y > WORLD.killY - 100 || c.x < -40 || c.x > WORLD.W + 40) return killGuy(w, g, 'fell');
  const h = WORLD.dt;
  for (const b of w.bodies) {
    if (!b.alive || (b.data.sleep ?? 0) > w.t) continue;
    if (b.kind === 'ball' && b.held < 0) {
      // a rubber ball that hits him hard knocks him out
      let touch = false;
      for (const i of g.ids) if (F.hypot(P.x[i] - b.x, P.y[i] - b.y) < b.r + GUY.radius + 2) touch = true;
      if (touch && F.hypot(b.x - b.sx, b.y - b.sy) / h > GUY.ballKill) return killGuy(w, g, 'bonked');
      continue;
    }
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
  const spiked = onSpikes(w);
  if (spiked && g.ids.some(spiked)) return killGuy(w, g, 'spiked');
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
