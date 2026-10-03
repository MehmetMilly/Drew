// Chapter 3, Heavy Stuff: scribble lumps (levels.md §5). Brown kraft paper. Greybox first
// pass: wind, a sumo bully, a see-saw, a rope bridge that the heavy break, cracked floors.
import type { LevelDef } from '../sim/level';
import { CANON } from '../sim/canon';

const FLOOR = 1190;

// a fan blows against the path to the flag: light bodies are blown back with him
export const L3_1: LevelDef = {
  id: '3-1',
  title: 'Gust',
  hint: 'Scribbles are heavy.',
  paper: 'kraft',
  goal: { type: 'home', x: 620, y: FLOOR },
  draw: 0.05,
  ink: 3000,
  terrain: [],
  entities: [],
  props: [{ type: 'wind', x0: 0, y0: 600, x1: 720, y1: FLOOR, force: -600, at: 0.5 }],
  guy: { x: 90, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Heavy', strokes: CANON.bruiser(220) },
    { kind: 'Many-Legged', strokes: CANON.spider(220) },
    { kind: 'Biped', strokes: CANON.stick700(220) },
  ],
  window: [3, 14],
};

// a sumo shoves him toward a cliff edge: light shapes go over with him
export const L3_2: LevelDef = {
  id: '3-2',
  title: 'Sumo Bully',
  paper: 'kraft',
  goal: { type: 'save', seconds: 6 },
  draw: 0.06,
  ink: 3000,
  floor: false,
  terrain: [[{ x: -40, y: FLOOR }, { x: 580, y: FLOOR }, { x: 580, y: 1300 }, { x: -40, y: 1300 }]],
  entities: [{ type: 'sumo', x: 90, y: FLOOR - 50, at: 0.8, speed: 110 }],
  guy: { x: 500, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Heavy', strokes: CANON.bruiser(380) },
    { kind: 'Giant', strokes: CANON.giant(400) },
    { kind: 'Many-Legged', strokes: CANON.spider(380) },
  ],
  window: [2, 10],
};

// he sits on one end of a see-saw; the flag is on a high ledge: something has to land hard
export const L3_3: LevelDef = {
  id: '3-3',
  title: 'See-Saw',
  paper: 'kraft',
  goal: { type: 'home', x: 640, y: 840 },
  draw: 0.04,
  ink: 3000,
  terrain: [[{ x: 540, y: 840 }, { x: 760, y: 840 }, { x: 760, y: FLOOR }, { x: 540, y: FLOOR }]],
  entities: [],
  props: [{ type: 'seesaw', x: 300, y: 1150, len: 160 }],
  guy: { x: 160, y: 1150 },
  anatomyMatters: true,
  refs: [
    { kind: 'Heavy', strokes: CANON.bruiser(420).map((s) => s.map((p) => ({ x: p.x, y: p.y - 500 }))) },
    { kind: 'Giant', strokes: CANON.giant(420) },
    { kind: 'Springy', strokes: CANON.hopper(420) },
  ],
  window: [2, 12],
};

// the bridge snaps above a load: the twist is that heavy fails
export const L3_4: LevelDef = {
  id: '3-4',
  title: 'Rope Bridge',
  paper: 'kraft',
  goal: { type: 'home', x: 640, y: FLOOR },
  draw: 0.05,
  ink: 2500,
  floor: false,
  terrain: [
    [{ x: -40, y: FLOOR }, { x: 220, y: FLOOR }, { x: 220, y: 1300 }, { x: -40, y: 1300 }],
    [{ x: 520, y: FLOOR }, { x: 760, y: FLOOR }, { x: 760, y: 1300 }, { x: 520, y: 1300 }],
  ],
  entities: [],
  props: [{ type: 'bridge', x0: 220, x1: 520, y: FLOOR, load: 140 }],
  guy: { x: 80, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Springy', strokes: CANON.hopper(150) },
    { kind: 'Floaty', strokes: CANON.floater(150) },
    { kind: 'Biped', strokes: CANON.stick400(150) },
  ],
  window: [3, 14],
};

// the flag is two floors down below cracked floors: nothing passive breaks them
export const L3_5: LevelDef = {
  id: '3-5',
  title: 'Downstairs',
  paper: 'kraft',
  goal: { type: 'home', x: 360, y: FLOOR },
  draw: 0.05,
  ink: 3000,
  terrain: [
    [{ x: -40, y: 860 }, { x: 160, y: 860 }, { x: 160, y: 1300 }, { x: -40, y: 1300 }],
    [{ x: 560, y: 860 }, { x: 760, y: 860 }, { x: 760, y: 1300 }, { x: 560, y: 1300 }],
  ],
  entities: [],
  props: [
    { type: 'crack', x0: 160, x1: 560, y: 860, impulse: 40000 },
    { type: 'crack', x0: 160, x1: 560, y: 1030, impulse: 40000 },
  ],
  guy: { x: 260, y: 860 },
  anatomyMatters: true,
  refs: [
    { kind: 'Heavy', strokes: CANON.bruiser(420).map((s) => s.map((p) => ({ x: p.x, y: p.y - 700 }))) },
    { kind: 'Giant', strokes: CANON.giant(380).map((s) => s.map((p) => ({ x: p.x, y: p.y - 330 }))) },
    { kind: 'Springy', strokes: CANON.hopper(420).map((s) => s.map((p) => ({ x: p.x, y: p.y - 330 }))) },
  ],
  window: [2, 12],
};

export const CHAPTER3: LevelDef[] = [L3_1, L3_2, L3_3, L3_4, L3_5];
