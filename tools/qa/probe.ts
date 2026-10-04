// npx tsx tools/qa/probe.ts <repro.json> : prints the event log around the first off-page / fast moment.
import { readFileSync } from 'node:fs';
import { World } from '../../src/sim/world';
import { startLevel } from '../../src/sim/level';
import { makeLevel } from './lib';
const { scenario: sc } = JSON.parse(readFileSync(process.argv[2], 'utf8'));
const def = makeLevel(sc); const w = new World({ seed: sc.seed }); startLevel(w, def);
const births = [...sc.births].sort((a: any, b: any) => a.t - b.t);
const timed = (ss: any[]) => ss.map((s: any) => { let t = 0; return s.map((p: any, i: number) => { if (i) t += Math.hypot(p.x - s[i - 1].x, p.y - s[i - 1].y) / 900; return { ...p, t, p: 0.5 }; }); });
let shown = 0;
for (let k = 0; k < sc.duration * 60 && shown < 40; k++) {
  while (births.length && births[0].t <= w.t) w.addStrokes(timed(births.shift().strokes));
  w.step();
  for (const cr of w.creatures) { const c = w.centroid(cr); if (cr.alive && (c.y < -300 || c.x < -250 || c.x > 970)) { console.log(`t=${w.t.toFixed(2)} cr ${cr.id} ${cr.kind} at ${c.x.toFixed(0)},${c.y.toFixed(0)} guy.ride=${w.guy?.ride} heldBy=${w.guy?.heldBy}`); console.log(w.events.filter((e) => e.t > w.t - 1).map((e) => `${e.t.toFixed(2)} ${e.type} ${e.cr ?? ''} ${e.text ?? ''}`).join('\n')); shown = 99; break; }}
}
if (process.argv[3]) {
  const w2 = new World({ seed: sc.seed }); startLevel(w2, def);
  const b2 = [...sc.births].sort((a: any, b: any) => a.t - b.t);
  const id = Number(process.argv[3]);
  for (let k = 0; k < 60 * 20; k++) {
    while (b2.length && b2[0].t <= w2.t) w2.addStrokes(timed(b2.shift().strokes));
    w2.step();
    const cr = w2.creatures.find((c) => c.id === id);
    if (cr && k % 20 === 0 && w2.t > 7.2) { const c = w2.centroid(cr); const i = cr.ids[0]; console.log(`t=${w2.t.toFixed(2)} y=${c.y.toFixed(0)} vy=${((w2.P.y[i] - w2.P.py[i]) * 120).toFixed(0)} alive=${cr.alive} n=${cr.ids.length}`); }
  }
}
