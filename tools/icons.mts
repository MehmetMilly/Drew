// App icons: the waking D on cream paper. Writes public/icons/*.png.
import { chromium } from '@playwright/test';
import { readFileSync, writeFileSync } from 'node:fs';
const font = readFileSync('public/fonts/gochi-hand.woff2').toString('base64');
const browser = await chromium.launch();
const page = await browser.newPage();
const make = async (size: number, pad: number, file: string) => {
  await page.setViewportSize({ width: size, height: size });
  await page.setContent(`<style>@font-face{font-family:G;src:url(data:font/woff2;base64,${font})}
  html,body{margin:0;width:${size}px;height:${size}px;background:#F4EEDF;overflow:hidden}
  .d{position:absolute;inset:${pad}px;display:flex;align-items:center;justify-content:center;font:${(size - 2 * pad) * 0.95}px G;color:#3A3A40;transform:rotate(-4deg)}
  .e{position:absolute;top:${size * 0.43}px;left:${size * 0.4}px;display:flex;gap:${size * 0.02}px}
  .e i{width:${size * 0.1}px;height:${size * 0.115}px;border-radius:50%;background:#FFFDF6;position:relative}
  .e i b{position:absolute;left:38%;top:34%;width:46%;height:46%;border-radius:50%;background:#1B1B1F}</style>
  <div class="d">D</div><div class="e"><i><b></b></i><i><b></b></i></div>`);
  await page.evaluate(() => document.fonts.ready);
  writeFileSync(file, await page.screenshot());
};
await make(192, 10, 'public/icons/icon-192.png');
await make(512, 28, 'public/icons/icon-512.png');
await make(512, 80, 'public/icons/maskable-512.png');
await make(180, 10, 'public/icons/apple-touch-icon.png');
await browser.close();
