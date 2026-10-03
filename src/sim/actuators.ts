// Actuators (physics.md §6). All intent goes through `servo`, which rewrites a
// particle's implied velocity toward a desired one with a gain below 1. Targets
// are clamped to what the body can physically reach.
import { ACT, LOCO } from '../tuning';
import { PF } from './store';
import type { Creature, Limb, Spring } from './creature';
import type { World } from './world';
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
  b.wantVx = want;
  const stance = new Set<number>();
  if (feet.length) {
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
      }
    }
  }
  if (grounded && want !== 0) {
    const sm = Math.min(1.5, Math.max(0.3, (cr.stats.strength / cr.stats.mass) * 40));
    const gain = LOCO.gain * sm;
    for (const i of cr.ids) if (!stance.has(i)) servoX(w, i, want, gain, h);
    if (!feet.length) wriggle(w, cr, h, Math.sign(want));
  }
  // anticipation: lean into the move just before it starts
  if (!acting && b.mode === 'walk' && w.t > b.actAt - ACT.anticipation) {
    const hp = cr.head.kind === 'loop' && cr.loops[cr.head.loop] ? cr.loops[cr.head.loop].ring : [cr.head.point];
    for (const i of hp) servo(w, i, b.dir * 60, (w.P.y[i] - w.P.py[i]) / h, 0.2, h);
    react(w, cr, new Set(hp), h);
  }

  // ---------------- reach (hands)
  const hands = cr.limbs.filter((l) => !l.foot);
  for (const l of hands) l.reaching = false;
  if (acting && b.hasReach) {
    const range = senseRange(cr);
    for (const l of hands) {
      const tip = l.tip;
      const d = Math.hypot(b.reachX - P.x[tip], b.reachY - P.y[tip]);
      if (d > range) continue;
      reachTo(w, cr, l, b.reachX, b.reachY, h);
      react(w, cr, new Set(l.chain), h);
      // spring arm: punch when the target is in arm's reach
      if (l.spring >= 0 && d < l.len * 1.3) trigger(cr.springs[l.spring], 'punch');
    }
  }
  // toy jump: spring legs fire when the target is above the creature
  if (acting && b.hasReach && grounded) {
    let top = Infinity;
    for (const i of cr.ids) top = Math.min(top, P.y[i]);
    if (b.reachY < top - 40) for (const s of cr.springs) if (s.leg) trigger(s, 'jump');
  }
  runSprings(w, cr, h);

  // strain: stretch on driven limbs
  let strain = 0;
  for (const l of hands)
    if (l.reaching) {
      const dr = Math.hypot(P.x[l.tip] - P.x[l.root], P.y[l.tip] - P.y[l.root]);
      strain = Math.max(strain, dr / (l.len * ACT.reachEnvelope) - 0.85);
    }
  cr.face.strain += (Math.max(0, strain * 4) - cr.face.strain) * 0.05;
}

function reachTo(w: World, cr: Creature, l: Limb, tx: number, ty: number, h: number) {
  const P = w.P;
  const root = l.root;
  // clamp the target inside the limb's envelope (spike lesson: no skyhooks)
  let gx = tx - P.x[root],
    gy = ty - P.y[root];
  const gl = Math.hypot(gx, gy) || 1;
  const R = l.len * ACT.reachEnvelope * ACT.reachSlack;
  if (gl > R) {
    gx *= R / gl;
    gy *= R / gl;
  }
  const cx = P.x[root] + gx,
    cy = P.y[root] + gy;
  const tip = l.tip;
  const dx = cx - P.x[tip],
    dy = cy - P.y[tip];
  const d = Math.hypot(dx, dy) || 1e-6;
  const vmax = ACT.reachSpeed * (0.7 + 0.3 * Math.min(2, cr.stats.strength));
  const sp = Math.min(vmax, d * 8);
  const vx = (dx / d) * sp,
    vy = (dy / d) * sp;
  const n = Math.min(ACT.reachShares.length, l.chain.length);
  for (let k = 0; k < n; k++) servo(w, l.chain[k], vx * ACT.reachShares[k], vy * ACT.reachShares[k], ACT.reachGain, h);
  for (const id of l.chain) P.flags[id] |= PF.SOFT;
  l.reaching = true;
}

function startSwing(w: World, cr: Creature, l: Limb, dir: number) {
  const P = w.P;
  l.swing = true;
  l.fromX = P.x[l.tip];
  l.fromY = P.y[l.tip];
  // foothold one stride ahead of the hip (bounded by the leg's reach)
  const hipX = P.x[l.root];
  const reach = Math.min(cr.stats.stride, l.len * 0.9);
  const restDx = P.rx[l.tip] - P.rx[l.root];
  let tx = hipX + restDx * 0.5 + dir * reach * 0.6;
  tx = Math.max(6, Math.min(w.W - 6, tx));
  l.toX = tx;
  l.toY = w.groundY(tx, P.y[l.root]) - 5;
  if (!isFinite(l.toY) || l.toY > P.y[l.root] + l.len * 1.3) l.toY = P.y[l.tip];
}

function stepSwing(w: World, cr: Creature, l: Limb, s: number, h: number) {
  const P = w.P;
  const lift = Math.min(l.len * 0.45, cr.stats.stride * LOCO.stepLift);
  const ease = s * s * (3 - 2 * s);
  const px = l.fromX + (l.toX - l.fromX) * ease;
  const py = l.fromY + (l.toY - l.fromY) * ease - lift * Math.sin(Math.PI * Math.min(1, s * 1.05));
  const tip = l.tip;
  const dx = px - P.x[tip],
    dy = py - P.y[tip];
  const vmax = 1400;
  let vx = dx / (h * 6),
    vy = dy / (h * 6);
  const v = Math.hypot(vx, vy);
  if (v > vmax) {
    vx *= vmax / v;
    vy *= vmax / v;
  }
  servo(w, tip, vx, vy, 0.5, h);
  if (l.chain[1] !== undefined) servo(w, l.chain[1], vx * 0.6, vy * 0.6, 0.3, h);
  for (let k = 0; k < Math.min(3, l.chain.length); k++) P.flags[l.chain[k]] |= PF.SOFT;
  void cr;
}

/** Footless bodies creep with a visible travelling wriggle along their length. */
function wriggle(w: World, cr: Creature, h: number, dir: number) {
  const P = w.P;
  const omega = 2 * Math.PI * LOCO.wriggleFreq;
  for (const i of cr.ids) {
    const phase = (P.rx[i] * dir) / 40 - omega * w.t;
    const vy = -Math.max(0, Math.sin(phase)) * LOCO.wriggleAmp * omega * 0.5;
    const cy = (P.y[i] - P.py[i]) / h;
    P.py[i] = P.y[i] - (cy + (vy - cy) * 0.15) * h;
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
      case 'extend':
        C.rest[s.c] = s.len0 * extend;
        C.k[s.c] = ACT.springKFire;
        if (s.t >= eT) {
          s.state = 'recover';
          s.t = 0;
        }
        break;
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
