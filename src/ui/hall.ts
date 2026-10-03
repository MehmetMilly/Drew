// Hall of Heroes (design.md §12): every winning creature on sketchbook pages, idling
// with line boil. One shared canvas per page keeps it cheap; tapping a hero opens a
// blank page where it lives again.
import { COLORS, LOOK } from '../tuning';
import { boil1, boilState } from '../render/boil';
import type { Hero } from '../game/save';

const COLS = 3,
  ROWS = 3,
  CELL_W = 200,
  CELL_H = 210,
  PAD = 22;
export const PER_PAGE = COLS * ROWS;

export function hallCanvas(heroes: Hero[], onPick: (h: Hero) => void): { el: HTMLCanvasElement; stop: () => void } {
  const W = COLS * CELL_W,
    H = ROWS * CELL_H;
  const c = document.createElement('canvas');
  const dpr = Math.min(2, devicePixelRatio || 1);
  c.width = W * dpr * 1.2;
  c.height = H * dpr * 1.2;
  c.style.width = W + 'px';
  c.style.height = H + 'px';
  c.className = 'hall';
  const g = c.getContext('2d')!;
  // each hero fitted into its cell once
  const fitted = heroes.map((h) => fit(h.strokes, CELL_W - PAD * 2, CELL_H - PAD * 2 - 34));
  let frame = -1,
    raf = 0;
  const draw = (t: number) => {
    const f = boilState.enabled ? Math.floor((t / 1000) * LOOK.boilFps) % LOOK.boilFrames : 0;
    if (f !== frame) {
      frame = f;
      g.setTransform(c.width / W, 0, 0, c.height / H, 0, 0);
      g.clearRect(0, 0, W, H);
      heroes.forEach((h, k) => {
        const cx = (k % COLS) * CELL_W + PAD,
          cy = Math.floor(k / COLS) * CELL_H + PAD;
        g.save();
        g.translate(cx, cy);
        g.strokeStyle = COLORS.graphite;
        g.lineWidth = 2.6;
        g.lineCap = 'round';
        g.lineJoin = 'round';
        fitted[k].forEach((s, si) => {
          g.beginPath();
          let len = 0;
          s.forEach((p, i) => {
            if (i) len += Math.hypot(p.x - s[i - 1].x, p.y - s[i - 1].y);
            const x = p.x + boil1(k * 31 + si * 2 + 1, len, f) * LOOK.boilAmp,
              y = p.y + boil1(k * 31 + si * 2 + 2, len, f) * LOOK.boilAmp;
            i ? g.lineTo(x, y) : g.moveTo(x, y);
          });
          g.stroke();
        });
        g.fillStyle = COLORS.felt;
        g.font = '22px "Patrick Hand", cursive';
        g.textAlign = 'center';
        g.fillText(h.name.length > 22 ? h.name.slice(0, 21) + '…' : h.name, (CELL_W - PAD * 2) / 2, CELL_H - PAD * 2 - 4);
        g.restore();
      });
    }
    raf = requestAnimationFrame(draw);
  };
  raf = requestAnimationFrame(draw);
  c.addEventListener('click', (e) => {
    const r = c.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * W,
      y = ((e.clientY - r.top) / r.height) * H;
    const k = Math.floor(y / CELL_H) * COLS + Math.floor(x / CELL_W);
    if (heroes[k]) onPick(heroes[k]);
  });
  return { el: c, stop: () => cancelAnimationFrame(raf) };
}

/** Scale and centre strokes into a w × h box (bottom-aligned, like standing). */
export function fit(strokes: { x: number; y: number }[][], w: number, h: number) {
  let x0 = Infinity,
    y0 = Infinity,
    x1 = -Infinity,
    y1 = -Infinity;
  for (const s of strokes)
    for (const p of s) {
      x0 = Math.min(x0, p.x);
      y0 = Math.min(y0, p.y);
      x1 = Math.max(x1, p.x);
      y1 = Math.max(y1, p.y);
    }
  const k = Math.min(1, w / Math.max(1, x1 - x0), h / Math.max(1, y1 - y0));
  const ox = (w - (x1 - x0) * k) / 2,
    oy = h - (y1 - y0) * k;
  return strokes.map((s) => s.map((p) => ({ x: ox + (p.x - x0) * k, y: oy + (p.y - y0) * k })));
}
