// Chapter 5, The Eraser: ink damage and live grafting (levels.md §5). Crumpled paper.
// Flying scissors, a fire on the floor, smudgers, a mixed gauntlet and the Big Eraser (damage.ts).
import type { LevelDef } from '../sim/level';
import { CANON, circle, line, springLine } from '../sim/canon';
import type { Pt } from '../sim/geom';

const FLOOR = 1190;
const G = FLOOR - 4;

/** a hopper with plain arms: it jumps with him aboard, and its hands catch */
export const hopArms = (x: number): Pt[][] => {
  const hip = G - 120;
  return [circle(x, hip - 70, 34), line(x, hip - 36, x, hip), springLine(x, hip, x - 30, G, 6, 10), springLine(x, hip, x + 30, G, 6, 10), line(x, hip - 30, x - 110, hip - 60), line(x, hip - 30, x + 110, hip - 60)];
};

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
    { type: 'scissors', x: 700, y: 400, at: 0.8 },
    { type: 'scissors', x: 20, y: 380, at: 1.8 },
  ],
  guy: { x: 360, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Long-Armed', strokes: CANON.longarm(480) },
    { kind: 'Springy', strokes: CANON.puncher(480) },
    { kind: 'Giant', strokes: CANON.giant(300) },
  ],
  window: [2, 8],
};

// fire runs along the floor behind him: walk him out before it catches up
export const L5_2: LevelDef = {
  id: '5-2',
  title: 'Fuse',
  paper: 'crumpled',
  goal: { type: 'home', x: 700, y: FLOOR - 90 },
  draw: 0.08,
  ink: 3500,
  terrain: [[{ x: 480, y: FLOOR - 90 }, { x: 760, y: FLOOR - 90 }, { x: 760, y: 1300 }, { x: 480, y: 1300 }]],
  entities: [],
  props: [{ type: 'fire', x0: 0, x1: 480, y: FLOOR, at: 1.0, speed: 70 }],
  guy: { x: 60, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Biped', strokes: CANON.stick700(200) },
    { kind: 'Springy', strokes: CANON.hopper(140) },
    { kind: 'Giant', strokes: CANON.giant(200) },
    { kind: 'Heavy', strokes: CANON.bruiser(200) },
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
    { type: 'smudger', x: 640, y: FLOOR - 20, at: 0.3 },
    { type: 'smudger', x: 640, y: FLOOR - 20, at: 1.3 },
    { type: 'smudger', x: 640, y: FLOOR - 20, at: 2.3 },
    { type: 'smudger', x: 640, y: FLOOR - 20, at: 3.3 },
  ],
  guy: { x: 60, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Heavy', strokes: CANON.bruiser(300) },
    { kind: 'Many-Legged', strokes: CANON.spider(340) },
    { kind: 'Biped', strokes: CANON.stick700(300) },
  ],
  window: [2, 10],
};

// the whole chapter at once: scissors drop on him, then the bank catches fire behind him, and a
// gap too wide to straddle stands between him and the flag. Shields are cut, crawlers fall in,
// and whoever dawdles burns: catch the scissors, then hop or toss him over
export const L5_4: LevelDef = {
  id: '5-4',
  title: 'Everything, Everywhere',
  paper: 'crumpled',
  goal: { type: 'home', x: 640, y: FLOOR },
  draw: 0.07,
  ink: 4500,
  floor: false,
  terrain: [
    [{ x: -40, y: FLOOR }, { x: 220, y: FLOOR }, { x: 220, y: 1300 }, { x: -40, y: 1300 }],
    [{ x: 470, y: FLOOR }, { x: 760, y: FLOOR }, { x: 760, y: 1300 }, { x: 470, y: 1300 }],
  ],
  entities: [],
  props: [
    { type: 'scissors', x: 360, y: 250, at: 0.3 },
    { type: 'fire', x0: -40, x1: 220, y: FLOOR, at: 2.5, speed: 60 },
  ],
  guy: { x: 60, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Springy', strokes: hopArms(140) },
    { kind: 'Long-Armed', strokes: CANON.longarm(140) },
    { kind: 'Biped', strokes: CANON.stick700(140) },
    { kind: 'Heavy', strokes: CANON.bruiser(140) },
  ],
  window: [3, 14],
};

// the boss, in three acts: shove it into the sharpener (a bracer that walks it back, never worn
// down from behind); twice, hit it mid-leap so it lobs back in (a hand held up in its path will
// do); then stand between him and its three crumbs. A heavy lazy lump can shove it in, but
// has no hand to hit it with in act two
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
  props: [{ type: 'eraser', x: 420, y: FLOOR - 45, at: 0.3 }],
  guy: { x: 120, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Heavy', strokes: CANON.bruiser(330) },
    { kind: 'Springy', strokes: CANON.puncher(330) },
    { kind: 'Biped', strokes: CANON.stick700(330) },
  ],
  window: [10, 60],
};

export const CHAPTER5: LevelDef[] = [L5_1, L5_2, L5_3, L5_4, L5_5];
