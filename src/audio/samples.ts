// Sample pools (audio.md §2 variation rules, §6 sourcing). The shipped files are Kenney CC0
// one-shots, trimmed and normalised (see CREDITS.md). Each pool has 2-3 variants; a pick never
// repeats the last one, and every play gets +-6% pitch and +-1.5 dB jitter. At most 4 of the
// same sound ring at once; a newcomer steals from the quietest.
import { audioCtx, dbGain, levelJitter, panTo, pitchJitter } from './mixer';

const POOLS: Record<string, number> = { thud: 3, plop: 3, bonk: 3, thwap: 3, ui: 3, stamp: 2 };
export type SampleName = keyof typeof POOLS | string;

const bufs = new Map<string, AudioBuffer[]>();
const lastPick = new Map<string, number>();
const live = new Map<string, { src: AudioBufferSourceNode; gain: number; end: number }[]>();
let loading = false;

function ext(): 'ogg' | 'mp3' {
  try {
    const a = document.createElement('audio');
    if (a.canPlayType('audio/ogg; codecs="vorbis"')) return 'ogg';
  } catch {
    /* fall through */
  }
  return 'mp3';
}

/** Fetch and decode every pool once, after the first gesture. Failures just leave a pool empty. */
export function loadSamples() {
  const ctx = audioCtx();
  if (!ctx || loading) return;
  loading = true;
  const e = ext();
  const base = (import.meta.env?.BASE_URL as string | undefined) ?? '/';
  for (const [name, n] of Object.entries(POOLS)) {
    for (let i = 0; i < n; i++) {
      fetch(`${base}audio/${name}_${i}.${e}`)
        .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
        .then((ab) => ctx.decodeAudioData(ab))
        .then((buf) => {
          const a = bufs.get(name) ?? [];
          a[i] = buf;
          bufs.set(name, a);
        })
        .catch(() => {
          /* the synthesised layer of every sound still plays */
        });
    }
  }
}

export function samplesReady(name: SampleName) {
  return !!bufs.get(name)?.some(Boolean);
}

export interface PlayOpts {
  bus: AudioNode;
  /** extra level in dB */
  db?: number;
  /** playback rate (pitch) before jitter */
  rate?: number;
  /** world x for stereo pan */
  x?: number;
  /** seconds from now */
  delay?: number;
  /** low-pass (Hz) for a muffled voice, e.g. a thud heard through paper */
  lp?: number;
}

export function playSample(name: SampleName, o: PlayOpts) {
  const ctx = audioCtx();
  const pool = bufs.get(name)?.filter(Boolean);
  if (!ctx || !pool || !pool.length) return;
  // pick without an immediate repeat
  let k = Math.floor(Math.random() * pool.length);
  if (pool.length > 1 && k === lastPick.get(name)) k = (k + 1 + Math.floor(Math.random() * (pool.length - 1))) % pool.length;
  lastPick.set(name, k);
  const buf = pool[k];
  const gain = dbGain(o.db ?? 0) * levelJitter();
  const rate = (o.rate ?? 1) * pitchJitter();
  const t = ctx.currentTime + (o.delay ?? 0);
  const dur = buf.duration / rate;

  // voice limit: 4 of the same sound, steal from the quietest
  const a = (live.get(name) ?? []).filter((v) => v.end > ctx.currentTime);
  if (a.length >= 4) {
    let qi = 0;
    for (let i = 1; i < a.length; i++) if (a[i].gain < a[qi].gain) qi = i;
    if (a[qi].gain >= gain) {
      live.set(name, a);
      return;
    }
    try {
      a[qi].src.stop();
    } catch {
      /* already ended */
    }
    a.splice(qi, 1);
  }

  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = gain;
  let tail: AudioNode = g;
  if (o.lp) {
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = o.lp;
    g.connect(f);
    tail = f;
  }
  tail.connect(panTo(o.bus, o.x));
  src.connect(g);
  src.start(t);
  a.push({ src, gain, end: t + dur });
  live.set(name, a);
}
