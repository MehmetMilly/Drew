// QA monkey harness: scenarios, runner with invariant checks, drawing generators.
// A Scenario is fully explicit (strokes included) so a saved repro replays exactly,
// whatever the generators do later.
import { World } from '../../src/sim/world';
import { startLevel, type LevelDef } from '../../src/sim/level';
import { dropHazard, setLowGravity, setWater, setWind, type Drop } from '../../src/sim/doodle';
import { PF } from '../../src/sim/store';
import { WORLD } from '../../src/tuning';
import { guyCentre } from '../../src/sim/littleguy';
import { mulberry32, type Rng } from '../../src/sim/rng';
import { randomCreature, randomStroke } from '../../src/sim/monkey';
import { arc, circle, line, scrawl, scribbleBlob, springLine, poly } from '../../src/sim/canon';
import type { Pt } from '../../src/sim/geom';
import { ALL_LEVELS } from '../../src/levels';
import { sumoLevel, RING } from '../../src/levels/sumo';
import { ARENAS, MODIFIERS } from '../../src/levels/daily';
import type { Modifier } from '../../src/sim/daily';

export interface Birth { t: number; strokes: Pt[][] }
export interface Op { t: number; op: 'drop' | 'water' | 'wind' | 'moon'; kind?: Drop; on?: boolean }
export interface Scenario {
  /** 'L:1-1' | 'sumo:3' | 'versus' | 'daily:Ledge:no-heads' | 'doodle' */
  level: string;
  seed: number;
  drawing: string;
  foe?: Pt[][];
  births: Birth[];
  ops?: Op[];
  duration: number;
}
export interface Finding { kind: string; sev: 'high' | 'med' | 'low'; detail: string; t: number }
export interface Result {
  findings: Finding[];
  hash: number;
  result: string;
  cause: string;
  endT: number;
  maxV: number;
  meanMs: number;
  maxMs: number;
  inkUsed: number;
  ink: number;
  tears: number;
}

export function makeLevel(sc: Scenario): LevelDef {
  const [kind, a, b] = sc.level.split(':');
  if (kind === 'L') {
    const d = ALL_LEVELS.find((l) => l.id === a);
    if (!d) throw new Error('no level ' + a);
    return d;
  }
  if (kind === 'sumo') return sumoLevel(Number(a));
  if (kind === 'versus')
    return { ...sumoLevel(0), id: 'versus-x', title: 'Round 1', hint: undefined, casual: true, goal: { type: 'sumo', seconds: 12, ring: RING, foe: sc.foe ?? [], name: 'Player 1' } };
  if (kind === 'daily') {
    const ar = ARENAS.find((x) => x.name === a)!;
    const m = MODIFIERS.find((x) => x.id === b)!;
    return { ...ar.level, id: 'daily-qa', title: `${ar.name}: ${m.name}`, hint: undefined, mod: m.id, ink: m.id === 'half-ink' ? ar.level.ink * 0.5 : ar.level.ink };
  }
  if (kind === 'doodle')
    return { id: 'doodle', title: 'Doodle Pad', paper: 'cream', goal: { type: 'free' }, draw: 0.1, ink: 1e9, terrain: [], entities: [], guy: { x: 360, y: WORLD.floorY }, anatomyMatters: false, refs: [], casual: true };
  throw new Error('bad level ' + sc.level);
}

const timed = (strokes: Pt[][]) =>
  strokes.map((s) => {
    let t = 0;
    return s.map((p, i) => {
      if (i) t += Math.hypot(p.x - s[i - 1].x, p.y - s[i - 1].y) / 900;
      return { x: p.x, y: p.y, t, p: 0.5 };
    });
  });
const inkOf = (strokes: Pt[][]) => strokes.reduce((a, s) => a + s.reduce((b, p, i) => (i ? b + Math.hypot(p.x - s[i - 1].x, p.y - s[i - 1].y) : 0), 0), 0);

const H = WORLD.dt / WORLD.substeps;

export function runScenario(sc: Scenario, opts: { trace?: number[] } = {}): Result {
  const def = makeLevel(sc);
  const findings: Finding[] = [];
  const add = (kind: string, sev: Finding['sev'], detail: string, t: number) => {
    if (!findings.some((f) => f.kind === kind)) findings.push({ kind, sev, detail, t });
  };
  const w = new World({ seed: sc.seed });
  let ms = 0, maxMs = 0, maxV = 0, inkUsed = 0;
  let births = [...sc.births].sort((a, b) => a.t - b.t);
  let ops = [...(sc.ops ?? [])].sort((a, b) => a.t - b.t);
  const offSince = new Map<string, number>();
  const hist: { t: number; pos: number[] }[] = [];
  const hasHazard = !!(def.entities.length || def.props?.length || def.goal.type === 'sumo' || def.goal.type === 'boss');
  let hazardDropped = false;
  let seenTears = 0;
  let steps = 0;
  try {
    startLevel(w, def);
    const nSteps = Math.round(sc.duration * 60);
    for (; steps < nSteps; steps++) {
      while (births.length && births[0].t <= w.t + 1e-9) {
        const b = births.shift()!;
        let st = b.strokes;
        if (def.mod === 'one-stroke' && inkUsed > 0) continue; // the toy lifts the pencil for good
        if (def.mod === 'one-stroke') st = st.slice(0, 1);
        inkUsed += inkOf(st);
        w.addStrokes(timed(st));
      }
      while (ops.length && ops[0].t <= w.t + 1e-9) {
        const o = ops.shift()!;
        if (o.op === 'drop') (dropHazard(w, o.kind!), (hazardDropped = true));
        else if (o.op === 'water') setWater(w, !!o.on);
        else if (o.op === 'wind') setWind(w, !!o.on);
        else setLowGravity(w, !!o.on);
      }
      const t0 = performance.now();
      w.step();
      const dt = performance.now() - t0;
      ms += dt;
      if (dt > maxMs) maxMs = dt;
      if (opts.trace && steps % 30 === 0) opts.trace.push(w.hash());
      const t = w.t;
      // ---- per-particle: NaN, speed
      const P = w.P;
      let nan = false;
      for (let i = 0; i < P.n; i++) {
        if (!(P.flags[i] & PF.ALIVE)) continue;
        const x = P.x[i], y = P.y[i];
        if (!isFinite(x) || !isFinite(y) || Math.abs(x) > 1e6 || Math.abs(y) > 1e6) { nan = true; break; }
        const v = Math.hypot(x - P.px[i], y - P.py[i]) / H;
        if (v > maxV) maxV = v;
      }
      if (nan || w.nanSeen) add('nan', 'high', 'non-finite or absurd particle position', t);
      for (const b of w.bodies) if (b.alive && (!isFinite(b.x) || !isFinite(b.y))) add('nan-body', 'high', `body ${b.kind} non-finite`, t);
      if (maxV > WORLD.maxSpeed * 1.05) add('runaway', 'high', `particle speed ${maxV.toFixed(0)} px/s > cap ${WORLD.maxSpeed}`, t);
      // ---- tears
      if (w.totalTears > seenTears) {
        const evs = w.events.filter((e) => e.type === 'tear' && e.t >= t - 0.1);
        for (const e of evs) {
          const near = w.bodies.some((b) => b.alive && b.data.threat && Math.hypot(b.x - e.x!, b.y - e.y!) < 300);
          const foeCr = w.creatures.some((c) => c.alive && c.team === 1);
          const props = !!w.props && (w.props.dmg || w.props.defs.length > 0 || w.props.pools.length > 0);
          if (!hasHazard && !hazardDropped && !props && !def.mod) add('tear-no-hazard', 'med', `tear ${e.text} at (${e.x!.toFixed(0)},${e.y!.toFixed(0)}) in a level with no hazard`, t);
          else if (!near && !foeCr && !w.props?.dmg && !String(e.text).startsWith('blast')) add('tear-far-from-hazard', 'low', `tear ${e.text} at (${e.x!.toFixed(0)},${e.y!.toFixed(0)}), no threat within 300 px`, t);
        }
        seenTears = w.totalTears;
      }
      // ---- off-page persistence, every 6 steps
      if (steps % 6 === 0) {
        const seen = new Set<string>();
        for (const cr of w.creatures) {
          if (!cr.alive) continue;
          const c = w.centroid(cr);
          const k = 'c' + cr.id;
          if (c.x < -200 || c.x > WORLD.W + 200 || c.y < -700) {
            seen.add(k);
            if (!offSince.has(k)) offSince.set(k, t);
            else if (t - offSince.get(k)! > 6) add('off-page-creature', 'med', `creature ${cr.id} (${cr.kind}) off page at (${c.x.toFixed(0)},${c.y.toFixed(0)}) for >6 s`, t);
          }
        }
        for (const b of w.bodies) {
          if (!b.alive) continue;
          const k = 'b' + b.id;
          if (b.x < -300 || b.x > WORLD.W + 300 || b.y < -900) {
            seen.add(k);
            if (!offSince.has(k)) offSince.set(k, t);
            else if (t - offSince.get(k)! > 6) add(b.data.threat ? 'off-page-threat' : 'off-page-body', b.data.threat ? 'med' : 'low', `${b.kind} body at (${b.x.toFixed(0)},${b.y.toFixed(0)}) for >6 s`, t);
          }
        }
        if (w.guy?.alive) {
          const g = guyCentre(w, w.guy);
          const k = 'guy';
          if (g.x < -200 || g.x > WORLD.W + 200 || g.y < -700) {
            seen.add(k);
            if (!offSince.has(k)) offSince.set(k, t);
            else if (t - offSince.get(k)! > 6) add('off-page-guy', 'high', `Little Guy off page at (${g.x.toFixed(0)},${g.y.toFixed(0)}) for >6 s while alive`, t);
          }
        }
        for (const k of [...offSince.keys()]) if (!seen.has(k)) offSince.delete(k);
      }
      // ---- progress sampler (every 0.5 s)
      if (steps % 30 === 0) {
        const pos: number[] = [];
        for (const cr of w.creatures) if (cr.alive) { const c = w.centroid(cr); pos.push(c.x, c.y); }
        if (w.guy?.alive) { const g = guyCentre(w, w.guy); pos.push(g.x, g.y); }
        for (const b of w.bodies) if (b.alive && b.data.threat) pos.push(b.x, b.y);
        hist.push({ t, pos });
      }
      if (w.level!.result !== 'play' && t - w.level!.resultAt > 3) break; // ended: let the end settle 3 s
    }
  } catch (e: any) {
    add('exception', 'high', String(e?.stack ?? e).split('\n').slice(0, 4).join(' | '), w.t);
  }
  const L = w.level;
  const res = L?.result ?? 'none';
  if (res === 'play') {
    // softlock analysis: did anything move during the last 5 s?
    const end = hist[hist.length - 1], ref = hist.find((h) => h.t >= (end?.t ?? 0) - 5);
    let move = 0;
    if (end && ref && end.pos.length === ref.pos.length) for (let i = 0; i < end.pos.length; i++) move += Math.abs(end.pos[i] - ref.pos[i]);
    const g = def.goal.type;
    const timed_ = g === 'save' || g === 'score' || (g === 'sumo');
    const frozen = move < 12;
    const inkLeft = inkUsed < def.ink * 0.9;
    if (timed_ && g !== 'sumo') add('timer-never-ended', 'high', `${g} goal still 'play' after ${w.t.toFixed(0)} s`, w.t);
    else if (g === 'sumo') add(frozen ? 'sumo-frozen-stall' : 'sumo-no-result', frozen ? 'high' : 'med', `sumo still 'play' at ${w.t.toFixed(0)} s (moved ${move.toFixed(0)} px in last 5 s)`, w.t);
    else if (g !== 'free') add(frozen ? (inkLeft ? 'stall-frozen' : 'softlock-no-ink') : 'no-end', frozen ? (inkLeft ? 'low' : 'high') : 'low', `${g} still 'play' at ${w.t.toFixed(0)} s, moved ${move.toFixed(0)} px in last 5 s, ink ${inkUsed.toFixed(0)}/${def.ink}`, w.t);
  }
  const hash = w.hash();
  return { findings, hash, result: res, cause: L?.cause ?? '', endT: w.t, maxV, meanMs: ms / Math.max(1, steps), maxMs, inkUsed, ink: def.ink, tears: w.totalTears };
}

// ------------------------------------------------------------------ generators

const clampPt = (p: Pt): Pt => ({ x: Math.max(2, Math.min(WORLD.W - 2, p.x)), y: Math.max(2, Math.min(WORLD.H - 2, p.y)) });
const clampS = (ss: Pt[][]) => ss.map((s) => s.map(clampPt));
/** Trim strokes so their total length stays within `budget` (the toy's pencil runs out). */
function trimInk(ss: Pt[][], budget: number): Pt[][] {
  const out: Pt[][] = [];
  let used = 0;
  for (const s of ss) {
    const o: Pt[] = [];
    for (let i = 0; i < s.length; i++) {
      if (i) used += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
      if (used > budget) break;
      o.push(s[i]);
    }
    if (o.length >= 2) out.push(o);
    if (used > budget) break;
  }
  return out;
}

export type Flavor = 'scribble' | 'huge' | 'huge-over' | 'tiny-swarm' | 'short-strokes' | 'in-terrain' | 'on-guy' | 'graft' | 'every-phase' | 'ref' | 'ref-late';
export const FLAVORS: Flavor[] = ['scribble', 'huge', 'huge-over', 'tiny-swarm', 'short-strokes', 'in-terrain', 'on-guy', 'graft', 'every-phase', 'ref', 'ref-late'];

export function genBirths(def: LevelDef, r: Rng, flavor: Flavor, extraInk = 1): Birth[] {
  const gx = def.guy.x, gy = def.guy.y;
  const budget = def.ink * extraInk;
  const anchor = () => (r() < 0.5 ? { x: gx + (r() - 0.5) * 300, y: gy - r() * 200 } : { x: 40 + r() * 640, y: 150 + r() * 1000 });
  const bs: Birth[] = [];
  switch (flavor) {
    case 'scribble': {
      const n = 1 + Math.floor(r() * 3);
      for (let i = 0; i < n; i++) { const a = anchor(); bs.push({ t: i === 0 ? 0 : r() * 12, strokes: randomCreature(r, a.x, a.y) }); }
      break;
    }
    case 'huge':
    case 'huge-over': {
      // one huge drawing: giant loops, long scrawls, a page-wide spring
      const a = anchor();
      const ss: Pt[][] = [
        circle(360, 640, 250 + r() * 100),
        scrawl(20, 1100 - r() * 100, 700, 1100 - r() * 100, 14, 60),
        springLine(40, 300, 680, 1150, 14, 40),
        scribbleBlob(a.x, a.y, 150, 60),
        line(10, 10, 710, 1180),
        arc(360, 1180, 330, Math.PI, 2 * Math.PI, 80),
      ];
      const k = flavor === 'huge' ? trimInk(clampS(ss), budget * 0.98) : clampS(ss); // huge-over ignores the budget
      bs.push({ t: r() * 3, strokes: k });
      break;
    }
    case 'tiny-swarm': {
      // many tiny creatures: little loops, ticks and blobs
      const n = 25 + Math.floor(r() * 30);
      const ss: Pt[][] = [];
      for (let i = 0; i < n; i++) {
        const x = 30 + r() * 660, y = 200 + r() * 980;
        const k = r();
        ss.push(k < 0.4 ? circle(x, y, 6 + r() * 8) : k < 0.7 ? line(x, y, x + 12 + r() * 20, y + (r() - 0.5) * 20) : scribbleBlob(x, y, 7 + r() * 6, 8));
      }
      bs.push({ t: r() * 2, strokes: trimInk(clampS(ss), budget) });
      break;
    }
    case 'short-strokes': {
      // hundreds of tiny strokes, 2-12 px, mostly a few px apart
      const ss: Pt[][] = [];
      const n = 200 + Math.floor(r() * 300);
      let x = 360 + (r() - 0.5) * 200, y = 900 + (r() - 0.5) * 200;
      for (let i = 0; i < n; i++) {
        if (r() < 0.2) { x = 40 + r() * 640; y = 300 + r() * 880; }
        const a = r() * 6.3, L = 2 + r() * 10;
        ss.push([{ x, y }, { x: x + Math.cos(a) * L, y: y + Math.sin(a) * L }]);
        x += Math.cos(a) * L * 0.8; y += Math.sin(a) * L * 0.8;
      }
      bs.push({ t: 0, strokes: trimInk(clampS(ss), budget) });
      break;
    }
    case 'in-terrain': {
      const T = def.terrain;
      const ss: Pt[][] = [];
      for (let i = 0; i < 4; i++) {
        const poly_ = T.length ? T[Math.floor(r() * T.length)] : [{ x: 300, y: 1190 }, { x: 420, y: 1190 }];
        const xs = poly_.map((p) => p.x), ys = poly_.map((p) => p.y);
        const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
        const cx = x0 + r() * (x1 - x0), cy = y0 + r() * Math.min(y1 - y0 + 1, 400);
        const k = r();
        // inside, straddling the surface, and along the top edge
        if (k < 0.3) ss.push(...randomCreature(r, cx, cy).slice(0, 2));
        else if (k < 0.6) ss.push(line(x0 - 40, y0 + 2, x1 + 40, y0 + 2));
        else if (k < 0.8) ss.push(circle(cx, y0, 30 + r() * 40));
        else ss.push(line(cx, y0 - 80, cx, y0 + 80));
      }
      // also a creature under the page floor
      ss.push(circle(200 + r() * 300, 1185, 25));
      bs.push({ t: r() * 2, strokes: trimInk(clampS(ss), budget) });
      break;
    }
    case 'on-guy': {
      const ss: Pt[][] = [circle(gx, gy - 40, 30 + r() * 20), line(gx - 60, gy - 40, gx + 60, gy - 40), ...randomCreature(r, gx, gy - 30)];
      bs.push({ t: r() * 4, strokes: trimInk(clampS(ss), budget) });
      break;
    }
    case 'graft': {
      // a creature, then more ink touching it at random later times (and some far from it)
      const a = anchor();
      const first = randomCreature(r, a.x, a.y);
      bs.push({ t: 0, strokes: first });
      const n = 2 + Math.floor(r() * 4);
      for (let i = 0; i < n; i++) {
        const s = first[Math.floor(r() * first.length)];
        const p = s[Math.floor(r() * s.length)];
        bs.push({ t: 0.5 + r() * 12, strokes: clampS([randomStroke(r, p.x, p.y, 40 + r() * 120)]) });
      }
      break;
    }
    case 'every-phase': {
      // a birth every ~half second for 30 s: during every phase of every hazard
      for (let t = 0; t < 30; t += 0.4 + r() * 0.6) { const a = anchor(); bs.push({ t, strokes: clampS([randomStroke(r, a.x, a.y, 60 + r() * 200)]) }); }
      break;
    }
    case 'ref':
    case 'ref-late': {
      const ref = def.refs[Math.floor(r() * Math.max(1, def.refs.length))];
      if (ref) bs.push({ t: flavor === 'ref' ? 0 : 1 + r() * 8, strokes: ref.strokes });
      break;
    }
  }
  return bs;
}

export function randomFoe(r: Rng): Pt[][] {
  // a "player 1" creature drawn on the left half then mirrored to the right as the shell does
  const s = randomCreature(r, 250, RING.y - 60);
  return s.map((st) => st.map((p) => ({ x: WORLD.W - p.x, y: Math.min(RING.y - 2, p.y) })));
}

export { mulberry32, poly };
