// npm run shots: Playwright screenshots and frame strips into review/.
// Usage: npm run shots [-- name ...]   (names from tools/shotlist.ts)
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { mkdirSync, writeFileSync } from 'node:fs';
import { SHOTS } from './shotlist';

const want = process.argv.slice(2);
const list = Object.entries(SHOTS).filter(([k]) => !want.length || want.includes(k));
mkdirSync('review', { recursive: true });
const server = await createServer({ server: { port: 5199, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
await page.goto('http://127.0.0.1:5199/shots.html');
await page.waitForFunction(() => (window as any).shots);
for (const [name, rows] of list) {
  const t0 = Date.now();
  const data: string = await page.evaluate(async (rows) => {
    const c: HTMLCanvasElement = await (window as any).shots.sheet(rows);
    return c.toDataURL('image/png');
  }, rows as any);
  writeFileSync(`review/${name}.png`, Buffer.from(data.split(',')[1], 'base64'));
  console.log(`review/${name}.png  ${Date.now() - t0}ms`);
}
if (errors.length) console.log('console errors:\n' + errors.join('\n'));
await browser.close();
await server.close();
