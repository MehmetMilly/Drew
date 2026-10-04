// Chapter 3, Heavy Stuff: scribble lumps (levels.md §5). Brown kraft paper. Greybox first
// pass: wind, a sumo bully, a see-saw, a rope bridge that the heavy break, cracked floors.
import type { LevelDef } from '../sim/level';
import { CANON, circle, line, scribbleBlob, springLine } from '../sim/canon';
import type { Pt } from '../sim/geom';

const FLOOR = 1190;
const G = FLOOR - 4;

// Chapter 3 reference bodies: a lump (scribble) is five times the mass. They are ordinary
// drawings, just with a scribble on them.
/** A hopper with a scribbled belly: a spring body that no wind shifts. */
const hopperLump = (x: number): Pt[][] => {
  const hip = G - 120;
  return [circle(x, hip - 70, 34), line(x, hip - 36, x, hip), springLine(x, hip, x - 30, G, 6, 10), springLine(x, hip, x + 30, G, 6, 10), scribbleBlob(x, hip - 18, 26, 16)];
};
/** A bruiser with big scribbled fists and a scribbled belly: all the lumps a gale can't move. */
const bruiserBig = (x: number): Pt[][] => {
  const hip = G - 95,
    neck = hip - 105;
  return [
    circle(x, neck - 28, 28),
    line(x, neck, x, hip),
    [...line(x, neck + 20, x - 80, neck + 50), ...scribbleBlob(x - 95, neck + 55, 34, 18)],
    [...line(x, neck + 20, x + 80, neck + 50), ...scribbleBlob(x + 95, neck + 55, 34, 18)],
    line(x, hip, x - 35, G),
    line(x, hip, x + 35, G),
    scribbleBlob(x, neck + 45, 30, 16),
  ];
};

// a fan blows against the path to a flag on a low windy hill: the route is blocked, so he
// needs a ride, and the gale pushes light bodies back (eased 2026-10-04: a shorter, gentler
// gale plus a hill that a hand tosses him up, a hop clears or a giant carries him over)
const HILL = 100;
export const L3_1: LevelDef = {
  id: '3-1',
  title: 'Gust',
  hint: 'Scribbles are heavy.',
  paper: 'kraft',
  goal: { type: 'home', x: 680, y: FLOOR - HILL, seconds: 13 },
  draw: 0.05,
  ink: 3000,
  terrain: [[{ x: 500, y: FLOOR - HILL }, { x: 760, y: FLOOR - HILL }, { x: 760, y: FLOOR }, { x: 500, y: FLOOR }]],
  entities: [],
  props: [{ type: 'wind', x0: 100, y0: 700, x1: 300, y1: FLOOR, force: -1000, at: 0 }],
  guy: { x: 30, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Heavy', strokes: bruiserBig(150) },
    { kind: 'Biped', strokes: CANON.reacher(150) },
    { kind: 'Giant', strokes: CANON.giant(150) },
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
  entities: [{ type: 'sumo', x: 200, y: FLOOR - 50, at: 0.8, speed: 110 }],
  guy: { x: 480, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Heavy', strokes: CANON.bruiser(380) },
    { kind: 'Giant', strokes: CANON.giant(400) },
    { kind: 'Many-Legged', strokes: CANON.spider(380) },
  ],
  window: [2, 10],
};

// he sits on the high-flinging end of a see-saw; the flag is on a high ledge: something has to land
// hard on the other end (drawn up in the air, it falls onto it) and fling him up and across
export const L3_3: LevelDef = {
  id: '3-3',
  title: 'See-Saw',
  paper: 'kraft',
  goal: { type: 'home', x: 660, y: 980 },
  draw: 0.04,
  ink: 3000,
  terrain: [[{ x: 570, y: 980 }, { x: 760, y: 980 }, { x: 760, y: 1300 }, { x: 570, y: 1300 }]],
  entities: [],
  props: [{ type: 'seesaw', x: 300, y: 1088, len: 240, lo: 0.1, hi: 0.35, flip: true }],
  guy: { x: 496, y: 1129 },
  baseline: { x: 370, y: 1129 }, // beside the see-saw (a shape drawn on the ledge would just lift him)
  anatomyMatters: true,
  refs: [
    { kind: 'Heavy', strokes: CANON.bruiser(70).map((s) => s.map((p) => ({ x: p.x, y: p.y - 400 }))) },
    { kind: 'Giant', strokes: CANON.giant(80).map((s) => s.map((p) => ({ x: p.x, y: p.y - 330 }))) },
    { kind: 'Springy', strokes: hopperLump(70).map((s) => s.map((p) => ({ x: p.x, y: p.y - 700 }))) },
  ],
  window: [0.5, 12],
};

// the bridge snaps above a load: the twist is that heavy fails (lumps and giants break it). Past
// it the far bank is a step up, so what crosses it also needs a hand to toss him or a spring
export const L3_4: LevelDef = {
  id: '3-4',
  title: 'Rope Bridge',
  paper: 'kraft',
  goal: { type: 'home', x: 660, y: 1090 },
  draw: 0.05,
  ink: 2500,
  floor: false,
  terrain: [
    [{ x: -40, y: FLOOR }, { x: 220, y: FLOOR }, { x: 220, y: 1300 }, { x: -40, y: 1300 }],
    [{ x: 520, y: 1090 }, { x: 760, y: 1090 }, { x: 760, y: 1300 }, { x: 520, y: 1300 }],
  ],
  entities: [],
  props: [{ type: 'bridge', x0: 220, x1: 520, y: FLOOR, load: 140 }],
  guy: { x: 80, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Springy', strokes: CANON.hopper(150) },
    { kind: 'Biped', strokes: CANON.stick700(150) },
    { kind: 'Long-Armed', strokes: CANON.longarm(150) },
  ],
  window: [3, 14],
};

// the flag is two floors down below cracked floors: nothing passive breaks them (eased
// 2026-10-04: the top floor gives to a stomp or a fall, the lower, a shorter drop below, to a harder landing;
// the lower floor stays under the flag pole's reach (Little Guy's centre 40+ px above the flag foot is not home))
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
    { type: 'crack', x0: 160, x1: 560, y: 860, impulse: 12000 },
    { type: 'crack', x0: 160, x1: 560, y: 980, impulse: 70000 },
  ],
  guy: { x: 260, y: 860 },
  anatomyMatters: true,
  refs: [
    { kind: 'Heavy', strokes: CANON.bruiser(420).map((s) => s.map((p) => ({ x: p.x, y: p.y - 700 }))) },
    { kind: 'Tiny', strokes: [scribbleBlob(300, 250, 46, 22)] },
    { kind: 'Springy', strokes: hopperLump(420).map((s) => s.map((p) => ({ x: p.x, y: p.y - 650 }))) },
  ],
  window: [0.5, 12],
};

export const CHAPTER3: LevelDef[] = [L3_1, L3_2, L3_3, L3_4, L3_5];
