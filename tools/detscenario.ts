// A fixed scenario hashed for determinism checks (Node and browser run the same code).
import { World } from '../src/sim/world';
import { CANON } from '../src/sim/canon';
import { randomCreature, rngFor } from '../src/sim/monkey';

export function detScenario(trace?: number[]): number {
  const w = new World({ seed: 42 });
  const add = (s: { x: number; y: number }[][]) =>
    w.addStrokes(s.map((st) => st.map((p, i) => ({ x: p.x, y: p.y, t: i * 0.004, p: 0.5 }))));
  add(CANON.stick700(150));
  trace?.push(w.hash());
  add(CANON.hopper(400));
  trace?.push(w.hash());
  add(CANON.bruiser(580));
  trace?.push(w.hash());
  add(randomCreature(rngFor(9), 360, 600));
  trace?.push(w.hash());
  const targets = [
    { x: 600, y: 500 },
    { x: 100, y: 1100 },
    { x: 360, y: 200 },
  ];
  for (let k = 0; k < 360; k++) {
    if (k % 120 === 0) w.toyTarget = targets[k / 120];
    w.step();
    trace?.push(w.hash());
  }
  return w.hash();
}
