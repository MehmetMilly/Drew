// Level things on the page: Little Guy (felt-tip, yellow scarf), red hazards, the
// countdown in the sky, blasts, the poof, the hug heart. Greybox-first, but in the
// game's materials: felt-tip black, danger red, highlighter yellow.
import { COLORS, LOOK } from '../tuning';
import { boil1 } from './boil';
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
    else if (b.kind === 'boulder') drawBoulder(g, b, x, y, frame);
    else if (b.kind === 'bomb') drawBomb(g, w, b, x, y, frame);
    else if (b.kind === 'ninja') drawNinja(g, w, b, x, y, frame);
  }
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
  g.fillStyle = COLORS.cream;
  g.fillRect(-r * 0.6, -r * 0.08, r * 1.2, r * 0.22);
  g.restore();
  // "!" when it first activates
  if (w.t >= b.data.at && w.t < b.data.at + 0.6) drawBang(g, x, y - r - 26, w.t - b.data.at);
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
      g.globalAlpha = 1 - k;
      g.strokeStyle = COLORS.felt;
      g.lineWidth = 4;
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
      g.font = 'bold 40px "Gochi Hand", cursive';
      g.textAlign = 'center';
      g.fillText('BOOM', b.x, b.y - 30 - k * 30);
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
