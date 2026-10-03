// Playback over the page after a result (design.md §11): the win highlight and the
// full Watch replay. Re-simulates with Replay; catch-up runs in small time slices
// so a phone never drops a frame doing it.
import { WORLD, COLORS } from '../tuning';
import { WorldRenderer } from '../render/renderer';
import { drawWet } from './ink';
import type { LevelDef } from '../sim/level';
import { Replay, type Birth, type Moment } from './replay';

type Ctx = CanvasRenderingContext2D;

const MOMENT_BEFORE = 0.6; // sim seconds shown either side of the money moment
const MOMENT_AFTER = 0.6;
const MOMENT_SPEED = 0.3;
const PEN_SPEED = 1.5; // Watch timelapse, × the player's own pen speed
const STROKE_GAP = 0.15;
const ZOOM = 0.12;
const SLICE_MS = 5; // catch-up budget per frame

const stepOf = (t: number) => Math.max(0, Math.round(t / WORLD.dt));

export class Show {
  phase: 'catchup' | 'draw' | 'action' | 'moment' | 'done';
  private main: Replay;
  private momentR: Replay;
  private renderer: WorldRenderer;
  private acc = 0;
  private from: number;
  private to: number;
  private endStep: number;
  private penT = 0;
  private momentT0 = 0;
  private shown: Replay;

  constructor(
    def: LevelDef,
    births: Birth[],
    private moment: Moment | null,
    endStep: number,
    readonly kind: 'highlight' | 'watch',
    private visibleAt: number, // real seconds: the highlight waits for the stamp
    private reduced: boolean,
    private title: string | null = null, // Save clip: the title card burned into the start
  ) {
    this.momentR = new Replay(def, births);
    this.main = kind === 'watch' ? new Replay(def, births) : this.momentR;
    this.shown = this.main;
    this.renderer = new WorldRenderer(this.main.world);
    this.endStep = endStep + 60;
    const m = moment?.t ?? endStep * WORLD.dt;
    this.from = stepOf(m - MOMENT_BEFORE);
    this.to = Math.min(this.endStep, stepOf(m + MOMENT_AFTER));
    this.phase = kind === 'watch' ? 'action' : moment ? 'catchup' : 'done';
  }

  get visible() {
    return this.phase !== 'done' && this.phase !== 'catchup';
  }

  skip() {
    this.phase = 'done';
  }

  private catchUp() {
    const t0 = performance.now();
    while (performance.now() - t0 < SLICE_MS) if (this.momentR.advance(this.from, 4)) return true;
    return false;
  }

  private titleUp(now: number) {
    return !!this.title && now - this.visibleAt < 1.4;
  }

  update(dt: number, now: number) {
    if (this.titleUp(now)) return;
    if (this.phase === 'catchup') {
      if (this.catchUp() && now >= this.visibleAt) this.startMoment();
      return;
    }
    if (this.phase === 'draw') {
      this.penT += dt * PEN_SPEED;
      if (this.penT > this.penLength() + 0.25) {
        this.main.bearDue();
        this.phase = 'action';
      }
      return;
    }
    if (this.phase === 'action') {
      // the moment's own replay catches up in the background while the action plays
      if (this.momentR !== this.main) this.catchUp();
      if (this.main.due()) {
        this.phase = 'draw';
        this.penT = 0;
        return;
      }
      this.acc += dt;
      while (this.acc >= WORLD.dt && this.main.world.steps < this.endStep) {
        this.acc -= WORLD.dt;
        this.main.stepWatching();
        if (this.main.due()) break;
      }
      if (this.main.world.steps >= this.endStep) {
        if (!this.moment) this.phase = 'done';
        else if (this.catchUp()) this.startMoment();
      }
      return;
    }
    if (this.phase === 'moment') {
      this.acc += dt * MOMENT_SPEED;
      while (this.acc >= WORLD.dt && this.momentR.world.steps < this.to) {
        this.acc -= WORLD.dt;
        this.momentR.advance(this.momentR.world.steps + 1, 1);
      }
      if (this.momentR.world.steps >= this.to) this.phase = 'done';
    }
  }

  private startMoment() {
    this.phase = 'moment';
    this.acc = 0;
    this.momentT0 = this.momentR.world.steps;
    if (this.shown !== this.momentR) {
      this.shown = this.momentR;
      this.renderer.reset(this.momentR.world);
    }
  }

  private penLength() {
    const b = this.main.due();
    if (!b) return 0;
    let t = 0;
    for (const s of b.strokes) t += (s[s.length - 1]?.t ?? 0) + STROKE_GAP;
    return t;
  }

  draw(g: Ctx, realT: number, intentLines: boolean) {
    const w = this.shown.world;
    if (this.titleUp(realT)) {
      // title card for the clip: the level name, handwritten, on clean paper
      g.save();
      g.fillStyle = COLORS.felt;
      g.textAlign = 'center';
      g.font = '84px "Gochi Hand", cursive';
      g.fillText(this.title ?? "", WORLD.W / 2, WORLD.H / 2 - 20);
      g.font = '40px "Gochi Hand", cursive';
      g.fillStyle = COLORS.graphite;
      g.fillText('drawn in Drew', WORLD.W / 2, WORLD.H / 2 + 50);
      g.restore();
      return;
    }
    g.save();
    if (this.phase === 'moment' && this.moment && !this.reduced) {
      const k = Math.min(1, (w.steps - this.momentT0) / Math.max(1, this.to - this.momentT0));
      const z = 1 + ZOOM * (1 - Math.pow(1 - k, 3));
      g.translate(this.moment.x, this.moment.y);
      g.scale(z, z);
      g.translate(-this.moment.x, -this.moment.y);
    }
    this.renderer.draw(g, { alpha: 0, realT, debug: false, intentLines });
    if (this.phase === 'draw') this.drawPen(g, realT);
    g.restore();
    // the guide-blue label: this is a replay, not the live page
    g.save();
    g.fillStyle = COLORS.blue;
    g.font = '36px "Gochi Hand", cursive';
    g.textAlign = 'left';
    const label = this.phase === 'moment' ? '▶ again, slowly' : this.phase === 'draw' ? '▶ drawing…' : '▶ replay';
    g.fillText(label, 30, 140);
    g.font = '26px "Gochi Hand", cursive';
    g.globalAlpha = 0.8;
    g.fillText('tap to skip', 30, 176);
    g.restore();
  }

  /** The timelapse: strokes re-drawn in order at 1.5× with a pencil at the tip. */
  private drawPen(g: Ctx, realT: number) {
    const b = this.main.due();
    if (!b) return;
    let o = 0;
    let tip: { x: number; y: number } | null = null;
    const partial = [];
    for (const s of b.strokes) {
      const e = this.penT - o;
      if (e <= 0) break;
      const pts = s.filter((p) => (p.t ?? 0) <= e).map((p) => ({ x: p.x, y: p.y, t: p.t ?? 0, p: p.p ?? 0.5 }));
      if (pts.length) {
        partial.push({ pts, upAt: Infinity, width: null });
        if (e < (s[s.length - 1]?.t ?? 0)) tip = pts[pts.length - 1];
      }
      o += (s[s.length - 1]?.t ?? 0) + STROKE_GAP;
    }
    drawWet(g, partial, realT, 1);
    if (tip) drawPencilSprite(g, tip.x, tip.y);
  }
}

/** A small yellow pencil leaning on the page, tip at (x, y). */
function drawPencilSprite(g: Ctx, x: number, y: number) {
  g.save();
  g.translate(x, y);
  g.rotate(-0.6);
  g.lineJoin = 'round';
  g.lineWidth = 2.5;
  g.strokeStyle = COLORS.felt;
  // wood cone and graphite tip
  g.fillStyle = '#E9C9A0';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(22, -9);
  g.lineTo(22, 9);
  g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = COLORS.graphite;
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(8, -3.3);
  g.lineTo(8, 3.3);
  g.closePath();
  g.fill();
  // body
  g.fillStyle = '#DCD6C8'; // plain wood-and-paint, no job colour
  g.fillRect(22, -9, 90, 18);
  g.strokeRect(22, -9, 90, 18);
  g.fillStyle = '#E58C8C';
  g.fillRect(112, -9, 16, 18);
  g.strokeRect(112, -9, 16, 18);
  g.restore();
}
