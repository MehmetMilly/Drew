// Synthetic classifier fixtures: procedural strokes with hand-like noise, speed
// variation and sloppy closures (physics.md §3, until real finger fixtures exist).

import { mulberry32, Rng } from '../../src/sim/rng';
import type { Pt } from '../../src/sim/geom';
import type { MarkKind } from '../../src/sim/classify';

export interface Fixture {
  name: string;
  label: MarkKind[]; // sorted unique set of significant mark kinds
  pts: Pt[];
}

type Curve = (t: number) => Pt;

/** Sample a curve with uneven speed and hand wobble. */
function hand(r: Rng, c: Curve, approxLen: number, wobble = 1.6): Pt[] {
  const pts: Pt[] = [];
  const n = Math.max(8, Math.round(approxLen / (2 + r() * 3)));
  const ph1 = r() * 6.28,
    ph2 = r() * 6.28;
  const f1 = 1 + r() * 2,
    f2 = 4 + r() * 5;
  const accel = 0.3 + r() * 0.6;
  for (let i = 0; i <= n; i++) {
    let t = i / n;
    // ease in/out: slow at the ends like a real hand
    t = t + accel * (Math.sin(2 * Math.PI * t) / (2 * Math.PI)) * -1;
    t = Math.min(1, Math.max(0, t));
    const p = c(t);
    const q = c(Math.min(1, t + 0.002));
    let nx = -(q.y - p.y),
      ny = q.x - p.x;
    const L = Math.hypot(nx, ny) || 1;
    nx /= L;
    ny /= L;
    const w = wobble * (Math.sin(f1 * 6.28 * t + ph1) + 0.4 * Math.sin(f2 * 6.28 * t + ph2));
    pts.push({ x: p.x + nx * w + (r() - 0.5) * 0.8, y: p.y + ny * w + (r() - 0.5) * 0.8 });
  }
  return pts;
}

const poly = (vs: Pt[]): Curve => {
  const seg: number[] = [0];
  for (let i = 1; i < vs.length; i++) seg.push(seg[i - 1] + Math.hypot(vs[i].x - vs[i - 1].x, vs[i].y - vs[i - 1].y));
  const L = seg[seg.length - 1];
  return (t) => {
    const s = t * L;
    let i = 1;
    while (i < vs.length - 1 && seg[i] < s) i++;
    const u = (s - seg[i - 1]) / (seg[i] - seg[i - 1] || 1);
    return { x: vs[i - 1].x + (vs[i].x - vs[i - 1].x) * u, y: vs[i - 1].y + (vs[i].y - vs[i - 1].y) * u };
  };
};
const lenOf = (vs: Pt[]) => vs.reduce((s, v, i) => (i ? s + Math.hypot(v.x - vs[i - 1].x, v.y - vs[i - 1].y) : 0), 0);

function line(r: Rng): Fixture {
  const L = 40 + r() * 360,
    a = r() * 6.28;
  const x0 = 360,
    y0 = 600;
  const bend = (r() - 0.5) * 0.6 * L;
  const c: Curve = (t) => ({
    x: x0 + Math.cos(a) * L * t - Math.sin(a) * bend * Math.sin(Math.PI * t),
    y: y0 + Math.sin(a) * L * t + Math.cos(a) * bend * Math.sin(Math.PI * t),
  });
  return { name: 'line', label: ['line'], pts: hand(r, c, L) };
}
function arc(r: Rng): Fixture {
  const R = 50 + r() * 120,
    sweep = Math.PI * (0.6 + r() * 0.75);
  const a0 = Math.PI + (Math.PI - sweep) / 2;
  const c: Curve = (t) => ({ x: 360 + R * Math.cos(a0 + sweep * t), y: 600 + R * Math.sin(a0 + sweep * t) });
  return { name: 'arc', label: ['line'], pts: hand(r, c, R * sweep) };
}
function sCurve(r: Rng): Fixture {
  const L = 120 + r() * 200,
    A = 20 + r() * 40;
  const c: Curve = (t) => ({ x: 200 + L * t, y: 600 + A * Math.sin(2 * Math.PI * t) });
  return { name: 's-curve', label: ['line'], pts: hand(r, c, L * 1.2) };
}
function corner(r: Rng): Fixture {
  // L, V or an open "U" (bent lines are still lines)
  const k = Math.floor(r() * 3);
  const s = 60 + r() * 140;
  const vs =
    k === 0
      ? [{ x: 300, y: 500 }, { x: 300, y: 500 + s }, { x: 300 + s * 0.8, y: 500 + s }]
      : k === 1
        ? [{ x: 300, y: 500 }, { x: 300 + s / 2, y: 500 + s }, { x: 300 + s, y: 500 }]
        : [{ x: 300, y: 500 }, { x: 300, y: 500 + s }, { x: 300 + s, y: 500 + s }, { x: 300 + s, y: 500 }];
  return { name: 'corner', label: ['line'], pts: hand(r, poly(vs), lenOf(vs)) };
}
function loop(r: Rng): Fixture {
  const rx = 18 + r() * 70,
    ry = rx * (0.6 + r() * 0.8);
  const gap = (r() - 0.35) * 0.18; // negative = overshoot past the start, positive = sloppy gap
  const a0 = r() * 6.28,
    dir = r() < 0.5 ? 1 : -1;
  const sweep = 2 * Math.PI * (1 - gap);
  const c: Curve = (t) => ({ x: 360 + rx * Math.cos(a0 + dir * sweep * t), y: 600 + ry * Math.sin(a0 + dir * sweep * t) });
  return { name: 'loop', label: ['loop'], pts: hand(r, c, Math.PI * (rx + ry) * (1 - gap), 1.2) };
}
function box(r: Rng): Fixture {
  const w = 40 + r() * 120,
    h = 40 + r() * 120;
  const g = r() * 12;
  const vs = [
    { x: 300, y: 500 },
    { x: 300 + w, y: 500 },
    { x: 300 + w, y: 500 + h },
    { x: 300, y: 500 + h },
    { x: 300 + g, y: 500 + g * 0.5 },
  ];
  return { name: 'box', label: ['loop'], pts: hand(r, poly(vs), lenOf(vs), 1) };
}
function lollipop(r: Rng): Fixture {
  // a stick ending in a head drawn in one go (crosses itself)
  const R = 22 + r() * 30,
    L = 60 + r() * 120;
  const vs: Pt[] = [];
  for (let i = 0; i <= 10; i++) vs.push({ x: 360, y: 700 - (L * i) / 10 });
  for (let i = 0; i <= 40; i++) {
    const a = Math.PI / 2 + (i / 40) * 2 * Math.PI * 1.08;
    vs.push({ x: 360 + R * Math.cos(a), y: 700 - L - R + R * Math.sin(a) });
  }
  return { name: 'lollipop', label: ['line', 'loop'], pts: hand(r, poly(vs), lenOf(vs), 0.8) };
}
function zigzag(r: Rng): Fixture {
  const teeth = 4 + Math.floor(r() * 5),
    amp = 8 + r() * 11,
    step = 6 + r() * 8;
  const lead = r() < 0.5 ? 30 + r() * 80 : 0,
    trail = r() < 0.5 ? 30 + r() * 80 : 0;
  const vs: Pt[] = [{ x: 360, y: 400 }];
  let y = 400 + lead;
  vs.push({ x: 360, y });
  for (let i = 0; i < teeth; i++) {
    y += step;
    vs.push({ x: 360 + (i % 2 ? -amp : amp), y });
  }
  y += step;
  vs.push({ x: 360, y });
  if (trail) vs.push({ x: 360, y: y + trail });
  const label: MarkKind[] = lead > 20 || trail > 20 ? ['line', 'zigzag'] : ['zigzag'];
  return { name: 'zigzag', label, pts: hand(r, poly(vs), lenOf(vs), 0.5) };
}
function scribbleVerts(r: Rng, cx: number, cy: number, R: number): Pt[] {
  const vs: Pt[] = [];
  if (r() < 0.5) {
    // chaotic chords, dense like a real scribble
    const n = Math.max(12, Math.round(R * (0.45 + r() * 0.35)));
    for (let i = 0; i < n; i++) {
      const a = r() * 6.28;
      const rr = R * (0.45 + r() * 0.55);
      vs.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * (0.7 + r() * 0.3) });
    }
  } else {
    // back-and-forth shading that drifts across the blob
    const n = Math.max(12, Math.round(R * (0.35 + r() * 0.3)));
    const tilt = r() * 3.14;
    for (let i = 0; i < n; i++) {
      const u = (i / n) * 2 - 1;
      const across = Math.sqrt(Math.max(0.05, 1 - u * u)) * R * (i % 2 ? 1 : -1) * (0.8 + r() * 0.2);
      const along = u * R * 0.9 + (r() - 0.5) * 6;
      vs.push({ x: cx + Math.cos(tilt) * along - Math.sin(tilt) * across, y: cy + Math.sin(tilt) * along + Math.cos(tilt) * across });
    }
  }
  return vs;
}
function scribble(r: Rng): Fixture {
  const vs = scribbleVerts(r, 360, 600, 22 + r() * 40);
  return { name: 'scribble', label: ['scribble'], pts: hand(r, poly(vs), lenOf(vs), 0.6) };
}
function fist(r: Rng): Fixture {
  // an arm ending in a scribbled lump
  const L = 80 + r() * 120,
    R = 18 + r() * 16;
  const vs: Pt[] = [{ x: 200, y: 600 }, { x: 200 + L, y: 600 - L * 0.2 }];
  vs.push(...scribbleVerts(r, 200 + L + R * 0.8, 600 - L * 0.2, R));
  return { name: 'fist', label: ['line', 'scribble'], pts: hand(r, poly(vs), lenOf(vs), 0.6) };
}

const GENS = [line, arc, sCurve, corner, loop, box, lollipop, zigzag, scribble, fist];

export function generateFixtures(seed: number, perKind: number): Fixture[] {
  const r = mulberry32(seed);
  const out: Fixture[] = [];
  for (const g of GENS) for (let i = 0; i < perKind; i++) out.push(g(r));
  return out;
}
