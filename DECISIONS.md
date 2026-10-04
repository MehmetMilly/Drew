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
- **Capture page v2 (after Gate 1 feedback)**: auto-advance after 350 ms made redoing impossible, and showing the classifier's read after each stroke nudged the player to draw "for the machine". Now: Next confirms, drawing again replaces a single-stroke answer, Back/Undo stroke, progress kept in localStorage, plain-language hints with a small blue example per prompt, and the classifier's read appears only on the final screen. Sloppy-gap circles are now asked for "on purpose" so ordinary circles stay natural.
- **Rounded springs (from the first human fixtures)**: all 5 of the play-tester's zigzags were rounded wiggles, which the sharp-teeth rule missed (0/5). Added a second detector: cumulative heading on a smoothed copy, bends = heading swings ≥100° between inflections (60° hysteresis), ≥4 bends, ≤320 px ink per bend, forward progress ≥0.22, and tooth height / spacing ≥1.4. The last test keeps a deliberate hand wobble (measured 0.82) a line; the tester's springs measured 2.2–3.2. A straight end counts as an attached line only when it is ≥40 px and longer than 0.75 of a tooth's ink.
- **Overshoots hug the ring**: a loop's head/tail up to 25% of the ring's ink that stays within 30 px of the ring is part of the loop (welded flat), not a line limb. A tester's overlapping circle had grown two fake arms.
- **End snapping 18 → 28 px** (physics.md updated): the tester's intended joins left 11–19 px gaps (≈ 6–10 CSS px on a phone, well under a fingertip).
- **Human fixture relabel**: 3 "zigzag spring" strokes drawn with 100–200 px straight lead-ins are labelled line + zigzag (the geometric read); noted in the file.
- **Quick, Draw! regression corpus**: 34 strokes from one tester can't prove robustness, so 1,000 single-stroke drawings by strangers (200 each of line, circle, triangle, square, and zigzags with ≥4 alternating turns; seeded subset, CC BY 4.0, credited in CREDITS.md) are now a `npm run verify` row with per-class floors (line 98%, circle 97%, triangle 95%, square 97%, zigzag 88%). Zigzags with 2–3 turns are excluded: a Z or M is a bent line in our grammar. Found via a research pass on prior art (PaleoSketch, ShortStraw/IStraw, $-family); $-recognizers rejected as the main classifier (they label whole gestures, can't segment or count teeth).
- **Zigzag robustness from that corpus (79% → 90% on real ≥4-turn zigzags, no loss on other classes)**: rounded tooth tips that simplify into two close vertices are merged into one corner (<14 px apart); long sharp teeth need a 75° turn (was capped at 45 px segments); wave bends may be up to half the stroke's ink (was a fixed 320 px) and may curl into a small coil (swing ≤420°, a helix is springy); minimum bend swing 85°; forward progress ≥0.08 (dense shading is already caught as scribble first). A spring that covers ≥50% of a run now wins over loops found inside it (sloppy teeth cross each other).

## 2026-10-03 — Gate 1 notes: bodies that act differently

- **Gait from body plan** (design + physics updated): a spring leg → **hop**; 3+ feet → **scurry**; 1–2 feet → **walk**; no legs + a loop → **roll** (tumbles: spin about the centre, friction turns spin into travel; the upright pull is off while rolling); no legs, no loop → **inch**. Play-tester: "only the worm and the spring's bounce were distinct".
- **Front and back**: a body whose head sits clearly to one side of its centre has a front. It turns around (mirrors its pose over 0.32 s, walking slowly meanwhile) to face where it goes, and its eyes lean toward the heading. The mirror skips its thinnest middle in one step, holds shape softly while turning, and bodies with scribble lumps have no front: mirroring a stiff mass round tore it in the no-noise check.
- **Eyes show intent**: pupils lead the body by 0.25 s (was ~0.1 s, too short to read), widen when a new target is noticed, and hands wind up away from the target before reaching.
- **Arms swing from the shoulder as one piece**: the reach turns the limb's drawn pose about its root inside shape matching (and servos each point to it). Previously only the tip was pulled, so arms bent at a fake elbow ("only the tips point at the tap"). A limb stops short of whatever body lies within 45 px of its root (no arm through the head or chest), the bend links straddling the shoulder go slack while posed, arms wait during a turnaround, and a limb tied to the body anywhere but its root keeps the old tip-only reach (swinging it tore the tie).
- **Weld aim rule**: beyond 18 px, a stroke end snaps only when it aims at the other stroke (cos ≥ 0.9) or meets another stroke's end. 28 px snapping had welded spider feet to the neighbouring legs; a verify row now checks the anatomy of every canonical body.
- **Pencil**: volume 0.28 (was too loud), speed clamped and smoothed, and the scratch silences itself 60 ms after the pen stops feeding it (it could stick on, rising in pitch).
- **Not doing**: recognising what a drawing depicts (dog, car...). The design reads geometry only on purpose; variety comes from body plans, not labels.
- **Turnaround for all bodies, tried (Gate 1 round 2)**: making every body mirror round looked bad on symmetric bodies (spider, stick figure: a pointless squash to a sliver mid-turn, since the mirror changes nothing) and tangled small scribble masses, which then tore seconds later. Kept: lopsided bodies without lumps turn physically (now in 0.22 s); symmetric and lumpy bodies face with their eyes. A body that is turning, or settled from a turn within 0.6 s, cannot tear (turning is intent).

## 2026-10-03 — Phase 2, kept lean

- **Phase 2 order**: the measurement course and grafting come first. Water and wind (Chapter 4) and their metrics move to just before Chapter 4; throw distance and crusher force are measured once grab/throw and the crusher exist (Phase 3). Why: the tester's verdict at Gate 1 was that the toy is good and the game now has to prove it's fun, so the Chapter 1 slice should come as early as possible.
- **Metrics course** (`npm run metrics` → LEVEL_METRICS.md): walk on flat, mean speed up a 20° ramp, reach up, reach sideways, jump, and time to cross a 200 px gap between ledges (fell or stalled → "can't").
- **Grafting** (design §3): at birth, a new group whose particles come within 14 px of a living creature joins the one it touches most. The part's current shape is carried into the host's rest frame (inverse of the shape-matching transform), every touching particle is welded to its nearest host particle, the anatomy is re-read, and the nameplate slaps on again with the news ("Keith grew an arm!", leg, legs, spring, "got heavier", bubble). Contact is a direct scan, not the spatial grid, which isn't built before the first step.

## 2026-10-03 — Chapter 1 tuned green (levels 1-2 to 1-5)

- **Boulder (1-2)**: the boulder spawned at x=40 with radius 48 and was shoved 8 px/substep by the page-edge clamp the moment it woke (a hidden ~950 px/s launch that made it fly over everything); and body-terrain friction is a per-contact velocity damper that stopped a rolling boulder dead on any slope. Now it starts at x=60 on a smoother slope, `HAZ.boulderFriction` = 0, and it honestly rolls down in ~1 s. The Heavy ref also moved left (a jittered fist overlapped the wall and was lifted onto it at birth).
- **Walls (1-3) is one wall, not two**: rigid ink (a box, a worm lying flat, an arc) is a strut and a pair of walls can never crush a strut: stalled walls recoil by mass share, and a 120 px box sitting between them (or Little Guy inside it) held them forever, so every lazy shape won. Now one saw-toothed wall (mass 1600, force 1.2 M, 170 px/s) drives in from the left and Little Guy stands near the right page edge: whatever sits between the wall and him is shoved along into the edge and squeezed, and only bodies that can push the wall back (spider, long-armed biped, bruiser) hold it. Crush rule: a wall face within `GUY.crushReach` (50 px) of him kills (ink between has been squeezed out); the two-wall gap rule stays. Giant and thin stick figures do not hold this wall; the table's "wide biped / X-shaped / many-legged" bodies are replaced by what actually works (many-legged, long-armed biped, heavy).
- **Ninja (1-5)**: a single ballistic leap was inert after it landed or was deflected, so a box or an arc simply waited it out. The ninja now (a) is grabbable (hands can catch and throw him), (b) dashes along the ground at Little Guy after landing (`HAZ.ninjaRun`), (c) cuts every link within r+8 px while attacking (ink is not armour), (d) kills on a hard hit or on a blade held against him for 0.2 s, with a 10 px blade reach (a heap of ink resting 3 px away had been saving him), and (e) weighs 40 (was 8). Apex 300 → 220 so a long-armed reacher on the ground can actually catch the arc. Refs: reacher, giant (moved to x=300, left of the throne), stick figure.
- **1-4 (bombs)** needed no change; the 80% reading was a 5-run quick sample (full run 95%).

## 2026-10-03 — Phase 3, the Chapter 1 slice

- **Replays are re-simulation**: the play page records each birth as (world step, strokes) and a replay is a fresh world re-run with the same births. A unit test checks a re-run matches bit for bit. Catch-up runs in 5 ms slices per frame, hidden behind the stamp beat, so phones don't stall.
- **Money moment scoring**: piece 10, throw 8, graft 7, grab 6, boom 5, tear 4, ninja leap 3, hug/win/save 2, +2 if within 120 px of Little Guy (a near miss); ties go to the later event. The highlight shows ±0.6 s of sim time around it at 0.3× (4 s) with a 12 % zoom (none under reduced motion). The "closest call" and "big impulse near him" events in design §11 aren't scored yet: the sim emits no such events.
- **Win flow**: hit-stop → stamp → highlight (from 1.3 s) → end card. Tapping skips the highlight. Fail: ✗ beat, then a blue "▶ watch" button beside "tap to try again".
- **Save clip** records the Watch replay off the world canvas (paper drawn into it while recording, 1.4 s title card first), mp4 where supported, else webm. Hidden when MediaRecorder or captureStream is missing.
- **Shake moves the world canvas only**; the paper backdrop and the DOM layer stay put. Onomatopoeia: BOOM (bomb), SNIP (piece), FWOOSH (throw), at most one at a time, 400 ms.
- **Stamp check is drawn, not a glyph** (Gochi Hand has no ✓), and the stamp box fits its word.
- **Title follows look-and-feel §8**: Story, Sumo and Daily notes (the last two locked until Chapter 1 is cleared and built in Phase 5) plus a Sketchbook tab. The Sketchbook holds the Hall of Heroes and the blank page; the blank toy page is never locked (toy first). The Doodle Pad with hazards stays Phase 5.
- **Levels in a chapter unlock one by one** (dev builds open all). Design §13 only specifies chapter unlocks.
- **Hall** keeps 300 heroes with their epitaph; tapping one re-births its strokes on the blank page standing on the floor.
- **PWA**: a hand-written service worker (no plugin dependency). Install caches the page and everything it links (absolute, de-duplicated URLs; `addAll` rejects repeats). Hashed assets are cache-first, matched with `ignoreVary`: Vite's `Vary: Origin` otherwise misses CORS module requests. The page is network-first. The page layout now keeps clear of the safe-area insets.
- **Critic pass (Phase 3)**: fixed the Watch dead start (fast-forwards to 0.4 s before the first drawing), highlight zoom 12 % → 35 %, Hall heroes keep their name when re-born and get blinking eyes (the face position is saved with the hero), colour-job leaks (cleared tick in graphite, Little Guy's "!" in felt, the win heart in highlighter, no blue sticky notes), the end card on its own paper sheet, washi tape and padlocks on notes. **Kept on purpose**: the nameplate's red border. Look-and-feel §8 specifies it as a "hello my name is" sticker, the one sanctioned exception to "red = threats". **Left for Gate 3**: the critic's main point, that at phone size the action sits in the bottom quarter and Little Guy is ~20 css px tall. A camera or framing change touches every level's layout and the sim scale, so it's the tester's call. Also left: level-card thumbnails, doodled HUD icons and Little Guy on the title (Phase 6 polish), and the giant's crinkled long limbs.

## 2026-10-03: audio (Phase 3)

- docs/audio.md §5: the music is a procedural placeholder (picture-book C-major loop, calm and action layers on one clock, crossfaded). The doc names sources but no specific licence-clean tracks, so stock music stays a TODO (§5 note). The layer and mixer contract does not change when stock tracks arrive.
- docs/audio.md §3: win and fail stings are synthesised (the Kenney jingles cannot be auditioned here and the spec asks for kazoo and ukulele). Water, fire, scissors and eraser sounds have no sim events yet and are not built.
- docs/audio.md §6: Kenney Impact Sounds and Interface Sounds are shipped (CC0). Ogg is encoded with ffmpeg's native vorbis encoder, which is stereo only, so .ogg files are stereo and .mp3 files mono.

## 2026-10-03 — Chapter 1 reworked: threats beat passive ink, creatures win by acting

Gate 3 verdict: "the stupid solution is the one that usually wins". In 1-5 the tester went over one line until it was thick and the ninja could not get through. Principle now: **thickness and mass are not answers; a creature wins by acting** (catching, throwing, punching, bracing, intercepting).

- **Validator (levels.md §3)**: four new lazy baselines: scrawl (a line gone over 8 times, lying in front of him), scrawl wall (stood up between him and the threat), pillar (a tall line) and cage (a box around him). Every baseline runs as drawn plus 4 jitters and counts as a win at 2 of 5. With `anatomyMatters` (now 1-2 to 1-5) at most one may win, and never the roof, scrawl or scrawl wall. Reference kinds are checked as born, not as labelled: the old "long-armed" reacher is born a Biped, so 1-4 and 1-5 had only two real kinds. Two canonical bodies were added so they do: `longarm` (Long-Armed) and `puncher` (Springy, zigzag arms).
- **Ninja**: passes through ink while attacking and cuts any link passing within 8 px (segment distance, so a dense scrawl cannot hide between its points); vaults over whatever stops his dash and leaps up at a raised Little Guy; is stopped only by a catch (a reaching hand grabs before the blade cuts it), a throw (dizzy 1.2 s), or a strike faster than 220 px/s from a hand, lump fist or extending spring (knocked away, dizzy 1 s). 1-5's ninja now lands mid-page and dashes: a single leap onto the throne gave short bodies no chance.
- **Pushers**: a brace is a real force (`ACT.braceForce` × strength × feet), so planted feet hold and a lying lump does not. Ink a pusher shoves that stays deep inside Little Guy squeezes him (crushed). A stalled saw-toothed wall cuts through passive ink; a stalled boulder grinds through ink that is not bracing it; a boulder resting against him for 0.5 s squashes him (a lump that only slows it is not a save). The brain braces against boulders too, meeting them at most 220 px in front of him.
- **Spring arms punch, never grab**, aimed at where the target will be when the fist is fully out; punch cooldown 0.8 → 0.5 s; spring-armed creatures stand 0.8 arm-lengths off a threat. A thrown thing cannot be regrabbed for 0.5 s (the hand used to catch it straight back, so no throw ever left).
- **Sever bug**: severing ran before the hazards in each step, so blade, saw and blast cuts never split a creature apart. Now it runs after them.
- **Levels**: 1-2 is a boulder (mass 900) rolling down a long gentle slope into his corner, SAVE 6 (the steep slope launched it so fast that only a bruiser held). 1-3 is a ledge over a 200 px pit with no page floor (`floor: false`); a 120 px pit was bridged by a scrawl. 1-4 drops two bombs almost onto him, SAVE 6: before, both bombs stuck on the ramps (bomb friction) about 130 px from him against a 140 px lethal radius, so every result was knife-edge, and the second fuse ran out after the 5 s save. 1-5 SAVE 5 with longarm, puncher and stick figure refs.
- **Rejected: Coulomb ground friction.** Ground friction is a viscous damper (a share of tangential velocity per substep), so heavy lumps are glued in place: a 700-mass scrawl is an anchor. A Coulomb cap fixed that but changed the metrics a lot (hopper walk 158 → 114 px/s, and gap crossings that had worked read "can't"). Reverted; the threats above handle anchored lumps instead. LOCO and BODY are unchanged, and LEVEL_METRICS.md is unchanged.
- **Still weak**: in 1-4 a dome wider than the lethal radius (a 125–170 px roof arc, a 240 px box) still sends falling bombs rolling off far enough, though the roof partly wins by acting (it re-reads as a worm and flicks a bomb). In 1-5 a cage around him wins 2 of 5, because the ninja cuts it into pieces that grow eyes and fight back. Both are allowed by the rule (at most one lazy winner) and both are noted for the next tester pass.

## 2026-10-03 — Gate 3 (human play-test)

- **Verdict**: "cute", continue, but "the stupid solution is the one that usually wins" (a line scribbled over until thick stopped the ninja) and the win sequence dragged (stamp, then replay, then buttons). Full permission to rework.
- **Response**: the lazy set now includes a scrawl (a line gone over 8 times, lying and standing), a pillar and a cage, each run as drawn plus 4 jittered placements. 1-2..1-5 are `anatomyMatters`. Hazards beat passive ink: the ninja cuts through and vaults over still ink and is stopped only by a catch, a throw or a hard hit; boulders grind through ink that isn't bracing them; the wall cuts through what stalls it. Details are in the level-author entry. The win flow is now replay first, then the stamp slams with the end card.
- **Known weak**: 1-4 is still beaten by a big dome (bombs roll off it beyond the blast radius). It needs a new threat idea, revisited in Phase 4.
- Tagged `gate-3`.

## 2026-10-03 — Phase 4: HOME goal and carrying (design §8, §10)

- **HOME**: a flag (felt pole, yellow pennant, `LEVEL.flagH` 110). He wins when his centre is within `GUY.homeDist` of the flag and inside the pole's height. Carried too high above it, he is set down.
- **Boarding**: a creature on plan `carry` waits beside him on the flag side. He walks to it and hops on (top ≤ `climbMax`) or scrambles up (≤ `scrambleMax` 500). A tall creature whose hand can reach him lifts him instead. He rides on the highest body particle with a soft velocity servo, and rider and carrier don't collide.
- **Carrying**: the carrier aims to put *him* over the flag (`tx = flag + carrier − him`), with a tight arrival whatever its width. Spring legs jump at walls, ledges, gaps or a flag above.
- **Stalls**: a carrier stalled within `flagWalk` of the flag (a wall, the page edge) lets him hop down toward it, passing through the carrier for 0.5 s, and he walks the last steps.
- **Escort**: a creature too tall to ride with no hand that reaches him leads him home a step ahead. He walks between its legs, so escorts don't collide with him. Before this, the giant had him scrambling up 800 px.
- **Brain bug fixed**: the plan-change check compared `reach?.body ?? -2` with a stored `-1`, so a creature on guard re-decided every frame and `actAt` never arrived. With the fix, guard and carry act on time. 1-2's giant ref moved from x 300 to 400 because 300 now lands under the boulder's path (the other placements win 5/5).
- `LEVEL.cardDelay` is unused now that the end card follows the stamp.

## 2026-10-03 — Phase 4: Chapter 2 mechanics

- **SCORE** (`{type:'score', n, seconds, hoop}`): little players (felt, with a cap so they aren't mistaken for Little Guy) hold yellow balls. Arms can't reach that low, so a player *passes* its ball up over the nearest free hand of a creature that comes for it. The pass flies through that creature for 0.9 s, so it reaches the hands rather than the belly, and any part of an arm catches it. Holding the ball, the creature walks under the rim and shoots: the arc peaks `ACT.shotApex` over the rim, a ball already over the rim is dropped in, and a shot needing more than `shotMax` × its throw speed waits while it walks closer. A ball dropping down through the rim scores. Loose balls go back to their player. When time runs out it's a fail ("time"). Bodies without hands (hopper, worm, box) can't score: intended.
- **Spikes** (`{type:'spikes', x0, x1, y}`): every tie to a point on the teeth is cut (bends too) before the sever pass, so feet come off and shrink. Little Guy touching them dies ("spiked"). If his carrier comes apart, he rides whichever piece his perch is on.
- **Rubber balls** (`{type:'ball', …}`): bouncy grabbable threats (restitution 0.85). One hitting him above `GUY.ballKill` knocks him out. They leave after `HAZ.ballLife`.
- **Graph paper** for Chapter 2: a faint grey-green rule, never blue (blue is for guides).

## 2026-10-03: Chapter 2 tuned green (levels 2-1 to 2-5)

Every Chapter 2 row of `npm run verify` is green and Chapter 1 is unchanged. What the tuning found and changed:

- **Walkers cannot step up anything, hoppers can.** A walking body (even the giant) stalls at a 40 px ledge; only a spring leg clears it, and the jump scales with the drawing (the plain hopper jumps 113 px and cannot clear 150; drawn 1.1× it clears 190 and is 20 of 20 on 2-1). So "a ledge 1.3 × the hopper's jump" (levels.md) is solvable by a springy only if it is drawn a little large, which is the lesson of the level. Everything else needed a carry mechanic that did not exist yet.
- **Toss** (design §8, level.ts `tossPlan`/`tossGuy`): a creature with a hand (not a worm, not tiny) that has him aboard and meets a wall, pit or spike floor within `GUY.tossReach` (60 px) of its front foot launches him over it. The landing is the first solid, spike-free ground past the obstacle plus `tossLand`; the arc is chosen to clear the terrain and aimed by flying it with the world's drag (an analytic arc landed 10 % short and dropped him on the spikes). Range is `ACT.tossSpeed` × √strength (at most 1.4). He passes through the tosser and its pieces for `GUY.tossClear` (8 s; its arms lie across where he lands, and a giant that falls into the pit tears apart onto the far bank), and no hand picks him up again in that time. I first tried lifting him off the carrier's head with a hand and setting him down beyond the ledge; the arm cannot fold onto the head (the body-sector rule that stops arms through the chest), and a tall rider that simply hops off at a wall lets every pillar and thick scrawl win, so the hand-toss is the verb.
- **Giants carry him on their heads.** `routeBlocked` (read once per level: a step over `GUY.stepMax`, a pit or spikes between him and the flag) raises how tall a carrier he will scramble up from 500 to `GUY.scrambleFar` 1000 px. On flat levels the giant still escorts. The scramble is faster (300 px/s), is allowed 1.5× its time before the slip test (a swaying giant lost him at the top), and the carrier waits while he is still scrambling aboard (a giant had walked into the pit before he reached the top). Giants toss from the top.
- **Brain**: a carrier whose passenger is down and walking the last steps stands clear behind him (the hopper waited on the flag side and blocked him).
- **SCORE shots are drag-aware** (`aimShot` flies the arc): a drag-free arc lands about 60 px short, so the long-armed ref made one basket in 12 s. With it, scoring is reliable at any range, so pace comes from geometry.
- **2-1** ledge 150, flag 180 px past its edge. Refs: hopper ×1.1, giant, reacher. **2-2** pit 210 px; refs hopper, giant, reacher (the spider bridges the pit with its legs and stalls there; it has no hand to toss with). **2-3** is now SCORE 3: with two balls every ref finished in 2.5–3 s (window 3–12); three little players at the left edge, hoop at x 640, creatures born at x 330 (4–8 s). **2-4** spikes 370–610, flag at 678 (a giant born at x 300 stood on the spikes at birth); window 2.5–14 because the toss is quick. **2-5** is 1-4's bowl with bombs (fuse 3.5) plus three rubber balls with a 1.8 s life (`ball.life`, new entity field).
- **2-5 design**: rubber balls alone are blocked by any dome, box or cage, so every lazy shape won; the bombs' lethal radius is what denies a shield (a ricocheting ball that settles beside him in the bowl was knocked into him by the creature, so balls vanish after 1.8 s). Robustness here is chaotic: the bomb fuse alone moved the worst ref from 65 % to 90 % (3.2 and 3.5 are green, 3.1 and 3.3 are not). If this level goes red after a physics change, retune the fuse first.
- **Known weak**: a lying 200 px line (worm) wins 2 of 5 on 2-2 and a box wins 2 of 5 on 2-4 (one lazy winner is allowed, never the roof); on 2-2 the worm launches itself and Little Guy several hundred px when it is born over him (not investigated; creature physics). The hopper on 2-2 is 95 %. `tools/shotlist.ts` `ch2` now shows all three refs.

## 2026-10-03 — Phase 4: Chapter 3/4 engine

- **Props** (`src/sim/props.ts`, `LevelDef.props`):
  - **Wind:** a force per particle, so lumps resist through mass and Little Guy (mass 0.5 per particle) is blown hardest. Ink just upwind of him shelters him (×0.15), and riding he hunkers down (×0.35). Without shelter, no carrier could hold him in a breeze that heavy bodies could walk into.
  - **Cracked floors:** slabs of terrain that break above a landing impulse (Σ m·Δv).
  - **Rope bridges:** slabs that snap above a resting load, drawn as planks that sag with strain.
  - **See-saws:** a heavy rigid plank solved against particles in the constraint loop. A push turns it by its inverse inertia, so a heavy drop on one end flings the other.
  - Broken slabs leave felt chunks that tumble through everything.
- **Sumo bully** (hazard): a heavy round pusher with a limited-force motor, stamping for 1 s first. Bracers take their force off it, as with walls.
- **Water:** a surface that can rise, with a current.
  - Buoyancy is a force per particle: ink is 1550 against 1800 gravity, so it sinks slowly; loops add 7 × area / ring points; lumps sink through mass. Little Guy sinks.
  - Drag and current, and paddling: a creature at least 30% under that wants to go somewhere swims, faster with more limbs.
  - He drowns after 1 s with his head under.
- **Rescue from water:** in a level with water, the HOME carry brain runs with a "goal" at his starting x and far overhead (`carryGoal`). He boards whoever can carry him, and the carrier holds him there.
- **Papers:** kraft `#C9A97A` (the look-and-feel value) and cold-press watercolour. Water is a watercolour wash with pigment pooling along the surface edge. It is a paper material, not the non-photo-blue guide colour.
- **Chapter 4 pieces** (same day):
  - **Ducks:** cargo that floats, with no player. A duck scored into a bucket stays there, drawn peeking out. The bucket is a SCORE hoop with `bucket: true`, and its rim must sit above the ground.
  - **Rafts:** a heavy, level, free-floating plank. It floats, drifts with the current, stops against banks, and carries what stands on it (contact grip).
  - **Kraken tentacles:** scripted, non-colliding tips the brain sees as threats. A tentacle reaches for him, latches, and hauls him and whoever carries him toward its root. The haul is a limited force, less a grip per planted foot of the carrier. A hand, fist or spring hitting the tip faster than 200 px/s makes it let go and recoil for 1.4 s.
  - **Water rescue** (`carryGoal`) applies only to SAVE levels: in SCORE levels the creatures fetch ducks instead.
- **Chapter 5 damage** (2026-10-03, `src/sim/damage.ts`, defs ride in `LevelDef.props`):
  - **Scissors:** a kinematic, non-colliding body (`data.ghost`) that homes on him with a limited turn rate (1.6 rad/s), so a miss swings round wide. Every link within 4 px of the blades is cut; touching him kills him ('snipped'). A creature that grabs it stops it, and it becomes an ordinary thrown body.
  - **Fire:** a front running along the floor. Points on the burnt floor catch, fire climbs links at 90 px/s, and a point crumbles 1.2 s after catching. A flame touching him kills him ('burned').
  - **Smudgers:** crawl toward the nearest ink (or him) and eat one point every 0.12 s. They are squashed by ink landing on them faster than 160 px/s downward, or by a striker. Touching him for 0.5 s kills him ('erased').
  - **Big Eraser** (goal `boss`):
    - Phase 1: a box pusher with a limited-force motor that bracers resist, rubbing out 10 points/s of whatever touches it.
    - Shoved into the sharpener on its home edge, it comes out 20% smaller (phase 2) and hops at him; a hard hit mid-hop knocks it back.
    - Sharpened again, it crumbles into 4 smudgers (phase 3); squashing the last one wins.
  - **Ink regeneration:** `LevelDef.inkRegen` (px/s) refills the pen while the world runs (60 px/s in the boss fight).
- **Sumo** (2026-10-04, `src/sim/sumo.ts`, `src/levels/sumo.ts`):
  - Creatures carry a `team` (0 is the player's, 1 the opponent's). Pieces keep their team.
  - The opponent is pre-drawn stroke data on the goal. It sleeps on the page (graphite, snoring) and is born together with the player's first creature.
  - The brain aims beyond the nearest enemy, so it walks into it and leans; its hands go for the enemy's middle.
  - A side is off when its centre of mass drops 30 px below the ring top or leaves its edges. The ring shrinks 18 px/s per edge after 12 s.
  - The referee (Little Guy) stands on the floor beside the ring. The gyōji hat comes later.
  - First-pass ladder results with eight canonical heroes: Big Doris is beaten by nothing yet, and the Champion is beaten by almost everything. The ladder needs a tuning pass.
- **Daily Doodle** (2026-10-04, `src/levels/daily.ts`, `src/sim/daily.ts`):
  - The arena and modifier come from an FNV-1a hash of the local date string.
  - The first-pass arenas are the story levels that teach each hazard. Dedicated compact arenas can replace them later.
  - Modifiers that change bodies act inside the sim at birth (`LevelDef.mod`), so replays match:
    - Kind-only rules, No Heads (no loop head) and Exactly Two Friends puff rule-breaking births to dust.
    - Mirror adds the reflected strokes.
    - Heavy Ink makes every particle 5× its mass.
  - One Stroke and Blind Draw are input and render rules in the toy. Half Ink halves the budget.
  - A cleared day is `cleared['daily-YYYY-MM-DD']`. The calendar stamps those days, and the streak counts back from today.

- **Chapter 3 tuning** (2026-10-04, level-author; `src/levels/ch3.ts`, `src/sim/{level,props,hazards}.ts`, `src/tuning.ts`):
  - **3-1:** the gale ends at x 540 and the flag has an 11 s storm clock (`goal.seconds`, a timed HOME) so a slow heavy crawler cannot just wade through. `routeBlocked` treats a strong wind (`PROP.windBlock`) as a blocked route. Refs are a big-fisted bruiser, a hopper with a belly lump and a tiny scribble ball: a heavy giant cannot escort him through the gale (and stalls at the page edge). `riderWind` 0.35 to 0.2.
  - **3-2:** `sumoForce` 900k to 1.5M, `sumoBack` clamps a braced sumo's backward speed, and a sumo resting on or against him for `pinTime` now squashes him (like a boulder). Lazy shapes no longer win by friction or mass alone.
  - **3-3 redesign:** see-saw plank turns at most `seesawRate` (4 rad/s), so every hard hit flings the same; `lo`/`hi` stops (0.1 and 0.35 rad) replace the symmetric `tilt`, and `flip` rests it right end down. A 205 px ledge on the right; the baselines are drawn beside the see-saw (`baseline`), because shapes drawn on the ledge just lift him. The old setup (ledge 130 px from him) let every lazy shape win or launch him by chaos. The renderer draws the pivot block down to the floor.
  - **3-4:** the far bank is a 100 px step. Bridges weigh whole creatures (`P.owner`) and snap after `snapDelay` (0.35 s). `tossPlan` needs a creature particle on the ground, and a falling floor or bridge blocks carries for `lurch` (0.6 s, `noTossUntil`), so a lump or giant cannot toss him over a bridge it just broke.
  - **3-5:** floors are weighed as whole creatures, impulse 170k (blob peaks 143k, giant 197k, springy 280k, heavy 700k+). Giants hover and re-break floors unreliably, so the refs are heavy, tiny scribble ball and springy lump; window lower bound 0.5 s (a dropped heavy wins in 0.9 s).
  - **Known quirks left for the main agent:** a rolling scribble blob ignores wind (the one lazy winner of 3-1); a worm born overlapping him launches him; a hopper overshoots near the flag; giants carrying him into a wall of wind or terrain stall; 3-3 launch sideways speed depends on how he rests on the plank (robust 95% in the validator, but chaotic outside the refs).

- **Chapter 4 tuning** (2026-10-04, level-author; `src/levels/ch4.ts`, `src/sim/{level,props}.ts`, `src/tuning.ts`, `docs/levels.md` §5, `docs/physics.md` §8):
  - **A box floats, so loops had to float less.** With ink at 1550 against 1800 gravity and light loop particles (0.6), any closed shape floated him, so the lazy box and cage won 4-1. `WATER.buoy` 1550 to 300 and `loopBuoy` 7 to 2.5: a line now sinks like a stone and a ring point nets (buoy + loopBuoy × area / points) − 1080, so a loop needs about 310 area per ring point to lift itself. A 120 px box is neutral (it sinks with him on it); a hoop 300 px across lifts him easily. The refs are drawn big (snowman of two loops, a hoop-headed body). This also changes water in the Doodle Pad and 5-3, which still pass.
  - **Depth is the barrier.** A standing 240 px pillar waded any 135 px river with him on top, so 4-2, 4-4 and 4-5 are 290-330 px deep (the toss search only looks 320 px above the feet, so banks stay within that). Hand-tossers still cross the 450 px river (toss range is about 600 px), so 4-2's refs are a giant, a tall biped and a heavy, not floaters.
  - **4-2 has no floating ref (known weak).** A big hoop floats him across but stops a hoop radius short of the bank, further than his 100 px hop reaches, and a top-heavy snowman tips him off against it. A floater that could deliver him needs a gentle beach and a toss-free approach, which the toss rules (any slope over ~17 degrees counts as a wall and lands him in water) rule out.
  - **Water rescue stalls count progress from an anchor** (`GUY.stallProgress`, 3 px) when the level has water: a floating carrier pressed against a bank jittered a pixel a step, which reset the stall timer so he never hopped off. Dry levels keep the step-to-step rule (the anchor rule made pillars win 2-1).
  - **`routeBlocked` is true in rising-water SAVE levels**, so he scrambles up a giant (a tall rider was refused: `scrambleMax` 500).
  - **Rafts weigh 1500** (was 300): at 300 a roof standing on it walked against the current and held it still, so it won 4-4.
  - **Tentacles yank him, they do not drag his seat.** Whatever he only sits on lets go of him (`PROP.tentaclePull` 400000 on him alone); a carrier that holds him in a hand is dragged with him by `tentacleHold` 18000 less its grip. At the old single haul a heavy lump under him was an anchor and every scribble won. Tentacles start at 2.5 s and 4 s so a puncher has time to be in place (16 of 20 became 20 of 20).
  - **Known weak:** 4-5 cage wins 2-3 of 5 (the one allowed lazy winner). 4-4 and 4-2 refs are tall wading bodies, so Floaty is not a reference there (it is in 4-1 and 4-3). The brain walks a carrier toward a tentacle with him on its head ("intercept" runs away from the shore with him), so short carriers drown him in a deep lake; kept the 90 px lake in 4-5 for that reason.

- **Chapter 5 tuning** (2026-10-04, level-author escalation; `src/levels/ch5.ts`, `src/sim/damage.ts`, small edits in `src/sim/{brain,actuators}.ts`, `src/render/damage.ts`, `tools/levels.ts`, the DMG block of `src/tuning.ts`, `docs/levels.md` §5, `docs/physics.md` §10). This supersedes the numbers in the "Chapter 5 damage" entry above.
  - **Scissors make passes, then leave.** Homing scissors never gave up, so any creature was eventually snipped apart and the level became a coin toss. Now each pair telegraphs for 0.6 s, makes three passes at him (a pass ends 60 px past its closest approach) and flies off the page. A free hand whose last three points reach a pair grabs it before the blade cuts. A hand, fist or spring moving at it faster than 220 px/s knocks it away, stuns it for 0.8 s and costs it a pass.
  - **Smudgers are ghosts that go for him, and only feet or strikers squash them.** Before this, any lazy shape worked as bait (they went for the nearest ink), and ink collapsing onto them as it was eaten squashed them, so every lazy shape won 5-3. Now they target him and scuttle under ink. They are squashed by a foot of a creature of mass 40 or more that is coming down on them or planted over them, or by a striker. They crawl at 110 px/s (at 140 nothing could step on them), and a servo gain holds that speed against friction.
  - **Brain, stomp intent:** against a `stomp` threat, a creature without a spring arm walks onto it, but only within a body width of its guard post beside him (it used to leave him to chase one).
  - **Big Eraser, phase 1:** the brain treats a `shove` pusher as a brace target from the start and walks into it (`tx` past the face), and hands aim at its face, not over a low box. Without this, the brace stand-off left a bruiser 40 px short, inside its walk deadband, and the Eraser never moved. The Eraser now rubs out only what it slides into, so a bracer driving it back is not worn away from the tips. Before, every ref was rubbed to pieces before it got the Eraser home. A braced Eraser is driven back at 60 px/s.
  - **Phase 2:** each leap now peaks at 90 px (it was 230, over every guard's hands). A knock counts the closing speed of hand and Eraser, so a hand held up in its path stops it as well as a punch does. A knock is an aimed lob into the sharpener's mouth. Before, it was a fixed 420 px/s that needed several chained knocks from where he stands. Two knocks, each sharpening it smaller, make it crumble (three dropped the biped to 75%).
  - **Phase 3:** three crumbs at 80 px/s, all from the sharpener's mouth, 1.5 s apart. The first is live at once, so creatures never idle onto him between phases. The crumbs eat three times slower than smudgers, and any part of a body of mass 40 or more crushes one it touches. Under the 5-3 rules the creatures, worn down by then, missed the third crumb about a third of the time. Little Guy also backs into his corner, away from the sharpener.
  - **Spring punches at boxes:** the punch trigger in `actuators.ts` used `tb.r`, which is 0 for box bodies, so a spring arm almost never fired at a box. It now uses the box's smaller half-size. The Chapter 1-4 quick rows are unchanged.
  - **Daily Doodle:** the Smudgers arena (5-3) now lists One Stroke and Worms Only as modifiers it can't take, because a smudger has to be stepped on. Every other modifier still has a winner (`tools/dailycheck.ts`).
  - **Validator:** baselines are placed toward a Chapter 5 damage prop when the level has no entity threat. A boss attempt runs to the end of its pacing window plus 10 s (`attemptLimit`).
  - **Levels:**
    - **5-1:** the creatures are drawn on the threat side and a second pair of scissors comes from the left at 1.8 s, so a single shape is cut apart. The refs are long-armed (catches), springy (punches) and giant.
    - **5-2:** every lazy shape won by carrying him faster than the fire. Now a 90 px ledge stands at x 480, with the flag at 700, past `flagWalk`. A stalled carrier at the ledge face therefore cannot let him walk home, so it takes a runner, a hopper or a tosser.
    - **5-3:** four smudgers come from one side, 1 s apart, with him at the page edge.
    - **5-4:** the bombs and water gauntlet was too chaotic, and multi-obstacle courses leave a tossed Little Guy alone. Wide walkers straddled a 110 or 210 px pit, and the roof won. It is now scissors at 0.3 s, then the near bank catches fire at 2.5 s, with a 250 px gap to the flag.
  - **The boss runs about 15-30 s, not about 60.** The three phases resolve in 13-26 s with the reference bodies. The design target of "about 60 s" would need more stages or padding, and each added stage cost robustness. The window is 10-60 s.
  - **Known weak:** a heavy lazy lump (scrawl, blob) can shove the Eraser into the sharpener in phase 1. It then fails phase 2 for want of a hand, so all lazy shapes still lose. A line born near him launches him (the worm-launch bug noted under Chapter 2), which is the one lazy winner in 5-4 (2/5). Little Guy can get wedged in a creature's foot and be walked along with it; the phase 3 rules work around this rather than fix it.

## 2026-10-04: audio for Chapters 2-5 and the modes

- docs/audio.md §8: the sim now has events or readable state for everything §3 lists, so water, fire, scissors and the eraser are built. All of it is synthesised (`src/audio/synth-more.ts`), no new samples and no new licences. Events map in `sfx.ts` (`tear` by text prefix, `pass`, `score`, `crack`, `snap`, `knock`, `thud`, `grind`, `squish`, `ruleBreak`, a creature-less `grab` is a tentacle). Everything the sim has no event for is read from world state each frame in `src/audio/watch.ts` (bounces, see-saw stops, water entry and paddling, rafts, tentacle modes, wind, fire, scissors, the Eraser, the Sumo bully, the Sumo wake).
- Broken-floor `chunk` bodies tumble through everything (no collisions), so they get no bounce sound; the `crack` and `snap` events carry the break and the clatter.
- `knock` is emitted for a tentacle, scissors, the ninja and the Eraser, with no creature on the tentacle's and the Eraser's. The sound is chosen by the nearest such body, not by the event.
- Pencil Case timbres: `render/pencils.ts` exports `currentPencilId()`; `audio/pencil.ts` follows it with a per-pencil filter and grain table (levels trimmed to within about 3 dB of graphite).
- Pass-and-play draw timer: `ui/shell.ts` calls `sfxCountdown(n)` on its last three ticks.


## 2026-10-04: footless bodies don't turn around; worm-only Daily pairs banned
- **What:** creatures without feet no longer mirror their body to face a new direction. They inch either way, since the wriggle wave already follows travel.
- **Why:**
  - Mirroring a line lying flat swaps its ends through the floor and launched it about 270 px into the air. This was the "worm launch on boarding" bug: boarding only exposed it because the carry target flips direction.
  - Some Daily wins relied on that launch. Without it, honest worms (about 50 px/s) don't win Ledge, Pit, Bombs, Ninja, Spikes or Bridge with One Stroke, No Heads or Worms Only, so those pairs are banned.
- **Open:** Worms Only is now banned on every arena. Worms need a real niche before it can return.

## 2026-10-04: Heavy Ink fix; stuck attempts fail
- **Heavy Ink:** it now scales `m` and `im` together, and applies to grafted parts at birth.
  - Before, it divided only `im` and skipped grafts. A grafted body mixed masses, and the reaction impulses (which use `m`) leaked momentum. One worm self-propelled up to the speed cap and off the page (qa-monkey #1).
- **Stuck fail:** HOME levels without seconds, and HUG levels, now fail as "stuck" in the play page. This happens when the ink is spent (under 40 px left, nothing wet) and Little Guy moves less than 30 px in 6 s.
  - Before, about 40 qa scenarios idled forever until the player found Retry.
  - It lives in the toy rather than the sim because only the toy knows the ink budget. The sim and replays are unchanged.

## 2026-10-04: load budget met; no lazy chapters
- The production build is 600 KB in all. That is 285 KB of JS (99 KB gzipped), 13 KB of CSS, plus the audio samples and icons. The look-and-feel budget is 1.5 MB on the critical path.
- Levels are data and cost a few KB each, so lazy-loading chapters would add complexity for no gain. Revisit this if the music ever becomes a large stock file.

## 2026-10-04: worms return to Daily
- `tools/dailycheck.ts` now tries worm lines as candidates: 220 and 340 px long, flat or slanted up, at four spots around Little Guy.
- Before, it tried one canonical worm in two spots, which was too narrow. Worm lines win Ledge, Pit, Bombs, Ninja, Spikes, Bridge and See-saw.
- So Worms Only, One Stroke and No Heads are allowed again on those arenas. This reverts this morning's bans and lifts See-saw's.
- Worms are still slow (about 50 px/s) and can't climb, so their wins come from placement: lying across the gap, or guarding low.

## 2026-10-04: mix set by measurement
- `npm run mix` plays 1-4, 2-5, 3-2 and 5-4 headless and taps every bus. Loudness is unweighted RMS, a guide rather than LUFS.
- **Before:** music sat 20 dB under the SFX, and the pencil was the quietest bus, even while drawing.
- **New bus levels:**

  | Bus | Before | After |
  |---|---|---|
  | music | 1.1 | 2.5 |
  | pencil | 1 | 5 |
  | creatures | 1 | 0.6 |
  | world | 0.85 | 0.5 |

- **Result:**
  - SFX loud moments sit about 6 dB (2–10) over the music.
  - The pencil is the loudest bus while drawing.
  - Voices sit above the world effects.
  - The master no longer peaks into the limiter.
- **Still needs human ears** on phone speakers (audio.md §7 device check).

## 2026-10-04: critic-final fixes, part 1 (Sumo)
- **No grafting across teams:** `addStrokes` takes a team, and grafting only joins creatures of the same team (critic-final #3).
  - Before, a stroke touching the opponent welded onto it. Opponent arms that overlapped a hero welded into the hero too, which made a few Sumo "wins" fake.
- **The opponent is a no-draw zone:** `onFoe` in `sim/sumo.ts` covers 30 px around its ink, asleep or awake. The pencil skips over it the way it skips over terrain. `tools/sumocheck.ts` clips its test drawings the same way.
- **Grandmaster is now the spring-fisted puncher**, not a bruiser. A bruiser opponent was beaten only by another heavy, which is one answer; the rule is at least two. The puncher loses to the Heavy and the Biped. All 12 rungs pass.
- **No nameplate for the opponent:** it's named on its ladder card, so your hero gets the one plate (#2).
- **Credits:** heroes scaled to clear the ground band (#10).
- **Countdown numerals moved up** (y 105, 120 px), out of the band where bombs drop in (#8).

## 2026-10-04: playtest: easier 1-3, a hint button, every mode open, bigger Little Guy
- **1-3 Walls crusher speed 170 → 105.** A player got hard stuck on it. At 105 the refs pass with 100% robustness and every lazy baseline still fails (at 90 the blob passes, so 105 is the floor).
- **Hint button.** After two fails on a level, a blue "✎ hint" tab shows a reference body as a dashed guide-blue tracing ghost at the place it works. It stays across retries, and each press cycles to the next ref. Blue = guides, so the colour job is unchanged.
- **Sumo, Daily and the Doodle Pad open from the start.** Gating them behind Chapter 1 hid the toy. The ladder and chapters still open in order.
- **Little Guy drawn 1.3× (render only, `GUY.size`).** Scaling his sim body broke 3-1, 3-3, 4-1 and 5-3. Camera zoom was dropped because most levels span the full 720 px width.
