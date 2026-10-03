// Adaptive music (audio.md §5), synthesised so it costs no bytes and no licence: a picture-book
// loop in C major at 100 BPM (pizzicato strings, glockenspiel, upright bass, brushed snare,
// ukulele chops). Two layers run on one clock and are crossfaded:
//   calm   (pizzicato arpeggio + glockenspiel tune)  menus, the Read phase, after a win
//   action (adds bass, brushes, ukulele chops)       SAVE countdowns and threats
// The last three seconds of a countdown add a woodblock ostinato. Slow time is handled by the
// mixer (Music low-pass + -10 dB), so this module only decides what to play.
//
// TODO (stock music): the style and layering are what docs/audio.md §5 asks for, but the
// notes are procedural. When stock tracks are picked (Incompetech/OpenGameArt per §6, with a
// calm and an action version in the same key and tempo), replace schedule() with two looping
// buffer sources into `calm` and `action` below; the crossfade and mixer need no change.
import { audioCtx, buses, noise } from './mixer';
import { bell, pluck } from './synth';

const BPM = 100;
const EIGHTH = 60 / BPM / 2;
const SLOTS = 64; // 8 bars of 8 eighths

const mtof = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

// bar -> chord: bass note, triad (octave 4)
const CHORDS: { bass: number; tri: number[] }[] = [
  { bass: 48, tri: [60, 64, 67] }, // C
  { bass: 45, tri: [57, 60, 64] }, // Am
  { bass: 53, tri: [60, 65, 69] }, // F
  { bass: 43, tri: [59, 62, 67] }, // G
  { bass: 48, tri: [60, 64, 67] }, // C
  { bass: 52, tri: [59, 64, 67] }, // Em
  { bass: 53, tri: [60, 65, 69] }, // F
  { bass: 43, tri: [59, 62, 67] }, // G
];
// glockenspiel tune: 8 eighths per bar (0 = rest)
const TUNE: number[][] = [
  [76, 0, 79, 0, 76, 0, 72, 0],
  [72, 0, 76, 0, 81, 0, 76, 0],
  [77, 0, 81, 0, 77, 0, 72, 0],
  [74, 0, 79, 0, 71, 0, 67, 0],
  [76, 0, 79, 0, 84, 0, 79, 0],
  [76, 0, 79, 0, 83, 0, 79, 0],
  [81, 0, 77, 0, 72, 0, 77, 0],
  [74, 0, 77, 0, 71, 0, 0, 0],
];
const ARP = [0, 1, 2, 1, 0, 1, 2, 1];

let calm: GainNode | null = null;
let action: GainNode | null = null;
let started = false;
let timer = 0;
let next = 0; // audio time of the next eighth
let idx = 0;

let wantAction = false;
let wantTick = false;
let actionLevel = 0; // what the action layer gain is heading for
let calmLevel = 1;

/** Start the loop once the audio context exists (safe to call every frame). */
export function startMusic() {
  const c = audioCtx();
  const b = buses();
  if (started || !c || !b) return;
  started = true;
  calm = c.createGain();
  calm.gain.value = 1;
  action = c.createGain();
  action.gain.value = 0;
  calm.connect(b.music);
  action.connect(b.music);
  next = c.currentTime + 0.1;
  idx = 0;
  tick();
  timer = window.setInterval(tick, 90);
  document.addEventListener('visibilitychange', () => {
    // a backgrounded tab throttles timers: restart the grid rather than dump a burst of notes
    if (!document.hidden && audioCtx()) {
      next = audioCtx()!.currentTime + 0.08;
    }
  });
}

export function stopMusic() {
  if (timer) clearInterval(timer);
  timer = 0;
  started = false;
}

/** action: threats and countdowns; tick: the last three seconds of a countdown. */
export function setMusicState(isAction: boolean, ticking: boolean) {
  const c = audioCtx();
  if (!c || !calm || !action) return;
  if (isAction !== wantAction) {
    wantAction = isAction;
    const t = c.currentTime;
    actionLevel = isAction ? 1 : 0;
    calmLevel = isAction ? 0.75 : 1;
    // crossfade over about a second (time constant a third of that)
    action.gain.setTargetAtTime(actionLevel, t, isAction ? 0.35 : 0.5);
    calm.gain.setTargetAtTime(calmLevel, t, 0.4);
  }
  wantTick = ticking;
}

let enabled = true;
/** Pause scheduling while sound or music is off (the buses are muted anyway). */
export function setMusicEnabled(on: boolean) {
  enabled = on;
}

function tick() {
  const c = audioCtx();
  if (!c || !calm || !action) return;
  const now = c.currentTime;
  if (!enabled) {
    next = now + 0.1;
    return;
  }
  if (next < now - 0.2) next = now + 0.05; // fell behind (tab throttled)
  while (next < now + 0.45) {
    schedule(c, idx % SLOTS, next);
    next += EIGHTH;
    idx++;
  }
}

function schedule(c: AudioContext, slot: number, t: number) {
  const bar = Math.floor(slot / 8);
  const e = slot % 8; // eighth within the bar
  const ch = CHORDS[bar];
  const calmDest = calm!;
  const actDest = action!;

  // ---- calm layer: pizzicato arpeggio on every eighth, glockenspiel tune on top
  const arpNote = ch.tri[ARP[e] % 3] + (ARP[e] === 2 ? 12 : 0);
  pluck(c, calmDest, t, mtof(arpNote), 0.32, e % 4 === 0 ? 0.13 : 0.085, 2600);
  const tune = TUNE[bar][e];
  if (tune) bell(c, calmDest, t, mtof(tune), 0.85, 0.09);
  // a warm low pluck on beat 1 so calm is never thin
  if (e === 0) pluck(c, calmDest, t, mtof(ch.bass + 12), 0.5, 0.07, 1400);

  // ---- action layer: upright bass, brushes, ukulele chops (skipped while it is faded out)
  if (wantAction || actionLevel > 0) {
    if (e === 0 || e === 4) pluck(c, actDest, t, mtof(e === 0 ? ch.bass : ch.bass + 7), 0.42, 0.42, 1100, 'triangle');
    if (e === 6) pluck(c, actDest, t, mtof(ch.bass + 2 * (bar % 2 ? 1 : 2)), 0.25, 0.2, 900);
    // brushed snare on 2 and 4, soft ghost strokes between
    if (e === 2 || e === 6) brush(c, actDest, t, 0.1, 0.2);
    else if (e % 2 === 1) brush(c, actDest, t, 0.05, 0.05);
    // ukulele chop on the off-beats
    if (e === 3 || e === 7) ch.tri.forEach((m, i) => pluck(c, actDest, t + i * 0.006, mtof(m + 12), 0.1, 0.08, 3200, 'triangle'));
  }

  // ---- last three seconds of a countdown: woodblock ostinato
  if (wantTick) wood(c, calmDest, t, e % 2 === 0 ? 1175 : 880, e % 4 === 0 ? 0.11 : 0.07);
}

function brush(c: AudioContext, dest: AudioNode, t: number, dur: number, gain: number) {
  const n = c.createBufferSource();
  n.buffer = noise();
  const hp = c.createBiquadFilter();
  hp.type = 'bandpass';
  hp.frequency.value = 5200;
  hp.Q.value = 0.6;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  n.connect(hp).connect(g).connect(dest);
  n.start(t, Math.random() * 1.5, dur + 0.02);
}

function wood(c: AudioContext, dest: AudioNode, t: number, f: number, gain: number) {
  const o = c.createOscillator();
  o.frequency.setValueAtTime(f * 1.03, t);
  o.frequency.exponentialRampToValueAtTime(f, t + 0.01);
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.002);
  g.gain.exponentialRampToValueAtTime(0.0001, t + 0.05);
  o.connect(g).connect(dest);
  o.start(t);
  o.stop(t + 0.07);
}

