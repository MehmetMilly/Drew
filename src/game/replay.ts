// Replays (design.md §11). The sim is deterministic, so a replay is a fresh world
// re-run from the level start with the same drawings born at the same steps.
// Highlight: the money moment again at 0.3× with a gentle zoom. Watch: a drawing
// timelapse per birth over the frozen frame, the action at 1×, then the moment.
import { World, type SimEvent } from '../sim/world';
import { startLevel, type LevelDef } from '../sim/level';
import type { PenPt } from '../sim/build';
import { WORLD } from '../tuning';

export interface Birth {
  step: number; // world.steps when the ink was born
  strokes: PenPt[][];
}

export interface Moment {
  t: number; // sim seconds
  x: number;
  y: number;
  score: number;
  type: string;
}

// what a moment is worth (design §11): a piece growing eyes scores highest
const SCORE: Record<string, number> = { knock: 9, punch: 3, piece: 10, throw: 8, graft: 7, grab: 6, boom: 5, tear: 4, ninjaLeap: 3, hug: 2, win: 2, save: 2 };

/** Pick the attempt's money moment from the world's events (ties go to the later one). */
export function pickMoment(w: World): Moment | null {
  let best: Moment | null = null;
  const born = w.events.find((e) => e.type === 'born');
  for (const e of w.events) {
    let s = SCORE[e.type] ?? 0;
    if (!s || (born && e.t < born.t)) continue;
    // a big event close to Little Guy is a near miss: worth more
    const p = where(w, e);
    if (w.guy && p) {
      const h = w.guy.alive ? w.P.x[w.guy.ids[2]] : p.x;
      if (Math.abs(p.x - h) < 120) s += 2;
    }
    if (!best || s >= best.score) best = { t: e.t, x: p?.x ?? WORLD.W / 2, y: p?.y ?? WORLD.H / 2, score: s, type: e.type };
  }
  return best;
}

function where(w: World, e: SimEvent): { x: number; y: number } | null {
  if (e.x !== undefined && e.y !== undefined) return { x: e.x, y: e.y };
  if (e.cr !== undefined && e.cr >= 0 && w.creatures[e.cr]) return w.centroid(w.creatures[e.cr]);
  if (w.guy) return { x: w.P.x[w.guy.ids[2]], y: w.P.y[w.guy.ids[2]] };
  return null;
}

export class Replay {
  world = new World({ seed: 1 });
  private next = 0;

  constructor(def: LevelDef, private births: Birth[]) {
    startLevel(this.world, def);
  }

  /** Step toward `step`, at most `budget` steps this call. True once there. */
  advance(step: number, budget: number): boolean {
    const w = this.world;
    while (w.steps < step && budget-- > 0) {
      this.bear();
      w.step();
    }
    if (w.steps >= step) this.bear();
    return w.steps >= step;
  }

  /** Step toward `step` without bearing a birth due exactly there (Watch draws it first). */
  advanceQuiet(step: number, budget: number): boolean {
    const w = this.world;
    while (w.steps < step && budget-- > 0) {
      if (this.due()) return true;
      w.step();
    }
    return w.steps >= step || !!this.due();
  }

  /** The birth due at the current step, if any (Watch draws it before it's born). */
  due(): Birth | null {
    const b = this.births[this.next];
    return b && b.step <= this.world.steps ? b : null;
  }

  private bear() {
    while (this.next < this.births.length && this.births[this.next].step <= this.world.steps) {
      this.world.addStrokes(this.births[this.next].strokes);
      this.next++;
    }
  }

  /** Watch mode: step one tick, but stop before a birth so the timelapse can play. */
  stepWatching(): void {
    if (this.due()) return;
    this.world.step();
  }

  /** Called by Watch once a birth's timelapse finishes. */
  bearDue() {
    this.bear();
  }
}
