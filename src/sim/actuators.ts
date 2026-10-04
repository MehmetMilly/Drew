// Actuators (physics.md §6). All intent goes through `servo`, which rewrites a
// particle's implied velocity toward a desired one with a gain below 1. Targets
// are clamped to what the body can physically reach.
import * as F from './fmath';
import { ACT, GUY, LEVEL, LOCO, WORLD } from '../tuning';
import { PF } from './store';
import type { Creature, Limb, Spring } from './creature';
import type { Body, World } from './world';
import { senseRange } from './brain';

/** Momentum (m·Δv) added by servos since the last reaction, so limbs act as internal forces. */
const imp = { x: 0, y: 0 };

export function servo(w: World, i: number, vx: number, vy: number, gain: number, h: number) {
  const P = w.P;
  const cx = (P.x[i] - P.px[i]) / h,
    cy = (P.y[i] - P.py[i]) / h;
  const dvx = (vx - cx) * gain,
    dvy = (vy - cy) * gain;
  P.px[i] = P.x[i] - (cx + dvx) * h;
  P.py[i] = P.y[i] - (cy + dvy) * h;
  imp.x += P.m[i] * dvx;
  imp.y += P.m[i] * dvy;
}

/** Push the accumulated limb momentum back into the rest of the body (Newton's third law):
 *  a reaching arm can't lift its owner off the page. */
function react(w: World, cr: Creature, exclude: Set<number>, h: number) {
  if (imp.x === 0 && imp.y === 0) return;
  const P = w.P;
  let M = 0;
  for (const i of cr.ids) if (!exclude.has(i)) M += P.m[i];
  if (M > 0) {
    const dvx = imp.x / M,
      dvy = imp.y / M;
    for (const i of cr.ids) {
      if (exclude.has(i)) continue;
      P.px[i] += dvx * h;
      P.py[i] += dvy * h;
    }
  }
  imp.x = imp.y = 0;
}

function servoX(w: World, i: number, vx: number, gain: number, h: number) {
  const P = w.P;
  const cx = (P.x[i] - P.px[i]) / h;
  P.px[i] = P.x[i] - (cx + (vx - cx) * gain) * h;
}

export function actuate(w: World, cr: Creature, h: number) {
  const P = w.P,
    b = cr.brain;
  for (const i of cr.ids) P.flags[i] &= ~(PF.SOFT | PF.PINNED);
  const acting = w.t >= b.actAt;
  let grounded = 0;
  for (const i of cr.ids) if (P.flags[i] & PF.GROUND) grounded++;

  // ---------------- locomotion
  const feet = cr.limbs.filter((l) => l.foot);
  const walking = acting && b.mode === 'walk' && b.targetX !== null;
  const c = walking || feet.length ? w.centroid(cr) : null;
  let want = 0;
  if (walking && c) {
    const dx = b.targetX! - c.x;
    want = Math.sign(dx) * Math.min(cr.stats.speed, Math.abs(dx) * 3);
  }
  // ---------------- facing: a body with a front turns around to face where it goes
  if (cr.front !== 0 && want !== 0 && Math.sign(want) !== cr.front * cr.flipTo) cr.flipTo = -cr.flipTo;
  if (cr.flip !== cr.flipTo) {
    const step = (2 * h) / LOCO.turnTime;
    cr.flip = cr.flipTo > cr.flip ? Math.min(cr.flipTo, cr.flip + step) : Math.max(cr.flipTo, cr.flip - step);
    // never squash the body to a line: pass the thinnest part of the turn in one step
    if (Math.abs(cr.flip) < LOCO.turnSnap) cr.flip = cr.flipTo * LOCO.turnSnap;
    want *= LOCO.turnWalk; // mostly turn on the spot
    cr.turnedAt = w.t;
  }
  b.wantVx = want;
  cr.rolling = cr.gait === 'roll' && want !== 0; // stays on through the bounces of a tumble
  const stance = new Set<number>();
  if (feet.length && cr.gait !== 'hop') {
    if (Math.abs(want) > 5) b.gaitPhase += h * cr.stats.cadence * Math.min(1, Math.abs(want) / cr.stats.speed + 0.3);
    const phase = b.gaitPhase % 1;
    const swingGroup = Math.abs(want) > 5 && feet.length > 1 ? (phase < 0.5 ? 0 : 1) : feet.length === 1 && Math.abs(want) > 5 ? (phase < 0.5 ? 0 : -1) : -1;
    const s = (phase % 0.5) / 0.5; // progress within the current half-cycle
    for (const l of feet) {
      const swinging = l.group === swingGroup;
      if (swinging) {
        if (!l.swing) startSwing(w, cr, l, Math.sign(want));
        stepSwing(w, cr, l, s, h);
        react(w, cr, new Set(l.chain), h);
      } else {
        l.swing = false;
        stance.add(l.tip);
        if (P.flags[l.tip] & PF.GROUND) P.flags[l.tip] |= PF.PINNED;
        P.fr[l.tip] = b.plan === 'brace' ? ACT.braceFriction : 1; // feet dig in to brace
      }
    }
  }
  if (grounded && want !== 0) {
    const sm = Math.min(1.5, Math.max(0.3, (cr.stats.strength / cr.stats.mass) * 40));
    const gain = LOCO.gain * sm;
    if (cr.gait === 'roll') roll(w, cr, h, want * LOCO.rollSpeed);
    else if (cr.gait === 'hop') hop(cr, want);
    else if (feet.length) {
      for (const i of cr.ids) if (!stance.has(i)) servoX(w, i, want, gain, h);
    } else wriggle(w, cr, h, want, gain);
  }
  // hops carry the body forward through the air
  if (cr.gait === 'hop' && want !== 0) for (const s of cr.springs) if (s.leg && s.state === 'extend') for (const i of cr.ids) servoX(w, i, want * LOCO.hopForward, 0.12, h);
  // anticipation: lean into the move just before it starts
  if (!acting && b.mode === 'walk' && w.t > b.actAt - ACT.anticipation) {
    const hp = cr.head.kind === 'loop' && cr.loops[cr.head.loop] ? cr.loops[cr.head.loop].ring : [cr.head.point];
    for (const i of hp) servo(w, i, b.dir * 60, (w.P.y[i] - w.P.py[i]) / h, 0.2, h);
    react(w, cr, new Set(hp), h);
  }

  // ---------------- reach (hands)
  const hands = cr.limbs.filter((l) => !l.foot);
  for (const l of hands) l.reaching = false;
  // wind-up: just before acting, hands draw back away from the target
  if (!acting && b.hasReach && w.t > b.actAt - ACT.anticipation) {
    for (const l of hands) {
      const dx = b.reachX - P.x[l.root],
        dy = b.reachY - P.y[l.root];
      const d = F.hypot(dx, dy) || 1;
      reachTo(w, cr, l, P.x[l.root] - (dx / d) * l.len * ACT.windup, P.y[l.root] - (dy / d) * l.len * ACT.windup, h);
      react(w, cr, new Set(l.chain), h);
    }
  }
  // ---------------- held things: carry, then throw up and away from Little Guy
  for (const l of hands) if (l.grabBody >= 0) holdAndThrow(w, cr, l, h);
  // carrying Little Guy in a hand: hold him up by the shoulder, out of the way of the feet
  const guy = w.guy;
  const holding = guy && guy.alive && guy.heldBy === cr.id ? hands.find((l) => l.tip === guy.heldTip) : undefined;
  if (holding) {
    const dir = b.dir || 1;
    reachTo(w, cr, holding, P.x[holding.root] + dir * holding.len * 0.4, P.y[holding.root] - holding.len * 0.6, h);
    react(w, cr, new Set(holding.chain), h);
  }
  if (acting && b.hasReach) {
    const range = senseRange(cr);
    for (const l of hands) {
      if (l.grabBody >= 0 || l === holding) continue;
      const tip = l.tip;
      const d = F.hypot(b.reachX - P.x[tip], b.reachY - P.y[tip]);
      if (d > range) continue;
      reachTo(w, cr, l, b.reachX, b.reachY, h);
      react(w, cr, new Set(l.chain), h);
      // spring arm: punch when the target is in arm's reach (design §8: spring arms punch)
      if (l.spring >= 0) {
        // aim the punch at where the target will be when the spring fires
        const tb = b.targetBody >= 0 ? w.bodies[b.targetBody] : null;
        let qx = b.reachX,
          qy = b.reachY,
          rr = 0;
        if (tb && tb.alive) {
          const lead = ACT.punchCompressT + ACT.punchExtendT * 0.5;
          qx = tb.x + ((tb.x - tb.px) / h) * lead;
          qy = tb.y + ((tb.y - tb.py) / h) * lead;
          rr = tb.hw ? Math.min(tb.hw, tb.hh!) : tb.r; // a box: its nearer half-size
        }
        // ...from where the fist will be at full extension, along the spring
        const sp = cr.springs[l.spring];
        const ax = P.x[sp.b] - P.x[sp.a],
          ay = P.y[sp.b] - P.y[sp.a];
        const al = F.hypot(ax, ay) || 1;
        const reachOut = (ACT.punchExtend - 1) * sp.len0;
        const fx = P.x[tip] + (ax / al) * reachOut,
          fy = P.y[tip] + (ay / al) * reachOut;
        if (F.hypot(qx - fx, qy - fy) < rr + ACT.punchAim) trigger(sp, 'punch');
        continue;
      }
      // carry: the tip closes on Little Guy (design §8: a free hand grabs)
      // (any of his particles: the tip touching him shoves him, so it rarely reaches his chest)
      if (b.reachGuy && guy && guy.alive && guy.heldBy < 0 && guy.ride < 0 && !holding && w.t - (w.level?.tossedAt ?? -99) > GUY.tossClear && guy.ids.some((i) => F.hypot(P.x[i] - P.x[tip], P.y[i] - P.y[tip]) < ACT.grabGuy)) {
        guy.heldBy = cr.id;
        guy.heldTip = tip;
        guy.walkTo = null;
        w.emit({ type: 'grab', cr: cr.id, x: P.x[tip], y: P.y[tip] });
        continue;
      }
      // grab: the tip closes on a grabbable it wants
      const tb = b.targetBody >= 0 ? w.bodies[b.targetBody] : null;
      // (a SCORE ball passed to it is caught by any part of the arm: it is thrown to the hands)
      const near = (i: number) => F.hypot(tb!.x - P.x[i], tb!.y - P.y[i]) < tb!.r + ACT.grabSlop;
      if (tb && tb.alive && tb.grabbable && tb.held < 0 && w.t - (tb.data.thrownAt ?? -9) > ACT.regrab && (near(tip) || (tb.kind === 'cargo' && l.chain.some(near)))) grab(w, cr, l, tb);
    }
  }
  // carry: spring legs jump at a wall, ledge or gap ahead (the brain looks)
  if (acting && b.jump && grounded) for (const s of cr.springs) if (s.leg) trigger(s, 'jump');
  // toy jump: spring legs fire when the target is above the creature
  if (acting && b.hasReach && grounded) {
    let top = Infinity;
    for (const i of cr.ids) top = Math.min(top, P.y[i]);
    if (b.reachY < top - 40) for (const s of cr.springs) if (s.leg) trigger(s, 'jump');
  }
  for (const l of hands) {
    if (!l.reaching && (l.turn !== 0 || l.ext !== 1)) swingPose(l, 0, 1, ACT.swingRate * ACT.relaxRate * h);
    // a posed arm's shoulder goes slack so the arm turns as one piece
    const slack = Math.abs(l.turn) > 0.05 ? ACT.shoulderSlack : 1;
    for (let k = 0; k < l.joint.length; k++) if (!w.C.dead[l.joint[k]]) w.C.k[l.joint[k]] = l.jointK[k] * slack;
  }
  runSprings(w, cr, h);

  // strain: stretch on driven limbs
  let strain = 0;
  for (const l of hands)
    if (l.reaching) {
      const dr = F.hypot(P.x[l.tip] - P.x[l.root], P.y[l.tip] - P.y[l.root]);
      strain = Math.max(strain, dr / (l.len * ACT.reachEnvelope) - 0.85);
    }
  cr.face.strain += (Math.max(0, strain * 4) - cr.face.strain) * 0.05;
}

/** A hand closes on a body: it is held until thrown (physics.md §6). */
export function grab(w: World, cr: Creature, l: Limb, tb: Body) {
  tb.held = cr.id;
  tb.data.grabT = w.t;
  tb.data.by = cr.id;
  l.grabBody = tb.id;
  w.emit({ type: 'grab', cr: cr.id, x: tb.x, y: tb.y });
}

function reachTo(w: World, cr: Creature, l: Limb, tx: number, ty: number, h: number) {
  const P = w.P;
  const root = l.root;
  // clamp the target inside the limb's envelope (spike lesson: no skyhooks)
  let gx = tx - P.x[root],
    gy = ty - P.y[root];
  const gl = F.hypot(gx, gy) || 1;
  const R = l.len * ACT.reachEnvelope * ACT.reachSlack;
  if (gl > R) {
    gx *= R / gl;
    gy *= R / gl;
  }
  const vmax = ACT.reachSpeed * (0.7 + 0.3 * Math.min(2, cr.stats.strength));
  if (cr.flip !== cr.flipTo) return; // arms wait (and come home) while the body turns around
  l.reaching = true;
  if (!l.free) {
    // a limb tied to the body elsewhere can't swing as a piece: the hand alone strains for it
    const dx = P.x[root] + gx - P.x[l.tip],
      dy = P.y[root] + gy - P.y[l.tip];
    const d = F.hypot(dx, dy) || 1e-6;
    const sp = Math.min(vmax, d * 10);
    servo(w, l.tip, (dx / d) * sp, (dy / d) * sp, ACT.reachGain, h);
    for (const id of l.chain) P.flags[id] |= PF.SOFT;
    return;
  }
  // the whole arm swings from the shoulder keeping its drawn shape: the limb's pose in
  // shape matching turns about the root toward the (clamped) target, at a speed set by strength
  const fl = cr.flip;
  const rtx = (P.rx[l.tip] - P.rx[root]) * fl,
    rty = P.ry[l.tip] - P.ry[root];
  const raw = (cr as Creature & { angle?: number }).angle ?? 0;
  const bodyAng = cr.rolling ? raw : raw * (1 - cr.stats.balance);
  let turn = F.atan2(gy, gx) - bodyAng - F.atan2(rty, rtx);
  while (turn > Math.PI) turn -= 2 * Math.PI;
  while (turn < -Math.PI) turn += 2 * Math.PI;
  // it swings only until it would fold onto the body beside it (no arm through the chest)
  turn = Math.max(l.turnMin, Math.min(l.turnMax, turn));
  const rl = F.hypot(rtx, rty) || 1;
  swingPose(l, turn, Math.min(ACT.reachStretch, Math.max(1, F.hypot(gx, gy) / rl)), ACT.swingRate * (0.7 + 0.3 * Math.min(2, cr.stats.strength)) * h);
  // every point of the arm is carried to its place in the swung pose (shape matching agrees)
  const co = F.cos(l.turn + bodyAng) * l.ext,
    si = F.sin(l.turn + bodyAng) * l.ext;
  for (const i of l.chain) {
    if (i === root) continue;
    const ox = (P.rx[i] - P.rx[root]) * fl,
      oy = P.ry[i] - P.ry[root];
    const dx = P.x[root] + ox * co - oy * si - P.x[i],
      dy = P.y[root] + ox * si + oy * co - P.y[i];
    const d = F.hypot(dx, dy) || 1e-6;
    const sp = Math.min(vmax * ACT.poseSpeed, d * ACT.poseCatch);
    servo(w, i, (dx / d) * sp, (dy / d) * sp, ACT.poseGain, h);
  }
  l.reaching = true;
}

function holdAndThrow(w: World, cr: Creature, l: Limb, h: number) {
  const P = w.P;
  const body = w.bodies[l.grabBody];
  if (!body || !body.alive || body.held !== cr.id) {
    l.grabBody = -1;
    return;
  }
  const t = w.t - body.data.grabT;
  const goal = w.level?.def.goal;
  if (body.kind === 'cargo' && goal?.type === 'score') return void shoot(w, cr, l, body, goal.hoop, t, h);
  const g = w.guy;
  const gx = g && g.alive ? P.x[g.hip] : w.W / 2;
  const away = Math.sign(P.x[l.root] - gx) || cr.brain.dir || 1;
  if (t < ACT.holdTime) {
    // hold it up over the shoulder (wind-up)
    reachTo(w, cr, l, P.x[l.root] - away * l.len * 0.3, P.y[l.root] - l.len, h);
  } else {
    // swing up and away from Little Guy
    reachTo(w, cr, l, P.x[l.root] + away * l.len, P.y[l.root] - l.len * 0.7, h);
  }
  react(w, cr, new Set(l.chain), h);
  // the held thing rides on the hand
  const tip = l.tip;
  const dx = body.x - P.x[tip],
    dy = body.y - P.y[tip];
  const d = F.hypot(dx, dy) || 1;
  body.x = body.px = P.x[tip] + (dx / d) * body.r;
  body.y = body.py = P.y[tip] + (dy / d) * body.r;
  if (t >= ACT.holdTime + ACT.throwTime) {
    // release: speed scales with strength (puppeted intent; the flight is physics)
    const sp = ACT.throwSpeed * Math.min(1.4, Math.sqrt(cr.stats.strength));
    const ux = away * 0.6,
      uy = -0.8;
    body.held = -1;
    body.data.thrownAt = w.t;
    body.px = body.x - ux * sp * h;
    body.py = body.y - uy * sp * h;
    l.grabBody = -1;
    w.emit({ type: 'throw', cr: cr.id, x: body.x, y: body.y });
  }
}

/** The horizontal speed that carries a ball launched up at `vy` from (x, y) down through the rim
 *  at hoop.x. Solved by flying it (the world's drag slows a ball, so a drag-free arc lands short). */
function aimShot(x: number, y: number, vy: number, hoop: { x: number; y: number }, g: number, h: number): number {
  const cross = (vx: number): number => {
    let dx = vx * h,
      dy = vy * h,
      px = x,
      py = y;
    for (let k = 0; k < 400; k++) {
      dx *= 0.999;
      dy = dy * 0.999 + g * h * h;
      px += dx;
      py += dy;
      if (py >= hoop.y && dy > 0) return px;
    }
    return px;
  };
  let lo = -2000,
    hi = 2000;
  for (let k = 0; k < 24; k++) {
    const mid = (lo + hi) / 2;
    if (cross(mid) < hoop.x) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** SCORE: hold the ball up and shoot it when an arc through the hoop is in reach of the
 *  creature's arm (strength); a ball already over the rim is just dropped in (a dunk). */
function shoot(w: World, cr: Creature, l: Limb, body: Body, hoop: { x: number; y: number }, t: number, h: number) {
  const P = w.P;
  reachTo(w, cr, l, cr.brain.reachX, cr.brain.reachY, h);
  react(w, cr, new Set(l.chain), h);
  const tip = l.tip;
  const dx = body.x - P.x[tip],
    dy = body.y - P.y[tip];
  const d = F.hypot(dx, dy) || 1;
  body.x = body.px = P.x[tip] + (dx / d) * body.r;
  body.y = body.py = P.y[tip] + (dy / d) * body.r;
  if (t < ACT.holdTime) return;
  const g = w.gravity;
  const apex = hoop.y - ACT.shotApex;
  let vx = 0,
    vy = 0;
  if (Math.abs(body.x - hoop.x) < LEVEL.hoopW / 2 - body.r && body.y < hoop.y - body.r) {
    // over the rim: let go
  } else if (body.y > apex) {
    vy = -Math.sqrt(2 * g * (body.y - apex)) * ACT.shotLift;
    vx = aimShot(body.x, body.y, vy, hoop, g, h);
  } else {
    vx = (hoop.x - body.x) / Math.sqrt((2 * Math.max(1, hoop.y - body.y)) / g);
  }
  const most = ACT.throwSpeed * Math.min(1.4, Math.sqrt(cr.stats.strength)) * ACT.shotMax;
  if (F.hypot(vx, vy) > most) return; // out of range: keep holding it up (the brain walks closer)
  body.held = -1;
  body.data.thrownAt = w.t;
  body.data.clearUntil = w.t + WORLD.shotClear;
  body.px = body.x - vx * h;
  body.py = body.y - vy * h;
  l.grabBody = -1;
  w.emit({ type: vx || vy ? 'throw' : 'dunk', cr: cr.id, x: body.x, y: body.y });
}

/** Ease a limb's pose turn/stretch toward a goal, at most `step` rad this call. */
function swingPose(l: Limb, turn: number, ext: number, step: number) {
  const dt = turn - l.turn;
  l.turn += Math.max(-step, Math.min(step, dt));
  l.ext += Math.max(-step, Math.min(step, ext - l.ext));
}

function startSwing(w: World, cr: Creature, l: Limb, dir: number) {
  const P = w.P;
  l.swing = true;
  l.fromX = P.x[l.tip];
  l.fromY = P.y[l.tip];
  // foothold one stride ahead of the hip (bounded by the leg's reach)
  const hipX = P.x[l.root];
  const reach = Math.min(cr.stats.stride, l.len * 0.9);
  const restDx = (P.rx[l.tip] - P.rx[l.root]) * cr.flip;
  let tx = hipX + restDx * 0.5 + dir * reach * 0.6;
  tx = Math.max(6, Math.min(w.W - 6, tx));
  l.toX = tx;
  l.toY = w.groundY(tx, P.y[l.root]) - 5;
  if (!isFinite(l.toY) || l.toY > P.y[l.root] + l.len * 1.3) l.toY = P.y[l.tip];
}

function stepSwing(w: World, cr: Creature, l: Limb, s: number, h: number) {
  const P = w.P;
  const lift = Math.min(l.len * LOCO.liftCap, cr.stats.stride * LOCO.stepLift);
  const ease = s * s * (3 - 2 * s);
  const px = l.fromX + (l.toX - l.fromX) * ease;
  const py = l.fromY + (l.toY - l.fromY) * ease - lift * F.sin(Math.PI * Math.min(1, s * 1.05));
  const tip = l.tip;
  const dx = px - P.x[tip],
    dy = py - P.y[tip];
  const vmax = 1400;
  let vx = dx / (h * 6),
    vy = dy / (h * 6);
  const v = F.hypot(vx, vy);
  if (v > vmax) {
    vx *= vmax / v;
    vy *= vmax / v;
  }
  servo(w, tip, vx, vy, 0.5, h);
  if (l.chain[1] !== undefined) servo(w, l.chain[1], vx * 0.6, vy * 0.6, 0.3, h);
  for (let k = 0; k < Math.min(3, l.chain.length); k++) P.flags[l.chain[k]] |= PF.SOFT;
  void cr;
}

/** A legless loop rolls: a velocity field that turns the body about its centre so the
 *  contact point is at rest (rolling without slipping). Boxes roll like square wheels. */
function roll(w: World, cr: Creature, h: number, want: number) {
  // spin the body about its centre and let the page's friction turn spin into travel
  // (a tumble that catches its corners), with only a small push along the ground
  const P = w.P;
  const c = w.centroid(cr);
  const R = Math.max(20, cr.stats.size * 0.5);
  const om = (want / R) * LOCO.rollSpin;
  let vxm = 0,
    vym = 0,
    m = 0;
  for (const i of cr.ids) {
    vxm += ((P.x[i] - P.px[i]) / h) * P.m[i];
    vym += ((P.y[i] - P.py[i]) / h) * P.m[i];
    m += P.m[i];
  }
  vxm /= m;
  vym /= m;
  vxm += (want - vxm) * LOCO.rollPush;
  for (const i of cr.ids) {
    const vx = vxm - om * (P.y[i] - c.y),
      vy = vym + om * (P.x[i] - c.x);
    const cx = (P.x[i] - P.px[i]) / h,
      cy = (P.y[i] - P.py[i]) / h;
    P.px[i] = P.x[i] - (cx + (vx - cx) * LOCO.rollGain) * h;
    P.py[i] = P.y[i] - (cy + (vy - cy) * LOCO.rollGain) * h;
  }
}

/** Spring legs hop instead of walking: every leg spring fires as soon as it can. */
function hop(cr: Creature, want: number) {
  if (Math.abs(want) < 5) return;
  for (const s of cr.springs) if (s.leg) trigger(s, 'jump');
}

/** Footless bodies inch along: a travelling hump lifts part of the body and carries it
 *  forward while the rest stays planted on the page (the real caterpillar trick). */
function wriggle(w: World, cr: Creature, h: number, want: number, gain: number) {
  const P = w.P;
  const dir = Math.sign(want);
  const omega = 2 * Math.PI * LOCO.wriggleFreq;
  const wl = Math.max(60, cr.stats.size * LOCO.wriggleWave);
  // closed bodies (boxes, blobs) can barely hump: they shuffle
  const grip = cr.loops.length ? LOCO.wriggleGripLoop : LOCO.wriggleGrip;
  const amp = Math.min(LOCO.wriggleAmpMax, Math.max(LOCO.wriggleAmp, cr.stats.size * LOCO.wriggleAmpK));
  for (const i of cr.ids) {
    const phase = (2 * Math.PI * P.rx[i] * cr.flip * dir) / wl - omega * w.t;
    const up = Math.max(0, F.sin(phase));
    const vy = F.cos(phase) * (F.sin(phase) > 0 ? 1 : 0) * amp * omega;
    const cy = (P.y[i] - P.py[i]) / h;
    P.py[i] = P.y[i] - (cy + (vy - cy) * LOCO.wriggleHold) * h;
    // humped particles surge forward, planted ones hold
    servoX(w, i, want * (0.15 + up * LOCO.wriggleSurge), gain * (1 + up * grip), h);
  }
}

// ---------------- springs: punch (arms) and jump (legs)

function trigger(s: Spring, what: 'punch' | 'jump') {
  if (s.state !== 'idle' || s.cool > 0) return;
  if (what === 'jump' && !s.leg) return;
  s.state = 'compress';
  s.t = 0;
}

function runSprings(w: World, cr: Creature, h: number) {
  const C = w.C;
  for (const s of cr.springs) {
    s.cool = Math.max(0, s.cool - h);
    s.t += h;
    const leg = s.leg;
    const compress = leg ? ACT.jumpCompress : ACT.punchCompress;
    const cT = leg ? ACT.jumpCompressT : ACT.punchCompressT;
    const extend = leg ? ACT.jumpExtend : ACT.punchExtend;
    const eT = leg ? ACT.jumpExtendT : ACT.punchExtendT;
    switch (s.state) {
      case 'idle':
        C.rest[s.c] = s.len0;
        C.k[s.c] = ACT.springK;
        break;
      case 'compress': {
        const u = Math.min(1, s.t / cT);
        C.rest[s.c] = s.len0 * (1 - (1 - compress) * u);
        C.k[s.c] = ACT.springK;
        if (s.t >= cT) {
          s.state = 'extend';
          s.t = 0;
          w.emit({ type: leg ? 'jump' : 'punch', cr: cr.id, x: w.P.x[s.b], y: w.P.y[s.b] });
        }
        break;
      }
      case 'extend': {
        // release fast but not in a single step: an instant 1.45× jump in rest
        // length yanks neighbouring links past their tear limit
        const u = Math.min(1, s.t / (eT * 0.5));
        C.rest[s.c] = s.len0 * (compress + (extend - compress) * u);
        C.k[s.c] = ACT.springKFire;
        if (s.t >= eT) {
          s.state = 'recover';
          s.t = 0;
        }
        break;
      }
      case 'recover': {
        const u = Math.min(1, s.t / 0.2);
        C.rest[s.c] = s.len0 * (extend + (1 - extend) * u);
        C.k[s.c] = ACT.springK;
        if (u >= 1) {
          s.state = 'idle';
          s.cool = leg ? ACT.jumpCooldown : ACT.punchCooldown;
        }
        break;
      }
    }
  }
}
