// Live check of a level attempt through the shell: draw a winner on 1-1, then capture
// the stamp, the highlight, the end card and the Watch timelapse.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import { drawStrokes } from './livepen';
import { CANON } from '../src/sim/canon';
const server = await createServer({ server: { port: 5196, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 1 });
const errs: string[] = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('http://127.0.0.1:5196/');
await page.waitForFunction(() => (window as any).drew);
await page.evaluate(`localStorage.clear()`);
const shots: string[] = [];
const snap = async () => shots.push((await page.screenshot()).toString('base64'));
await snap(); // title
await page.click('text=Story');
await page.waitForTimeout(400);
await snap(); // chapter
await page.click('text=Hello, Friend');
await page.waitForTimeout(1600);
await drawStrokes(page, CANON.spider(220), 900);
const t0 = Date.now();
for (const at of [1500, 4000]) {
  await page.waitForTimeout(Math.max(0, at - (Date.now() - t0)));
  await snap();
}
// wait for the stamp, then the highlight
await page.waitForFunction(`window.drew.toy.show?.visible || document.querySelector('.endcard')`, null, { timeout: 15000 });
await page.waitForTimeout(600);
await snap();
await page.waitForSelector('.endcard', { timeout: 15000 });
await page.waitForTimeout(500);
await snap();
await page.click('text=Watch');
await page.waitForTimeout(500);
await snap();
await page.waitForTimeout(1500);
await snap();
const sheet = (await page.evaluate(`(async (imgs) => { const ims = await Promise.all(imgs.map(b => new Promise(r => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b; }))); const w = ims[0].width, h = ims[0].height; const cols = 4; const c = document.createElement('canvas'); c.width = w * cols; c.height = h * Math.ceil(ims.length / cols); const g = c.getContext('2d'); ims.forEach((im, k) => g.drawImage(im, (k % cols) * w, Math.floor(k / cols) * h)); return c.toDataURL('image/png'); })(${JSON.stringify(shots)})`)) as string;
writeFileSync('review/replay.png', Buffer.from(sheet.split(',')[1], 'base64'));
console.log('errors', errs);
await browser.close();
await server.close();
