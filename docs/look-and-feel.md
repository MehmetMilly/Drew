# Drew: look and feel

## 1. The idea in one line

**A real sketchbook that's come alive.** Every pixel should look like it could have been made with paper, graphite, felt-tip, a highlighter, a non-photo-blue pencil, rubber stamps and sticky notes, and then animated by someone who loves it. When unsure, ask: *could this exist on a desk?* If yes, draw it that way.

## 2. Materials

- **Paper**: a generated texture if one passes review (see §10), otherwise procedural.
  - A warm base colour, then two layers of multi-octave value noise (fine tooth and large blotches), faint fibres, a soft vignette, and slight page darkening at the binding edge.
  - Render the paper once to an offscreen canvas per chapter and reuse it.
- **Chapter papers**:
  1. Cream sketchbook `#F4F1E8`.
  2. Graph paper: pale blue grid at 24 px with heavier lines every 5 squares.
  3. Brown kraft `#C9A97A` with darker fibres. Graphite reads lighter on kraft, so increase stroke darkness here.
  4. Cold-press watercolour, with soft blue washes pooling at the bottom where water lives.
  5. Crumpled and erased paper: crease shading, grey smudges, eraser crumbs that the Big Eraser leaves behind.
  - **Sumo**: torn margin paper with notebook rules. **Daily**: a calendar page. **Hall**: a heavier sketchbook card stock.
- **Graphite (the player's ink)**:
  - Tapered stroke ends.
  - Width 5–7 px, modulated by speed (slower is wider) and by pressure when available.
  - A grain texture: modulate alpha along the stroke with noise so the paper tooth shows through.
  - Slightly darker where strokes overlap.
  - **Wet ink** has a moving specular glint and a subtle sheen. Drying sweeps that gloss off along the stroke in drawing order, so drying is visible and readable as a countdown to birth.
- **Felt-tip (the world)**: solid near-black, slightly uneven edges, flat fill for terrain masses (like the reference game's bold black shapes). Terrain shapes are filled black with a 2 px wobble on the edge.
- **Highlighter**: translucent yellow with slightly darker overlapping strokes, sitting behind lines (multiply blend).
- **Non-photo blue**: thin, light and sketchy. Used for ghosts, intent lines and hints. It never carries important information alone.
- **Contact shadows**: a soft graphite smudge under every creature and Little Guy, scaled by height above ground. It grounds the figures. Cheap and essential.

## 3. Line boil

Every line (world, creatures, UI doodles) re-jitters at **8 fps** using 3 cycling noise frames with an offset amplitude of about 0.8 px. It is the single cheapest way to make the whole page feel alive. Precompute the offsets per vertex per frame and never re-randomise them each tick, or the lines will shimmer. With reduced motion the boil is off.

## 4. Characters

- **Creatures** are the player's drawing, skinned to physics (see `physics.md`), plus eyes (see `design.md` section 9). Never redraw or "clean up" the player's lines; their wobble is their personality.
- **Little Guy**: felt-tip stick figure, round filled head, dot eyes, a yellow highlighter scarf that trails in motion (a 3-segment verlet ribbon). Variants: crown (the King), party hat, referee hat in Sumo.
- **Enemies**: felt-tip silhouettes in the reference game's style (bold, black, readable at a glance) with one red accent each (the ninja's headband, the bully's cap, the sumo's belt, the Big Eraser's red sleeve).
- **Telegraphs**: every threat signals 0.3–0.6 s before acting. The ninja crouches. The bomb fuse sputters red sparks. The fan's blades blur up. The scissors open. Red "!" marks are felt-tip and appear only when a threat first activates.

## 5. Motion principles

- **Physics carries the bodies and hand animation carries the faces.** Eyes, brows, sweat and "!" marks are keyed animation layered on simulated bodies.
- **Anticipation before every intent**: about 100 ms of wind-up before a throw, a crouch before a jump, a lean before a charge. This is what makes puppeted intent read as decisions.
- **Squash and stretch** on eye shapes, lumps and Little Guy's head at impacts and landings (scale x 1.3 / y 0.75 on landing, recovering over 120 ms).
- **Follow-through** is free from physics. Make sure tips trail, not lead.

## 6. Juice (one table, tuned together)

| Event | Hit-stop | Shake (trauma, 0–1) | Other |
|---|---|---|---|
| Birth | none | none | blink, nameplate, music snaps back in |
| Creature lands hard | none | 0.1 | dust puff, squash |
| Creature strikes an enemy | 50–80 ms | 0.2 | white flash on the enemy for 1 frame, then red for 2; impact lines |
| Bomb explodes | 120 ms | 0.45 | felt-tip scribble burst, graphite crumbs, duck the music |
| Limb severed | 80 ms | 0.15 | snap lines; the severed piece's "!" and eyes pop 150 ms later |
| Crusher held at the limit | none | a continuous 0.05 rumble | strain face, constraint tremble |
| Little Guy poof | 100 ms | 0.25 | scribble cloud, ✗ eyes, sad note |
| Win | 150 ms | 0.3 (from the stamp) | the green rubber stamp slams |

- **Screen shake**: use a trauma model, with offset and angle proportional to trauma², decaying at about 1.2 per second. Maximum offset 10 px, maximum angle 1.5°. It never moves the UI layer.
- **Onomatopoeia** ("BONK", "BOING", "SNIP", "FWOOSH"): hand-lettered, sparingly, at most one on screen, 400 ms. Only for the biggest moments.

## 7. Time slow while drawing

On pen down:

- The world eases to the level's draw speed over 150 ms using an ease-out curve.
- The page subtly cools: saturation down 20% and a 6% darkening vignette.
- The music low-pass sweeps down (see `audio.md`).
- Creatures and threats keep moving, slowly, so the player feels the world waiting on their pencil.

At birth everything reverses over 200 ms, with a soft whoosh.

## 8. Interface

- **Technology**: DOM and CSS over the canvas. Animate only `transform` and `opacity`. Text is real text, for crispness and accessibility.
- **Fonts**: a hand-lettered display face for titles and numbers (for example *Gochi Hand* or *Caveat Brush*), and a calmer hand-written face for small text (for example *Patrick Hand*). Self-host them so the game works offline.
- **The kit, all made of desk objects**:
  - sticky notes (level cards, prompts, dares)
  - washi tape (holding cards to the page)
  - rubber stamps (results, daily calendar)
  - a pencil (the ink meter)
  - paper tabs on the sketchbook edge (navigation)
  - a doodled eraser (undo)
- **Pressable things** scale to 0.96 on press over 120 ms with ease-out and spring back on release. A tiny pencil-tick sound plays on press.
- **Easing**: entrances and exits use a strong ease-out, `cubic-bezier(0.23, 1, 0.32, 1)`. On-screen movement uses `cubic-bezier(0.77, 0, 0.175, 1)`. Avoid ease-in for UI. UI animations stay between 150 and 280 ms. Nothing enters from scale 0: start at 0.95 scale with opacity 0. Stagger lists at 40 ms.
- **Frequency rule**: the more often an action happens, the less it animates. **Retry is instant, with no transition.** Pause opens in 150 ms. Moving between levels uses a page turn (about 350 ms), but restarting the same level never does.
- **HUD in play**:
  - Top-left: the pencil, as the ink meter.
  - Top-centre: the handwritten level title, which shrinks into a small corner label after the Read phase.
  - Top-right: small doodled retry and pause icons with 44 px or larger touch targets.
  - The giant red countdown numerals sit in the sky in SAVE levels, pulsing on each of the last three seconds.
  - Nothing else. The page is the game.
- **Screens**:
  - **Title**: the logo draws itself, the D wakes up, the menu is three sticky notes (Story, Sumo, Daily) plus a Sketchbook tab.
  - **Chapter select**: sketchbook spreads, one per chapter, on that chapter's paper. Levels are thumbnails drawn as tiny greybox doodles, with badge slots as three empty stamp circles.
  - **Level card**: a sticky note with the title, best hero's name and badges.
  - **End card**: the stamp, nameplate, epitaph, badges, then Next, Retry, Watch and Save clip.
  - **Hall of Heroes**: a living gallery.
  - **Settings**: a sticky note with hand-drawn toggles (a checkbox gets a scribbled tick).
- **The nameplate**: a white label with a red border, hand-lettered, slapped on at a slight angle with a 160 ms overshoot. It follows its creature for 1.5 s, then peels away.
- **Phone first**: portrait 9:16 page, letterboxed on wide screens with a desk surface (a soft wood-grain tone) visible around the page. Respect safe areas. All touch targets 44 px or larger. Lock scroll and zoom in play with `touch-action: none`, and capture the pointer during strokes.

## 9. The review rubric (for self-review and critic subagents)

Before calling any visual milestone done, generate `npm run shots` and check each screen and frame strip against this list. Report problems as a markdown table with Before / After / Why columns.

1. **Desk test**: does every element look like it could be made with real desk materials?
2. **Colour jobs**: is every colour doing only its job (see `CLAUDE.md`)?
3. **Readability**: is the threat readable within 0.5 s of the level appearing, at phone size?
4. **Faces**: do the creature's eyes show what it's about to do before it does it?
5. **Grounding**: does every figure have a contact shadow and weight?
6. **Motion**: is there anticipation before intent? Do retries cut instantly?
7. **Type and hierarchy**: is there one obvious focal point per screen? Is text legible at 360 px width?
8. **Consistency**: do line weights match within a material? Is line boil on everything, including UI doodles?
9. **Delight**: is there at least one small surprise per screen (a doodle in a margin, a creature peeking from a tab)?
10. **Restraint**: is anything on screen not earning its place? Remove it.

## 10. Generated images (Codex CLI image generation, when available)

**Everything that moves, boils or acts is drawn in code**:
- creatures and their eyes
- Little Guy
- enemies
- terrain and hazards
- line-art UI doodles and icons
- the animated logo

These must share the live line style, deform with physics and boil, which raster art can't do.

Generated images are for **static materials and the frame around the game**:
- **Paper textures**: one per chapter, Sumo, Daily and Hall. Tileable 1024 px, low contrast, so graphite and felt-tip stay the strongest marks on the page.
- **The desk surface** around the letterboxed page.
- **Material textures** applied to UI shapes drawn in code: sticky-note paper, washi tape, rubber-stamp ink grain, the kraft of Chapter 3, the crumple map of Chapter 5.
- **Outside the game**: app icon, splash, install screenshots and share-card art.

**Rules:**

- Generate at 2× the target size.
- Tiling textures must tile seamlessly; check by rendering a 3 × 3 grid of the tile.
- Keep the colour jobs: no hues outside paper tones and the `CLAUDE.md` palette.
- Export to WebP or AVIF. Keep all generated images on the critical path under 1.5 MB in total, and lazy-load the rest.
- Log each image's prompt, tool and date in `ASSETS.md`.
- Keep the procedural version of every texture as the fallback.
- Generated images go through the same critic review as everything else. One that fights the drawn lines loses to the procedural version.
