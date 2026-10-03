// Chapter 1, It's Alive: lines, heads, size (levels.md §5). Greybox. Dimensions come
// from LEVEL_METRICS.md; reference solutions are stroke lists (canonical bodies placed
// where a player would draw them).
import type { LevelDef } from '../sim/level';
import { CANON, shift } from '../sim/canon';

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

// a long slope from the left into a wall on the right; he's backed against the wall
export const L1_2: LevelDef = {
  id: '1-2',
  title: 'Boulder',
  paper: 'cream',
  goal: { type: 'save', seconds: 5 },
  draw: 0.04,
  ink: 2500,
  terrain: [
    [{ x: -200, y: 800 }, { x: 0, y: 880 }, { x: 150, y: 980 }, { x: 260, y: 1090 }, { x: 340, y: 1160 }, { x: 430, y: FLOOR }, { x: -200, y: FLOOR }],
    [{ x: 640, y: 960 }, { x: 920, y: 960 }, { x: 920, y: FLOOR }, { x: 640, y: FLOOR }],
  ],
  entities: [{ type: 'boulder', x: 60, y: 840, at: 1.0 }],
  guy: { x: 620, y: FLOOR },
  anatomyMatters: false,
  baseline: { x: 600, y: FLOOR - 20 },
  refs: [
    { kind: 'Biped', strokes: CANON.stick700(520) },
    { kind: 'Giant', strokes: CANON.giant(300) },
    { kind: 'Heavy', strokes: CANON.bruiser(470) },
  ],
  window: [3, 12],
};

// a saw-toothed wall drives in from the left with limited force; he is backed against the far wall
export const L1_3: LevelDef = {
  id: '1-3',
  title: 'Walls',
  paper: 'cream',
  goal: { type: 'save', seconds: 4 },
  draw: 0.05,
  ink: 2500,
  terrain: [],
  entities: [{ type: 'crusher', x: 100, y: FLOOR - 160, h: 320, dir: 1, at: 0.4, speed: 170 }],
  guy: { x: 600, y: FLOOR },
  anatomyMatters: true,
  baseline: { x: 600, y: FLOOR - 20 },
  refs: [
    { kind: 'Many-Legged', strokes: CANON.spider(430) },
    { kind: 'Long-Armed', strokes: CANON.reacher(430) },
    { kind: 'Heavy', strokes: CANON.bruiser(430) },
  ],
  window: [3, 12],
};

// he sits in a dip; two low-bounce bombs land on the slopes and roll in
export const L1_4: LevelDef = {
  id: '1-4',
  title: 'Bombs in the Bowl',
  paper: 'cream',
  goal: { type: 'save', seconds: 5 },
  draw: 0.05,
  ink: 2500,
  terrain: [
    [{ x: -200, y: 1000 }, { x: 160, y: 1000 }, { x: 330, y: FLOOR }, { x: -200, y: FLOOR }],
    [{ x: 390, y: FLOOR }, { x: 560, y: 1000 }, { x: 920, y: 1000 }, { x: 920, y: FLOOR }],
  ],
  entities: [
    { type: 'bomb', x: 200, y: 300, vx: 40, at: 1.2, fuse: 3.4 },
    { type: 'bomb', x: 520, y: 260, vx: -40, at: 1.8, fuse: 3.4 },
  ],
  guy: { x: 360, y: FLOOR },
  anatomyMatters: true,
  baseline: { x: 360, y: FLOOR - 20 },
  refs: [
    { kind: 'Long-Armed', strokes: shift(CANON.reacher(360), 0, 0) },
    { kind: 'Giant', strokes: CANON.giant(360) },
    { kind: 'Biped', strokes: CANON.stick1100(360) },
  ],
  window: [3, 12],
};

// a ninja leaps from far left in a high arc at the King on his throne
export const L1_5: LevelDef = {
  id: '1-5',
  title: 'Ninja',
  paper: 'cream',
  goal: { type: 'save', seconds: 4 },
  draw: 0.06,
  ink: 2500,
  terrain: [[{ x: 470, y: 1110 }, { x: 590, y: 1110 }, { x: 590, y: FLOOR }, { x: 470, y: FLOOR }]],
  entities: [{ type: 'ninja', x: 40, y: FLOOR - 20, tx: 530, ty: 1090, at: 1.4, apex: 220 }],
  guy: { x: 530, y: 1110, hat: 'crown' },
  anatomyMatters: true,
  baseline: { x: 530, y: 1090 },
  refs: [
    { kind: 'Long-Armed', strokes: CANON.reacher(400) },
    { kind: 'Giant', strokes: CANON.giant(300) },
    { kind: 'Biped', strokes: CANON.stick1100(400) },
  ],
  window: [3, 12],
};

export const CHAPTER1: LevelDef[] = [L1_1, L1_2, L1_3, L1_4, L1_5];
