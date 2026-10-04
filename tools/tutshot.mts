// First-launch tutorial strip: a fresh save, one frame per lesson. Writes review/tutorial.png.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
const server = await createServer({ server: { port: 5195, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 1 });
const errs: string[] = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('http://127.0.0.1:5195/');
await page.waitForFunction(() => (window as any).drew);
const shots: string[] = [];
for (let i = 0; i < 6; i++) {
  await page.waitForTimeout(i === 0 ? 2600 : 4400);
  shots.push((await page.screenshot()).toString('base64'));
}
await page.waitForSelector('.tut-go', { timeout: 30000 });
shots.push((await page.screenshot()).toString('base64'));
const html = `<body style="margin:0;display:flex">${shots.map((b) => `<img src="data:image/png;base64,${b}" width=390>`).join('')}</body>`;
const p2 = await browser.newPage({ viewport: { width: 390 * shots.length, height: 700 } });
await p2.setContent(html);
await p2.waitForTimeout(300);
writeFileSync('review/tutorial.png', await p2.screenshot());
console.log('errors', errs);
await browser.close();
await server.close();
