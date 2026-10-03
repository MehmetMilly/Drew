# Drew: build plan

Written after reading `CLAUDE.md`, all of `docs/`, `reference/spike/` and the agent definitions. The docs are the source of truth; this file only says *where* code lives, *in what order* it gets built, and *what can go wrong*.

## 1. Stack

- Vite + TypeScript (strict), no framework. Canvas 2D for the world; DOM/CSS for menus and HUD.
- Vitest for unit tests. `tsx` runs Node tools (`verify`, `metrics`). Playwright (Chromium) for `shots`, browser perf and the browser half of the determinism check.
- Fonts self-hosted (Gochi Hand for display, Patrick Hand for small text, both OFL) under `public/fonts/`.
- No physics library (physics.md §2).

## 2. Module layout

```
src/
  tuning.ts                 every tuning number (physics.md §12, juice, timings)
  sim/                      PURE + deterministic: no DOM, no Math.random, no clock
    rng.ts                  seeded PRNG (mulberry32), hash helpers (FNV-1a over floats)
    geom.ts                 vectors, resample, RDP, polygon area, hull, segment intersect, point-in-poly
    classify.ts             four-mark classifier → stroke "parts" (line / loop / zigzag / scribble)
    particles.ts            SoA particle + constraint store (typed arrays, capacity 900)
    build.ts                strokes → particles, links, bends, welds, springs, lumps, skin data
    anatomy.ts              head, tips → hands/feet, limbs, stats, kind, name (names.ts)
    names.ts                ~80 first names + epithets
    shape.ts                shape matching with balance + spring-aware targets
    actuators.ts            servo, reach (envelope-clamped), grab, throw, punch, jump, brace
    locomotion.ts           body servo + foot planting + stepping + footless wriggle
    brain.ts                modes (brace / intercept / carry / guard / toy targets), eye targets
    collide.ts              terrain polygons, page bounds, spatial hash (40 px), dynamic circles
    world.ts                World: step loop (60 Hz, 2 substeps, 10 iters), events, tear + sever
    sever.ts                connected components after tears → new creatures / dust
    fluids.ts               water + wind regions (Phase 2)
    littleguy.ts            6-particle ragdoll + reactions (Phase 3)
    hazards/                boulder, bomb, crusher, ninja, … one file each (Phase 3+)
    level.ts                level runner: goals, countdown, win/fail, event log, money moments
    replay.ts               input log keyed by sim step; deterministic re-run
    hashstate.ts            final-state hash for determinism checks
  input/
    onefilter.ts            1€ filter
    pen.ts                  pointer capture (coalesced + predicted), pressure, live overlay feed
  render/
    paper.ts                procedural papers per chapter (offscreen, cached)
    graphite.ts             tapered, speed/pressure-width, grain-textured strokes, wet gloss
    felt.ts                 felt-tip terrain fills with wobble edge
    boil.ts                 precomputed 3-frame per-vertex jitter at 8 fps
    skin.ts                 full-res drawn points skinned to particles / spring axis / lump frame
    face.ts                 eyes, pupils, saccades, blink, brows, sweat, dizzy, happy, surprise
    nameplate.ts            slap-on label, follows, peels
    fx.ts                   shake (trauma), hit-stop, particles, onomatopoeia, dust, shadows
    debug.ts                anatomy colours, constraints + strain, brain mode/targets, step time
    renderer.ts             composes a frame from World + view state; interpolation
  audio/                    buses, synth pencil, doodle voice, sfx pools, music layers
  game/                     app state machine, toy page, level play, results, replay, save data
  ui/                       DOM shell: title, chapter spreads, cards, end card, pause, settings
  levels/                   one file per level (levels.md §8) + daily arenas + sumo opponents
  dev/                      capture page, shots harness page
tools/
  verify.ts                 prints the one table (levels.md §3 + physics.md §13)
  metrics.ts                writes LEVEL_METRICS.md
  shots.ts                  Playwright → review/*.png contact sheets ≤1600 px wide
  perf-browser.ts           throttled-CPU fps check
tests/                      vitest: classifier fixtures, geometry, anatomy, determinism, grafting…
```

## 3. Doc → phase map

| Doc section | Phase |
|---|---|
| design §1 north star | 3 (1-1, 1-2, 1-4 beats), checked again at 6 |
| design §2 core loop | Read/Draw/Birth: 1 (toy) · Action/Result/Retry: 3 |
| design §3 pen, ink, time (wet ink, joins, undo, ink budget, no-draw zones) | 1 (wet/join/birth/undo), 2 (grafting), 3 (budget, no-draw zones, slow time polish) |
| design §4 four marks | 1 (classifier, all four detected; loop head) · 2 (springs, lumps, buoyancy behaviour) |
| design §5 anatomy | 1 |
| design §6 kinds + names | 1 |
| design §7 severing + grafting | 2 |
| design §8 brain | 1 (toy targets) · 3 (full brain + intent lines) |
| design §9 faces | 1 |
| design §10 Little Guy | 3 |
| design §11 results + replay + clip | 3 |
| design §12 modes: Story 3–4, Sumo/Daily/Pad/Pencil Case 5 |
| design §13 progression | 3 (ch.1 save), 4 (unlocks/badges), 5 (pencils) |
| design §14 onboarding + hints | 3 (titles, hints), 4 (adaptive ghost hint) |
| design §15 settings/accessibility | 3 (settings sticky), 6 (Gentle, reduced motion, left hand, haptics) |
| design §16 save data | 3 |
| design §17 absent | all (guard rails) |
| physics §1–7, §9, §12 | 1 |
| physics §8 water + wind | 2 |
| physics §10 hazards | 3 (ch.1), 4 (rest) |
| physics §11 spike lessons | 1 (envelope clamp, low-bounce bombs, planting) |
| physics §13 sim checks | 1 (in `verify`) |
| levels §1 metrics | 2 |
| levels §2 greybox | 3–4 |
| levels §3 validation | 3 (verify table), 4 |
| levels §4–5 chapters | 3 (ch.1), 4 (ch.2–5, finale) |
| levels §6 Sumo ladder · §7 Daily arenas | 5 |
| levels §8 level format + capture tool | 3 (format), 1 (capture page for classifier fixtures), 3 (reference capture) |
| look §2 materials, §3 boil | 1 (cream paper, graphite, felt-tip, boil, contact shadows) · 4 (other papers) |
| look §4 characters | 1 (creatures) · 3 (Little Guy, enemies, telegraphs) |
| look §5 motion principles | 1 (anticipation, squash on eyes) · 3 |
| look §6 juice table | 3, re-tuned 6 |
| look §7 time slow | 1 (time ease) · 3 (cooling, audio filter) |
| look §8 interface | 3 (shell), 5 (mode screens) |
| look §9 rubric | every visual gate |
| look §10 generated images | 3/4 if Codex CLI exists (it does not on this machine → procedural fallbacks, logged) |
| audio §1–7 | 1 (placeholder pencil) · 3 (buses, voice, ch.1 sfx, music) · 6 (mix) |

## 4. Order of work

### Phase 1: The Toy
1. Repo, Vite, TS strict, Vitest, scripts, `tuning.ts`.
2. `geom` + `rng` with tests.
3. Classifier + synthetic fixture generator (hand-like noise, speed variation, sloppy closures) → ≥95%.
4. Particle store, build (links, bends, welds, loops, springs as actuated constraints, lumps as ring+centre), skin data.
5. World step: Verlet, constraints, shape matching with balance, terrain polygons, page bounds, inter-creature hash, speed clamp, NaN check, tear rules.
6. Anatomy + kinds + names, tests over canonical drawings (spike's six + hopper).
7. Actuators + locomotion (planting/stepping/wriggle) + toy brain (walk target + reach target from a tap).
8. Renderer: paper, graphite, wet gloss + drying sweep, boil, skinning, faces, nameplate, contact shadows, debug overlay.
9. Pen input with 1€ filter, coalesced/predicted events, live overlay canvas, time ease, wet → join → birth.
10. Placeholder pencil scratch (synth).
11. `verify` (classifier, determinism Node×3 + browser, no-noise tearing, monkey, distinct bodies, step time) and `shots`; browser perf under 4× CPU throttle.
12. Capture page (`/capture.html`) that POSTs to the dev server and writes `tests/fixtures/human/`.
13. Gate 1 automated → human gate.

### Phase 2: Grammar and metrics
Spring jump/punch tuning, lumps (mass, sink, anchor), loop buoyancy + air sacs, water/wind regions, tear → sever → new creature with eyes and nameplate (≥60 px), dust, grafting (touch a living creature → re-read anatomy, "grew an arm!" announcement), `npm run metrics` on the measurement course, frame strips per mark.

### Phase 3: Chapter 1 vertical slice
Little Guy ragdoll + reactions → level runner + goals + countdown → full brain + intent lines → hazards (boulder, crushers, bombs, ninja) → levels 1-1..1-5 greybox with references/baselines → verify green → dress → ink pencil + budget + no-draw zones → retry + ghost → win/fail beats, money moments, highlight, Watch, Save clip → juice table → DOM shell (title + self-drawing logo, chapter spread, cards, end card, pause, settings) → audio via `audio` subagent in parallel → Hall of Heroes + save data → PWA → critic → human gate.

### Phase 4: Chapters 2–5 + finale
I build every new hazard's physics first (fans, see-saw, bridge, cracked floor, water current, kraken, scissors, fire, smudgers, Big Eraser), then one `level-author` per chapter (max two at once), papers, adaptive ghost hints, badges + unlocks, credits from the Hall, qa-monkey, critic, my own play-through with times.

### Phase 5: Modes
Sumo (ring, ladder of 12, pass-and-play), Daily (12 arenas × 10 modifiers, calendar, streaks), Doodle Pad, Pencil Case. Validation for opponents and every arena×modifier pair.

### Phase 6: Polish and ship
Juice pass, audio mix to targets, accessibility, real-phone perf, load budget + lazy chapters, critic-final, README, CREDITS.

## 5. Risks and early detection

| Risk | Detection | Mitigation |
|---|---|---|
| Normal acting tears creatures (spike: shoulder welds) | `verify` no-noise test from the first day the world steps | envelope-clamped servos, weld tuning, tear only via hazards |
| Positional intent acts as a skyhook | monkey check: max particle speed + "creature left the page" counter | velocity servos only, gain < 1, reach clamped |
| Locomotion reads as gliding | frame strips of walk cycles reviewed at Phase 1 | stance pinning + stepping + wriggle |
| Classifier confuses zigzag vs scribble on real fingers | fixture agreement per class printed in verify; human fixtures at Gate 1 | thresholds in `tuning.ts`, retune on human set |
| Spring compression fought by shape matching | jump-height metric = 0 in distinct-bodies check | spring-aware shape targets (distal rest offsets slide along spring axis) |
| Determinism drift Node vs browser | hash compare in verify (Node ×3 + headless Chromium) | Float64 typed arrays, stable iteration, no `Math.random`/clock in `src/sim` (lint grep in verify) |
| Performance at 900 particles | step-time column in verify; throttled browser fps script | SoA typed arrays, spatial hash, collision every iteration only for terrain |
| Slow-motion rendering looks choppy at 0.04× | watching frame strips of draw phase | render interpolation between sim steps |
| Passive shapes (roof, spider) win levels | baseline columns in verify per level | design threats that ask for verbs (levels.md §3) |
| Level authoring blocked by physics gaps | subagent reports "blockers" | I fix the sim, subagents only touch level files |
| Sound sourcing blocked | audio subagent report | synth fallback per audio.md §3 |
| No Codex CLI | `which codex` (absent now) | procedural textures for every material (logged in DECISIONS.md) |
| Phone feel differs from desktop | human gates 1 and 3 on real hardware | mobile-native skill checklist |
