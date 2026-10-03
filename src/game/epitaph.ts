// Epitaphs (design.md §11): one short line from the attempt's event log.
import type { World } from '../sim/world';

export function epitaph(w: World): string {
  const L = w.level;
  if (!L) return '';
  const n = (type: string) => L.log.filter((e) => e.type === type).length;
  const lines: string[] = [];
  const pieces = L.log.filter((e) => e.type === 'piece');
  const throws = n('throw'),
    grabs = n('grab'),
    grafts = n('graft'),
    tears = n('tear');
  const heroes = w.creatures.filter((c) => c.alive && !c.isPiece);
  if (pieces.length && w.creatures.some((c) => c.alive && c.isPiece)) lines.push('Was a leg. Became a hero.');
  if (throws) lines.push(throws === 1 ? 'Threw a bomb off the page.' : `Threw ${throws} bombs off the page.`);
  else if (grabs) lines.push(grabs === 1 ? 'Caught a bomb.' : `Caught ${grabs} bombs.`);
  if (grafts) lines.push('Grew a new part mid-fight.');
  if (tears && heroes.length) lines.push('Lost a bit. Kept going.');
  const g = L.def.goal;
  if (!lines.length) {
    const kinds = new Set(L.def.entities.map((e) => e.type));
    if (g.type === 'hug') lines.push('Made a friend.');
    else if (kinds.has('crusher')) lines.push(`Held the walls for ${g.seconds.toFixed(1)} s.`);
    else if (kinds.has('boulder')) lines.push('Stopped a boulder.');
    else if (kinds.has('ninja')) lines.push('Saw the ninja coming.');
    else lines.push(`Kept him safe for ${g.type === 'save' ? g.seconds.toFixed(1) : '0'} s.`);
  }
  if (heroes.length > 1) lines.push(`${heroes.length} heroes.`);
  return lines.slice(0, 2).join(' ');
}
