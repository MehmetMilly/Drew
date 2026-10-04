// Mixer buses (audio.md §2). One AudioContext, one graph:
//
//   Master (gain -> limiter -> destination)
//   |- Music     musicGain -> slow low-pass -> slow -10 dB -> duck -> master
//   |- Pencil    pencil -> master (never ducked, never filtered)
//   |- SFX       Creatures -> creature low-pass -> master
//   |            World     -> world low-pass    -> master
//   |            UI        -> master
//   '- Ambience  ambGain -> duck -> master
//
// Slow time (pen down) low-passes Music hard and the world/creature buses gently and
// drops the pitch of new world one-shots. Everything is created lazily on the first
// user gesture (unlockAudio in pencil.ts).
import { load } from '../game/save';

export interface Buses {
  master: GainNode;
  music: GainNode; // layers connect here
  musicLP: BiquadFilterNode;
  musicSlowG: GainNode;
  musicDuck: GainNode;
  pencil: GainNode;
  creatures: GainNode;
  world: GainNode;
  ui: GainNode;
  ambience: GainNode;
  ambDuck: GainNode;
  worldLP: BiquadFilterNode;
  creatLP: BiquadFilterNode;
  worldSlow: GainNode;
}

let ctx: AudioContext | null = null;
let B: Buses | null = null;
let noiseBuf: AudioBuffer | null = null;

// base levels (the mix targets in audio.md §7: pencil loudest while drawing, voices above
// the world, music about 6 dB under SFX peaks, ambience barely there)
// (set by tools/mixcheck.mts on 2026-10-04: music ≈ −26 dB RMS, SFX loud moments ≈ +6 dB over it,
// pencil the loudest bus while drawing)
export const LEVEL = {
  master: 0.9,
  music: 2.5,
  pencil: 5,
  creatures: 0.6,
  world: 0.5,
  ui: 0.7,
  ambience: 0.35,
};

export const audioCtx = () => ctx;
export const buses = () => B;

export function noise(): AudioBuffer {
  return noiseBuf!;
}

/** Create the context and graph on a user gesture; resume it after backgrounding. */
export function initAudio(): AudioContext | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC({ latencyHint: 'interactive' });
      build(ctx);
      const resume = () => {
        if (ctx && ctx.state !== 'running') void ctx.resume().catch(() => {});
      };
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) resume();
      });
      // iOS puts the context in 'interrupted'; any later gesture revives it
      addEventListener('pointerdown', resume, { passive: true });
    }
    if (ctx.state !== 'running') void ctx.resume().catch(() => {});
    return ctx;
  } catch (err) {
    console.warn('audio unavailable', err);
    ctx = null;
    B = null;
    return null;
  }
}

function build(c: AudioContext) {
  // shared white noise (2 s, mono, seeded so it is the same every run)
  noiseBuf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate);
  const d = noiseBuf.getChannelData(0);
  let s = 0x9e3779b9;
  for (let i = 0; i < d.length; i++) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    d[i] = (s / 2147483648) * 2 - 1;
  }

  const g = (v: number) => {
    const n = c.createGain();
    n.gain.value = v;
    return n;
  };
  const lp = (f: number, q = 0.7) => {
    const n = c.createBiquadFilter();
    n.type = 'lowpass';
    n.frequency.value = f;
    n.Q.value = q;
    return n;
  };

  const limiter = c.createDynamicsCompressor();
  limiter.threshold.value = -4;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.12;
  const master = g(LEVEL.master);
  master.connect(limiter).connect(c.destination);

  const music = g(LEVEL.music);
  const musicLP = lp(20000);
  const musicSlowG = g(1);
  const musicDuck = g(1);
  music.connect(musicLP).connect(musicSlowG).connect(musicDuck).connect(master);

  const pencil = g(LEVEL.pencil);
  pencil.connect(master);

  const creatLP = lp(20000);
  const creatures = g(LEVEL.creatures);
  // voices vary a lot in loudness (pitch against formant); a gentle compressor evens them out
  const creatComp = c.createDynamicsCompressor();
  creatComp.threshold.value = -24;
  creatComp.knee.value = 12;
  creatComp.ratio.value = 4;
  creatComp.attack.value = 0.004;
  creatComp.release.value = 0.15;
  creatures.connect(creatLP).connect(creatComp).connect(master);

  const worldSlow = g(1);
  const worldLP = lp(20000);
  const world = g(LEVEL.world);
  world.connect(worldLP).connect(worldSlow).connect(master);

  const ui = g(LEVEL.ui);
  ui.connect(master);

  const ambience = g(LEVEL.ambience);
  const ambDuck = g(1);
  ambience.connect(ambDuck).connect(master);

  B = { master, music, musicLP, musicSlowG, musicDuck, pencil, creatures, world, ui, ambience, ambDuck, worldLP, creatLP, worldSlow };
}

// ------------------------------------------------------------------ settings

let lastSound = -1;
let lastMusic = -1;
let lastVoices = -1;

/** Mute and music slider from the save settings (0 = off). Cheap; call every frame. */
export function applyVolumes() {
  if (!ctx || !B) return;
  const st = load().settings;
  const snd = Math.max(0, Math.min(1, st.sound));
  const mus = Math.max(0, Math.min(1, st.music));
  const voi = Math.max(0, Math.min(1, st.voices ?? 1));
  const t = ctx.currentTime;
  if (snd !== lastSound) {
    lastSound = snd;
    B.master.gain.setTargetAtTime(snd * LEVEL.master, t, 0.03);
  }
  if (mus !== lastMusic) {
    lastMusic = mus;
    B.music.gain.setTargetAtTime(mus * LEVEL.music, t, 0.05);
  }
  if (voi !== lastVoices) {
    lastVoices = voi;
    B.creatures.gain.setTargetAtTime(voi * LEVEL.creatures, t, 0.05);
  }
}

export function soundOn(): boolean {
  return load().settings.sound > 0;
}

// ------------------------------------------------------------------ slow time

let slow = 0;
let slowTarget = -1;
/** 0..1 how deep slow time is: pitch factor for new world one-shots. */
export function slowAmount() {
  return slow;
}
/** Playback-rate multiplier for world sounds right now (1 normal, ~0.6 in deep slow time). */
export function worldRate() {
  return 1 - 0.4 * slow;
}

/**
 * Slow time (audio.md §2): Music low-pass 20 kHz to 700 Hz and -10 dB; world and creature
 * sounds low-pass gently and lose a few dB. The toy page already eases timeScale over 150 and
 * 200 ms, so following it each frame gives the specified attack and release.
 */
export function setSlow(amount: number) {
  slow = Math.max(0, Math.min(1, amount));
  if (!ctx || !B) return;
  if (Math.abs(slow - slowTarget) < 0.004) return;
  slowTarget = slow;
  const t = ctx.currentTime;
  const tc = 0.035;
  B.musicLP.frequency.setTargetAtTime(20000 * Math.pow(700 / 20000, slow), t, tc);
  B.musicSlowG.gain.setTargetAtTime(Math.pow(10, (-10 * slow) / 20), t, tc);
  B.worldLP.frequency.setTargetAtTime(20000 * Math.pow(1500 / 20000, slow), t, tc);
  B.creatLP.frequency.setTargetAtTime(20000 * Math.pow(2400 / 20000, slow), t, tc);
  B.worldSlow.gain.setTargetAtTime(Math.pow(10, (-3 * slow) / 20), t, tc);
}

// ------------------------------------------------------------------ ducking

/**
 * Big impacts (boom, poof, win stamp) duck Music and Ambience by about 8 dB: 80 ms attack,
 * 500 ms release (time constants are a third of those times).
 */
export function duck(db = 8, hold = 0.12) {
  if (!ctx || !B) return;
  const t = ctx.currentTime;
  const amt = Math.pow(10, -db / 20);
  const rel = t + 0.08 + hold;
  for (const n of [B.musicDuck, B.ambDuck]) {
    n.gain.cancelScheduledValues(t);
    n.gain.setTargetAtTime(amt, t, 0.08 / 3);
    n.gain.setTargetAtTime(1, rel, 0.5 / 3);
  }
}

// ------------------------------------------------------------------ helpers

export const rnd = (a = 0, b = 1) => a + Math.random() * (b - a);
export const dbGain = (db: number) => Math.pow(10, db / 20);
/** +-6% pitch jitter as a rate multiplier. */
export const pitchJitter = (amt = 0.06) => 1 + (Math.random() * 2 - 1) * amt;
/** +-1.5 dB level jitter as a gain multiplier. */
export const levelJitter = (db = 1.5) => dbGain((Math.random() * 2 - 1) * db);

/** Stereo-pan from a world x (page is 720 wide); returns the node to connect into. */
export function panTo(dest: AudioNode, x?: number): AudioNode {
  if (!ctx || x === undefined || !isFinite(x) || !ctx.createStereoPanner) return dest;
  const p = ctx.createStereoPanner();
  p.pan.value = Math.max(-0.7, Math.min(0.7, (x / 720 - 0.5) * 1.3));
  p.connect(dest);
  return p;
}

// per-sound voice budget for synthesised one-shots (audio.md §2: at most 4 of the same sound)
const budgets = new Map<string, number[]>();
export function budget(name: string, max: number, dur: number): boolean {
  if (!ctx) return false;
  const now = ctx.currentTime;
  const a = (budgets.get(name) ?? []).filter((e) => e > now);
  if (a.length >= max) {
    budgets.set(name, a);
    return false;
  }
  a.push(now + dur);
  budgets.set(name, a);
  return true;
}
