// Mix check (audio.md §7): plays real levels in headless Chromium, taps every bus with an
// analyser and reports loudness against the targets. Loudness is unweighted RMS in dBFS
// (close to LUFS for broadband material; not K-weighted), so treat it as a guide, not a meter.
// Usage: npx tsx tools/mixcheck.mts
import { createServer } from 'vite';
import { chromium } from '@playwright/test';
import { drawStrokes } from './livepen';
import { ALL_LEVELS } from '../src/levels';

const server = await createServer({ server: { port: 5199, host: '127.0.0.1', hmr: false, watch: null }, logLevel: 'error' });
await server.listen();
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const page = await browser.newPage({ viewport: { width: 390, height: 700 }, deviceScaleFactor: 1 });
const errs: string[] = [];
page.on('pageerror', (e) => errs.push(String(e)));
await page.goto('http://127.0.0.1:5199/');
await page.waitForFunction(() => (window as any).drew);
await page.mouse.click(5, 5); // a gesture: audio unlocks on the first touch

// taps: an analyser after each bus (post-fader), plus the master
await page.evaluate(async () => {
  const m = await import('/src/audio/mixer.ts');
  m.initAudio();
  const c = m.audioCtx()!;
  await c.resume();
  const B = m.buses()!;
  const taps: Record<string, AudioNode> = { master: B.master, music: B.musicDuck, pencil: B.pencil, creatures: B.creatures, world: B.worldSlow, ui: B.ui, ambience: B.ambDuck };
  const stats: Record<string, { sum: number; n: number; peak: number; hot: number[] }> = {};
  const an: Record<string, AnalyserNode> = {};
  for (const [k, node] of Object.entries(taps)) {
    const a = c.createAnalyser();
    a.fftSize = 2048;
    node.connect(a);
    an[k] = a;
    stats[k] = { sum: 0, n: 0, peak: 0, hot: [] };
  }
  const buf = new Float32Array(2048);
  const draw: Record<string, { sum: number; n: number }> = {};
  for (const k in an) draw[k] = { sum: 0, n: 0 };
  setInterval(() => {
    const drawing = !!(window as any).drew.toy.live;
    for (const k in an) {
      an[k].getFloatTimeDomainData(buf);
      let s = 0,
        p = 0;
      for (const v of buf) (s += v * v), (p = Math.max(p, Math.abs(v)));
      const rms = Math.sqrt(s / buf.length);
      const st = stats[k];
      if (rms > 1e-5) (st.sum += s / buf.length), st.n++, st.hot.push(rms);
      if (drawing) (draw[k].sum += s / buf.length), draw[k].n++;
      st.peak = Math.max(st.peak, p);
    }
  }, 40);
  (window as any).mixStats = stats;
  (window as any).drawStats = draw;
});

for (const id of ['1-4', '2-5', '3-2', '5-4']) {
  const lv = ALL_LEVELS.find((l) => l.id === id)!;
  await page.evaluate(async (i) => {
    const { ALL_LEVELS } = await import('/src/levels/index.ts');
    (window as any).drew.shell.show('play', ALL_LEVELS.find((l: any) => l.id === i));
  }, id);
  await page.waitForTimeout(1600);
  await drawStrokes(page, lv.refs[0].strokes, 700);
  await page.waitForTimeout(9000);
}

const stats = (await page.evaluate(() => (window as any).mixStats)) as Record<string, { sum: number; n: number; peak: number; hot: number[] }>;
const db = (v: number) => (v > 0 ? 20 * Math.log10(v) : -Infinity);
console.log('| bus | loudness while sounding (dBFS RMS) | 95th-pct short-term (dB) | peak (dBFS) |');
console.log('|---|---|---|---|');
const row: Record<string, { L: number; p95: number; peak: number }> = {};
for (const [k, s] of Object.entries(stats)) {
  const L = s.n ? 10 * Math.log10(s.sum / s.n) : -Infinity;
  const h = [...s.hot].sort((a, b) => a - b);
  const p95 = h.length ? db(h[Math.floor(h.length * 0.95)]) : -Infinity;
  row[k] = { L, p95, peak: db(s.peak) };
  console.log(`| ${k} | ${L.toFixed(1)} | ${p95.toFixed(1)} | ${db(s.peak).toFixed(1)} |`);
}
const sfxP95 = Math.max(row.world.p95, row.creatures.p95);
console.log(`\nmusic ${row.music.L.toFixed(1)} dB (target about -20)`);
console.log(`SFX loud moments ${sfxP95.toFixed(1)} dB, ${(sfxP95 - row.music.L).toFixed(1)} dB over the music (target about +6)`);
const ds = (await page.evaluate(() => (window as any).drawStats)) as Record<string, { sum: number; n: number }>;
const dL = (k: string) => (ds[k].n ? 10 * Math.log10(ds[k].sum / ds[k].n || 1e-12) : -Infinity);
console.log(`while drawing: pencil ${dL('pencil').toFixed(1)}, music ${dL('music').toFixed(1)}, world ${dL('world').toFixed(1)}, creatures ${dL('creatures').toFixed(1)} (pencil should be loudest)`);
console.log(`pencil ${row.pencil.p95.toFixed(1)} vs world ${row.world.p95.toFixed(1)} / creatures ${row.creatures.p95.toFixed(1)} (pencil should be loudest while drawing)`);
console.log(`voices ${row.creatures.L.toFixed(1)} vs world ${row.world.L.toFixed(1)} (voices above the world)`);
console.log(`ambience ${row.ambience.L.toFixed(1)} (barely there)`);
console.log(`master peak ${row.master.peak.toFixed(1)} dBFS`);
console.log('errors', errs);
await browser.close();
await server.close();
