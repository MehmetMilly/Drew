// Level things on the page: Little Guy (felt-tip, yellow scarf), red hazards, the
// countdown in the sky, blasts, the poof, the hug heart. Greybox-first, but in the
// game's materials: felt-tip black, danger red, highlighter yellow.
import { drawEraser, drawScissors, drawSmudger } from './damage';
import { ringTerrain } from '../sim/sumo';
import { NINJA } from '../sim/hazards';
import { COLORS, HAZ, LEVEL, LOOK } from '../tuning';
import { boil1 } from './boil';
import { drawChunk } from './props';
import type { World, Body } from '../sim/world';
import { countdown } from '../sim/level';
import type { Guy } from '../sim/littleguy';

type Ctx = CanvasRenderingContext2D;

export interface Burst {
  kind: 'boom' | 'poof' | 'heart' | 'bang';
  x: number;
  y: number;
  t0: number; // world time
}

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** A wobbly felt-tip circle path. */
function wobbleCircle(g: Ctx, x: number, y: number, r: number, key: number, frame: number, rot = 0) {
  g.beginPath();
  const n = Math.max(12, Math.round(r * 0.8));
  for (let k = 0; k <= n; k++) {
    const a = (k / n) * Math.PI * 2 + rot;
    const rr = r + boil1(key, k * 7, frame, 20) * LOOK.boilAmp * 0.8;
    const px = x + Math.cos(a) * rr,
      py = y + Math.sin(a) * rr;
    if (k === 0) g.moveTo(px, py);
    else g.lineTo(px, py);
  }
  g.closePath();
}

export function drawBodies(g: Ctx, w: World, alpha: number, frame: number) {
  for (const b of w.bodies) {
    if (!b.alive) continue;
    const x = lerp(b.sx, b.x, alpha),
      y = lerp(b.sy, b.y, alpha);
    if (b.kind === 'crusher') drawCrusher(g, b, x, frame);
    else if (b.kind === 'boulder') {
      drawBoulder(g, b, x, y, frame);
      if (b.data.grinding) drawCrumbs(g, w, x, y + b.r * 0.8, b.id);
    }
    else if (b.kind === 'bomb') drawBomb(g, w, b, x, y, frame);
    else if (b.kind === 'ninja') drawNinja(g, w, b, x, y, frame);
    else if (b.kind === 'ball') drawRubber(g, b, x, y, frame);
    else if (b.kind === 'cargo') drawCargo(g, b, x, y, frame);
    else if (b.kind === 'chunk') drawChunk(g, b, x, y);
    else if (b.kind === 'sumo') drawSumo(g, w, b, x, y, frame);
    else if (b.kind === 'scissors') drawScissors(g, w, b, x, y);
    else if (b.kind === 'smudger') drawSmudger(g, w, b, x, y);
    else if (b.kind === 'eraser') drawEraser(g, w, b, x, y);
  }
}

/** The sumo bully: a big felt belly, a red belt (he's the threat), a topknot, a scowl.
 *  He bobs while he stamps, then leans into the shove. */
function drawSumo(g: Ctx, w: World, b: Body, x: number, y: number, frame: number) {
  const stamping = w.t < (b.data.at ?? 0) + HAZ.sumoStamp;
  const bob = stamping && w.t >= (b.data.sleep ?? 0) ? Math.abs(Math.sin(w.t * 9)) * 6 : 0;
  const dir = b.data.dir ?? (w.guy ? Math.sign(w.P.x[w.guy.hip] - b.x) || 1 : 1);
  const r = b.r;
  g.save();
  g.translate(x, y - bob);
  g.fillStyle = COLORS.felt;
  wobbleCircle(g, 0, 0, r, b.id * 17 + 7, frame);
  g.fill();
  // legs stamping
  g.fillRect(-r * 0.6, r * 0.7, r * 0.4, r * 0.4 + bob);
  g.fillRect(r * 0.2, r * 0.7, r * 0.4, r * 0.4);
  // head and topknot
  g.beginPath();
  g.arc(dir * r * 0.35, -r * 0.95, r * 0.42, 0, Math.PI * 2);
  g.fill();
  g.beginPath();
  g.arc(dir * r * 0.3, -r * 1.42, r * 0.13, 0, Math.PI * 2);
  g.fill();
  // red belt
  g.fillStyle = COLORS.red;
  g.fillRect(-r * 0.95, r * 0.18, r * 1.9, r * 0.26);
  // scowl: paper eyes with heavy brows
  g.fillStyle = COLORS.cream;
  const ex = dir * r * 0.45;
  g.beginPath();
  g.arc(ex - 7, -r * 0.98, 4, 0, Math.PI * 2);
  g.arc(ex + 7, -r * 0.98, 4, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = COLORS.cream;
  g.lineWidth = 2.4;
  g.beginPath();
  g.moveTo(ex - 13, -r * 1.12);
  g.lineTo(ex - 3, -r * 1.05);
  g.moveTo(ex + 13, -r * 1.12);
  g.lineTo(ex + 3, -r * 1.05);
  g.stroke();
  g.restore();
}

/** A rubber ball (a threat): felt with a red band that spins with it. */
function drawRubber(g: Ctx, b: Body, x: number, y: number, frame: number) {
  g.fillStyle = COLORS.felt;
  wobbleCircle(g, x, y, b.r, b.id * 17 + 5, frame);
  g.fill();
  g.save();
  g.translate(x, y);
  g.rotate(b.angle);
  g.strokeStyle = COLORS.red;
  g.lineWidth = 4;
  g.beginPath();
  g.ellipse(0, 0, b.r * 0.62, b.r * 0.28, 0, 0, Math.PI * 2);
  g.stroke();
  g.restore();
}

/** A SCORE ball (cargo: highlighter yellow) with felt seams. */
function drawCargo(g: Ctx, b: Body, x: number, y: number, frame: number) {
  if (b.data.duck) return drawDuck(g, b, x, y);
  g.fillStyle = COLORS.yellow;
  wobbleCircle(g, x, y, b.r, b.id * 17 + 6, frame);
  g.fill();
  g.strokeStyle = COLORS.felt;
  g.lineWidth = 2.2;
  g.stroke();
  g.save();
  g.translate(x, y);
  g.rotate(b.angle);
  g.lineWidth = 1.6;
  g.beginPath();
  g.moveTo(-b.r, 0);
  g.lineTo(b.r, 0);
  g.moveTo(-b.r * 0.35, -b.r * 0.92);
  g.quadraticCurveTo(b.r * 0.25, 0, -b.r * 0.35, b.r * 0.92);
  g.moveTo(b.r * 0.35, -b.r * 0.92);
  g.quadraticCurveTo(-b.r * 0.25, 0, b.r * 0.35, b.r * 0.92);
  g.stroke();
  g.restore();
}

/** A rubber duck (cargo, so highlighter yellow), bobbing, facing the way it drifts. */
function drawDuck(g: Ctx, b: Body, x: number, y: number) {
  const r = b.r;
  const dir = b.x - b.sx < -0.05 ? -1 : 1;
  g.save();
  g.translate(x, y);
  g.scale(dir, 1);
  g.fillStyle = COLORS.yellow;
  g.strokeStyle = COLORS.felt;
  g.lineWidth = 2.2;
  g.beginPath();
  g.ellipse(0, r * 0.25, r * 1.1, r * 0.72, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  g.beginPath();
  g.arc(r * 0.55, -r * 0.5, r * 0.5, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  // beak and eye in felt
  g.beginPath();
  g.moveTo(r * 1.0, -r * 0.55);
  g.lineTo(r * 1.45, -r * 0.42);
  g.lineTo(r * 1.0, -r * 0.3);
  g.stroke();
  g.fillStyle = COLORS.felt;
  g.beginPath();
  g.arc(r * 0.68, -r * 0.62, 1.8, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

/** The little players (felt, a cap so he isn't mistaken for Little Guy): they stand under
 *  where their ball rests, arms up holding it, or waving for it back. */
export function drawPlayers(g: Ctx, w: World) {
  for (const b of w.bodies) {
    if (b.kind !== 'cargo' || b.data.duck) continue;
    const x = b.data.hx,
      hy = b.data.hy + b.r; // hands
    const has = b.data.parked && b.alive;
    const wave = has ? 0 : Math.sin(w.t * 9 + b.id) * 6;
    const head = hy + 12,
      neck = head + 8,
      hip = neck + 18,
      feet = hip + 18;
    g.save();
    g.strokeStyle = COLORS.felt;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.lineWidth = 3;
    g.beginPath();
    g.arc(x, head, 7, 0, Math.PI * 2);
    g.moveTo(x, neck);
    g.lineTo(x, hip);
    g.moveTo(x - 8, feet);
    g.lineTo(x, hip);
    g.lineTo(x + 8, feet);
    g.moveTo(x - 9 + wave * 0.3, hy - (has ? 0 : 4) + wave);
    g.lineTo(x, neck + 3);
    g.lineTo(x + 9 - wave * 0.3, hy - (has ? 0 : 4) - wave);
    g.stroke();
    // cap with a brim
    g.fillStyle = COLORS.felt;
    g.beginPath();
    g.arc(x, head - 2, 7.5, Math.PI, 0);
    g.fill();
    g.fillRect(x, head - 3, 11, 2.6);
    g.restore();
  }
}

/** Spike floors (a threat): felt teeth with red tips, standing on the ground. */
export function drawSpikes(g: Ctx, w: World) {
  const S = w.level?.def.entities.filter((e) => e.type === 'spikes') as { x0: number; x1: number; y: number }[] | undefined;
  if (!S?.length) return;
  g.save();
  g.lineJoin = 'round';
  for (const s of S) {
    const n = Math.max(1, Math.round((s.x1 - s.x0) / 18));
    const step = (s.x1 - s.x0) / n;
    g.fillStyle = COLORS.felt;
    g.beginPath();
    g.moveTo(s.x0, s.y + 2);
    for (let k = 0; k < n; k++) {
      g.lineTo(s.x0 + step * (k + 0.5), s.y - HAZ.spikeH);
      g.lineTo(s.x0 + step * (k + 1), s.y + 2);
    }
    g.closePath();
    g.fill();
    g.fillStyle = COLORS.red;
    for (let k = 0; k < n; k++) {
      const tx = s.x0 + step * (k + 0.5),
        ty = s.y - HAZ.spikeH;
      g.beginPath();
      g.moveTo(tx, ty - 1);
      g.lineTo(tx - 3.2, ty + 7);
      g.lineTo(tx + 3.2, ty + 7);
      g.closePath();
      g.fill();
    }
  }
  g.restore();
}

function drawBoulder(g: Ctx, b: Body, x: number, y: number, frame: number) {
  g.fillStyle = COLORS.felt;
  wobbleCircle(g, x, y, b.r, b.id * 17 + 1, frame);
  g.fill();
  // red crack marks that roll with it: it's the threat
  g.strokeStyle = COLORS.red;
  g.lineWidth = 3;
  g.lineCap = 'round';
  for (let k = 0; k < 3; k++) {
    const a = b.angle + (k * Math.PI * 2) / 3;
    g.beginPath();
    g.moveTo(x + Math.cos(a) * b.r * 0.25, y + Math.sin(a) * b.r * 0.25);
    g.lineTo(x + Math.cos(a + 0.3) * b.r * 0.6, y + Math.sin(a + 0.3) * b.r * 0.6);
    g.lineTo(x + Math.cos(a + 0.1) * b.r * 0.8, y + Math.sin(a + 0.1) * b.r * 0.8);
    g.stroke();
  }
}

function drawBomb(g: Ctx, w: World, b: Body, x: number, y: number, frame: number) {
  g.fillStyle = COLORS.felt;
  wobbleCircle(g, x, y, b.r, b.id * 17 + 2, frame);
  g.fill();
  g.strokeStyle = COLORS.red;
  g.lineWidth = 2.5;
  wobbleCircle(g, x, y, b.r - 3, b.id * 17 + 3, frame);
  g.stroke();
  // fuse with sputtering red sparks (telegraph)
  const fx = x + b.r * 0.5,
    fy = y - b.r * 0.9;
  g.strokeStyle = COLORS.felt;
  g.lineWidth = 2.5;
  g.beginPath();
  g.moveTo(x + b.r * 0.3, y - b.r * 0.7);
  g.quadraticCurveTo(fx + 4, fy - 2, fx + 6, fy - 8);
  g.stroke();
  if ((b.data.sleep ?? 0) <= w.t) {
    const fast = b.data.fuse < 1 ? 3 : 1;
    g.fillStyle = COLORS.red;
    for (let k = 0; k < 4; k++) {
      const a = (w.t * 9 * fast + k * 1.7) % (Math.PI * 2);
      const r = 3 + ((w.t * 30 + k * 5) % 6);
      g.fillRect(fx + 6 + Math.cos(a) * r - 1.2, fy - 8 + Math.sin(a) * r - 1.2, 2.4, 2.4);
    }
  }
}

function drawCrusher(g: Ctx, b: Body, x: number, frame: number) {
  const hw = b.hw!,
    hh = b.hh!,
    y = b.data.rail;
  g.fillStyle = COLORS.felt;
  g.fillRect(x - hw, y - hh, hw * 2, hh * 2);
  // saw teeth on the face that closes, in danger red
  if (b.data.teeth) {
    const side = b.data.dir; // +1 moves right: teeth on its right face
    const fx = x + side * hw;
    g.fillStyle = COLORS.red;
    g.beginPath();
    const n = Math.max(3, Math.round((hh * 2) / 22));
    for (let k = 0; k < n; k++) {
      const y0 = y - hh + (k * hh * 2) / n,
        y1 = y - hh + ((k + 1) * hh * 2) / n;
      g.moveTo(fx, y0);
      g.lineTo(fx + side * (12 + boil1(b.id, k * 9, frame, 20) * 0.8), (y0 + y1) / 2);
      g.lineTo(fx, y1);
    }
    g.fill();
  }
}

function drawNinja(g: Ctx, w: World, b: Body, x: number, y: number, frame: number) {
  const crouch = b.data.state === 0 && w.t >= b.data.at ? 0.75 : 1;
  const r = b.r;
  g.save();
  g.translate(x, y);
  g.scale(1 / crouch, crouch);
  g.fillStyle = COLORS.felt;
  wobbleCircle(g, 0, 0, r, b.id * 17 + 4, frame);
  g.fill();
  // red headband with trailing tails, eyes as a white slit
  g.fillStyle = COLORS.red;
  g.fillRect(-r, -r * 0.45, r * 2, r * 0.32);
  const tail = Math.sin(w.t * 14) * 3;
  g.beginPath();
  g.moveTo(-r, -r * 0.4);
  g.lineTo(-r - 12, -r * 0.6 + tail);
  g.lineTo(-r - 10, -r * 0.2 + tail);
  g.fill();
  const dizzy = b.data.state === NINJA.DIZZY;
  g.fillStyle = COLORS.cream;
  if (!dizzy) g.fillRect(-r * 0.6, -r * 0.08, r * 1.2, r * 0.22);
  else {
    // knocked silly: spiral eyes
    g.strokeStyle = COLORS.cream;
    g.lineWidth = 1.6;
    for (const ex of [-r * 0.35, r * 0.35]) {
      g.beginPath();
      for (let a = 0; a < 10; a += 0.4) g.lineTo(ex + Math.cos(a + w.t * 9) * a * 0.55, Math.sin(a + w.t * 9) * a * 0.55);
      g.stroke();
    }
  }
  g.restore();
  if (dizzy) {
    // three graphite stars circling his head
    g.save();
    g.fillStyle = COLORS.graphite;
    g.font = '16px "Gochi Hand", cursive';
    g.textAlign = 'center';
    for (let k = 0; k < 3; k++) {
      const a = w.t * 5 + (k * Math.PI * 2) / 3;
      g.fillText('*', x + Math.cos(a) * r * 1.2, y - r * 1.3 + Math.sin(a) * r * 0.35);
    }
    g.restore();
  } else if (b.data.state === NINJA.DASH) {
    // speed lines behind the dash
    const dir = Math.sign(b.x - b.px) || 1;
    g.save();
    g.strokeStyle = COLORS.graphite;
    g.globalAlpha = 0.5;
    g.lineWidth = 2;
    g.lineCap = 'round';
    for (let k = -1; k <= 1; k++) {
      g.beginPath();
      g.moveTo(x - dir * (r + 6), y + k * r * 0.45);
      g.lineTo(x - dir * (r + 26 + (k & 1) * 10), y + k * r * 0.45);
      g.stroke();
    }
    g.restore();
  }
  // "!" when it first activates
  if (w.t >= b.data.at && w.t < b.data.at + 0.6) drawBang(g, x, y - r - 26, w.t - b.data.at);
}

/** Graphite crumbs spitting from where a stalled boulder grinds ink. */
function drawCrumbs(g: Ctx, w: World, x: number, y: number, seed: number) {
  g.save();
  g.fillStyle = COLORS.graphite;
  for (let k = 0; k < 6; k++) {
    const ph = (w.t * 3 + k / 6 + seed * 0.13) % 1;
    const side = k % 2 ? 1 : -1;
    g.globalAlpha = 1 - ph;
    g.beginPath();
    g.arc(x + side * (10 + ph * 30 + k * 3), y - ph * 24 + ph * ph * 30, 1.8, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}

export function drawBang(g: Ctx, x: number, y: number, age: number, color: string = COLORS.red) {
  const s = Math.min(1, age / 0.08) * (age > 0.45 ? Math.max(0, 1 - (age - 0.45) / 0.15) : 1);
  if (s <= 0) return;
  g.save();
  g.translate(x, y);
  g.scale(s, s);
  g.fillStyle = color;
  g.font = 'bold 30px "Gochi Hand", cursive';
  g.textAlign = 'center';
  g.fillText('!', 0, 0);
  g.restore();
}

/** Little Guy: felt-tip stick figure, round filled head, dot eyes, a yellow scarf. */
export function drawGuy(g: Ctx, w: World, guy: Guy, alpha: number, frame: number) {
  if (!guy.alive) return;
  const P = w.P;
  const X = (i: number) => lerp(P.sx[i], P.x[i], alpha),
    Y = (i: number) => lerp(P.sy[i], P.y[i], alpha);
  const hx = X(guy.head),
    hy = Y(guy.head),
    cx = X(guy.chest),
    cy = Y(guy.chest),
    ix = X(guy.hip),
    iy = Y(guy.hip);
  // contact shadow
  g.fillStyle = 'rgba(58,58,64,0.18)';
  g.beginPath();
  g.ellipse(ix, Math.max(Y(guy.footL), Y(guy.footR)) + 4, 12, 3, 0, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = COLORS.felt;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.lineWidth = 3.4;
  const kick = guy.heldBy >= 0 || guy.mood === 'flail' ? Math.sin(guy.kick) * 4 : 0;
  g.beginPath();
  g.moveTo(cx, cy);
  g.lineTo(ix, iy);
  g.moveTo(X(guy.footL) + kick, Y(guy.footL));
  g.lineTo(ix, iy);
  g.lineTo(X(guy.footR) - kick, Y(guy.footR));
  // arms: one to the hand, one hanging (cowering: both up over the head)
  g.moveTo(X(guy.hand), Y(guy.hand));
  g.lineTo(cx, cy + 2);
  if (guy.mood === 'cower') g.lineTo(cx - 6 * guy.facing, cy - 12);
  else if (guy.mood === 'happy') g.lineTo(cx - 9 * guy.facing, cy - 8);
  else g.lineTo(cx - 6 * guy.facing, cy + 9);
  g.stroke();
  // scarf: highlighter yellow, trailing opposite his motion
  const vx = (P.x[guy.chest] - P.sx[guy.chest]) * 60;
  const trail = Math.max(-1, Math.min(1, -vx / 200)) || -guy.facing * 0.4;
  g.strokeStyle = COLORS.yellow;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(cx - 4, cy - 1);
  g.lineTo(cx + 4, cy - 1);
  g.moveTo(cx, cy);
  g.quadraticCurveTo(cx + trail * 8, cy + 2 + Math.sin(w.t * 9) * 1.5, cx + trail * 13, cy + 5 + Math.sin(w.t * 9 + 1) * 2);
  g.stroke();
  // head
  const hr = 7;
  g.fillStyle = COLORS.felt;
  wobbleCircle(g, hx, hy, hr, 991, frame);
  g.fill();
  // eyes: white dots looking where he looks
  const lx = Math.max(-1, Math.min(1, (guy.lookX - hx) / 80)) * 1.6;
  const ly = Math.max(-1, Math.min(1, (guy.lookY - hy) / 80)) * 1.2;
  g.fillStyle = COLORS.cream;
  if (guy.mood === 'happy') {
    g.strokeStyle = COLORS.cream;
    g.lineWidth = 1.4;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(hx + s * 2.6, hy, 1.4, Math.PI, 0);
      g.stroke();
    }
  } else {
    const er = guy.mood === 'startle' || guy.mood === 'cower' ? 1.6 : 1.2;
    for (const s of [-1, 1]) {
      g.beginPath();
      g.arc(hx + s * 2.6 + lx, hy - 0.5 + ly, er, 0, Math.PI * 2);
      g.fill();
    }
  }
  // hats
  if (guy.hat === 'crown') {
    g.fillStyle = COLORS.yellow;
    g.strokeStyle = COLORS.felt;
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(hx - 7, hy - 5);
    g.lineTo(hx - 7, hy - 14);
    g.lineTo(hx - 3.5, hy - 9);
    g.lineTo(hx, hy - 15);
    g.lineTo(hx + 3.5, hy - 9);
    g.lineTo(hx + 7, hy - 14);
    g.lineTo(hx + 7, hy - 5);
    g.closePath();
    g.fill();
    g.stroke();
  } else if (guy.hat === 'party') {
    g.fillStyle = COLORS.yellow;
    g.beginPath();
    g.moveTo(hx - 5, hy - 5);
    g.lineTo(hx + 1, hy - 20);
    g.lineTo(hx + 6, hy - 4);
    g.closePath();
    g.fill();
  } else if (guy.hat === 'gyoji') {
    // the sumo referee's tall black cap, leaning back, with its tie under the chin
    g.fillStyle = COLORS.felt;
    g.beginPath();
    g.moveTo(hx - 6, hy - 5);
    g.quadraticCurveTo(hx - 7, hy - 16, hx - 2, hy - 21);
    g.lineTo(hx + 4, hy - 19);
    g.quadraticCurveTo(hx + 7, hy - 12, hx + 6, hy - 5);
    g.closePath();
    g.fill();
    g.strokeStyle = COLORS.felt;
    g.lineWidth = 1.2;
    g.beginPath();
    g.moveTo(hx - 6, hy - 5);
    g.quadraticCurveTo(hx, hy + 7, hx + 6, hy - 5);
    g.stroke();
  }
  if (guy.mood === 'startle' && w.t - guy.moodT < 0.6) drawBang(g, hx + 8, hy - 14, w.t - guy.moodT, COLORS.felt); // his surprise, not a threat
}

/** Blasts, poofs, hearts. */
export function drawBursts(g: Ctx, bursts: Burst[], t: number) {
  for (const b of bursts) {
    const age = t - b.t0;
    if (b.kind === 'boom') {
      if (age > 0.6) continue;
      const k = age / 0.6;
      g.save();
      g.globalAlpha = k < 0.5 ? 1 : 2 - 2 * k; // full strength, then gone: the biggest event reads
      g.strokeStyle = COLORS.felt;
      g.lineWidth = 6;
      g.beginPath();
      // a felt-tip scribble burst
      for (let i = 0; i < 26; i++) {
        const a = i * 2.39996;
        const r = (30 + 140 * Math.sqrt(k)) * (0.6 + 0.4 * ((i * 37) % 10) / 10);
        g.moveTo(b.x + Math.cos(a) * r * 0.3, b.y + Math.sin(a) * r * 0.3);
        g.lineTo(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r);
      }
      g.stroke();
      g.fillStyle = COLORS.red;
      g.font = 'bold 58px "Gochi Hand", cursive';
      g.textAlign = 'center';
      g.fillText('BOOM', b.x, b.y - 40 - k * 30);
      g.restore();
    } else if (b.kind === 'poof') {
      if (age > 1.4) continue;
      const k = Math.min(1, age / 0.25);
      g.save();
      g.globalAlpha = age > 0.9 ? 1 - (age - 0.9) / 0.5 : 1;
      g.strokeStyle = COLORS.graphite;
      g.lineWidth = 2;
      g.beginPath();
      for (let i = 0; i < 40; i++) {
        const a = i * 2.39996,
          r = 6 + ((i * 53) % 22) * k;
        g.moveTo(b.x + Math.cos(a) * r, b.y + Math.sin(a) * r * 0.8);
        g.lineTo(b.x + Math.cos(a + 1.1) * r * 0.7, b.y + Math.sin(a + 1.1) * r * 0.6);
      }
      g.stroke();
      // ✗ eyes
      g.strokeStyle = COLORS.felt;
      g.lineWidth = 2;
      for (const s of [-1, 1]) {
        const ex = b.x + s * 6,
          ey = b.y - 2;
        g.beginPath();
        g.moveTo(ex - 3, ey - 3);
        g.lineTo(ex + 3, ey + 3);
        g.moveTo(ex + 3, ey - 3);
        g.lineTo(ex - 3, ey + 3);
        g.stroke();
      }
      g.fillStyle = COLORS.graphite;
      g.font = '18px "Gochi Hand", cursive';
      g.textAlign = 'center';
      g.fillText('aaa', b.x + 18, b.y - 22 - age * 20);
      g.restore();
    } else if (b.kind === 'heart') {
      if (age > 1.6) continue;
      const s = Math.min(1, age / 0.15) * (1 + 0.15 * Math.sin(age * 12) * Math.max(0, 1 - age));
      g.save();
      g.translate(b.x, b.y - 30 - age * 18);
      g.scale(s, s);
      g.globalAlpha = age > 1.2 ? 1 - (age - 1.2) / 0.4 : 1;
      // highlighter heart with a felt outline (red is for threats only)
      g.fillStyle = COLORS.yellow;
      g.strokeStyle = COLORS.felt;
      g.lineWidth = 2;
      g.lineJoin = 'round';
      g.beginPath();
      g.moveTo(0, 6);
      g.bezierCurveTo(-14, -4, -8, -14, 0, -6);
      g.bezierCurveTo(8, -14, 14, -4, 0, 6);
      g.fill();
      g.stroke();
      g.restore();
    }
  }
}

/** The giant red countdown numerals in the sky (SAVE levels), pulsing on the last three. */
export function drawCountdown(g: Ctx, w: World) {
  const left = countdown(w);
  if (left === null || !w.level || w.level.result !== 'play') return;
  const n = Math.ceil(left);
  if (n <= 0) return;
  const frac = n - left; // 0 → 1 within the second
  const pulse = n <= 3 ? 1 + 0.25 * Math.max(0, 1 - frac * 4) : 1;
  g.save();
  g.translate(w.W / 2, 190);
  g.scale(pulse, pulse);
  g.fillStyle = COLORS.red;
  g.globalAlpha = w.level.startedAt < 0 ? 0.35 : 0.9;
  g.font = '150px "Gochi Hand", cursive';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText(String(n), 0, 0);
  g.restore();
}

/** HOME's flag (look-and-feel: goals are highlighter yellow): a felt pole and a waving pennant. */
export function drawGoal(g: Ctx, w: World) {
  const goal = w.level?.def.goal;
  if (goal?.type === 'score') return drawHoop(g, w, goal.hoop, goal.n);
  if (!goal || goal.type !== 'home') return;
  const { x, y } = goal;
  const top = y - LEVEL.flagH;
  g.save();
  g.lineCap = 'round';
  g.strokeStyle = COLORS.felt;
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(x, y);
  g.lineTo(x + 1, top);
  g.stroke();
  const wave = Math.sin(w.t * 5) * 4;
  g.fillStyle = COLORS.yellow;
  g.globalAlpha = 0.9;
  g.beginPath();
  g.moveTo(x + 1, top);
  g.quadraticCurveTo(x + 24, top + 6 + wave, x + 48, top + 14 + wave * 1.4);
  g.quadraticCurveTo(x + 24, top + 22 + wave, x + 1, top + 34);
  g.closePath();
  g.fill();
  g.globalAlpha = 1;
  g.lineWidth = 2;
  g.stroke();
  g.restore();
}

/** SCORE's hoop: a felt pole and backboard, the rim in highlighter yellow (it is the goal), a
 *  felt net, and one yellow tally dot per point needed on the board. */
function drawHoop(g: Ctx, w: World, hoop: { x: number; y: number; bucket?: boolean }, n: number) {
  const L = w.level!;
  if (hoop.bucket) return drawBucket(g, w, hoop, n);
  const side = hoop.x > w.W / 2 ? 1 : -1; // the backboard is on the far side of the page
  const half = LEVEL.hoopW / 2;
  const bx = hoop.x + side * (half + 6);
  // the pole runs down to the ground under the board
  let gy = hoop.y;
  const px = bx + side * 14;
  while (gy < w.H && w.terrainDepth(px, gy, 1) <= 0) gy += 6;
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  g.strokeStyle = COLORS.felt;
  g.lineWidth = 5;
  g.beginPath();
  g.moveTo(px, gy);
  g.lineTo(px, hoop.y - LEVEL.hoopBoard * 0.5);
  g.lineTo(bx, hoop.y - LEVEL.hoopBoard * 0.5);
  g.stroke();
  // backboard
  g.lineWidth = 3;
  g.strokeRect(Math.min(bx, bx + side * 6) - 0, hoop.y - LEVEL.hoopBoard, 6, LEVEL.hoopBoard + 14);
  // net
  g.lineWidth = 1.6;
  g.beginPath();
  const sway = Math.sin(w.t * 3) * 1.5;
  for (let k = 0; k <= 4; k++) {
    const u = k / 4;
    const x0 = hoop.x - half + u * 2 * half;
    const x1 = hoop.x - half * 0.6 + u * 1.2 * half + sway;
    g.moveTo(x0, hoop.y);
    g.lineTo(x1, hoop.y + 34);
  }
  g.moveTo(hoop.x - half * 0.8, hoop.y + 16);
  g.lineTo(hoop.x + half * 0.8, hoop.y + 16);
  g.stroke();
  // rim
  g.strokeStyle = COLORS.yellow;
  g.lineWidth = 5;
  g.beginPath();
  g.ellipse(hoop.x, hoop.y, half, 6, 0, 0, Math.PI * 2);
  g.stroke();
  g.strokeStyle = COLORS.felt;
  g.lineWidth = 1.4;
  g.stroke();
  // tally: one dot per point, filled when scored
  for (let k = 0; k < n; k++) {
    const tx = bx + side * 26 * (k + 1.2),
      ty = hoop.y - LEVEL.hoopBoard - 14;
    g.beginPath();
    g.arc(tx, ty, 8, 0, Math.PI * 2);
    if (k < L.score) {
      g.fillStyle = COLORS.yellow;
      g.fill();
    }
    g.strokeStyle = COLORS.felt;
    g.lineWidth = 2;
    g.stroke();
  }
  g.restore();
}

/** SCORE into a bucket (4-3): a felt pail, its rim in yellow, the ducks already in it peeking
 *  out, and the tally dots above. */
function drawBucket(g: Ctx, w: World, hoop: { x: number; y: number }, n: number) {
  const L = w.level!;
  const half = LEVEL.hoopW / 2;
  const top = hoop.y,
    bot = hoop.y + 70;
  g.save();
  g.lineJoin = 'round';
  g.lineCap = 'round';
  // ducks inside, behind the front wall
  for (let k = 0; k < L.score; k++) {
    const dx = (k - (L.score - 1) / 2) * 20;
    g.fillStyle = COLORS.yellow;
    g.strokeStyle = COLORS.felt;
    g.lineWidth = 2;
    g.beginPath();
    g.arc(hoop.x + dx, top - 2 + Math.sin(w.t * 3 + k) * 1.5, 8, 0, Math.PI * 2);
    g.fill();
    g.stroke();
  }
  g.fillStyle = COLORS.felt;
  g.beginPath();
  g.moveTo(hoop.x - half, top);
  g.lineTo(hoop.x + half, top);
  g.lineTo(hoop.x + half * 0.75, bot);
  g.lineTo(hoop.x - half * 0.75, bot);
  g.closePath();
  g.fill();
  // handle
  g.strokeStyle = COLORS.felt;
  g.lineWidth = 3;
  g.beginPath();
  g.arc(hoop.x, top + 4, half * 0.95, Math.PI * 1.05, Math.PI * 1.95);
  g.stroke();
  g.strokeStyle = COLORS.yellow;
  g.lineWidth = 5;
  g.beginPath();
  g.ellipse(hoop.x, top, half, 6, 0, 0, Math.PI * 2);
  g.stroke();
  for (let k = 0; k < n; k++) {
    const tx = hoop.x + (k - (n - 1) / 2) * 26,
      ty = top - 60;
    g.beginPath();
    g.arc(tx, ty, 8, 0, Math.PI * 2);
    if (k < L.score) {
      g.fillStyle = COLORS.yellow;
      g.fill();
    }
    g.strokeStyle = COLORS.felt;
    g.lineWidth = 2;
    g.stroke();
  }
  g.restore();
}

/** Sumo: the ring's straw-bale edge, a cream rope along the top of the felt block that
 *  shrinks with it, knotted at both ends. */
export function drawRing(g: Ctx, w: World) {
  const goal = w.level?.def.goal;
  if (goal?.type !== 'sumo') return;
  const T = ringTerrain(w, goal.ring);
  if (!T) return;
  const y = goal.ring.y + 10;
  g.save();
  // the rope is what matters here (yellow): push the other one past it
  g.strokeStyle = COLORS.yellow;
  g.lineWidth = 6;
  g.lineCap = 'round';
  g.setLineDash([18, 6]);
  g.beginPath();
  g.moveTo(T.minX + 14, y);
  g.lineTo(T.maxX - 14, y);
  g.stroke();
  g.setLineDash([]);
  g.fillStyle = COLORS.yellow;
  for (const x of [T.minX + 12, T.maxX - 12]) {
    g.beginPath();
    g.arc(x, y, 7, 0, Math.PI * 2);
    g.fill();
  }
  g.restore();
}
