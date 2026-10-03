// Scenario lists for `npm run shots`. Each entry is one contact sheet.
const T = [0, 0.5, 1, 2, 3.5];
export const SHOTS: Record<string, any[]> = {
  bodies: [
    { label: 'stick', draw: [{ canon: 'stick700', x: 200 }, { canon: 'spider', x: 520 }], target: { x: 600, y: 700, at: 0.5 }, times: T },
    { label: 'worm+box', draw: [{ canon: 'worm', x: 160 }, { canon: 'box', x: 520 }], target: { x: 600, y: 900, at: 0.5 }, times: T },
    { label: 'hopper+bruiser', draw: [{ canon: 'hopper', x: 160 }, { canon: 'bruiser', x: 500 }], target: { x: 600, y: 700, at: 0.5 }, times: T },
  ],
  worm: [
    { label: 'worm', draw: [{ canon: 'worm', x: 150 }], target: { x: 700, y: 1150, at: 0 }, times: [0.6, 0.8, 1.0, 1.2, 1.4, 1.6], crop: { x: 0, y: 1080, w: 260, h: 130, follow: true } },
  ],
  gait: [
    { label: 'stick', draw: [{ canon: 'stick700', x: 150 }], target: { x: 700, y: 1150, at: 0 }, times: [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3], crop: { x: 0, y: 830, w: 360, h: 380, follow: true } },
    { label: 'spider', draw: [{ canon: 'spider', x: 150 }], target: { x: 700, y: 1150, at: 0 }, times: [0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3], crop: { x: 0, y: 830, w: 360, h: 380, follow: true } },
  ],
  giant: [{ label: 'giant', draw: [{ canon: 'giant', x: 300 }], target: { x: 600, y: 300, at: 0.5 }, times: T }],
  birth: [{ label: 'birth', draw: [{ canon: 'stick700', x: 360 }], wet: true, times: [0, 0, 0.02, 0.08, 0.14, 0.22, 0.32, 0.6], crop: { x: 240, y: 880, w: 240, h: 240 } }],
  debug: [{ label: 'debug', draw: [{ canon: 'reacher', x: 200 }, { canon: 'hopper', x: 520 }], target: { x: 420, y: 800, at: 0.3 }, times: [0.2, 0.8, 1.5], debug: true }],
};
