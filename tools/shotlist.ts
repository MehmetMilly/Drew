import { circle, line } from '../src/sim/canon';
// Scenario lists for `npm run shots`. Each entry is one contact sheet.
const T = [0, 0.5, 1, 2, 3.5];
const FEEL = [0.5, 0.7, 0.85, 1.0, 1.2, 1.5, 1.9, 2.5];
const FEELCROP = { x: 0, y: 860, w: 420, h: 350, follow: true };
export const SHOTS: Record<string, any[]> = {
  bodies: [
    { label: 'stick', draw: [{ canon: 'stick700', x: 200 }, { canon: 'spider', x: 520 }], target: { x: 600, y: 700, at: 0.5 }, times: T },
    { label: 'worm+box', draw: [{ canon: 'worm', x: 160 }, { canon: 'box', x: 520 }], target: { x: 600, y: 900, at: 0.5 }, times: T },
    { label: 'hopper+bruiser', draw: [{ canon: 'hopper', x: 160 }, { canon: 'bruiser', x: 500 }], target: { x: 600, y: 700, at: 0.5 }, times: T },
  ],
  worm: [
    { label: 'worm', draw: [{ canon: 'worm', x: 150 }], target: { x: 700, y: 1150, at: 0 }, times: [0.6, 0.8, 1.0, 1.2, 1.4, 1.6], crop: { x: 0, y: 1080, w: 260, h: 130, follow: true } },
  ],
  feel: [
    { label: 'dog turns', strokes: [line(300, 1080, 450, 1080), circle(478, 1052, 26), line(310, 1080, 300, 1186), line(440, 1080, 450, 1186), line(300, 1080, 272, 1050)], draw: [], target: { x: 80, y: 1150, at: 0.5 }, times: FEEL, crop: FEELCROP },
    { label: 'worm turns', draw: [{ canon: 'worm', x: 360 }], target: { x: 700, y: 1150, at: 0.5 }, times: FEEL, crop: FEELCROP },
    { label: 'box rolls', draw: [{ canon: 'box', x: 200 }], target: { x: 700, y: 1150, at: 0.5 }, times: FEEL, crop: FEELCROP },
    { label: 'hopper hops', draw: [{ canon: 'hopper', x: 200 }], target: { x: 700, y: 1150, at: 0.5 }, times: FEEL, crop: FEELCROP },
    { label: 'heavy turns', draw: [{ canon: 'bruiser', x: 420 }], target: { x: 60, y: 1150, at: 0.5 }, times: FEEL, crop: FEELCROP },
    { label: 'spider turns', draw: [{ canon: 'spider', x: 420 }], target: { x: 60, y: 1150, at: 0.5 }, times: FEEL, crop: FEELCROP },
    { label: 'stick reaches low', draw: [{ canon: 'stick700', x: 360 }], target: { x: 300, y: 1165, at: 0.5 }, times: FEEL, crop: FEELCROP },
  ],
  arms: [
    { label: 'reach low', draw: [{ canon: 'stick700', x: 360 }], target: { x: 300, y: 1165, at: 0.5 }, times: [0.5, 1.0, 1.5, 2.0], crop: { x: 210, y: 900, w: 300, h: 300 } },
    { label: 'reach up-left', draw: [{ canon: 'stick700', x: 360 }], target: { x: 250, y: 850, at: 0.5 }, times: [0.5, 1.0, 1.5, 2.0], crop: { x: 210, y: 900, w: 300, h: 300 } },
  ],
  gait: [
    { label: 'stick', draw: [{ canon: 'stick700', x: 150 }], target: { x: 700, y: 1150, at: 0 }, times: [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3], crop: { x: 0, y: 830, w: 360, h: 380, follow: true } },
    { label: 'spider', draw: [{ canon: 'spider', x: 150 }], target: { x: 700, y: 1150, at: 0 }, times: [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3], crop: { x: 0, y: 830, w: 360, h: 380, follow: true } },
  ],
  giant: [{ label: 'giant', draw: [{ canon: 'giant', x: 300 }], target: { x: 600, y: 300, at: 0.5 }, times: T }],
  birth: [{ label: 'birth', draw: [{ canon: 'stick700', x: 360 }], wet: true, times: [0, 0, 0.02, 0.08, 0.14, 0.22, 0.32, 0.6], crop: { x: 240, y: 880, w: 240, h: 240 } }],
  levels: ['1-1', '1-2', '1-3', '1-4', '1-5'].flatMap((id) => [0, 1].map((ref) => ({ label: id, level: id, ref, draw: [], times: [0.2, 1, 2, 3, 4.5, 6] }))),
  ch2: ['2-1', '2-2', '2-3', '2-4', '2-5'].flatMap((id) => [0, 1].map((ref) => ({ label: id, level: id, ref, draw: [], times: [0.2, 1, 2, 3, 4.5, 6] }))),
  debug: [{ label: 'debug', draw: [{ canon: 'reacher', x: 200 }, { canon: 'hopper', x: 520 }], target: { x: 420, y: 800, at: 0.3 }, times: [0.2, 0.8, 1.5], debug: true }],
};
