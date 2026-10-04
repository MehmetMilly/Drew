# Credits

## Data

- **Quick, Draw! dataset** by Google Creative Lab, licensed CC BY 4.0
  (https://github.com/googlecreativelab/quickdraw-dataset). A seeded subset of 1,000 single-stroke
  drawings (line, circle, triangle, square, zigzag), rescaled and rounded, is used as a classifier
  regression corpus in `tests/fixtures/quickdraw/strokes.json`. It is test data only and does not
  ship in the game.

## Audio

Sound effects ship as `.ogg` (Vorbis) with an `.mp3` fallback in `public/audio/`. Every file below is
from a **Kenney** pack, licensed **CC0 1.0** (no attribution required; credited here anyway).
Changes made to every file: converted to mono 44.1 kHz, leading and trailing silence trimmed
(UI ticks kept untrimmed), peak-normalised to -3 dBFS, 12 ms fade-out, encoded with ffmpeg
(`vorbis` 64 kbit/s stereo for .ogg, LAME q6 mono for .mp3). The game plays them with pitch and
level jitter and layers synthesised parts on top.

| Shipped files | Source file(s) | Pack | URL |
|---|---|---|---|
| `thud_0..2` | `impactSoft_heavy_000..002.ogg` | Impact Sounds 1.0 | https://kenney.nl/assets/impact-sounds |
| `plop_0..2` | `impactSoft_medium_000..002.ogg` | Impact Sounds 1.0 | https://kenney.nl/assets/impact-sounds |
| `bonk_0..2` | `impactPunch_medium_000..002.ogg` | Impact Sounds 1.0 | https://kenney.nl/assets/impact-sounds |
| `thwap_0..2` | `impactGeneric_light_000..002.ogg` | Impact Sounds 1.0 | https://kenney.nl/assets/impact-sounds |
| `stamp_0..1` | `impactWood_heavy_000..001.ogg` | Impact Sounds 1.0 | https://kenney.nl/assets/impact-sounds |
| `ui_0..2` | `select_001.ogg`, `select_002.ogg`, `tick_004.ogg` | Interface Sounds 1.0 | https://kenney.nl/assets/interface-sounds |

Author: Kenney (www.kenney.nl). Licence: https://creativecommons.org/publicdomain/zero/1.0/ (checked
on each pack's page and in its `License.txt` on 2026-10-03).

Synthesised in code (no files, no licence): pencil scratch, pen-lift tick, birth pop, doodle voices,
Little Guy and ninja voices, snap, boing, whoosh, grip squeak, boom, poof, footsteps, rumble, grind,
fuse hiss, room tone, woodblock countdown, win sting, fail sting, and the music loop. Added for
Chapters 2-5 and the modes (`src/audio/synth-more.ts`, still no files): rubber bounce, ball lob and
shot, score swish, duck squeak, spike cut, floor crack, bridge snap, plank clunk, wood creak, splash,
paddle slosh, drowning bubbles, kraken rise, latch and slurp, wind and fan, scissors snip and whirr,
fire crackle, whumph and embers, smudger nibble and squish, Eraser rub, thud and sharpener, the Daily
puff, the Sumo bully's stomp and grunt, the Sumo taiko and clap, and the per-pencil scratch timbres.

## Fonts

Both are bundled as WOFF2 in `public/fonts/`, with their licence texts next to them.

| Font | Author | Licence |
|---|---|---|
| Gochi Hand | HT Fonts (www.htfonts.com) | SIL Open Font License 1.1 (`OFL-gochi-hand.txt`) |
| Patrick Hand | Patrick Wagesreiter | SIL Open Font License 1.1 (`OFL-patrick-hand.txt`) |

## Everything else

The music, the pencil, the doodle voices and the cartoon sounds that aren't listed above are synthesised in the browser at run time (`src/audio/`). All art is drawn in code.
