// Chapter 1, It's Alive: lines, heads, size (levels.md §5). Greybox. Dimensions come
// from LEVEL_METRICS.md; reference solutions are stroke lists (canonical bodies placed
// where a player would draw them).
import type { LevelDef } from '../sim/level';
import { CANON } from '../sim/canon';

const FLOOR = 1190;

export const L1_1: LevelDef = {
  id: '1-1',
  title: 'Hello, Friend',
  hint: 'Draw him a friend.',
  paper: 'cream',
  goal: { type: 'hug' },
  draw: 0.04,
  ink: 3000,
  terrain: [],
  entities: [],
  guy: { x: 470, y: FLOOR },
  anatomyMatters: false,
  baseline: { x: 470, y: FLOOR - 20 },
  refs: [
    { kind: 'Many-Legged', strokes: CANON.spider(220) },
    { kind: 'Worm', strokes: CANON.worm(200) },
    { kind: 'Biped', strokes: CANON.stick700(240) },
  ],
  window: [1, 12],
};

// a boulder rolls down a long gentle slope into the corner he is backed into. Whatever only
// slows it is ground through, and a boulder that comes to rest against him squashes him:
// a creature has to brace it off (feet planted, pushing back) and keep it there
export const L1_2: LevelDef = {
  id: '1-2',
  title: 'Boulder',
  paper: 'cream',
  goal: { type: 'save', seconds: 6 },
  draw: 0.04,
  ink: 2500,
  terrain: [
    [{ x: -200, y: 960 }, { x: 0, y: 980 }, { x: 200, y: 1060 }, { x: 420, y: 1140 }, { x: 640, y: FLOOR }, { x: -200, y: FLOOR }],
    [{ x: 640, y: 960 }, { x: 920, y: 960 }, { x: 920, y: FLOOR }, { x: 640, y: FLOOR }],
  ],
  entities: [{ type: 'boulder', x: 60, y: 900, r: 60, m: 780, at: 1.0 }],
  guy: { x: 598, y: 1178 },
  anatomyMatters: true,
  baseline: { x: 590, y: 1158 },
  refs: [
    { kind: 'Many-Legged', strokes: CANON.spider(470) },
    { kind: 'Giant', strokes: CANON.giant(400) },
    { kind: 'Heavy', strokes: CANON.bruiser(470) },
  ],
  window: [3, 12],
};

// a saw-toothed wall drives in from the left along a ledge; he stands near its edge over a
// pit. Whatever lies still between the wall and him is shoved over the edge with him; only a
// creature that braces (feet planted, pushing back) stops the wall.
export const L1_3: LevelDef = {
  id: '1-3',
  title: 'Walls',
  paper: 'cream',
  goal: { type: 'save', seconds: 5 },
  draw: 0.05,
  ink: 2500,
  floor: false,
  terrain: [[{ x: -200, y: FLOOR }, { x: 520, y: FLOOR }, { x: 520, y: 1600 }, { x: -200, y: 1600 }]],
  entities: [{ type: 'crusher', x: 40, y: FLOOR - 160, h: 320, dir: 1, at: 0.4, speed: 105 }],
  guy: { x: 470, y: FLOOR },
  anatomyMatters: true,
  baseline: { x: 470, y: FLOOR - 20 },
  refs: [
    { kind: 'Many-Legged', strokes: CANON.spider(220) },
    { kind: 'Biped', strokes: CANON.reacher(300) },
    { kind: 'Heavy', strokes: CANON.bruiser(300) },
  ],
  window: [3, 12],
};

export const L1_4: LevelDef = {
  id: '1-4',
  title: 'Bombs in the Bowl',
  paper: 'cream',
  goal: { type: 'save', seconds: 6 },
  draw: 0.05,
  ink: 2500,
  terrain: [
    [{ x: -200, y: 1000 }, { x: 160, y: 1000 }, { x: 330, y: FLOOR }, { x: -200, y: FLOOR }],
    [{ x: 390, y: FLOOR }, { x: 560, y: 1000 }, { x: 920, y: 1000 }, { x: 920, y: FLOOR }],
  ],
  entities: [
    { type: 'bomb', x: 330, y: 300, at: 1.2, fuse: 3.0 },
    { type: 'bomb', x: 395, y: 200, at: 2.0, fuse: 3.0 },
  ],
  guy: { x: 360, y: FLOOR },
  anatomyMatters: true,
  baseline: { x: 360, y: FLOOR - 20 },
  refs: [
    { kind: 'Biped', strokes: CANON.reacher(260) },
    { kind: 'Giant', strokes: CANON.giant(400) },
    { kind: 'Many-Legged', strokes: CANON.spider(360) },
  ],
  window: [3, 12],
};

// a ninja leaps from far left in a high arc at the King on his throne
export const L1_5: LevelDef = {
  id: '1-5',
  title: 'Ninja',
  paper: 'cream',
  goal: { type: 'save', seconds: 5 },
  draw: 0.06,
  ink: 2500,
  terrain: [[{ x: 470, y: 1110 }, { x: 590, y: 1110 }, { x: 590, y: FLOOR }, { x: 470, y: FLOOR }]],
  entities: [{ type: 'ninja', x: 40, y: FLOOR - 20, tx: 300, ty: FLOOR - 20, at: 1.0, apex: 220 }],
  guy: { x: 530, y: 1110, hat: 'crown' },
  anatomyMatters: true,
  baseline: { x: 530, y: 1090 },
  refs: [
    { kind: 'Long-Armed', strokes: CANON.longarm(330) },
    { kind: 'Springy', strokes: CANON.puncher(280) },
    { kind: 'Biped', strokes: CANON.stick700(420) },
  ],
  window: [3, 12],
};

export const CHAPTER1: LevelDef[] = [L1_1, L1_2, L1_3, L1_4, L1_5];
