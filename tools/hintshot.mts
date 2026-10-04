// Hint ladder check on 1-2: the fail row, the hint note, the solution demo mid-draw and at its end.
// Writes review/hint-*.png.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
const server = await createServer({ server: { port: 5196, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 1 });
const errs: string[] = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => localStorage.setItem('drew-save', JSON.stringify({ v: 1, cleared: {}, badges: {}, fails: {}, hall: [], settings: {}, tutored: true })));
await page.goto('http://127.0.0.1:5196/');
await page.waitForFunction(() => (window as any).drew);
const id = process.argv[2] ?? '1-2';
await page.evaluate(async (i) => {
  const url = '/src/levels/index.ts';
  const { ALL_LEVELS } = await import(url);
  (window as any).drew.shell.show('play', ALL_LEVELS.find((l: any) => l.id === i));
}, id);
await page.waitForSelector('.fail-row', { timeout: 40000 }); // no ink: the threat wins
await page.screenshot({ path: 'review/hint-fail.png' });
await page.click('.hint-btn');
await page.waitForTimeout(400);
await page.screenshot({ path: 'review/hint-note.png' });
await page.click('text=Watch one way');
await page.waitForTimeout(1800);
await page.screenshot({ path: 'review/hint-demo.png' });
await page.waitForSelector('.your-turn', { timeout: 40000 });
await page.screenshot({ path: 'review/hint-end.png' });
console.log('errors', errs);
await browser.close();
await server.close();
