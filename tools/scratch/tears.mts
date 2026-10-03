import { World } from '../../src/sim/world';
import { randomCreature, rngFor } from '../../src/sim/monkey';
import { spawn, run } from '../measure';
for (let k = 0; k < 100; k++) {
  const r = rngFor(1000 + k);
  const w = new World({ seed: k });
  const strokes = randomCreature(r, 200 + r() * 320, 500 + r() * 500);
  const crs = spawn(w, strokes);
  for (let s = 0; s < 5; s++) { w.toyTarget = { x: 40 + r() * 640, y: 200 + r() * 980 }; run(w, 2); }
  if (w.totalTears) { console.log('k', k, 'tears', w.totalTears, crs.map(c=>c.name+' '+c.ids.length).join(','), w.events.filter(e=>e.type==='tear').map(e=>`${e.t.toFixed(2)} ${e.text} @${e.x?.toFixed(0)},${e.y?.toFixed(0)}`).join(' | ')); console.log(JSON.stringify(strokes.map(s=>s.length))); }
}
