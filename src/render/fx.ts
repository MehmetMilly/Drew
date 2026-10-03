// Juice (look-and-feel §6): one table of hit-stop, trauma shake and onomatopoeia per
// sim event, tuned together. Shake moves the world canvas only, never the UI layer.
import type { SimEvent } from '../sim/world';
import { COLORS, WORLD } from '../tuning';

type Ctx = CanvasRenderingContext2D;

// event → [hit-stop s, trauma, word]
const JUICE: Record<string, [number, number, string?]> = {
  boom: [0.12, 0.45, 'BOOM'],
  piece: [0.08, 0.15, 'SNIP'],
  tear: [0, 0.08],
  guyDied: [0.1, 0.25],
  win: [0, 0.3], // the stamp's own hit-stop lives in LEVEL.hitStop
  throw: [0.06, 0.2, 'FWOOSH'],
  grab: [0.05, 0.12],
  ninjaLeap: [0, 0.05],
};
const LAND_TRAUMA = 0.1;
const DECAY = 1.2; // trauma per second
const MAX_OFF = 10; // px
const MAX_ANG = (1.5 * Math.PI) / 180;
const WORD_LIFE = 0.4;

export class Juice {
  trauma = 0;
  private word: { text: string; x: number; y: number; t0: number; tilt: number } | null = null;
  private n = 0;

  /** Returns the hit-stop (seconds) this event asks for. */
  event(e: SimEvent, now: number, reduced: boolean): number {
    let j = JUICE[e.type];
    if (e.type === 'dust' && e.pts && e.pts.length >= 4) j = [0, LAND_TRAUMA];
    if (!j) return 0;
    if (!reduced) this.trauma = Math.min(1, this.trauma + j[1]);
    // at most one word on screen, only for the biggest moments
    if (j[2] && e.x !== undefined && (!this.word || now - this.word.t0 > WORD_LIFE)) {
      this.n++;
      this.word = { text: j[2], x: e.x, y: (e.y ?? 0) - 40, t0: now, tilt: (this.n % 2 ? -1 : 1) * 0.12 };
    }
    return j[0];
  }

  /** Decay and apply the shake to a page-space transform. */
  shake(g: Ctx, dt: number, now: number) {
    this.trauma = Math.max(0, this.trauma - DECAY * dt);
    if (this.trauma <= 0) return;
    const s = this.trauma * this.trauma;
    // smooth noise from a few incommensurate sines (render-side: wall clock is fine)
    const nx = Math.sin(now * 61.3) * 0.6 + Math.sin(now * 37.1 + 1.3) * 0.4;
    const ny = Math.sin(now * 53.7 + 2.1) * 0.6 + Math.sin(now * 29.9 + 0.4) * 0.4;
    const na = Math.sin(now * 47.3 + 4.2);
    g.translate(WORLD.W / 2 + nx * MAX_OFF * s, WORLD.H / 2 + ny * MAX_OFF * s);
    g.rotate(na * MAX_ANG * s);
    g.translate(-WORLD.W / 2, -WORLD.H / 2);
  }

  /** Hand-lettered onomatopoeia: pops in with an overshoot, holds, fades. */
  draw(g: Ctx, now: number) {
    const w = this.word;
    if (!w) return;
    const a = now - w.t0;
    if (a > WORD_LIFE) {
      this.word = null;
      return;
    }
    // 0.95 → 1.25 overshoot in 80 ms, settle to 1 over the next 100 ms
    const s = a < 0.08 ? 0.95 + 0.3 * (a / 0.08) : 1.25 - 0.25 * Math.min(1, (a - 0.08) / 0.1);
    g.save();
    g.translate(w.x, w.y);
    g.rotate(w.tilt);
    g.scale(s, s);
    g.globalAlpha = a > WORD_LIFE - 0.1 ? (WORD_LIFE - a) / 0.1 : 1;
    g.font = '64px "Gochi Hand", cursive';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.lineJoin = 'round';
    g.lineWidth = 10;
    g.strokeStyle = '#FFFDF6';
    g.strokeText(w.text, 0, 0);
    g.fillStyle = COLORS.felt;
    g.fillText(w.text, 0, 0);
    g.restore();
  }
}
