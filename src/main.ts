import { Toy } from './game/toy';
import { Shell } from './ui/shell';
import { CANON } from './sim/canon';

const backdrop = document.getElementById('backdrop') as HTMLCanvasElement;
const world = document.getElementById('world') as HTMLCanvasElement;
const ink = document.getElementById('ink') as HTMLCanvasElement;
document.fonts.load('26px "Gochi Hand"').finally(() => {
  const toy = new Toy(backdrop, world, ink);
  const shell = new Shell(toy);
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).drew = { toy, shell, CANON };
});

// offline play once installed; never in dev (it would cache the dev server)
if (import.meta.env.PROD && 'serviceWorker' in navigator) addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => {}));
