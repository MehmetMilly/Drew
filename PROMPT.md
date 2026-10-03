You're building **Drew**, a polished browser game where everything the player draws comes alive. This repository contains its full design: `CLAUDE.md` (the core ideas, colour jobs and conventions) and `docs/` (design, physics, levels, look-and-feel, audio). There's also `reference/spike/`, a small prototype that validated the core simulation and exposed its failure modes.

Your job is to take Drew from an empty repository to a finished game that a player with a sharp eye for detail would call polished, funny and hard to put down. Taste matters as much as function here: when the docs leave a choice open, pick what makes the page feel more alive, more readable and more charming.

## How to work

- **Resume first.** If `PROGRESS.md` exists, you're continuing an earlier session: read it and `DECISIONS.md`, then pick up exactly where they leave off. Keep `PROGRESS.md` current after every meaningful step, so a fresh session could resume from it alone. It should record:
  - the current phase
  - what's done
  - what's next
  - open problems
  - the last `npm run verify` table
- **Run autonomously between human gates.** Don't stop to ask me questions. When something is ambiguous, choose what best serves the design, log it in `DECISIONS.md`, and keep going.
- **Use git.** Run `git init` at the start. Commit after each working step, and tag every gate (`gate-1`, `gate-2`, …), so any regression can be bisected or rolled back.
- **Read first.** Before writing code, read `CLAUDE.md`, every file in `docs/`, and the spike source. Then write `PLAN.md`:
  - your module layout
  - the order of work inside each phase below
  - the risks you see, each with how you'll detect it early

  The plan is done when every section of every doc maps to a phase.
- **Work in the phases below, in order.** Each phase ends on a gate with checkable criteria. A gate passes only when every criterion is demonstrably met: tests green, `npm run verify` table pasted into `PROGRESS.md`, and screenshots or frame strips reviewed.
- **Two gates are human gates.** At those, stop, tell me exactly how to open the build on my phone and desktop, list what to try, and wait for my notes before continuing.
- **Trust play over paper.** When playing the build shows a doc is wrong, change the doc (it's the single source of truth), log the change in `DECISIONS.md`, and keep going.
- **Look at your own work.** Use `npm run shots` (Playwright screenshots and frame strips) and actually examine the images. Judge visuals against the rubric in `docs/look-and-feel.md` §9. A feature you haven't watched running isn't done.
- **Spend tokens where they buy quality.**
  - Review images as contact sheets at most 1600 px wide, not one screenshot at a time.
  - Have scripts print summaries and tables, not full logs.
  - When a phase needs a doc, re-read only the relevant section.
- **Use the project skills in `.claude/skills/`:**
  - `mobile-native` for touch, viewport, safe areas and PWA work
  - `animate` for any UI motion
  - `diagnosing-bugs` for a hard physics or determinism bug that resists two straightforward fixes
- **Download audio directly from the web**, following the licence rules in `docs/audio.md` §6.
- **Generate images with the Codex CLI** if it's installed and signed in, but only for the static materials listed in `docs/look-and-feel.md` §10. Start in Phase 3 with the Chapter 1 paper, the desk and the UI material textures, and add the remaining papers in Phase 4. If the Codex CLI isn't available, use the procedural fallbacks and carry on.

## Subagents

You own the architecture, the simulation, the creature brain and the renderer core yourself; they need one coherent mind. Delegate only bounded, verifiable work to the subagents defined in `.claude/agents/`. Their model and effort level are set there.

| Subagent | Model and effort | When to use it |
|---|---|---|
| `level-author` | Sonnet, high | one per chapter, from Phase 4 |
| `level-author-deep` | Opus, high | a chapter still red after two `level-author` rounds, and the Big Eraser boss |
| `audio` | Sonnet, high | from Phase 3 |
| `qa-monkey` | Sonnet, medium | after each chapter or mode lands, from Phase 4 |
| `critic` | Opus, medium | the end of Phases 3, 4 and 5 |
| `critic-final` | Opus, high | once, in Phase 6 |

Rules:

- If a job still fails after the deep variant, take it over yourself rather than raising effort further. You have the context they lack.
- Give each subagent only the files it needs.
- Run at most two subagents at once.
- Fix every critic row you agree with. For any row you reject, write the reason in `DECISIONS.md`.

## Phases and gates

### Phase 1: The Toy

Build only this: a blank paper page where you draw, the ink dries, and the creature is born.

**What to build:**

- Stroke capture with low latency and smoothing.
- The four-mark classifier, with fixtures.
- Body building and skinning.
- Shape holding, actuators and locomotion with foot planting, per `docs/physics.md`.
- Eyes and brows that act.
- The nameplate and kind detection.
- Line boil and the graphite and paper materials.
- A placeholder pencil scratch sound.
- A debug overlay (key `D` or a three-finger tap) showing:
  - anatomy colour-coded (hands, feet, springs, lumps)
  - constraints and strain
  - brain mode and targets
  - step time
- Tap anywhere on the page to set a walk target and a reach target for every creature.

**Gate 1, automated:**

- Classifier fixtures: ≥ 95% agreement.
- Determinism, no-noise tearing, monkey and distinct-bodies checks pass (`docs/physics.md` §13).
- 60 fps with 900 particles in the browser on a throttled mid-range CPU profile.

**Gate 1, human:** stop here and ask me to play the toy on my phone. First, give me a dev-only capture page that prompts me to draw about 40 labelled strokes (loops, zigzags, scribbles, lines, sloppy joins) and saves them as classifier fixtures; that takes me about three minutes. Re-run the classifier tests on my real finger strokes. Then give me this checklist:

1. Do five very different drawings move and act in clearly different, characterful ways?
2. Do the eyes make intent readable before the body moves?
3. Does birth feel like a small magic trick every time?
4. Does drawing feel smooth and immediate under a finger?

Continue only after my notes are addressed.

### Phase 2: Grammar and metrics

**What to build:**

- Loops (head and buoyancy), springs (jump and punch), lumps (mass), severing (pieces grow eyes) and grafting.
- Water and wind regions.
- `npm run metrics` writing `LEVEL_METRICS.md`.

**Gate 2:**

- Every canonical body in `docs/levels.md` §1 is measured.
- A severed limb of 60 px or more always becomes its own creature with a nameplate.
- Grafting re-reads anatomy correctly, covered by tests.
- Frame strips of each mark in action are reviewed.

### Phase 3: Chapter 1 vertical slice at final quality

This phase sets the quality bar for everything after it.

**What to build:**

- Little Guy (ragdoll, reactions, variants).
- The full creature brain (`docs/design.md` §8) and intent lines.
- The Chapter 1 hazards.
- Levels 1-1 to 1-5 with reference solutions and boring baselines.
- Time slow while drawing.
- The ink pencil.
- Retry with the blue ghost of the last attempt.
- Win and fail beats, money-moment selection, the highlight, the full Watch replay and Save clip.
- The juice table (`docs/look-and-feel.md` §6).
- The DOM UI shell: title with the self-drawing logo, Chapter 1 select spread, level cards, end card, pause, settings.
- Audio: buses, the doodle voice, Chapter 1 sound effects, and the adaptive music with slow-time filtering.
- The Hall of Heroes (gallery plus a living page) and save data.
- PWA install and offline support.

**Gate 3, automated and critic:**

- Chapter 1 rows in `npm run verify` are all green: references win, robustness ≥ 80%, baselines behave.
- The critic's table is resolved.
- Every screen passes the rubric.
- A fresh profile can play 1-1 to 1-5 start to finish with no console errors.

**Gate 3, human:** stop again, give me the build and a checklist covering:

- the first ten minutes as described in `docs/design.md` §1
- the roof test on 1-4
- the replay and Save clip
- the Hall of Heroes
- sound on a phone speaker

Continue only after my notes are addressed.

### Phase 4: Chapters 2–5 and the finale

**What to build:**

- The remaining hazards, papers and levels through the level-author subagents.
- The Big Eraser boss and the credits drawn from the player's Hall.
- Adaptive ghost hints after three fails.
- Badges and chapter unlocks.

**Gate 4:**

- Every story level is green in `npm run verify`, with at least 3 reference kinds per level.
- QA monkey reports zero crashes and zero softlocks.
- The critic's table for the new chapters is resolved.
- You have played through all of Story yourself using the dev capture tool, and recorded the time per level in `PROGRESS.md`.

### Phase 5: Modes

**What to build:**

- **Sumo**: ladder of 12 validated opponents, plus pass-and-play with alternating first drawer.
- **Daily Doodle**: date-seeded arena plus modifier, stamp calendar, streaks.
- **Doodle Pad** sandbox.
- **Pencil Case** with cosmetic pencils unlocked by badges.

**Gate 5:**

- Each opponent and arena passes validation.
- Every Daily modifier is tested on every arena: any combination must be winnable by at least one reference.
- All modes are reachable from the title and persist correctly.

### Phase 6: Polish and ship

**What to do:**

- A juice pass on every event.
- An audio mix pass to the targets in `docs/audio.md` §7.
- Accessibility: Gentle mode, reduced motion, left-handed layout, haptics.
- A performance pass on a real phone profile.
- A cold-start load-time budget: under 3 s on 4G for first paint, under 2 MB before the title is interactive. Lazy-load later chapters.
- A final critic pass over every screen.

**Done means:**

- `npm run verify` is all green.
- Zero console errors across a full play-through.
- `CREDITS.md` is complete.
- `README.md` explains how to run, deploy (any static host) and add levels.
- I can install the game on my phone's home screen and play it offline.

## What success looks like

A new player understands "everything I draw comes alive" within ten seconds without reading anything, deliberately draws weird bodies by minute ten to see what they do, and laughs out loud the first time a severed leg grows eyes and keeps fighting. Every level rewards at least three genuinely different bodies, and the lazy answers mostly fail in funny ways. Every screen looks like a real sketchbook that someone loves.

Start by reading the docs and writing `PLAN.md`.
