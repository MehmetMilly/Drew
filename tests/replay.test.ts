import { describe, it, expect } from 'vitest';
import { World } from '../src/sim/world';
import { startLevel } from '../src/sim/level';
import { CANON } from '../src/sim/canon';
import { L1_4 } from '../src/levels/ch1';
import { Replay, pickMoment, type Birth } from '../src/game/replay';

describe('replay', () => {
  it('re-runs a level attempt bit-identically and finds a moment', () => {
    const w = new World({ seed: 1 });
    startLevel(w, L1_4);
    const births: Birth[] = [];
    const bodies = [CANON.giant(360), CANON.stick700(200)];
    for (let k = 0; k < 900 && w.level!.result === 'play'; k++) {
      if (k === 37 || k === 211) {
        const strokes = bodies[births.length].map((s) => s.map((p, i) => ({ x: p.x, y: p.y, t: i * 0.01, p: 0.5 })));
        births.push({ step: w.steps, strokes });
        w.addStrokes(strokes);
      }
      w.step();
    }
    const r = new Replay(L1_4, births);
    while (!r.advance(w.steps, 50));
    expect(r.world.level!.result).toBe(w.level!.result);
    let a = 0,
      b = 0;
    for (let i = 0; i < w.P.n; i++) a += w.P.x[i] * (i + 1) + w.P.y[i];
    for (let i = 0; i < r.world.P.n; i++) b += r.world.P.x[i] * (i + 1) + r.world.P.y[i];
    expect(b).toBe(a);
    expect(pickMoment(w)).not.toBeNull();
  });
});
