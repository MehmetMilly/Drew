// npm-less usage: npx tsx tools/qa/run.ts [--quick] [--only=substr] [--seeds=N]
// Runs every level/mode x drawing flavor x seed, twice (determinism), writes repros to review/qa/.
import { mkdirSync, writeFileSync } from 'node:fs';
import { ALL_LEVELS } from '../../src/levels';
import { OPPONENTS } from '../../src/levels/sumo';
import { ARENAS, MODIFIERS } from '../../src/levels/daily';
import { FLAVORS, genBirths, makeLevel, mulberry32, randomFoe, runScenario, type Op, type Scenario } from './lib';
import { randomCreature } from '../../src/sim/monkey';

const args = process.argv.slice(2);
const quick = args.includes('--quick');
const only = args.find((a) => a.startsWith('--only='))?.slice(7);
const seeds = Number(args.find((a) => a.startsWith('--seeds='))?.slice(8) ?? (quick ? 1 : 3));
const OUT = 'review/qa';
mkdirSync(OUT, { recursive: true });

const scenarios: Scenario[] = [];
const mk = (level: string, flavor: string, seed: number, extra: Partial<Scenario> = {}) => {
  const sc: Scenario = { level, seed, drawing: flavor, births: [], duration: 40, ...extra };
  const def = makeLevel(sc);
  const r = mulberry32(seed * 7919 + flavor.length * 31 + level.length);
  if (flavor !== 'doodle-ops') sc.births = genBirths(def, r, flavor as any);
  const last = Math.max(0, ...sc.births.map((b) => b.t));
  sc.duration = last + (def.goal.type === 'boss' ? 100 : def.goal.type === 'sumo' ? 45 : 35);
  return sc;
};

for (let s = 1; s <= seeds; s++) {
  for (const l of ALL_LEVELS) for (const f of FLAVORS) scenarios.push(mk('L:' + l.id, f, s));
  for (let k = 0; k < OPPONENTS.length; k++) for (const f of FLAVORS) scenarios.push(mk('sumo:' + k, f, s));
  // pass-and-play: random drawing as the foe
  for (const f of FLAVORS) {
    const foe = randomFoe(mulberry32(s * 101));
    scenarios.push(mk('versus', f, s, { foe }));
  }
  for (const a of ARENAS) for (const m of MODIFIERS) {
    if (a.no?.includes(m.id)) continue;
    for (const f of ['scribble', 'huge', 'graft', 'ref', 'every-phase'] as const) scenarios.push(mk(`daily:${a.name}:${m.id}`, f, s));
  }
  // Doodle: random drops/toggles on a running world with random creatures
  const kinds = ['boulder', 'bomb', 'ball', 'sumo', 'ninja', 'smudger', 'scissors'] as const;
  for (const f of ['scribble', 'tiny-swarm', 'graft', 'huge'] as const) {
    const sc = mk('doodle', f, s);
    const r = mulberry32(s * 31 + 5);
    const ops: Op[] = [];
    for (let t = 0.5; t < 50; t += 0.3 + r() * 1.2) {
      const q = r();
      if (q < 0.6) ops.push({ t, op: 'drop', kind: kinds[Math.floor(r() * kinds.length)] });
      else ops.push({ t, op: (['water', 'wind', 'moon'] as const)[Math.floor(r() * 3)], on: r() < 0.55 });
    }
    sc.ops = ops;
    sc.births.push({ t: 4, strokes: randomCreature(r, 300, 700) }, { t: 15, strokes: randomCreature(r, 400, 600) });
    sc.duration = 60;
    scenarios.push(sc);
  }
}

const sel = only ? scenarios.filter((s) => s.level.includes(only)) : scenarios;
console.log(`${sel.length} scenarios`);
const seen = new Map<string, { n: number; file: string; sev: string; where: string; detail: string }>();
let nonDet = 0, maxMeanMs = 0, maxMs = 0, maxV = 0, n = 0;
const outcomes: Record<string, number> = {};
const t0 = Date.now();
for (const sc of sel) {
  const a = runScenario(sc);
  const b = runScenario(sc);
  const fs = [...a.findings];
  if (a.hash !== b.hash || a.result !== b.result) fs.push({ kind: 'nondeterministic', sev: 'high', detail: `hash ${a.hash} vs ${b.hash}, result ${a.result} vs ${b.result}`, t: a.endT });
  if (a.meanMs > 6) fs.push({ kind: 'slow-step', sev: 'med', detail: `mean ${a.meanMs.toFixed(1)} ms/step (16.7 budget)`, t: 0 });
  if (a.maxMs > 80) fs.push({ kind: 'step-spike', sev: 'low', detail: `max step ${a.maxMs.toFixed(0)} ms`, t: 0 });
  n++;
  maxMeanMs = Math.max(maxMeanMs, a.meanMs); maxMs = Math.max(maxMs, a.maxMs); maxV = Math.max(maxV, a.maxV);
  const key0 = sc.level.split(':').slice(0, 2).join(':') + ' ' + a.result;
  outcomes[key0] = (outcomes[key0] ?? 0) + 1;
  if (a.hash !== b.hash) nonDet++;
  for (const f of fs) {
    const where = sc.level.startsWith('L:') || sc.level.startsWith('sumo') ? sc.level : sc.level.startsWith('daily') ? sc.level : sc.level;
    const key = `${f.kind}|${where}|${sc.drawing}`;
    const hit = seen.get(key);
    if (hit) { hit.n++; continue; }
    const file = `${OUT}/${f.kind}__${where.replace(/[:]/g, '-')}__${sc.drawing}__s${sc.seed}.json`;
    writeFileSync(file, JSON.stringify({ finding: f, scenario: sc }));
    seen.set(key, { n: 1, file, sev: f.sev, where: `${where} / ${sc.drawing}`, detail: f.detail });
  }
  if (n % 100 === 0) process.stdout.write(`  ${n}/${sel.length} ${((Date.now() - t0) / 1000).toFixed(0)}s\n`);
}
console.log(`\ndone ${n} scenarios in ${((Date.now() - t0) / 1000).toFixed(0)}s; nondeterministic ${nonDet}; worst mean step ${maxMeanMs.toFixed(2)} ms, worst step ${maxMs.toFixed(0)} ms, max v ${maxV.toFixed(0)}`);
writeFileSync(`${OUT}/summary.json`, JSON.stringify({ findings: [...seen.values()], outcomes, n, nonDet }, null, 1));
const sevRank: Record<string, number> = { high: 0, med: 1, low: 2 };
const rows = [...seen.entries()].sort((x, y) => sevRank[x[1].sev] - sevRank[y[1].sev]);
for (const [k, v] of rows) console.log(`${v.sev.padEnd(4)} x${String(v.n).padEnd(3)} ${k.split('|')[0].padEnd(22)} ${v.where.padEnd(40)} ${v.detail.slice(0, 140)}`);
