// Scores classifier fixtures. Shared by the unit test and `npm run verify`.
import { classifyStroke, partSummary, MarkKind } from '../src/sim/classify';
import type { Pt } from '../src/sim/geom';

export interface FixtureLike {
  name: string;
  label: MarkKind[];
  pts: Pt[];
}

export function labelOf(pts: Pt[]): MarkKind[] {
  return [...new Set(partSummary(classifyStroke(pts)))].sort() as MarkKind[];
}

export function scoreFixtures(fx: FixtureLike[]) {
  let ok = 0;
  const byName = new Map<string, { n: number; ok: number; misses: string[] }>();
  for (const f of fx) {
    const got = labelOf(f.pts);
    const want = [...new Set(f.label)].sort();
    const hit = got.join('+') === want.join('+');
    if (hit) ok++;
    const e = byName.get(f.name) ?? { n: 0, ok: 0, misses: [] };
    e.n++;
    if (hit) e.ok++;
    else if (e.misses.length < 3) e.misses.push(got.join('+') || '∅');
    byName.set(f.name, e);
  }
  const rows = [...byName].map(([k, v]) => `${k.padEnd(10)} ${v.ok}/${v.n}  ${v.misses.join(', ')}`);
  return { rate: fx.length ? ok / fx.length : 1, ok, n: fx.length, table: rows.join('\n') };
}
