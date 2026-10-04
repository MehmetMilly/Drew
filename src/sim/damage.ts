// Chapter 5, The Eraser: things that destroy ink (physics.md §10). Scissors fly at Little Guy
// and cut every link they pass; fire runs along the floor and climbs links from the feet;
// smudgers crawl in and eat ink (stomp them); the Big Eraser rubs out what it touches, is
// shoved into the sharpener, hops, and finally crumbles into smudgers. Pure, deterministic.
import * as F from './fmath';
import { ACT, BODY, DMG, HAZ, WORLD } from '../tuning';
import { CT, PF } from './store';
import type { Body, World } from './world';
import { braceOn, strikers } from './hazards';
import { grab } from './actuators';
import { guyCentre, killGuy, type Guy } from './littleguy';

export type Damage =
  /** flying scissors: wake at `at` from (x, y) and fly at him, turning, cutting all they pass */
  | { type: 'scissors'; x: number; y: number; at: number; speed?: number }
  /** a fire along the floor at y, spreading from x0 toward x1 at `speed` px/s from `at` */
  | { type: 'fire'; x0: number; x1: number; y: number; at: number; speed?: number }
  /** a smudger: a little eraser critter that crawls at him, eating the ink in its way (stomp it) */
  | { type: 'smudger'; x: number; y: number; at: number }
  /** the Big Eraser (boss): starts at (x, y); the sharpener is at the page edge on that side */
  | { type: 'eraser'; x: number; y: number; at: number };

export interface DamageState {
  burn: Float32Array; // per particle: level time it caught fire (0 = not burning)
  fires: { def: Extract<Damage, { type: 'fire' }>; front: number }[];
  boss: Body | null;
  bossPhase: number; // 1 shove · 2 hops · 3 smudgers · 4 beaten
  phaseAt: number; // level time the current phase began
}

export function startDamage(w: World, defs: Damage[]): DamageState {
  const D: DamageState = { burn: new Float32Array(w.P.cap), fires: [], boss: null, bossPhase: 0, phaseAt: 0 };
  for (const d of defs) spawnDamage(w, D, d);
  return D;
}

function spawnDamage(w: World, D: DamageState, d: Damage) {
  if (d.type === 'scissors')
    w.addBody({ kind: 'scissors', x: d.x, y: d.y, r: DMG.scissorsR, m: 8, grabbable: true, data: { threat: 1, ghost: 1, sleep: d.at, kin: 1, speed: d.speed ?? DMG.scissorsSpeed, hx: 0, hy: 0, spent: 0, passes: 0, minD: 1e9, stunUntil: 0, kvx: 0, kvy: 0, leaving: 0 } });
  else if (d.type === 'fire') D.fires.push({ def: d, front: d.x0 });
  else if (d.type === 'smudger') addSmudger(w, d.x, d.y, d.at);
  else if (d.type === 'eraser') {
    D.boss = w.addBody({ kind: 'eraser', x: d.x, y: d.y, r: 0, hw: DMG.eraserW / 2, hh: DMG.eraserH / 2, m: DMG.eraserMass, data: { threat: 1, pusher: 1, shove: 1, sleep: d.at, dir: -1, speed: DMG.eraserSpeed, force: DMG.eraserForce, rail: d.y, home: d.x, hopAt: 0, vy: 0, air: 0, ground: d.y, base: d.y, grindUntil: 0, knocks: 0 } });
    D.bossPhase = 1;
    D.phaseAt = d.at;
  }
}

function addSmudger(w: World, x: number, y: number, at: number, speed: number = DMG.smudgerSpeed, crumb = 0) {
  return w.addBody({ kind: 'smudger', x, y, r: DMG.smudgerR, m: 4, restitution: 0.1, friction: 0.8, data: { threat: 1, stomp: 1, ghost: 1, sleep: at, eatT: 0, touchT: 0, hopAt: at, speed, crumb } });
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
      scissorsMotion(w, b, h, gc);
    } else if (b.kind === 'smudger') {
      // it goes for him, eating the ink it bumps into on the way (bait is just a snack);
      // stalled against something it hops over it
      const t = gc ?? nearestInk(w, b);
      if (!t) continue;
      const dir = Math.sign(t.x - b.x) || 1;
      const v = (b.x - b.px) / h;
      b.px = b.x - (v + (dir * b.data.speed - v) * DMG.smudgerGain) * h;
      b.data.stallT = b.data.grounded && Math.abs(v) < DMG.smudgerStallV ? (b.data.stallT ?? 0) + h : 0;
      const hopUp = t.y < b.y - 20 && w.t > b.data.hopAt;
      if (b.data.grounded && (hopUp || b.data.stallT > DMG.smudgerStall)) {
        b.data.hopAt = w.t + DMG.smudgerHop;
        b.data.stallT = 0;
        b.py = b.y + DMG.smudgerJump * h;
        b.px = b.x - dir * b.data.speed * h;
      }
    } else if (b.kind === 'eraser') eraserMotion(w, D, b, h, gc);
  }
}

/** Scissors: snap open and shut (the telegraph), then a pass at him, homing with a limited turn
 *  rate so a miss swings round wide into the next pass. A hard hit knocks them tumbling away
 *  (blades shut) for a moment; after DMG.scissorsPasses passes they give up and fly off the page. */
function scissorsMotion(w: World, b: Body, h: number, gc: { x: number; y: number } | null) {
  const wake = b.data.sleep ?? 0;
  b.px = b.x;
  b.py = b.y;
  if (w.t < wake + DMG.scissorsTell) return; // snapping in place: the telegraph
  if (w.t < b.data.stunUntil) {
    // knocked: tumbling away along the blow, slowing
    b.data.kvx *= 1 - DMG.scissorsDrag * h;
    b.data.kvy *= 1 - DMG.scissorsDrag * h;
    b.x += b.data.kvx * h;
    b.y += b.data.kvy * h;
    b.angle += 18 * h;
    return;
  }
  let hx = b.data.hx,
    hy = b.data.hy;
  if (hx === 0 && hy === 0) {
    const tx = gc ? gc.x : b.x,
      ty = gc ? gc.y : b.y + 1;
    const d = F.hypot(tx - b.x, ty - b.y) || 1;
    hx = (tx - b.x) / d;
    hy = (ty - b.y) / d;
    b.data.passes = 1;
  }
  if (b.data.leaving) {
    // spent: straight up and off the page
    const a = F.atan2(hy, hx);
    let da = -Math.PI / 2 - a;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    const na = a + Math.max(-DMG.scissorsTurn * 2 * h, Math.min(DMG.scissorsTurn * 2 * h, da));
    hx = F.cos(na);
    hy = F.sin(na);
  } else if (gc) {
    const want = F.atan2(gc.y - b.y, gc.x - b.x);
    let a = F.atan2(hy, hx);
    let da = want - a;
    while (da > Math.PI) da -= 2 * Math.PI;
    while (da < -Math.PI) da += 2 * Math.PI;
    a += Math.max(-DMG.scissorsTurn * h, Math.min(DMG.scissorsTurn * h, da));
    hx = F.cos(a);
    hy = F.sin(a);
    // a pass ends once it has gone by him: the next one starts as it swings round
    const d = F.hypot(gc.x - b.x, gc.y - b.y);
    if (d < b.data.minD) b.data.minD = d;
    else if (d > b.data.minD + DMG.scissorsMiss) {
      b.data.minD = 1e9;
      if (b.data.passes >= DMG.scissorsPasses) b.data.leaving = 1;
      else b.data.passes++;
    }
  }
  b.data.hx = hx;
  b.data.hy = hy;
  b.x += hx * b.data.speed * h;
  b.y += hy * b.data.speed * h;
  b.angle = F.atan2(hy, hx);
}

/** Scissors in flight: a hand that closes on them catches them before the blades bite; a hand,
 *  fist or punch moving at them fast knocks them tumbling away (that pass is over). */
function scissorsDefence(w: World, b: Body): boolean {
  const P = w.P;
  const h = WORLD.dt;
  for (const cr of w.creatures) {
    if (!cr.alive || w.t < cr.brain.actAt) continue;
    for (const l of cr.limbs) {
      if (l.foot || l.spring >= 0 || l.grabBody >= 0 || w.t - (b.data.thrownAt ?? -9) <= ACT.regrab) continue;
      const n = l.chain.length;
      for (let k = Math.max(0, n - DMG.scissorsCatch); k < n; k++) {
        const i = l.chain[k];
        if (F.hypot(P.x[i] - b.x, P.y[i] - b.y) < b.r + ACT.grabSlop) {
          grab(w, cr, l, b);
          b.data.kin = 0;
          b.data.ghost = 0;
          b.data.threat = 0;
          b.data.spent = 1;
          return true;
        }
      }
    }
  }
  const reach = b.r + BODY.radius + HAZ.strikeSlop;
  let best = 0,
    bx = 0,
    by = 0,
    who = -1;
  for (const cr of w.creatures) {
    if (!cr.alive || w.t < cr.brain.actAt) continue;
    for (const i of strikers(w, cr)) {
      const dx = b.x - P.x[i],
        dy = b.y - P.y[i];
      const d = F.hypot(dx, dy);
      if (d > reach || d < 1e-6) continue;
      const vx = (P.x[i] - P.sx[i]) / h,
        vy = (P.y[i] - P.sy[i]) / h;
      const toward = (vx * dx + vy * dy) / d;
      if (toward > best) (best = toward), (bx = dx / d), (by = dy / d), (who = cr.id);
    }
  }
  if (best < HAZ.strikeSpeed) return false;
  // knocked away from the hit, and a little up
  b.data.kvx = bx * DMG.scissorsKnock;
  b.data.kvy = by * DMG.scissorsKnock - DMG.scissorsKnockUp;
  const kl = F.hypot(b.data.kvx, b.data.kvy) || 1;
  b.data.hx = b.data.kvx / kl;
  b.data.hy = b.data.kvy / kl;
  b.data.stunUntil = w.t + DMG.scissorsStun;
  b.data.minD = 1e9;
  if (b.data.passes >= DMG.scissorsPasses) b.data.leaving = 1;
  else b.data.passes++;
  w.emit({ type: 'knock', cr: who, x: b.x, y: b.y, v: best });
  return true;
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

/** The sharpener's mouth (x) and which page edge it is on (+1 right, -1 left): the Eraser's home side. */
function sharpener(b: Body): { x: number; side: number } {
  const side = b.data.home < WORLD.W / 2 ? -1 : 1;
  return { x: side < 0 ? DMG.sharpenerW : WORLD.W - DMG.sharpenerW, side };
}

/** The Eraser (boss), per substep.
 *  Phase 1: a box pusher with a limited-force motor that slides at him; bracers hold it and drive
 *  it back, and whatever touches it is rubbed out. Phase 2 (sharpened smaller): it hops at him,
 *  too quick to brace; a hard hit in the air knocks it flying back toward the sharpener. While it
 *  is in the sharpener it is held there, grinding. */
function eraserMotion(w: World, D: DamageState, b: Body, h: number, gc: { x: number; y: number } | null) {
  if (!gc || D.bossPhase >= 3 || w.t < b.data.grindUntil) {
    b.px = b.x;
    return;
  }
  const dir = Math.sign(gc.x - b.x) || 1;
  b.data.dir = dir;
  const v = (b.x - b.px) / h;
  if (D.bossPhase === 2) {
    // hops: a scripted arc on its rail; in the air it is open to a punch
    if (!b.data.air && w.t >= b.data.hopAt) {
      // a leap meant to land on him, over whoever stands guard (as far as one leap carries)
      const up = Math.sqrt(2 * w.gravity * DMG.eraserLeapApex);
      const T = (2 * up) / w.gravity;
      const vx = Math.min(DMG.eraserHopVx, Math.abs(gc.x - b.x) / T);
      b.data.air = 1;
      b.data.vy = -up;
      b.px = b.x - dir * vx * h;
    }
    if (b.data.air) {
      b.data.vy += w.gravity * h;
      b.data.rail += b.data.vy * h;
      if (b.data.rail >= b.data.ground) {
        b.data.rail = b.data.ground;
        b.data.air = 0;
        b.data.hopAt = w.t + DMG.eraserHopRest;
        b.px = b.x - v * 0.2 * h;
        b.data.lob = 0;
        b.data.landed = 1; // it slams down: what it lands on is rubbed out (damageStep)
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
    if (!b.alive || b.kind !== 'scissors' || !b.data.kin || (b.data.sleep ?? 0) + DMG.scissorsTell > w.t) continue;
    if (b.data.leaving && (b.y < -120 || b.x < -120 || b.x > WORLD.W + 120)) {
      b.alive = false; // gone off the page
      continue;
    }
    // tumbling after a knock the blades are shut
    if (w.t < b.data.stunUntil || scissorsDefence(w, b)) continue;
    cutNear(w, b.x, b.y, b.r + DMG.scissorsCut, cutLinks);
    if (g?.alive && g.ids.some((i) => F.hypot(P.x[i] - b.x, P.y[i] - b.y) < b.r + 4)) killGuy(w, g, 'snipped');
    if (!b.data.leaving && (b.x < -80 || b.x > WORLD.W + 80)) b.data.hx = -b.data.hx;
    if (!b.data.leaving && (b.y < -200 || b.y > WORLD.H + 80)) b.data.hy = -b.data.hy;
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
    if (b.data.eatT >= DMG.eatEvery * (b.data.crumb ? DMG.crumbEatSlow : 1)) {
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
  // the Big Eraser rubs out whatever touches its faces (and him); landing from a hop it rubs out
  // everything under it
  const boss = D.boss;
  // the crumbs are loose: he backs into his corner, away from the sharpener they spill from
  if (boss && D.bossPhase === 3 && g?.alive && g.ride < 0 && g.heldBy < 0) {
    const edge = sharpener(boss).side > 0 ? DMG.fleeEdge : WORLD.W - DMG.fleeEdge;
    g.walkTo = Math.abs(guyCentre(w, g).x - edge) < 6 ? null : edge;
  }
  if (boss?.alive && D.bossPhase > 0 && D.bossPhase < 3 && (boss.data.sleep ?? 0) <= w.t) {
    bossStep(w, D, boss);
    if (g?.alive) fleeEraser(w, g, boss);
    const reach = BODY.radius + 3;
    const vx = Math.abs(boss.x - boss.sx) / WORLD.dt < DMG.rubStill ? 0 : boss.x - boss.sx;
    boss.data.rub = (boss.data.rub ?? 0) + DMG.rubRate * WORLD.dt;
    let slam = boss.data.landed;
    boss.data.landed = 0;
    // it wears ink down from the tips: of the points touching it, those furthest out on their
    // creature go first (a limb gets shorter rather than snapping off at the middle)
    const touching: { i: number; out: number }[] = [];
    for (let i = 0; i < P.n; i++) {
      if (!(P.flags[i] & PF.ALIVE)) continue;
      if (Math.abs(P.x[i] - boss.x) > boss.hw! + reach || Math.abs(P.y[i] - boss.y) > boss.hh! + reach) continue;
      if (P.flags[i] & PF.GUY) {
        if (g?.alive && w.t >= boss.data.grindUntil) killGuy(w, g, 'erased');
        continue;
      }
      if (slam && P.y[i] > boss.y && slam <= DMG.slamErase) {
        erase.add(i);
        slam++;
        continue;
      }
      // shoved, it only rubs what it slides into: a bracer driving it back is not worn away
      if (D.bossPhase === 1 && P.y[i] > boss.y - boss.hh! && (P.x[i] - boss.x) * vx <= 0) continue;
      const cr = w.creatures[P.owner[i]];
      const c = cr?.alive ? w.centroid(cr) : { x: P.x[i], y: P.y[i] };
      touching.push({ i, out: F.hypot(P.x[i] - c.x, P.y[i] - c.y) });
    }
    touching.sort((a, e) => e.out - a.out || a.i - e.i);
    let n = 0;
    for (const t of touching) {
      if (n + 1 > boss.data.rub) break;
      erase.add(t.i);
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

/** Boss phases: shoved into the sharpener it grinds for a moment and comes out smaller,
 *  hopping (phase 1 → 2); knocked back into it mid-hop it is ground to crumbs that spill out as
 *  smudgers (2 → 3); beaten when the last smudger is squashed (bossBeaten). */
function bossStep(w: World, D: DamageState, b: Body) {
  const { x: mouth, side } = sharpener(b);
  if (w.t < b.data.grindUntil) return;
  if (b.data.grinding) {
    // out of the sharpener: smaller, and hopping mad
    // it leaps out over whatever stands at the mouth
    b.data.grinding = 0;
    b.x = b.px = mouth - side * b.hw!;
    b.data.air = 1;
    b.data.vy = -DMG.eraserHopV;
    b.px = b.x + side * DMG.eraserOutVx * (WORLD.dt / WORLD.substeps);
    return;
  }
  if (D.bossPhase === 2 && b.data.air && !b.data.lob && w.t - (b.data.knockAt ?? -9) > DMG.eraserKnockCool && struckBox(w, b)) {
    // a hard hit mid-air knocks it flying: a lob that drops it back into the sharpener's mouth
    const h = WORLD.dt / WORLD.substeps;
    const dist = Math.abs(mouth + side * b.hw! * 0.5 - b.x);
    const T = Math.max(DMG.knockLobT, dist / DMG.eraserKnock);
    b.px = b.x - side * (dist / T) * h;
    b.data.vy = (b.data.ground - b.data.rail - 0.5 * w.gravity * T * T) / T;
    b.data.lob = 1;
    b.data.knockAt = w.t;
    b.data.knocks++;
    w.emit({ type: 'knock', x: b.x, y: b.y });
  }
  const inSharp = side < 0 ? b.x - b.hw! < mouth : b.x + b.hw! > mouth;
  if (!inSharp) return;
  if (D.bossPhase === 2 && !b.data.lob) {
    // it only goes back in knocked there: hopping or shoved, it bounces off the mouth
    b.x = b.px = mouth - side * (b.hw! + 1);
    return;
  }
  w.emit({ type: 'grind', x: b.x, y: b.y });
  if (D.bossPhase === 1 || b.data.knocks < DMG.knocksToCrumble) {
    // sharpened: held in the sharpener grinding, then out smaller, hopping (each time it is
    // knocked back in it comes out smaller still, until it crumbles)
    if (D.bossPhase === 1) (D.bossPhase = 2), (D.phaseAt = w.t);
    b.data.ground = b.data.rail = b.data.ground + b.hh! * (1 - DMG.eraserShrink);
    b.hw! *= DMG.eraserShrink;
    b.hh! *= DMG.eraserShrink;
    b.data.lob = 0;
    b.data.pusher = b.data.shove = 0; // too quick to brace now: it has to be hit
    b.data.grinding = 1;
    b.data.grindUntil = w.t + DMG.grindTime;
    b.data.air = 0;
    b.data.vy = 0;
    b.x = b.px = mouth + side * b.hw! * 0.5;
  } else {
    // ground down to crumbs: they spill out of the sharpener and come alive as smudgers
    D.bossPhase = 3;
    D.phaseAt = w.t;
    b.alive = false;
    for (let k = 0; k < DMG.crumbs; k++) addSmudger(w, mouth - side * 30, b.data.ground + b.hh! - DMG.smudgerR - 4, w.t + DMG.crumbsAt + k * DMG.crumbsEvery, DMG.crumbSpeed, 1);
  }
}

/** Little Guy keeps away from the Eraser: within DMG.fleeDist he walks off the other way (to the
 *  page edge, no further); in the sharpener it can't reach him. */
function fleeEraser(w: World, g: Guy, b: Body) {
  if (g.ride >= 0 || g.heldBy >= 0) return;
  const c = guyCentre(w, g);
  const near = Math.abs(c.x - b.x) - b.hw! < DMG.fleeDist && w.t >= b.data.grindUntil;
  if (!near) {
    if (b.data.fleeing) (g.walkTo = null), (b.data.fleeing = 0);
    return;
  }
  const away = Math.sign(c.x - b.x) || -1;
  g.walkTo = away < 0 ? DMG.fleeEdge : WORLD.W - DMG.fleeEdge;
  b.data.fleeing = 1;
  if (Math.abs(c.x - g.walkTo) < 6) g.walkTo = null;
}

/** A hand, fist or spring meeting it hard: what counts is how fast they close on each other, so a
 *  hand held up in its path stops a leap as well as a punch thrown at it. */
function struckBox(w: World, b: Body): boolean {
  const P = w.P;
  const h = WORLD.dt;
  const vbx = (b.x - b.sx) / h,
    vby = (b.y - b.sy) / h;
  for (const cr of w.creatures) {
    if (!cr.alive || w.t < cr.brain.actAt) continue;
    for (const i of strikers(w, cr)) {
      const dx = b.x - P.x[i],
        dy = b.y - P.y[i];
      if (Math.abs(dx) > b.hw! + DMG.knockSlop || Math.abs(dy) > b.hh! + DMG.knockSlop) continue;
      const d = F.hypot(dx, dy) || 1;
      const close = (((P.x[i] - P.sx[i]) / h - vbx) * dx + ((P.y[i] - P.sy[i]) / h - vby) * dy) / d;
      if (close > DMG.knockSpeed) return true;
    }
  }
  return false;
}

/** A smudger scuttles under ink (it does not bump it, it eats what it touches). It is squashed
 *  by a stomp, a foot of a creature heavy enough coming down on it, or by a hand, fist or spring
 *  hitting it (a brittle crumb of the Eraser by any part of a heavy enough body). Ink that only lies on it, or collapses onto it as it eats, is eaten too. */
function squashed(w: World, b: Body): boolean {
  const P = w.P;
  const h = WORLD.dt;
  const R = b.r + BODY.radius + 3;
  for (const cr of w.creatures) {
    if (!cr.alive || w.t < cr.brain.actAt) continue;
    const c = w.centroid(cr);
    if (Math.abs(c.x - b.x) > cr.stats.size + R) continue;
    if (cr.stats.mass >= DMG.stepMass)
      for (const l of cr.limbs) {
        if (!l.foot) continue;
        const i = l.tip;
        const dx = P.x[i] - b.x,
          dy = P.y[i] - b.y;
        if (dy < -R || dy > b.r) continue;
        // a foot coming down on it, or a planted foot it crawls under
        if (Math.abs(dx) < b.r + DMG.stepOn && (P.y[i] - P.sy[i]) / h > DMG.stomp) return true;
        if (P.flags[i] & PF.PINNED && Math.abs(dx) < b.r * DMG.underFoot) return true;
      }
    // the Eraser's crumbs are brittle: a body heavy enough crushes one it touches anywhere
    if (b.data.crumb && cr.stats.mass >= DMG.stepMass) for (const i of cr.ids) if (F.hypot(P.x[i] - b.x, P.y[i] - b.y) < R) return true;
    for (const i of strikers(w, cr)) {
      if (F.hypot(P.x[i] - b.x, P.y[i] - b.y) < R && F.hypot(P.x[i] - P.sx[i], P.y[i] - P.sy[i]) / h > HAZ.strikeSpeed) return true;
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
