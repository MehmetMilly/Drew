// Daily Doodle validation (PLAN Phase 5): every arena × modifier pair must be winnable by
// at least one drawing that obeys the modifier. Candidates: the arena's reference solutions,
// plus canonical bodies (and single-stroke shapes) drawn at the baseline spot.
import { World } from '../src/sim/world';
import { startLevel, type LevelDef } from '../src/sim/level';
import { CANON, circle, line, scaleAbout, scribbleBlob, shift } from '../src/sim/canon';
import type { Pt } from '../src/sim/geom';
import { ARENAS, MODIFIERS } from '../src/levels/daily';
import { spawn } from './measure';
import { WORLD } from '../src/tuning';

const inkOf = (strokes: Pt[][]) => strokes.reduce((n, s) => n + s.slice(1).reduce((m, p, i) => m + Math.hypot(p.x - s[i].x, p.y - s[i].y), 0), 0);

function candidates(def: LevelDef): { name: string; strokes: Pt[][] }[] {
  const bx = def.baseline?.x ?? def.guy.x,
    dy = (def.baseline?.y ?? 1190) - 1190;
  const at = (s: Pt[][]) => shift(s, 0, dy);
  const out = def.refs.map((r) => ({ name: r.kind, strokes: r.strokes }));
  for (const k of ['bruiser', 'giant', 'spider', 'hopper', 'longarm', 'floater', 'stick700', 'worm', 'box'])
    for (const side of [-1, 1]) out.push({ name: `${k}${side < 0 ? '<' : '>'}`, strokes: at(CANON[k](bx + side * 110)) });
  // worms: a single line, two lengths, lying flat or slanted up, around Little Guy
  const gx = def.guy.x,
    gy = def.baseline?.y ?? def.guy.y;
  for (const len of [220, 340])
    for (const off of [-150, 0, 150, 300])
      for (const up of [0, 1]) {
        const x0 = gx + off - len / 2,
          y0 = gy - 4 - up * 60;
        out.push({ name: `worm${len}${up ? '^' : ''}@${off}`, strokes: [line(x0, y0, x0 + len, y0 - up * 40)] });
      }
  // tiny bodies and single strokes
  for (const side of [-1, 1]) {
    const x = bx + side * 70;
    out.push({ name: 'tiny-stick', strokes: at(scaleAbout(CANON.stick400(x), 0.45, x, 1190)) });
    out.push({ name: 'ball', strokes: [at([circle(x, 1160, 26)])[0]] });
    out.push({ name: 'lump', strokes: [at([scribbleBlob(x, 1150, 36, 20)])[0]] });
  }
  return out;
}

export function checkPair(arena: number, mod: number): string | null {
  const a = ARENAS[arena];
  const m = MODIFIERS[mod].id;
  const def: LevelDef = { ...a.level, mod: m, ink: m === 'half-ink' ? a.level.ink * 0.5 : a.level.ink };
  for (const c of candidates(def)) {
    if (m === 'one-stroke' && c.strokes.length !== 1) continue;
    if (inkOf(c.strokes) > def.ink) continue;
    const w = new World({ seed: 1 });
    startLevel(w, def);
    spawn(w, c.strokes);
    const limit = (def.window?.[1] ?? 20) + 4;
    for (let i = 0; i < limit / WORLD.dt && w.level!.result === 'play'; i++) w.step();
    if (w.level!.result === 'win') return c.name;
  }
  return null;
}
