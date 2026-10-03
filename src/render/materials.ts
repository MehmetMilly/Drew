// Procedural materials (look-and-feel §2): paper, graphite grain, felt-tip, desk.
// Rendered once to offscreen canvases and reused.
import { COLORS } from '../tuning';
import { hashNoise } from '../sim/rng';

export type Canvas = HTMLCanvasElement | OffscreenCanvas;
type Ctx = CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;

export function makeCanvas(w: number, h: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w));
  c.height = Math.max(1, Math.round(h));
  return c;
}

/** Smooth value noise in [0,1], tileable with period p. */
function vnoise(x: number, y: number, p: number, seed: number) {
  const xi = Math.floor(x),
    yi = Math.floor(y);
  const fx = x - xi,
    fy = y - yi;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const h = (a: number, b: number) => 0.5 + 0.5 * hashNoise(((a % p) + p) % p, ((b % p) + p) % p, seed);
  const a = h(xi, yi),
    b = h(xi + 1, yi),
    c = h(xi, yi + 1),
    d = h(xi + 1, yi + 1);
  return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
}

/** A tileable greyscale noise tile: fine tooth. */
function toothTile(size: number, seed: number): HTMLCanvasElement {
  const c = makeCanvas(size, size);
  const g = c.getContext('2d')!;
  const img = g.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      let v = 0.55 * vnoise(x / 2, y / 2, size / 2, seed) + 0.3 * vnoise(x / 5, y / 5, size / 5, seed + 1) + 0.15 * vnoise(x / 11, y / 11, Math.round(size / 11), seed + 2);
      v = Math.pow(v, 1.4);
      const k = (y * size + x) * 4;
      img.data[k] = img.data[k + 1] = img.data[k + 2] = 0;
      img.data[k + 3] = Math.round(v * 255);
    }
  g.putImageData(img, 0, 0);
  return c;
}

export interface PaperSpec {
  base: string;
  tooth: number; // tooth alpha
  blotch: number;
  fibre: string;
  fibres: number;
  grid?: { step: number; color: string; heavy: number };
  seed: number;
}

export const PAPERS: Record<string, PaperSpec> = {
  cream: { base: COLORS.cream, tooth: 0.06, blotch: 0.09, fibre: 'rgba(120,100,70,0.10)', fibres: 220, seed: 11 },
  // Chapter 3: brown kraft paper, coarse and fibrous
  kraft: { base: '#C9A97A', tooth: 0.1, blotch: 0.14, fibre: 'rgba(90,60,30,0.16)', fibres: 520, seed: 37 },
  // Chapter 4: cold-press watercolour, bright and toothy (the washes are the water itself)
  wash: { base: '#F6F3EC', tooth: 0.12, blotch: 0.05, fibre: 'rgba(120,130,150,0.06)', fibres: 80, seed: 41 },
  // Chapter 2: engineering graph paper (a faint grey-green rule, so it never reads as a guide)
  graph: { base: '#F3F4EE', tooth: 0.05, blotch: 0.06, fibre: 'rgba(110,120,100,0.08)', fibres: 160, seed: 23, grid: { step: 24, color: 'rgba(96,128,110,0.16)', heavy: 1.8 } },
};

/** Render a page of paper at pixel size (w,h) for a logical page of 720×1280. */
export function renderPaper(spec: PaperSpec, w: number, h: number): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d')!;
  const s = w / 720;
  g.fillStyle = spec.base;
  g.fillRect(0, 0, w, h);
  // large blotches: low-res noise upscaled smoothly
  const bw = 48,
    bh = 84;
  const bl = makeCanvas(bw, bh);
  const bg = bl.getContext('2d')!;
  const bi = bg.createImageData(bw, bh);
  for (let y = 0; y < bh; y++)
    for (let x = 0; x < bw; x++) {
      const v = 0.6 * vnoise(x / 6, y / 6, 999, spec.seed) + 0.4 * vnoise(x / 2.5, y / 2.5, 999, spec.seed + 5);
      const k = (y * bw + x) * 4;
      const warm = v > 0.5;
      bi.data[k] = warm ? 150 : 255;
      bi.data[k + 1] = warm ? 120 : 255;
      bi.data[k + 2] = warm ? 80 : 250;
      bi.data[k + 3] = Math.round(Math.abs(v - 0.5) * 2 * 255 * spec.blotch);
    }
  bg.putImageData(bi, 0, 0);
  g.imageSmoothingEnabled = true;
  g.imageSmoothingQuality = 'high';
  g.drawImage(bl, 0, 0, w, h);
  // fine tooth
  const tile = toothTile(128, spec.seed + 9);
  const pat = g.createPattern(tile, 'repeat')!;
  g.globalAlpha = spec.tooth;
  g.fillStyle = pat;
  g.save();
  g.scale(Math.max(1, s), Math.max(1, s));
  g.fillRect(0, 0, w, h);
  g.restore();
  g.globalAlpha = 1;
  // fibres
  g.strokeStyle = spec.fibre;
  g.lineWidth = Math.max(0.6, 0.7 * s);
  for (let i = 0; i < spec.fibres; i++) {
    const x = (0.5 + 0.5 * hashNoise(i, 1, spec.seed)) * w,
      y = (0.5 + 0.5 * hashNoise(i, 2, spec.seed)) * h;
    const a = hashNoise(i, 3, spec.seed) * Math.PI;
    const L = (6 + 10 * (0.5 + 0.5 * hashNoise(i, 4, spec.seed))) * s;
    g.beginPath();
    g.moveTo(x, y);
    g.quadraticCurveTo(x + Math.cos(a) * L * 0.5 + 2 * s, y + Math.sin(a) * L * 0.5, x + Math.cos(a) * L, y + Math.sin(a) * L);
    g.stroke();
  }
  if (spec.grid) {
    g.strokeStyle = spec.grid.color;
    for (let x = 0, k = 0; x <= 720; x += spec.grid.step, k++) {
      g.lineWidth = (k % 5 === 0 ? spec.grid.heavy : 1) * s;
      g.beginPath();
      g.moveTo(x * s, 0);
      g.lineTo(x * s, h);
      g.stroke();
    }
    for (let y = 0, k = 0; y <= 1280; y += spec.grid.step, k++) {
      g.lineWidth = (k % 5 === 0 ? spec.grid.heavy : 1) * s;
      g.beginPath();
      g.moveTo(0, y * s);
      g.lineTo(w, y * s);
      g.stroke();
    }
  }
  // soft vignette and darker binding edge (left)
  const vg = g.createRadialGradient(w / 2, h * 0.45, Math.min(w, h) * 0.35, w / 2, h / 2, Math.max(w, h) * 0.75);
  vg.addColorStop(0, 'rgba(90,70,40,0)');
  vg.addColorStop(1, 'rgba(90,70,40,0.16)');
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
  const bind = g.createLinearGradient(0, 0, 46 * s, 0);
  bind.addColorStop(0, 'rgba(70,55,35,0.20)');
  bind.addColorStop(1, 'rgba(70,55,35,0)');
  g.fillStyle = bind;
  g.fillRect(0, 0, 46 * s, h);
  return c;
}

/** Graphite grain: the paper tooth showing through the pencil (alpha modulation). */
export function graphitePattern(g: Ctx, color = COLORS.graphite): CanvasPattern {
  const size = 96;
  const c = makeCanvas(size, size);
  const cg = c.getContext('2d')!;
  const img = cg.createImageData(size, size);
  const r = parseInt(color.slice(1, 3), 16),
    gg = parseInt(color.slice(3, 5), 16),
    b = parseInt(color.slice(5, 7), 16);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const v = 0.6 * vnoise(x / 1.5, y / 1.5, size / 1.5, 77) + 0.4 * vnoise(x / 4, y / 4, size / 4, 78);
      const k = (y * size + x) * 4;
      img.data[k] = r;
      img.data[k + 1] = gg;
      img.data[k + 2] = b;
      // most of the stroke is solid; the tooth leaves lighter pits
      img.data[k + 3] = Math.round(255 * Math.min(1, 0.55 + 0.75 * v));
    }
  cg.putImageData(img, 0, 0);
  return g.createPattern(c, 'repeat')!;
}

/** Desk surface around the letterboxed page: a soft wood-grain tone. */
export function renderDesk(w: number, h: number): HTMLCanvasElement {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d')!;
  g.fillStyle = '#B98B5E';
  g.fillRect(0, 0, w, h);
  const s = Math.max(1, w / 900);
  for (let i = 0; i < 140; i++) {
    const y0 = (i / 140) * h;
    g.strokeStyle = `rgba(${90 + (i % 3) * 10},${55 + (i % 4) * 5},30,${0.06 + 0.06 * (0.5 + 0.5 * hashNoise(i, 9, 3))})`;
    g.lineWidth = (1 + 2.5 * (0.5 + 0.5 * hashNoise(i, 8, 3))) * s;
    g.beginPath();
    for (let x = 0; x <= w; x += 20 * s) {
      const y = y0 + 6 * s * Math.sin(x / (180 * s) + i) + 3 * s * hashNoise(i, Math.round(x / 20), 4);
      if (x === 0) g.moveTo(x, y);
      else g.lineTo(x, y);
    }
    g.stroke();
  }
  const vg = g.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.3, w / 2, h / 2, Math.max(w, h) * 0.8);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(40,20,5,0.35)');
  g.fillStyle = vg;
  g.fillRect(0, 0, w, h);
  return c;
}
