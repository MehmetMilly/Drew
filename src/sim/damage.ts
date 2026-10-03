// Chapter 5, The Eraser: things that destroy ink (physics.md §10). Scissors fly at Little Guy
// and cut every link they pass; fire runs along the floor and climbs links from the feet;
// smudgers crawl in and eat ink (stomp them); the Big Eraser rubs out what it touches, is
// shoved into the sharpener, hops, and finally crumbles into smudgers. Pure, deterministic.
import * as F from './fmath';
import { BODY, DMG, HAZ, WORLD } from '../tuning';
import { CT, PF } from './store';
import type { Body, World } from './world';
import { braceOn, strikers } from './hazards';
import { guyCentre, killGuy } from './littleguy';

export type Damage =
  /** flying scissors: wake at `at` from (x, y) and fly at him, turning, cutting all they pass */
  | { type: 'scissors'; x: number; y: number; at: number; speed?: number }
  /** a fire along the floor at y, spreading from x0 toward x1 at `speed` px/s from `at` */
  | { type: 'fire'; x0: number; x1: number; y: number; at: number; speed?: number }
  /** a smudger: a little eraser critter that crawls to ink and eats it (stomp it) */
  | { type: 'smudger'; x: number; y: number; at: number }
  /** the Big Eraser (boss): starts at (x, y); the sharpener is at the page edge on its far side */
  | { type: 'eraser'; x: number; y: number; at: number };

export interface DamageState {
  burn: Float32Array; // per particle: level time it caught fire (0 = not burning)
  fires: { def: Extract<Damage, { type: 'fire' }>; front: number }[];
  boss: Body | null;
  bossPhase: number; // 1 shove · 2 hops · 3 smudgers · 4 beaten
}

export function startDamage(w: World, defs: Damage[]): DamageState {
  const D: DamageState = { burn: new Float32Array(w.P.cap), fires: [], boss: null, bossPhase: 0 };
  for (const d of defs) spawnDamage(w, D, d);
  return D;
}

function spawnDamage(w: World, D: DamageState, d: Damage) {
  if (d.type === 'scissors')
    w.addBody({ kind: 'scissors', x: d.x, y: d.y, r: DMG.scissorsR, m: 8, grabbable: true, data: { threat: 1, ghost: 1, sleep: d.at, kin: 1, speed: d.speed ?? DMG.scissorsSpeed, hx: 0, hy: 0, spent: 0 } });
  else if (d.type === 'fire') D.fires.push({ def: d, front: d.x0 });
  else if (d.type === 'smudger') addSmudger(w, d.x, d.y, d.at);
  else if (d.type === 'eraser') {
    D.boss = w.addBody({ kind: 'eraser', x: d.x, y: d.y, r: 0, hw: DMG.eraserW / 2, hh: DMG.eraserH / 2, m: DMG.eraserMass, data: { threat: 1, pusher: 1, sleep: d.at, dir: -1, speed: DMG.eraserSpeed, force: DMG.eraserForce, rail: d.y, home: d.x, hopAt: 0, vy: 0, air: 0, ground: d.y } });
    D.bossPhase = 1;
  }
}

function addSmudger(w: World, x: number, y: number, at: number) {
  return w.addBody({ kind: 'smudger', x, y, r: DMG.smudgerR, m: 4, restitution: 0.1, friction: 0.8, data: { threat: 1, sleep: at, eatT: 0, touchT: 0, hopAt: at } });
}

/** Per substep, before integration: scissors fly, smudgers crawl, the Eraser moves. */
export function damageMotion(w: World, D: DamageState, h: number) {
  const g = w.guy;
  const gc = g?.alive ? guyCentre(w, g) : null;
  for (const b of w.bodies) {
    if (!b.alive || (b.data.sleep ?? 0) > w.t) continue;
    if (b.kind === 'scissors' && b.data.kin) {
      if (b.held >= 0) {
        // caught: no longer flying (a throw sends it away, spent)
        b.data.kin = 0;
        b.data.ghost = 0;
        b.data.threat = 0;
        b.data.spent = 1;
        continue;
      }
      // home in on him with a limited turn rate (it loops round when it misses)
      let hx = b.data.hx,
        hy = b.data.hy;
      if (hx === 0 && hy === 0 && gc) {
        const d = F.hypot(gc.x - b.x, gc.y - b.y) || 1;
        hx = (gc.x - b.x) / d;
        hy = (gc.y - b.y) / d;
      }
      if (gc) {
        const want = F.atan2(gc.y - b.y, gc.x - b.x);
        let a = F.atan2(hy, hx);
        let da = want - a;
        while (da > Math.PI) da -= 2 * Math.PI;
        while (da < -Math.PI) da += 2 * Math.PI;
        a += Math.max(-DMG.scissorsTurn * h, Math.min(DMG.scissorsTurn * h, da));
        hx = F.cos(a);
        hy = F.sin(a);
      }
      b.data.hx = hx;
      b.data.hy = hy;
      b.px = b.x;
      b.py = b.y;
      b.x += hx * b.data.speed * h;
      b.y += hy * b.data.speed * h;
      b.angle = F.atan2(hy, hx);
    } else if (b.kind === 'smudger') {
      // crawl to the nearest ink (or him), hopping now and then
      const t = nearestInk(w, b);
      if (!t) continue;
      const dir = Math.sign(t.x - b.x) || 1;
      const v = (b.x - b.px) / h;
      b.px = b.x - (v + (dir * DMG.smudgerSpeed - v) * 0.1) * h;
      if (b.data.grounded && w.t > b.data.hopAt) {
        b.data.hopAt = w.t + DMG.smudgerHop;
        if (t.y < b.y - 20) b.py = b.y + DMG.smudgerJump * h;
      }
    } else if (b.kind === 'eraser') eraserMotion(w, D, b, h, gc);
  }
}

function nearestInk(w: World, b: Body): { x: number; y: number } | null {
  const P = w.P;
  let best: { x: number; y: number } | null = null,
    bd = Infinity;
  for (const cr of w.creatures) {
    if (!cr.alive) continue;
    const c = w.centroid(cr);
    const d = Math.abs(c.x - b.x) + Math.abs(c.y - b.y) * 0.5;
    if (d < bd) {
      bd = d;
      // aim at its lowest point near the smudger's side
      let low = cr.ids[0];
      for (const i of cr.ids) if (P.y[i] > P.y[low] || (P.y[i] === P.y[low] && Math.abs(P.x[i] - b.x) < Math.abs(P.x[low] - b.x))) low = i;
      best = { x: P.x[low], y: P.y[low] };
    }
  }
  const g = w.guy;
  if (g?.alive) {
    const c = guyCentre(w, g);
    if (Math.abs(c.x - b.x) + Math.abs(c.y - b.y) * 0.5 < bd) best = c;
  }
  return best;
}

/** The Eraser: phase 1 it pushes along the floor at him (a motor, held and shoved back by
 *  bracers); phase 2 it hops at him; between hops it can be punched back. */
function eraserMotion(w: World, D: DamageState, b: Body, h: number, gc: { x: number; y: number } | null) {
  if (!gc || D.bossPhase >= 3) {
    b.px = b.x;
    return;
  }
  const dir = Math.sign(gc.x - b.x) || 1;
  b.data.dir = dir;
  const v = (b.x - b.px) / h;
  if (D.bossPhase === 2) {
    // hops: a scripted arc on its rail; in the air it is open to a punch
    if (!b.data.air && w.t >= b.data.hopAt) {
      b.data.air = 1;
      b.data.vy = -DMG.eraserHopV;
      b.px = b.x - dir * DMG.eraserHopVx * h;
    }
    if (b.data.air) {
      b.data.vy += w.gravity * h;
      b.data.rail += b.data.vy * h;
      if (b.data.rail >= b.data.ground) {
        b.data.rail = b.data.ground;
        b.data.air = 0;
        b.data.hopAt = w.t + DMG.eraserHopRest;
        b.px = b.x - v * 0.2 * h;
        w.emit({ type: 'thud', x: b.x, y: b.y + b.hh! });
      }
      return;
    }
    b.px = b.x - v * 0.8 * h;
    return;
  }
  // phase 1: the motor, less what the bracers push back with; a shove beats it and drives it back
  const lim = b.data.force / b.m;
  let a = Math.max(-lim, Math.min(lim, (dir * b.data.speed - v) / h));
  const push = braceOn(w, b) / b.m;
  if (push > 0) {
    a -= dir * push;
    const vn = v + a * h;
    if (dir * vn < -DMG.eraserBack) a = (-dir * DMG.eraserBack - v) / h;
  }
  b.px = b.x - (v + a * h) * h;
}

/** Per step, after the hazards and before the sever pass: cut, burn, eat and rub out. */
export function damageStep(w: World, D: DamageState) {
  const P = w.P;
  const g = w.guy;
  const erase = new Set<number>();
  const cutLinks: number[] = [];
  // scissors: every link passing the blades is cut; touching him is fatal
  for (const b of w.bodies) {
    if (!b.alive || b.kind !== 'scissors' || !b.data.kin || (b.data.sleep ?? 0) > w.t) continue;
    cutNear(w, b.x, b.y, b.r + DMG.scissorsCut, cutLinks);
    if (g?.alive && g.ids.some((i) => F.hypot(P.x[i] - b.x, P.y[i] - b.y) < b.r + 4)) killGuy(w, g, 'snipped');
    if (b.x < -80 || b.x > WORLD.W + 80 || b.y < -200 || b.y > WORLD.H + 80) b.data.hx = -b.data.hx;
  }
  // fire: the front runs along the floor; anything on the burning floor catches, fire climbs
  // links, and burnt points crumble
  for (const f of D.fires) {
    const d = f.def;
    if (w.t < d.at) continue;
    const dir = Math.sign(d.x1 - d.x0) || 1;
    f.front = d.x0 + dir * Math.min(Math.abs(d.x1 - d.x0), (d.speed ?? DMG.fireSpeed) * (w.t - d.at));
    const lo = Math.min(d.x0, f.front),
      hi = Math.max(d.x0, f.front);
    for (let i = 0; i < P.n; i++) {
      if (!(P.flags[i] & PF.ALIVE) || D.burn[i] || P.x[i] < lo || P.x[i] > hi || P.y[i] < d.y - DMG.fireH) continue;
      if (P.flags[i] & PF.GUY) {
        if (g?.alive) killGuy(w, g, 'burned');
        continue;
      }
      D.burn[i] = w.t;
    }
  }
  const C = w.C;
  let burning = false;
  for (let i = 0; i < P.n; i++) if (D.burn[i]) burning = true;
  if (burning) {
    for (let c = 0; c < C.n; c++) {
      if (C.dead[c] || C.type[c] === CT.GRAB) continue;
      const a = C.a[c],
        e = C.b[c];
      if (P.flags[a] & PF.GUY) continue;
      const ta = D.burn[a],
        te = D.burn[e];
      if (!ta === !te) continue;
      const lit = ta ? a : e,
        other = ta ? e : a;
      if (w.t - D.burn[lit] > C.rest[c] / DMG.burnSpeed) D.burn[other] = w.t;
    }
    for (let i = 0; i < P.n; i++) {
      if (!D.burn[i]) continue;
      if (!(P.flags[i] & PF.ALIVE)) {
        D.burn[i] = 0;
        continue;
      }
      if (w.t - D.burn[i] > DMG.burnLife) erase.add(i);
      // a burning point touching him sets him alight
      if (g?.alive && g.ids.some((j) => F.hypot(P.x[j] - P.x[i], P.y[j] - P.y[i]) < 2 * BODY.radius)) killGuy(w, g, 'burned');
    }
  }
  // smudgers eat what they touch; a stomp or a hit squashes them
  for (const b of w.bodies) {
    if (!b.alive || b.kind !== 'smudger' || (b.data.sleep ?? 0) > w.t) continue;
    if (squashed(w, b)) {
      b.alive = false;
      w.emit({ type: 'squish', x: b.x, y: b.y });
      continue;
    }
    b.data.eatT += WORLD.dt;
    const R = b.r + BODY.radius + 2;
    if (b.data.eatT >= DMG.eatEvery) {
      let best = -1,
        bd = R * R;
      for (let i = 0; i < P.n; i++) {
        if (!(P.flags[i] & PF.ALIVE) || P.flags[i] & PF.GUY) continue;
        const dd = (P.x[i] - b.x) ** 2 + (P.y[i] - b.y) ** 2;
        if (dd < bd) (bd = dd), (best = i);
      }
      if (best >= 0) {
        erase.add(best);
        b.data.eatT = 0;
      }
    }
    if (g?.alive) {
      const touch = g.ids.some((i) => F.hypot(P.x[i] - b.x, P.y[i] - b.y) < R);
      b.data.touchT = touch ? b.data.touchT + WORLD.dt : 0;
      if (b.data.touchT > DMG.nibble) killGuy(w, g, 'erased');
    }
  }
  // the Big Eraser rubs out whatever touches its faces, and him
  const boss = D.boss;
  if (boss?.alive && D.bossPhase > 0 && D.bossPhase < 3 && (boss.data.sleep ?? 0) <= w.t) {
    bossStep(w, D, boss);
    const reach = BODY.radius + 3;
    boss.data.rub = (boss.data.rub ?? 0) + DMG.rubRate * WORLD.dt;
    let n = 0;
    for (let i = 0; i < P.n; i++) {
      if (!(P.flags[i] & PF.ALIVE)) continue;
      if (Math.abs(P.x[i] - boss.x) > boss.hw! + reach || Math.abs(P.y[i] - boss.y) > boss.hh! + reach) continue;
      if (P.flags[i] & PF.GUY) {
        if (g?.alive) killGuy(w, g, 'erased');
        continue;
      }
      if (n + 1 > boss.data.rub) continue;
      erase.add(i);
      n++;
    }
    boss.data.rub = Math.min(1, boss.data.rub - n);
  }
  for (const c of cutLinks) w.cut(c, 'snip');
  if (erase.size) {
    for (let c = 0; c < C.n; c++) if (!C.dead[c] && C.type[c] !== CT.GRAB && (erase.has(C.a[c]) || erase.has(C.b[c]))) w.cut(c, 'erase');
    for (const i of erase) D.burn[i] = 0;
  }
}

/** Boss phases: shoved into the sharpener (phase 1 → 2), punched back into it mid-hop
 *  (2 → 3: it crumbles into smudgers), and beaten when the last smudger is squashed. */
function bossStep(w: World, D: DamageState, b: Body) {
  const sharp = b.data.home < WORLD.W / 2 ? DMG.sharpenerW : WORLD.W - DMG.sharpenerW;
  const side = b.data.home < WORLD.W / 2 ? -1 : 1; // the sharpener is on the Eraser's home side
  const inSharp = side < 0 ? b.x - b.hw! < sharp : b.x + b.hw! > sharp;
  if (D.bossPhase === 2 && b.data.air) {
    // a hard hit mid-air knocks it back toward the sharpener
    const hit = struckBox(w, b);
    if (hit) {
      b.px = b.x + side * DMG.eraserKnock * (WORLD.dt / WORLD.substeps) * -1;
      w.emit({ type: 'knock', x: b.x, y: b.y });
    }
  }
  if (inSharp) {
    w.emit({ type: 'grind', x: b.x, y: b.y });
    if (D.bossPhase === 1) {
      // sharpened: it comes out smaller and starts hopping
      D.bossPhase = 2;
      b.hw! *= 0.8;
      b.hh! *= 0.8;
      b.x = b.px = b.data.home - side * 60;
      b.data.ground = b.data.rail = b.data.ground + b.hh! * 0.25;
      b.data.hopAt = w.t + 1;
    } else {
      // ground down to crumbs: they come alive as smudgers
      D.bossPhase = 3;
      b.alive = false;
      for (let k = 0; k < DMG.crumbs; k++) addSmudger(w, b.x - side * (40 + k * 30), b.y, w.t + 0.4 + k * 0.15);
    }
  }
}

function struckBox(w: World, b: Body): boolean {
  const P = w.P;
  const h = WORLD.dt;
  for (const cr of w.creatures) {
    if (!cr.alive || w.t < cr.brain.actAt) continue;
    for (const i of strikers(w, cr)) {
      if (Math.abs(P.x[i] - b.x) > b.hw! + 10 || Math.abs(P.y[i] - b.y) > b.hh! + 10) continue;
      if (F.hypot(P.x[i] - P.sx[i], P.y[i] - P.sy[i]) / h > HAZ.strikeSpeed) return true;
    }
  }
  return false;
}

/** A smudger is squashed by ink landing on it from above, or by a hand, fist or spring hitting it. */
function squashed(w: World, b: Body): boolean {
  const P = w.P;
  const h = WORLD.dt;
  const R = b.r + BODY.radius + 3;
  for (let i = 0; i < P.n; i++) {
    if (!(P.flags[i] & PF.ALIVE) || P.flags[i] & PF.GUY) continue;
    const dx = P.x[i] - b.x,
      dy = P.y[i] - b.y;
    if (dx * dx + dy * dy > R * R) continue;
    const vy = (P.y[i] - P.sy[i]) / h;
    if (dy < 0 && vy > DMG.stomp) return true;
  }
  for (const cr of w.creatures) {
    if (!cr.alive || w.t < cr.brain.actAt) continue;
    for (const i of strikers(w, cr)) {
      const d = F.hypot(P.x[i] - b.x, P.y[i] - b.y);
      if (d < R && F.hypot(P.x[i] - P.sx[i], P.y[i] - P.sy[i]) / h > HAZ.strikeSpeed) return true;
    }
  }
  return false;
}

/** Links passing within R of (x, y). */
function cutNear(w: World, x: number, y: number, R: number, out: number[]) {
  const P = w.P,
    C = w.C;
  for (let c = 0; c < C.n; c++) {
    if (C.dead[c] || C.type[c] === CT.BEND || C.type[c] === CT.GRAB) continue;
    const a = C.a[c],
      e = C.b[c];
    if (P.flags[a] & PF.GUY) continue;
    const ax = P.x[a],
      ay = P.y[a];
    const sx = P.x[e] - ax,
      sy = P.y[e] - ay;
    const L2 = sx * sx + sy * sy;
    let t = L2 > 0 ? ((x - ax) * sx + (y - ay) * sy) / L2 : 0;
    t = t < 0 ? 0 : t > 1 ? 1 : t;
    const qx = ax + sx * t - x,
      qy = ay + sy * t - y;
    if (qx * qx + qy * qy < R * R) out.push(c);
  }
}

/** Boss levels: beaten once it has crumbled and the last smudger is gone. */
export function bossBeaten(w: World, D: DamageState): boolean {
  if (D.bossPhase !== 3) return false;
  if (w.bodies.some((b) => b.alive && b.kind === 'smudger')) return false;
  D.bossPhase = 4;
  return true;
}
