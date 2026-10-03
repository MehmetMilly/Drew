// Drives the real toy page with mouse strokes and returns screenshots (data URLs).
import type { Page } from '@playwright/test';
import { CANON } from '../src/sim/canon';

export async function toClient(page: Page) {
  return (await page.evaluate('(() => { const r = window.drew.toy.rect; return { x: r.x, y: r.y, s: r.scale }; })()')) as { x: number; y: number; s: number };
}

export async function drawStrokes(page: Page, strokes: { x: number; y: number }[][], speed = 900, shotMid?: () => Promise<void>) {
  const r = await toClient(page);
  const c = (p: { x: number; y: number }) => ({ x: r.x + p.x * r.s, y: r.y + p.y * r.s });
  for (let si = 0; si < strokes.length; si++) {
    const s = strokes[si];
    const a = c(s[0]);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    let acc = 0;
    for (let i = 1; i < s.length; i++) {
      const q = c(s[i]);
      acc += Math.hypot(s[i].x - s[i - 1].x, s[i].y - s[i - 1].y);
      await page.mouse.move(q.x, q.y);
      if (acc > speed / 60) {
        acc = 0;
        await page.waitForTimeout(16);
      }
      if (shotMid && si === strokes.length - 1 && i === Math.floor(s.length / 2)) await shotMid();
    }
    await page.mouse.up();
  }
}

export const LIVE_DRAWINGS = { stick: CANON.stick700(360) };
