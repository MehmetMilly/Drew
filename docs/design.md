# Drew: game design

## 1. North star: the player's first ten minutes

A blank cream page. A pencil sketches the word **Drew**; the D gets two eyes, blinks, and hops off the logo. Tap anywhere.

**1-1 "Hello, Friend."** Little Guy sits alone on an empty page with a tiny yellow scarf, kicking his feet. One handwritten line: *Draw him a friend.* The player scribbles a lopsided dog-ish thing. Lifting the pencil, the ink glistens for a second, dries, and two eyes pop open. A sticky label slaps on: **"Kevin the Many-Legged."** Kevin blinks at the player, looks around, spots Little Guy, scuttles over and hugs him. A heart doodle pops. Green stamp. Ten seconds in, the player has learned the whole premise without reading a rule.

**1-2 "Boulder."** A boulder starts rolling down a gentle slope at Little Guy, who is backed against a wall. The player touches the screen and the world sinks into slow motion; the paper darkens at the edges and the music drops to a muffled hum under the pencil scratch. They draw a quick stick man. It wakes, sees the boulder, eyebrows go determined, it plants its feet and braces. It holds, or gets pancaked into a comic smear. Either way the player laughs and redraws within a second, with their last drawing shown as a faint blue ghost to trace or ignore.

**1-4 "Bombs in the Bowl."** The player draws a roof over Little Guy, the obvious answer. The roof wakes up. It is a headless arch with two feet, and it bravely stands over him. The bombs bounce off, roll down into the dip next to him, and explode. The player draws a creature with arms instead. It reaches up, catches a bomb, winds up, and lobs it off the page. That is the moment the player understands the game: **the drawing is a body, and the level is asking for a verb.**

By minute ten they have three heroes in their Hall of Heroes, have watched a straight line buckle like a drinking straw, and have started drawing deliberately weird bodies just to see what they do. That last part is the success condition for the whole design.

## 2. Core loop

**Read → Draw → Birth → Action → Result → Retry or Next.**

- **Read**, 1.0 s: the level title is handwritten across the page while the world holds its first frame. Threats are visible and telegraphed.
- **Draw**: the world runs at the level's draw speed (section 3) while ink is wet.
- **Birth**: ink dries, eyes open, nameplate, time returns to 1×. Under 0.5 s, and it never blocks the action.
- **Action**, 3–12 s: creatures act on their own. The player may draw more at any moment.
- **Result**: win → highlight replay and stamp. Fail → a 0.6 s comic beat, then the retry prompt.
- **Retry** is one tap and instant: no transition, no confirmation. Watching the full replay is an optional button.

Target pace: a level takes 3–6 attempts and under two minutes for an average player. Attempts are short so failure is cheap and funny.

## 3. Pen, ink and time

- **Pen down or wet ink** slows the world. The draw speed is a per-level value: 0.04× in early chapters, up to 0.12× in action-heavy levels. The ease into slow motion takes 150 ms, and the ease out at birth takes 200 ms.
- **Wet ink**: a stroke stays wet for 1.0 s after pen-up (2.0 s in Gentle mode), shown as gloss sweeping off along the stroke. Strokes that touch while wet join into one creature. When all ink is dry, every new creature is born at once.
- **Grafting**: a stroke that touches a living creature joins it as a new body part, and the anatomy is re-read and re-announced ("Kevin grew an arm!"). Grafting also rescues an early birth: if a head dries before its body is drawn, the head blinks at the player while they finish, and the body grafts on. That is intended charm, not a bug.
- **Undo**: only while the latest stroke is still wet (a small eraser button, or a two-finger tap).
- **Ink** is a per-level budget of stroke length, shown as a real pencil at the top of the screen that shortens as you draw. Budgets are generous. Ink not spent before the action can be spent during it.
- **No-draw zones**: strokes can't enter solid terrain. The pencil skips with a dry scratch sound and a tiny blue dotted outline.

## 4. The four marks (the whole drawing grammar)

| Mark | The player draws | It becomes |
|---|---|---|
| **Line** | any open stroke | bones and limbs, stiff but bendable |
| **Loop** | a closed shape | the largest loop is the **head** (eyes appear inside, sized to it); other loops are air sacs; all loops are buoyant and light |
| **Zigzag** | a sharp back-and-forth section | a **spring** the creature compresses and releases: a jump on legs, a punch on arms |
| **Scribble** | dense back-and-forth fill | a **lump**: five times the mass, hits hard, sinks, anchors against wind and shoves |

One stroke can contain several marks: a line ending in a scribbled fist is an arm with a heavy lump on the end. The detection heuristics live in `physics.md`.

A creature with no loop is a **worm**: its eyes sit on its highest end. It is still alive and still tries.

## 5. Anatomy read (at birth, and after every graft or sever)

- **Body**: strokes that cross or touch (with generous snapping, since fingers are sloppy) are welded. Each connected group is one creature.
- **Head**: the largest loop. Without a loop, the highest line end gets the eyes.
- **Tips**: unwelded line ends. A tip in the lower part of the body is a **foot**, otherwise a **hand**. Feet walk and plant; hands reach, grab, throw and punch.
- **Stats** come only from geometry:
  - ink length → mass
  - lumps → extra mass
  - limb length → reach
  - foot count → stability
  - leg length → stride and speed
  - springs → jump and punch
  - loop area → buoyancy
  - bounding box → size
- **Gait** comes from the body plan, so different bodies visibly move differently: a spring leg **hops**; three or more feet **scurry** (quicker steps); one or two feet **walk**; a legless body with a loop **rolls** (tumbles over its corners); a legless line **inches** like a caterpillar.
- **Front**: if the head sits clearly to one side of the body, that side is the front. The creature turns round to face where it goes, and its eyes lean that way. Symmetric bodies and scribble masses have no front.
- **Limbs swing from their root as one piece**, keeping their drawn shape, and stop short of the body beside them. A limb tied to the body at more than its root can only strain its tip toward a target.
- **Square-cube feel**: strength grows slower than mass. Giants are mighty but lumbering, tiny creatures are quick but weak. This is a core trade-off and it must be felt.

## 6. Kinds of hero

Every creature gets exactly one **kind**, the first match in this order. The kind drives its epithet, its voice and level badges.

| Kind | Rule | Epithet |
|---|---|---|
| Giant | taller than 60% of the page height, or wider than 60% of the page width | the Enormous |
| Tiny | largest dimension under 128 px (10% of page height) | the Tiny |
| Springy | has a spring | the Springy |
| Heavy | has a lump | the Heavy |
| Floaty | two or more loops | the Buoyant |
| Worm | no loop and at most one tip (the other end carries the eyes) | the Worm |
| Many-Legged | three or more feet | the Many-Legged |
| Long-Armed | a hand limb longer than the creature's height | the Long-Armed |
| Headless | no loop | the Headless |
| Biped | anything else | the Brave |

**Names** are an ordinary first name (Gerald, Doris, Kevin, Mabel, Nigel, Wendy, Bernard, Phil, Agnes, Clive, Brenda, Otis… about 80 of them), seeded from the stroke data so the same drawing always gets the same name, followed by the epithet. **The nameplate is how the player learns the game read their drawing correctly, so it must be accurate.**

## 7. Severing and grafting

- A link snaps when overstretched far beyond normal acting, or when a hazard cuts it (scissors, fire, explosion, spikes, eraser). Normal acting never tears a creature; tearing is an event, never noise.
- After a snap, any severed piece of 60 px or more that has no eyes **grows eyes and becomes its own creature**, with a tiny "!" and its own nameplate ("Leg the Worm"). Smaller pieces turn to dead graphite dust and fade out over 1 s. This is a signature comedy beat.
- Grafting (section 3) is the counterpart: the player repairs or upgrades a creature mid-action.

## 8. The creature brain

Every creature loves Little Guy and wants to help. The brain is small, consistent and readable, so outcomes trace back to the drawing. Each tick it picks the highest-priority mode that applies:

1. **Brace**: a pusher (crusher wall, rolling boulder, sumo, tentacle pull, Big Eraser shove) is touching the creature, or within 60 px of Little Guy. Hands push against the pushing surface, feet plant with high friction, and the body holds position. Strain shows on the face.
2. **Intercept**: a threat is inside sense range (twice the creature's size plus 150 px), or is predicted to reach Little Guy within 1.5 s. The creature moves to stand between the threat and Little Guy. Each hand reaches for the nearest threat inside its reach envelope; it grabs grabbable threats (bombs, balls, small enemies) and throws them up and away from Little Guy. Spring arms punch when a threat is in arm's reach. Bodies block everything else.
3. **Carry** (HOME and SCORE goals): fetch Little Guy or the cargo. A free hand grabs; with no free hand, Little Guy climbs onto the creature's highest point and rides. Then walk to the goal. Spring legs jump when a ledge, gap or obstacle is within one body length ahead, or the goal is above. On arrival, set Little Guy down, or release the cargo over the goal (a dunk).
4. **Guard / Idle**: stay beside Little Guy on the side threats come from. Look around, sometimes wave at the player.

**Intent lines**: when a creature commits to a target, a faint non-photo-blue dotted line runs from its eyes to the target for 0.4 s. It is how players learn the brain without reading anything. It can be toggled in settings and is on by default.

In **Sumo**, the brain is the same, except the opponent is the threat, the edge of the ring is a pit, and grabbing an opponent's ink is allowed. That is how wrestling happens.

## 9. Faces do the acting

Eyes turn a line into a character, so they get the most care of any visual in the game.

- **Construction**: two wobbly drawn ovals with crisp white fill and black pupils, sized to the head (6–22 px).
- **Pupils lead the body**: they look at the next target about 250 ms before the body moves, widen when they notice it, and hands wind up away from it first. Saccades. A blink every 2–5 s, and a double blink at birth.
- **Brows** show the mode: worried in Guard, determined in Intercept, angry when hit, straining in Brace.
- **Strain**: sweat drops and a red tint when a limb is near its strength limit.
- **Dizzy**: spiral pupils when flipped for more than 1 s.
- **Happy**: closed-arc eyes when Little Guy is safe.
- **Surprise**: wide eyes and a "!" when severed or newly born from a severed piece.
- **Squash and stretch on the eye shapes** at impacts.

## 10. Little Guy

- About 40 px tall, drawn in felt-tip with a yellow highlighter scarf. He is a small 6-particle ragdoll, so he flails when grabbed or flung. He can't fight. He can be grabbed (he kicks his legs), can ride on top of a creature (soft attachment; he falls off if it is stretched hard or the creature stays upside down for more than 1 s), and can walk slowly to board a creature in HOME levels.
- **Reactions** carry a lot of the comedy:
  - He looks at every newborn. If it is more than three times his height he leaps with a "!" and then relaxes.
  - He cowers under threat.
  - When grabbed he flails, then accepts it.
  - On a win he hugs the nearest creature and a heart doodle pops.
  - In some levels he wears a crown (the King) or a party hat.
  - He has a tiny gibberish voice.
- **Death** is a comic poof, never gory: he bursts into a graphite scribble cloud with ✗ eyes and a tiny "aaa". Causes: explosion radius, crushed (gap narrower than his width), struck by an enemy, fast boulder contact or a boulder resting on him for 0.5 s, being squeezed by shoved ink, deep water for more than 1 s, falling off the page, fire, scissors, eraser.

## 11. Results and replay

- **Win**: hit-stop, then the green rubber stamp slams onto the page. Then a ≤4 s **highlight**: the money moment again at 0.3× with a gentle zoom. Then the end card with the nameplate, an epitaph and the badges earned. Buttons: Next, Retry, Watch, Save clip.
- **Fail**: the comic beat (poof, the creature's face falls), 0.6 s, then a small prompt. Tapping anywhere retries. A small Watch button sits beside it.
- **The full replay (Watch)** has three parts:
  1. A drawing timelapse at 1.5× pen speed, with a pencil sprite following the tip, over the frozen first frame.
  2. The action at 1×.
  3. The money moment at 0.3×.
- **Money moment selection**: score recorded events and pick the highest. Events include grabs, throws, severs (the piece growing eyes scores highest), the closest call to Little Guy, big impulses near him, and the winning frame.
- **Epitaphs** come from an event log: "Held the walls for 4.0 s." "Caught 2 bombs. Threw one at a pigeon." "Lost two legs. Kept going." "Grew an arm mid-fight." "Was a leg. Became a hero."
- **Save clip** records the full replay through `canvas.captureStream(30)` and `MediaRecorder` to webm or mp4, with the title card burned into the first frame. Hide the button where it is unsupported.

## 12. Modes

### Story (the spine)

Five chapters of five levels plus the finale (see `levels.md`). Each chapter introduces one new mark or idea and has its own paper. Level goals:

- **HUG**: tutorial only.
- **SAVE n s**: survive the giant red countdown in the sky.
- **HOME**: Little Guy reaches the flag.
- **SCORE n**: n cargo through the goal.

**Badges**: each level has three badge slots. Clearing it with a hero of a kind you haven't cleared it with before fills a slot ("Cleared with: the Springy · the Worm · the Heavy"). This is the mastery axis. It pays for variety and never for efficiency.

### Sumo (unlocks after Chapter 1)

A raised ring on a page torn from a margin. Both creatures are drawn, both wake, and the first one pushed off the ring loses. Rounds last 12 s; at time-out the ring shrinks.

- **Ladder**: 12 pre-drawn opponents, each with a body-plan gimmick that asks for a specific counter (listed in `levels.md`). Beating the ladder unlocks the Champion's pencil.
- **Pass-and-play for two players**: best of five, 8 s to draw, same ink. Who draws first alternates each round and the second drawer sees the first creature. Countering is the point.
- Little Guy referees in a tiny gyōji hat and reacts to every round.

### Daily Doodle (unlocks after Chapter 1)

One challenge per calendar day, the same for everyone, derived from the date: a level from a pool of 12 dedicated daily arenas plus one modifier. Modifiers:

- **One Stroke**
- **No Heads**
- **Worms Only**
- **Giants Only**
- **Tiny Only**
- **Half Ink**
- **Exactly Two Friends**
- **Blind Draw**: ink is invisible until birth
- **Mirror**: strokes mirror across the centre
- **Heavy Ink**: every stroke counts as a lump

A clear stamps that day on a calendar page, and streaks show as a row of stamps. One-tap Save clip. There is no server and no leaderboard; it is local only.

### Sketchbook

- **Hall of Heroes**: every winning creature is saved: normalised strokes, name, kind, level, epitaph, date. Cap 300. The gallery is sketchbook pages with each hero idling with line boil. Tapping one opens a blank page where it lives, waves, and can be poked and dragged. That page must feel precious and cost almost nothing to build.
- **Doodle Pad**: sandbox. Blank paper and Little Guy, a pencil-drawn palette to drop any hazard, toggles for water, wind and gravity, and infinite ink.
- **Pencil Case**: cosmetic pencils unlocked by badges: Graphite (default), Blue Ballpoint, Wax Crayon, Felt Marker, Chalk on blackboard paper, Rainbow. Each changes stroke texture and voice timbre and nothing else.

## 13. Progression

- **Chapters**: the next chapter opens when 4 of the current 5 levels are cleared. The finale needs all of Chapter 5.
- **Badges** fill the Pencil Case at 10, 25, 45, 60 and 75 badges.
- **Sumo and Daily** unlock after Chapter 1. The Doodle Pad unlocks after 1-5.

## 14. Onboarding and hints

- **Words**: one handwritten title per level, plus at most one handwritten hint on the first level of each chapter (for example *zigzags are springy* on 2-1). That is all the text.
- **Teaching**: every new mark is taught by a level where using it almost guarantees a win, and the nameplate echoes it ("the Springy").
- **Adaptive ghost hint**: after three fails on a level, a faint non-photo-blue sketch of a reference solution's body (with no positions given away) fades in for 2 s.

## 15. Settings and accessibility

- Sound, music and voices volumes.
- **Gentle mode**: world speed 0.7×, double ink, 2.0 s drying.
- **Reduced motion**: no line boil, no screen shake, no zoom on replays. Respect `prefers-reduced-motion` by default.
- Intent lines on or off.
- Left-handed layout (mirrored HUD).
- Haptics on or off (Android `navigator.vibrate` at birth and on big impacts).
- Success and failure differ by shape (✓ stamp and ✗ scribble) as well as colour.

## 16. Save data

Stored in localStorage behind one versioned schema, with try/catch on every read and write; the game runs fine with storage empty or unavailable. It holds: unlocks, badges per level, Hall entries, daily stamps, settings and selected pencil.

## 17. Deliberately absent

These are absent on purpose, so the energy goes to the things that make Drew itself:

- recognising what a drawing depicts
- static or dead ink
- steering creatures after birth
- scoring for using less ink
- timers on menus
- energy systems, currencies, ads, loot
- text tutorials
