# Drew: audio

## 1. Direction

**The pencil is the lead instrument.** While the player draws, the music sinks into a muffled hum and the pencil scratch is the loudest, most intimate sound in the game, close and dry like ASMR. At birth the music snaps back. Everything else is small, warm and funny: paper, rubber, wood, little voices. The game never sounds digital except on purpose, such as a scribble-burst explosion.

## 2. Mixer buses

```
Master (limiter)
├── Music      (layered; low-pass + duck controls)
├── Pencil     (its own bus; never ducked)
├── SFX
│   ├── Creatures (voices, efforts)
│   ├── World     (impacts, hazards, water, fire)
│   └── UI        (taps, stamps, page turns)
└── Ambience   (room tone, per-chapter beds)
```

- **Ducking**: big impacts (explosion, poof, win stamp) duck Music and Ambience by about 8 dB, with an 80 ms attack and 500 ms release. Slow time puts a low-pass on Music (20 kHz down to 700 Hz over 150 ms) plus −10 dB; birth reverses it over 200 ms.
- **Variation**: every frequent sound has a pool of 3–5 variants, picks one at random without immediate repeats, and gets ±6% pitch and ±1.5 dB jitter.
- **Voice limits**: at most 4 simultaneous voices of the same sound, and at most 3 creature voices talking at once. The newest steals from the quietest.
- **Unlock**: create the audio context on the first user gesture (the title-screen tap) and handle resume after the app has been backgrounded.

## 3. Sound list

The **Source** column is the first choice; any row can fall back to synthesis.

| Event | Character | Source |
|---|---|---|
| Pencil drawing | dry graphite scratch; grain density follows pen speed, brightness follows pressure | synth: band-passed noise with granular amplitude jitter driven by speed; swap for a CC0 recording if one is found |
| Pencil lift | tiny tick | synth |
| Ink drying | soft rising shimmer, synced to the gloss sweep | synth |
| Birth | a soft paper "pop" plus a double-blink tick plus the creature's first gasp | Kenney Interface/Impact + voice |
| Nameplate slap | a sticker thwap | Kenney Impact |
| Creature voices | gibberish babble, one syllable per action ("hup!", "nnngh", "wah!") | synth voice (section 4) |
| Footsteps | soft pencil taps, pitch by creature size | synth |
| Grab / throw | rubbery grip squeak / whoosh | Kenney Impact + synth whoosh |
| Spring compress / release | coiled creak, then a cartoon *boing* | synth (pitch-bent sine with vibrato) |
| Punch connect | cardboard bonk | Kenney Impact |
| Lump impact | heavy thud plus paper crumple | Kenney Impact |
| Limb snap | pencil-lead snap, then a tiny "!" bloop | synth snap (short filtered click) |
| Bomb fuse / explosion | sputter / boom with a scribble rasp | Kenney Impact + synth noise burst |
| Boulder roll | low rumble with grit | synth |
| Crusher grind | stone scrape that rises with strain | synth |
| Ninja | "hyah!" and a leap whoosh | synth voice |
| Water / splash | gentle sloshes and plops | Kenney or OpenGameArt CC0 |
| Fire | crackle bed | synth |
| Scissors | snip-snip | synth |
| Eraser (smudgers, boss) | rubbery squeak | synth |
| Little Guy | tiny "aaa!", "yay!", "hm?" | synth voice, high pitch |
| Countdown tick | woodblock, rising on the last three | synth |
| Win | rubber stamp slam, then a 2-second kazoo-and-ukulele sting | Kenney Impact + Music Jingles, or synth |
| Fail | soft sad-trombone "wah-wah" (short, not mocking) | synth or Music Jingles |
| UI tap / page turn | pencil tick / paper page flip | Kenney Interface + synth |

## 4. The doodle voice (synthesised, unique per creature)

Each creature gets a small formant voice:

- **Source**: a sawtooth or pulse wave through two band-pass formant filters, gliding between vowel pairs (a/o/e/u/i) on syllables of 60–120 ms.
- **Pitch** comes from size: tiny creatures around 520 Hz, giants around 90 Hz.
- **Timbre** comes from kind:
  - Springy gets vibrato.
  - Heavy is lower with a growl (add sub-octave).
  - Floaty is breathy (more noise).
  - Worm is nasal (narrow formants).
- **Syllables** come from a seeded per-creature sequence, so each creature sounds like itself across replays.
- **When it talks**: at birth (2 syllables), at mode changes (1), when straining (a held "nnngh"), when severed ("wah!"), and on a win (a happy trill). A creature that talks constantly becomes noise, so leave gaps.

## 5. Music

**Style**: small and playful, like a picture book. Pizzicato strings, ukulele, upright bass, glockenspiel, a whistle or kazoo lead, brushed snare. Major keys, 90–120 BPM. Chapter 5 gets a slightly mischievous minor-key variant. The Big Eraser fight gets a march.

**Adaptive structure**: each piece has two layers that loop in sync.

- **Calm** plays in menus, in the Read phase and after a win.
- **Action** adds percussion and a bass line when the action starts, for SAVE countdowns and threats.
- **Slow time** filters both layers (section 2).
- **The last 3 seconds of a countdown** add a ticking ostinato.

When stock tracks have no stems, approximate the layers by crossfading two tracks in the same key and tempo, or by filtering one track (a high-passed calm version and the full action version).

**Needed** (about 6 pieces): title/menu, Chapters 1–2 (bright), Chapters 3–4 (warm), Chapter 5 (mischief), boss march, Sumo (comic brass/percussion), plus win and fail stings.

## 6. Sourcing and licences (download directly; keep it shippable)

Download from the web yourself. Licences were checked in October 2026; re-check each file's page when you download it.

- **Kenney audio packs** (Impact Sounds, Interface Sounds, UI Audio, Music Jingles; kenney.nl): CC0, no attribution. First choice for impacts, UI and stings.
- **OpenGameArt**: per-item licences. Accept CC0, CC-BY and OGA-BY; skip GPL and anything non-commercial. A good source for playful music loops and water sounds.
- **Incompetech (Kevin MacLeod)**: CC-BY 4.0, direct downloads. The full credit line goes in `CREDITS.md` and the in-game credits. A good source for picture-book style music.
- **Pixabay Music and Freesound**: usable when a direct download works. For Pixabay, files can't be redistributed on their own. For Freesound, accept only CC0 or CC-BY.

**Rules:**

- Record every shipped file in `CREDITS.md` with its URL, author, licence and any changes made.
- Store sound effects as `.ogg` with a `.mp3` fallback. Trim loops at zero crossings, with no leading or trailing silence.
- Normalise everything to the mix targets below.
- Choose music by listening criteria, not titles:
  - tempo in range
  - matching key between calm and action layers
  - no vocals
  - nothing that grates on the tenth loop
- If a source blocks downloads, move to the next source.
- The synthesised sounds in §3 (pencil, voices, boing, snaps) stay synthesised by design; they react to gameplay in ways recordings can't.

## 7. Mix targets

- **Loudness** (integrated, measured over a typical level): music around −20 LUFS, SFX peaks about 6 dB above the music.
- **Pencil**: the loudest element while drawing.
- **Voices**: sit above the world sound effects.
- **Ambience**: barely noticeable, so you only notice it when it stops.
- **Device check**: verify on phone speakers, where very low frequencies vanish. Give every low impact an upper-mid component so it still reads.

## 8. Implementation status (2026-10-04)

Code lives in `src/audio/`: `mixer.ts` (buses, ducking, slow time), `samples.ts` (pools with variation and voice limits), `synth.ts` (one-shots and loops), `voice.ts` (doodle voices), `music.ts` (adaptive loop), `sfx.ts` (event router and per-frame layer), `pencil.ts` (pencil, unlock). Shipped files and licences: `CREDITS.md`.

- Music is a procedural placeholder in the style of §5; stock tracks are still to be chosen (see `music.ts` header).
- Chapters 2-5 and modes (2026-10-04) are all synthesised: `synth-more.ts` holds the sounds, `sfx.ts` maps sim events to them, `watch.ts` reads world state each frame for what has no event (ball and duck bounces, see-saw clunks, bridge and raft creaks, water entry and paddling, tentacle rising, wind and fan, floor fire, scissors, the Eraser's rub and sharpener, the Sumo bully, the Sumo taiko when both sides wake). `pencil.ts` has one scratch timbre per Pencil Case pencil.
- Not built: the spring creak before a boing (no event), a sound for Little Guy boarding a creature, footsteps for smudgers.
- Hooks for the shell: `sfxUi('tap' | 'back' | 'page')`, `sfxCountdown(n)` (also used by the pass-and-play draw timer), `sfxFail()` in `sfx.ts`. `pencilTick()` unlocks audio on the first press.
