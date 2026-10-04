# Drew

A browser game where everything you draw comes alive. You draw a creature in a few seconds. When the ink dries it opens its eyes and tries, clumsily and heroically, to protect a tiny stick figure called **Little Guy**. Its body comes from your drawing's geometry, and you never steer it.

## Play

```bash
npm install
```

```bash
npm run dev
```

Open the printed URL on a phone or a desktop browser (the dev server listens on the LAN). For a production build:

```bash
npm run build
```

The game is a PWA. Once loaded, it installs to the home screen and plays offline.

## What's in it

- **Story:** five chapters, each teaching one mark of the drawing grammar:
  - It's Alive: lines, heads, size
  - Boing: zigzag springs
  - Heavy Stuff: scribble lumps
  - Wet Paper: loops float
  - The Eraser: ink damage, grafting and the Big Eraser boss
- **Sumo:** a 12-opponent ladder, plus two-player pass-and-play (best of five).
- **Daily Doodle:** one arena and one modifier a day, picked from the date, with calendar stamps and a streak.
- **Sketchbook:**
  - the Hall of Heroes (every winning creature)
  - the Doodle Pad sandbox
  - the Pencil Case (cosmetic pencils that badges unlock)

## How it works

- `src/sim/` is a pure, deterministic Verlet simulation (fixed step, seeded RNG, no DOM). Creatures read the geometry of the strokes (line, loop, zigzag, scribble, and where the ends sit) into a body plan. Velocity servos drive what they intend; everything that follows is real physics.
- `src/render/` draws the world on a canvas. `src/ui/` is the DOM shell layered on top.
- Tuning numbers live in `src/tuning.ts`.
- Design, physics, level, look-and-feel and audio specs are in `docs/`. Decisions are logged in `DECISIONS.md`.

## Checks

| Command | What it does |
|---|---|
| `npm test` | unit tests |
| `npm run verify` | headless level validation, determinism, monkey and performance checks |
| `npm run metrics` | regenerates `LEVEL_METRICS.md` |
| `npm run shots` | Playwright screenshots and frame strips into `review/` |

## Credits

See `CREDITS.md` for audio and font sources and licenses.
