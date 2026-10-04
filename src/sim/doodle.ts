// The Doodle Pad (design §12): a sandbox page with Little Guy, infinite ink, a palette that
// drops any hazard onto the page, and toggles for water, wind and low gravity. These act
// on a running world; the sandbox never ends, so nothing here has to replay.
import { DOODLE, WORLD } from '../tuning';
import type { World } from './world';
import { spawnEntity } from './hazards';
import { startProps, type Prop } from './props';
import { startDamage } from './damage';

export type Drop = 'boulder' | 'bomb' | 'ball' | 'sumo' | 'ninja' | 'smudger' | 'scissors';

/** Drop a hazard in from the top of the page, on the side away from Little Guy. */
export function dropHazard(w: World, kind: Drop) {
  const gx = w.guy?.alive ? w.P.x[w.guy.hip] : WORLD.W / 2;
  const side = gx < WORLD.W / 2 ? 1 : -1;
  const x = WORLD.W / 2 + side * DOODLE.dropOut;
  const y = DOODLE.dropY;
  const t = w.t;
  if (kind === 'boulder') spawnEntity(w, { type: 'boulder', x, y, at: t, vx: -side * 120 });
  else if (kind === 'bomb') spawnEntity(w, { type: 'bomb', x, y, at: t });
  else if (kind === 'ball') spawnEntity(w, { type: 'ball', x: side > 0 ? WORLD.W - 30 : 30, y: y + 200, vx: -side * 520, vy: -200, at: t });
  else if (kind === 'sumo') spawnEntity(w, { type: 'sumo', x, y: WORLD.floorY - 60, at: t + 0.5 });
  else if (kind === 'ninja') spawnEntity(w, { type: 'ninja', x, y: WORLD.floorY - 30, tx: gx, ty: WORLD.floorY - 30, at: t + 0.4 });
  else addDamage(w, kind === 'smudger' ? { type: 'smudger', x, y: WORLD.floorY - 20, at: t } : { type: 'scissors', x, y: 300, at: t + 0.3 });
}

function addDamage(w: World, def: Extract<Prop, { type: 'smudger' | 'scissors' }>) {
  if (!w.props) w.props = startProps(w, []);
  // its bodies join the world; the damage state only has to exist to drive them
  const D = startDamage(w, [def]);
  if (!w.props.dmg) w.props.dmg = D;
}

/** Water across the bottom of the page, on or off. */
export function setWater(w: World, on: boolean) {
  if (!w.props) w.props = startProps(w, []);
  const S = w.props;
  S.pools = S.pools.filter((q) => q.prop.x0 !== -1);
  if (on) S.pools.push({ prop: { type: 'water', x0: -1, x1: WORLD.W + 1, y: WORLD.floorY - DOODLE.waterDepth }, y: WORLD.floorY - DOODLE.waterDepth });
}

/** A fan's gale blowing across the page, on or off. */
export function setWind(w: World, on: boolean) {
  if (!w.props) w.props = startProps(w, []);
  const S = w.props;
  S.defs = S.defs.filter((p) => !(p.type === 'wind' && p.x0 === -1));
  if (on) S.defs.push({ type: 'wind', x0: -1, y0: 0, x1: WORLD.W + 1, y1: WORLD.floorY, force: DOODLE.wind, at: w.t });
}

/** Moon gravity, on or off. */
export function setLowGravity(w: World, on: boolean) {
  w.gravity = on ? WORLD.gravity * DOODLE.lowGravity : WORLD.gravity;
}
