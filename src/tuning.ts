// Every tuning number lives here (CLAUDE.md conventions). Game-rule timings that
// the docs own (drying time, draw speeds, ink budgets) are mirrored here with a
// pointer to the doc that defines them.

export const WORLD = {
  W: 720,
  H: 1280,
  gravity: 1800,
  dt: 1 / 60,
  substeps: 2,
  iterations: 10,
  shapeEvery: 3, // shape matching every 3rd iteration
  maxSpeed: 3000,
  maxParticles: 900,
  maxPerCreature: 400,
  damping: 0.998,
  killY: 1280 + 200, // below the page: gone
};

export const BODY = {
  spacing: 10,
  radius: 5,
  bendK: 0.25,
  weldDist: 9,
  weldEndDist: 18,
  // physics.md §3: an end within max(22px, 15% of length) of its own start closes a loop
  closeMin: 22,
  closeFrac: 0.15,
  minLoopArea: 600,
  lumpMassMul: 5,
  loopMass: 0.6, // loops are light
  tearLink: 2.3,
  tearWeld: 24,
  minCreatureInk: 20,
  severMinInk: 60, // design.md §7
};

export const CLASSIFY = {
  rdpEps: 3,
  zigTurnDeg: 70,
  zigMinVerts: 4,
  zigMaxSeg: 45,
  zigMinAdvance: 0.5, // per-tooth progress vs tooth length: springs advance, shading does not
  scribbleRadius: 30,
  scribbleRatio: 4.5,
  scribbleRatioSmall: 3.6, // half-size window, catches small scribbled fists
  scribbleMinHull: 400,
};

export const SHAPE = {
  k: 0.12,
  balance2: 0.85,
  balance1: 0.5,
  balance0: 0.25,
  handTipW: 0.15,
  footTipW: 0.4,
  drivenW: 0.05,
};

export const ACT = {
  reachSpeed: 900,
  reachGain: 0.25,
  reachEnvelope: 1.05,
  // the envelope is measured on the drawn (curved) chain; a straight arm can't stretch
  // past ~0.9 of it without dragging its root: the skyhook (see DECISIONS.md)
  reachSlack: 0.86,
  reachShares: [1, 0.7, 0.45, 0.25],
  grabSlop: 12,
  throwWindup: 0.1,
  throwSwing: 0.3,
  throwSpeed: 950,
  throwSpeedStrength: 250,
  punchCompress: 0.45,
  punchCompressT: 0.15,
  punchExtend: 1.35,
  punchExtendT: 0.1,
  punchCooldown: 0.8,
  springK: 0.9, // spring constraint stiffness at rest
  springKFire: 1.0,
  jumpCompress: 0.5,
  jumpCompressT: 0.18,
  jumpExtend: 1.45,
  jumpExtendT: 0.12,
  jumpCooldown: 0.9,
  anticipation: 0.1, // look.md §5: ~100ms wind-up before intent
};

export const LOCO = {
  gain: 0.06,
  speedBase: 150,
  legMin: 0.8,
  legMax: 2.4,
  footless: 0.3,
  friction: 0.35,
  stanceFriction: 0.92,
  braceFrictionMul: 3,
  stepLift: 0.5, // swing arc height as fraction of stride
  cadenceBase: 2.2, // steps/s for a 60px leg
  wriggleAmp: 4,
  wriggleFreq: 3,
  arriveDist: 14,
};

export const BRAIN = {
  senseBase: 150,
  eyeLead: 0.1, // pupils lead the body by ~100ms
  intentLine: 0.4,
};

export const STRENGTH = {
  ref: 400,
  exp: 0.6,
};

export const CREATURE_COLLIDE = {
  cell: 40,
};

// design.md §3 (game rules mirrored here)
export const INK = {
  wetTime: 1.0,
  wetTimeGentle: 2.0,
  toyDrawSpeed: 0.05,
  easeIn: 0.15,
  easeOut: 0.2,
};

export const PEN = {
  // 1€ filter: fast flicks stay sharp, slow wobbles calmed
  minCutoff: 1.6,
  beta: 0.012,
  dCutoff: 1.0,
  minWidth: 5,
  maxWidth: 7,
};

export const KIND = {
  giantFrac: 0.6,
  tinyPx: 128,
};

export const LOOK = {
  boilFps: 8,
  boilFrames: 3,
  boilAmp: 0.8,
  nameplateHold: 1.5,
  nameplateSlap: 0.16,
  blinkMin: 2,
  blinkMax: 5,
};

export const COLORS = {
  graphite: '#3A3A40',
  felt: '#1B1B1F',
  red: '#E23B2E',
  yellow: '#F2C230',
  blue: '#7FB2E5',
  green: '#2FA84F',
  cream: '#F4F1E8',
};
