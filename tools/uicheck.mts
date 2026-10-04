// Play-screen UI check: the tip strip, the Stuck? note, a real win's end card (the auto-pen draws a
// reference, recorded like a player's), and a Sumo win. Writes review/uicheck.png.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const server = await createServer({ server: { port: 5192, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 760 }, deviceScaleFactor: 1 });
const errs: string[] = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => localStorage.setItem('drew-save', JSON.stringify({ v: 1, cleared: {}, badges: { '3-1': ['Heavy'] }, fails: {}, hall: [], settings: {}, tutored: true })));
await page.goto('http://127.0.0.1:5192/');
await page.waitForFunction(() => (window as any).drew);
const shots: string[] = [];
const snap = async () => shots.push((await page.screenshot()).toString('base64'));
const play = (id: string, ref: number, sumo: number) =>
  page.evaluate(
    async ([i, r, sm]) => {
      const a = '/src/levels/index.ts', b = '/src/levels/sumo.ts';
      const { ALL_LEVELS } = await import(a);
      const { sumoLevel } = await import(b);
      const d = (window as any).drew;
      const L = sm !== -1 ? sumoLevel(sm) : ALL_LEVELS.find((l: any) => l.id === i);
      d.shell.show('play', L);
      setTimeout(() => d.toy.autoDraw(L.refs[r].strokes), 1200);
    },
    [id, ref, sumo] as const,
  );
await play('3-1', 1, -1);
await page.waitForTimeout(900);
await snap(); // tip strip
await page.click('.tip-strip .stuck');
await page.waitForTimeout(300);
await snap(); // stuck note
await page.click('.stuck-close');
await page.waitForSelector('.endcard', { timeout: 40000 });
await page.waitForTimeout(500);
await snap(); // end card
await play('', 0, 11);
await page.waitForTimeout(1500);
await snap(); // sumo strip
await page.waitForFunction(() => (window as any).drew.toy.result === 'win' || (window as any).drew.toy.result === 'fail', null, { timeout: 40000 });
await page.waitForTimeout(700);
await snap(); // sumo result, foe face
const p2 = await browser.newPage({ viewport: { width: 390 * shots.length, height: 760 } });
await p2.setContent(`<body style="margin:0;display:flex">${shots.map((b) => `<img src="data:image/png;base64,${b}" width=390>`).join('')}</body>`);
await p2.waitForTimeout(300);
writeFileSync('review/uicheck.png', await p2.screenshot());
console.log('errors', errs);
await browser.close();
await server.close();
