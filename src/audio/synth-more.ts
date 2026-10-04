// Chapter 2-5 and mode sounds (audio.md §3), all synthesised so they cost no bytes and need no
// licence: rubber bounces, SCORE (lob, shot, swish, duck squeak), spike cuts, cracking floors
// and snapping bridges, see-saw clunks, wood creaks, water (splash, paddle, bubbles, kraken),
// scissors (snip, whirr), fire (crackle, whumph, embers), smudger nibbles and squish, the Big
// Eraser (rub, thud, sharpener), the Daily puff, the Sumo bully (stomp) and the Sumo taiko.
// Every one-shot goes through budget() and follows slow-time pitch (worldRate); loops are built
// with makeLoop so they pitch down in slow time too. Frequent sounds jitter pitch and level.
import { audioCtx, buses, budget, duck, panTo, pitchJitter, rnd, worldRate, type Buses } from './mixer';
import { playSample } from './samples';
import { bell, filt, makeLoop, mtof, noiseAt, perc, poof, thump, whoosh, type LoopVoice } from './synth';

type Env = { c: AudioContext; b: Buses };
const ev = (): Env | null => {
  const c = audioCtx();
  const b = buses();
  return c && b ? { c, b } : null;
};

/** A short noise burst through a filter and a percussive envelope into `out`. */
function tick(c: AudioContext, out: AudioNode, t: number, type: BiquadFilterType, f: number, q: number, peak: number, dur: number) {
  const n = noiseAt(c, t, dur + 0.02);
  const fl = filt(c, type, f, q);
  const g = c.createGain();
  perc(g, t, peak, dur, 0.0007);
  n.connect(fl).connect(g).connect(out);
}

/** A sine that glides from f0 to f1 with a percussive envelope. */
function glide(c: AudioContext, out: AudioNode, t: number, f0: number, f1: number, dur: number, peak: number, type: OscillatorType = 'sine', attack = 0.003) {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur * 0.9);
  const g = c.createGain();
  perc(g, t, peak, dur, attack);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + dur + 0.04);
}

/** One water bubble: a short sine chirp, higher the smaller the bubble. */
function bubble(c: AudioContext, out: AudioNode, t: number, f: number, peak: number) {
  glide(c, out, t, f, f * 1.9, 0.07 + 500 / (f + 900) * 0.05, peak, 'sine', 0.006);
}

// ------------------------------------------------------------------ Chapters 2-3

/** A rubber ball hits something and bounces: a springy "doip" with a paper tick. strength 0..1. */
export function rubberBounce(x: number | undefined, strength: number, scale = 1) {
  const e = ev();
  if (!e || !budget('rbounce', 3, 0.16)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter() * scale;
  const out = panTo(b.world, x);
  const s = 0.35 + 0.65 * strength;
  glide(c, out, t, 440 * r, 150 * r, 0.12, 0.3 * s);
  glide(c, out, t, 880 * r, 330 * r, 0.07, 0.1 * s, 'triangle'); // upper-mid body for phone speakers
  tick(c, out, t, 'bandpass', 1900 * r, 1.1, 0.14 * s, 0.014);
  playSample('plop', { bus: b.world, x, db: -9 + 6 * strength, rate: 1.4 * r });
}

/** A little player lobs the SCORE ball up to a creature: a hand slap and a soft rising whoosh. */
export function ballLob(x?: number) {
  const e = ev();
  if (!e) return;
  playSample('thwap', { bus: e.b.world, x, db: -4, rate: 1.25 * worldRate() });
  whoosh(x, 60, 0.4, 0.3);
}

/** A creature shoots the ball at the hoop: a grunt-free "pomf" and a quick whoosh. */
export function ballShot(x?: number) {
  const e = ev();
  if (!e || !budget('shot', 2, 0.3)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter();
  glide(c, panTo(b.world, x), t, 260 * r, 120 * r, 0.1, 0.22);
  playSample('thwap', { bus: b.world, x, db: -2, rate: 0.9 * r });
  whoosh(x, 55, 0.7, 0.34);
}

/** A ball drops through the hoop: net swish plus a bell that climbs with the score. */
export function scoreSwish(x: number | undefined, n: number) {
  const e = ev();
  if (!e || !budget('swish', 2, 0.5)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const out = panTo(b.ui, x);
  // the swish: bright noise sweeping down through the net
  const nz = noiseAt(c, t, 0.4);
  const bp = filt(c, 'bandpass', 6200, 1.1);
  bp.frequency.setValueAtTime(6200, t);
  bp.frequency.exponentialRampToValueAtTime(2300, t + 0.26);
  const g = c.createGain();
  perc(g, t, 0.26, 0.3, 0.02);
  nz.connect(bp).connect(g).connect(out);
  // a rattle of the rim: two woody ticks
  tick(c, out, t + 0.02, 'bandpass', 1400, 2, 0.1, 0.02);
  tick(c, out, t + 0.07, 'bandpass', 1700, 2, 0.07, 0.02);
  // the bell: a pentatonic step up per point (clamped), then its fifth
  const steps = [72, 74, 76, 79, 81, 84];
  const m = steps[Math.max(0, Math.min(steps.length - 1, n - 1))];
  bell(c, b.ui, t + 0.06, mtof(m), 0.7, 0.16);
  bell(c, b.ui, t + 0.15, mtof(m + 7), 0.55, 0.1);
}

/** A rubber duck squeak: two quick chirps through a nasal formant. strength 0..1. */
export function duckSqueak(x?: number, strength = 1) {
  const e = ev();
  if (!e || !budget('duck', 2, 0.3)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter(0.08);
  const out = panTo(b.world, x);
  [
    [0, 1250, 2200, 0.1],
    [0.11, 1450, 1500, 0.09],
  ].forEach(([dt, f0, f1, d]) => {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(f0 * r, t + dt);
    o.frequency.exponentialRampToValueAtTime(f1 * r, t + dt + d * 0.8);
    const f = filt(c, 'bandpass', 2000 * r, 3);
    const g = c.createGain();
    perc(g, t + dt, 0.26 * (0.5 + 0.5 * strength), d + 0.03, 0.006);
    o.connect(f).connect(g).connect(out);
    o.start(t + dt);
    o.stop(t + dt + d + 0.06);
  });
}

/** Spikes cut a link: a sharp "shk" with a tiny metal tink. Not the lead snap. */
export function spikeCut(x?: number) {
  const e = ev();
  if (!e || !budget('spike', 3, 0.12)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter();
  const out = panTo(b.world, x);
  tick(c, out, t, 'highpass', 4200 * r, 0.8, 0.5, 0.05);
  glide(c, out, t, 2300 * r, 760 * r, 0.05, 0.14, 'triangle', 0.001);
  glide(c, out, t + 0.012, 3900 * r, 3800 * r, 0.12, 0.05, 'sine', 0.001);
}

/** A cracked floor gives way: a run of cracks, a heavy knock, then the pieces rumbling off. */
export function floorCrack(x: number | undefined, width = 200) {
  const e = ev();
  if (!e || !budget('floorcrack', 2, 0.9)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter();
  const out = panTo(b.world, x);
  const n = 4 + Math.min(4, Math.floor(width / 120));
  for (let i = 0; i < n; i++) {
    const dt = i * 0.028 + rnd(0, 0.02);
    tick(c, out, t + dt, 'bandpass', rnd(900, 2800) * r, 1.3, rnd(0.25, 0.5), rnd(0.012, 0.03));
  }
  glide(c, out, t + 0.02, 150 * r, 50 * r, 0.3, 0.42);
  playSample('thud', { bus: b.world, x, db: 1, rate: 0.7 * r });
  playSample('bonk', { bus: b.world, x, db: -6, rate: 0.55 * r, delay: 0.05 });
  // the slab breaks up and falls: low gravel rumble
  const nz = noiseAt(c, t + 0.1, 0.8);
  const lp = filt(c, 'lowpass', 700 * r, 0.8);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t + 0.1);
  g.gain.exponentialRampToValueAtTime(0.3, t + 0.2);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
  nz.connect(lp).connect(g).connect(out);
  duck(5, 0.15);
}

/** A rope bridge snaps: a low rope twang, a frayed rasp, then planks clattering down. */
export function bridgeSnap(x?: number) {
  const e = ev();
  if (!e || !budget('bridgesnap', 2, 0.9)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter();
  const out = panTo(b.world, x);
  // the twang: a plucked low string whose pitch falls as the rope goes slack
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(190 * r, t);
  o.frequency.exponentialRampToValueAtTime(95 * r, t + 0.35);
  const lp = filt(c, 'lowpass', 1500, 0.8);
  const g = c.createGain();
  perc(g, t, 0.36, 0.4, 0.002);
  o.connect(lp).connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.45);
  tick(c, out, t, 'highpass', 2400 * r, 0.8, 0.45, 0.12); // fibres parting
  // planks tumbling: a clatter of woody knocks, each lower and quieter
  for (let i = 0; i < 6; i++) {
    const dt = 0.1 + i * 0.07 + rnd(0, 0.05);
    glide(c, out, t + dt, rnd(520, 760) * r * (1 - i * 0.05), 190 * r, 0.07, 0.16 * (1 - i * 0.12), 'triangle', 0.001);
    tick(c, out, t + dt, 'bandpass', 1300 * r, 1.5, 0.12 * (1 - i * 0.1), 0.015);
  }
  playSample('thud', { bus: b.world, x, db: -3, rate: 0.9 * r, delay: 0.2 });
  duck(4, 0.1);
}

/** A see-saw plank meets its stop: a wooden clunk. strength 0..1. */
export function plankClunk(x: number | undefined, strength: number) {
  const e = ev();
  if (!e || !budget('clunk', 2, 0.2)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter();
  const s = 0.35 + 0.65 * strength;
  const out = panTo(b.world, x);
  glide(c, out, t, 230 * r, 105 * r, 0.14, 0.36 * s, 'triangle', 0.002);
  tick(c, out, t, 'bandpass', 950 * r, 1.2, 0.2 * s, 0.03);
  playSample('thud', { bus: b.world, x, db: -5 + 5 * strength, rate: 1.05 * r });
  playSample('bonk', { bus: b.world, x, db: -9 + 4 * strength, rate: 0.85 * r, delay: 0.01 });
}

/** Wood creak: a sawtooth through a sweeping resonant band with a stick-slip wobble. */
export function creak(x: number | undefined, strength = 0.5, f = 210) {
  const e = ev();
  if (!e || !budget('creak', 3, 0.35)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter(0.1);
  const dur = 0.22 + 0.2 * strength + rnd(0, 0.08);
  const base = f * r;
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(base, t);
  o.frequency.exponentialRampToValueAtTime(base * rnd(1.25, 1.7), t + dur * 0.55);
  o.frequency.exponentialRampToValueAtTime(base * rnd(0.85, 1.05), t + dur);
  const wob = c.createOscillator();
  wob.type = 'square';
  wob.frequency.value = rnd(26, 40);
  const wg = c.createGain();
  wg.gain.value = base * 0.12;
  wob.connect(wg).connect(o.frequency);
  const bp = filt(c, 'bandpass', base * 4.2, 5);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.1 + 0.12 * strength, t + dur * 0.25);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(bp).connect(g).connect(panTo(b.world, x));
  for (const n of [o, wob]) {
    n.start(t);
    n.stop(t + dur + 0.05);
  }
}

/** Wind and its fan: a gusting airy rush with a faint blade flutter. update(strength01). */
export function windLoop(): LoopVoice | null {
  return makeLoop((c, _b, src, out, stops) => {
    const hp = filt(c, 'highpass', 180, 0.6);
    const bp = filt(c, 'bandpass', 650, 0.7);
    const gust = c.createGain();
    gust.gain.value = 0.7;
    // slow gusting: two unrelated sines move the band and the level
    const l1 = c.createOscillator();
    l1.frequency.value = 0.37;
    const l1g = c.createGain();
    l1g.gain.value = 260;
    l1.connect(l1g).connect(bp.frequency);
    const l2 = c.createOscillator();
    l2.frequency.value = 0.23;
    const l2g = c.createGain();
    l2g.gain.value = 0.3;
    l2.connect(l2g).connect(gust.gain);
    l1.start();
    l2.start();
    stops.push(l1, l2);
    src.connect(hp).connect(bp).connect(gust).connect(out);
    // the fan: a higher band chopped at the blade rate, plus a thin motor hum
    const fb = filt(c, 'bandpass', 2100, 1.2);
    const fg = c.createGain();
    fg.gain.value = 0.2;
    const fl = c.createOscillator();
    fl.type = 'triangle';
    fl.frequency.value = 19;
    const fa = c.createGain();
    fa.gain.value = 0.18;
    fl.connect(fa).connect(fg.gain);
    fl.start();
    stops.push(fl);
    src.connect(fb).connect(fg).connect(out);
    const hum = c.createOscillator();
    hum.type = 'triangle';
    hum.frequency.value = 118;
    const hg = c.createGain();
    hg.gain.value = 0.03;
    hum.connect(hg).connect(out);
    hum.start();
    stops.push(hum);
    return (a, _b2, t) => {
      out.gain.setTargetAtTime(0.2 * a, t, 0.25);
      bp.Q.setTargetAtTime(0.6 + 0.4 * (1 - a), t, 0.2);
    };
  });
}

// ------------------------------------------------------------------ Chapter 4: water

/** Something drops into water: a soft splash, a few bubbles and a plop. strength 0..1, scale = size. */
export function splash(x: number | undefined, strength: number, scale = 1) {
  const e = ev();
  if (!e || !budget('splash', 3, 0.5)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter(0.08) * Math.max(0.6, Math.min(1.5, scale));
  const s = 0.3 + 0.7 * strength;
  const out = panTo(b.world, x);
  const nz = noiseAt(c, t, 0.5);
  const bp = filt(c, 'bandpass', 1500 * r, 0.7);
  bp.frequency.setValueAtTime(2400 * r, t);
  bp.frequency.exponentialRampToValueAtTime(700 * r, t + 0.4);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.4 * s, t + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.18 + 0.3 * s);
  nz.connect(bp).connect(g).connect(out);
  const n = 2 + Math.round(3 * strength);
  for (let i = 0; i < n; i++) bubble(c, out, t + 0.05 + i * rnd(0.04, 0.09), rnd(380, 1100) * r, 0.1 * s);
  playSample('plop', { bus: b.world, x, db: -3 + 4 * strength, rate: 0.75 * r });
}

/** One gentle paddling stroke: a soft slosh and a bubble. */
export function slosh(x: number | undefined, strength = 0.5) {
  const e = ev();
  if (!e || !budget('slosh', 2, 0.3)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter(0.1);
  const out = panTo(b.world, x);
  const nz = noiseAt(c, t, 0.3);
  const bp = filt(c, 'bandpass', 650 * r, 0.9);
  bp.frequency.setValueAtTime(650 * r, t);
  bp.frequency.exponentialRampToValueAtTime(1250 * r, t + 0.14);
  const lp = filt(c, 'lowpass', 1800, 0.5);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.1 + 0.1 * strength, t + 0.09);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.26);
  nz.connect(bp).connect(lp).connect(g).connect(out);
  if (Math.random() < 0.6) bubble(c, out, t + rnd(0.05, 0.16), rnd(500, 900) * r, 0.05);
}

/** Little Guy drowning: a muffled stream of bubbles that thins out and rises. */
export function drownBubbles(x?: number, delay = 0.15) {
  const e = ev();
  if (!e || !budget('drown', 1, 1.6)) return;
  const { c, b } = e;
  const t = c.currentTime + delay;
  const lp = filt(c, 'lowpass', 2400, 0.6);
  lp.connect(panTo(b.world, x));
  let at = 0;
  let k = 0;
  while (at < 1.3) {
    const f = rnd(260, 520) * (1 + k * 0.05);
    bubble(c, lp, t + at, f, 0.16 * (1 - at / 1.6));
    at += rnd(0.05, 0.13) * (1 + at * 0.9);
    k++;
  }
  // a low "glub" under it
  glide(c, lp, t, 190, 90, 0.3, 0.2);
  glide(c, lp, t + 0.45, 160, 80, 0.3, 0.12);
}

/** A kraken tentacle rising: a low gloopy swell with bubbles. */
export function tentacleRise(x?: number, strength = 1) {
  const e = ev();
  if (!e || !budget('trise', 2, 0.8)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter(0.06);
  const out = panTo(b.world, x);
  glide(c, out, t, 70 * r, 150 * r, 0.6, 0.3 * strength, 'sine', 0.2);
  const nz = noiseAt(c, t, 0.7);
  const lp = filt(c, 'lowpass', 520 * r, 0.8);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.22 * strength, t + 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  nz.connect(lp).connect(g).connect(out);
  for (let i = 0; i < 4; i++) bubble(c, out, t + 0.1 + i * rnd(0.08, 0.14), rnd(220, 480) * r, 0.1 * strength);
  tick(c, out, t + 0.15, 'bandpass', 900 * r, 1, 0.12 * strength, 0.2); // an upper-mid slither so phones hear it
}

/** The tentacle latches onto Little Guy: a wet "thwup" and a squeezing creak. */
export function tentacleLatch(x?: number) {
  const e = ev();
  if (!e || !budget('tlatch', 2, 0.5)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter(0.06);
  const out = panTo(b.world, x);
  glide(c, out, t, 300 * r, 100 * r, 0.12, 0.3);
  tick(c, out, t, 'bandpass', 700 * r, 0.9, 0.3, 0.06);
  playSample('thwap', { bus: b.world, x, db: 0, rate: 0.7 * r });
  creak(x, 0.7, 150);
}

/** The slurp when a tentacle lets go: a fast gurgle that swoops up and falls away. */
export function tentacleSlurp(x?: number) {
  const e = ev();
  if (!e || !budget('tslurp', 2, 0.5)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter(0.06);
  const out = panTo(b.world, x);
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(160 * r, t);
  o.frequency.exponentialRampToValueAtTime(760 * r, t + 0.16);
  o.frequency.exponentialRampToValueAtTime(190 * r, t + 0.4);
  const lfo = c.createOscillator();
  lfo.frequency.value = 22;
  const lg = c.createGain();
  lg.gain.value = 70 * r;
  lfo.connect(lg).connect(o.frequency);
  const g = c.createGain();
  perc(g, t, 0.3, 0.42, 0.02);
  o.connect(g).connect(out);
  for (const n of [o, lfo]) {
    n.start(t);
    n.stop(t + 0.46);
  }
  const nz = noiseAt(c, t, 0.4);
  const bp = filt(c, 'bandpass', 1100 * r, 2);
  bp.frequency.setValueAtTime(500 * r, t);
  bp.frequency.exponentialRampToValueAtTime(1800 * r, t + 0.18);
  bp.frequency.exponentialRampToValueAtTime(600 * r, t + 0.4);
  const ng = c.createGain();
  perc(ng, t, 0.14, 0.38, 0.03);
  nz.connect(bp).connect(ng).connect(out);
  for (let i = 0; i < 3; i++) bubble(c, out, t + 0.28 + i * 0.07, rnd(300, 700) * r, 0.08);
  playSample('plop', { bus: b.world, x, db: -4, rate: 0.6 * r, delay: 0.3 });
}

// ------------------------------------------------------------------ Chapter 5: damage

/** One scissor snip: two quick metallic slides. strength 0..1. */
export function snip(x?: number, strength = 0.8) {
  const e = ev();
  if (!e || !budget('snip', 3, 0.12)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter(0.07);
  const out = panTo(b.world, x);
  const s = 0.5 + 0.5 * strength;
  // blades sliding: a hissy "shff" then the close "tk"
  tick(c, out, t, 'highpass', 5200 * r, 0.8, 0.28 * s, 0.045);
  tick(c, out, t + 0.05, 'bandpass', 3400 * r, 3, 0.4 * s, 0.014);
  for (const [f, pk] of [
    [3300, 0.1],
    [4700, 0.06],
  ] as const)
    glide(c, out, t + 0.05, f * r, f * r * 0.99, 0.09, pk * s, 'sine', 0.0007);
}

/** Flying scissors: a thin buzzing whirr. update(speed01). */
export function whirrLoop(): LoopVoice | null {
  return makeLoop((c, _b, src, out, stops) => {
    const bp = filt(c, 'bandpass', 1900, 2);
    const am = c.createGain();
    am.gain.value = 0.5;
    const lfo = c.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 26;
    const la = c.createGain();
    la.gain.value = 0.45;
    lfo.connect(la).connect(am.gain);
    src.connect(bp).connect(am).connect(out);
    lfo.start();
    stops.push(lfo);
    // a motory buzz under it
    const saw = c.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = 230;
    const sl = filt(c, 'lowpass', 900, 0.7);
    const sg = c.createGain();
    sg.gain.value = 0;
    saw.connect(sl).connect(sg).connect(out);
    saw.start();
    stops.push(saw);
    return (a, _b2, t) => {
      out.gain.setTargetAtTime(0.22 * a, t, 0.08);
      bp.frequency.setTargetAtTime(1500 + 1100 * a, t, 0.1);
      lfo.frequency.setTargetAtTime(20 + 12 * a, t, 0.1);
      saw.frequency.setTargetAtTime(190 + 90 * a, t, 0.1);
      sg.gain.setTargetAtTime(0.1 * a, t, 0.1);
    };
  });
}

/** Floor fire: a soft roar with random pops. update(intensity01). */
export function crackleLoop(): LoopVoice | null {
  return makeLoop((c, _b, src, out) => {
    // the bed: a low-passed flutter
    const lp = filt(c, 'lowpass', 520, 0.6);
    const lg = c.createGain();
    lg.gain.value = 0.5;
    src.connect(lp).connect(lg).connect(out);
    // the pops: high-passed noise gated by a random level each frame
    const hp = filt(c, 'bandpass', 3000, 0.8);
    const pg = c.createGain();
    pg.gain.value = 0;
    src.connect(hp).connect(pg).connect(out);
    return (a, _b2, t) => {
      out.gain.setTargetAtTime(0.1 * a, t, 0.1);
      const pop = Math.random() < 0.1 + 0.2 * a;
      hp.frequency.setTargetAtTime(rnd(1800, 6500), t, 0.003);
      pg.gain.setTargetAtTime(pop ? rnd(0.8, 2.2) : 0.04, t, pop ? 0.002 : 0.012);
    };
  });
}

/** Ink catches fire: a low "whumph" with an upper-mid "fff". */
export function whumph(x?: number) {
  const e = ev();
  if (!e || !budget('whumph', 2, 0.5)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter(0.06);
  const out = panTo(b.world, x);
  const nz = noiseAt(c, t, 0.6);
  const lp = filt(c, 'lowpass', 900 * r, 0.7);
  lp.frequency.setValueAtTime(900 * r, t);
  lp.frequency.exponentialRampToValueAtTime(220 * r, t + 0.45);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.4, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
  nz.connect(lp).connect(g).connect(out);
  glide(c, out, t, 120 * r, 46 * r, 0.35, 0.4, 'sine', 0.01);
  tick(c, out, t, 'bandpass', 2600 * r, 0.8, 0.16, 0.2);
  duck(4, 0.1);
}

/** A burnt point crumbles: a very small ember tick. */
export function ember(x?: number) {
  const e = ev();
  if (!e || !budget('ember', 3, 0.1)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter(0.12);
  tick(c, panTo(b.world, x), t, 'bandpass', rnd(2000, 4200) * r, 1.2, 0.1, 0.018);
}

/** A smudger nibbles ink: a tiny rubbery crunch. */
export function nibble(x?: number) {
  const e = ev();
  if (!e || !budget('nibble', 3, 0.1)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter(0.1);
  const out = panTo(b.world, x);
  tick(c, out, t, 'bandpass', 2300 * r, 1.4, 0.22, 0.025);
  tick(c, out, t + 0.035, 'bandpass', 1700 * r, 1.4, 0.16, 0.025);
  glide(c, out, t, 1500 * r, 1950 * r, 0.05, 0.05, 'sine', 0.004);
}

/** A smudger stomped flat: a wet rubber squish, a little "eep" and a plop. */
export function squish(x?: number) {
  const e = ev();
  if (!e || !budget('squish', 2, 0.3)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter(0.07);
  const out = panTo(b.world, x);
  glide(c, out, t, 300 * r, 65 * r, 0.18, 0.26, 'sine', 0.004);
  tick(c, out, t, 'lowpass', 700 * r, 0.8, 0.28, 0.12);
  glide(c, out, t + 0.01, 1050 * r, 1700 * r, 0.06, 0.12, 'triangle', 0.004);
  playSample('plop', { bus: b.world, x, db: -2, rate: 0.62 * r });
  playSample('thwap', { bus: b.world, x, db: -7, rate: 0.8 * r });
}

/** The Big Eraser rubbing along the page: stick-slip rubber squeak. update(effort01). */
export function rubLoop(): LoopVoice | null {
  return makeLoop((c, _b, src, out, stops) => {
    const bp = filt(c, 'bandpass', 1100, 5);
    const bg = c.createGain();
    bg.gain.value = 0;
    // stick-slip: the squeak chops on and off
    const lfo = c.createOscillator();
    lfo.type = 'triangle';
    lfo.frequency.value = 9;
    const la = c.createGain();
    la.gain.value = 0.6;
    lfo.connect(la).connect(bg.gain);
    src.connect(bp).connect(bg).connect(out);
    lfo.start();
    stops.push(lfo);
    // the squeal itself: a thin sine that slides with the push
    const sq = c.createOscillator();
    sq.type = 'sine';
    sq.frequency.value = 1350;
    const sg = c.createGain();
    sg.gain.value = 0;
    const am = c.createOscillator();
    am.type = 'triangle';
    am.frequency.value = 7;
    const ag = c.createGain();
    ag.gain.value = 0.05;
    am.connect(ag).connect(sg.gain);
    sq.connect(sg).connect(out);
    sq.start();
    am.start();
    stops.push(sq, am);
    // a low scuff for body
    const lp = filt(c, 'lowpass', 300, 0.7);
    const lg = c.createGain();
    lg.gain.value = 0.4;
    src.connect(lp).connect(lg).connect(out);
    return (a, strain, t) => {
      out.gain.setTargetAtTime(0.24 * a, t, 0.1);
      bp.frequency.setTargetAtTime(900 + 900 * a + 500 * strain, t, 0.08);
      bg.gain.setTargetAtTime(0.5, t, 0.1);
      lfo.frequency.setTargetAtTime(7 + 9 * a, t, 0.1);
      sq.frequency.setTargetAtTime(1150 + 500 * a + 500 * strain, t, 0.08);
      sg.gain.setTargetAtTime(0.09 + 0.1 * strain, t, 0.1);
      am.frequency.setTargetAtTime(5 + 6 * a, t, 0.1);
    };
  });
}

/** The Big Eraser lands from a hop: a big paper-and-rubber thud. */
export function eraserThud(x?: number) {
  const e = ev();
  if (!e || !budget('ethud', 2, 0.5)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter(0.05);
  thump(x, 1, 520);
  glide(c, panTo(b.world, x), t, 95 * r, 38 * r, 0.4, 0.3, 'sine', 0.006);
  tick(c, panTo(b.world, x), t, 'lowpass', 420 * r, 0.8, 0.2, 0.3);
  playSample('bonk', { bus: b.world, x, db: -4, rate: 0.5 * r });
  duck(6, 0.2);
}

/** The pencil sharpener grinding the Big Eraser: motor whine, scraping shavings. update(on01). */
export function sharpenLoop(): LoopVoice | null {
  return makeLoop((c, _b, src, out, stops) => {
    const saw = c.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = 150;
    const sl = filt(c, 'lowpass', 1100, 0.9);
    const sg = c.createGain();
    sg.gain.value = 0.3;
    saw.connect(sl).connect(sg).connect(out);
    saw.start();
    stops.push(saw);
    // the whine rising as it bites
    const whine = c.createOscillator();
    whine.type = 'triangle';
    whine.frequency.value = 820;
    const wg = c.createGain();
    wg.gain.value = 0.07;
    whine.connect(wg).connect(out);
    whine.start();
    stops.push(whine);
    // shavings: gritty noise chopped at the blade rate
    const bp = filt(c, 'bandpass', 3000, 1.1);
    const gg = c.createGain();
    gg.gain.value = 0;
    const lfo = c.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 38;
    const la = c.createGain();
    la.gain.value = 0.5;
    lfo.connect(la).connect(gg.gain);
    lfo.start();
    stops.push(lfo);
    const gb = c.createGain();
    gb.gain.value = 0.5;
    src.connect(bp).connect(gg).connect(gb).connect(out);
    return (a, _b2, t) => {
      out.gain.setTargetAtTime(0.22 * a, t, 0.06);
      saw.frequency.setTargetAtTime(120 + 90 * a + 20 * Math.sin(t * 7), t, 0.1);
      whine.frequency.setTargetAtTime(700 + 260 * a, t, 0.15);
      lfo.frequency.setTargetAtTime(30 + 14 * a, t, 0.1);
    };
  });
}

/** A hit on a threat that is not a punch: a bonk with a ring for scissors, a thunk for the boss. */
export function knockHit(x: number | undefined, kind: 'scissors' | 'eraser' | 'ninja') {
  const e = ev();
  if (!e || !budget('knock', 3, 0.3)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter(0.07);
  const out = panTo(b.world, x);
  if (kind === 'scissors') {
    playSample('bonk', { bus: b.world, x, db: -5, rate: 1.3 * r });
    for (const [f, pk, d] of [
      [2400, 0.12, 0.3],
      [3150, 0.08, 0.22],
      [4300, 0.04, 0.15],
    ] as const)
      glide(c, out, t, f * r, f * r, d, pk, 'sine', 0.0007);
    tick(c, out, t, 'highpass', 4800 * r, 0.8, 0.2, 0.02);
  } else if (kind === 'eraser') {
    playSample('bonk', { bus: b.world, x, db: -2, rate: 0.65 * r });
    glide(c, out, t, 180 * r, 80 * r, 0.14, 0.3, 'sine', 0.002);
    duck(5, 0.12);
  } else {
    playSample('bonk', { bus: b.world, x, db: -4, rate: 1.05 * r });
    glide(c, out, t, 260 * r, 120 * r, 0.08, 0.14);
  }
}

// ------------------------------------------------------------------ modes

/** A Daily modifier turns a creature away: a puff, a falling slide-whistle and a tiny pop. */
export function ruleBreakPuff(x?: number) {
  const e = ev();
  if (!e || !budget('rulebreak', 2, 0.5)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter(0.05);
  poof(x, 0.55);
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(980 * r, t + 0.04);
  o.frequency.exponentialRampToValueAtTime(260 * r, t + 0.42);
  const vib = c.createOscillator();
  vib.frequency.value = 9;
  const vg = c.createGain();
  vg.gain.value = 24;
  vib.connect(vg).connect(o.frequency);
  const g = c.createGain();
  perc(g, t + 0.04, 0.14, 0.42, 0.02);
  o.connect(g).connect(panTo(b.world, x));
  for (const n of [o, vib]) {
    n.start(t + 0.04);
    n.stop(t + 0.5);
  }
  bell(c, b.world, t + 0.46, mtof(88), 0.25, 0.04);
}

/** The Sumo bully stamps: a heavy foot with dust. strength 0..1. */
export function bullyStomp(x: number | undefined, strength = 1) {
  const e = ev();
  if (!e || !budget('bstomp', 2, 0.3)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter(0.05);
  thump(x, 0.55 + 0.45 * strength, 560);
  glide(c, panTo(b.world, x), t, 80 * r, 36 * r, 0.3, 0.22 * strength, 'sine', 0.004);
  tick(c, panTo(b.world, x), t + 0.02, 'lowpass', 600 * r, 0.8, 0.16 * strength, 0.2); // dust
  if (strength > 0.8) duck(3, 0.1);
}

/** Both Sumo sides wake: two taiko hits and a wooden clap. Ducks the music. */
export function sumoStart() {
  const e = ev();
  if (!e) return;
  const { c, b } = e;
  const t = c.currentTime;
  const hit = (dt: number, f: number, pk: number) => {
    glide(c, b.ui, t + dt, f * 1.9, f, 0.32, pk, 'sine', 0.003);
    glide(c, b.ui, t + dt, f * 3.1, f * 2.2, 0.12, pk * 0.3, 'triangle', 0.002); // upper-mid for phone speakers
    tick(c, b.ui, t + dt, 'bandpass', 1300, 0.9, pk * 0.55, 0.05); // the skin
  };
  hit(0, 78, 0.5);
  hit(0.17, 78, 0.35);
  hit(0.34, 62, 0.58);
  // the clap: three close wooden clacks
  for (let i = 0; i < 3; i++) {
    const tt = t + 0.56 + i * 0.012;
    tick(c, b.ui, tt, 'bandpass', 2600 + i * 300, 2.5, 0.3, 0.02);
  }
  glide(c, b.ui, t + 0.56, 1350, 640, 0.05, 0.18, 'square', 0.0008);
  duck(6, 0.4);
}
