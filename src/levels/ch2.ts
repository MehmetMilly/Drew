// Chapter 2, Boing: zigzag springs; HOME and SCORE begin (levels.md §5). Graph paper.
// Greybox first pass; dimensions from LEVEL_METRICS.md (hopper jump 113 px, stick700
// stride, giant reach 960 px).
import type { LevelDef } from '../sim/level';
import { CANON } from '../sim/canon';

const FLOOR = 1190;

// a ledge 1.3 × the hopper's jump with the flag on top: nothing passive moves him up there
export const L2_1: LevelDef = {
  id: '2-1',
  title: 'Step Up',
  hint: 'Zigzags are springy.',
  paper: 'graph',
  goal: { type: 'home', x: 610, y: FLOOR - 150 },
  draw: 0.05,
  ink: 2500,
  terrain: [[{ x: 430, y: FLOOR - 150 }, { x: 760, y: FLOOR - 150 }, { x: 760, y: FLOOR }, { x: 430, y: FLOOR }]],
  entities: [],
  guy: { x: 110, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Springy', strokes: CANON.hopper(260) },
    { kind: 'Giant', strokes: CANON.giant(280) },
    { kind: 'Biped', strokes: CANON.reacher(260) },
  ],
  window: [3, 14],
};

// a pit wider than a stick figure's stride: worms and boxes fall in with him
export const L2_2: LevelDef = {
  id: '2-2',
  title: 'Mind the Gap',
  paper: 'graph',
  goal: { type: 'home', x: 640, y: FLOOR },
  draw: 0.05,
  ink: 2500,
  floor: false,
  terrain: [
    [{ x: -40, y: FLOOR }, { x: 290, y: FLOOR }, { x: 290, y: 1300 }, { x: -40, y: 1300 }],
    [{ x: 500, y: FLOOR }, { x: 760, y: FLOOR }, { x: 760, y: 1300 }, { x: 500, y: 1300 }],
  ],
  entities: [],
  guy: { x: 80, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Springy', strokes: CANON.hopper(220) },
    { kind: 'Giant', strokes: CANON.giant(250) },
    { kind: 'Many-Legged', strokes: CANON.spider(200) },
  ],
  window: [3, 14],
};

// two little players hold balls under a high hoop: nothing passive dunks
export const L2_3: LevelDef = {
  id: '2-3',
  title: 'Help Them Score',
  paper: 'graph',
  goal: { type: 'score', n: 2, seconds: 12, hoop: { x: 560, y: 720 } },
  draw: 0.05,
  ink: 2500,
  terrain: [],
  entities: [
    { type: 'cargo', x: 140, y: FLOOR - 64 },
    { type: 'cargo', x: 290, y: FLOOR - 64 },
  ],
  guy: { x: 50, y: FLOOR },
  anatomyMatters: true,
  baseline: { x: 360, y: FLOOR - 20 },
  refs: [
    { kind: 'Giant', strokes: CANON.giant(380) },
    { kind: 'Biped', strokes: CANON.stick1100(380) },
    { kind: 'Long-Armed', strokes: CANON.longarm(380) },
  ],
  window: [3, 12],
};

// spikes between him and the flag cut the tips that land on them: ground-walkers lose their feet
export const L2_4: LevelDef = {
  id: '2-4',
  title: 'Spike Floor',
  paper: 'graph',
  goal: { type: 'home', x: 650, y: FLOOR },
  draw: 0.06,
  ink: 3000,
  terrain: [],
  entities: [{ type: 'spikes', x0: 220, x1: 540, y: FLOOR }],
  guy: { x: 90, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Springy', strokes: CANON.hopper(200) },
    { kind: 'Giant', strokes: CANON.giant(300) },
    { kind: 'Biped', strokes: CANON.reacher(200) },
  ],
  window: [3, 14],
};

// rubber balls ricochet in from both sides and above: shields get flanked
export const L2_5: LevelDef = {
  id: '2-5',
  title: 'Pinball Panic',
  paper: 'graph',
  goal: { type: 'save', seconds: 6 },
  draw: 0.08,
  ink: 3000,
  terrain: [],
  entities: [
    { type: 'ball', x: 20, y: 900, vx: 520, vy: -200, at: 1.2 },
    { type: 'ball', x: 700, y: 950, vx: -540, vy: -150, at: 2.0 },
    { type: 'ball', x: 300, y: 80, vx: 120, vy: 300, at: 2.8 },
    { type: 'ball', x: 20, y: 1050, vx: 600, vy: -350, at: 3.6 },
    { type: 'ball', x: 700, y: 700, vx: -450, vy: 0, at: 4.4 },
  ],
  guy: { x: 360, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Springy', strokes: CANON.puncher(360) },
    { kind: 'Many-Legged', strokes: CANON.spider(360) },
    { kind: 'Long-Armed', strokes: CANON.longarm(360) },
  ],
  window: [2, 8],
};

export const CHAPTER2: LevelDef[] = [L2_1, L2_2, L2_3, L2_4, L2_5];
