// npm run verify: headless checks; prints one table.
// Phase 1: classifier fixtures, determinism (Node ×3 + browser), no-noise tearing,
// monkey, distinct bodies, step time. Level rows join from Phase 3.
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { World } from '../src/sim/world';
import { WORLD } from '../src/tuning';
import { PF } from '../src/sim/store';
import { CANON, line } from '../src/sim/canon';
import { randomCreature, rngFor } from '../src/sim/monkey';
import { generateFixtures } from '../tests/fixtures/synth';
import { scoreFixtures } from './fixtures';
import { spawn, run, walkSpeed, reachHeight, jumpHeight } from './measure';
import { detScenario } from './detscenario';

const quick = process.argv.includes('--quick');
const skipBrowser = process.argv.includes('--no-browser');
type Row = { check: string; result: string; pass: boolean };
const rows: Row[] = [];
const add = (check: string, result: string, pass: boolean) => {
  rows.push({ check, result, pass });
  process.stdout.write(`  ${pass ? '✓' : '✗'} ${check}: ${result}\n`);
};

// ---- static: no Math.random / clock in src/sim
{
  const bad: string[] = [];
  for (const f of readdirSync('src/sim')) {
    const s = readFileSync(`src/sim/${f}`, 'utf8');
    if (/Math\.random|Date\.now|performance\.now|new Date\(/.test(s)) bad.push(f);
  }
  add('sim purity (no Math.random/clock)', bad.length ? bad.join(', ') : 'clean', !bad.length);
}

// ---- classifier
{
  const s = scoreFixtures(generateFixtures(1234, 30));
  add('classifier: synthetic fixtures', `${(s.rate * 100).toFixed(1)}% (${s.ok}/${s.n})`, s.rate >= 0.95);
  const dir = 'tests/fixtures/human';
  if (existsSync(dir)) {
    const fx = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')).strokes);
    if (fx.length) {
      const h = scoreFixtures(fx);
      add('classifier: human fixtures', `${(h.rate * 100).toFixed(1)}% (${h.ok}/${h.n})`, h.rate >= 0.95);
      if (h.rate < 0.95) console.log(h.table);
    }
    // multi-stroke drawings from the capture page should each be ONE creature
    const joins: { name: string; strokes: { x: number; y: number }[][] }[] = readdirSync(dir)
      .filter((f) => f.endsWith('.json'))
      .flatMap((f) => JSON.parse(readFileSync(`${dir}/${f}`, 'utf8')).joins ?? []);
    if (joins.length) {
      const split = joins.filter((j) => spawn(new World({ seed: 1 }), j.strokes).length !== 1);
      add('human sloppy joins → one creature', `${joins.length - split.length}/${joins.length}`, split.length === 0);
    }
  }
}

// ---- real strangers' strokes: Quick, Draw! regression corpus (CC BY 4.0)
{
  const { scoreQuickDraw, FLOOR } = await import('./quickdraw');
  const per = scoreQuickDraw();
  if (per) {
    const low = Object.entries(per).filter(([c, e]) => e.ok / e.n < FLOOR[c]);
    const txt = Object.entries(per)
      .map(([c, e]) => `${c} ${Math.round((100 * e.ok) / e.n)}%`)
      .join(', ');
    add('classifier: Quick, Draw! strokes (1000)', txt, !low.length);
  }
}

// ---- determinism (Node ×3)
const nodeHash = detScenario();
{
  const h2 = detScenario(),
    h3 = detScenario();
  add('determinism: Node ×3', `${nodeHash.toString(16)} ${h2 === nodeHash && h3 === nodeHash ? 'same' : 'DIFFERENT'}`, h2 === nodeHash && h3 === nodeHash);
}

// ---- no-noise tearing: 100 random creatures acting for 10 s
{
  let tears = 0,
    bad = 0;
  const N = quick ? 30 : 100;
  for (let k = 0; k < N; k++) {
    const r = rngFor(1000 + k);
    const w = new World({ seed: k });
    const strokes = randomCreature(r, 200 + r() * 320, 500 + r() * 500);
    spawn(w, strokes);
    for (let s = 0; s < 5; s++) {
      w.toyTarget = { x: 40 + r() * 640, y: 200 + r() * 980 };
      run(w, 2);
    }
    if (w.totalTears) bad++;
    tears += w.totalTears;
  }
  add(`no-noise tearing (${N} creatures × 10 s)`, `${tears} tears in ${bad} creatures`, tears === 0);
}

// ---- monkey: 300 random scribble sets
{
  const N = quick ? 60 : 300;
  let nan = 0,
    crash = 0,
    vmax = 0,
    left = 0;
  for (let k = 0; k < N; k++) {
    const r = rngFor(5000 + k);
    try {
      const w = new World({ seed: k });
      const sets = 1 + Math.floor(r() * 3);
      for (let s = 0; s < sets; s++) spawn(w, randomCreature(r, 60 + r() * 600, 100 + r() * 1000));
      for (let s = 0; s < 4; s++) {
        w.toyTarget = { x: r() * 720, y: r() * 1280 };
        run(w, 1, () => {
          const P = w.P;
          const h = WORLD.dt / WORLD.substeps;
          for (let i = 0; i < P.n; i++) {
            if (!(P.flags[i] & PF.ALIVE)) continue;
            const v = Math.hypot(P.x[i] - P.px[i], P.y[i] - P.py[i]) / h;
            if (!isFinite(v)) nan++;
            else if (v > vmax) vmax = v;
          }
        });
      }
      if (w.nanSeen) nan++;
      left += w.events.filter((e) => e.type === 'fell').length;
    } catch (e) {
      crash++;
      if (crash < 3) console.log(e);
    }
  }
  add(`monkey (${N} scribble sets)`, `crash ${crash}, NaN ${nan}, vmax ${vmax.toFixed(0)} px/s, fell off ${left}`, !crash && !nan && vmax <= WORLD.maxSpeed + 1);
}

// ---- anatomy read of the canonical bodies (catches snapping/weld regressions)
{
  const want: Record<string, string> = {
    stick400: '1:biped:walk:f2h2',
    stick700: '1:biped:walk:f2h2',
    stick1100: '1:biped:walk:f2h2',
    spider: '1:many-legged:scurry:f6h0',
    worm: '1:worm:inch:f0h1',
    box: '1:tiny:roll:f0h0',
    giant: '1:giant:walk:f2h2',
    hopper: '1:springy:hop:f2h0',
    reacher: '1:biped:walk:f2h2',
    bruiser: '1:heavy:walk:f2h2',
    floater: '1:floaty:walk:f2h0',
    roof: '1:headless:walk:f2h0',
  };
  const bad: string[] = [];
  for (const [n, exp] of Object.entries(want)) {
    const crs = spawn(new World({ seed: 1 }), CANON[n](360));
    const c = crs[0];
    const got = c ? `${crs.length}:${c.kind}:${c.gait}:f${c.limbs.filter((l) => l.foot).length}h${c.limbs.filter((l) => !l.foot).length}` : 'none';
    if (got !== exp) bad.push(`${n} ${got} (want ${exp})`);
  }
  add('anatomy: canonical bodies (kind, gait, feet, hands)', bad.length ? bad.join('; ') : `${Object.keys(want).length}/${Object.keys(want).length}`, !bad.length);
}

// ---- grafting: a line drawn onto a living box grows it an arm (one creature, announced)
{
  const w = new World({ seed: 1 });
  const [c] = spawn(w, CANON.box(300));
  run(w, 1.5);
  const ce = w.centroid(c);
  let right = -Infinity;
  for (const i of c.ids) right = Math.max(right, w.P.x[i]);
  const extra = spawn(w, [line(right - 2, ce.y, right + 90, ce.y - 40)]);
  const msg = w.events.find((e) => e.type === 'graft')?.text ?? 'none';
  const ok = extra.length === 0 && w.liveCreatures().length === 1 && c.limbs.some((l) => !l.foot);
  add('grafting: line onto a living box', `${w.liveCreatures().length} creature, "${msg}"`, ok);
}

// ---- distinct bodies
{
  const names = ['stick700', 'spider', 'worm', 'box', 'giant', 'hopper'];
  const m = names.map((n) => ({ n, walk: walkSpeed(n), reach: reachHeight(n), jump: jumpHeight(n) }));
  for (const x of m) console.log(`      ${x.n.padEnd(9)} walk ${x.walk.toFixed(0).padStart(4)} px/s  reach ${x.reach.toFixed(0).padStart(4)} px  jump ${x.jump.toFixed(0).padStart(4)} px`);
  const differ = (a: number, b: number) => Math.abs(a - b) / Math.max(Math.abs(a), Math.abs(b), 1e-6) >= 0.2;
  const same: string[] = [];
  for (let i = 0; i < m.length; i++)
    for (let j = i + 1; j < m.length; j++) {
      const A = m[i],
        B = m[j];
      if (!(differ(A.walk, B.walk) || differ(A.reach, B.reach) || differ(A.jump, B.jump))) same.push(`${A.n}~${B.n}`);
    }
  add('distinct bodies (each pair ≥20% on a metric)', same.length ? same.join(', ') : '15/15 pairs distinct', !same.length);
}

// ---- performance: 900 particles
{
  const w = new World({ seed: 3 });
  const xs = [100, 250, 400, 550, 640, 180, 470];
  let i = 0;
  while (w.P.alive < 880 && i < 20) {
    spawn(w, CANON[['stick1100', 'spider', 'giant', 'bruiser', 'reacher'][i % 5]](xs[i % xs.length]));
    i++;
  }
  w.toyTarget = { x: 600, y: 600 };
  run(w, 0.5);
  const n = 600;
  const t0 = performance.now();
  run(w, n * WORLD.dt);
  const ms = (performance.now() - t0) / n;
  add(`step time @ ${w.P.alive} particles (Node)`, `${ms.toFixed(2)} ms`, ms < 4);
}

// ---- determinism: browser vs Node
if (!skipBrowser) {
  const { browserHash } = await import('./browserhash');
  const bh = await browserHash();
  add('determinism: browser vs Node', `${bh.toString(16)} vs ${nodeHash.toString(16)}`, bh === nodeHash);
}

if (!skipBrowser) {
  const { browserPerf } = await import('./perfbrowser');
  const p = await browserPerf(4);
  add(`browser fps @ ${p.particles} particles, 4× CPU throttle`, `${p.fps.toFixed(1)} fps, p95 ${p.p95.toFixed(1)} ms`, p.fps >= 57 && p.p95 <= 17.5);
}

console.log('\n| check | result | pass |\n|---|---|---|');
for (const r of rows) console.log(`| ${r.check} | ${r.result} | ${r.pass ? 'PASS' : 'FAIL'} |`);
const ok = rows.every((r) => r.pass);
console.log(ok ? '\nALL GREEN' : '\nRED');
process.exit(ok ? 0 : 1);
