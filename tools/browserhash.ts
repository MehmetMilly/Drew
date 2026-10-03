// Runs detScenario inside headless Chromium (through Vite) and returns its hash.
import { createServer } from 'vite';
import { chromium } from '@playwright/test';

export async function browserHash(): Promise<number> {
  const server = await createServer({ server: { port: 5198, host: '127.0.0.1' }, logLevel: 'error' });
  await server.listen();
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto('http://127.0.0.1:5198/shots.html');
    return await page.evaluate(async () => {
      const m = await import('/tools/detscenario.ts' as string);
      return m.detScenario();
    });
  } finally {
    await browser.close();
    await server.close();
  }
}
