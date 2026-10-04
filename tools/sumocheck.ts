// Sumo ladder validation (levels.md §6): every opponent must be beatable by at least two
// different hero kinds, among the canonical bodies drawn on the player's side of the ring.
import { World } from '../src/sim/world';
import { startLevel } from '../src/sim/level';
import { CANON, shift } from '../src/sim/canon';
import { OPPONENTS, RING, sumoLevel } from '../src/levels/sumo';
import { onFoe } from '../src/sim/sumo';
import { spawn } from './measure';
import { WORLD } from '../src/tuning';

const HEROES = ['bruiser', 'longarm', 'spider', 'stick700', 'puncher', 'giant', 'reacher', 'floater'];

export function checkOpponent(k: number): { kinds: string[]; tried: number } {
  const kinds = new Set<string>();
  for (const h of HEROES) {
    const w = new World({ seed: 1 });
    startLevel(w, sumoLevel(k));
    // the pencil skips over the sleeping opponent: split the drawing where it would cross it
    const strokes = shift(CANON[h](250), 0, RING.y - 1190).flatMap((st) => {
      const out: { x: number; y: number }[][] = [[]];
      for (const p of st) {
        if (onFoe(w, p.x, p.y)) out.push([]);
        else out[out.length - 1].push(p);
      }
      return out.filter((o) => o.length >= 2);
    });
    const made = spawn(w, strokes);
    const kind = made[0]?.kind ?? h;
    for (let i = 0; i < 25 / WORLD.dt && w.level!.result === 'play'; i++) w.step();
    if (w.level!.result === 'win') kinds.add(kind);
  }
  return { kinds: [...kinds], tried: HEROES.length };
}

export { OPPONENTS };
