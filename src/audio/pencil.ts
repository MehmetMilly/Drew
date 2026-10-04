// The pencil (audio.md §3): the lead instrument. A synthesised graphite scratch on its own
// bus (never ducked, never slow-filtered): band-passed noise with granular amplitude jitter
// whose density follows pen speed and whose brightness follows pressure, plus a low paper
// body under it. Also the pen-lift tick and the birth pop.
import { audioCtx, buses, initAudio, noise, rnd } from './mixer';
import { currentPencilId } from '../render/pencils';
import { loadSamples } from './samples';

export { audioCtx };

let src: AudioBufferSourceNode | null = null;
let src2: AudioBufferSourceNode | null = null;
let bp: BiquadFilterNode | null = null;
let body: BiquadFilterNode | null = null;
let gain: GainNode | null = null;
let bodyGain: GainNode | null = null;
let grain: GainNode | null = null;
let lfo: OscillatorNode | null = null;
let lfo2: OscillatorNode | null = null;
let hpNode: BiquadFilterNode | null = null;
let lfoAmt: GainNode | null = null;
let lfo2Amt: GainNode | null = null;
let level = 0;
let built = false;
const PENCIL_VOLUME = 0.28; // was 0.55: play-test said too loud

/**
 * Pencil Case timbres (design §12; render/pencils.ts ids). Same engine, different grain:
 * hp = high-pass Hz, bp0/bpP = band-pass centre and how far pressure lifts it, q = resonance,
 * grain = depth of the grain flutter, lfo = flutter speed, body = paper-rub level and body0 its
 * pitch, vol = trim (the pencil stays the loudest thing while drawing), shimmer = random
 * band wobble per update.
 */
interface Timbre {
  hp: number;
  bp0: number;
  bpP: number;
  q: number;
  grain: number;
  lfo: number;
  body: number;
  body0: number;
  vol: number;
  shimmer?: number;
}
const TIMBRES: Record<string, Timbre> = {
  graphite: { hp: 900, bp0: 2200, bpP: 1800, q: 0.9, grain: 1, lfo: 1, body: 1, body0: 520, vol: 1 },
  // thin, smooth, bright: a ball rolling in its socket, barely any tooth
  ballpoint: { hp: 1500, bp0: 3000, bpP: 1500, q: 1.4, grain: 0.3, lfo: 0.6, body: 0.45, body0: 700, vol: 1.7 },
  // waxy and thick: low, slow, clumpy grains with a lot of paper rub
  crayon: { hp: 450, bp0: 1500, bpP: 1300, q: 0.7, grain: 1.5, lfo: 0.65, body: 1.5, body0: 380, vol: 0.95 },
  // felt tip: smooth and slightly squeaky (a narrow resonant band, almost no grain)
  marker: { hp: 700, bp0: 1800, bpP: 1600, q: 2.4, grain: 0.12, lfo: 0.5, body: 0.7, body0: 560, vol: 1.8 },
  // dry and gritty: high, wide, crackly
  chalk: { hp: 2200, bp0: 4200, bpP: 1400, q: 0.6, grain: 1.8, lfo: 1.6, body: 0.4, body0: 800, vol: 0.85 },
  // graphite with a glint: the band wanders a little every update
  rainbow: { hp: 1000, bp0: 2600, bpP: 1800, q: 1.1, grain: 0.8, lfo: 1, body: 0.8, body0: 560, vol: 1.1, shimmer: 0.3 },
  // a soft hairy swish: lots of body, little grain
  brush: { hp: 300, bp0: 1100, bpP: 1000, q: 0.5, grain: 0.2, lfo: 0.4, body: 2, body0: 420, vol: 0.7 },
};
let timbre: Timbre = TIMBRES.graphite;
let timbreId = 'graphite';

/** Switch the scratch timbre to the pencil in use (cheap; called from pencil()). */
function followPencil(t: number) {
  const id = currentPencilId();
  if (id === timbreId) return;
  timbreId = id;
  timbre = TIMBRES[id] ?? TIMBRES.graphite;
  if (hpNode) hpNode.frequency.setTargetAtTime(timbre.hp, t, 0.02);
  if (bp) bp.Q.setTargetAtTime(timbre.q, t, 0.02);
  if (lfoAmt) lfoAmt.gain.setTargetAtTime(0.35 * timbre.grain, t, 0.02);
  if (lfo2Amt) lfo2Amt.gain.setTargetAtTime(0.18 * timbre.grain, t, 0.02);
}

/** Create/resume the context on a user gesture and build the pencil. */
export function unlockAudio() {
  const ctx = initAudio();
  const b = buses();
  if (!ctx || !b) return;
  if (!built) {
    built = true;
    // graphite on tooth: white noise with sparse louder grains
    const len = ctx.sampleRate * 2;
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = buf.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < len; i++) {
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const r = seed / 4294967296;
      seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
      const spike = seed / 4294967296 > 0.985 ? 3 : 1;
      d[i] = (r * 2 - 1) * 0.5 * spike;
    }
    src = ctx.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const hp = ctx.createBiquadFilter();
    hpNode = hp;
    hp.type = 'highpass';
    hp.frequency.value = 900;
    bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 3200;
    bp.Q.value = 0.9;
    grain = ctx.createGain();
    grain.gain.value = 0.6;
    // fast amplitude flutter = grain density
    lfo = ctx.createOscillator();
    lfo.type = 'square';
    lfo.frequency.value = 35;
    lfoAmt = ctx.createGain();
    lfoAmt.gain.value = 0.35;
    lfo.connect(lfoAmt).connect(grain.gain);
    // a slower, irregular second flutter so the grains never sound like a motor
    lfo2 = ctx.createOscillator();
    lfo2.type = 'triangle';
    lfo2.frequency.value = 11;
    lfo2Amt = ctx.createGain();
    lfo2Amt.gain.value = 0.18;
    lfo2.connect(lfo2Amt).connect(grain.gain);
    gain = ctx.createGain();
    gain.gain.value = 0;
    src.connect(hp).connect(bp).connect(grain).connect(gain).connect(b.pencil);
    // paper body: the low rub of the page under the lead
    src2 = ctx.createBufferSource();
    src2.buffer = noise();
    src2.loop = true;
    body = ctx.createBiquadFilter();
    body.type = 'bandpass';
    body.frequency.value = 680;
    body.Q.value = 0.8;
    bodyGain = ctx.createGain();
    bodyGain.gain.value = 0;
    src2.connect(body).connect(bodyGain).connect(b.pencil);
    src.start();
    src2.start(0, 0.7);
    lfo.start();
    lfo2.start();
    loadSamples();
  }
}

let lastDrive = -1;

/** Drive the scratch from pen speed (px/s, page space) and pressure (0..1). */
export function pencil(speed: number, pressure = 0.5, down = true) {
  const ctx = audioCtx();
  if (!ctx || !gain || !bp || !lfo || !lfo2 || !body || !bodyGain) return;
  const t = ctx.currentTime;
  lastDrive = t;
  followPencil(t);
  // speeds from near-simultaneous events spike; the scratch saturates at 900 px/s anyway
  const target = down && isFinite(speed) ? Math.min(1, speed / 900) : 0;
  level += (target - level) * (target > level ? 0.35 : 0.6);
  // per-event grain jitter: a slow stroke is a few distinct grains, a fast one a steady rasp
  const tb = timbre;
  const jitter = 1 - 0.28 * (1 - level) * Math.random();
  const glint = tb.shimmer ? 1 + (Math.random() * 2 - 1) * tb.shimmer : 1;
  gain.gain.setTargetAtTime(level * PENCIL_VOLUME * tb.vol * jitter, t, 0.02);
  bp.frequency.setTargetAtTime((tb.bp0 + tb.bpP * pressure + 700 * level) * glint, t, 0.03);
  lfo.frequency.setTargetAtTime((18 + 50 * level) * tb.lfo * rnd(0.85, 1.15), t, 0.03);
  lfo2.frequency.setTargetAtTime((7 + 16 * level * rnd(0.8, 1.2)) * tb.lfo, t, 0.05);
  bodyGain.gain.setTargetAtTime(level * (0.25 + 0.55 * pressure) * PENCIL_VOLUME * 0.6 * tb.body * tb.vol, t, 0.03);
  body.frequency.setTargetAtTime(tb.body0 + 400 * pressure + 200 * level, t, 0.04);
}

/** Call every frame: a pen that stops moving (or loses its pen-up) falls silent. */
export function pencilFrame() {
  const ctx = audioCtx();
  if (!ctx || !gain || !bodyGain || lastDrive < 0) return;
  if (ctx.currentTime - lastDrive > 0.06) {
    level = 0;
    lastDrive = -1;
    gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
    bodyGain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
  }
}

/** Tiny lift tick (also the UI press tick: the first gesture unlocks audio). */
export function pencilTick() {
  unlockAudio();
  const ctx = audioCtx();
  const b = buses();
  if (!ctx || !b) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(2400 * (1 + (Math.random() * 2 - 1) * 0.06), t);
  o.frequency.exponentialRampToValueAtTime(900, t + 0.03);
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g).connect(b.pencil);
  o.start(t);
  o.stop(t + 0.06);
}

/** Birth: a soft paper pop as time snaps back, then a rising "bloop" as the eyes pop. */
export function birthPop(delay = 0) {
  const ctx = audioCtx();
  const b = buses();
  if (!ctx || !b) return;
  const t = ctx.currentTime + delay;
  // paper pop: a short low-passed noise thwap
  const pn = ctx.createBufferSource();
  pn.buffer = noise();
  const plp = ctx.createBiquadFilter();
  plp.type = 'bandpass';
  plp.frequency.value = 1100;
  plp.Q.value = 0.9;
  const pg = ctx.createGain();
  pg.gain.setValueAtTime(0.0001, t);
  pg.gain.exponentialRampToValueAtTime(0.28, t + 0.004);
  pg.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  pn.connect(plp).connect(pg).connect(b.ui);
  pn.start(t, rnd(0, 1.5), 0.08);
  // whoosh: band-passed noise sweeping up (the music snapping back)
  const n = ctx.createBufferSource();
  n.buffer = noise();
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(500, t);
  f.frequency.exponentialRampToValueAtTime(2400, t + 0.2);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(0.09, t + 0.08);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  n.connect(f).connect(ng).connect(b.ui);
  n.start(t, rnd(0, 1.5), 0.26);
  // bloop: sine with a fast upward pitch bend
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'sine';
  const t2 = t + 0.06;
  o.frequency.setValueAtTime(320, t2);
  o.frequency.exponentialRampToValueAtTime(980, t2 + 0.09);
  g.gain.setValueAtTime(0.0001, t2);
  g.gain.exponentialRampToValueAtTime(0.22, t2 + 0.015);
  g.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.16);
  o.connect(g).connect(b.ui);
  o.start(t2);
  o.stop(t2 + 0.18);
}
