// Creature data: anatomy, stats, brain and face state. Pure data; behaviour lives
// in anatomy.ts, actuators.ts, locomotion.ts and brain.ts.
import type { Kind } from './names';

export interface Limb {
  tip: number;
  chain: number[]; // tip first, toward the root
  root: number; // first welded / junction particle (envelope centre)
  len: number;
  foot: boolean;
  spring: number; // spring index in creature.springs, -1 none
  group: 0 | 1;
  // gait
  swing: boolean;
  swingT: number;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  // reach / grab
  reaching: boolean;
  grab: number; // constraint id of a grab, -1 none
  grabBody: number; // body id held, -1 none
}

export interface Spring {
  c: number; // constraint id
  a: number; // proximal end particle
  b: number; // distal end particle
  distal: number[]; // particles on the far side (move with the spring in shape matching)
  ax: number; // rest axis (unit, a→b) in rest frame
  ay: number;
  len0: number;
  state: 'idle' | 'compress' | 'extend' | 'recover';
  t: number;
  cool: number;
  leg: boolean;
  zig: number[]; // skin part indices that render this spring (for the drawn zigzag)
}

export interface Lump {
  centre: number;
  ring: number[];
  ink: number;
}

export interface Loop {
  ring: number[];
  links: number[]; // constraint ids of the ring (intact test)
  area: number;
}

export interface Face {
  lookX: number;
  lookY: number;
  wantX: number;
  wantY: number;
  saccade: number;
  blink: number; // seconds until next blink
  blinkT: number; // >0 while blinking
  doubleBlink: boolean;
  squash: number; // 0..1 impact squash on eye shapes
  surprise: number;
  happy: number;
  dizzy: number;
  hurt: number;
  strain: number;
  upsideT: number;
}

export interface Brain {
  mode: 'idle' | 'walk' | 'reach' | 'guard' | 'intercept' | 'brace' | 'carry' | 'sleep';
  targetX: number | null;
  reachX: number;
  reachY: number;
  hasReach: boolean;
  /** world time at which the body may start acting on the latest decision (eyes lead). */
  actAt: number;
  intentAt: number;
  intentX: number;
  intentY: number;
  wave: number;
  gaitPhase: number;
  dir: number;
  wantVx: number;
  jumpCool: number;
  lean: number;
}

export interface Stats {
  ink: number;
  mass: number;
  w: number;
  h: number;
  size: number;
  strength: number;
  speed: number;
  balance: number;
  legLen: number;
  reach: number;
  buoyancy: number;
  stride: number;
  cadence: number;
}

export interface Creature {
  id: number;
  alive: boolean;
  bornAt: number;
  ids: number[];
  cons: number[]; // constraint ids owned (structural + bends)
  loops: Loop[];
  lumps: Lump[];
  springs: Spring[];
  limbs: Limb[];
  head: { kind: 'loop' | 'point'; loop: number; point: number; r: number };
  kind: Kind;
  name: string;
  firstName: string;
  seed: number;
  stats: Stats;
  brain: Brain;
  face: Face;
  /** skin part indices (world.skins) drawn by this creature */
  skins: number[];
  /** original strokes (for Hall, ghosts, grafting) */
  strokes: { x: number; y: number }[][];
  isPiece: boolean;
  grownFrom: number; // creature id this piece came from, -1
  announce: string | null; // "Kevin grew an arm!"
  wetUntil: number;
}

export function newFace(seed: number): Face {
  return {
    lookX: 0,
    lookY: 0,
    wantX: 0,
    wantY: 0,
    saccade: 0,
    blink: 2 + (seed % 300) / 100,
    blinkT: 0,
    doubleBlink: true,
    squash: 0,
    surprise: 0,
    happy: 0,
    dizzy: 0,
    hurt: 0,
    strain: 0,
    upsideT: 0,
  };
}

export function newBrain(): Brain {
  return {
    mode: 'idle',
    targetX: null,
    reachX: 0,
    reachY: 0,
    hasReach: false,
    actAt: 0,
    intentAt: -10,
    intentX: 0,
    intentY: 0,
    wave: 0,
    gaitPhase: 0,
    dir: 1,
    wantVx: 0,
    jumpCool: 0,
    lean: 0,
  };
}
