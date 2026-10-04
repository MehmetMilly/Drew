// Sumo ladder (levels.md §6): twelve pre-drawn opponents, each with a body-plan gimmick
// that asks for a specific counter. One ring, raised on a block; the player draws on the
// left half, the opponent stands on the right; Little Guy referees from the floor.
import type { LevelDef } from '../sim/level';
import { CANON, GROUND_Y, circle, line, scribbleBlob, shift, springLine, scaleAbout } from '../sim/canon';
import type { Pt } from '../sim/geom';
import type { SumoRing } from '../sim/sumo';

export const RING: SumoRing = { x0: 130, x1: 590, y: 1000 };
const DY = RING.y - GROUND_Y;
const FX = 470; // where the opponent stands
const G = RING.y;

/** A canonical body moved up onto the ring. */
const up = (s: Pt[][]) => shift(s, 0, DY);

const pebble = (): Pt[][] => [circle(FX, G - 24, 22)];
const stilts = (): Pt[][] => [circle(FX, G - 390, 24), line(FX, G - 366, FX, G - 300), line(FX, G - 330, FX - 40, G - 300), line(FX, G - 330, FX + 40, G - 300), line(FX, G - 300, FX - 50, G), line(FX, G - 300, FX + 50, G)];
const doris = (): Pt[][] => [circle(FX, G - 136, 28), scribbleBlob(FX, G - 75, 40, 18), line(FX - 20, G - 70, FX - 45, G), line(FX + 20, G - 70, FX + 45, G)];
const octo = (): Pt[][] => {
  const cy = G - 70;
  const out = [circle(FX, cy, 34)];
  for (const s of [-1, 1]) for (let k = 0; k < 4; k++) {
      const dx = 8 + k * 7; // legs start on the body's outline
      out.push(line(FX + s * dx, cy + Math.sqrt(34 * 34 - dx * dx), FX + s * (44 + k * 22), G));
    }
  return out;
};
const wall = (): Pt[][] => [
  [
    { x: FX - 90, y: G - 120 },
    { x: FX + 90, y: G - 120 },
    { x: FX + 90, y: G },
    { x: FX - 90, y: G },
    { x: FX - 90, y: G - 118 },
  ],
];
const slappy = (): Pt[][] => {
  const hip = G - 90,
    neck = hip - 90;
  return [circle(FX, neck - 24, 24), line(FX, neck, FX, hip), line(FX, neck + 15, FX - 240, neck - 20), line(FX, neck + 15, FX + 120, neck - 80), line(FX, hip, FX - 30, G), line(FX, hip, FX + 30, G)];
};
const twins = (): Pt[][] => [...scaleAbout(up(CANON.stick400(FX - 60)), 0.8, FX - 60, G), ...scaleAbout(up(CANON.stick400(FX + 60)), 0.8, FX + 60, G)];
const champion = (): Pt[][] => {
  const top = G - 560,
    hip = top + 330;
  return [circle(FX, top + 50, 50), line(FX, top + 100, FX, hip), [...line(FX, top + 160, FX - 180, top + 120), ...scribbleBlob(FX - 196, top + 116, 22, 16)], [...line(FX, top + 160, FX + 180, top + 120), ...scribbleBlob(FX + 196, top + 116, 22, 16)], scribbleBlob(FX, hip - 60, 34, 18), springLine(FX, hip, FX - 80, G, 7, 14), springLine(FX, hip, FX + 80, G, 7, 14)];
};

export interface Opponent {
  name: string;
  counter: string; // the hint on its card
  strokes: () => Pt[][];
}

export const OPPONENTS: Opponent[] = [
  { name: 'Pebble', counter: 'anything bigger', strokes: pebble },
  { name: 'Stilts', counter: 'go low', strokes: stilts },
  { name: 'Big Doris', counter: 'leverage', strokes: doris },
  { name: 'Octo', counter: 'heavier, or throw it', strokes: octo },
  { name: 'Boing Boing', counter: 'catch it mid-air', strokes: () => up(CANON.hopper(FX)) },
  { name: 'The Wall', counter: 'over and behind', strokes: wall },
  { name: 'Slappy', counter: 'under the arms', strokes: slappy },
  { name: 'Twins', counter: 'a wide body', strokes: twins },
  { name: 'Snek', counter: 'stomp it', strokes: () => up(CANON.worm(FX)) },
  { name: 'Balloon', counter: 'anything heavy', strokes: () => up(CANON.floater(FX)) },
  { name: 'Grandmaster', counter: 'everything you know', strokes: () => up(CANON.bruiser(FX)) },
  { name: 'Champion', counter: 'timing and weight', strokes: champion },
];

/** Rung k of the ladder as a level. */
export function sumoLevel(k: number): LevelDef {
  const o = OPPONENTS[k];
  return {
    id: 'sumo-' + (k + 1),
    title: o.name,
    hint: o.counter,
    paper: 'cream',
    goal: { type: 'sumo', seconds: 12, ring: RING, foe: o.strokes(), name: o.name },
    draw: 0.05,
    ink: 3000,
    terrain: [
      [
        { x: RING.x0, y: RING.y },
        { x: RING.x1, y: RING.y },
        { x: RING.x1 - 20, y: GROUND_Y },
        { x: RING.x0 + 20, y: GROUND_Y },
      ],
    ],
    entities: [],
    guy: { x: 50, y: GROUND_Y, hat: 'gyoji' },
    anatomyMatters: true,
    baseline: { x: 250, y: RING.y },
    refs: [
      { kind: 'Heavy', strokes: up(CANON.bruiser(250)) },
      { kind: 'Long-Armed', strokes: up(CANON.longarm(250)) },
      { kind: 'Many-Legged', strokes: up(CANON.spider(250)) },
    ],
    window: [2, 20],
  };
}
