// Quick, Draw! regression corpus (CC BY 4.0, Google Creative Lab). Builds a seeded subset
// of single-stroke drawings from raw ndjson samples, and scores the classifier on it.
// Rebuild: tsx tools/quickdraw.ts build <dir-with-<cat>.raw.sample-files>
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { mulberry32 } from '../src/sim/rng';
import { rdp, turnAngle, type Pt } from '../src/sim/geom';
import { labelOf } from './fixtures';

export const QD_FILE = 'tests/fixtures/quickdraw/strokes.json';
const CATS = ['line', 'circle', 'triangle', 'square', 'zigzag'] as const;
const PER = 200;

/** Longest run of alternating turns > 60° on a coarse simplification (independent of the classifier). */
function altTurns(p: Pt[]) {
  const v = rdp(p, 12).map((i) => p[i]);
  let run = 0,
    best = 0,
    last = 0;
  for (let k = 1; k < v.length - 1; k++) {
    const a = turnAngle(v[k - 1], v[k], v[k + 1]);
    if (Math.abs(a) > Math.PI / 3) {
      const s = Math.sign(a);
      run = s === -last ? run + 1 : 1;
      last = s;
    } else {
      run = 0;
      last = 0;
    }
    best = Math.max(best, run);
  }
  return best;
}

export const EXPECT: Record<string, (l: string) => boolean> = {
  line: (l) => l === 'line',
  circle: (l) => l === 'loop',
  triangle: (l) => l === 'loop',
  square: (l) => l === 'loop',
  zigzag: (l) => l === 'zigzag' || l === 'line+zigzag',
};
export const FLOOR: Record<string, number> = { line: 0.98, circle: 0.97, triangle: 0.95, square: 0.97, zigzag: 0.88 };

function build(dir: string) {
  const r = mulberry32(2026);
  const out: { cat: string; pts: Pt[] }[] = [];
  for (const cat of CATS) {
    const pool: typeof out = [];
    for (const ln of readFileSync(`${dir}/${cat}.raw.sample`, 'utf8').split('\n')) {
      let d: { drawing: number[][][]; recognized: boolean };
      try {
        d = JSON.parse(ln);
      } catch {
        continue;
      }
      if (!d.recognized || d.drawing.length !== 1 || d.drawing[0][0].length < 3) continue;
      const [xs, ys] = d.drawing[0];
      const minX = Math.min(...xs),
        minY = Math.min(...ys);
      const size = Math.max(Math.max(...xs) - minX, Math.max(...ys) - minY) || 1;
      const k = (150 + r() * 300) / size; // a typical creature-part size on our 720×1280 page
      const pts = xs.map((x, i) => ({ x: Math.round(100 + (x - minX) * k), y: Math.round(300 + (ys[i] - minY) * k) }));
      // zigzag: keep only drawings with ≥4 alternating turns (2–3 turns are bent lines in our grammar)
      if (cat === 'zigzag' && altTurns(pts) < 4) continue;
      pool.push({ cat, pts });
    }
    for (let i = 0; i < PER && pool.length; i++) out.push(pool.splice(Math.floor(r() * pool.length), 1)[0]);
  }
  writeFileSync(QD_FILE, JSON.stringify({ source: 'Quick, Draw! dataset, Google Creative Lab, CC BY 4.0 — https://github.com/googlecreativelab/quickdraw-dataset', strokes: out }));
  console.log(`wrote ${out.length} strokes to ${QD_FILE}`);
}

export function scoreQuickDraw() {
  if (!existsSync(QD_FILE)) return null;
  const { strokes } = JSON.parse(readFileSync(QD_FILE, 'utf8')) as { strokes: { cat: string; pts: Pt[] }[] };
  const per: Record<string, { n: number; ok: number }> = {};
  for (const s of strokes) {
    const e = (per[s.cat] ??= { n: 0, ok: 0 });
    e.n++;
    if (EXPECT[s.cat](labelOf(s.pts).join('+'))) e.ok++;
  }
  return per;
}

if (process.argv[2] === 'build') build(process.argv[3]);
else if (process.argv[1]?.endsWith('quickdraw.ts')) console.log(scoreQuickDraw());
