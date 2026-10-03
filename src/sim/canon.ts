// Canonical drawings (levels.md §1, spike's six + the rest). Used by metrics,
// verify, tests and shots. Stroke data only; nothing here reads what they depict.
import type { Pt } from './geom';

export const GROUND_Y = 1140;
const G = GROUND_Y - 4;

export function arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 40): Pt[] {
  const p: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    p.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return p;
}
export const circle = (cx: number, cy: number, r: number) => arc(cx, cy, r, -Math.PI / 2, Math.PI * 1.5 - 0.05, 48);
export function line(x0: number, y0: number, x1: number, y1: number): Pt[] {
  const n = Math.max(2, Math.ceil(Math.hypot(x1 - x0, y1 - y0) / 4));
  const p: Pt[] = [];
  for (let i = 0; i <= n; i++) p.push({ x: x0 + ((x1 - x0) * i) / n, y: y0 + ((y1 - y0) * i) / n });
  return p;
}
export function poly(vs: Pt[]): Pt[] {
  const out: Pt[] = [];
  for (let i = 1; i < vs.length; i++) {
    const l = line(vs[i - 1].x, vs[i - 1].y, vs[i].x, vs[i].y);
    out.push(...(i === 1 ? l : l.slice(1)));
  }
  return out;
}
/** A leg that is a line with a zigzag spring in the middle. */
export function springLine(x0: number, y0: number, x1: number, y1: number, teeth = 6, amp = 12): Pt[] {
  const dx = x1 - x0,
    dy = y1 - y0;
  const L = Math.hypot(dx, dy);
  const ux = dx / L,
    uy = dy / L;
  const nx = -uy,
    ny = ux;
  const vs: Pt[] = [{ x: x0, y: y0 }];
  const s0 = 0.25 * L,
    s1 = 0.8 * L;
  vs.push({ x: x0 + ux * s0, y: y0 + uy * s0 });
  for (let i = 1; i <= teeth; i++) {
    const s = s0 + ((s1 - s0) * i) / (teeth + 1);
    const side = i % 2 ? 1 : -1;
    vs.push({ x: x0 + ux * s + nx * amp * side, y: y0 + uy * s + ny * amp * side });
  }
  vs.push({ x: x0 + ux * s1, y: y0 + uy * s1 });
  vs.push({ x: x1, y: y1 });
  return poly(vs);
}
export function scribbleBlob(cx: number, cy: number, r: number, n = 16): Pt[] {
  const vs: Pt[] = [];
  for (let i = 0; i < n; i++) {
    const a = i * 2.39996;
    const rr = r * (0.55 + 0.45 * ((i * 7) % 5) / 4);
    vs.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr });
  }
  return poly(vs);
}
export function shift(strokes: Pt[][], dx: number, dy = 0): Pt[][] {
  return strokes.map((s) => s.map((p) => ({ x: p.x + dx, y: p.y + dy })));
}
export function scaleAbout(strokes: Pt[][], s: number, ox: number, oy: number): Pt[][] {
  return strokes.map((st) => st.map((p) => ({ x: ox + (p.x - ox) * s, y: oy + (p.y - oy) * s })));
}

/** Stick figure scaled to roughly `ink` px of ink, standing on the ground at x. */
export function stick(x: number, ink = 700): Pt[][] {
  const s = ink / 700;
  const head = 28 * s,
    torso = 110 * s,
    arm = 75 * s,
    leg = 95 * s;
  const hipY = G - leg * 0.95;
  const neckY = hipY - torso;
  return [
    circle(x, neckY - head, head),
    line(x, neckY, x, hipY),
    line(x, neckY + torso * 0.2, x - arm * 0.9, neckY + torso * 0.2 + arm * 0.4),
    line(x, neckY + torso * 0.2, x + arm * 0.9, neckY + torso * 0.2 + arm * 0.4),
    line(x, hipY, x - leg * 0.35, G),
    line(x, hipY, x + leg * 0.35, G),
  ];
}

export function spider(x: number): Pt[][] {
  const cy = G - 70;
  const out = [circle(x, cy, 36)];
  for (const s of [-1, 1])
    for (let k = 0; k < 3; k++) {
      const bx = x + s * (20 + k * 7),
        by = cy + 18 + k * 6;
      out.push(line(bx, by, x + s * (60 + k * 40), G));
    }
  return out;
}

export const worm = (x: number) => [line(x - 95, G - 4, x + 95, G - 4)];

export const box = (x: number) => [poly([
  { x: x - 55, y: G - 110 },
  { x: x + 55, y: G - 110 },
  { x: x + 55, y: G },
  { x: x - 55, y: G },
  { x: x - 55, y: G - 108 },
])];

export const roof = (x: number, span = 125) => [arc(x, G, span, Math.PI, 2 * Math.PI)];

export function giant(x: number): Pt[][] {
  const top = G - 830;
  return [
    circle(x, top + 70, 70),
    line(x, top + 140, x, top + 500),
    line(x, top + 220, x - 260, top + 160),
    line(x, top + 220, x + 260, top + 160),
    line(x, top + 500, x - 110, G),
    line(x, top + 500, x + 110, G),
  ];
}

export function hopper(x: number): Pt[][] {
  const hipY = G - 120;
  return [
    circle(x, hipY - 70, 34),
    line(x, hipY - 36, x, hipY),
    springLine(x, hipY, x - 30, G, 6, 10),
    springLine(x, hipY, x + 30, G, 6, 10),
  ];
}

export function reacher(x: number): Pt[][] {
  const hipY = G - 90;
  const neck = hipY - 100;
  return [
    circle(x, neck - 26, 26),
    line(x, neck, x, hipY),
    line(x, neck + 20, x - 200, neck - 60),
    line(x, neck + 20, x + 200, neck - 60),
    line(x, hipY, x - 35, G),
    line(x, hipY, x + 35, G),
  ];
}

export function bruiser(x: number): Pt[][] {
  const hipY = G - 95;
  const neck = hipY - 105;
  return [
    circle(x, neck - 28, 28),
    line(x, neck, x, hipY),
    [...line(x, neck + 20, x - 80, neck + 50), ...scribbleBlob(x - 95, neck + 55, 22, 18)],
    [...line(x, neck + 20, x + 80, neck + 50), ...scribbleBlob(x + 95, neck + 55, 22, 18)],
    line(x, hipY, x - 35, G),
    line(x, hipY, x + 35, G),
  ];
}

export function floater(x: number): Pt[][] {
  const cy = G - 150;
  return [circle(x, cy - 40, 40), circle(x, cy + 45, 45), line(x - 30, cy + 85, x - 45, G), line(x + 30, cy + 85, x + 45, G)];
}

export const CANON: Record<string, (x: number) => Pt[][]> = {
  stick400: (x) => stick(x, 400),
  stick700: (x) => stick(x, 700),
  stick1100: (x) => stick(x, 1100),
  spider,
  worm,
  box,
  giant,
  hopper,
  reacher,
  bruiser,
  floater,
  roof,
};
