// Smoke test for capture.html: redraw replaces, Next/Back, undo stroke, reload resume,
// and a contact sheet of every prompt's example card (review/capture.png).
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { drawStrokes } from './livepen';
import { line, circle } from '../src/sim/canon';
const server = await createServer({ server: { port: 5193, host: '127.0.0.1' }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
const errs: string[] = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('http://127.0.0.1:5193/capture.html');
await page.evaluate('localStorage.clear()');
await page.reload();
await page.waitForFunction('window.drew');
const bar = async () => (await page.textContent('#bar'))!.replace(/\s+/g, ' ').trim();
const ok = (c: boolean, m: string) => console.log(`${c ? '✓' : '✗'} ${m}`);

ok((await page.isDisabled('#b-next')) === true, 'Next disabled before drawing');
await drawStrokes(page, [line(200, 600, 500, 650)], 400);
await drawStrokes(page, [line(200, 800, 500, 700)], 400);
ok((await bar()).startsWith('1/40'), 'drawing does not auto-advance');
const n = await page.evaluate('document.querySelectorAll("canvas").length');
await page.click('#b-next');
ok((await bar()).startsWith('2/40'), 'Next advances');
await page.click('#b-back');
ok((await bar()).startsWith('1/40') && !(await page.isDisabled('#b-next')), 'Back returns with the answer kept');
await page.click('#b-clear');
ok(await page.isDisabled('#b-next'), 'Clear empties the answer');
await drawStrokes(page, [line(200, 600, 500, 650)], 400);
await page.click('#b-next');
await page.reload();
await page.waitForFunction('window.drew');
ok((await bar()).startsWith('2/40'), 'reload resumes where you were');
// jump to the first multi-stroke prompt
for (let i = 0; i < 33; i++) await page.click('#b-skip');
ok((await bar()).includes('35/40'), 'at multi-stroke prompt');
await drawStrokes(page, [line(150, 500, 550, 500)], 500);
await drawStrokes(page, [line(350, 505, 350, 800)], 500);
await drawStrokes(page, [circle(350, 900, 50)], 500);
ok((await bar()).includes('3 strokes'), 'multi-stroke counts');
await page.click('#b-clear');
ok((await bar()).includes('2 strokes'), 'Undo stroke removes only the last');
void n;

// example cards for every prompt
await page.evaluate('localStorage.clear()');
await page.reload();
await page.waitForFunction('window.drew');
const shots: Buffer[] = [];
for (let i = 0; i < 40; i++) {
  shots.push(await page.screenshot({ clip: { x: 0, y: 0, width: 390, height: 330 } }));
  await page.click('#b-skip');
}
console.log('final bar:', (await bar()).slice(0, 80));
// stitch into a sheet via the page canvas
const sheet = await page.evaluate(async (imgs: string[]) => {
  const W = 195, H = 165, cols = 8;
  const c = document.createElement('canvas');
  c.width = W * cols;
  c.height = H * Math.ceil(imgs.length / cols);
  const g = c.getContext('2d')!;
  for (let i = 0; i < imgs.length; i++) {
    const im = new Image();
    im.src = 'data:image/png;base64,' + imgs[i];
    await im.decode();
    g.drawImage(im, (i % cols) * W, Math.floor(i / cols) * H, W, H);
  }
  return c.toDataURL('image/png').split(',')[1];
}, shots.map((b) => b.toString('base64')));
const { writeFileSync } = await import('node:fs');
writeFileSync('review/capture.png', Buffer.from(sheet, 'base64'));
console.log('errors:', errs);
await browser.close();
await server.close();
