# Spike (throwaway reference)

A prototype of about 350 lines, written to test Drew's riskiest claim before committing to it: can arbitrary drawings become creatures whose movement reads as intent, and do different bodies produce different outcomes?

- `sim.js`: Verlet creatures built from strokes, with welds, loop-as-head, hand and foot classification, shape matching with an upright bias, velocity-servo locomotion and reach clamped to the limb envelope, grab and throw, bombs on a height-field ground.
- `render.js` and `test.html`: a minimal renderer and scenarios (`bombs`, `bowl`, `walk`) built from six canonical drawings (roof, hero, worm, spider, box, giant).
- `drive.py`: a Playwright driver that runs a scenario per drawing and saves a contact sheet. For example: `python3 drive.py bowl roof,hero,worm,spider,giant 0,1,2,3,4,5 '{}' out.png`
- `evidence.png`: the bombs-in-a-bowl run.

What it proved and where it failed is written up once, in `docs/physics.md` §11. Take numbers and lessons from it. Don't take its architecture: there's no brain module, no terrain polygons, no foot planting, and almost no tests.
