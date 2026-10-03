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
  const g = L.def.goal;
  const kinds = new Set(L.def.entities.map((e) => e.type));
  const thing = kinds.has('bomb') ? 'bomb' : kinds.has('ball') ? 'ball' : kinds.has('ninja') ? 'ninja' : '';
  if (g.type === 'score') lines.push(L.score >= g.n ? `Nothing but net. ${L.score} for ${L.score}.` : `${L.score} of ${g.n}. So close.`);
  else if (thing && throws) lines.push(throws === 1 ? `Threw a ${thing} off the page.` : `Threw ${throws} ${thing}s off the page.`);
  else if (thing && grabs) lines.push(grabs === 1 ? `Caught a ${thing}.` : `Caught ${grabs} ${thing}s.`);
  if (grafts) lines.push('Grew a new part mid-fight.');
  if (tears && heroes.length) lines.push('Lost a bit. Kept going.');
  if (!lines.length) {
    if (g.type === 'hug') lines.push('Made a friend.');
    else if (g.type === 'home') lines.push(L.log.some((e) => e.type === 'board') ? 'Gave him a ride home.' : 'Walked him home.');
    else if (kinds.has('crusher')) lines.push(`Held the walls for ${g.seconds.toFixed(1)} s.`);
    else if (kinds.has('boulder')) lines.push('Stopped a boulder.');
    else if (kinds.has('ninja')) lines.push('Saw the ninja coming.');
    else if (kinds.has('ball')) lines.push('Not one ball got through.');
    else lines.push(`Kept him safe for ${g.type === 'save' ? g.seconds.toFixed(1) : '0'} s.`);
  }
  if (heroes.length > 1) lines.push(`${heroes.length} heroes.`);
  return lines.slice(0, 2).join(' ');
}
