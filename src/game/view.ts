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

/** Fit the page inside the window, kept clear of the notch and home indicator (insets in CSS px). */
export function layoutPage(cssW: number, cssH: number, dpr: number, inset = { t: 0, b: 0, l: 0, r: 0 }): PageRect {
  const aw = cssW - inset.l - inset.r,
    ah = cssH - inset.t - inset.b;
  const scale = Math.min(aw / WORLD.W, ah / WORLD.H);
  const w = WORLD.W * scale,
    h = WORLD.H * scale;
  return { x: inset.l + (aw - w) / 2, y: inset.t + (ah - h) / 2, w, h, scale, dpr };
}

/** The safe-area insets, read through a probe element (env() only exists in CSS). */
export function safeInsets() {
  const p = document.createElement('div');
  p.style.cssText = 'position:fixed;visibility:hidden;padding:env(safe-area-inset-top,0px) env(safe-area-inset-right,0px) env(safe-area-inset-bottom,0px) env(safe-area-inset-left,0px)';
  document.body.appendChild(p);
  const c = getComputedStyle(p);
  const r = { t: parseFloat(c.paddingTop) || 0, r: parseFloat(c.paddingRight) || 0, b: parseFloat(c.paddingBottom) || 0, l: parseFloat(c.paddingLeft) || 0 };
  p.remove();
  return r;
}

export function clientToPage(r: PageRect, cx: number, cy: number) {
  return { x: (cx - r.x) / r.scale, y: (cy - r.y) / r.scale };
}
