// Letterboxed 9:16 page on a desk (look-and-feel §8, phone first).
import { WORLD } from '../tuning';

export interface PageRect {
  x: number; // css px
  y: number;
  w: number;
  h: number;
  scale: number; // css px per page unit
  dpr: number;
}

export function layoutPage(cssW: number, cssH: number, dpr: number): PageRect {
  const scale = Math.min(cssW / WORLD.W, cssH / WORLD.H);
  const w = WORLD.W * scale,
    h = WORLD.H * scale;
  return { x: (cssW - w) / 2, y: (cssH - h) / 2, w, h, scale, dpr };
}

export function clientToPage(r: PageRect, cx: number, cy: number) {
  return { x: (cx - r.x) / r.scale, y: (cy - r.y) / r.scale };
}
