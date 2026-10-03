// Graphite strokes (look-and-feel §2): tapered ends, 5–7 px width modulated by
// speed and pressure, grain from the paper tooth, darker where strokes overlap.
import { PEN } from '../tuning';

type Ctx = CanvasRenderingContext2D;

const L = new Float32Array(8192 * 2);
const R = new Float32Array(8192 * 2);

/**
 * Fill a variable-width ribbon through points (xs, ys) with widths ws (px).
 * `taper` shrinks both ends over the given arclength.
 */
export function ribbon(
  g: Ctx,
  xs: ArrayLike<number>,
  ys: ArrayLike<number>,
  ws: ArrayLike<number>,
  from: number,
  to: number,
  taperStart = 10,
  taperEnd = 10,
  closed = false,
) {
  const n = to - from;
  if (n < 2) {
    if (n === 1) {
      g.beginPath();
      g.arc(xs[from], ys[from], ws[from] * 0.5, 0, Math.PI * 2);
      g.fill();
    }
    return;
  }
  if (n > 8000) to = from + 8000;
  // arclength for tapering
  let total = 0;
  for (let i = from + 1; i < to; i++) total += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
  let s = 0;
  for (let i = from, k = 0; i < to; i++, k++) {
    if (i > from) s += Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]);
    const a = Math.max(from, i - 1),
      b = Math.min(to - 1, i + 1);
    let tx = xs[b] - xs[a],
      ty = ys[b] - ys[a];
    if (closed && (i === from || i === to - 1)) {
      tx = xs[from + 1] - xs[to - 2];
      ty = ys[from + 1] - ys[to - 2];
    }
    const tl = Math.hypot(tx, ty) || 1;
    let w = ws[i] * 0.5;
    if (!closed) {
      if (s < taperStart) w *= 0.3 + 0.7 * (s / taperStart);
      if (total - s < taperEnd) w *= 0.3 + 0.7 * ((total - s) / taperEnd);
    }
    const nx = (-ty / tl) * w,
      ny = (tx / tl) * w;
    L[k * 2] = xs[i] + nx;
    L[k * 2 + 1] = ys[i] + ny;
    R[k * 2] = xs[i] - nx;
    R[k * 2 + 1] = ys[i] - ny;
  }
  g.beginPath();
  g.moveTo(L[0], L[1]);
  for (let k = 1; k < n; k++) g.lineTo(L[k * 2], L[k * 2 + 1]);
  // round-ish end cap
  const ex = xs[to - 1],
    ey = ys[to - 1];
  const er = Math.hypot(L[(n - 1) * 2] - ex, L[(n - 1) * 2 + 1] - ey);
  if (!closed) {
    const a0 = Math.atan2(L[(n - 1) * 2 + 1] - ey, L[(n - 1) * 2] - ex);
    g.arc(ex, ey, er, a0, a0 - Math.PI, true);
  }
  for (let k = n - 1; k >= 0; k--) g.lineTo(R[k * 2], R[k * 2 + 1]);
  if (!closed) {
    const sx = xs[from],
      sy = ys[from];
    const sr = Math.hypot(R[0] - sx, R[1] - sy);
    const a1 = Math.atan2(R[1] - sy, R[0] - sx);
    g.arc(sx, sy, sr, a1, a1 - Math.PI, true);
  }
  g.closePath();
  g.fill('nonzero');
}

export const widthPx = (w01: number) => PEN.minWidth + (PEN.maxWidth - PEN.minWidth) * w01;
