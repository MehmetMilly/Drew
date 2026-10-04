// Synthesised sounds (audio.md §3): the snap, boing, whoosh, boom, grip squeak, poof, steps,
// stamp and stings, plus the continuous loops (boulder rumble, crusher grind, bomb fuse hiss,
// room tone). Every one-shot takes a world x for panning and follows the slow-time pitch
// (worldRate) so a sound that fires while the pen is down comes out low and heavy.
import { audioCtx, buses, budget, duck, noise, panTo, pitchJitter, rnd, worldRate, type Buses } from './mixer';
import { playSample } from './samples';

type Env = { c: AudioContext; b: Buses };
const ev = (): Env | null => {
  const c = audioCtx();
  const b = buses();
  return c && b ? { c, b } : null;
};

// ------------------------------------------------------------------ small kit

export function noiseAt(c: AudioContext, t: number, dur: number): AudioBufferSourceNode {
  const s = c.createBufferSource();
  s.buffer = noise();
  s.start(t, rnd(0, 1.6), dur);
  return s;
}

export function filt(c: AudioContext, type: BiquadFilterType, f: number, q = 0.7) {
  const n = c.createBiquadFilter();
  n.type = type;
  n.frequency.value = f;
  n.Q.value = q;
  return n;
}

/** Percussive envelope: instant-ish attack to peak, exponential fall. */
export function perc(g: GainNode, t: number, peak: number, dur: number, attack = 0.002) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
}

export const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

/** A plucked string: triangle through a closing low-pass (pizzicato, ukulele, bass). */
export function pluck(c: AudioContext, dest: AudioNode, t: number, freq: number, dur: number, gain: number, bright = 3000, type: OscillatorType = 'triangle') {
  const o = c.createOscillator();
  o.type = type;
  o.frequency.value = freq;
  const f = filt(c, 'lowpass', bright, 0.5);
  f.frequency.setValueAtTime(bright, t);
  f.frequency.exponentialRampToValueAtTime(Math.max(260, freq * 1.1), t + dur * 0.55);
  const g = c.createGain();
  perc(g, t, gain, dur, 0.003);
  o.connect(f).connect(g).connect(dest);
  o.start(t);
  o.stop(t + dur + 0.05);
}

/** Glockenspiel: a sine with a bright inharmonic partial that dies faster. */
export function bell(c: AudioContext, dest: AudioNode, t: number, freq: number, dur: number, gain: number) {
  for (const [mul, gm, d] of [
    [1, 1, dur],
    [2.76, 0.35, dur * 0.4],
  ] as const) {
    const o = c.createOscillator();
    o.frequency.value = freq * mul;
    const g = c.createGain();
    perc(g, t, gain * gm, d, 0.002);
    o.connect(g).connect(dest);
    o.start(t);
    o.stop(t + d + 0.05);
  }
}

// ------------------------------------------------------------------ one-shots (world)

/** Pencil-lead snap, then a tiny "!" bloop. strength 0..1. */
export function snap(x?: number, strength = 0.7) {
  const e = ev();
  if (!e || !budget('snap', 4, 0.2)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter();
  const out = c.createGain();
  out.gain.value = 0.7;
  out.connect(panTo(b.world, x));
  // the crack: a very short bright noise burst, then a second tick as the lead parts
  for (const [dt, f, pk, d] of [
    [0, 3200, 0.8, 0.018],
    [0.012 + rnd(0, 0.01), 2300, 0.45, 0.02],
  ] as const) {
    const n = noiseAt(c, t + dt, d + 0.01);
    const hp = filt(c, 'highpass', f * r, 0.9);
    const g = c.createGain();
    perc(g, t + dt, pk * (0.55 + 0.45 * strength), d, 0.0006);
    n.connect(hp).connect(g).connect(out);
  }
  // lead "tock" for upper-mid body so it reads on phone speakers
  const tk = c.createOscillator();
  tk.type = 'square';
  tk.frequency.setValueAtTime(900 * r, t);
  tk.frequency.exponentialRampToValueAtTime(420 * r, t + 0.02);
  const tg = c.createGain();
  perc(tg, t, 0.12 * strength, 0.025, 0.0008);
  tk.connect(tg).connect(out);
  tk.start(t);
  tk.stop(t + 0.04);
  bloop(x, 780, 0.05 + rnd(0, 0.015), 0.16 * (0.6 + 0.4 * strength));
}

/** A small rising sine "bloop" (the "!" after a snap, a severed limb waking). */
export function bloop(x: number | undefined, f: number, delay = 0, gain = 0.2, bus: 'world' | 'creatures' | 'ui' = 'world') {
  const e = ev();
  if (!e) return;
  const { c, b } = e;
  const t = c.currentTime + delay;
  const r = (bus === 'world' ? worldRate() : 1) * pitchJitter();
  const o = c.createOscillator();
  o.frequency.setValueAtTime(f * r, t);
  o.frequency.exponentialRampToValueAtTime(f * 1.55 * r, t + 0.07);
  const g = c.createGain();
  perc(g, t, gain, 0.12, 0.008);
  o.connect(g).connect(panTo(b[bus], x));
  o.start(t);
  o.stop(t + 0.15);
}

/** Cartoon boing: pitch-bent sine with wobble. Bigger creatures boing lower. */
export function boing(x?: number, size = 150, strength = 1) {
  const e = ev();
  if (!e || !budget('boing', 3, 0.5)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter();
  const f0 = Math.max(120, Math.min(520, 330 * Math.pow(150 / Math.max(size, 40), 0.4))) * r;
  const out = panTo(b.world, x);
  const dur = 0.5;
  // main tone: dips, springs up, then wobbles down
  const o = c.createOscillator();
  o.type = 'sine';
  o.frequency.setValueAtTime(f0 * 0.75, t);
  o.frequency.exponentialRampToValueAtTime(f0 * 2.0, t + 0.055);
  o.frequency.exponentialRampToValueAtTime(f0 * 0.95, t + dur);
  const vib = c.createOscillator();
  vib.frequency.value = 12 + rnd(-1, 1);
  const vg = c.createGain();
  vg.gain.setValueAtTime(0, t);
  vg.gain.linearRampToValueAtTime(f0 * 0.16, t + 0.1);
  vg.gain.exponentialRampToValueAtTime(0.5, t + dur);
  vib.connect(vg).connect(o.frequency);
  const g = c.createGain();
  perc(g, t, 0.34 * strength, dur, 0.006);
  o.connect(g).connect(out);
  // rubbery overtone (octave triangle) so the boing has a body above 800 Hz
  const o2 = c.createOscillator();
  o2.type = 'triangle';
  o2.frequency.setValueAtTime(f0 * 1.5, t);
  o2.frequency.exponentialRampToValueAtTime(f0 * 4.0, t + 0.055);
  o2.frequency.exponentialRampToValueAtTime(f0 * 1.9, t + dur * 0.8);
  const g2 = c.createGain();
  perc(g2, t, 0.1 * strength, dur * 0.8, 0.006);
  o2.connect(g2).connect(out);
  for (const n of [o, o2, vib]) {
    n.start(t);
    n.stop(t + dur + 0.05);
  }
}

/** Throw / leap whoosh: band-passed noise sweeping up then down. */
export function whoosh(x?: number, size = 150, strength = 1, dur = 0.34) {
  const e = ev();
  if (!e || !budget('whoosh', 3, dur)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter() * Math.max(0.55, Math.min(1.4, Math.pow(150 / Math.max(size, 50), 0.25)));
  const n = noiseAt(c, t, dur + 0.05);
  const bp = filt(c, 'bandpass', 380 * r, 0.9);
  bp.frequency.setValueAtTime(380 * r, t);
  bp.frequency.exponentialRampToValueAtTime(2000 * r, t + dur * 0.4);
  bp.frequency.exponentialRampToValueAtTime(800 * r, t + dur);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.55 * strength, t + dur * 0.38);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(bp).connect(g).connect(panTo(b.world, x));
}

/** Rubbery grip squeak as a hand closes on something. */
export function gripSqueak(x?: number) {
  const e = ev();
  if (!e || !budget('grip', 3, 0.2)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter();
  const o = c.createOscillator();
  o.type = 'sawtooth';
  o.frequency.setValueAtTime(620 * r, t);
  o.frequency.exponentialRampToValueAtTime(1150 * r, t + 0.07);
  o.frequency.exponentialRampToValueAtTime(930 * r, t + 0.17);
  const lfo = c.createOscillator();
  lfo.frequency.value = 30;
  const lg = c.createGain();
  lg.gain.value = 60 * r;
  lfo.connect(lg).connect(o.frequency);
  const bp = filt(c, 'bandpass', 1500 * r, 5);
  const g = c.createGain();
  perc(g, t, 0.34, 0.18, 0.01);
  o.connect(bp).connect(g).connect(panTo(b.world, x));
  o.start(t);
  lfo.start(t);
  o.stop(t + 0.22);
  lfo.stop(t + 0.22);
  // the wet slap of the hand
  playSample('plop', { bus: b.world, x, db: -4, rate: 1.2 * r });
}

/** Bomb: noise boom, sub thump, scribble rasp, upper-mid crack. Ducks music 8 dB. */
export function boom(x?: number) {
  const e = ev();
  if (!e || !budget('boom', 2, 0.9)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter(0.04);
  // the blast is summed hot; trim the whole bus of it so it peaks near the other loud hits
  const out = c.createGain();
  out.gain.value = 0.42;
  out.connect(panTo(b.world, x));
  // body
  const n = noiseAt(c, t, 1.0);
  const lp = filt(c, 'lowpass', 2800 * r, 0.8);
  lp.frequency.setValueAtTime(2800 * r, t);
  lp.frequency.exponentialRampToValueAtTime(170 * r, t + 0.75);
  const ng = c.createGain();
  perc(ng, t, 1.0, 0.95, 0.003);
  n.connect(lp).connect(ng).connect(out);
  // sub
  const s = c.createOscillator();
  s.frequency.setValueAtTime(120 * r, t);
  s.frequency.exponentialRampToValueAtTime(38 * r, t + 0.5);
  const sg = c.createGain();
  perc(sg, t, 0.9, 0.6, 0.004);
  s.connect(sg).connect(out);
  s.start(t);
  s.stop(t + 0.7);
  // crack (phone speakers: all the weight above 1 kHz)
  const k = noiseAt(c, t, 0.12);
  const kh = filt(c, 'bandpass', 1900 * r, 0.8);
  const kg = c.createGain();
  perc(kg, t, 0.8, 0.09, 0.001);
  k.connect(kh).connect(kg).connect(out);
  // scribble rasp: noise chopped by a fast square, the only "digital" sound in the game
  const rsp = noiseAt(c, t + 0.02, 0.4);
  const rb = filt(c, 'bandpass', 2900 * r, 1.1);
  const rg = c.createGain();
  rg.gain.value = 0;
  const chop = c.createOscillator();
  chop.type = 'square';
  chop.frequency.value = 52;
  const cg = c.createGain();
  cg.gain.value = 0.2;
  chop.connect(cg).connect(rg.gain);
  const renv = c.createGain();
  perc(renv, t + 0.02, 0.5, 0.35, 0.004);
  rsp.connect(rb).connect(rg).connect(renv).connect(out);
  chop.start(t);
  chop.stop(t + 0.5);
  playSample('thud', { bus: b.world, x, db: -2, rate: 0.5 * r });
  playSample('bonk', { bus: b.world, x, db: -7, rate: 0.6 * r, delay: 0.01 });
  duck(8, 0.25);
}

/** A soft poof (dust). strength 0..1. */
export function poof(x?: number, strength = 0.5) {
  const e = ev();
  if (!e || !budget('poof', 3, 0.35)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter();
  const n = noiseAt(c, t, 0.4);
  const bp = filt(c, 'bandpass', 950 * r, 0.6);
  bp.frequency.setValueAtTime(950 * r, t);
  bp.frequency.exponentialRampToValueAtTime(380 * r, t + 0.28);
  const g = c.createGain();
  perc(g, t, 0.16 + 0.3 * strength, 0.3, 0.012);
  n.connect(bp).connect(g).connect(panTo(b.world, x));
  playSample('plop', { bus: b.world, x, db: -3 + 4 * strength, rate: 1.05 * r });
  if (strength > 0.8) duck(6, 0.1);
}

/** Landing / body thud. strength 0..1 (impact speed), size in px (bigger = lower). */
export function thump(x: number | undefined, strength: number, size = 150) {
  const e = ev();
  if (!e || !budget('thump', 4, 0.3)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter();
  const sizeR = Math.max(0.5, Math.min(1.5, Math.pow(150 / Math.max(size, 50), 0.35)));
  const out = panTo(b.world, x);
  playSample('thud', { bus: b.world, x, db: -9 + 11 * strength, rate: sizeR * r });
  // synth layer: a low sine knock plus a paper tick so a quiet thud still reads on a phone
  const o = c.createOscillator();
  o.frequency.setValueAtTime(170 * sizeR * r, t);
  o.frequency.exponentialRampToValueAtTime(65 * sizeR * r, t + 0.1);
  const g = c.createGain();
  perc(g, t, 0.16 + 0.34 * strength, 0.14, 0.003);
  o.connect(g).connect(out);
  o.start(t);
  o.stop(t + 0.18);
  const n = noiseAt(c, t, 0.05);
  const bp = filt(c, 'bandpass', 1500 * r, 1.2);
  const ng = c.createGain();
  perc(ng, t, 0.1 + 0.2 * strength, 0.04, 0.001);
  n.connect(bp).connect(ng).connect(out);
}

/** Cardboard bonk (a punch landing). */
export function bonk(x?: number, strength = 1) {
  const e = ev();
  if (!e || !budget('bonk', 4, 0.3)) return;
  const { c, b } = e;
  const r = worldRate();
  playSample('bonk', { bus: b.world, x, db: -2 + 2 * strength, rate: r });
  // short sine tock beneath it
  const t = c.currentTime;
  const o = c.createOscillator();
  o.frequency.setValueAtTime(280 * r * pitchJitter(), t);
  o.frequency.exponentialRampToValueAtTime(130 * r, t + 0.07);
  const g = c.createGain();
  perc(g, t, 0.2 * strength, 0.09, 0.002);
  o.connect(g).connect(panTo(b.world, x));
  o.start(t);
  o.stop(t + 0.12);
}

/** Ink sticks to a living creature: a sticker thwap. */
export function sticker(x?: number) {
  const e = ev();
  if (!e) return;
  playSample('thwap', { bus: e.b.world, x, db: 1, rate: worldRate() });
}

/** Cartoon falling whistle (a creature slips off the page). */
export function fallWhistle(x?: number) {
  const e = ev();
  if (!e || !budget('fall', 2, 0.9)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter();
  const o = c.createOscillator();
  o.frequency.setValueAtTime(1100 * r, t);
  o.frequency.exponentialRampToValueAtTime(260 * r, t + 0.8);
  const lfo = c.createOscillator();
  lfo.frequency.value = 7;
  const lg = c.createGain();
  lg.gain.value = 24;
  lfo.connect(lg).connect(o.frequency);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.2, t + 0.04);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.85);
  o.connect(g).connect(panTo(b.world, x));
  o.start(t);
  lfo.start(t);
  o.stop(t + 0.9);
  lfo.stop(t + 0.9);
}

/** Soft pencil-tap footstep; size in px sets pitch (small = high), scurry = lighter and faster. */
export function footstep(x: number | undefined, size: number, level = 1) {
  const e = ev();
  if (!e || !budget('step', 4, 0.08)) return;
  const { c, b } = e;
  const t = c.currentTime;
  const r = worldRate() * pitchJitter(0.1);
  const pitch = Math.max(0.6, Math.min(2.2, Math.pow(150 / Math.max(size, 40), 0.4)));
  const out = panTo(b.world, x);
  const n = noiseAt(c, t, 0.04);
  const bp = filt(c, 'bandpass', 1700 * pitch * r, 1.4);
  const g = c.createGain();
  perc(g, t, 0.2 * level, 0.025, 0.0008);
  n.connect(bp).connect(g).connect(out);
  const o = c.createOscillator();
  o.type = 'triangle';
  o.frequency.setValueAtTime(330 * pitch * r, t);
  o.frequency.exponentialRampToValueAtTime(150 * pitch * r, t + 0.03);
  const og = c.createGain();
  perc(og, t, 0.1 * level, 0.04, 0.001);
  o.connect(og).connect(out);
  o.start(t);
  o.stop(t + 0.06);
}

// ------------------------------------------------------------------ UI, stings

/** UI tap / back / page turn. */
export function uiTap(kind: 'tap' | 'back' | 'page' = 'tap') {
  const e = ev();
  if (!e) return;
  const { c, b } = e;
  const t = c.currentTime;
  if (kind === 'page') {
    // paper flip: noise swish up then a flutter tick
    const n = noiseAt(c, t, 0.2);
    const bp = filt(c, 'bandpass', 1100, 0.9);
    bp.frequency.setValueAtTime(1100, t);
    bp.frequency.exponentialRampToValueAtTime(3600, t + 0.11);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.2, t + 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
    n.connect(bp).connect(g).connect(b.ui);
    playSample('thwap', { bus: b.ui, db: -9, rate: 1.4, delay: 0.1 });
    return;
  }
  playSample('ui', { bus: b.ui, db: kind === 'back' ? -3 : 0, rate: kind === 'back' ? 0.8 : 1 });
}

/** Little double-blink tick as a creature's eyes open (birth). */
export function blinkTicks(delay = 0.14) {
  const e = ev();
  if (!e) return;
  const { c, b } = e;
  const t = c.currentTime + delay;
  for (const dt of [0, 0.115]) {
    const o = c.createOscillator();
    o.frequency.setValueAtTime(2100 * pitchJitter(0.04), t + dt);
    o.frequency.exponentialRampToValueAtTime(1500, t + dt + 0.02);
    const g = c.createGain();
    perc(g, t + dt, 0.1, 0.03, 0.001);
    o.connect(g).connect(b.ui);
    o.start(t + dt);
    o.stop(t + dt + 0.05);
  }
}

/** Countdown woodblock; step 0,1,2 for 3,2,1 rising. */
export function woodblock(step = 0, accent = 1) {
  const e = ev();
  if (!e) return;
  const { c, b } = e;
  const t = c.currentTime;
  const f = [740, 880, 1175][Math.max(0, Math.min(2, step))] * pitchJitter(0.01);
  for (const [m, gm, d] of [
    [1, 1, 0.07],
    [1.51, 0.4, 0.04],
  ] as const) {
    const o = c.createOscillator();
    o.frequency.setValueAtTime(f * m * 1.03, t);
    o.frequency.exponentialRampToValueAtTime(f * m, t + 0.008);
    const g = c.createGain();
    perc(g, t, 0.34 * gm * accent, d, 0.001);
    o.connect(g).connect(b.ui);
    o.start(t);
    o.stop(t + d + 0.03);
  }
  const n = noiseAt(c, t, 0.02);
  const bp = filt(c, 'bandpass', 3000, 1);
  const ng = c.createGain();
  perc(ng, t, 0.09 * accent, 0.015, 0.0005);
  n.connect(bp).connect(ng).connect(b.ui);
}

/** Rubber-stamp slam, then a short kazoo-and-ukulele sting. Ducks Music and Ambience. */
export function winSting() {
  const e = ev();
  if (!e) return;
  const { c, b } = e;
  const t = c.currentTime;
  // stamp: wood slap + low thunk + paper tick
  playSample('stamp', { bus: b.ui, db: 3 });
  playSample('thud', { bus: b.ui, db: -1, rate: 0.85 });
  const o = c.createOscillator();
  o.frequency.setValueAtTime(190, t);
  o.frequency.exponentialRampToValueAtTime(62, t + 0.16);
  const g = c.createGain();
  perc(g, t, 0.75, 0.22, 0.003);
  o.connect(g).connect(b.ui);
  o.start(t);
  o.stop(t + 0.3);
  const n = noiseAt(c, t, 0.06);
  const bp = filt(c, 'bandpass', 1800, 0.8);
  const ng = c.createGain();
  perc(ng, t, 0.45, 0.05, 0.001);
  n.connect(bp).connect(ng).connect(b.ui);
  duck(8, 0.9);

  // sting (C major, ~2 s): ukulele strums under a kazoo lead
  const t0 = t + 0.3;
  const strum = (at: number, notes: number[]) =>
    notes.forEach((m, i) => pluck(c, b.ui, at + i * 0.022, mtof(m), 0.9, 0.2, 3600));
  strum(t0, [60, 64, 67, 72]);
  strum(t0 + 0.64, [60, 64, 67, 72]);
  strum(t0 + 1.28, [53, 57, 60, 65]);
  const lead: [number, number, number][] = [
    [0, 67, 0.15],
    [0.16, 72, 0.15],
    [0.32, 76, 0.15],
    [0.48, 79, 0.15],
    [0.64, 84, 0.55],
  ];
  for (const [dt, m, d] of lead) kazoo(c, b.ui, t0 + dt, mtof(m), d, 0.13);
  bell(c, b.ui, t0 + 1.28, mtof(96), 0.7, 0.09);
  bell(c, b.ui, t0 + 1.34, mtof(91), 0.6, 0.07);
}

/** Kazoo-ish lead: two detuned saws through a nasal band-pass, with vibrato. */
function kazoo(c: AudioContext, dest: AudioNode, t: number, f: number, dur: number, gain: number) {
  const bp = filt(c, 'bandpass', Math.min(2800, f * 2.2), 2.2);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.02);
  g.gain.setValueAtTime(gain, t + Math.max(0.03, dur - 0.05));
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04);
  const vib = c.createOscillator();
  vib.frequency.value = 5.6;
  const vg = c.createGain();
  vg.gain.setValueAtTime(0, t);
  vg.gain.linearRampToValueAtTime(f * 0.012, t + 0.15);
  for (const det of [-6, 7]) {
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = f;
    o.detune.value = det;
    vib.connect(vg).connect(o.frequency);
    o.connect(bp);
    o.start(t);
    o.stop(t + dur + 0.08);
  }
  bp.connect(g).connect(dest);
  vib.start(t);
  vib.stop(t + dur + 0.08);
}

/** A tiny three-note chime (a SAVE goal met without the full stamp). */
export function chime() {
  const e = ev();
  if (!e) return;
  const { c, b } = e;
  const t = c.currentTime;
  [72, 76, 79].forEach((m, i) => bell(c, b.ui, t + i * 0.09, mtof(m), 0.6, 0.18));
}

/** Soft sad-trombone "wah-wah": short, rueful, not mocking. */
export function failSting(delay = 0) {
  const e = ev();
  if (!e) return;
  const { c, b } = e;
  const t0 = c.currentTime + delay;
  const notes: [number, number, number][] = [
    [0, 58, 0.23],
    [0.25, 57, 0.23],
    [0.5, 56, 0.23],
    [0.75, 55, 0.72],
  ];
  notes.forEach(([dt, m, d], idx) => {
    const t = t0 + dt;
    const f = mtof(m);
    const lp = filt(c, 'lowpass', 500, 1.4);
    // the wah: the filter opens and closes on every note
    lp.frequency.setValueAtTime(420, t);
    lp.frequency.exponentialRampToValueAtTime(1500, t + d * 0.35);
    lp.frequency.exponentialRampToValueAtTime(480, t + d);
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.025);
    g.gain.setValueAtTime(0.16, t + d * 0.7);
    g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.03);
    for (const det of [-5, 6]) {
      const o = c.createOscillator();
      o.type = 'sawtooth';
      o.frequency.setValueAtTime(f * 1.03, t);
      o.frequency.exponentialRampToValueAtTime(f * (idx === 3 ? 0.96 : 1), t + d);
      o.detune.value = det;
      o.connect(lp);
      o.start(t);
      o.stop(t + d + 0.08);
    }
    lp.connect(g).connect(b.ui);
  });
}

// ------------------------------------------------------------------ loops

export interface LoopVoice {
  update(a: number, b?: number, x?: number): void;
  stop(): void;
}

function loopSource(c: AudioContext): AudioBufferSourceNode {
  const s = c.createBufferSource();
  s.buffer = noise();
  s.loop = true;
  s.start(0, rnd(0, 1.6));
  return s;
}

export function makeLoop(
  build: (c: AudioContext, b: Buses, src: AudioBufferSourceNode, out: GainNode, stops: AudioScheduledSourceNode[]) => (a: number, b2: number, t: number) => void,
  bus: 'world' | 'ambience' = 'world'
): LoopVoice | null {
  const e = ev();
  if (!e) return null;
  const { c, b } = e;
  const src = loopSource(c);
  const out = c.createGain();
  out.gain.value = 0;
  const pan = c.createStereoPanner ? c.createStereoPanner() : null;
  if (pan) {
    out.connect(pan).connect(b[bus]);
  } else out.connect(b[bus]);
  const stops: AudioScheduledSourceNode[] = [src];
  const upd = build(c, b, src, out, stops);
  let dead = false;
  return {
    update(a, b2 = 0, x) {
      if (dead) return;
      const t = c.currentTime;
      if (pan && x !== undefined) pan.pan.setTargetAtTime(Math.max(-0.7, Math.min(0.7, (x / 720 - 0.5) * 1.3)), t, 0.05);
      src.playbackRate.setTargetAtTime(bus === 'world' ? worldRate() : 1, t, 0.05);
      upd(a, b2, t);
    },
    stop() {
      if (dead) return;
      dead = true;
      const t = c.currentTime;
      out.gain.cancelScheduledValues(t);
      out.gain.setTargetAtTime(0, t, 0.05);
      for (const s of stops) {
        try {
          s.stop(t + 0.4);
        } catch {
          /* ended */
        }
      }
    },
  };
}

/** Boulder: low rumble with gritty crackle. update(speed01). */
export function rumbleLoop(): LoopVoice | null {
  return makeLoop((c, _b, src, out, stops) => {
    const lp = filt(c, 'lowpass', 140, 0.9);
    const lg = c.createGain();
    src.connect(lp).connect(lg).connect(out);
    lg.gain.value = 1;
    // grit (the part a phone speaker can actually play): chopped band-passed noise
    const hp = filt(c, 'bandpass', 1050, 0.9);
    const gg = c.createGain();
    gg.gain.value = 0;
    const lfo = c.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 8;
    const la = c.createGain();
    la.gain.value = 0.5;
    lfo.connect(la).connect(gg.gain);
    const gb = c.createGain();
    gb.gain.value = 0;
    src.connect(hp).connect(gg).connect(gb).connect(out);
    lfo.start();
    stops.push(lfo);
    // a body tone beneath it
    const sub = c.createOscillator();
    sub.type = 'triangle';
    sub.frequency.value = 52;
    const sg = c.createGain();
    sg.gain.value = 0;
    sub.connect(sg).connect(out);
    sub.start();
    stops.push(sub);
    return (a, _b2, t) => {
      lp.frequency.setTargetAtTime(110 + 330 * a, t, 0.08);
      out.gain.setTargetAtTime(0.16 * a, t, 0.08);
      gb.gain.setTargetAtTime(0.32 * a, t, 0.08);
      lfo.frequency.setTargetAtTime(5 + 15 * a, t, 0.1);
      sub.frequency.setTargetAtTime(44 + 22 * a, t, 0.1);
      sg.gain.setTargetAtTime(0.25 * a, t, 0.08);
    };
  });
}

/** Crusher: stone scrape that rises with strain. update(motion01, strain01). */
export function grindLoop(): LoopVoice | null {
  return makeLoop((c, _b, src, out, stops) => {
    const bp = filt(c, 'bandpass', 320, 2.6);
    const bg = c.createGain();
    src.connect(bp).connect(bg).connect(out);
    bg.gain.value = 1.6;
    const hp = filt(c, 'highpass', 1700, 0.7);
    const hg = c.createGain();
    hg.gain.value = 0;
    const lfo = c.createOscillator();
    lfo.frequency.value = 11;
    const la = c.createGain();
    la.gain.value = 0.5;
    lfo.connect(la).connect(hg.gain);
    const hb = c.createGain();
    hb.gain.value = 0;
    src.connect(hp).connect(hg).connect(hb).connect(out);
    lfo.start();
    stops.push(lfo);
    // growl under strain
    const saw = c.createOscillator();
    saw.type = 'sawtooth';
    saw.frequency.value = 54;
    const sl = filt(c, 'lowpass', 260, 0.7);
    const sg = c.createGain();
    sg.gain.value = 0;
    saw.connect(sl).connect(sg).connect(out);
    saw.start();
    stops.push(saw);
    return (move, strain, t) => {
      out.gain.setTargetAtTime(move * (0.38 + 0.4 * strain) * 0.14, t, 0.1);
      bp.frequency.setTargetAtTime(300 + 900 * strain, t, 0.1);
      hb.gain.setTargetAtTime(0.14 + 0.2 * strain, t, 0.1);
      lfo.frequency.setTargetAtTime(9 + 12 * strain, t, 0.1);
      saw.frequency.setTargetAtTime(48 + 40 * strain, t, 0.1);
      sg.gain.setTargetAtTime(0.5 * strain, t, 0.1);
    };
  });
}

/** Bomb fuse: bright sputtering hiss that rises as the fuse burns down. update(burn01). */
export function hissLoop(): LoopVoice | null {
  return makeLoop((c, _b, src, out) => {
    const hp = filt(c, 'highpass', 3200, 0.7);
    const bp = filt(c, 'bandpass', 5200, 1.4);
    src.connect(hp).connect(bp).connect(out);
    return (burn, _b2, t) => {
      bp.frequency.setTargetAtTime(4600 + 3200 * burn, t, 0.05);
      // sputter: a random level every frame, smoothed by a fast time constant
      out.gain.setTargetAtTime((0.05 + 0.14 * burn) * (0.45 + 0.55 * Math.random()), t, 0.012);
    };
  });
}

/** Very quiet paper-room bed on the Ambience bus: you only notice it when it stops. */
export function roomTone(): LoopVoice | null {
  return makeLoop((c, _b, src, out) => {
    const lp = filt(c, 'lowpass', 280, 0.6);
    src.connect(lp).connect(out);
    const lfo = c.createOscillator();
    lfo.frequency.value = 0.06;
    const la = c.createGain();
    la.gain.value = 70;
    lfo.connect(la).connect(lp.frequency);
    lfo.start();
    out.gain.value = 0.07;
    return () => {};
  }, 'ambience');
}
