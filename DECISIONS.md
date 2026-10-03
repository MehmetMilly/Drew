# Decisions

Each entry: date, what changed, why.

## 2026-10-03

- **No Codex CLI on this machine** (`which codex` is empty). Every material uses the procedural fallback (look-and-feel §10). Logged so Phase 3/4 don't wait on it.
- **Fonts**: Gochi Hand (display) and Patrick Hand (small text), both SIL OFL, self-hosted from the fontsource packages in `public/fonts/`.
- **Reach envelope slack** (`ACT.reachSlack = 0.86`): physics.md §6 says clamp to 1.05 × limb length. Limb length is measured along the *drawn* (curved) chain, and a chain can't straighten past its own length, so a 1.05 target is unreachable and the servo keeps pulling: the spike's skyhook. The effective radius is 1.05 × 0.86 ≈ 0.9 × chain length. physics.md §6 is unchanged in spirit (clamped inside what the body can reach).
- **Limb servos are internal forces.** Every reach/step/lean servo applies an equal and opposite momentum change to the rest of the creature (`react` in actuators.ts). Without it, holding an arm up against gravity lifted the whole body (stick figures floated 300 px). Only the ground-contact body servo adds net momentum.
- **Shape matching is momentum-conserving.** Per-particle weights (soft tips, driven limbs) made the pull toward the rest pose a net force; a raised arm levitated its owner. The mass-weighted mean displacement is now subtracted. The balance (upright) cheat still adds torque, as designed.
- **Deterministic math** (`src/sim/fmath.ts`): Node 26's V8 and Chromium 153's V8 disagree in the last ulp of `Math.atan2`, which broke Node-vs-browser determinism. The sim uses its own atan2/sin/cos/exp/log/pow/hypot built from + − × ÷ and sqrt only. `verify` greps `src/sim` for `Math.random`/clock reads.
- **End welds are directional** (build.ts): physics.md §3 says an end within 18 px of another stroke welds. Two spider legs drawn close together welded at their feet, so the spider lost two legs. An end now welds within 18 px only when the other stroke lies *ahead* of the end (a sloppy join points at its target), or when the end sits inside the other stroke's loop (legs drawn from inside a body). Crossings within 9 px weld as before.
- **Short links tear by absolute stretch**: a stroke's final link can be 4 px long; 2.3 × 4 px tore under ordinary jostling. Links tear at max(2.3 × rest, rest + 13 px).
- **Spring release ramps over half the extend phase** (≈60 ms) instead of jumping to 1.45 × rest in one step, which yanked neighbouring links past their tear limit. Hopper still jumps ~210 px.
- **Scribble detection runs at two scales** (30 px window at 4.5×, plus a 15 px window at 3.6×) so a small scribbled fist reads as a lump; a dense region whose RDP outline is a regular zigzag that *advances* (≥0.5 of tooth length per tooth) stays a spring. Tuned on synthetic fixtures; retune on human fixtures at Gate 1.
- **Lump fists are tips**: a lump hanging off a single joint (a line ending in a scribbled fist) is a hand or foot whose tip is the lump centre.
- **Roof arch eyes**: design §5 says a loopless body puts eyes on its highest line end. If that end is a foot (an arch whose ends are both on the ground), the eyes go on the apex instead and both ends stay feet, matching design §1's "headless arch with two feet".
- **Eye size**: design §9 "6–22 px" read as eye *diameter* 10–22 px (radius 5–11), clamped from 0.3 × head radius.
- **Colour jobs in faces**: the surprise "!" over a creature is felt-tip black (red "!" is reserved for threats); sweat drops are white with a felt outline (not blue, which is for guides). The strain cheek tint stays faint red because design §9 asks for it.
- **Distinct-bodies check** (physics §13) is read as: every pair of the six canonical bodies differs by ≥20% in *at least one* of walk speed, reach height, jump height.
- **Browser perf check** runs headless Chromium with GPU rasterization (`--use-angle=metal --enable-gpu-rasterization`) under a 4× CPU throttle (DevTools "mid-tier mobile"). Phones raster canvas on the GPU; headless software raster is not representative and over-penalises fills.
- **Adaptive resolution** for the world layer only (2× → down to 1× in 0.25 steps when frame work averages >11 ms). The paper is a static backdrop canvas and the live ink overlay stays at full resolution, so drawing always looks crisp.
- **Slow-time "desaturation"** (superseded below) was a cool translucent wash plus the 6% vignette instead of a canvas `saturation` blend or CSS filter (both expensive on phones).
- **Toy floor** is a felt-tip band at y = 1190; tap = walk target + reach target for every creature (Phase 1 brief).
- **Sim iteration savings**: bend constraints and terrain collision run on alternate iterations (terrain always on the last); a per-substep pair list replaces the full grid sweep for creature–creature contact. 0.8 ms/step at 900 particles in Node.

## 2026-10-03 (toy feel pass)

- **Slow-time desaturation revised**: the translucent wash read as grey in the live strip. Now a CSS `saturate(0.8) brightness(0.97)` filter on the *static* paper canvas only (toggled via `body.slow`, 150 ms in / 200 ms out) plus the 6% vignette on the world. The paper never repaints, so the filter is a cheap compositor job; browser fps still 60 under 4× throttle. Supersedes the earlier "cool wash" entry.
- **Footless locomotion is an inchworm**: a travelling hump (height 0.1 × body size, 6–22 px; wavelength 0.7 × size) lifts part of the body and carries it forward with extra servo gain, while planted particles hold. Closed bodies (boxes) get no extra grip, so they shuffle. Worm 13 → 61 px/s, box 58 px/s; physics.md §locomotion already asks for a visible wriggle, so no doc change.
- **Many legs patter**: 4+ feet multiply cadence by 1.35; step lift raised to 0.75 × stride, capped at 0.5 × leg length (0.6 caused a rare tear in the no-noise check).
- **Point-head eyes scale with the body** (eye cluster radius 16–26 px from body size) instead of a fixed 13 px; worm eyes were unreadable at phone size.
- **Birth eye pop**: eyes open from a slit with a damped-spring overshoot over 0.45 s, then the design §9 double blink (moved to 0.55–0.85 s so it doesn't hide the pop). A synth whoosh + rising "bloop" and a 12 ms haptic accompany it. Placeholder sound until the audio pass.
- **Creature–creature contact resolves half the overlap per pass** (`CREATURE_COLLIDE.relax` 0.5). A giant's foot landing between two links of a worm could wedge them apart faster than the links pulled back, tearing during normal acting (physics.md §9 forbids that). Bodies still separate within the iterations.
- **Dev capture page** (`/capture.html`): 34 single-stroke prompts labelled with the expected mark kinds, plus 6 multi-stroke "sloppy join" drawings that should each become one creature. Saves through a dev-only Vite middleware to `tests/fixtures/human/`, with a download fallback. `npm run verify` scores both when present.
