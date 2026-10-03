import { World } from '../../src/sim/world';
import { CANON } from '../../src/sim/canon';
import { spawn, run } from '../measure';
const w = new World({ seed: 3 });
const xs = [100, 250, 400, 550, 640, 180, 470]; let i = 0;
while (w.P.alive < 880 && i < 20) { spawn(w, CANON[['stick1100', 'spider', 'giant', 'bruiser', 'reacher'][i % 5]](xs[i % xs.length])); i++; }
w.toyTarget = { x: 600, y: 600 }; run(w, 0.5);
const proto = Object.getPrototypeOf(w);
const T: Record<string, number> = {};
for (const k of ['solveConstraints','shapeMatch','collideParticles','collideBodies','collideTerrain','contactFriction','checkTears','integrate','buildHash','cleanup']) {
  const f = proto[k]; T[k]=0;
  (w as any)[k] = function(...a: any[]) { const t0 = performance.now(); const r = f.apply(this, a); T[k] += performance.now()-t0; return r; };
}
const t0 = performance.now(); run(w, 10); const tot = performance.now()-t0;
console.log('per step ms', (tot/600).toFixed(3)); for (const k in T) console.log(k.padEnd(18), (T[k]/600).toFixed(3));
