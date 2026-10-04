// Frame strip of a level's solution demo: npx tsx tools/demostrip.mts <id> <ref index> [start s] [every s]
// Writes review/demo-<id>.png (8 frames).
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const [id = '2-1', ri = '0', st = '3', ev = '0.5'] = process.argv.slice(2);
const server = await createServer({ server: { port: 5194, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 1 });
const errs: string[] = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => localStorage.setItem('drew-save', JSON.stringify({ v: 1, cleared: {}, badges: {}, fails: {}, hall: [], settings: {}, tutored: true })));
await page.goto('http://127.0.0.1:5194/');
await page.waitForFunction(() => (window as any).drew);
await page.evaluate(async ([i, r]) => {
  const url = '/src/levels/index.ts';
  const { ALL_LEVELS } = await import(url);
  const d = (window as any).drew;
  d.shell.show('play', ALL_LEVELS.find((l: any) => l.id === i));
  for (let k = 0; k <= Number(r); k++) d.toy.showHint();
  d.toy.demo();
}, [id, ri]);
await page.waitForTimeout(Number(st) * 1000);
const shots: string[] = [];
for (let k = 0; k < 8; k++) {
  shots.push((await page.screenshot()).toString('base64'));
  await page.waitForTimeout(Number(ev) * 1000);
}
const p2 = await browser.newPage({ viewport: { width: 390 * 8, height: 700 } });
await p2.setContent(`<body style="margin:0;display:flex">${shots.map((b) => `<img src="data:image/png;base64,${b}" width=390>`).join('')}</body>`);
await p2.waitForTimeout(300);
writeFileSync(`review/demo-${id}.png`, await p2.screenshot());
console.log('errors', errs);
await browser.close();
await server.close();
