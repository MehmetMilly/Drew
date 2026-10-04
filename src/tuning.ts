// Every tuning number lives here (CLAUDE.md conventions). Game-rule timings that
// the docs own (drying time, draw speeds, ink budgets) are mirrored here with a
// pointer to the doc that defines them.

export const WORLD = {
  W: 720,
  H: 1280,
  gravity: 1800,
  shotClear: 0.35, // s a SCORE ball passes through the creature that shot it...
  passClear: 0.9, // ...or that it was passed to (so it reaches the hands, not the belly)
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
  holdTime: 0.25, // s a grabbed thing is held before the throw
  throwTime: 0.3, // s of swing before release
  braceFriction: 3,
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
  grabGuy: 18, // px: a hand tip this close to Little Guy's chest picks him up // physics.md §6: tip within target radius + this grabs
  regrab: 0.5, // s after a throw before a hand may grab the same thing again (it has to fly)
  throwWindup: 0.1,
  throwSwing: 0.3,
  throwSpeed: 950,
  shotApex: 46, // px above the rim: a shot's arc peaks here, then drops through
  shotLift: 1.03, // × the launch speed that would just reach the arc's peak (drag takes a little)
  shotMax: 1.15, // a shot needs at most this × the creature's throw speed (else it walks closer)
  throwSpeedStrength: 250,
  tossSpeed: 760, // px/s: how hard a hand tosses Little Guy over a wall or pit (× √strength, at most 1.4)
  punchCompress: 0.45,
  punchCompressT: 0.15,
  punchExtend: 1.35,
  punchExtendT: 0.1,
  punchCooldown: 0.5,
  punchAim: 20, // px: a spring arm punches when its target will be this close to the fully extended fist
  // brace (physics.md §6): a bracing creature with a foot down pushes back on the pusher it
  // touches with braceForce × strength × feet factor (mass·px/s²); footless bodies can't brace
  braceForce: 900000,
  braceFeetBase: 0.5, // feet factor = base + each × feet, at most max: a biped 1.0, a spider 1.5
  braceFeetEach: 0.25,
  braceFeetMax: 1.5,
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
  // carry (HOME): how far ahead it looks for walls, ledges and gaps, and where it waits for him
  tossSwing: 0.4, // s the arm that tossed Little Guy keeps swinging after him
  lookAhead: 28,
  wallProbe: 18,
  gapProbe: 30,
  goalAbove: 50,
  fetchGap: 12,
  senseBase: 150,
  eyeLead: 0.25, // pupils lock on, then the body follows (0.1 s didn't read in play)
  notice: 0.55, // eye-widening when a new target is noticed
  intentLine: 0.4,
  interceptExtra: 60, // px beyond sense range at which a threat still draws an intercept
  predict: 1.5, // s: a threat this many seconds from Little Guy at its speed is intercepted
  braceDist: 60, // a wall within this (+ body width) of him is braced against
  bracePush: 40, // px past the wall face the brace walks toward (so it keeps leaning in)
  braceMeet: 220, // px: a boulder is braced against at most this far in front of him (not chased up its slope)
  guardGap: 20, // px between Little Guy and a guard's near side
  lead: 0.15, // s: hands reach for where a moving threat will be
  punchStand: 0.8, // × spring-arm length: how far from a threat a puncher stands
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
  autoPen: 1100, // px/s: the auto-pen (solution demo, tutorial) draws this fast, in real time
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
  haulWidth: 4.2, // px: the rubber arm a tall carrier hauls Little Guy up with (thins as it stretches)
  foeWidth: 1.5, // a Sumo opponent's line weight vs the player's ink (felt-tip, not pencil)
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

// Little Guy (design.md §10)
export const GUY = {
  size: 1.3, // drawn this × his 40 px body, scaled up from his feet (render only: the sim and
  // every level's tuning keep the 40 px ragdoll; critic-final #1, he must read on a phone)
  height: 40,
  radius: 5,
  mass: 3, // whole ragdoll: light enough to be flung
  standGain: 0.3, // upright servo while a foot is down
  standRate: 12, // 1/s: how fast he straightens
  cowerDrop: 8, // px he crouches when scared
  cowerDist: 260, // a threat this close makes him cower
  startleHop: 260, // px/s up when a big creature is born
  hugDist: 30, // a creature particle this close (and settled) is a hug
  crushGap: 14, // walls closer than his width around him: crushed
  crushReach: 50, // a wall face this close to him has squeezed everything else out: crushed
  ballKill: 380, // px/s: a rubber ball hitting him this hard knocks him out
  boulderKill: 260, // px/s relative speed of a boulder hitting him
  pinTime: 0.5, // s a boulder may rest against him before its weight squashes him
  bladeReach: 10, // px: a ninja's blade reaches this far past his body
  stabTime: 0.2, // s an attacking enemy may stay against him
  enemyKill: 120, // px/s: an enemy touching him faster than this
  blastKill: 140, // bomb lethal radius (physics.md §10)
  squeezeContact: 3, // px: ink this close to a pusher is being shoved by it
  squeezeDepth: 4, // px: shoved ink (or the pusher) this deep inside him...
  squeezeTime: 0.15, // ...for this long: he has nowhere to go, crushed
  // HOME (design §8 Carry, §10): he walks slowly to board, rides on top, or is carried in a hand
  walkSpeed: 45, // px/s: his slow walk to a creature waiting for him
  walkGain: 0.4,
  boardDist: 70, // px: a waiting creature this close (edge to edge), he climbs on
  climbMax: 130, // px: the highest top he can hop up onto; taller creatures must lift him
  rideGain: 0.35, // soft attachment servo to the creature's top
  rideRate: 14,
  rideSlip: 34, // px: pulled this far off his perch, he falls off
  upsideFall: 1, // s upside down before he lets go
  holdSlip: 30, // px: a hand's hold on him breaks at this stretch
  homeDist: 46, // px: his centre this close to the flag pole (x) and below its top: home
  climbTime: 0.5, // s: the hop onto a perch
  climbSpeed: 420, // px/s cap on the hop
  scrambleSpeed: 300, // px/s up a creature taller than he can hop (hands can't reach him)
  hopVx: 150, // px/s: hopping down off a stalled carrier toward the flag
  hopVy: 240,
  hopClear: 0.5, // s he passes through the carrier he hopped off
  scrambleSlack: 1.5, // × the scramble time he is given before the slip test applies (a tall carrier sways)
  scrambleFar: 1000, // px: when the route is blocked (a ledge, a pit, spikes) he will scramble up a giant to ride it
  tossSeat: 30, // px: sitting on his perch (not still scrambling up) to be carried off or tossed
  tossArm: 50, // px: a hand at least this long can toss him
  tossReach: 60, // px: a carrier with a hand this close to a wall or pit (from its front foot) tosses him over it
  tossFollow: 260, // px above where he lands the tossing arm swings
  tossClear: 8, // s he passes through the carrier that tossed him (its arms lie over where he lands)
  tossLift: 1.03, // × the launch speed that would just reach the peak (drag takes a little)
  tossLand: 60, // px past the far edge he is aimed to land
  tossApex: 80, // px above the higher of launch and landing the toss peaks
  stepMax: 30, // px: a step in the ground he can walk up or down himself
  scrambleMax: 500, // px: a top higher than this he won't scramble up (he walks home beside it)
  reboard: 1.0, // s after getting off before he climbs on again
  flagWalk: 200, // px: this close to the flag he walks the rest himself
  stallProgress: 3, // px: a carrier that has moved this far from where it last made progress is walking
  stallDrop: 0.6, // s a carrier may stall near the flag before he hops down
};

// Hazards (physics.md §10); difficulty lives in each level's entity parameters
export const HAZ = {
  boulderR: 48,
  boulderMass: 80,
  boulderFriction: 0, // body-terrain friction is a per-contact damper: 0 lets a boulder run down a slope
  bombR: 15,
  bombMass: 3,
  bombBounce: 0.12, // low: bouncy bombs ricochet off any passive shape (spike lesson)
  bombFuse: 3.2,
  blastRadius: 170,
  blastSpeed: 900, // px/s outward kick at the centre
  blastCut: 55,
  crusherW: 40,
  crusherMass: 1600, // heavy enough that only weight and strength can push it back (stalled walls recoil by mass share)
  crusherSpeed: 70,
  crusherForce: 1200000, // mass × px/s²: the motor's limit (a spider, a long-armed biped or a bruiser holds it; a thin stick figure does not)
  ninjaR: 16,
  ninjaMass: 40,
  ninjaApex: 220,
  ninjaTell: 0.5, // s of crouch before the leap
  ninjaCut: 8, // px beyond his body at which his blade cuts links (any link passing that close)
  ninjaRun: 260, // px/s: dash along the ground after landing
  ninjaRunGain: 0.08,
  ninjaVault: 110, // px above the higher of him and Little Guy: the hop over what blocks his dash
  ninjaVaultCool: 0.5, // s between leaps
  ninjaVaultRise: 30, // px: Little Guy this far above him...
  ninjaVaultRange: 200, // ...and this close: he vaults up at him
  ninjaLook: 18, // px ahead of him the dash checks for ground in the way
  strikeSpeed: 220, // px/s: a hand, fist or spring moving at him this fast knocks him away
  strikeSlop: 8, // px beyond contact at which a strike lands (about one substep of a punch)
  ninjaKnock: 520, // px/s he is knocked away along the blow
  ninjaKnockUp: 260, // px/s of that upward
  ninjaStun: 1.0, // s dizzy after a knock (physics.md §10)
  ninjaThrownStun: 1.2, // s dizzy after being thrown (counted from the release)
  braceContact: 4, // px: a creature this close to a pusher is touching it (and can brace)
  crusherBack: 40, // px/s: the most a braced wall is eased back
  sawStall: 0.5, // a toothed wall slower than this × its speed, and not out-braced, is stalled by ink...
  sawReach: 9, // ...and its teeth cut every link with an end this close to its face
  grindStall: 60, // px/s: a boulder this slow, pressing on ink that is not bracing it, grinds through it...
  grindReach: 4, // ...cutting links with an end this close to its surface...
  grindRate: 3, // ...this many per step, nearest first
  ballR: 18, // rubber balls (2-5): bouncy threats launched across the page
  ballMass: 6,
  ballBounce: 0.85,
  ballLife: 9, // s a rubber ball bounces around before it rolls off the page
  cargoR: 16, // SCORE balls (yellow): grabbable, light, held up by the little players
  cargoMass: 3,
  cargoBounce: 0.55,
  passRange: 280, // px: a creature coming for a SCORE ball this close gets it passed up
  passOver: 30, // px above its top the pass is aimed
  passApex: 70, // px the pass rises above that
  passEvery: 1.2, // s between passes from one player
  sumoR: 46, // the sumo bully (3-2): a heavy round pusher
  sumoMass: 600,
  sumoSpeed: 60, // px/s he shoves at
  sumoForce: 1500000, // mass × px/s²: his legs' limit (bracers take theirs off it): a roof (0.7M) or a lump on the ground is pushed, a bruiser, giant or spider (2M) holds him
  sumoStamp: 1.0, // s of stamping before the shove
  sumoBack: 40, // px/s: the most a braced sumo is eased back
  spikeH: 22, // px: spike teeth height above the ground they stand on
};

export const LEVEL = {
  flagH: 110, // px: the HOME flag pole
  boardSee: 260, // px: a carrier this close (edge to edge), he walks over to it
  autoStart: 2.5, // s: the countdown starts at the first birth, or now
  hugHold: 0.4, // s of contact that counts as a hug
  foresee: 0.5, // s: a sleeping threat this close to waking already counts
  readTime: 1.0, // s the title holds the first frame (design §2)
  failBeat: 0.6, // s of comic beat before a tap retries
  stuckInk: 40, // px of ink left below which the player can't draw anything that helps
  stuckMove: 30, // px Little Guy must move to count as progress
  stuckTime: 6, // s of no progress, ink spent, before a clockless attempt fails as 'stuck'
  toyRespawn: 1, // s after the poof before Little Guy pops back on the Doodle Pad (it never fails)
  hitStop: 0.15, // s the world freezes as the stamp lands
  cardDelay: 1.3, // s from the win to the end card
  celebrate: 1.6, // s of live happy faces (closed-arc eyes, the hug, the heart) before the highlight replay
  cardAfterStamp: 1.1, // s the stamp and the happy page hold before the end card
  hoopW: 70, // px: SCORE rim width (a ball dropping through it scores)
  hoopBoard: 60, // px: the backboard above the rim
  cargoBack: 1.6, // s a loose ball lies still before a little player takes it back
  scoreBack: 0.9, // s after a score before the ball is back with its player
};

export const PROP = {
  // wind (physics.md §8): px/s² on a mass-1 particle; lumps (5×) resist, Little Guy (0.5) flies
  gust: 0.3, // share the wind dips by in its gusts
  windBody: 1, // the same push on loose bodies, per unit mass
  shadeLen: 90, // px: ink this close upwind of Little Guy, at his height (±shadeH), shelters him...
  shadeH: 34,
  shade: 0.15, // ...down to this share of the wind
  riderWind: 0.2, // riding or held, he hunkers down and holds on
  windBlock: 1000, // a wind this strong across his way blocks the route: he can't walk it, so a tall carrier takes him up
  // cracked floors and rope bridges (physics.md §10)
  crackH: 40, // px: slab thickness
  bridgeH: 10,
  touch: 4, // px above a slab that still counts as resting on it
  landMin: 120, // px/s: slowing faster than this in a step is a landing (impact = Σ m·Δv)
  peakFade: 0.97, // the drawn strain eases back after a load goes
  chunk: 46, // px: falling pieces of a broken slab
  lurch: 0.6, // s after a floor or bridge gives way that no carrier can toss (it is falling)
  snapDelay: 0.35, // s a bridge carries too much before the ropes let go (the carrier is on it by then)
  // see-saw: a heavy rigid plank on a pivot
  plankMass: 400,
  plankHalf: 7, // px: half its thickness
  seesawTilt: 0.32, // rad it tips before an end meets the ground
  seesawDamp: 0.995,
  seesawRate: 4, // rad/s: the most a see-saw turns, so a hit hard enough always flings the same
  // rafts (4-4): a heavy floating log platform
  raftHalf: 10, // px half-thickness
  raftMass: 1500,
  raftGrip: 0.3, // what stands on it is carried along
  // kraken tentacles (4-5)
  tipR: 14,
  tentacleReach: 420, // px from its root
  tentacleSpeed: 260, // px/s reaching
  tentacleBack: 500, // px/s recoiling
  tentacleRecoil: 1.4, // s it stays down after a hit
  tentacleHit: 200, // px/s: a strike this fast makes it let go
  tentaclePull: 400000, // mass × px/s²: its yank on Little Guy alone (whatever he sits on lets go of him)...
  tentacleHold: 18000, // ...its haul on a carrier that holds him in a hand (and him with it)...
  tentacleGrip: 2500, // ...less this for each planted foot (× strength) of whoever holds him
};

export const WATER = {
  // buoyancy is a force per particle (px/s² on mass 1). A loop particle weighs 0.6, a line 1, gravity pulls
  // 1800 per unit of mass: a line sinks, and a ring point nets (buoy + loopBuoy × area / ring points) − 1080,
  // so a loop only floats once its area per point passes ~310 (a box 120 px a side is neutral, a hoop 300 px
  // across lifts 750 per point). Little Guy and what he sits on have to be lifted by that surplus.
  buoy: 300,
  loopBuoy: 2.5,
  loopMax: 4000,
  guyBuoy: 500, // Little Guy can't swim: he sinks
  floatAccel: 2600, // floating things (ducks, rafts) on the surface
  full: 24, // px under before buoyancy is full (a soft surface)
  drag: 4, // per s
  swim: 120, // px/s a paddler swims at...
  swimBase: 0.35, // ...times this + each limb or spring's share (paddling)
  swimLimb: 0.15,
  swimWet: 0.3, // share of its body under before it swims
  swimGain: 0.05,
  drown: 1.0, // s with his head under
};

/** Chapter 5 ink damage (physics.md §10): scissors, fire, smudgers and the Big Eraser. */
export const DMG = {
  scissorsR: 16, // px body radius
  scissorsSpeed: 260, // px/s
  scissorsTurn: 1.6, // rad/s: they swing round wide when they miss
  scissorsCut: 4, // px beyond the body that the blades cut
  scissorsTell: 0.6, // s snapping in place before the first pass
  scissorsPasses: 3, // passes at him before they give up and fly off the page
  scissorsMiss: 60, // px past its closest approach that ends a pass
  scissorsCatch: 3, // points at the end of a hand that can close on them
  scissorsKnock: 520, // px/s a hard hit knocks them away
  scissorsKnockUp: 200, // px/s of that upward
  scissorsDrag: 1.6, // 1/s: how fast a knocked pair slows
  scissorsStun: 0.8, // s tumbling, blades shut, after a knock
  fireSpeed: 70, // px/s the floor fire spreads
  fireH: 18, // px above the floor the flames reach
  burnSpeed: 90, // px/s fire climbs a link
  burnLife: 1.2, // s a point burns before it crumbles
  smudgerR: 11,
  smudgerSpeed: 110, // px/s crawl (ground friction holds them to about 75% of it): any faster and feet can't stomp them
  smudgerStallV: 20, // px/s: slower than this against something...
  smudgerStall: 0.35, // s: ...this long, and it hops over it
  smudgerGain: 0.3, // per substep: how hard they scuttle toward that speed
  smudgerHop: 0.8, // s between hops
  smudgerJump: 420, // px/s hop up toward high ink
  eatEvery: 0.12, // s per point eaten
  nibble: 0.5, // s touching him before he is rubbed out
  stomp: 60, // px/s: a foot coming down on a smudger this fast...
  stepOn: 4, // px: ...within its radius plus this (it scuttles under ink, so feet land on it)...
  stepMass: 40, // ...of a creature at least this heavy squashes it
  underFoot: 0.5, // × its radius: crawling this far under a planted foot of such a creature squashes it too
  eraserW: 180,
  eraserH: 108,
  eraserMass: 300,
  eraserSpeed: 45, // px/s it slides at him in phase 1
  eraserForce: 40000, // mass·px/s² motor limit: any planted bracer out-pushes it
  eraserBack: 60, // px/s a braced Eraser is driven back at: a slow, straining shove to the sharpener
  eraserShrink: 0.8, // × its size once sharpened
  eraserOutVx: 260, // px/s: it leaps back out of the sharpener at him, over whatever is at the mouth
  grindTime: 1.2, // s it is held grinding in the sharpener
  knocksToCrumble: 2, // mid-air knocks back into the sharpener before it crumbles (each one sharpens it smaller)
  eraserHopV: 620, // px/s up: its leap back out of the sharpener
  eraserLeapApex: 90, // px: each leap at him peaks this high (into the hands of whoever stands guard)...
  eraserHopVx: 320, // ...at up to this many px/s across (it lands on him if it can)
  eraserHopRest: 1.2, // s on the ground between hops
  eraserKnock: 520, // px/s at most: a mid-air hit lobs it back into the sharpener's mouth...
  knockLobT: 0.6, // s ...in a flight at least this long (a far lob goes higher, never faster)
  eraserKnockCool: 0.3, // s before it can be knocked again
  knockSlop: 10, // px beyond its faces a strike lands...
  knockSpeed: 220, // ...moving this fast
  slamErase: 8, // points it rubs out of what it lands on
  rubRate: 4, // points per s it rubs out of what touches it
  rubStill: 5, // px/s: in phase 1 it rubs only the face it slides into (held still or driven back, nothing)
  fleeDist: 160, // px: Little Guy walks away from an Eraser this close...
  fleeEdge: 30, // ...as far as this from the page edge
  sharpenerW: 70, // px: the sharpener's mouth from the page edge
  crumbs: 3, // smudgers it crumbles into...
  crumbSpeed: 80, // px/s ...dazed: slower than a fresh smudger...
  crumbEatSlow: 3, // ...and eating ink this many times slower
  crumbsAt: 0, // s after the last grind the first crumb comes alive (at once: there is always a threat to face)...
  crumbsEvery: 1.5, // ...and the rest this far apart
};

/** Sumo mode (design §12, sumo.ts). */
export const SUMO = {
  wallMul: 1.5, // opposing teams' ink collides at this × the usual particle diameter (no slipping between thin links)
  linkMul: 1.6, // a particle keeps this × its radius off the other team's links
  wallRelax: 1, // ...and resolves the whole overlap per pass
  noDraw: 30, // px around the opponent's ink the pencil skips over (ink there would tangle with it)
  drive: 60, // px: it aims this far beyond the opponent, so it keeps walking into it
  reachLow: 10, // px below the opponent's centre that hands go for (under its weight)
  outDepth: 30, // px below the ring top a centre of mass counts as off
  edgeSlop: 10, // px beyond the ring's edge
  foeLag: 0.8, // s the pre-drawn opponent waits to act after waking: the player's creature gets the first lean
  grace: 0.6, // s after waking before anyone can lose
  shrink: 45, // px/s from each edge after time-out (visible: the bout ends soon after): it keeps going until someone falls
  minHalf: 6, // px: the ring never shrinks below this half width
  lavaDepth: 120, // px below the ring top the lava surface lies: whatever touches it burns
  // Little Guy hangs in a cage over the lava (top right), out of the fight; a win frees him
  cageX0: 612,
  cageX1: 700,
  cageY: 440, // px: the cage floor (a thin terrain slab he stands on)
  cageH: 86, // px: bars above the floor
  cageLift: 0.45, // s the bars take to swing up when he is freed
  freeVx: -195, // px/s: his leap out of the open cage, down onto the ring
  freeVy: -330,
  penSpeed: 900, // px/s: the pre-drawn opponent's strokes are timed as a steady hand
};

/** Daily Doodle (design §12, daily.ts). */
export const DAILY = {
  heavy: 5, // Heavy Ink: every particle this many times its mass, as if all of it were lump
};

/** The Doodle Pad sandbox (design §12, doodle.ts). */
export const DOODLE = {
  dropOut: 220, // px from the page centre a dropped hazard lands, away from him
  dropY: 120, // px: dropped in from near the top
  waterDepth: 150, // px of water when it is on: over his head, so someone has to float him
  wind: 2600, // the gale's force
  lowGravity: 0.35, // × gravity when it is on
};
