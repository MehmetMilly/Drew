// Placeholder pencil scratch (audio.md §3): band-passed noise whose grain density
// follows pen speed and brightness follows pressure. The audio subagent replaces
// the mixer around it in Phase 3; the pencil stays synthesised by design.

let ctx: AudioContext | null = null;
let src: AudioBufferSourceNode | null = null;
let bp: BiquadFilterNode | null = null;
let hp: BiquadFilterNode | null = null;
let gain: GainNode | null = null;
let grain: GainNode | null = null;
let lfo: OscillatorNode | null = null;
let level = 0;

export function audioCtx(): AudioContext | null {
  return ctx;
}

/** Create/resume the context on a user gesture. */
export function unlockAudio() {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      const len = ctx.sampleRate * 2;
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const d = buf.getChannelData(0);
      // crackly noise: white noise with sparse louder grains (graphite on tooth)
      let seed = 12345;
      for (let i = 0; i < len; i++) {
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const r = seed / 4294967296;
        seed = (seed * 1664525 + 1013904223) >>> 0;
        const spike = seed / 4294967296 > 0.985 ? 3 : 1;
        d[i] = (r * 2 - 1) * 0.5 * spike;
      }
      src = ctx.createBufferSource();
      src.buffer = buf;
      src.loop = true;
      hp = ctx.createBiquadFilter();
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
      const lfoAmt = ctx.createGain();
      lfoAmt.gain.value = 0.35;
      lfo.connect(lfoAmt).connect(grain.gain);
      gain = ctx.createGain();
      gain.gain.value = 0;
      src.connect(hp).connect(bp).connect(grain).connect(gain).connect(ctx.destination);
      src.start();
      lfo.start();
      document.addEventListener('visibilitychange', () => {
        if (!document.hidden) ctx?.resume();
      });
    }
    if (ctx.state === 'suspended') ctx.resume();
  } catch {
    ctx = null;
  }
}

/** Drive the scratch from pen speed (px/s, page space) and pressure (0..1). */
export function pencil(speed: number, pressure = 0.5, down = true) {
  if (!ctx || !gain || !bp || !lfo) return;
  const t = ctx.currentTime;
  const target = down ? Math.min(1, speed / 900) : 0;
  level += (target - level) * 0.5;
  gain.gain.setTargetAtTime(level * 0.55, t, 0.015);
  bp.frequency.setTargetAtTime(2200 + 2600 * pressure + 900 * level, t, 0.02);
  lfo.frequency.setTargetAtTime(18 + 60 * level, t, 0.03);
}

/** Tiny lift tick. */
export function pencilTick() {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator();
  const g = ctx.createGain();
  o.type = 'triangle';
  o.frequency.setValueAtTime(2400, t);
  o.frequency.exponentialRampToValueAtTime(900, t + 0.03);
  g.gain.setValueAtTime(0.12, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g).connect(ctx.destination);
  o.start(t);
  o.stop(t + 0.06);
}

/** Birth: a soft whoosh as time snaps back, then a rising "bloop" as the eyes pop. */
export function birthPop(delay = 0) {
  if (!ctx) return;
  const t = ctx.currentTime + delay;
  // whoosh: band-passed noise sweeping up
  const n = ctx.createBufferSource();
  const buf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.25), ctx.sampleRate);
  const d = buf.getChannelData(0);
  let s = 7;
  for (let i = 0; i < d.length; i++) {
    s = (s * 16807) % 2147483647;
    d[i] = (s / 2147483647) * 2 - 1;
  }
  n.buffer = buf;
  const f = ctx.createBiquadFilter();
  f.type = 'bandpass';
  f.Q.value = 1.2;
  f.frequency.setValueAtTime(500, t);
  f.frequency.exponentialRampToValueAtTime(2400, t + 0.2);
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.0001, t);
  ng.gain.exponentialRampToValueAtTime(0.09, t + 0.08);
  ng.gain.exponentialRampToValueAtTime(0.0001, t + 0.24);
  n.connect(f).connect(ng).connect(ctx.destination);
  n.start(t);
  n.stop(t + 0.25);
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
  o.connect(g).connect(ctx.destination);
  o.start(t2);
  o.stop(t2 + 0.18);
}
