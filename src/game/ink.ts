// Wet ink on the overlay (design.md §3, look-and-feel §2): the live stroke is
// drawn straight from input; wet strokes glisten, and drying sweeps the gloss
// off along each stroke in drawing order, a readable countdown to birth.
import { COLORS } from '../tuning';
import { ribbon, widthPx } from '../render/graphite';
import { graphitePattern } from '../render/materials';
import type { LivePt } from '../input/pen';

type Ctx = CanvasRenderingContext2D;

export interface WetStroke {
  pts: LivePt[];
  upAt: number; // real seconds when the pen lifted (Infinity while drawing)
  width: Float32Array | null;
}

const XS = new Float32Array(20000),
  YS = new Float32Array(20000),
  WS = new Float32Array(20000);

export function strokeWidths(pts: LivePt[]): Float32Array {
  const n = pts.length;
  const w = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const a = pts[Math.max(0, i - 2)],
      b = pts[Math.min(n - 1, i + 2)];
    const dt = b.t - a.t;
    const v = dt > 1e-4 ? Math.hypot(b.x - a.x, b.y - a.y) / dt : 400;
    let k = Math.max(0, Math.min(1, 1 - v / 1600));
    if (pts[i].p !== 0.5) k = 0.5 * k + 0.5 * pts[i].p;
    w[i] = k;
  }
  // smooth the width so speed changes don't make beads
  for (let pass = 0; pass < 2; pass++) for (let i = 1; i < n - 1; i++) w[i] = (w[i - 1] + 2 * w[i] + w[i + 1]) / 4;
  return w;
}

let pat: CanvasPattern | null = null;

export function drawWet(g: Ctx, strokes: WetStroke[], now: number, wetTime: number, hidden = false) {
  if (!pat) pat = graphitePattern(g);
  for (const s of strokes) {
    const n = Math.min(s.pts.length, 20000);
    if (n === 0) continue;
    const widths = s.width && s.width.length === n ? s.width : strokeWidths(s.pts);
    for (let i = 0; i < n; i++) {
      XS[i] = s.pts[i].x;
      YS[i] = s.pts[i].y;
      WS[i] = widthPx(widths[i]);
    }
    if (!hidden) {
      g.fillStyle = pat;
      g.globalAlpha = 0.95;
      ribbon(g, XS, YS, WS, 0, n, 9, 11);
      g.globalAlpha = 1;
    }
    // gloss: present along the part of the stroke not yet dried
    const dry = s.upAt === Infinity ? 0 : Math.min(1, (now - s.upAt) / wetTime);
    if (dry >= 1) continue;
    const t0 = s.pts[0].t,
      t1 = s.pts[n - 1].t;
    const span = Math.max(1e-3, t1 - t0);
    let start = 0;
    while (start < n && (s.pts[start].t - t0) / span < dry) start++;
    if (n - start < 2) continue;
    // a soft sheen (lighter graphite) and a moving specular glint
    g.save();
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.strokeStyle = 'rgba(255,255,255,0.32)';
    g.lineWidth = 2.2;
    g.beginPath();
    for (let i = start; i < n; i++) {
      const x = XS[i] - 1,
        y = YS[i] - 1.2;
      if (i === start) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
    // glint travels along the wet part
    const glintU = (now * 1.6) % 1;
    const gi = start + Math.floor(glintU * (n - start - 1));
    const gx = XS[gi],
      gy = YS[gi];
    const grad = g.createRadialGradient(gx - 1, gy - 1, 0, gx - 1, gy - 1, 9);
    grad.addColorStop(0, 'rgba(255,255,255,0.75)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(gx - 1, gy - 1, 9, 0, Math.PI * 2);
    g.fill();
    g.restore();
  }
  void COLORS;
}
