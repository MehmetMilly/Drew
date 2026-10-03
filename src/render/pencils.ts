// The Pencil Case (design §12): cosmetic pencils unlocked by badges and the Sumo ladder.
// Each changes only the stroke's colour and texture (and later the voice timbre).
import { COLORS } from '../tuning';
import { vnoise } from './materials';

type Ctx = CanvasRenderingContext2D;

export interface Pencil {
  id: string;
  name: string;
  color: string;
  /** 0: perfectly solid; 1: very toothy (wax skips over the paper grain) */
  tooth: number;
  unlock: { badges?: number; sumo?: boolean };
}

export const PENCILS: Pencil[] = [
  { id: 'graphite', name: 'Graphite', color: COLORS.graphite, tooth: 0.45, unlock: {} },
  { id: 'ballpoint', name: 'Blue Ballpoint', color: '#24408E', tooth: 0.12, unlock: { badges: 10 } },
  { id: 'crayon', name: 'Wax Crayon', color: '#B5452F', tooth: 0.9, unlock: { badges: 25 } },
  { id: 'marker', name: 'Felt Marker', color: '#1D6B5F', tooth: 0, unlock: { badges: 45 } },
  { id: 'chalk', name: 'Chalk', color: '#8A8A8E', tooth: 1, unlock: { badges: 60 } },
  { id: 'rainbow', name: 'Rainbow', color: 'rainbow', tooth: 0.3, unlock: { badges: 75 } },
  { id: 'brush', name: "Champion's Brush", color: '#121214', tooth: 0.7, unlock: { sumo: true } },
];

let current = 'graphite';
let version = 0;
/** Bumps whenever the pencil changes, so cached patterns are rebuilt. */
export const pencilVersion = () => version;
export function setPencil(id: string) {
  if (id === current || !PENCILS.some((p) => p.id === id)) return;
  current = id;
  version++;
}

/** The fill pattern of the current pencil. */
export function inkPattern(g: Ctx): CanvasPattern {
  const pen = PENCILS.find((p) => p.id === current) ?? PENCILS[0];
  const size = 96;
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const cg = c.getContext('2d')!;
  const img = cg.createImageData(size, size);
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const v = 0.6 * vnoise(x / 1.5, y / 1.5, size / 1.5, 77) + 0.4 * vnoise(x / 4, y / 4, size / 4, 78);
      let r: number, gg: number, b: number;
      if (pen.color === 'rainbow') {
        // diagonal bands of hue that tile across the pattern
        const h = ((x + y) / size) * 360;
        [r, gg, b] = hsl(h, 0.62, 0.45);
      } else {
        r = parseInt(pen.color.slice(1, 3), 16);
        gg = parseInt(pen.color.slice(3, 5), 16);
        b = parseInt(pen.color.slice(5, 7), 16);
      }
      const k = (y * size + x) * 4;
      img.data[k] = r;
      img.data[k + 1] = gg;
      img.data[k + 2] = b;
      // the tooth leaves lighter pits; a solid pencil fills them
      const solid = 1 - pen.tooth * 0.45;
      img.data[k + 3] = Math.round(255 * Math.min(1, solid + pen.tooth * 0.75 * v + (1 - pen.tooth) * 0.3));
    }
  cg.putImageData(img, 0, 0);
  return g.createPattern(c, 'repeat')!;
}

function hsl(h: number, s: number, l: number): [number, number, number] {
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    const a = s * Math.min(l, 1 - l);
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}
