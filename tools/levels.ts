// Level validation (levels.md §3): reference solutions win, survive seeded jitter,
// the four lazy baselines mostly fail, and pacing sits in the level's window.
import { World } from '../src/sim/world';
import { startLevel, type LevelDef } from '../src/sim/level';
import { arc, line, poly, scribbleBlob } from '../src/sim/canon';
import { mulberry32 } from '../src/sim/rng';
import type { Pt } from '../src/sim/geom';
import { spawn, run } from './measure';

export interface Attempt {
  result: 'win' | 'fail' | 'timeout';
  t: number; // seconds from the drawing to the result
  cause: string;
  kinds: string[];
  tears: number;
}

/** Play one attempt: the drawing is born at level time `at` (≈ instant, as drawn in slow time). */
export function attempt(def: LevelDef, strokes: Pt[][], seed = 1, at = 0, limit = 14): Attempt {
  const w = new World({ seed });
  startLevel(w, def);
  if (at > 0) run(w, at);
  const crs = strokes.length ? spawn(w, strokes) : [];
  const t0 = w.t;
  while (w.level!.result === 'play' && w.t - t0 < limit) run(w, 1 / 60);
  const L = w.level!;
  return { result: L.result === 'play' ? 'timeout' : L.result, t: w.t - t0, cause: L.cause, kinds: crs.map((c) => c.kind), tears: w.totalTears };
}

export function jitter(strokes: Pt[][], seed: number): Pt[][] {
  const r = mulberry32(seed);
  const dx = (r() * 2 - 1) * 20,
    dy = (r() * 2 - 1) * 20;
  const s = 1 + (r() * 2 - 1) * 0.1;
  const a = ((r() * 2 - 1) * 5 * Math.PI) / 180;
  let cx = 0,
    cy = 0,
    n = 0,
    maxY = -Infinity;
  for (const st of strokes)
    for (const p of st) {
      cx += p.x;
      cy += p.y;
      n++;
      maxY = Math.max(maxY, p.y);
    }
  cx /= n;
  cy /= n;
  const co = Math.cos(a),
    si = Math.sin(a);
  const out = strokes.map((st) =>
    st.map((p) => {
      const x = (p.x - cx) * s,
        y = (p.y - cy) * s;
      return { x: cx + x * co - y * si + dx, y: cy + x * si + y * co + dy };
    }),
  );
  // keep the drawing out of the ground: a player can't draw inside it either
  let low = -Infinity;
  for (const st of out) for (const p of st) low = Math.max(low, p.y);
  const lift = Math.min(0, maxY - low);
  return lift ? out.map((st) => st.map((p) => ({ x: p.x, y: p.y + lift }))) : out;
}

/** The four lazy drawings, placed near Little Guy on the side the first threat comes from. */
export function baselines(def: LevelDef): Record<string, Pt[][]> {
  const b = def.baseline ?? { x: def.guy.x, y: def.guy.y - 20 };
  const e = def.entities[0];
  const side = e ? Math.sign(e.x - def.guy.x) || -1 : -1;
  const gy = def.guy.y; // his feet
  const nx = b.x + side * 70; // just beside him, toward the threat
  return {
    line: [line(nx - 100, gy - 60, nx + 100, gy - 60)],
    box: [poly([{ x: nx - 60, y: gy - 124 }, { x: nx + 60, y: gy - 124 }, { x: nx + 60, y: gy - 4 }, { x: nx - 60, y: gy - 4 }, { x: nx - 60, y: gy - 120 }])],
    roof: [arc(b.x, gy, 80, Math.PI, Math.PI * 2, 40).map((p) => ({ x: p.x, y: p.y - 4 }))],
    blob: [scribbleBlob(nx, gy - 45, 40, 18)],
  };
}

export interface LevelReport {
  id: string;
  refs: string; // e.g. "3/3"
  refsOk: boolean;
  robust: number; // worst reference's win rate under jitter
  base: Record<string, boolean>; // baseline → won
  baseOk: boolean;
  paceOk: boolean;
  pass: boolean;
  notes: string[];
}

export function validate(def: LevelDef, runs = 20): LevelReport {
  const notes: string[] = [];
  const refRes = def.refs.map((r) => attempt(def, r.strokes));
  const won = refRes.filter((a) => a.result === 'win').length;
  refRes.forEach((a, i) => {
    if (a.result !== 'win') notes.push(`ref ${def.refs[i].kind}: ${a.result}${a.cause ? ' (' + a.cause + ')' : ''}`);
  });
  const kindsDistinct = new Set(def.refs.map((r) => r.kind)).size >= 3;
  if (!kindsDistinct) notes.push('refs need 3 different hero kinds');
  let robust = 1;
  def.refs.forEach((r, i) => {
    let ok = 0;
    for (let k = 0; k < runs; k++) if (attempt(def, jitter(r.strokes, 1000 + k * 7 + i), 2 + k).result === 'win') ok++;
    robust = Math.min(robust, ok / runs);
    if (ok / runs < 0.8) notes.push(`ref ${r.kind} robust ${Math.round((100 * ok) / runs)}%`);
  });
  const base: Record<string, boolean> = {};
  for (const [n, s] of Object.entries(baselines(def))) base[n] = attempt(def, s).result === 'win';
  const baseWins = Object.values(base).filter(Boolean).length;
  const baseOk = !def.anatomyMatters || (baseWins <= 1 && !base.roof);
  const [lo, hi] = def.window ?? [3, 12];
  const paceOk = refRes.every((a) => a.result !== 'win' || (a.t >= lo && a.t <= hi));
  if (!paceOk) notes.push(`pace ${refRes.map((a) => a.t.toFixed(1)).join('/')} s outside ${lo}–${hi}`);
  const refsOk = won === def.refs.length && def.refs.length >= 3;
  return { id: def.id, refs: `${won}/${def.refs.length}`, refsOk: refsOk && kindsDistinct, robust, base, baseOk, paceOk, pass: refsOk && kindsDistinct && robust >= 0.8 && baseOk && paceOk, notes };
}

// npx tsx tools/levels.ts [id…]: print the table for some or all levels
if (process.argv[1]?.endsWith('levels.ts')) {
  const { ALL_LEVELS } = await import('../src/levels');
  const want = process.argv.slice(2);
  const quick = want.includes('--quick');
  for (const def of ALL_LEVELS.filter((l) => !want.filter((x) => !x.startsWith('--')).length || want.includes(l.id))) {
    const r = validate(def, quick ? 5 : 20);
    const b = Object.entries(r.base)
      .map(([n, v]) => `${n}${v ? '✓' : '✗'}`)
      .join(' ');
    console.log(`${r.pass ? '✓' : '✗'} ${def.id.padEnd(4)} refs ${r.refs}  robust ${Math.round(r.robust * 100)}%  base ${b}${r.notes.length ? '  — ' + r.notes.join('; ') : ''}`);
  }
}
