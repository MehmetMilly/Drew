// Chapter 5 on the page: flying scissors, floor fire and burning ink, smudgers, the Big
// Eraser and its sharpener. Felt for the world's bodies, red for the parts that hurt.
import { COLORS, DMG } from '../tuning';
import type { Body, World } from '../sim/world';
import { PF } from '../sim/store';
import { hashNoise } from '../sim/rng';

type Ctx = CanvasRenderingContext2D;

/** Scissors: two felt finger loops, red blades that snap open and shut as they fly. */
export function drawScissors(g: Ctx, w: World, b: Body, x: number, y: number) {
  const flying = !!b.data.kin && w.t >= (b.data.sleep ?? 0);
  const open = flying ? 0.25 + 0.25 * Math.abs(Math.sin(w.t * 14)) : 0.08;
  g.save();
  g.translate(x, y);
  g.rotate(b.angle);
  g.scale(1.4, 1.4);
  g.lineCap = 'round';
  for (const s of [-1, 1]) {
    g.save();
    g.rotate(s * open);
    g.fillStyle = COLORS.red;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(30, s * 2);
    g.lineTo(0, s * 6);
    g.closePath();
    g.fill();
    g.strokeStyle = COLORS.felt;
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-12, s * 6);
    g.stroke();
    g.beginPath();
    g.ellipse(-20, s * 9, 8, 6, 0, 0, Math.PI * 2);
    g.stroke();
    g.restore();
  }
  g.fillStyle = COLORS.felt;
  g.beginPath();
  g.arc(0, 0, 3, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** A smudger: a crumb of eraser with stubby legs and hungry eyes; its mouth is red. */
export function drawSmudger(g: Ctx, w: World, b: Body, x: number, y: number) {
  if (w.t < (b.data.sleep ?? 0) - 0.3) return;
  const r = b.r;
  const step = Math.sin(w.t * 16 + b.id);
  g.save();
  g.translate(x, y);
  g.fillStyle = COLORS.felt;
  g.beginPath();
  g.roundRect(-r, -r * 0.8, r * 2, r * 1.6, r * 0.5);
  g.fill();
  g.strokeStyle = COLORS.felt;
  g.lineWidth = 2.5;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(-r * 0.5, r * 0.7);
  g.lineTo(-r * 0.6 - step * 3, r * 1.2);
  g.moveTo(r * 0.5, r * 0.7);
  g.lineTo(r * 0.6 + step * 3, r * 1.2);
  g.stroke();
  // chomping mouth
  const chew = 1 + Math.abs(Math.sin(w.t * 12 + b.id)) * 2.5;
  g.fillStyle = COLORS.red;
  g.fillRect(-r * 0.55, r * 0.15, r * 1.1, chew);
  g.fillStyle = COLORS.cream;
  g.beginPath();
  g.arc(-r * 0.35, -r * 0.25, 2.6, 0, Math.PI * 2);
  g.arc(r * 0.35, -r * 0.25, 2.6, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** The Big Eraser: a felt block with a red sleeve, scowling, leaning as it rubs forward. */
export function drawEraser(g: Ctx, w: World, b: Body, x: number, y: number) {
  const hw = b.hw!,
    hh = b.hh!;
  const dir = b.data.dir || -1;
  const lean = b.data.air ? 0 : Math.sin(w.t * 10) * 0.03;
  // phase 2 on (sharpened): the leading face is chewed ragged, the sleeve torn, and it
  // sheds crumbs; each knock back in chews it more (the phases must read at a glance)
  const worn = b.data.shove ? 0 : 1 + (b.data.knocks ?? 0);
  const shake = b.data.grinding && w.t < b.data.grindUntil ? Math.sin(w.t * 90) * 2.5 : 0;
  g.save();
  g.translate(x + shake, y);
  g.rotate(lean * dir);
  g.fillStyle = COLORS.felt;
  g.beginPath();
  if (!worn) g.roundRect(-hw, -hh, hw * 2, hh * 2, 14);
  else {
    // back face rounded, leading face a ragged bite
    const bite = 6 + worn * 5;
    g.moveTo(-dir * hw, -hh + 10);
    g.quadraticCurveTo(-dir * hw, -hh, -dir * (hw - 10), -hh);
    g.lineTo(dir * (hw - bite), -hh);
    const n = 5 + worn;
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const out = k % 2 ? bite : bite * 0.2 * (1 + hashNoise(k, worn, b.id));
      g.lineTo(dir * (hw - out), -hh + u * hh * 2);
    }
    g.lineTo(-dir * (hw - 10), hh);
    g.quadraticCurveTo(-dir * hw, hh, -dir * hw, hh - 10);
    g.closePath();
  }
  g.fill();
  // the sleeve (torn open once it has been through the sharpener)
  g.fillStyle = COLORS.red;
  const sx = -dir * hw * 0.1 - hw * 0.35,
    sw = hw * 0.7;
  if (!worn) g.fillRect(sx, -hh, sw, hh * 2);
  else {
    g.beginPath();
    g.moveTo(sx, -hh * 0.55);
    const n = 6;
    for (let k = 0; k <= n; k++) g.lineTo(sx + (k / n) * sw, -hh * 0.55 + (k % 2 ? -8 : 6));
    g.lineTo(sx + sw, hh * 0.75);
    for (let k = n; k >= 0; k--) g.lineTo(sx + (k / n) * sw, hh * 0.75 + (k % 2 ? 7 : -5));
    g.closePath();
    g.fill();
  }
  // brows and eyes on the leading end
  const ex = dir * hw * 0.62;
  g.fillStyle = COLORS.cream;
  g.beginPath();
  g.arc(ex - 9, -hh * 0.3, 6, 0, Math.PI * 2);
  g.arc(ex + 9, -hh * 0.3, 6, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = COLORS.cream;
  g.lineWidth = 3;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(ex - 18, -hh * 0.58);
  g.lineTo(ex - 4, -hh * 0.46);
  g.moveTo(ex + 18, -hh * 0.58);
  g.lineTo(ex + 4, -hh * 0.46);
  g.moveTo(ex - 10, hh * 0.2);
  g.lineTo(ex + 10, hh * 0.2);
  g.stroke();
  g.restore();
  // worn: crumbs keep falling off it, even mid-hop
  if (worn) {
    g.fillStyle = COLORS.felt;
    for (let k = 0; k < 3 + worn; k++) {
      const u = (w.t * 1.6 + k * 0.37) % 1;
      g.globalAlpha = 1 - u;
      g.beginPath();
      g.arc(x + (hashNoise(k, 2, b.id) * 0.8) * hw, y + hh + u * 40, 2.4, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
  // rubbings: crumbs fly off the face it pushes with
  if (!b.data.air && w.t >= (b.data.sleep ?? 0)) {
    g.fillStyle = COLORS.felt;
    for (let k = 0; k < 5; k++) {
      const u = (w.t * 3 + k * 0.2) % 1;
      g.globalAlpha = 1 - u;
      g.beginPath();
      g.arc(x + dir * (hw + 6 + u * 20), y + hh - 6 - u * 30 + hashNoise(k, 4, b.id) * 8, 2.2, 0, Math.PI * 2);
      g.fill();
    }
    g.globalAlpha = 1;
  }
}

/** Fire along the floor and on burning ink: red flame tongues that flicker. */
export function drawFire(g: Ctx, w: World) {
  const D = w.props?.dmg;
  if (!D) return;
  g.save();
  g.fillStyle = COLORS.red;
  for (const f of D.fires) {
    const d = f.def;
    if (w.t < d.at) continue;
    const lo = Math.min(d.x0, f.front),
      hi = Math.max(d.x0, f.front);
    for (let x = lo; x <= hi; x += 12) flame(g, x, d.y, 14 + 8 * Math.abs(hashNoise(Math.round(x), Math.floor(w.t * 12), 3)), w.t, x);
  }
  // burning ink: the stroke chars toward felt black where it burns, and small red flames lick
  // up from it (above it, never over it: the player's ink stays ink-coloured, critic-final #7)
  const P = w.P;
  g.fillStyle = COLORS.felt;
  for (let i = 0; i < P.n; i++) {
    if (!D.burn[i] || !(P.flags[i] & PF.ALIVE)) continue;
    const age = Math.min(1, (w.t - D.burn[i]) / DMG.burnLife);
    g.globalAlpha = 0.35 + 0.55 * age;
    g.beginPath();
    g.arc(P.x[i], P.y[i], 5.5, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  g.fillStyle = COLORS.red;
  for (let i = 0; i < P.n; i += 2) {
    if (!D.burn[i] || !(P.flags[i] & PF.ALIVE)) continue;
    const age = Math.min(1, (w.t - D.burn[i]) / DMG.burnLife);
    flame(g, P.x[i], P.y[i] - 6, 10 * (1 - age * 0.6), w.t, i);
  }
  g.restore();
}

function flame(g: Ctx, x: number, y: number, h: number, t: number, seed: number) {
  const sway = Math.sin(t * 13 + seed) * h * 0.25;
  g.beginPath();
  g.moveTo(x - h * 0.3, y);
  g.quadraticCurveTo(x - h * 0.3, y - h * 0.5, x + sway, y - h);
  g.quadraticCurveTo(x + h * 0.3, y - h * 0.5, x + h * 0.3, y);
  g.closePath();
  g.fill();
}

/** The sharpener at the page edge on the Eraser's side: a felt box with a blade-lined mouth. */
export function drawSharpener(g: Ctx, w: World) {
  const D = w.props?.dmg;
  if (!D?.boss) return;
  const b = D.boss;
  const left = b.data.home < w.W / 2;
  const x0 = left ? 0 : w.W - DMG.sharpenerW;
  // (on the floor where the Eraser started: it sinks a little each time it is sharpened smaller)
  const gy = b.data.base ?? b.data.ground;
  const top = gy - DMG.eraserH * 0.7,
    bot = gy + DMG.eraserH / 2;
  g.save();
  g.fillStyle = COLORS.felt;
  g.fillRect(left ? x0 - 30 : x0, top - 20, DMG.sharpenerW + 30, bot - top + 20);
  g.fillStyle = COLORS.cream;
  const mx = left ? x0 + DMG.sharpenerW - 10 : x0 + 10;
  g.fillRect(left ? mx - 4 : mx - 6, top, 10, bot - top - 10);
  // the blade
  g.fillStyle = COLORS.yellow; // the goal (what matters), not a threat
  g.beginPath();
  g.moveTo(mx, top + 6);
  g.lineTo(mx + (left ? -16 : 16), (top + bot) / 2);
  g.lineTo(mx, bot - 14);
  g.closePath();
  g.fill();
  g.restore();
}
