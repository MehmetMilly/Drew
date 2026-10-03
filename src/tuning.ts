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
  floorY: 1190, // the blank page's felt-tip floor
};

export const BODY = {
  spacing: 10,
  radius: 5,
  bendK: 0.25,
  weldDist: 9,
  graftDist: 14, // px: new ink this close to a living creature grows onto it
  weldEndDist: 28,
  weldEndNear: 18, // beyond this, an end must aim at the other stroke...
  weldAimCos: 0.9, // ...within ~25° // physics.md §1: real finger joins on a phone left 11–19 px gaps
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
  zigCornerSpan: 14, // vertices closer than this are one rounded corner
  zigMaxLongSeg: 400, // tall teeth are fine...
  zigLongTurnDeg: 75, // ...if they turn hard (stairs and lightning bolts stay lines)
  springDominates: 0.5, // a spring covering this much of a run beats loops found inside it
  zigMinAdvance: 0.5, // per-tooth progress vs tooth length: springs advance, shading does not
  hugMaxFrac: 0.25, // an overshoot up to this fraction of its ring's ink...
  hugDist: 30, // ...that stays this close to the ring is part of the loop
  // rounded springs (wiggles): see findWave
  waveSpacing: 6,
  waveHystDeg: 60,
  waveMinSwingDeg: 85, // each bend turns the pen at least this much...
  waveMaxSwingDeg: 420, // ...a tip that curls into a little coil still counts (a helix is springy)
  waveMaxBendFrac: 0.5, // one bend may hold at most this fraction of the stroke's ink
  waveMinBends: 4, // ≈ teeth, like the sharp rule's 4 turns
  waveMinAspect: 1.4,
  waveStraightLen: 30, // a lead-in is straight when 30 px of it turns less than...
  waveStraightDeg: 12,
  waveLeadMul: 0.75, // ...and longer than this fraction of a typical tooth's ink
  waveLeadMin: 40, // tooth height / tooth spacing
  waveMinAdvance: 0.08, // chord / ink over the spring: shading barely advances
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
  reachStretch: 1.08, // a reaching arm's pose stretches at most this much toward a far target
  poseGain: 0.6, // velocity-servo gain carrying arm points to the swung pose
  poseSpeed: 0.5, // × reach speed: the most a lagging arm point is pulled (a bent body is not yanked straight)
  poseCatch: 25, // 1/s: how hard a lagging point catches up (speed = distance × this)
  swingRate: 7, // rad/s an arm swings about its shoulder (× strength factor)
  sectorNear: 8, // px: body this close to a limb root is the joint itself, not a neighbour
  sectorProbe: 45, // px: body within this of a limb root bounds how far the limb may swing
  sectorClear: 0.4, // rad: a swinging limb stops this far short of the body beside it
  shoulderSlack: 0.05, // bend stiffness left at a posed limb's root
  relaxRate: 0.5, // arms ease back to their drawn pose at this fraction of reach speed
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
  anticipation: 0.14, // look.md §5: wind-up before intent
  windup: 0.25, // hands draw back by this fraction of the limb before reaching
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
  stepLift: 0.75, // swing arc height as fraction of stride
  liftCap: 0.5, // ...but never more than this fraction of the leg
  scurry: 1.35, // cadence multiplier for 4+ feet: many legs patter
  cadenceBase: 2.2, // steps/s for a 60px leg
  wriggleAmp: 6, // min hump height (px)
  wriggleAmpMax: 22,
  wriggleAmpK: 0.1, // hump height per px of body size
  wriggleWave: 0.7, // hump wavelength as a fraction of body size
  wriggleFreq: 1.6,
  wriggleSurge: 3,
  wriggleGripLoop: 1,
  wriggleHold: 0.5, // how firmly the hump follows its wave each substep
  wriggleGrip: 5, // extra servo gain on lifted particles (they have no ground friction)
  arriveDist: 14,
  frontMin: 0.08, // head offset (× body size) before a body has a front and turns around
  turnTime: 0.22, // s to mirror around and face the other way
  turnGrace: 0.6, // s after a turnaround during which the body may not tear (it is still settling)
  turnShape: 0.35, // shape-holding strength while mirroring round
  turnSnap: 0.4, // |mirror scale| below this is skipped in one step (a body squashed flat tangles)
  turnWalk: 0.25, // fraction of walking speed kept mid-turn
  rollGain: 0.2, // servo gain for the rolling velocity field
  rollSpeed: 2.4, // legless loops roll faster than they could shuffle
  rollPush: 0.05, // how much of the rolling speed is pushed directly (the rest comes from grip)
  rollSpin: 1.4, // spin beyond pure rolling: corners catch the page and tip it over (a tumble, not a slide)
  hopForward: 2.2, // × walking speed carried forward through each hop
  hopLean: 0.18, // s before take-off the body leans into the hop
};

export const BRAIN = {
  senseBase: 150,
  eyeLead: 0.25, // pupils lock on, then the body follows (0.1 s didn't read in play)
  notice: 0.55, // eye-widening when a new target is noticed
  intentLine: 0.4,
};

export const STRENGTH = {
  ref: 400,
  exp: 0.6,
};

export const CREATURE_COLLIDE = {
  relax: 0.5, // fraction of overlap resolved per contact pass (stops feet wedging links apart)
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
  faceTurn: 0.28, // eye cluster shift toward the facing side, × head radius
  birthPop: 0.45, // s for the eyes to pop open and settle
  pointHeadMin: 16, // eye-cluster radius for creatures without a loop head
  pointHeadMax: 26,
  pointHeadK: 0.06,
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
