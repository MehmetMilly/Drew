# Progress

## Current phase

**Phase 2 — Grammar and metrics (lean): done for what Chapter 1 needs.** `gate-1` tagged after two play-test rounds. Metrics course and grafting are in; water/wind move to just before Chapter 4 (DECISIONS.md). Next: Phase 3, the Chapter 1 vertical slice, greybox first so fun can be tested early.

## Done

- Repo, tooling: Vite + TS strict, Vitest, Playwright, `npm run dev/test/verify/shots`, `npm run shots:live` (real-pen strip).
- Stroke capture: pointer events with coalesced + predicted points, 1€ smoothing, pressure, low-latency desynchronized ink canvas; wet gloss and in-order drying.
- Four-mark classifier (line, loop, zigzag, scribble + lumps/fists) with synthetic fixtures (98.3%).
- Body building, skinning, anatomy read, kind detection, seeded names, nameplate slap/follow/peel.
- Verlet sim: shape matching, compliant velocity servos, foot planting and stepping, inchworm wriggle for footless bodies, reach with envelope clamp, spring punches and jumps, tearing and severing (pieces grow eyes).
- Faces: wobbly eyes, saccades, eye lead, blinks, brows by mode, birth eye pop.
- Graphite ribbons with grain and line boil, paper and desk materials, felt-tip floor, shadows.
- Slow time while drawing (eased scale, paper desaturation, vignette), placeholder pencil scratch and birth pop.
- Debug overlay (D / three-finger tap); undo (Z / two-finger tap); clear (R); tap = walk + reach target.
- Dev capture page `/capture.html` for ~40 labelled human strokes → `tests/fixtures/human/`.
- Gate 1 round 1 fixes: hop / scurry / walk / roll / inch gaits from the body plan; front + turnaround; eye lead 0.25 s with notice and hand wind-up; arms swing from the shoulder as one piece within a body-clear sector; weld aim rule (spider regression) with an anatomy verify row; pencil volume and stuck-scratch fix.
- Phase 2: `npm run metrics` → LEVEL_METRICS.md (walk, 20° slope, reach up/sideways, jump, 200 px gap); grafting with re-read and "X grew an arm!" plate (verify row; live check `tsx tools/graftshot.mts` → review/graft.png).
- Perf: 60 fps at ~880 particles under 4× CPU throttle; 0.77 ms/step in Node.

## Next

1. ~~Capture human strokes~~ done: 34/34 single strokes and 6/6 joins pass; Quick, Draw! corpus added.
2. ~~Gate 1~~ passed (two rounds).
3. Possible extra: per-kind birth gestures (springy bounces, roller rocks) if birth still feels samey.
4. ~~Phase 2 (lean)~~: metrics + grafting done.
5. Phase 3: Little Guy ragdoll → level runner + goals + countdown → brain targets + grab/throw → hazards (boulder, crushers, bombs, ninja) → levels 1-1..1-5 greybox with reference solutions and baselines → play-test.
6. Before Chapter 4: water + wind, buoyancy metrics. Deferred Phase 2 polish: spring punch tuning, frame strips per mark.

## Open problems

- A stick figure can't raise arms above its head (the head blocks the swing sector). Reads fine so far; revisit if levels need overhead reaches.
- Turnaround squashes the body for a frame or two mid-turn (dog's tail crumples briefly). Watch in play.
- Birth sound and pencil are synth placeholders until the Phase 3 audio pass.
- Contact sheets with per-row crops reuse the first row's scale (`src/dev/shots.ts`); keep crops per sheet.

## Last `npm run verify`

| check | result | pass |
|---|---|---|
| sim purity (no Math.random/clock) | clean | PASS |
| classifier: synthetic fixtures | 97.6% (410/420) | PASS |
| classifier: human fixtures | 100.0% (34/34) | PASS |
| human sloppy joins → one creature | 6/6 | PASS |
| classifier: Quick, Draw! strokes (1000) | line 100%, circle 98%, triangle 98%, square 99%, zigzag 90% | PASS |
| determinism: Node ×3 | 57b147f3 same | PASS |
| no-noise tearing (100 creatures × 10 s) | 0 tears in 0 creatures | PASS |
| monkey (300 scribble sets) | crash 0, NaN 0, vmax 3000 px/s, fell off 0 | PASS |
| anatomy: canonical bodies (kind, gait, feet, hands) | 12/12 | PASS |
| grafting: line onto a living box | 1 creature, "Keith grew an arm!" | PASS |
| distinct bodies (each pair ≥20% on a metric) | 15/15 pairs distinct | PASS |
| step time @ 906 particles (Node) | 0.85 ms | PASS |
| determinism: browser vs Node | 57b147f3 vs 57b147f3 | PASS |
| browser fps @ 884 particles, 4× CPU throttle | 60.0 fps, p95 16.7 ms | PASS |

Classifier speed: median 0.14 ms/stroke, max 2.75 ms (desktop Node).
