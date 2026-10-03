// Sim-event sounds (audio.md). The toy page feeds every new world event to sfxEvent once and
// calls sfxFrame once per rendered frame. Event sounds are one-shots (synth.ts, samples.ts,
// voice.ts); sfxFrame owns everything continuous: boulder rumble, crusher grind, bomb fuse
// hiss, footsteps and landings (sampled from creature state), countdown ticks, the fail
// sting, the music layer state and slow time.
//
// Event table:
//   born     paper pop (pencil.ts) + double-blink tick + the creature's first gasp (voice)
//   piece    a severed limb wakes: "wah!" + bloop
//   graft    sticker thwap + a little "oh!"
//   tear     pencil-lead snap + "!" bloop
//   dust     poof (strength by how much ink dissolved)
//   fell     cartoon falling whistle
//   grab     rubbery grip squeak + "hup"
//   throw    whoosh + "hup"
//   jump     boing (springs) + "hup"
//   punch    cardboard bonk + a small boing
//   boom     explosion (ducks music)
//   ninjaLeap "hyah!" + whoosh
//   guyDied  Little Guy's "aaa!"
//   hug      Little Guy's squeak
//   save/win chime / stamp thunk + kazoo-and-ukulele sting + happy trills (ducks music)
//   (result 'fail' is watched per frame) soft wah-wah sting
import type { SimEvent, World } from '../sim/world';
import type { Creature } from '../sim/creature';
import { countdown, threats } from '../sim/level';
import { HAZ } from '../tuning';
import { load } from '../game/save';
import { applyVolumes, audioCtx, setSlow, soundOn } from './mixer';
import { setMusicEnabled, setMusicState, startMusic } from './music';
import * as S from './synth';
import { creatureSays, guySays, ninjaSays } from './voice';

const SUBSTEP_H = 1 / 120; // physics.md: 60 Hz, 2 substeps

interface CrTrack {
  mode: string;
  step: number;
  y: number;
  vy: number;
  landedAt: number;
  modeSince: number;
}

interface State {
  world: World | null;
  loops: Map<number, { v: S.LoopVoice; quietSince: number; fuse0?: number }>;
  cr: Map<number, CrTrack>;
  lastT: number;
  lastSec: number;
  failDone: boolean;
  winAt: number;
}

const st: State = { world: null, loops: new Map(), cr: new Map(), lastT: 0, lastSec: Infinity, failDone: false, winAt: -99 };
let started = false;
let room: S.LoopVoice | null = null;

function ensureStarted() {
  if (started || !audioCtx()) return;
  started = true;
  startMusic();
  room = S.roomTone();
}

function resetFor(w: World) {
  for (const l of st.loops.values()) l.v.stop();
  st.loops.clear();
  st.cr.clear();
  st.world = w;
  st.lastT = w.t;
  st.lastSec = Infinity;
  st.failDone = false;
  st.winAt = -99;
}

function creatureOf(w: World, id: number | undefined): Creature | null {
  if (id === undefined || id < 0) return null;
  const direct = w.creatures[id];
  if (direct && direct.id === id) return direct;
  return w.creatures.find((c) => c.id === id) ?? null;
}

const centreX = (w: World, cr: Creature) => w.centroid(cr).x;

export function sfxEvent(e: SimEvent, w: World, _timeScale: number) {
  if (!audioCtx() || !soundOn()) return;
  ensureStarted();
  const cr = creatureOf(w, e.cr);
  const size = cr?.stats.size ?? 150;
  switch (e.type) {
    case 'born':
      S.blinkTicks(0.14);
      if (cr) creatureSays(cr, 'birth', centreX(w, cr), 0.2, true);
      break;
    case 'piece':
      S.bloop(e.x, 620, 0.02, 0.2, 'creatures');
      if (cr) creatureSays(cr, 'wah', e.x, 0.05, true);
      break;
    case 'graft':
      S.sticker(cr ? centreX(w, cr) : undefined);
      if (cr) creatureSays(cr, 'graft', centreX(w, cr), 0.06, true);
      break;
    case 'tear': {
      // text is "why:type:rest": a long-rest link snapping is a bigger snap
      const rest = parseFloat((e.text ?? '').split(':')[2] ?? '');
      S.snap(e.x, isFinite(rest) ? Math.max(0.4, Math.min(1, rest / 30)) : 0.7);
      break;
    }
    case 'dust': {
      const p = e.pts ?? [];
      let sx = 0;
      for (let i = 0; i < p.length; i += 2) sx += p[i];
      S.poof(p.length ? sx / (p.length / 2) : undefined, Math.min(1, p.length / 2 / 60));
      break;
    }
    case 'fell':
      S.fallWhistle();
      break;
    case 'grab':
      S.gripSqueak(e.x);
      if (cr) creatureSays(cr, 'effort', e.x, 0, true);
      break;
    case 'throw':
      S.whoosh(e.x, size, 1);
      if (cr) creatureSays(cr, 'effort', e.x, 0, true);
      break;
    case 'jump':
      S.boing(e.x, size, 1);
      if (cr) creatureSays(cr, 'effort', e.x, 0.01, true);
      break;
    case 'punch':
      S.bonk(e.x, 1);
      S.boing(e.x, size * 0.5, 0.35);
      break;
    case 'boom':
      S.boom(e.x);
      break;
    case 'ninjaLeap':
      S.whoosh(e.x, 45, 0.9, 0.3);
      ninjaSays(e.x);
      break;
    case 'guyDied':
      guySays('die', e.x);
      break;
    case 'hug':
      guySays('squeak', e.x);
      S.bloop(e.x, 520, 0.03, 0.1, 'world');
      break;
    case 'save':
      if (w.t - st.winAt > 1) S.chime();
      break;
    case 'win': {
      st.winAt = w.t;
      S.winSting();
      guySays('yay', undefined, 0.5);
      let n = 0;
      for (const c of w.creatures) {
        if (!c.alive || n >= 3) continue;
        creatureSays(c, 'happy', centreX(w, c), 0.45 + n * 0.14, false);
        n++;
      }
      break;
    }
    default:
      break;
  }
}

/** UI sounds for the shell: 'tap' (button press), 'back', 'page' (page turn). */
export function sfxUi(kind: 'tap' | 'back' | 'page' = 'tap') {
  if (!audioCtx() || !soundOn()) return;
  S.uiTap(kind);
}

/** A countdown numeral landing (3, 2, 1 rise in pitch). The frame loop calls this itself. */
export function sfxCountdown(secondsLeft: number) {
  if (!audioCtx() || !soundOn()) return;
  S.woodblock(3 - Math.max(1, Math.min(3, secondsLeft)));
}

/** The fail sting (also played automatically when the level result turns to fail). */
export function sfxFail(delay = 0) {
  if (!audioCtx() || !soundOn()) return;
  S.failSting(delay);
}

/** Called once per rendered frame for continuous layers (rolling, wind, music ducking). */
export function sfxFrame(w: World, timeScale: number) {
  const ctx = audioCtx();
  if (!ctx) return;
  applyVolumes();
  const on = soundOn();
  const musicOn = on && load().settings.music > 0;
  setMusicEnabled(musicOn);
  if (!on) {
    for (const l of st.loops.values()) l.v.stop();
    st.loops.clear();
    return;
  }
  ensureStarted();
  if (st.world !== w) resetFor(w);

  // slow time: low-pass and duck music, lower world pitch. timeScale is eased by the toy page.
  setSlow(Math.max(0, Math.min(1, (1 - timeScale) / 0.6)));

  hazardLoops(w);
  creaturesFrame(w);
  levelFrame(w);
  st.lastT = w.t;
  void room;
}

// ------------------------------------------------------------------ hazards

function hazardLoops(w: World) {
  const seen = new Set<number>();
  for (const b of w.bodies) {
    if (!b.alive || (b.data.sleep ?? 0) > w.t) continue;
    let a = 0;
    let key: 'rumble' | 'grind' | 'hiss' | '' = '';
    let a2 = 0;
    if (b.kind === 'boulder') {
      const v = Math.hypot(b.x - b.px, b.y - b.py) / SUBSTEP_H;
      a = v < 25 ? 0 : Math.min(1, v / 380);
      key = 'rumble';
    } else if (b.kind === 'crusher') {
      const v = Math.abs(b.x - b.px) / SUBSTEP_H;
      const want = b.data.speed || 70;
      a = Math.min(1, v / want);
      // the motor pushes at full force whether or not the ink lets it move: strain is lost speed
      a2 = a > 0.04 ? Math.max(0, Math.min(1, 1 - a)) : 0;
      key = 'grind';
    } else if (b.kind === 'bomb') {
      key = 'hiss';
    }
    if (!key) continue;
    seen.add(b.id);
    let l = st.loops.get(b.id);
    if (!l) {
      const v = key === 'rumble' ? S.rumbleLoop() : key === 'grind' ? S.grindLoop() : S.hissLoop();
      if (!v) continue;
      l = { v, quietSince: w.t, fuse0: key === 'hiss' ? Math.max(0.5, b.data.fuse ?? HAZ.bombFuse) : undefined };
      st.loops.set(b.id, l);
    }
    if (key === 'hiss') {
      const burn = 1 - Math.max(0, Math.min(1, (b.data.fuse ?? 0) / (l.fuse0 ?? HAZ.bombFuse)));
      l.v.update(0.3 + 0.7 * burn, 0, b.x);
    } else {
      l.v.update(a, a2, b.x);
      if (a > 0.02) l.quietSince = w.t;
    }
  }
  for (const [id, l] of st.loops) {
    const rolledToAStop = w.t - l.quietSince > 0.6;
    if (!seen.has(id) || rolledToAStop) {
      l.v.stop();
      st.loops.delete(id);
    }
  }
}

// ------------------------------------------------------------------ creatures

const TALKY = new Set(['reach', 'guard', 'intercept', 'brace', 'carry']);

function creaturesFrame(w: World) {
  const dt = w.t - st.lastT;
  const live = new Set<number>();
  for (const cr of w.creatures) {
    if (!cr.alive) continue;
    live.add(cr.id);
    let tr = st.cr.get(cr.id);
    const c = w.centroid(cr);
    if (!tr) {
      tr = { mode: cr.brain.mode, step: Math.floor(cr.brain.gaitPhase * 2), y: c.y, vy: 0, landedAt: -9, modeSince: w.t };
      st.cr.set(cr.id, tr);
      continue;
    }

    // footsteps: one soft tap per half gait cycle while walking or scurrying
    if (cr.gait === 'walk' || cr.gait === 'scurry') {
      const step = Math.floor(cr.brain.gaitPhase * 2);
      if (step > tr.step && step - tr.step <= 2) S.footstep(c.x, cr.stats.size, cr.gait === 'scurry' ? 0.6 : 1);
      tr.step = step;
    }

    // mode changes get one syllable; holding a heavy carry or brace gets a straining "nnngh"
    if (cr.brain.mode !== tr.mode) {
      if (TALKY.has(cr.brain.mode) && w.t - cr.bornAt > 1.2) creatureSays(cr, 'mode', c.x, 0, true);
      tr.mode = cr.brain.mode;
      tr.modeSince = w.t;
    } else if ((tr.mode === 'carry' || tr.mode === 'brace') && w.t - tr.modeSince > 0.9) {
      creatureSays(cr, 'strain', c.x, 0, true);
    }

    // landings: a fast fall that suddenly stops
    if (dt > 0) {
      const vy = (c.y - tr.y) / dt;
      if (tr.vy > 380 && vy < tr.vy * 0.35 && w.t - tr.landedAt > 0.2) {
        S.thump(c.x, Math.max(0.15, Math.min(1, (tr.vy - 380) / 900)), cr.stats.size);
        tr.landedAt = w.t;
      }
      tr.vy = vy;
      tr.y = c.y;
    }
  }
  for (const id of st.cr.keys()) if (!live.has(id)) st.cr.delete(id);
}

// ------------------------------------------------------------------ level

function levelFrame(w: World) {
  const L = w.level;
  let action = false;
  let ticking = false;
  if (L && L.result === 'play' && L.startedAt >= 0) {
    const cd = countdown(w);
    action = cd !== null || threats(w).length > 0;
    if (cd !== null && cd > 0 && cd <= 3) {
      ticking = true;
      const sec = Math.ceil(cd);
      if (sec !== st.lastSec) {
        S.woodblock(3 - sec);
        st.lastSec = sec;
      }
    }
  }
  setMusicState(action, ticking);
  if (L && L.result === 'fail' && !st.failDone) {
    st.failDone = true;
    S.failSting(0.2);
  }
}
