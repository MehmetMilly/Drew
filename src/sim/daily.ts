// Daily Doodle modifiers that change the simulation (design §12). They act on each birth,
// inside the sim, so replays and ghosts see exactly what play saw. Input-only modifiers
// (One Stroke, Blind Draw) live in the toy; Half Ink is just a smaller budget.
import type { Creature } from './creature';
import type { World } from './world';

export type Modifier = 'one-stroke' | 'no-heads' | 'worms' | 'giants' | 'tiny' | 'half-ink' | 'two-friends' | 'blind' | 'mirror' | 'heavy';

/** Births that break the rule go up in a puff of dust (Heavy Ink is applied at birth, in addStrokes). */
export function applyMod(w: World, made: Creature[], mod: Modifier): Creature[] {
  const keep: Creature[] = [];
  for (const cr of made) {
    let ok = true;
    if (mod === 'no-heads') ok = cr.head.kind !== 'loop';
    else if (mod === 'worms') ok = cr.kind === 'worm';
    else if (mod === 'giants') ok = cr.kind === 'giant';
    else if (mod === 'tiny') ok = cr.kind === 'tiny';
    else if (mod === 'two-friends') ok = w.creatures.filter((o) => o.alive && o.team === 0).length <= 2;
    if (!ok) {
      w.emit({ type: 'ruleBreak', cr: cr.id, x: w.centroid(cr).x, y: w.centroid(cr).y });
      w.removeCreature(cr);
      continue;
    }
    keep.push(cr);
  }
  return keep;
}
