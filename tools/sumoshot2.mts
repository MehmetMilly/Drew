// Sumo cage and overtime strip: a long bout (the ring visibly shrinks after time-out) and a win (the
// cage opens, Little Guy hops down). Writes review/sumo-cage.png.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const server = await createServer({ server: { port: 5191, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1 });
const errs: string[] = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => localStorage.setItem('drew-save', JSON.stringify({ v: 1, cleared: {}, badges: {}, fails: {}, hall: [], settings: {}, tutored: true })));
await page.goto('http://127.0.0.1:5191/');
await page.waitForFunction(() => (window as any).drew);
const shots: string[] = [];
const snap = async () => shots.push((await page.screenshot()).toString('base64'));
const bout = (k: number, body: string | null) =>
  page.evaluate(
    async ([k, body]) => {
      const a = '/src/levels/sumo.ts', c = '/src/sim/canon.ts';
      const { sumoLevel } = await import(a);
      const { CANON } = await import(c);
      const d = (window as any).drew;
      const L = sumoLevel(k);
      d.shell.show('play', L);
      const s = body ? CANON[body](250).map((st: any[]) => st.map((p) => ({ x: p.x, y: p.y - 190 }))) : L.refs[0].strokes;
      setTimeout(() => d.toy.autoDraw(s), 1200);
    },
    [k, body] as const,
  );
await bout(6, 'worm');
await page.waitForTimeout(4000);
await snap();
await page.waitForTimeout(11000);
await snap(); // overtime: the ring is shrinking
await page.waitForTimeout(1600);
await snap();
await bout(0, null);
await page.waitForFunction(() => (window as any).drew.toy.result === 'win', null, { timeout: 40000 });
await page.waitForTimeout(150);
await snap();
await page.waitForTimeout(600);
await snap();
const p2 = await browser.newPage({ viewport: { width: 390 * shots.length, height: 760 } });
await p2.setContent(`<body style="margin:0;display:flex">${shots.map((b) => `<img src="data:image/png;base64,${b}" width=390>`).join('')}</body>`);
await p2.waitForTimeout(300);
writeFileSync('review/sumo-cage.png', await p2.screenshot());
console.log('errors', errs);
await browser.close();
await server.close();
