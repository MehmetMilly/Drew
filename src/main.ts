import { Toy } from './game/toy';
import { CANON } from './sim/canon';

const backdrop = document.getElementById('backdrop') as HTMLCanvasElement;
const world = document.getElementById('world') as HTMLCanvasElement;
const ink = document.getElementById('ink') as HTMLCanvasElement;
document.fonts.load('26px "Gochi Hand"').finally(() => {
  const toy = new Toy(backdrop, world, ink);
  if (import.meta.env.DEV) (window as unknown as Record<string, unknown>).drew = { toy, CANON };
});
