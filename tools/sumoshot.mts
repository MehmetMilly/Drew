// Sumo bout look check: opens rung 12, drops a creature, shoots at 5 s and after time-out. Writes review/sumo-*.png.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
const server = await createServer({ server: { port: 5197, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 2 });
const errs: string[] = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('http://127.0.0.1:5197/');
await page.waitForFunction(() => (window as any).drew);
await page.evaluate(async () => {
  const { sumoLevel } = await import('/src/levels/sumo.ts' as string);
  const { CANON, shift } = await import('/src/sim/canon.ts' as string);
  const d = (window as any).drew;
  d.shell.show('play', sumoLevel(11));
  await new Promise((r) => setTimeout(r, 1500));
  const w = d.toy.world;
  (window as any)._w = w;
  const st = shift(CANON.spider(250), 0, 1000 - 1190).map((s: any[]) => { let t = 0; return s.map((p, i) => { if (i) t += Math.hypot(p.x - s[i - 1].x, p.y - s[i - 1].y) / 900; return { ...p, t, p: 0.5 }; }); });
  w.addStrokes(st, 0);
});
await page.waitForTimeout(5000);
await page.screenshot({ path: 'review/sumo-bout.png' });
await page.waitForTimeout(9000);
await page.screenshot({ path: 'review/sumo-shrink.png' });
console.log('errors', errs);
await browser.close();
await server.close();
