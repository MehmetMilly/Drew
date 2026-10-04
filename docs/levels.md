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

- **Reference solutions**: at least 3, each a different hero kind (`design.md` section 6), and every one must WIN. The kind checked is the one each reference is actually **born as** (a long-armed label on a drawing that reads Biped does not count). They prove the three badge slots are reachable. Author them by solving the level in the dev build with the capture tool.
- **Robustness**: each reference solution, run 20 times with seeded jitter (position ±20 px, scale ±10%, rotation ±5°), wins at least 80% of the time. Knife-edge levels feel like luck.
- **Boring baselines**: eight lazy drawings, auto-placed near Little Guy (toward the first threat):
  - **line**: a 200 px straight line held beside him
  - **box**: a 120 px box beside him
  - **roof**: an arc spanning him
  - **blob**: a scribbled blob beside him
  - **scrawl**: a 160 px line gone over 8 times (a thick lump) lying on the ground in front of him
  - **scrawlWall**: the same scrawl stood up as a 170 px wall between him and the threat
  - **pillar**: a 240 px vertical line between him and the threat
  - **cage**: a 110 px box drawn around him

  Each baseline is played as drawn plus 4 jittered placements, and counts as a win when it wins at least 2 of those 5 runs. On levels flagged `anatomyMatters` (every story level except 1-1), **at most one baseline may win, and never the roof, the scrawl or the scrawl wall**. Thickness and mass are not answers: if a baseline wins too often, redesign the threat so the level needs a verb (catch, throw, punch, brace, reach, carry, float, jump), not a shape.
- **Pacing**: the time from first touch to result for each reference solution falls in the level's window (3–12 s).

Print one table: level | references won | robustness % | baselines (each with its wins out of 5) | pass or fail.

**Common ways to deny passive answers**, learned from the spike:

- bombs that drop onto him: whatever only shields him keeps the bomb within its lethal radius
- threats arriving from two directions or at two heights
- a pusher heading into a corner or a drop: a passive lump only slows it, and slowing is not stopping (it grinds through stalled ink, or comes to rest against him)
- enemies that vault blockers and cut ink while attacking, so only catching, throwing or hitting them works
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
| 1-2 | Boulder | SAVE 6 | A heavy boulder (mass 900) rolls down a long gentle slope into the corner where he stands against a wall | lumps and lines only slow it: stalled ink is ground through, and a boulder resting against him for 0.5 s squashes him | many-legged, giant, heavy (brace it off up the slope) | 0.04 / 2500 |
| 1-3 | Walls | SAVE 5 | A saw-toothed wall drives in from the left (mass 1600, 170 px/s) along a ledge; he stands near the edge over a 200 px pit (no page floor) | whatever lies still between the wall and him is shoved over the edge with him or squeezed into him; a stalled wall saws through passive ink | many-legged, biped, heavy (brace it) | 0.05 / 2500 |
| 1-4 | Bombs in the Bowl | SAVE 6 | He sits in a dip; two low-bounce bombs drop almost onto him (staggered, 3 s fuses) | anything that only shields him keeps the bomb within its 140 px lethal radius | biped reacher, giant (catch and throw), many-legged | 0.05 / 2500 |
| 1-5 | Ninja | SAVE 5 | A ninja leaps from far left to mid-page, then dashes at the King on his throne, vaulting anything in the way and cutting the ink he touches | blockers get vaulted, thick scrawls get cut, boxes get run past; he stops only when caught and thrown, punched or knocked dizzy | long-armed (catch), springy (punch), biped | 0.06 / 2500 |

### Chapter 2, Boing: zigzag springs; HOME and SCORE begin (paper: graph paper)

| # | Name | Goal | Setup | Why the lazy answer fails | Intended bodies | Draw / Ink |
|---|---|---|---|---|---|---|
| 2-1 | Step Up | HOME | A 150 px ledge (higher than any walker steps and than a plain hopper's 113 px jump); the flag is on top, 180 px from its edge. Hint: *zigzags are springy* | nothing passive moves him: a pillar or a thick scrawl is carried to the wall and stops there | springy (a 1.1× hopper clears it), giant (carries him on its head, tosses him up), biped with hands (tosses him up) | 0.05 / 2500 |
| 2-2 | Mind the Gap | HOME | A 210 px pit, no page floor; the flag is 140 px past the far edge | worms and boxes fall in with him; nothing without a hand or a spring gets him across | springy (hops it), giant, biped with hands (toss him across) | 0.05 / 2500 |
| 2-3 | Help Them Score | SCORE 3 in 12 s | Three little players at the left edge hold balls; the hoop is high at the right (rim 720 px up, x 640) | nothing passive dunks; each ball has to be fetched, carried across the page and shot | giant, biped, long-armed | 0.05 / 2500 |
| 2-4 | Spike Floor | HOME | A 240 px spike floor between him and the flag | ground-walkers lose their feet on the teeth | springy (hops over), giant (carries him above them), biped with hands (tosses him over) | 0.06 / 3000 |
| 2-5 | Pinball Panic | SAVE 6 | Two bombs drop into the bowl beside him (as in 1-4) while rubber balls ricochet in from the left and from above | domes and cages stay inside the blast radius; balls flank a shield | biped reacher, giant, many-legged | 0.08 / 3000 |

### Chapter 3, Heavy Stuff: scribble lumps (paper: brown kraft)

| # | Name | Goal | Setup | Why the lazy answer fails | Intended bodies | Draw / Ink |
|---|---|---|---|---|---|---|
| 3-1 | Gust | HOME in 11 s | A giant fan blows against the path to the flag (the gale ends at x 540). Hint: *scribbles are heavy*. The 11 s storm clock stops a slow crawler | light bodies are blown back with him | big-fisted heavy, springy with a scribbled belly, tiny scribble ball | 0.05 / 3000 |
| 3-2 | Sumo Bully | SAVE 6 | A sumo shoves him toward a cliff edge | light shapes get shoved off together with him | heavy, braced giant, two heavies | 0.06 / 3000 |
| 3-3 | See-Saw | HOME | He sits on the high end of a long see-saw (it turns at most 4 rad/s, between 0.1 and 0.35 rad); the flag is on a 205 px ledge | nothing falls hard enough | heavy dropped on the far end, springy lump dropped from the top, giant that tosses him up the ledge | 0.04 / 3000 |
| 3-4 | Rope Bridge | HOME | The bridge snaps above a load threshold (whole creatures are weighed, and it lets go 0.35 s later). The far bank is a 100 px step up. The twist: heavy fails | lumps and giants break it | light springy, tall biped tossing him, long-armed | 0.05 / 2500 |
| 3-5 | Downstairs | HOME | The flag is two floors down, below cracked floors (a floor gives at 170k of whole-creature landing impulse) | nothing breaks floors | heavy dropped from high, tiny scribble ball dropped, springy with a scribbled belly | 0.05 / 3000 |

### Chapter 4, Wet Paper: loops float (paper: watercolour with blue washes)

| # | Name | Goal | Setup | Why the lazy answer fails | Intended bodies | Draw / Ink |
|---|---|---|---|---|---|---|
| 4-1 | Rising Tide | SAVE 8 | The room floods (90 px/s from 1.5 s, up to y 600). Hint: *loops float* | a small loop sinks with him on it (a 120 px box, a 110 px cage), and standing heights drown | floaty (two big loops), giant, a hoop-headed body 300 px across (born many-legged) | 0.05 / 3000 |
| 4-2 | Crossing | HOME | A 450 px river, 300 px deep, slow current, sheer banks; the flag is on the far bank | a pillar plus him is shorter than the water is deep; nothing small floats him | giant wading, tall biped (1100 px of ink: wades, then tosses him up the far bank), heavy (tosses him across) | 0.05 / 3000 |
| 4-3 | Bath Time | SCORE 3 in 15 s | Three rubber ducks on a pond to fetch into a bucket on the bank | nothing passive herds | floaty with hands (a stick with an air sac), long-armed, biped | 0.05 / 3000 |
| 4-4 | Waterfall | SAVE 8 | His raft (mass 1500) drifts toward a drop; the river is 290 px deep | a creature on the raft only rides it over the edge | giant wading beside it, tall biped on the bank, long-armed on the bank | 0.07 / 3000 |
| 4-5 | Kraken | SAVE 8 | Tentacles latch on and yank him toward the lake; what he merely sits on lets go of him | a lump or a roof under him is no anchor | springy (punches the tips away), giant, tall biped (hits them while wading) | 0.07 / 3500 |

### Chapter 5, The Eraser: ink damage and live grafting (paper: crumpled, smudged, eraser crumbs)

| # | Name | Goal | Setup | Why the lazy answer fails | Intended bodies | Draw / Ink |
|---|---|---|---|---|---|---|
| 5-1 | Snip Snip | SAVE 6 | Two pairs of scissors (from the right at 0.8 s, from the left at 1.8 s) each make three passes at him, cutting every link they cross, then fly off. A hand that closes on a pair stops it; a hard hit knocks it away. Hint: *draw more mid-fight* | single shapes are cut apart, and nothing passive stops the blades | long-armed (catches), springy (punches), giant | 0.06 / 3500 |
| 5-2 | Fuse | HOME | Fire runs along the floor behind him from 1 s at 70 px/s; the flag is on a 90 px ledge, 220 px past its face | a lazy carrier stalls at the ledge face and burns | biped runner, springy (hops the ledge), giant, heavy (tosses him up) | 0.08 / 3500 |
| 5-3 | Smudgers | SAVE 8 | Four smudgers crawl in from one side, 1 s apart, under ink, eating it, toward him at the page edge; stomp them | they pass under anything that doesn't step on them | heavy stompers, many-legged, biped | 0.08 / 4000 |
| 5-4 | Everything, Everywhere | HOME | Scissors drop on him at once; at 2.5 s his bank catches fire; a 250 px gap stands between him and the flag | a shield is cut, nothing lazy crosses the gap, and the fire catches whoever dawdles | springy with hands (catches, hops him over), long-armed, biped and heavy (toss him over) | 0.07 / 4500 |
| 5-5 | The Big Eraser | boss, 15-30 s (window 10-60) | Ink regenerates at 60 px/s; Little Guy keeps away from it. Phase 1: the Eraser slides at him and rubs out what it slides into; a bracer walks it back into the pencil sharpener at the page edge. Phase 2: sharpened smaller, it leaps at him; a hand that meets it mid-leap (a punch, or a hand held up in its path) lobs it back into the sharpener; twice. Phase 3: it crumbles into three dazed smudgers that a body heavy enough crushes by touching | a heavy lump can shove it in, but nothing without a hand can hit it mid-leap | heavy, springy, biped | 0.08 / regenerating |

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
- terrain polygons, and `floor: false` to drop the page floor (for pits that really drop to the kill line)
- entities (type and parameters)
- Little Guy spawn and variant (plain, crown, party hat)
- goal region
- `anatomyMatters`
- reference solutions (stroke lists with hero kind)
- notes

Levels are hot-reloadable in the dev build. A dev-only capture tool records drawings in-game and writes them out as reference solutions.
