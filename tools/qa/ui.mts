// npx tsx tools/qa/ui.mts : mashes the Doodle Pad / Sumo / Daily UI in a real page and reports console errors.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
const server = await createServer({ server: { port: 5198, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errors: string[] = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
await page.addInitScript(() => localStorage.setItem('drew-save', JSON.stringify({ v: 1, cleared: {}, badges: {}, fails: {}, hall: [], settings: {}, tutored: true })));
await page.goto('http://127.0.0.1:5198/', { waitUntil: 'domcontentloaded', timeout: 20000 });
await page.waitForTimeout(1500);
const log = (s: string) => console.log(s);
log('buttons on title: ' + (await page.locator('button').allInnerTexts()).map((t) => t.replace(/\s+/g, ' ')).join(' | '));
await page.getByRole('button', { name: /Sketchbook/ }).click({ timeout: 3000 }).catch(() => log('no sketchbook'));
await page.waitForTimeout(600);
await page.locator('.doodle-note').click({ timeout: 3000 }).catch(() => log('no doodle note reachable from title'));
await page.waitForTimeout(800);
const chips = page.locator('.palette .chip');
log('chips: ' + (await chips.allInnerTexts()).join(','));
const drawBlob = async (cx: number, cy: number) => {
  await page.mouse.move(cx, cy); await page.mouse.down();
  for (let i = 0; i < 40; i++) await page.mouse.move(cx + Math.cos(i / 6) * 60, cy + Math.sin(i / 6) * 60 + i);
  await page.mouse.up();
};
for (let round = 0; round < 4; round++) {
  const n = await chips.count();
  for (let i = 0; i < n; i++) { await chips.nth(i).click({ force: true }).catch(() => {}); await page.waitForTimeout(40); }
  await drawBlob(200, 500 + round * 40);
  await page.waitForTimeout(700);
}
for (let k = 0; k < 20; k++) { await chips.nth(7 + (k % 3)).click({ force: true }).catch(() => {}); }
await page.waitForTimeout(3000);
await page.screenshot({ path: 'review/qa/ui-doodle.png' });
// retry mashing + back
for (let k = 0; k < 10; k++) await page.locator('button.retry').first().click({ force: true, timeout: 500 }).catch(() => {});
await page.waitForTimeout(500);
await page.screenshot({ path: 'review/qa/ui-doodle-after-retry.png' });
log('errors: ' + (errors.length ? '\n' + [...new Set(errors)].join('\n') : 'none'));
await browser.close(); await server.close();
