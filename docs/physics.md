# Drew: simulation and physics

## 1. The governing split

**Intent is puppeted; consequence is simulated.**

- **Intent**: where a creature walks, what a hand reaches for, a throw, a jump, a brace. Intent is applied as *compliant velocity servos* that nudge particle velocities toward a desired velocity, with a gain below 1 and a speed cap. Every servo target is clamped inside what the body can physically reach.
- **Consequence**: everything else is plain physics: gravity, mass, collisions, constraint stiffness, buckling, tearing, buoyancy, explosions. The physics is never overridden to make a creature succeed.

The result is creatures that look purposeful but succeed or fail because of the body the player drew.

## 2. World and step

- Logical world **720 × 1280** (portrait), letterboxed to the screen. Units are pixels and seconds. Gravity is 1800 px/s².
- **Verlet particles with position constraints**, written in-house. Rigid-body engines handle concave hand-drawn chains badly, so use no physics library.
- **Fixed step**: 60 Hz, 2 substeps, 10 constraint iterations per substep. Run shape matching every 3rd iteration.
- **Determinism**: seeded PRNG only; no `Math.random`, no wall-clock reads, no dependence on frame rate. Input strokes are timestamped in simulation time. Iterate in a stable order (arrays, never object-key order).
- Clamp particle speed to 3000 px/s, and check for NaN in debug builds.

## 3. From pointer to stroke

1. Capture with pointer events, using `getCoalescedEvents()` for density and `getPredictedEvents()` for drawing latency only (never store predicted points). Read `pressure` where it is meaningful, as with a pencil.
2. Smooth with a 1€ filter tuned so fast flicks stay sharp and slow wobbles are calmed. Render the live stroke straight from the input on an overlay canvas. Perceived latency must be under one frame.
3. Keep the full-resolution points for rendering. Resample a copy at **10 px spacing** for physics.
4. **Snapping (finger slop)**: a stroke end within 28 px of another stroke welds to it, and a stroke end within max(22 px, 15% of the stroke's length) of its own start closes a loop.

### Classification

Run these on the full-resolution points. Tune them against finger-drawn samples.

| Mark | Detection |
|---|---|
| Loop | ends within the closing distance above and enclosed area > 600 px²; or a self-intersection enclosing > 600 px², split into loop plus tails |
| Zigzag | on the RDP-simplified stroke (ε ≈ 3 px): 4 or more consecutive vertices with turning angle > 70° and alternating sign, with segments between them under 45 px. The spring spans the first to the last of those vertices |
| Scribble | for each point, the path length inside a 30 px radius exceeds 4.5× the window diameter. Cluster dense points into regions with convex-hull area > 400 px²; each region becomes a lump |
| Line | everything else |

Unit-test the classifier against labelled fixtures, aiming for 95% agreement:

- **Until Gate 1**, use synthetic fixtures: procedurally generated strokes with hand-like noise, speed variation and sloppy closures.
- **At Gate 1**, the human draws about 40 real finger strokes on a phone through a dev capture page. Those become the main fixture set.

## 4. Building the body

- **Particles** about every 10 px with collision radius 5 px. Each creature is capped at 400 particles and the world at 900.
- **Constraints**:
  - Chain links: stiffness 1.
  - Bending (i to i+2): stiffness about 0.25.
  - Welds: wherever particles of different strokes come within 9 px (28 px at stroke ends).
  - Loop closure: the same as chain links.
- **Springs**: replace the zigzag span with one actuated distance constraint between its end particles (rest length = their distance), plus a few soft guide particles for drawing. The render keeps the drawn zigzag, stretched along the spring axis.
- **Lumps**: a ring of particles around the hull plus a centre particle, with mass × 5 per unit of ink. Render the original scribble skinned to the lump frame.
- **Skinning**: every full-resolution drawn point is skinned to its 1–2 nearest particles in the same piece, so the creature always looks exactly like the drawing, deformed.
- **Birth**: if any particle starts inside terrain, lift the whole creature until none is. Zero all velocities after that correction; without this, a creature drawn touching a slope pops into the sky.

## 5. Holding a shape

- **Shape matching**: each creature is pulled toward its drawn rest pose, using the 2D best-fit rotation (polar decomposition of the covariance, which is `atan2` in 2D). Starting stiffness 0.12.
- **Per-particle weights**: the core is 1.0; along each limb the weight falls toward the tip (hands 0.15 at the tip, feet 0.4). While a limb is being actively driven, its particles drop to 0.05, so arms can actually reach.
- **Balance (the upright cheat)**: blend the best-fit rotation toward the rest rotation by the `balance` factor: 0.85 with two or more feet, 0.5 with one foot, 0.25 with none. Tall, top-heavy bodies still visibly wobble.
- **Springs are excluded from shape matching.**

## 6. Actuators (all intent goes through these)

`servo(particle, desiredVelocity, gain)`: replace the particle's implied velocity v with v + (desired − v) · gain by rewriting its previous position. This is the only way brains move ink.

- **Reach envelope**: a hand's target is clamped to a circle around the limb's root (its first welded particle), with radius 1.05 × limb length. **Spike lesson:** unclamped or positional pulls act as skyhooks and launch the whole creature off the page.
- **Reach**: servo the tip and the 3 particles behind it (shares 1, 0.7, 0.45, 0.25) toward the clamped target. Speed is about 900 px/s scaled by strength, with gain 0.25.
- **Grab**: a tip within (target radius + 12 px) of a grabbable it wants creates a temporary constraint. Grabbables are bombs, balls, cargo, Little Guy, small enemies, and opponent ink in Sumo.
- **Throw**: wind up for 0.1 s (move the tip back), swing toward a point inside the envelope that is up and away from Little Guy, then release after about 0.3 s or when tip speed passes a threshold. Release speed scales with strength.
- **Punch** (spring arm): compress the spring to 0.45 × rest for 0.15 s, release to 1.35 × rest for 0.1 s with high stiffness, then return. Cooldown 0.8 s.
- **Jump** (spring leg): the same compress-and-release, triggered by the brain (section 8 of `design.md`).
- **Locomotion** has three parts:
  1. **Body servo**, only while the creature touches ground: every particle is servoed horizontally toward the desired speed with a small gain (about 0.06 per substep, scaled by strength over mass). Desired speed comes from anatomy: legs give 0.8–2.4 × base, and footless bodies get 0.3 × base.
  2. **Foot planting**: a stance foot is pinned in place (very high friction) while the body passes over it.
  3. **Stepping**: a swing foot arcs to a new foothold one stride ahead (stride ∝ leg length, cadence ∝ 1/√leg length), with feet alternating in two groups.

  **Spike lesson:** without planting and stepping the servo works but reads as gliding. Footless bodies get a visible travelling wriggle along their length while they creep.
- **Brace**: hands servo toward the pushing surface, and feet get friction × 3 and stay planted.
- **Strain** is measured as constraint stretch on driven limbs and fed to the face (sweat, red tint).

## 7. Collisions

- **Terrain**: static polygons. A particle that penetrates a polygon is pushed out along the surface normal. Friction is tangential, with a per-surface coefficient.
- **Dynamic bodies**: bombs, boulders, balls, enemies, cargo and the Big Eraser are circles or capsules with mass. They collide with particles both ways, weighted by mass. Each has a **restitution** set per body type; bombs are low-bounce. **Spike lesson:** bouncy bombs ricochet off any passive shape, which hands the level to the roof.
- **Creature against creature**: particle-particle collisions through a spatial hash (40 px cells). A creature never collides with itself.
- **Little Guy**: a 6-particle mini-ragdoll that collides with everything.

## 8. Water and wind

- **Water** is a rectangle region with a surface that can rise and an optional current. A submerged particle gets buoyancy plus drag; loops add buoyancy proportional to enclosed area, and lumps get negative buoyancy. Moving limbs inside water produce thrust opposite to their motion, which is paddling.
- **Wind** applies a force in a region, proportional to each particle's exposed area. A simple model is enough: every particle gets the same force, and lumps resist through mass.

## 9. Tearing and severing

- A chain link tears when stretched past 2.3 × its rest length. A weld tears past rest + 24 px. Hazards cut links directly.
- After any tear, recompute connected components. A piece of 60 px or more with no eyes is re-read as a new creature (see `design.md` section 7); smaller pieces become dust.
- **Normal acting must never tear.** Test: 100 random creatures acting for 10 s with no hazards produce zero tears.

## 10. Hazard physics notes

- **Crushers** are motors with limited force, not kinematic walls, so a body that pushes back can genuinely hold them. Rigid ink does not: a wall stalls on any strut (a box, a flat worm) and recoils by mass share, so a pair of walls cannot crush a strut. Levels use one heavy wall (mass 1600) that shoves whatever lies between it and Little Guy against him; a wall face within `GUY.crushReach` of him kills.
- **Boulders** are heavy circles; their speed on contact decides whether they crush.
- **Bombs**: fuse timer, low restitution, grabbable. On explosion: an outward impulse that falls off over 170 px, a 140 px lethal radius for Little Guy, and links cut within 55 px.
- **Enemies** (ninja, bully, sumo): capsule bodies with scripted motion (telegraph → act) and knockback; dizzy for 1 s after a hard hit. The ninja is grabbable, dashes at Little Guy after landing, and cuts every link he touches while attacking (his blade reaches 10 px past his body).
- **Scissors** follow a path and cut every link they cross. **Fire** spreads along links from contact at a fixed px/s, burning them. **Smudgers** delete particles they touch at a rate.
- **Cracked floors** break above an impulse threshold. **Rope bridges** break above a load threshold. **See-saws** are a hinged plank body.

## 11. What the spike taught (reference/spike)

The spike built creatures from six canonical drawings and ran them through a bombs level and a walk-to-flag test. The anatomy read was correct for all six: stick figure 2 hands 2 feet; spider 6 feet; worm; box; roof arc headless with 2 feet; giant.

- **Passive shapes are strong.** A roof arc and a spider survived a bombs level twice, because bombs bounced off them and away. "Everything is alive" doesn't defeat the boring answer on its own; level design and the boring-baseline tests do (`levels.md`).
- **Positional intent explodes.** Moving tips directly toward targets dragged whole creatures off the page and tore welds. The cure is compliant servos clamped to the reach envelope (section 6).
- **Different bodies produced different, funny outcomes in the same level**: a giant caught both bombs on its shoulders, a worm flicked bombs away with its tail end, a stick figure caught and threw one. Protect this property; it is the game.
- **Servo locomotion moves every body type** at plausible relative speeds (legged ones fast, box and worm slow), but it reads as gliding until feet plant and step.
- **Welds near shoulders tore under reach load** before tuning. Weld strength must be tuned so tearing only happens through hazards.

## 12. Starting values (put them all in `src/tuning.ts`; game-rule timings such as drying and draw speed live in `design.md` and `levels.md`)

| Name | Start | Notes |
|---|---|---|
| gravity | 1800 px/s² | |
| spacing / radius | 10 / 5 px | |
| substeps / iterations | 2 / 10 | |
| shapeK | 0.12 | every 3rd iteration |
| balance (2+ feet / 1 / 0) | 0.85 / 0.5 / 0.25 | |
| bendK | 0.25 | |
| reachSpeed / reachGain | 900 px/s / 0.25 | |
| locoGain | 0.06 per substep | scaled by strength over mass |
| speedBase | 150 px/s | × anatomy factor |
| strength | (ink / 400)^0.6 | square-cube feel |
| ground friction | 0.35 | stance feet ~0.9 |
| tear: link / weld | 2.3 × rest / rest + 24 px | |

## 13. Simulation checks (part of `npm run verify`)

- **Determinism**: the same input gives the same final-state hash across 3 runs, and across a Node run versus a browser run.
- **No-noise tearing**: 100 random creatures acting for 10 s with no hazards produce zero tears.
- **Monkey**: 300 random scribble sets across all levels produce no NaN, no crash, and no particle above 3000 px/s.
- **Distinct bodies**: on the metrics course, the six canonical bodies (stick figure, spider, worm, box, giant, spring-legged hopper) produce clearly different walking speed, reach height and jump height, each pair differing by at least 20%.
- **Performance**: the average simulation step stays under 4 ms in Node at 900 particles. In the browser, 60 fps on a mid-range phone with the profiler showing simulation plus render under 10 ms.
