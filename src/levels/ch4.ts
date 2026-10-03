// Chapter 4, Wet Paper: loops float (levels.md §5). Cold-press watercolour paper. Greybox
// first pass: a rising tide, a river crossing, ducks into a bucket, a raft at a waterfall and
// the kraken.
import type { LevelDef } from '../sim/level';
import { CANON } from '../sim/canon';

const FLOOR = 1190;

// the room floods: nothing standing is tall enough; something has to float him
export const L4_1: LevelDef = {
  id: '4-1',
  title: 'Rising Tide',
  hint: 'Loops float.',
  paper: 'wash',
  goal: { type: 'save', seconds: 8 },
  draw: 0.05,
  ink: 3000,
  terrain: [],
  entities: [],
  props: [{ type: 'water', x0: 0, x1: 720, y: FLOOR + 4, rise: 50, at: 1.5, top: 760 }],
  guy: { x: 360, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Floaty', strokes: CANON.floater(300) },
    { kind: 'Biped', strokes: CANON.stick700(300) },
    { kind: 'Many-Legged', strokes: CANON.spider(300) },
  ],
  window: [2, 10],
};

// a river with a slow current between the banks: sinks or drifts away
export const L4_2: LevelDef = {
  id: '4-2',
  title: 'Crossing',
  paper: 'wash',
  goal: { type: 'home', x: 650, y: 1100 },
  draw: 0.05,
  ink: 3000,
  floor: false,
  terrain: [
    [{ x: -40, y: 1100 }, { x: 200, y: 1100 }, { x: 240, y: 1300 }, { x: -40, y: 1300 }],
    [{ x: 520, y: 1300 }, { x: 560, y: 1100 }, { x: 760, y: 1100 }, { x: 760, y: 1300 }],
    [{ x: -40, y: 1250 }, { x: 760, y: 1250 }, { x: 760, y: 1300 }, { x: -40, y: 1300 }],
  ],
  entities: [],
  props: [{ type: 'water', x0: 200, x1: 560, y: 1115, current: 45 }],
  guy: { x: 80, y: 1100 },
  anatomyMatters: true,
  refs: [
    { kind: 'Floaty', strokes: CANON.floater(160).map((s) => s.map((p) => ({ x: p.x, y: p.y - 90 }))) },
    { kind: 'Giant', strokes: CANON.giant(250) },
    { kind: 'Biped', strokes: CANON.stick1100(160).map((s) => s.map((p) => ({ x: p.x, y: p.y - 90 }))) },
  ],
  window: [3, 14],
};

// three rubber ducks to herd into a bucket: nothing passive herds
export const L4_3: LevelDef = {
  id: '4-3',
  title: 'Bath Time',
  paper: 'wash',
  goal: { type: 'score', n: 3, seconds: 15, hoop: { x: 630, y: 1030, bucket: true } },
  draw: 0.05,
  ink: 3000,
  terrain: [[{ x: 540, y: 1100 }, { x: 760, y: 1100 }, { x: 760, y: FLOOR }, { x: 540, y: FLOOR }]],
  entities: [
    { type: 'cargo', x: 110, y: 1040, duck: true },
    { type: 'cargo', x: 250, y: 1040, duck: true },
    { type: 'cargo', x: 400, y: 1040, duck: true },
  ],
  props: [{ type: 'water', x0: 0, x1: 540, y: 1060 }],
  guy: { x: 680, y: 1100 },
  anatomyMatters: true,
  baseline: { x: 420, y: 1080 },
  refs: [
    { kind: 'Long-Armed', strokes: CANON.longarm(300) },
    { kind: 'Biped', strokes: CANON.reacher(300) },
    { kind: 'Floaty', strokes: CANON.floater(300) },
  ],
  window: [3, 15],
};

// his raft drifts toward a waterfall: hold it, or haul him ashore
export const L4_4: LevelDef = {
  id: '4-4',
  title: 'Waterfall',
  paper: 'wash',
  goal: { type: 'save', seconds: 8 },
  draw: 0.07,
  ink: 3000,
  floor: false,
  terrain: [
    [{ x: -40, y: 1100 }, { x: 140, y: 1100 }, { x: 160, y: 1300 }, { x: -40, y: 1300 }],
    [{ x: -40, y: 1240 }, { x: 760, y: 1240 }, { x: 760, y: 1300 }, { x: -40, y: 1300 }],
  ],
  entities: [],
  props: [
    { type: 'water', x0: 140, x1: 720, y: 1120, current: 70 },
    { type: 'raft', x: 240, y: 1112, len: 60 },
  ],
  guy: { x: 240, y: 1095 },
  anatomyMatters: true,
  refs: [
    { kind: 'Heavy', strokes: CANON.bruiser(80) },
    { kind: 'Long-Armed', strokes: CANON.longarm(80) },
    { kind: 'Floaty', strokes: CANON.floater(80) },
  ],
  window: [2, 10],
};

// tentacles grab him and pull toward the water: a tug of war
export const L4_5: LevelDef = {
  id: '4-5',
  title: 'Kraken',
  paper: 'wash',
  goal: { type: 'save', seconds: 8 },
  draw: 0.07,
  ink: 3500,
  terrain: [[{ x: -40, y: 1080 }, { x: 330, y: 1080 }, { x: 380, y: FLOOR }, { x: -40, y: FLOOR }]],
  entities: [],
  props: [
    { type: 'water', x0: 330, x1: 720, y: 1100 },
    { type: 'tentacle', x: 600, y: 1170, at: 1.5 },
    { type: 'tentacle', x: 520, y: 1180, at: 3.5 },
  ],
  guy: { x: 250, y: 1080 },
  anatomyMatters: true,
  refs: [
    { kind: 'Heavy', strokes: CANON.bruiser(200) },
    { kind: 'Springy', strokes: CANON.puncher(200) },
    { kind: 'Long-Armed', strokes: CANON.longarm(200) },
  ],
  window: [2, 10],
};

export const CHAPTER4: LevelDef[] = [L4_1, L4_2, L4_3, L4_4, L4_5];
