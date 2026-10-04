// Faces do the acting (design.md §9): wobbly drawn ovals, pupils that lead,
// saccades, blinks, brows by mode, sweat and strain, dizzy, happy, surprise.
import { COLORS, LOOK } from '../tuning';
import { hashNoise } from '../sim/rng';
import type { Creature } from '../sim/creature';

type Ctx = CanvasRenderingContext2D;

export interface FaceView {
  hx: number; // head centre
  hy: number;
  angle: number; // head tilt
  er: number; // eye radius
  gap: number; // half distance between eyes
  blinking: boolean;
  mode: Creature['brain']['mode'] | Creature['brain']['plan'];
  frame: number; // boil frame
  t: number;
  age: number; // sim seconds since birth
}

function wobblyOval(g: Ctx, x: number, y: number, rx: number, ry: number, key: number, frame: number) {
  g.beginPath();
  const N = 14;
  for (let i = 0; i <= N; i++) {
    const a = (i / N) * Math.PI * 2;
    const j = 1 + 0.07 * hashNoise(key, i % N, frame);
    const px = x + Math.cos(a) * rx * j,
      py = y + Math.sin(a) * ry * j;
    if (i === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

/** Eye scale over the first moments of life: shut slit → pop wide → settle. */
export function birthPop(age: number): { x: number; y: number } {
  const T = LOOK.birthPop;
  if (age >= T) return { x: 1, y: 1 };
  if (age < 0) return { x: 1, y: 0.08 };
  const u = age / T;
  // damped spring from 0 to 1 with ~35% overshoot
  const k = 1 - Math.exp(-6 * u) * Math.cos(9 * u);
  return { x: 0.85 + 0.15 * k + 0.1 * Math.sin(Math.PI * Math.min(1, u * 2.5)), y: Math.max(0.08, k) };
}

export function drawFace(g: Ctx, cr: Creature, v: FaceView) {
  const f = cr.face;
  const key = cr.seed & 0xffff;
  g.save();
  g.translate(v.hx, v.hy);
  g.rotate(v.angle);
  const sq = f.squash;
  // birth: the eyes pop open from a slit, overshoot, and settle (the magic trick)
  const pop = birthPop(v.age);
  const sx = (1 + 0.3 * sq) * pop.x,
    sy = (1 - 0.25 * sq) * pop.y;
  const wide = 1 + 0.25 * f.surprise;
  const er = v.er * wide;
  // look direction in head space
  const lx0 = f.lookX - v.hx,
    ly0 = f.lookY - v.hy;
  const ca = Math.cos(-v.angle),
    sa = Math.sin(-v.angle);
  const lx = lx0 * ca - ly0 * sa,
    ly = lx0 * sa + ly0 * ca;
  const ld = Math.hypot(lx, ly);
  // looking at the player (target ≈ head) → pupils centred
  const reach = Math.min(1, ld / 60);
  const px = ld > 1e-3 ? (lx / ld) * reach : 0,
    py = ld > 1e-3 ? (ly / ld) * reach : 0;
  const lw = Math.max(1.6, er * 0.22);
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const side of [-1, 1]) {
    const ex = side * v.gap,
      ey = 0;
    g.save();
    g.translate(ex, ey);
    g.scale(sx, sy);
    if (f.happy > 0.5 && !v.blinking) {
      // closed happy arcs
      g.strokeStyle = COLORS.felt;
      g.lineWidth = lw * 1.1;
      g.beginPath();
      g.arc(0, er * 0.35, er * 0.8, Math.PI * 1.1, Math.PI * 1.9);
      g.stroke();
    } else if (v.blinking) {
      g.strokeStyle = COLORS.felt;
      g.lineWidth = lw * 1.1;
      g.beginPath();
      g.moveTo(-er * 0.9, er * 0.1);
      g.quadraticCurveTo(0, er * 0.45, er * 0.9, er * 0.1);
      g.stroke();
    } else {
      wobblyOval(g, 0, 0, er * 0.88, er * 1.08, key + side * 7, v.frame);
      g.fillStyle = '#FFFFFF';
      g.fill();
      g.strokeStyle = COLORS.felt;
      g.lineWidth = lw;
      g.stroke();
      const pr = er * 0.46;
      const ppx = px * er * 0.42,
        ppy = py * er * 0.55;
      g.fillStyle = COLORS.felt;
      if (f.dizzy > 0.5) {
        g.strokeStyle = COLORS.felt;
        g.lineWidth = lw * 0.8;
        g.beginPath();
        for (let k = 0; k < 18; k++) {
          const a = k * 0.7 + v.t * 9 * side;
          const r = (k / 18) * er * 0.7;
          if (k === 0) g.moveTo(Math.cos(a) * r, Math.sin(a) * r);
          else g.lineTo(Math.cos(a) * r, Math.sin(a) * r);
        }
        g.stroke();
      } else {
        g.beginPath();
        g.arc(ppx, ppy, pr * (1 - 0.2 * f.surprise), 0, Math.PI * 2);
        g.fill();
        // tiny highlight sells the gloss of a drawn eye
        g.fillStyle = '#FFFFFF';
        g.beginPath();
        g.arc(ppx - pr * 0.35, ppy - pr * 0.35, Math.max(0.8, pr * 0.28), 0, Math.PI * 2);
        g.fill();
      }
    }
    g.restore();
    // brows show the mode
    let inner = 0,
      outer = 0; // y offsets (negative = up), in er units
    const m = v.mode;
    if (f.hurt > 0.3) {
      inner = 0.35;
      outer = -0.25; // angry
    } else if (m === 'brace' || f.strain > 0.35) {
      inner = 0.15;
      outer = 0.15; // straining: flat and low
    } else if (m === 'intercept' || m === 'walk' || m === 'reach' || m === 'carry') {
      inner = 0.3;
      outer = -0.1; // determined
    } else if (m === 'guard') {
      inner = -0.35;
      outer = 0.1; // worried
    } else {
      inner = -0.1;
      outer = -0.1;
    }
    if (f.surprise > 0.3) {
      inner = -0.6;
      outer = -0.6;
    }
    const by = -er * 1.45;
    g.strokeStyle = COLORS.felt;
    g.lineWidth = lw * 1.15;
    g.beginPath();
    const ix = ex - side * er * 0.15,
      ox = ex + side * er * 0.95;
    g.moveTo(ix, by + inner * er);
    g.lineTo(ox, by + outer * er);
    g.stroke();
  }
  // strain: comic effort marks around the head and a sweat drop (graphite: it's the
  // creature's own effort; red is for threats only). Big enough to read on a phone.
  if (f.strain > 0.25 || cr.brain.mode === 'brace') {
    const s = Math.min(1, f.strain + (cr.brain.mode === 'brace' ? 0.4 : 0));
    const flick = Math.floor(v.t * 10) % 2; // marks jitter at 10 Hz, like a held breath
    g.strokeStyle = COLORS.graphite;
    g.lineCap = 'round';
    g.lineWidth = 2.6;
    g.globalAlpha = 0.5 + 0.5 * s;
    const R = Math.max(v.gap * 2.4, er * 3.2);
    for (let k = 0; k < 3; k++) {
      const a = -Math.PI / 2 + (k - 1) * 0.55 + (flick ? 0.06 : -0.06);
      g.beginPath();
      g.moveTo(Math.cos(a) * R, Math.sin(a) * R - er);
      g.lineTo(Math.cos(a) * (R + er * 1.6), Math.sin(a) * (R + er * 1.6) - er);
      g.stroke();
    }
    g.globalAlpha = 1;
    const dropT = (v.t * 1.6 + (key % 10) / 10) % 1;
    g.fillStyle = '#FFFFFF';
    g.strokeStyle = COLORS.felt;
    g.lineWidth = 1.2;
    const dx = v.gap + er * 1.4,
      dy = -er * 1.2 + dropT * er * 1.4;
    g.globalAlpha = 1 - dropT;
    g.beginPath();
    g.moveTo(dx, dy - er * 0.5);
    g.quadraticCurveTo(dx + er * 0.32, dy, dx, dy + er * 0.25);
    g.quadraticCurveTo(dx - er * 0.32, dy, dx, dy - er * 0.5);
    g.fill();
    g.stroke();
    g.globalAlpha = 1;
  }
  // surprise "!"
  if (f.surprise > 0.2) {
    g.save();
    g.globalAlpha = Math.min(1, f.surprise * 2);
    g.fillStyle = COLORS.felt; // red "!" is reserved for threats
    g.font = `${Math.round(er * 2.6 + 10)}px "Gochi Hand", cursive`;
    g.textAlign = 'center';
    g.fillText('!', 0, -er * 2.1 - 4);
    g.restore();
  }
  g.restore();
}
