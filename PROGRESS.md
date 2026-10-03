# Progress

## Current phase

**Phase 1 — The Toy: waiting at the Gate 1 human gate.** All automated checks are green, including the tester's real strokes and a 1,000-stroke Quick, Draw! corpus. Waiting for the play-test notes on the four checklist questions before tagging `gate-1`.

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
- Perf: 60 fps at ~880 particles under 4× CPU throttle; 0.77 ms/step in Node.

## Next

1. ~~Capture human strokes~~ done: 34/34 single strokes and 6/6 joins pass; Quick, Draw! corpus added.
2. Waiting for the Gate 1 checklist notes (four questions), then address them and tag `gate-1`.
4. Phase 2: drawing grammar, metrics course, `tools/metrics.ts` (`npm run metrics`).

## Open problems

- Stick figure arms curl inward when the reach target is low or behind (visible in the live strip). Review after play-test.
- Worm eyes sit on whichever end is highest; a flat worm may crawl tail-first. Design-legal, but check if it reads as wrong.
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
| determinism: Node ×3 | 44a83fe8 same | PASS |
| no-noise tearing (100 creatures × 10 s) | 0 tears in 0 creatures | PASS |
| monkey (300 scribble sets) | crash 0, NaN 0, vmax 3000 px/s, fell off 0 | PASS |
| distinct bodies (each pair ≥20% on a metric) | 15/15 pairs distinct | PASS |
| step time @ 906 particles (Node) | 0.78 ms | PASS |
| determinism: browser vs Node | 44a83fe8 vs 44a83fe8 | PASS |
| browser fps @ 884 particles, 4× CPU throttle | 60.0 fps, p95 16.7 ms | PASS |

Classifier speed: median 0.14 ms/stroke, max 2.75 ms (desktop Node).
