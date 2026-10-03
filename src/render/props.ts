// Chapter 3 props on the page, all felt-tip (they are the world, not threats): the fan and
// its gusting air, cracked floors that split as they're strained, rope bridges that sag
// under weight, see-saws and the chunks of whatever broke.
import { COLORS, PROP } from '../tuning';
import type { World, Body } from '../sim/world';
import type { PropState } from '../sim/props';
import { hashNoise } from '../sim/rng';

type Ctx = CanvasRenderingContext2D;

/** Water (look-and-feel §1: Chapter 4's paper pools watercolour washes where water lives):
 *  a translucent wash, darker where it pools at the bottom, with a wobbling surface line.
 *  Drawn over the world so things read as submerged. */
export function drawWater(g: Ctx, w: World) {
  const S = w.props;
  if (!S?.pools.length) return;
  g.save();
  for (const q of S.pools) {
    const p = q.prop;
    const bottom = w.H;
    const grad = g.createLinearGradient(0, q.y, 0, bottom);
    grad.addColorStop(0, 'rgba(96,140,184,0.26)');
    grad.addColorStop(1, 'rgba(70,112,160,0.42)');
    g.fillStyle = grad;
    g.beginPath();
    g.moveTo(p.x0, bottom);
    const n = Math.max(4, Math.round((p.x1 - p.x0) / 16));
    for (let k = 0; k <= n; k++) {
      const x = p.x0 + (k / n) * (p.x1 - p.x0);
      g.lineTo(x, q.y + Math.sin(x * 0.045 + w.t * 2.4) * 2.5 + Math.sin(x * 0.11 - w.t * 1.7) * 1.2);
    }
    g.lineTo(p.x1, bottom);
    g.closePath();
    g.fill();
    // the wash's hard edge: pigment collects along the surface
    g.strokeStyle = 'rgba(60,100,150,0.45)';
    g.lineWidth = 2;
    g.beginPath();
    for (let k = 0; k <= n; k++) {
      const x = p.x0 + (k / n) * (p.x1 - p.x0);
      const y = q.y + Math.sin(x * 0.045 + w.t * 2.4) * 2.5 + Math.sin(x * 0.11 - w.t * 1.7) * 1.2;
      if (k) g.lineTo(x, y);
      else g.moveTo(x, y);
    }
    g.stroke();
    // current: little drifting ripple marks
    const cur = p.current ?? 0;
    if (cur) {
      g.lineWidth = 1.6;
      for (let k = 0; k < 10; k++) {
        const span = p.x1 - p.x0;
        const x = p.x0 + ((((w.t * cur * 0.8 + k * 131) % span) + span) % span);
        const y = q.y + 20 + ((k * 53) % Math.max(20, bottom - q.y - 60));
        g.beginPath();
        g.moveTo(x - 10, y);
        g.quadraticCurveTo(x, y - 4, x + 10, y);
        g.stroke();
      }
    }
  }
  g.restore();
}

export function drawProps(g: Ctx, w: World) {
  const S = w.props;
  if (!S) return;
  g.save();
  g.lineCap = 'round';
  g.lineJoin = 'round';
  drawWind(g, w, S);
  drawSlabs(g, S);
  drawPlanks(g, S);
  drawRafts(g, S);
  drawTentacles(g, w, S);
  g.restore();
}

function drawWind(g: Ctx, w: World, S: PropState) {
  for (const p of S.defs) {
    if (p.type !== 'wind') continue;
    const on = w.t >= (p.at ?? 0);
    const dir = Math.sign(p.force) || 1;
    // the fan sits on the ground at the upwind edge
    const fx = dir > 0 ? p.x0 + 34 : p.x1 - 34,
      fy = p.y1 - 70;
    g.strokeStyle = COLORS.felt;
    g.fillStyle = COLORS.felt;
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(fx, fy + 30);
    g.lineTo(fx - 4 * dir, p.y1);
    g.moveTo(fx - 22, p.y1);
    g.lineTo(fx + 18, p.y1);
    g.stroke();
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(fx, fy, 14, 40, 0, 0, Math.PI * 2);
    g.stroke();
    // blades, seen edge-on: they flicker as they spin
    const spin = on ? w.t * 40 : 0;
    g.lineWidth = 3;
    for (let k = 0; k < 3; k++) {
      const a = spin + (k * Math.PI * 2) / 3;
      g.beginPath();
      g.moveTo(fx, fy);
      g.lineTo(fx + Math.cos(a) * 6, fy + Math.sin(a) * 34);
      g.stroke();
    }
    if (!on) continue;
    // air: short felt dashes drifting downwind, faint
    g.globalAlpha = 0.28;
    g.lineWidth = 2;
    const span = p.x1 - p.x0;
    for (let k = 0; k < 18; k++) {
      const y = p.y0 + (0.5 + 0.5 * hashNoise(k, 1, 77)) * (p.y1 - p.y0 - 10);
      const speed = 300 + 200 * (0.5 + 0.5 * hashNoise(k, 2, 77));
      let u = (((w.t * speed + k * 97) % span) + span) % span;
      if (dir < 0) u = span - u;
      const x = p.x0 + u;
      const wob = Math.sin(w.t * 6 + k) * 3;
      g.beginPath();
      g.moveTo(x, y + wob);
      g.quadraticCurveTo(x + dir * 14, y + wob - 4, x + dir * 30, y + wob);
      g.stroke();
    }
    g.globalAlpha = 1;
  }
}

function drawSlabs(g: Ctx, S: PropState) {
  for (const sl of S.slabs) {
    if (sl.brokeAt >= 0) continue;
    const T = sl.terrain;
    if (sl.prop.type === 'crack') {
      // the slab itself is drawn as terrain; cracks open across it as it is strained
      g.strokeStyle = COLORS.cream;
      g.lineWidth = 2.4;
      const n = 1 + Math.floor(Math.min(1, sl.peak) * 4);
      for (let k = 0; k < n; k++) {
        const x = T.minX + (0.2 + 0.6 * (0.5 + 0.5 * hashNoise(k, 3, T.minX))) * (T.maxX - T.minX);
        g.beginPath();
        g.moveTo(x, T.minY);
        let y = T.minY;
        let cx = x;
        for (let s = 0; s < 4; s++) {
          y += (T.maxY - T.minY) / 4;
          cx += hashNoise(k, s, 9) * 10;
          g.lineTo(cx, y);
        }
        g.stroke();
      }
    } else {
      // a rope bridge: two ropes and planks, sagging with the weight on it
      const sag = 6 + Math.min(1.2, sl.peak) * 22;
      const at = (u: number) => T.minY + Math.sin(u * Math.PI) * sag;
      g.strokeStyle = COLORS.felt;
      g.lineWidth = 2;
      g.beginPath();
      for (let k = 0; k <= 20; k++) {
        const u = k / 20;
        const x = T.minX + u * (T.maxX - T.minX);
        if (k) g.lineTo(x, at(u) - 22);
        else g.moveTo(x, at(u) - 22);
      }
      g.stroke();
      const n = Math.max(3, Math.round((T.maxX - T.minX) / 22));
      g.fillStyle = COLORS.felt;
      for (let k = 0; k < n; k++) {
        const u = (k + 0.5) / n;
        const x = T.minX + u * (T.maxX - T.minX);
        const y = at(u);
        g.fillRect(x - 8, y, 16, PROP.bridgeH);
        g.beginPath();
        g.moveTo(x, y);
        g.lineTo(x, at(u) - 22);
        g.stroke();
      }
      // posts at both ends
      g.lineWidth = 5;
      g.beginPath();
      g.moveTo(T.minX, T.minY + 10);
      g.lineTo(T.minX, T.minY - 30);
      g.moveTo(T.maxX, T.minY + 10);
      g.lineTo(T.maxX, T.minY - 30);
      g.stroke();
    }
  }
}

function drawPlanks(g: Ctx, S: PropState) {
  for (const k of S.planks) {
    const c = Math.cos(k.th),
      s = Math.sin(k.th);
    g.fillStyle = COLORS.felt;
    // the pivot block
    g.beginPath();
    g.moveTo(k.x, k.y);
    g.lineTo(k.x - 24, k.y + 44);
    g.lineTo(k.x + 24, k.y + 44);
    g.closePath();
    g.fill();
    g.strokeStyle = COLORS.felt;
    g.lineWidth = PROP.plankHalf * 2;
    g.beginPath();
    g.moveTo(k.x - c * k.len, k.y - s * k.len);
    g.lineTo(k.x + c * k.len, k.y + s * k.len);
    g.stroke();
  }
}

/** A chunk of a broken floor or bridge, tumbling. */
export function drawChunk(g: Ctx, b: Body, x: number, y: number) {
  g.save();
  g.translate(x, y);
  g.rotate(b.angle + (b.data.spin ?? 0));
  g.fillStyle = COLORS.felt;
  const r = b.r;
  g.beginPath();
  g.moveTo(-r, -r * 0.7);
  g.lineTo(r * 0.8, -r);
  g.lineTo(r, r * 0.6);
  g.lineTo(-r * 0.6, r);
  g.closePath();
  g.fill();
  g.restore();
}

/** Log rafts: three felt logs lashed together, end grain showing. */
function drawRafts(g: Ctx, S: PropState) {
  for (const r of S.rafts) {
    g.fillStyle = COLORS.felt;
    const hh = PROP.raftHalf;
    g.beginPath();
    g.roundRect(r.x - r.len, r.y - hh, r.len * 2, hh * 2, hh);
    g.fill();
    g.strokeStyle = COLORS.cream;
    g.lineWidth = 1.6;
    for (const k of [-0.5, 0.5]) {
      g.beginPath();
      g.moveTo(r.x + k * r.len * 1.4 - 2, r.y - hh + 2);
      g.lineTo(r.x + k * r.len * 1.4 + 2, r.y + hh - 2);
      g.stroke();
    }
    g.beginPath();
    g.arc(r.x - r.len + hh, r.y, hh * 0.5, 0, Math.PI * 2);
    g.arc(r.x + r.len - hh, r.y, hh * 0.5, 0, Math.PI * 2);
    g.stroke();
  }
}

/** Kraken tentacles: a tapering felt curve from the root to the tip, red suckers (the threat),
 *  curling while it waits under the surface. */
function drawTentacles(g: Ctx, w: World, S: PropState) {
  for (const T of S.tentacles) {
    if (w.t < T.prop.at - 0.4) continue;
    const b = T.body;
    const ax = T.prop.x,
      ay = T.prop.y + 30;
    const dx = b.x - ax,
      dy = b.y - ay;
    const L = Math.hypot(dx, dy) || 1;
    // the body of it bows out to one side and sways
    const sway = Math.sin(w.t * 3 + T.prop.x) * 0.25 + (T.mode === 'hold' ? 0.1 : 0.35);
    const mx = ax + dx / 2 - (dy / L) * L * sway,
      my = ay + dy / 2 + (dx / L) * L * sway;
    const n = 16;
    const pts: { x: number; y: number }[] = [];
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      pts.push({ x: (1 - u) * (1 - u) * ax + 2 * u * (1 - u) * mx + u * u * b.x, y: (1 - u) * (1 - u) * ay + 2 * u * (1 - u) * my + u * u * b.y });
    }
    g.fillStyle = COLORS.felt;
    for (let k = 0; k <= n; k++) {
      const r = 16 * (1 - k / n) + 5;
      g.beginPath();
      g.arc(pts[k].x, pts[k].y, r, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = COLORS.red;
    for (let k = 3; k < n; k += 3) {
      g.beginPath();
      g.arc(pts[k].x, pts[k].y, 3 * (1 - k / n) + 1.6, 0, Math.PI * 2);
      g.fill();
    }
    // the tip curls round him while it holds
    if (T.mode === 'hold') {
      g.strokeStyle = COLORS.felt;
      g.lineWidth = 5;
      g.beginPath();
      g.arc(b.x, b.y, 12, 0, Math.PI * 1.6);
      g.stroke();
    }
  }
}
