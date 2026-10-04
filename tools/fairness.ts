// Fairness probe (playtest 2026-10-04): how many ordinary bodies a real player would draw win
// each level, tried at three spots near Little Guy. A level only a couple of bodies can beat
// reads as "I have no idea what it wants". Usage: npx tsx tools/fairness.ts [id-prefix]
import { World } from '../src/sim/world';
import { CANON } from '../src/sim/canon';
import type { Pt } from '../src/sim/geom';
import type { LevelDef } from '../src/sim/level';
import { attempt, baselines } from './levels';

export const BODIES = ['stick400', 'stick700', 'stick1100', 'spider', 'worm', 'hopper', 'reacher', 'bruiser', 'floater', 'giant'];

function groundAt(def: LevelDef, x: number, fromY: number): number {
  const w = new World({ seed: 1, floor: def.floor !== false });
  for (const t of def.terrain) w.addTerrain(t);
  const y = w.groundY(x, fromY);
  return isFinite(y) ? y : 1190;
}

/** A canonical body stood on the ground at x (centred), never inside terrain. */
export function placed(def: LevelDef, name: string, x: number): Pt[][] {
  const s = CANON[name](x);
  let lo = -Infinity, cx = 0, n = 0;
  for (const st of s) for (const p of st) (lo = Math.max(lo, p.y)), (cx += p.x), n++;
  cx /= n;
  const dx = x - cx;
  let gy = Infinity;
  for (const st of s) for (const p of st) gy = Math.min(gy, groundAt(def, p.x + dx, def.guy.y - 300));
  const dy = gy - 4 - lo;
  return s.map((st) => st.map((p) => ({ x: p.x + dx, y: p.y + dy })));
}

export function fairness(def: LevelDef) {
  const G = def.goal;
  const e = def.entities.find((q) => 'x' in q) as { x: number } | undefined;
  const toward = G.type === 'home' ? G.x : G.type === 'score' ? G.hoop.x : e?.x;
  const side = toward !== undefined ? Math.sign(toward - def.guy.x) || -1 : -1;
  const spots = [def.guy.x + side * 90, def.guy.x + side * 200, def.guy.x - side * 60];
  const wins: string[] = [];
  for (const b of BODIES) {
    if (spots.some((x) => attempt(def, placed(def, b, x)).result === 'win')) wins.push(b);
  }
  const lazy = Object.entries(baselines(def)).filter(([, s]) => attempt(def, s).result === 'win').map(([n]) => n);
  return { wins, lazy };
}

if (process.argv[1]?.endsWith('fairness.ts')) {
  const { ALL_LEVELS } = await import('../src/levels');
  const pre = process.argv[2] ?? '';
  for (const def of ALL_LEVELS.filter((l) => l.id.startsWith(pre) && l.goal.type !== 'boss')) {
    const r = fairness(def);
    console.log(`${def.id.padEnd(4)} ${def.title.padEnd(20)} ${String(r.wins.length).padStart(2)}/10  ${r.wins.join(' ')}   lazy-wins: ${r.lazy.join(' ') || '-'}`);
  }
}
