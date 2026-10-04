// The doodle voice (audio.md §4): a small formant synth. A sawtooth (or triangle for the very
// small) goes through two band-pass formant filters that glide between vowel pairs on syllables
// of 60-120 ms. Pitch comes from size (tiny about 520 Hz, giants about 90 Hz); timbre comes
// from kind; the syllables come from a seeded per-creature sequence so every creature sounds
// like itself across replays. Little Guy and the ninja use the same engine with their own
// profiles. Voice limits: at most 3 creature voices at once, newest steals from the quietest.
import type { Creature } from '../sim/creature';
import { audioCtx, buses, panTo, pitchJitter, rnd, worldRate } from './mixer';
import { noiseAt } from './synth';

type Vowel = 'a' | 'o' | 'e' | 'u' | 'i' | 'n' | 'm';
// [F1, F2] in Hz (n and m are nasal murmurs)
const FORMANT: Record<Vowel, [number, number]> = {
  a: [800, 1200],
  o: [500, 900],
  e: [500, 1800],
  u: [350, 700],
  i: [300, 2300],
  n: [280, 1050],
  m: [250, 900],
};
const VOWELS: Vowel[] = ['a', 'o', 'e', 'u', 'i'];

export interface Profile {
  f0: number;
  wave: OscillatorType;
  q: number; // formant sharpness
  vibrato: number; // fraction of f0
  vibHz: number;
  sub: number; // sub-octave level
  breath: number; // noise level
  growl: number; // fast amplitude wobble
  fScale: number; // formant scale (big = lower)
  syl: [Vowel, Vowel, number][]; // seeded syllable pool: from, to, pitch ratio
  syllableMul: number; // < 1 = chirpier, faster
  nasalRing: number;
  muffle: number; // low-pass (Hz); 0 = none
  vol: number; // loudness trim so every voice sits at the same level
}

function seeded(seed: number) {
  let s = (seed ^ 0x9e3779b9) >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const profiles = new Map<string, Profile>();

/** size px -> Hz: tiny (about 50 px) ~520 Hz, giant (about 600 px) ~90 Hz, log-spaced. */
export function pitchFromSize(size: number) {
  const t = Math.max(0, Math.min(1, Math.log(Math.max(size, 20) / 50) / Math.log(600 / 50)));
  return 520 * Math.pow(90 / 520, t);
}

export function profileOf(cr: Creature): Profile {
  const key = cr.id + ':' + cr.seed;
  const hit = profiles.get(key);
  if (hit) return hit;
  const rng = seeded(cr.seed | 0);
  const f0 = pitchFromSize(cr.stats.size);
  const p: Profile = {
    f0: f0 * (0.94 + rng() * 0.12),
    wave: f0 > 420 ? 'triangle' : 'sawtooth',
    q: 7,
    vibrato: 0.012,
    vibHz: 5.5,
    sub: 0,
    breath: 0.05,
    growl: 0,
    fScale: Math.max(0.8, Math.min(1.25, Math.pow(f0 / 250, -0.12))),
    syl: [],
    syllableMul: 1,
    nasalRing: 0,
    muffle: 0,
    vol: f0 > 420 ? 0.45 : 1,
  };
  switch (cr.kind) {
    case 'springy':
      p.vibrato = 0.07;
      p.vibHz = 7.5;
      break;
    case 'heavy':
      p.f0 *= 0.72;
      p.sub = 0.7;
      p.growl = 0.35;
      p.vol = 1.6;
      break;
    case 'giant':
      p.sub = 0.5;
      p.growl = 0.2;
      p.vol = 1.6;
      break;
    case 'floaty':
      p.breath = 0.75;
      p.q = 4;
      p.vibrato = 0.025;
      p.vol = 0.62;
      break;
    case 'worm':
      p.q = 16;
      p.nasalRing = 1;
      p.vol = 1.7;
      break;
    case 'many-legged':
      p.syllableMul = 0.65;
      p.f0 *= 1.15;
      break;
    case 'headless':
      // no mouth: a muffled hum
      p.muffle = 900;
      p.nasalRing = 0.6;
      break;
    case 'tiny':
      p.vibrato = 0.02;
      break;
    default:
      break;
  }
  for (let i = 0; i < 8; i++) {
    const a = VOWELS[Math.floor(rng() * VOWELS.length)];
    let b = VOWELS[Math.floor(rng() * VOWELS.length)];
    if (b === a) b = VOWELS[(VOWELS.indexOf(a) + 2) % VOWELS.length];
    p.syl.push([a, b, 0.88 + rng() * 0.3]);
  }
  profiles.set(key, p);
  return p;
}

export const GUY_PROFILE: Profile = {
  f0: 980,
  wave: 'triangle',
  q: 6,
  vibrato: 0.02,
  vibHz: 6,
  sub: 0,
  breath: 0.03,
  growl: 0,
  fScale: 1.25,
  syl: [],
  syllableMul: 1,
  nasalRing: 0,
  muffle: 0,
  vol: 0.5,
};

export const NINJA_PROFILE: Profile = { ...GUY_PROFILE, f0: 360, wave: 'sawtooth', q: 8, fScale: 1.05, breath: 0.25, vol: 1.1 };

interface Syl {
  from: Vowel;
  to: Vowel;
  dur: number;
  /** pitch ratio at the start and the end of the syllable */
  p0: number;
  p1: number;
  /** consonant burst at the start: noise click (p, h) */
  onset?: 'p' | 'h' | 'none';
  gap?: number;
}

// ------------------------------------------------------------------ voice limit

interface Active {
  end: number;
  level: number;
  kill: () => void;
}
const active: Active[] = [];

/** True and registers if there is room (or the quietest could be stolen); false to skip. */
function claim(level: number, end: number, kill: () => void): boolean {
  const c = audioCtx();
  if (!c) return false;
  const now = c.currentTime;
  for (let i = active.length - 1; i >= 0; i--) if (active[i].end < now) active.splice(i, 1);
  if (active.length >= 3) {
    let qi = 0;
    for (let i = 1; i < active.length; i++) if (active[i].level < active[qi].level) qi = i;
    if (active[qi].level > level) return false;
    active[qi].kill();
    active.splice(qi, 1);
  }
  active.push({ end, level, kill });
  return true;
}

// ------------------------------------------------------------------ engine

function say(p: Profile, sylls: Syl[], o: { level?: number; x?: number; delay?: number; slow?: boolean; bus?: 'creatures' | 'world' } = {}) {
  const c = audioCtx();
  const b = buses();
  if (!c || !b) return;
  const level = (o.level ?? 1) * p.vol;
  const t0 = c.currentTime + (o.delay ?? 0);
  let total = 0;
  for (const s of sylls) total += s.dur * p.syllableMul + (s.gap ?? 0.02);
  const utter = c.createGain();
  utter.gain.value = 1;
  const ok = claim(level, t0 + total, () => utter.gain.setTargetAtTime(0, c.currentTime, 0.015));
  if (!ok) return;
  utter.connect(panTo(b[o.bus ?? 'creatures'], o.x));
  let tail: AudioNode = utter;
  if (p.muffle) {
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = p.muffle;
    lp.connect(utter);
    tail = lp;
  }
  const rate = (o.slow ? worldRate() : 1) * pitchJitter(0.04);
  let t = t0;
  for (const s of sylls) {
    const dur = s.dur * p.syllableMul;
    const f0 = p.f0 * rate;
    const fa = f0 * s.p0;
    const fb = f0 * s.p1;
    const env = c.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(0.5 * level, t + 0.012);
    env.gain.setValueAtTime(0.5 * level, t + Math.max(0.014, dur - 0.03));
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.012);
    env.connect(tail);

    const src = c.createGain(); // everything feeds the formants through here
    src.gain.value = 1;
    const o1 = c.createOscillator();
    o1.type = p.wave;
    o1.frequency.setValueAtTime(fa, t);
    o1.frequency.linearRampToValueAtTime(fb, t + dur);
    const stops: AudioScheduledSourceNode[] = [o1];
    o1.connect(src);
    if (p.vibrato) {
      const v = c.createOscillator();
      v.frequency.value = p.vibHz;
      const vg = c.createGain();
      vg.gain.value = fa * p.vibrato;
      v.connect(vg).connect(o1.frequency);
      stops.push(v);
    }
    if (p.sub) {
      const o2 = c.createOscillator();
      o2.type = 'square';
      o2.frequency.setValueAtTime(fa / 2, t);
      o2.frequency.linearRampToValueAtTime(fb / 2, t + dur);
      const sg = c.createGain();
      sg.gain.value = p.sub * 0.5;
      o2.connect(sg).connect(src);
      stops.push(o2);
    }
    if (p.growl) {
      const w = c.createOscillator();
      w.frequency.value = 38;
      const wg = c.createGain();
      wg.gain.value = p.growl * 0.4;
      w.connect(wg).connect(env.gain);
      stops.push(w);
    }
    let breath: AudioBufferSourceNode | null = null;
    if (p.breath > 0.02) {
      breath = noiseAt(c, t, dur + 0.05);
      const ng = c.createGain();
      ng.gain.value = p.breath * 0.9;
      breath.connect(ng).connect(src);
    }
    // two formants glide from the first vowel to the second
    const A = FORMANT[s.from];
    const B = FORMANT[s.to];
    const f1 = c.createBiquadFilter();
    f1.type = 'bandpass';
    f1.Q.value = p.q;
    f1.frequency.setValueAtTime(A[0] * p.fScale, t);
    f1.frequency.linearRampToValueAtTime(B[0] * p.fScale, t + dur);
    const f2 = c.createBiquadFilter();
    f2.type = 'bandpass';
    f2.Q.value = p.q;
    f2.frequency.setValueAtTime(A[1] * p.fScale, t);
    f2.frequency.linearRampToValueAtTime(B[1] * p.fScale, t + dur);
    const g1 = c.createGain();
    g1.gain.value = 2.2;
    const g2 = c.createGain();
    g2.gain.value = 1.5;
    src.connect(f1).connect(g1).connect(env);
    src.connect(f2).connect(g2).connect(env);
    if (p.nasalRing) {
      // worms and headless hummers: a fixed nasal resonance
      const f3 = c.createBiquadFilter();
      f3.type = 'bandpass';
      f3.frequency.value = 260;
      f3.Q.value = 10;
      const g3 = c.createGain();
      g3.gain.value = 2 * p.nasalRing;
      src.connect(f3).connect(g3).connect(env);
    }
    for (const n of stops) {
      n.start(t);
      n.stop(t + dur + 0.06);
    }
    // consonant burst
    if (s.onset && s.onset !== 'none') {
      const n = noiseAt(c, t, 0.05);
      const bp = c.createBiquadFilter();
      bp.type = s.onset === 'h' ? 'bandpass' : 'highpass';
      bp.frequency.value = s.onset === 'h' ? 2600 : 1800;
      bp.Q.value = 0.8;
      const cg = c.createGain();
      cg.gain.setValueAtTime(0.0001, t - 0.004);
      cg.gain.exponentialRampToValueAtTime((s.onset === 'h' ? 0.22 : 0.3) * level, t + 0.003);
      cg.gain.exponentialRampToValueAtTime(0.0001, t + (s.onset === 'h' ? 0.07 : 0.025));
      n.connect(bp).connect(cg).connect(tail);
    }
    t += dur + (s.gap ?? 0.02);
  }
}

// ------------------------------------------------------------------ utterances

const lastSaid = new Map<number, number>();
/** A creature that talks constantly becomes noise: per-creature gap, except the big moments. */
function quiet(cr: Creature, gap: number): boolean {
  const c = audioCtx();
  if (!c) return true;
  const now = c.currentTime;
  const last = lastSaid.get(cr.id) ?? -99;
  if (now - last < gap) return true;
  lastSaid.set(cr.id, now);
  return false;
}

function pick(p: Profile, i: number): [Vowel, Vowel, number] {
  return p.syl[((i % p.syl.length) + p.syl.length) % p.syl.length] ?? ['a', 'o', 1];
}

const counters = new Map<number, number>();
const nextIdx = (cr: Creature) => {
  const n = counters.get(cr.id) ?? 0;
  counters.set(cr.id, n + 1);
  return n;
};

export type Utter = 'birth' | 'effort' | 'mode' | 'strain' | 'wah' | 'happy' | 'graft' | 'gasp';

/** Make a creature talk. x is the world x for panning; `slow` follows slow-time pitch. */
export function creatureSays(cr: Creature, what: Utter, x?: number, delayS = 0, slow = false) {
  const p = profileOf(cr);
  const lvl = (v: number) => v * (cr.kind === 'headless' ? 0.8 : 1);
  switch (what) {
    case 'birth': {
      // first gasp (an inhale of breath) then two syllables, rising at the end
      lastSaid.set(cr.id, audioCtx()?.currentTime ?? 0);
      const [a1, b1, r1] = pick(p, 0);
      const [a2, b2, r2] = pick(p, 1);
      say(p, [{ from: a1, to: b1, dur: 0.1, p0: r1, p1: r1 * 1.04, onset: 'h' }, { from: a2, to: b2, dur: 0.13, p0: r2, p1: r2 * 1.22, gap: 0.03 }], { level: lvl(1), x, delay: delayS, slow });
      break;
    }
    case 'effort': {
      if (quiet(cr, 0.9)) return;
      const i = nextIdx(cr);
      // "hup!"
      say(p, [{ from: 'u', to: 'a', dur: 0.075, p0: 1.1 + (i % 3) * 0.04, p1: 1.0, onset: 'h' }], { level: lvl(0.85), x, delay: delayS, slow });
      break;
    }
    case 'mode': {
      if (quiet(cr, 2.6)) return;
      const [a, b, r] = pick(p, nextIdx(cr) + 2);
      say(p, [{ from: a, to: b, dur: 0.085, p0: r, p1: r * 1.08 }], { level: lvl(0.7), x, delay: delayS, slow });
      break;
    }
    case 'strain': {
      if (quiet(cr, 3.2)) return;
      // a held "nnngh": nasal murmur with a pitch sag
      say({ ...p, growl: Math.max(p.growl, 0.45), sub: Math.max(p.sub, 0.3) }, [{ from: 'n', to: 'm', dur: 0.55, p0: 0.9, p1: 0.72 }], { level: lvl(0.75), x, delay: delayS, slow });
      break;
    }
    case 'wah': {
      lastSaid.set(cr.id, audioCtx()?.currentTime ?? 0);
      // "wah!": a quick u-to-a swoop up and a wail down
      say(p, [{ from: 'u', to: 'a', dur: 0.1, p0: 1.0, p1: 1.35 }, { from: 'a', to: 'o', dur: 0.2, p0: 1.35, p1: 0.9 }], { level: lvl(1), x, delay: delayS, slow });
      break;
    }
    case 'graft': {
      if (quiet(cr, 0.8)) return;
      say(p, [{ from: 'o', to: 'e', dur: 0.09, p0: 0.95, p1: 1.25 }], { level: lvl(0.8), x, delay: delayS, slow });
      break;
    }
    case 'gasp': {
      say(p, [{ from: 'a', to: 'a', dur: 0.1, p0: 1, p1: 1.1, onset: 'h' }], { level: lvl(0.7), x, delay: delayS, slow });
      break;
    }
    case 'happy': {
      lastSaid.set(cr.id, audioCtx()?.currentTime ?? 0);
      // a happy trill: four quick syllables stepping up
      const s: Syl[] = [];
      for (let i = 0; i < 4; i++) {
        const r = 0.95 + i * 0.1;
        s.push({ from: i % 2 ? 'i' : 'a', to: i % 2 ? 'a' : 'i', dur: 0.075, p0: r, p1: r * 1.1, gap: 0.03 });
      }
      say(p, s, { level: lvl(0.9), x, delay: delayS, slow });
      break;
    }
  }
}

/** Little Guy: tiny "aaa!", "yay!", "hm?" and a squeak. */
export function guySays(what: 'die' | 'yay' | 'hm' | 'squeak', x?: number, delayS = 0) {
  const p = GUY_PROFILE;
  switch (what) {
    case 'die':
      // "aaa!": a short scream sliding down
      say({ ...p, vibrato: 0.05, vibHz: 9 }, [{ from: 'a', to: 'o', dur: 0.5, p0: 1.15, p1: 0.62 }], { level: 0.55, x, delay: delayS });
      break;
    case 'yay':
      say(p, [{ from: 'e', to: 'i', dur: 0.1, p0: 1.0, p1: 1.15 }, { from: 'e', to: 'i', dur: 0.2, p0: 1.3, p1: 1.55, gap: 0.04 }], { level: 0.95, x, delay: delayS });
      break;
    case 'hm':
      say(p, [{ from: 'm', to: 'm', dur: 0.1, p0: 0.8, p1: 0.8 }, { from: 'm', to: 'e', dur: 0.14, p0: 0.85, p1: 1.15, gap: 0.03 }], { level: 0.8, x, delay: delayS });
      break;
    case 'squeak':
      say(p, [{ from: 'i', to: 'i', dur: 0.07, p0: 1.4, p1: 1.7 }], { level: 1.4, x, delay: delayS });
      break;
  }
}

/** Ninja: "hyah!" at the leap. */
export function ninjaSays(x?: number) {
  say(NINJA_PROFILE, [{ from: 'i', to: 'a', dur: 0.085, p0: 1.0, p1: 1.25, onset: 'h' }, { from: 'a', to: 'o', dur: 0.2, p0: 1.25 + rnd(-0.03, 0.03), p1: 0.85, gap: 0.0 }], { level: 0.95, x, bus: 'world', slow: true });
}

/** The Sumo bully: a deep "hoh!" as it starts to shove, a lower "hmph" when it stamps. */
export const BULLY_PROFILE: Profile = { ...GUY_PROFILE, f0: 88, wave: 'sawtooth', q: 5, fScale: 0.78, sub: 0.5, growl: 0.25, breath: 0.12, vol: 1.15 };
export function bullySays(what: 'hoh' | 'hmph', x?: number) {
  if (what === 'hoh') say(BULLY_PROFILE, [{ from: 'o', to: 'a', dur: 0.16, p0: 1.05, p1: 1.25, onset: 'h' }, { from: 'a', to: 'o', dur: 0.26, p0: 1.25, p1: 0.8, gap: 0.0 }], { level: 0.9, x, bus: 'world', slow: true });
  else say(BULLY_PROFILE, [{ from: 'u', to: 'o', dur: 0.2, p0: 0.95, p1: 0.78 }], { level: 0.7, x, bus: 'world', slow: true });
}
