// Hint button check: 1-3 with two recorded fails, fail once more, press hint. Writes review/hint.png.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
const server = await createServer({ server: { port: 5196, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 2 });
const errs: string[] = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.addInitScript(() => localStorage.setItem('drew-save', JSON.stringify({ v: 1, cleared: {}, badges: {}, fails: { '1-3': 2 }, hall: [], settings: {} })));
await page.goto('http://127.0.0.1:5196/');
await page.waitForFunction(() => (window as any).drew);
await page.evaluate(async () => {
  const url = '/src/levels/index.ts';
  const { ALL_LEVELS } = await import(url);
  (window as any).drew.shell.show('play', ALL_LEVELS.find((l: any) => l.id === '1-3'));
});
await page.waitForSelector('.hint-btn', { timeout: 30000 }); // no ink: the crusher wins, fail
await page.click('.hint-btn');
await page.waitForTimeout(3000);
await page.screenshot({ path: 'review/hint.png' });
console.log('errors', errs);
await browser.close();
await server.close();
