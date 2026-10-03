// Chapter 5, The Eraser: ink damage and live grafting (levels.md §5). Greybox first pass:
// flying scissors, a fire on the floor, smudgers, a mixed gauntlet and the Big Eraser.
import type { LevelDef } from '../sim/level';
import { CANON } from '../sim/canon';

const FLOOR = 1190;

// scissors fly at him and cut whatever they pass: a single shape is cut apart
export const L5_1: LevelDef = {
  id: '5-1',
  title: 'Snip Snip',
  hint: 'Draw more mid-fight.',
  paper: 'crumpled',
  goal: { type: 'save', seconds: 6 },
  draw: 0.06,
  ink: 3500,
  terrain: [],
  entities: [],
  props: [
    { type: 'scissors', x: 700, y: 380, at: 1.2 },
    { type: 'scissors', x: 20, y: 300, at: 2.6 },
  ],
  guy: { x: 360, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Long-Armed', strokes: CANON.longarm(240) },
    { kind: 'Springy', strokes: CANON.puncher(240) },
    { kind: 'Giant', strokes: CANON.giant(240) },
  ],
  window: [2, 8],
};

// fire runs along the floor behind him: walk him out before it catches up
export const L5_2: LevelDef = {
  id: '5-2',
  title: 'Fuse',
  paper: 'crumpled',
  goal: { type: 'home', x: 650, y: FLOOR },
  draw: 0.08,
  ink: 3500,
  terrain: [],
  entities: [],
  props: [{ type: 'fire', x0: 0, x1: 720, y: FLOOR, at: 1.2, speed: 60 }],
  guy: { x: 60, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Biped', strokes: CANON.stick700(160) },
    { kind: 'Springy', strokes: CANON.hopper(160) },
    { kind: 'Giant', strokes: CANON.giant(200) },
  ],
  window: [3, 14],
};

// little eraser critters crawl in and eat ink: stomp them
export const L5_3: LevelDef = {
  id: '5-3',
  title: 'Smudgers',
  paper: 'crumpled',
  goal: { type: 'save', seconds: 8 },
  draw: 0.08,
  ink: 4000,
  terrain: [],
  entities: [],
  props: [
    { type: 'smudger', x: 30, y: FLOOR - 20, at: 1 },
    { type: 'smudger', x: 690, y: FLOOR - 20, at: 1.6 },
    { type: 'smudger', x: 60, y: FLOOR - 20, at: 3 },
    { type: 'smudger', x: 660, y: FLOOR - 20, at: 4 },
  ],
  guy: { x: 360, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Heavy', strokes: CANON.bruiser(360) },
    { kind: 'Many-Legged', strokes: CANON.spider(360) },
    { kind: 'Springy', strokes: CANON.puncher(360) },
  ],
  window: [2, 10],
};

// a gap, then bombs, then water: each piece denies a different lazy answer
export const L5_4: LevelDef = {
  id: '5-4',
  title: 'Everything, Everywhere',
  paper: 'crumpled',
  goal: { type: 'home', x: 660, y: 1100 },
  draw: 0.07,
  ink: 4500,
  floor: false,
  terrain: [
    [{ x: -40, y: FLOOR }, { x: 200, y: FLOOR }, { x: 200, y: 1300 }, { x: -40, y: 1300 }],
    [{ x: 300, y: FLOOR }, { x: 440, y: FLOOR }, { x: 440, y: 1300 }, { x: 300, y: 1300 }],
    [{ x: 600, y: 1100 }, { x: 760, y: 1100 }, { x: 760, y: 1300 }, { x: 600, y: 1300 }],
    [{ x: -40, y: 1260 }, { x: 760, y: 1260 }, { x: 760, y: 1300 }, { x: -40, y: 1300 }],
  ],
  entities: [{ type: 'bomb', x: 370, y: 700, at: 2.5 }],
  props: [{ type: 'water', x0: 440, x1: 600, y: 1150 }],
  guy: { x: 60, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Floaty', strokes: CANON.floater(140) },
    { kind: 'Giant', strokes: CANON.giant(300) },
    { kind: 'Springy', strokes: CANON.hopper(140) },
  ],
  window: [3, 16],
};

// the boss: shove it into the sharpener, punch it back in mid-hop, squash the crumbs
export const L5_5: LevelDef = {
  id: '5-5',
  title: 'The Big Eraser',
  paper: 'crumpled',
  goal: { type: 'boss' },
  draw: 0.08,
  ink: 3000,
  inkRegen: 60,
  terrain: [],
  entities: [],
  props: [{ type: 'eraser', x: 540, y: FLOOR - 45, at: 2 }],
  guy: { x: 120, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Heavy', strokes: CANON.bruiser(330) },
    { kind: 'Springy', strokes: CANON.puncher(330) },
    { kind: 'Long-Armed', strokes: CANON.longarm(330) },
  ],
  window: [10, 60],
};

export const CHAPTER5: LevelDef[] = [L5_1, L5_2, L5_3, L5_4, L5_5];
