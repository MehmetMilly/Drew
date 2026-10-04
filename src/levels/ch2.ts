// Chapter 2, Boing: zigzag springs; HOME and SCORE begin (levels.md §5). Graph paper.
// Dimensions from LEVEL_METRICS.md and the notes in DECISIONS.md (Chapter 2 tuned): a hopper
// clears a ledge about 1.3 × its own jump only when drawn a little large; anything with a hand
// tosses Little Guy over a wall, pit or spikes; a giant carries him on its head.
import type { LevelDef } from '../sim/level';
import { CANON, scaleAbout } from '../sim/canon';

const FLOOR = 1190;
const G = FLOOR - 4;
/** a drawing scaled about its feet (a bigger spring jumps higher: the hopper at 1.2 clears 190 px) */
const big = (k: string, x: number, s: number) => scaleAbout(CANON[k](x), s, x, G);
// the ledge on 2-1: higher than a walker steps and than a plain hopper jumps (a 1.1× hopper clears it)
const LEDGE = 150;

// a ledge 1.3 × a plain hopper's jump with the flag on top: only a bigger spring jumps it with him,
// a hand tosses him up, a giant carries him on its head; nothing passive moves him up there
export const L2_1: LevelDef = {
  id: '2-1',
  title: 'Step Up',
  hint: 'Zigzags are springy.',
  paper: 'graph',
  goal: { type: 'home', x: 610, y: FLOOR - LEDGE },
  draw: 0.05,
  ink: 2500,
  terrain: [[{ x: 430, y: FLOOR - LEDGE }, { x: 760, y: FLOOR - LEDGE }, { x: 760, y: FLOOR }, { x: 430, y: FLOOR }]],
  entities: [],
  guy: { x: 110, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Springy', strokes: big('hopper', 260, 1.1) },
    { kind: 'Giant', strokes: CANON.giant(280) },
    { kind: 'Biped', strokes: CANON.reacher(260) },
  ],
  window: [3, 14],
};

// a pit wider than a stick figure's stride: worms and boxes fall in with him; a hop clears it,
// a hand tosses him across, a giant carries him over
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
    { kind: 'Biped', strokes: CANON.reacher(200) },
  ],
  window: [3, 14],
};

// three little players hold balls far from a hoop: nothing passive dunks, and a long walk
// between pass and shot keeps the pace honest (eased 2026-10-04: the rim is 110 px off the floor,
// not 470, so a short stick figure and a worm reach it too)
export const L2_3: LevelDef = {
  id: '2-3',
  title: 'Help Them Score',
  paper: 'graph',
  goal: { type: 'score', n: 3, seconds: 12, hoop: { x: 640, y: 1080 } },
  draw: 0.05,
  ink: 2500,
  terrain: [],
  entities: [
    { type: 'cargo', x: 60, y: FLOOR - 64 },
    { type: 'cargo', x: 150, y: FLOOR - 64 },
    { type: 'cargo', x: 240, y: FLOOR - 64 },
  ],
  guy: { x: 30, y: FLOOR },
  anatomyMatters: true,
  baseline: { x: 360, y: FLOOR - 20 },
  refs: [
    { kind: 'Giant', strokes: CANON.giant(330) },
    { kind: 'Biped', strokes: CANON.stick1100(330) },
    { kind: 'Long-Armed', strokes: CANON.longarm(330) },
  ],
  window: [1.5, 12],
};

// spikes between him and the flag cut the tips that land on them: ground-walkers lose their feet;
// a hop clears them, a hand tosses him over, a giant carries him above them
export const L2_4: LevelDef = {
  id: '2-4',
  title: 'Spike Floor',
  paper: 'graph',
  goal: { type: 'home', x: 678, y: FLOOR },
  draw: 0.06,
  ink: 3000,
  terrain: [],
  entities: [{ type: 'spikes', x0: 370, x1: 610, y: FLOOR }],
  guy: { x: 50, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Springy', strokes: CANON.hopper(150) },
    { kind: 'Giant', strokes: CANON.giant(140) },
    { kind: 'Biped', strokes: CANON.reacher(150) },
  ],
  window: [2.5, 14],
};

// two bombs drop into the bowl beside him (so a shield stays inside the blast) while rubber
// balls ricochet in from the side and above: it takes catching, throwing and punching (eased
// 2026-10-04: bombs drop at 2.0 and 2.8 s, not 1.2 and 2.0, and one of the three balls is gone)
export const L2_5: LevelDef = {
  id: '2-5',
  title: 'Pinball Panic',
  paper: 'graph',
  goal: { type: 'save', seconds: 6 },
  draw: 0.08,
  ink: 3000,
  terrain: [
    [{ x: -200, y: 1000 }, { x: 160, y: 1000 }, { x: 330, y: FLOOR }, { x: -200, y: FLOOR }],
    [{ x: 390, y: FLOOR }, { x: 560, y: 1000 }, { x: 920, y: 1000 }, { x: 920, y: FLOOR }],
  ],
  entities: [
    { type: 'bomb', x: 330, y: 300, at: 2.0, fuse: 3.5 },
    { type: 'bomb', x: 395, y: 200, at: 2.8, fuse: 3.5 },
    { type: 'ball', x: 20, y: 900, vx: 520, vy: -200, at: 1.5, life: 1.8 },
    { type: 'ball', x: 700, y: 700, vx: -450, vy: 0, at: 4.0, life: 1.8 },
  ],
  guy: { x: 360, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Biped', strokes: CANON.reacher(260) },
    { kind: 'Giant', strokes: CANON.giant(360) },
    { kind: 'Heavy', strokes: CANON.bruiser(300) },
  ],
  window: [3, 12],
};

export const CHAPTER2: LevelDef[] = [L2_1, L2_2, L2_3, L2_4, L2_5];
