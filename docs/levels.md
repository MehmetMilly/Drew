# Drew: levels

## 1. Metrics before geometry

Measure what creatures can do before placing a single platform. `npm run metrics` runs the canonical bodies through a measurement course and writes `LEVEL_METRICS.md`. The canonical bodies:

- stick figure: head, torso, 2 arms, 2 legs, at 400 / 700 / 1100 px of ink
- spider: 6 legs
- worm
- box
- giant
- spring-legged hopper
- long-armed reacher
- lump-fisted bruiser
- double-loop floater

For each body, measure:

- walking speed on flat ground and up a 20° slope
- maximum reach height and horizontal reach
- spring jump height and distance
- throw distance for a bomb
- maximum crusher force held for 4 s
- the wind force it can walk against
- buoyancy margin with Little Guy riding
- time to cross a 200 px gap, or the fact that it can't

**Every level dimension is chosen from this table**, for example a ledge at 1.3 × the hopper's jump height and above the tallest walker's step. When tuning changes a metric, regenerate the table and re-run `npm run verify`.

## 2. Greybox first

Build each level in flat greybox first: felt-tip black terrain, red hazards, yellow goals, no paper texture, no decoration. A level that isn't fun and readable in greybox won't be saved by art. Dress it only after it passes validation.

## 3. Validation (in `npm run verify`)

Every level ships with data-defined test drawings, stored as stroke point lists in the level file.

- **Reference solutions**: at least 3, each a different hero kind (`design.md` section 6), and every one must WIN. They prove the three badge slots are reachable. Author them by solving the level in the dev build with the capture tool.
- **Robustness**: each reference solution, run 20 times with seeded jitter (position ±20 px, scale ±10%, rotation ±5°), wins at least 80% of the time. Knife-edge levels feel like luck.
- **Boring baselines**: run four lazy drawings, auto-placed at sensible positions near Little Guy:
  - a 200 px straight line
  - a 120 px box
  - a roof arc spanning Little Guy
  - a scribbled blob

  On levels flagged `anatomyMatters`, which is every level from 1-3 on, **at most one baseline may win, and never the roof**. If a baseline wins too often, redesign the threat so the level needs a verb (remove, brace, reach, carry, float, jump), not a shape.
- **Pacing**: the time from first touch to result for each reference solution falls in the level's window (3–12 s).

Print one table: level | references won | robustness % | baselines (line/box/roof/blob) | pass or fail.

**Common ways to deny passive answers**, learned from the spike:

- bombs that stop where they land and roll into dips
- threats arriving from two directions or at two heights
- goals that need movement (HOME and SCORE)
- pushers strong enough to fold a thin arc
- leaping enemies that arc over low shapes
- water, which sinks anything without loops

## 4. Chapter rhythm

Each chapter has its own paper and introduces one idea, with its five levels following the same beats:

1. **Intro**: almost impossible to fail if you use the new idea.
2. **Expansion**: combine it with something known.
3. **Play**: low stakes, high silliness (a breather).
4. **Twist**: invert the idea, or punish its naive use.
5. **Climax**: the hardest test of the chapter.

## 5. The levels

Level parameters:

- **Goal**: HUG, SAVE n s, HOME, or SCORE n.
- **Draw**: the world time scale while ink is wet.
- **Ink**: the budget in px of stroke length.

Starting numbers; tune them from metrics.

### Chapter 1, It's Alive: lines, heads, size (paper: cream sketchbook)

| # | Name | Goal | Setup | Why the lazy answer fails | Intended bodies | Draw / Ink |
|---|---|---|---|---|---|---|
| 1-1 | Hello, Friend | HUG | Little Guy alone and sad. Hint: *Draw him a friend.* | n/a (anything wins) | anything | 0.04 / 3000 |
| 1-2 | Boulder | SAVE 5 | A boulder rolls down a long slope at him; he's backed against a wall | thin lines and arcs are crushed flat | braced biped, many-legged, giant | 0.04 / 2500 |
| 1-3 | Walls | SAVE 4 | Saw-toothed crushers close from both sides with limited force | straight lines buckle, arcs fold | wide biped with bracing arms, X-shaped bodies, many-legged lying sideways | 0.05 / 2500 |
| 1-4 | Bombs in the Bowl | SAVE 5 | He sits in a dip; two low-bounce bombs land on the slopes and roll in | shapes shield, bombs roll into the dip next to him | long-armed, giant (catch high), worm (flick) | 0.05 / 2500 |
| 1-5 | Ninja | SAVE 4 | A ninja leaps from far left in a high arc at the King on his throne | low shapes get jumped over | tall long-armed, giant, two creatures | 0.06 / 2500 |

### Chapter 2, Boing: zigzag springs; HOME and SCORE begin (paper: graph paper)

| # | Name | Goal | Setup | Why the lazy answer fails | Intended bodies | Draw / Ink |
|---|---|---|---|---|---|---|
| 2-1 | Step Up | HOME | A ledge 1.3 × the hopper's jump; flag on top. Hint: *zigzags are springy* | nothing passive moves him | springy, very long-legged giant, long-armed (lift) | 0.05 / 2500 |
| 2-2 | Mind the Gap | HOME | A pit as wide as 1.2 × a 700-ink stick figure's stride | worms and boxes fall in | springy, giant striding across, many-legged spanning | 0.05 / 2500 |
| 2-3 | Help Them Score | SCORE 2 in 12 s | Two little players hold balls under a high hoop | nothing passive dunks | springy, long-armed, giant | 0.05 / 2500 |
| 2-4 | Spike Floor | HOME | A spiked floor between him and the flag; spikes cut tips that land on them | ground-walkers lose their feet | springy (few contacts), giant with stilts (shrinking!), long-armed passing him over | 0.06 / 3000 |
| 2-5 | Pinball Panic | SAVE 6 | Rubber balls launched from both sides and above, ricocheting | shields get flanked; balls hit him from the side | spring-fisted, many-armed, two creatures | 0.08 / 3000 |

### Chapter 3, Heavy Stuff: scribble lumps (paper: brown kraft)

| # | Name | Goal | Setup | Why the lazy answer fails | Intended bodies | Draw / Ink |
|---|---|---|---|---|---|---|
| 3-1 | Gust | HOME | A giant fan blows against the path to the flag. Hint: *scribbles are heavy* | light bodies are blown back with him | heavy, low many-legged, heavy giant | 0.05 / 3000 |
| 3-2 | Sumo Bully | SAVE 6 | A sumo shoves him toward a cliff edge | light shapes get shoved off together with him | heavy, braced giant, two heavies | 0.06 / 3000 |
| 3-3 | See-Saw | HOME | He sits on one end of a see-saw; the flag is on a high ledge | nothing falls hard enough | heavy dropped from high, giant dropped, springy stomping | 0.04 / 3000 |
| 3-4 | Rope Bridge | HOME | The bridge snaps above a load threshold. The twist: heavy fails | lumps and giants break it | light springy, floaty, tiny carrying him | 0.05 / 2500 |
| 3-5 | Downstairs | HOME | The flag is two floors down, below cracked floors | nothing breaks floors | heavy riding down, heavy giant, heavy springy stomp | 0.05 / 3000 |

### Chapter 4, Wet Paper: loops float (paper: watercolour with blue washes)

| # | Name | Goal | Setup | Why the lazy answer fails | Intended bodies | Draw / Ink |
|---|---|---|---|---|---|---|
| 4-1 | Rising Tide | SAVE 8 | The room floods. Hint: *loops float* | no loops, so it sinks | floaty, many-looped giant, two floaters | 0.05 / 3000 |
| 4-2 | Crossing | HOME | A river with a slow current between the banks | sinks or drifts away | floaty paddler, long-legged floater, giant wading | 0.05 / 3000 |
| 4-3 | Bath Time | SCORE 3 in 15 s | Three rubber ducks to herd into a bucket | nothing passive herds | floaty, long-armed, many-legged swimmer | 0.05 / 3000 |
| 4-4 | Waterfall | SAVE 8 | His raft drifts toward a waterfall; hold it or haul it ashore | gets swept along | heavy anchor with a long arm, giant wading, two creatures (one anchors) | 0.07 / 3000 |
| 4-5 | Kraken | SAVE 8 | Tentacles grab him and pull toward the water; a tug of war | can't hold on | heavy many-armed, giant, floaty-heavy pair | 0.07 / 3500 |

### Chapter 5, The Eraser: ink damage and live grafting (paper: crumpled, smudged, eraser crumbs)

| # | Name | Goal | Setup | Why the lazy answer fails | Intended bodies | Draw / Ink |
|---|---|---|---|---|---|---|
| 5-1 | Snip Snip | SAVE 6 | Flying scissors cut through ink; severed pieces come alive. Hint: *draw more mid-fight* | single shapes are cut apart | many-limbed (redundancy), giant, live grafting | 0.06 / 3500 |
| 5-2 | Fuse | HOME | A burning corridor; fire climbs from the feet | slow walkers burn up | long-legged runner, springy, grafting legs on the run | 0.08 / 3500 |
| 5-3 | Smudgers | SAVE 8 | Little eraser critters crawl in and eat ink; stomp them | eaten | heavy stompers, many-legged, team | 0.08 / 4000 |
| 5-4 | Everything, Everywhere | HOME | A gap, then bombs, then water | each piece denies a different lazy answer | springy floaty, team, grafting | 0.07 / 4500 |
| 5-5 | The Big Eraser | boss, ~60 s | Ink regenerates at 60 px/s. Phase 1: the Eraser rubs out what it touches; shove it toward the pencil sharpener at the page edge. Phase 2: it hops; punch it mid-air. Phase 3: it splits into smudgers | n/a | everything the player has learned | 0.08 / regenerating |

**Finale**: the sharpener grinds the Eraser, shavings rain down, and Little Guy hugs every surviving creature. The credits are drawn with the player's own Hall of Heroes, waving.

## 6. Sumo ladder (12 pre-drawn opponents)

Each opponent is authored as stroke data and must be beatable by at least two different hero kinds (validated like a level).

| # | Name | Body | The counter |
|---|---|---|---|
| 1 | Pebble | tiny blob | anything bigger |
| 2 | Stilts | very long thin legs | go low, sweep the legs |
| 3 | Big Doris | heavy lump | leverage: long arms, springs from below |
| 4 | Octo | eight short legs, very stable | heavier, or throw it |
| 5 | Boing Boing | spring legs, hops constantly | catch it mid-air with long arms |
| 6 | The Wall | wide box | springs over and behind it |
| 7 | Slappy | two huge arms | reach under them, go heavy |
| 8 | Twins | two small creatures | a wide body, two of your own |
| 9 | Snek | a long worm | stomp it, pin it |
| 10 | Balloon | many loops, light | anything heavy |
| 11 | Grandmaster | balanced biped with a lump fist | everything you know |
| 12 | Champion | a giant with springs | timing and weight |

## 7. Daily arenas

Twelve compact arenas, each a single screen built for 5–10 s attempts, rotated by date: Ledge, Pit, Bombs, Crushers, Fan, Pool, Hoop, See-saw, Ninja, Spikes, Bridge, Smudgers. The modifiers are listed in `design.md` section 12. The arena and modifier for a date come from a hash of the date string.

## 8. Level data format

One file per level (TypeScript or JSON) holding:

- id, title, hint, paper
- goal and its parameters
- draw time scale, ink budget
- terrain polygons
- entities (type and parameters)
- Little Guy spawn and variant (plain, crown, party hat)
- goal region
- `anatomyMatters`
- reference solutions (stroke lists with hero kind)
- notes

Levels are hot-reloadable in the dev build. A dev-only capture tool records drawings in-game and writes them out as reference solutions.
