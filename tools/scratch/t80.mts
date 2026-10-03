import { World } from '../../src/sim/world';
import { randomCreature, rngFor } from '../../src/sim/monkey';
import { spawn, run } from '../measure';
const k=80; const r = rngFor(1000 + k);
const w = new World({ seed: k });
const strokes = randomCreature(r, 200 + r() * 320, 500 + r() * 500);
const [cr] = spawn(w, strokes);
console.log(cr.springs.map(s=>({leg:s.leg, distal:s.distal.length, len0:s.len0.toFixed(0)})), cr.limbs.map(l=>({foot:l.foot,spring:l.spring,len:l.len.toFixed(0)})));
let last=0;
for (let s = 0; s < 5; s++) { w.toyTarget = { x: 40 + r() * 640, y: 200 + r() * 980 }; run(w, 2, ()=>{ for (const e of w.events.slice(last)) if (['jump','punch','tear'].includes(e.type)) console.log(e.t.toFixed(2), e.type, e.text??''); last=w.events.length; }); }
