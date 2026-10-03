// 60 fps with ~900 particles in the browser under a 4× CPU throttle (DevTools
// "mid-tier mobile"). Returns fps and the 95th percentile frame time.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

export async function browserPerf(throttle = 4) {
  const server = await createServer({ server: { port: 5196, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch({ args: (process.env.GPUARGS ?? '').split(' ').filter(Boolean) });
  try {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    const page = await ctx.newPage();
    await page.goto('http://127.0.0.1:5196/');
    await page.waitForFunction(() => (window as any).drew); await page.evaluate('window.__N = Number(process.env.N)'.replace('Number(process.env.N)', String(process.env.N ?? 870)));
    const cdp = await ctx.newCDPSession(page);
    await cdp.send('Emulation.setCPUThrottlingRate', { rate: throttle });
    // a string, so esbuild's helper names don't leak into the page
    const res = await page.evaluate(`(async () => {
      const { toy, CANON } = window.drew;
      const names = ['stick1100', 'spider', 'giant', 'bruiser', 'reacher', 'hopper', 'stick700'];
      const xs = [100, 250, 400, 550, 640, 180, 470];
      let i = 0;
      while (toy.world.P.alive < (window.__N ?? 870) && i < 20) { toy.world.addStrokes(CANON[names[i % names.length]](xs[i % xs.length])); i++; }
      toy.world.toyTarget = { x: 600, y: 600 };
      const frames = [];
      let last = performance.now();
      await new Promise((done) => {
        const t0 = last;
        const tick = (t) => { frames.push(t - last); last = t; if (t - t0 < 5000) requestAnimationFrame(tick); else done(); };
        requestAnimationFrame(tick);
      });
      frames.shift();
      const sorted = frames.slice().sort((a, b) => a - b);
      return { long: frames.filter(f=>f>20).map(f=>Math.round(f)).join(','), n: frames.length, worldDpr: toy.worldDpr, frameAvg: toy.frameAvg, particles: toy.world.P.alive, fps: 1000 / (frames.reduce((a, b) => a + b, 0) / frames.length), p95: sorted[Math.floor(sorted.length * 0.95)], stepMs: toy.stepMs };
    })()`) as { particles: number; fps: number; p95: number; stepMs: number };
    return res;
  } finally {
    await browser.close();
    await server.close();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) console.log(await browserPerf());
