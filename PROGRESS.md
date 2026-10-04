# Progress

## Current phase

**Phases 4 and 5, in parallel.**
- Chapters 1–3 are green and in the index.
- A level-author is tuning Chapter 4. A level-author-deep is tuning Chapter 5 and the Big Eraser.
- Meanwhile Phase 5 modes are being built.

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
- Phase 3:
  - Sim: Little Guy ragdoll and reactions; hazards (rolling boulder, heavy saw wall, bombs, a grabbable dashing ninja that cuts ink); the level runner (HUG/SAVE goals, countdown, deaths, event log); level brain plans (guard, intercept, brace, hug); grab and throw.
  - Levels: 1-1..1-5 tuned green by a level-author: 3 refs of different kinds each, ≥95% under jitter, lazy baselines fail.
  - Play page: ink pencil and budget, no-draw zones, ghost of the last attempt, adaptive hint ghost after 3 fails; win stamp, fail ✗ beat, one-tap retry.
  - Replays: deterministic re-simulation, money-moment scoring, a 0.3× highlight with zoom, Watch (drawing timelapse with a pencil, then the action, then the moment), Save clip (MediaRecorder).
  - Juice: trauma shake, hit-stop, onomatopoeia.
  - DOM shell: self-drawing logo whose D wakes up, chapter spread with badge slots, HUD, pause note, end card, settings, Sketchbook with the Hall of Heroes (blinking heroes; tap one to bring it back to life) and the blank page.
  - Audio, by the audio agent: buses with ducking and slow-time low-pass; doodle voices; every sim event voiced; loops for boulder, crusher and fuse; a procedural calm/action music placeholder; Kenney CC0 samples (CREDITS.md).
  - PWA: manifest, icons, offline service worker (checked offline), safe-area layout.
  - Critic pass done (DECISIONS.md).
- Gate 3 response: the lazy set gained scrawl, scrawl wall, pillar and cage, each run with jitter; hazards beat passive ink (the ninja cuts and vaults, boulders grind, walls saw); the win flow is now replay first, then the stamp and the end card.
- Phase 4 so far:
  - HOME goal: a flag, boarding, riding, lifting by hand, carry jumps, a hop down from a stalled carrier, and escort for creatures too tall to ride. All 14 canonical bodies get him home on flat ground.
  - SCORE goal: little players pass balls up to a creature's hands; it shoots or dunks through the hoop.
  - Spike floors, rubber balls, graph paper.
  - Chapter screen pages between chapters; thumbnails show every goal and hazard.
  - Fixed a brain bug where creatures on guard re-decided every frame.
- Perf: 60 fps at ~880 particles under 4× CPU throttle; 0.77 ms/step in Node.

## Next

1. Chapters 4 and 5 green and added to the index (agents running).
2. Sound for the new hazards and modes: scissors, fire, smudgers, the Eraser, sumo, a crowd for pass-and-play. Use the `audio` agent.
3. qa-monkey over every level and mode, then a critic pass (the Phase 4 end).
4. Dedicated compact Daily arenas to replace the borrowed story levels.
5. Phase 6: juice pass, audio mix, accessibility, real-phone perf, critic-final.

## Open problems

- **Camera scale (critic's top point)**: on a phone the action sits in the bottom quarter of the page and Little Guy is about 20 css px tall. Fixing it means framing or zoom, which affects every level. Asking at Gate 3.
- The giant's long limbs crinkle into zigzags under load; ninja slashes sever without the full severed-piece beat.
- 1-3 Walls has a narrow force window (a passive box loses only above ~1M force; the giant holds only below ~800k). Rigid ink can't be crushed by two walls (physics.md §10).
- The music is a procedural placeholder (no named stock track); the music/pencil balance hasn't been checked by ear.
- Not built yet: level-card thumbnails, doodled HUD icons, Little Guy on the title, left-handed layout, closest-call moment scoring.
- A stick figure can't raise its arms above its head (the head blocks the swing sector).

## Phase 4 and 5 additions (2026-10-03/04)

- **Chapter 3** green: see-saw redesign, sumo bully, rope bridge, cracked floors.
- **Chapter 5 engine:**
  - scissors, fire, smudgers, the Big Eraser with the sharpener
  - ink regeneration and the `boss` goal
  - crumpled paper
  - the credits screen, rolling over the waving Hall of Heroes
- **Sumo:**
  - creature teams and the ring goal; the opponent sleeps on the page until both sides wake
  - the ring shrinks at time-out
  - a 12-opponent ladder (verify rows: each opponent beaten by 2+ kinds)
  - pass-and-play, best of five
  - Little Guy referees in a gyōji cap
- **Daily Doodle:**
  - the date picks the arena and modifier, with 10 modifiers and per-arena bans
  - verify rows check every allowed pair is winnable
  - calendar stamps and a streak
- **Doodle Pad:** a hazard palette with water, wind and moon-gravity switches.
- **Pencil Case:** 7 pencils, unlocked by badges and the Sumo ladder.
- **Progression:** a chapter opens at 4 of 5 cleared, and the boss needs its whole chapter.
- **README.**

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
| level 1-1 Hello, Friend | refs 3/3, robust 100%, baselines line✓ box✓ roof✓ blob✓ | PASS |
| level 1-2 Boulder | refs 3/3, robust 100%, baselines line✗ box✓ roof✗ blob✓ | PASS |
| level 1-3 Walls | refs 3/3, robust 95%, baselines line✗ box✗ roof✗ blob✓ | PASS |
| level 1-4 Bombs in the Bowl | refs 3/3, robust 95%, baselines line✗ box✗ roof✗ blob✗ | PASS |
| level 1-5 Ninja | refs 3/3, robust 100%, baselines line✗ box✗ roof✗ blob✗ | PASS |
| step time @ 906 particles (Node) | 0.97 ms | PASS |
| determinism: browser vs Node | 57b147f3 vs 57b147f3 | PASS |
| browser fps @ 884 particles, 4× CPU throttle | 60.0 fps, p95 16.8 ms | PASS |

ALL GREEN (2026-10-03).
