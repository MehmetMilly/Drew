# Drew

A browser game where everything you draw comes alive. You draw a creature in a few seconds; when the ink dries it opens its eyes and tries, clumsily and heroically, to protect a tiny stick figure called **Little Guy**. Its body comes from your drawing's geometry. You never steer it.

## The ideas everything serves

- **Alive.** Every stroke becomes part of a creature with eyes and a will. There are no dead tools, walls or platforms the player can draw.
- **Body plan.** The game reads geometry only: line, loop, zigzag, scribble, plus where line ends sit. It never guesses what a drawing depicts. Different bodies must behave visibly differently.
- **Puppeted intent, simulated consequence.** Creature intent (walking, reaching, grabbing, throwing, jumping) is driven by compliant velocity servos, clamped to what the body can physically reach. Everything that follows from intent (weight, collisions, buckling, tearing, flying) is real physics. This split is what makes creatures look purposeful and still have outcomes that depend on the drawing.
- **Boring baseline.** A plain line, a box, a roof-shaped arc and a blob are the lazy answers. Every level is designed and automatically tested so the lazy answers usually fail and at least three different kinds of body succeed.
- **Money moment.** Every attempt contains one moment worth replaying: a catch, a buckle, a limb snapping off and growing eyes. The game finds it and shows it.
- **Toy first.** Drawing one creature on a blank page and watching it live has to be delightful before any level exists. When toy feel and content compete, the toy wins.

## Color jobs (one meaning per color, never reused)

| Color | Job |
|---|---|
| Graphite `#3A3A40` | ink the player drew: alive |
| Felt-tip black `#1B1B1F` | the world: terrain, props, Little Guy's outline |
| Danger red `#E23B2E` | threats, countdown numerals, the fail ✗ |
| Highlighter yellow `#F2C230` | what matters: Little Guy's scarf, goals, cargo |
| Non-photo blue `#7FB2E5` | guides: ghosts of the last attempt, intent lines, hints, debug |
| Stamp green `#2FA84F` | the success stamp only |

## Docs: read the matching one before working in its area

- `docs/design.md`: rules, drawing grammar, anatomy, creature brain, Little Guy, modes, progression, onboarding. Read before changing any game rule or behaviour.
- `docs/physics.md`: simulation spec, actuators, spike lessons and tuning targets. Read before touching `src/sim/` or tuning how creatures move.
- `docs/levels.md`: metrics, the chapter plan, every level, Sumo opponents, Daily modifiers, validation rules. Read before authoring or tuning a level.
- `docs/look-and-feel.md`: art direction, UI, motion, juice and the review rubric. Read before any rendering, UI or animation work, and for every visual review.
- `docs/audio.md`: buses, sound list, music, sourcing and licenses. Read before any audio work.
- `reference/spike/`: a throwaway prototype that validated the core. Learn from its numbers and failures; the architecture in `docs/` supersedes it.

## Project skills

- `mobile-native`: touch, viewport, safe areas, PWA.
- `animate`: any UI motion.
- `diagnosing-bugs`: hard simulation or determinism bugs.

Each fact lives in exactly one doc. When play reveals a doc is wrong, fix the doc and log the change in `DECISIONS.md` (date, what changed, why).

## Commands (keep this list current)

- `npm run dev`: dev server, reachable from a phone on the LAN
- `npm test`: unit tests
- `npm run verify`: headless level validation, determinism, monkey and performance checks; prints a table
- `npm run metrics`: regenerates `LEVEL_METRICS.md` from the simulation
- `npm run shots`: Playwright screenshots and frame strips into `review/`, for visual review

## Conventions

- TypeScript strict. Simulation code in `src/sim/` is pure and deterministic: fixed step, seeded RNG, no DOM, no `Math.random`, no wall-clock time.
- The world renders on a canvas; menus and HUD are DOM/CSS layered on top.
- Tuning numbers live in `src/tuning.ts`, never inline.
- Before calling any milestone done, run `npm run verify` and look at `npm run shots` output with your own eyes.
