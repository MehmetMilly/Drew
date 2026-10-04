// Chapter 4, Wet Paper: loops float (levels.md §5). Cold-press watercolour paper.
// Water numbers (tuning.ts WATER): a loop only floats him if it is big (area per ring point), so a
// 120 px box sinks and a hoop 300 px across floats; the deep rivers are 290-330 px, more than a
// pillar plus Little Guy, so a lazy shape drowns him and it takes a tall wader, a giant or a float.
import type { LevelDef } from '../sim/level';
import { CANON, circle, line, scaleAbout, shift } from '../sim/canon';

const FLOOR = 1190;
const G = FLOOR - 4;
/** a snowman: two touching loops sitting on the floor (no feet: it floats, it does not walk) */
const snowman = (x: number, r1: number, r2: number) => [circle(x, G - r1, r1), circle(x, G - 2 * r1 - r2 + 6, r2)];
/** a stick figure with an air sac on its belly (two loops: a floaty that still has hands) */
const sacman = (x: number, k = 1) => {
  const st = CANON.stick700(x);
  return [...st, circle(x, G - 95 * 0.95 * k - 55 * k, 20)];
};
/** a hoop with a stick body under it: one big loop is its head (a biped that floats) */
const balloon = (x: number, r: number) => [circle(x, G - 125 - r, r), line(x, G - 125, x, G - 55), line(x, G - 55, x - 28, G), line(x, G - 55, x + 28, G), line(x, G - 110, x - 40, G - 80), line(x, G - 110, x + 40, G - 80)];
/** a drawing scaled about its feet */
const big = (k: string, x: number, s: number) => scaleAbout(CANON[k](x), s, x, G);

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
  props: [{ type: 'water', x0: 0, x1: 720, y: FLOOR + 4, rise: 90, at: 1.5, top: 600 }],
  guy: { x: 360, y: FLOOR },
  anatomyMatters: true,
  refs: [
    { kind: 'Floaty', strokes: snowman(300, 100, 80) },
    { kind: 'Giant', strokes: CANON.giant(300) },
    { kind: 'Many-Legged', strokes: balloon(300, 150) },
  ],
  window: [2, 10],
};

// a deep, wide river with a slow current: a pillar wades only to its own height, so it takes a
// tall wader (Little Guy's head above the water), a giant, or a hand that tosses him across
const BANK = 880;
const onBank = (strokes: ReturnType<typeof CANON.giant>) => shift(strokes, 0, BANK - FLOOR);
export const L4_2: LevelDef = {
  id: '4-2',
  title: 'Crossing',
  hint: 'It is deeper than you are.',
  paper: 'wash',
  goal: { type: 'home', x: 690, y: BANK },
  draw: 0.05,
  ink: 3000,
  terrain: [
    [{ x: -40, y: BANK }, { x: 150, y: BANK }, { x: 158, y: FLOOR }, { x: -40, y: FLOOR }],
    [{ x: 600, y: BANK }, { x: 760, y: BANK }, { x: 760, y: FLOOR }, { x: 600, y: FLOOR }],
  ],
  entities: [],
  props: [{ type: 'water', x0: 150, x1: 600, y: BANK + 4, current: 45 }],
  guy: { x: 70, y: BANK },
  anatomyMatters: true,
  refs: [
    { kind: 'Giant', strokes: onBank(CANON.giant(250)) },
    { kind: 'Biped', strokes: onBank(CANON.stick1100(160)) },
    { kind: 'Heavy', strokes: onBank(CANON.bruiser(120)) },
  ],
  window: [1.5, 14],
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
    { kind: 'Floaty', strokes: sacman(300) },
  ],
  window: [3, 15],
};

// his raft drifts toward a waterfall (the river ends at a drop with no floor): the water is deeper
// than a pillar, so he has to be held where he is, hauled ashore or carried clear
const FALLS = 560;
export const L4_4: LevelDef = {
  id: '4-4',
  title: 'Waterfall',
  paper: 'wash',
  goal: { type: 'save', seconds: 8 },
  draw: 0.07,
  ink: 3000,
  floor: false,
  terrain: [
    [{ x: -40, y: 880 }, { x: 140, y: 880 }, { x: 148, y: FLOOR }, { x: -40, y: FLOOR + 300 }],
    [{ x: -40, y: FLOOR }, { x: FALLS, y: FLOOR }, { x: FALLS, y: FLOOR + 300 }, { x: -40, y: FLOOR + 300 }],
  ],
  entities: [],
  props: [
    { type: 'water', x0: 140, x1: FALLS, y: 900, current: 70 },
    { type: 'raft', x: 260, y: 892, len: 60 },
  ],
  guy: { x: 260, y: 880 },
  anatomyMatters: true,
  refs: [
    { kind: 'Giant', strokes: CANON.giant(445) },
    { kind: 'Biped', strokes: shift(CANON.stick1100(80), 0, 880 - FLOOR) },
    { kind: 'Long-Armed', strokes: shift(CANON.longarm(60), 0, 880 - FLOOR) },
  ],
  window: [2, 10],
};

// tentacles grab him and haul him toward their roots in the lake: a tug of war. Whatever he only
// sits on lets go of him (a heavy lump is no anchor); a body that holds him in a hand is dragged
// with him unless it plants its feet, and a hard hit makes a tentacle let go
const SHORE = 1080;
export const L4_5: LevelDef = {
  id: '4-5',
  title: 'Kraken',
  paper: 'wash',
  goal: { type: 'save', seconds: 8 },
  draw: 0.07,
  ink: 3500,
  terrain: [[{ x: -40, y: SHORE }, { x: 330, y: SHORE }, { x: 380, y: FLOOR }, { x: -40, y: FLOOR }]],
  entities: [],
  props: [
    { type: 'water', x0: 330, x1: 720, y: 1100 },
    { type: 'tentacle', x: 600, y: 1170, at: 2.5 },
    { type: 'tentacle', x: 520, y: 1180, at: 4 },
  ],
  guy: { x: 250, y: SHORE },
  anatomyMatters: true,
  refs: [
    { kind: 'Springy', strokes: big('puncher', 100, 1.4) },
    { kind: 'Giant', strokes: CANON.giant(150) },
    { kind: 'Biped', strokes: CANON.stick1100(100) },
  ],
  window: [2, 10],
};

export const CHAPTER4: LevelDef[] = [L4_1, L4_2, L4_3, L4_4, L4_5];
