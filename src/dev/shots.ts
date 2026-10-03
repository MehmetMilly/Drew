// Dev-only harness for `npm run shots`: runs scenarios deterministically and
// draws frame strips into one contact-sheet canvas (≤1600 px wide).
import { World } from '../sim/world';
import { WorldRenderer } from '../render/renderer';
import { PAPERS, renderPaper } from '../render/materials';
import { CANON } from '../sim/canon';
import { WORLD, COLORS } from '../tuning';
import { drawWet, strokeWidths, WetStroke } from '../game/ink';
import type { Pt } from '../sim/geom';
import { startLevel } from '../sim/level';
import { CHAPTER4 } from '../levels/ch4';
import { CHAPTER5 } from '../levels/ch5';
import { ALL_LEVELS } from '../levels';

export interface ShotRow {
  label: string;
  draw: { canon: string; x: number; dy?: number }[];
  strokes?: Pt[][];
  target?: { x: number; y: number; at?: number };
  times: number[]; // sim seconds after birth
  debug?: boolean;
  wet?: boolean; // show the wet-ink → birth sequence in the first columns
  crop?: { x: number; y: number; w: number; h: number; follow?: boolean };
  level?: string; // play this level with its reference `ref` (index) born at level time `at`
  ref?: number;
  at?: number;
}

const CELL_W = 300;

export async function sheet(rows: ShotRow[], scale0 = CELL_W / WORLD.W): Promise<HTMLCanvasElement> {
  await document.fonts.load('26px "Gochi Hand"');
  const crop0 = rows[0].crop;
  const cols0 = Math.max(...rows.map((r) => r.times.length));
  const cellW = crop0 ? Math.floor(1600 / cols0) : CELL_W;
  const scale = crop0 ? cellW / crop0.w : scale0;
  const cw = Math.round((crop0 ? crop0.w : WORLD.W) * scale),
    ch = Math.round((crop0 ? crop0.h : WORLD.H) * scale);
  const cols = Math.max(...rows.map((r) => r.times.length));
  const c = document.createElement('canvas');
  c.width = cw * cols;
  c.height = (ch + 26) * rows.length;
  const g = c.getContext('2d')!;
  g.fillStyle = '#B98B5E';
  g.fillRect(0, 0, c.width, c.height);
  const papers: Record<string, HTMLCanvasElement> = {};
  const paperOf = (k: string) => (papers[k] ??= renderPaper(PAPERS[k] ?? PAPERS.cream, cw * 2, ch * 2));
  rows.forEach((row, ri) => {
    const w = new World({ seed: 1 });
    const r = new WorldRenderer(w);
    const lv = row.level ? [...ALL_LEVELS, ...CHAPTER4, ...CHAPTER5].find((l) => l.id === row.level) : undefined;
    if (lv) {
      startLevel(w, lv);
      for (let k = 0; k < Math.round((row.at ?? 0) / WORLD.dt); k++) w.step();
      row.strokes = lv.refs[row.ref ?? 0].strokes;
      row.label = `${lv.id} ${lv.refs[row.ref ?? 0].kind}`;
    }
    const strokes: Pt[][] = row.strokes ? row.strokes : row.draw.flatMap((d) => CANON[d.canon](d.x).map((s) => s.map((p) => ({ x: p.x, y: p.y + (d.dy ?? 0) }))));
    // pen timing for widths: 900 px/s
    const timed = strokes.map((s) => {
      let t = 0;
      return s.map((p, i) => {
        if (i) t += Math.hypot(p.x - s[i - 1].x, p.y - s[i - 1].y) / 900;
        return { x: p.x, y: p.y, t, p: 0.5 };
      });
    });
    const groups = row.draw.length > 1 && !row.strokes ? row.draw.map((d) => CANON[d.canon](d.x).length) : [timed.length];
    let si = 0;
    for (const n of groups) {
      w.addStrokes(timed.slice(si, si + n));
      si += n;
    }
    let simT = 0;
    row.times.forEach((t, ci) => {
      if (row.target && t >= (row.target.at ?? 0) && !w.toyTarget) {
        while (simT < (row.target.at ?? 0)) {
          w.step();
          simT += WORLD.dt;
        }
        w.toyTarget = { x: row.target.x, y: row.target.y };
      }
      while (simT < t - 1e-9) {
        w.step();
        simT += WORLD.dt;
      }
      g.save();
      g.translate(ci * cw, ri * (ch + 26));
      g.beginPath();
      g.rect(0, 0, cw, ch);
      g.clip();
      g.drawImage(paperOf(lv?.paper ?? 'cream'), 0, 0, cw, ch);
      g.scale(scale, scale);
      if (row.crop) {
        let ox = row.crop.x;
        if (row.crop.follow && w.liveCreatures()[0]) ox = w.centroid(w.liveCreatures()[0]).x - row.crop.w / 2;
        g.translate(-ox, -row.crop.y);
      }
      if (row.wet && ci < 2) {
        // wet ink frames: mid-stroke and drying
        const ws: WetStroke[] = timed.map((s) => ({ pts: s.map((p) => ({ ...p })), upAt: ci === 0 ? Infinity : 0, width: null }));
        for (const s of ws) s.width = strokeWidths(s.pts);
        new WorldRenderer(new World({ seed: 1 })).draw(g, { alpha: 1, realT: t, debug: false });
        drawWet(g, ws, ci === 0 ? 0 : 0.45, 1);
      } else r.draw(g, { alpha: 1, realT: t, debug: !!row.debug });
      g.restore();
      g.fillStyle = COLORS.felt;
      g.font = '15px monospace';
      g.fillText(`${row.label} t=${t.toFixed(2)}`, ci * cw + 6, ri * (ch + 26) + ch + 18);
    });
  });
  return c;
}

(window as unknown as Record<string, unknown>).shots = { sheet };
