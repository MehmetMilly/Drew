// Phase 1 toy: a blank page where you draw, the ink dries and the creature is
// born. Tap to give every creature a walk target and a reach target.
import { INK, WORLD, COLORS } from '../tuning';
import { World } from '../sim/world';
import { WorldRenderer } from '../render/renderer';
import { PAPERS, renderDesk, renderPaper } from '../render/materials';
import { attachPen, LivePt } from '../input/pen';
import { drawWet, strokeWidths, WetStroke } from './ink';
import { clientToPage, layoutPage, PageRect } from './view';
import { pencil, pencilTick, unlockAudio, birthPop, pencilFrame } from '../audio/pencil';
import { boilState } from '../render/boil';

const TAP_MAX_MOVE = 10;
const TAP_MAX_TIME = 0.3;

export class Toy {
  world = new World({ seed: 1 });
  renderer = new WorldRenderer(this.world);
  rect!: PageRect;
  private g: CanvasRenderingContext2D;
  private og: CanvasRenderingContext2D;
  private paper: HTMLCanvasElement | null = null;
  private desk: HTMLCanvasElement | null = null;
  private wet: WetStroke[] = [];
  private live: WetStroke | null = null;
  private liveMoved = false;
  private liveStart = { x: 0, y: 0, t: 0 };
  private predicted: LivePt[] = [];
  private scale = 1;
  private scaleFrom = 1;
  private scaleTarget = 1;
  private scaleT0 = 0;
  private acc = 0;
  private last = 0;
  private stepMs = 0;
  debug = false;
  private tapMark: { x: number; y: number; t: number } | null = null;
  private hintAlpha = 1;
  private now = 0;
  private overlayDirty = true;

  private bg: CanvasRenderingContext2D;
  constructor(
    private backdrop: HTMLCanvasElement,
    private canvas: HTMLCanvasElement,
    private overlay: HTMLCanvasElement,
  ) {
    this.bg = backdrop.getContext('2d', { alpha: false })!;
    this.g = canvas.getContext('2d')!;
    this.og = overlay.getContext('2d', { desynchronized: true } as CanvasRenderingContext2DSettings)!;
    this.resize();
    addEventListener('resize', () => this.resize());
    attachPen(overlay, {
      toPage: (x, y) => clientToPage(this.rect, x, y),
      down: (p) => this.penDown(p),
      move: (pts, pred) => this.penMove(pts, pred),
      up: (p, _e, cancelled) => this.penUp(p, cancelled),
      multiTap: (n) => {
        if (n >= 3) this.debug = !this.debug;
        else if (n === 2) this.undo();
      },
    });
    addEventListener('keydown', (e) => {
      if (e.key === 'd' || e.key === 'D') this.debug = !this.debug;
      if (e.key === 'z' || e.key === 'Z') this.undo();
      if (e.key === 'r' || e.key === 'R') this.clear();
    });
    requestAnimationFrame((t) => this.frame(t));
  }

  clear() {
    this.world = new World({ seed: 1 });
    this.renderer.reset(this.world);
    this.wet = [];
  }

  // adaptive resolution for the world layer only: drawing stays crisp on the
  // overlay, the paper on the static backdrop
  private worldDpr = 2;
  private frameAvg = 0;
  private dprCool = 0;
  private applyWorldDpr() {
    const w = innerWidth,
      h = innerHeight;
    const d = Math.min(this.worldDpr, this.rect.dpr);
    this.canvas.width = Math.round(w * d);
    this.canvas.height = Math.round(h * d);
  }
  private adaptResolution(workMs: number) {
    this.frameAvg = this.frameAvg * 0.95 + workMs * 0.05;
    if (--this.dprCool > 0) return;
    const max = this.rect.dpr;
    if (this.frameAvg > 11 && this.worldDpr > 1) {
      this.worldDpr = Math.max(1, this.worldDpr - 0.25);
      this.applyWorldDpr();
      this.dprCool = 60;
    } else if (this.frameAvg < 5 && this.worldDpr < max) {
      this.worldDpr = Math.min(max, this.worldDpr + 0.25);
      this.applyWorldDpr();
      this.dprCool = 240;
    }
  }

  private resize() {
    const dpr = Math.min(2, devicePixelRatio || 1);
    const w = innerWidth,
      h = innerHeight;
    for (const c of [this.backdrop, this.canvas, this.overlay]) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
      c.style.width = w + 'px';
      c.style.height = h + 'px';
    }
    this.rect = layoutPage(w, h, dpr);
    this.worldDpr = Math.min(this.worldDpr, dpr);
    this.applyWorldDpr();
    this.paper = renderPaper(PAPERS.cream, Math.round(this.rect.w * dpr), Math.round(this.rect.h * dpr));
    this.desk = renderDesk(Math.round(w * dpr), Math.round(h * dpr));
    // static backdrop: desk, page shadow, paper (drawn once per resize)
    const b = this.bg,
      r = this.rect;
    b.setTransform(1, 0, 0, 1, 0, 0);
    b.drawImage(this.desk, 0, 0);
    b.setTransform(dpr * r.scale, 0, 0, dpr * r.scale, dpr * r.x, dpr * r.y);
    b.fillStyle = 'rgba(40,20,5,0.25)';
    b.fillRect(6, 10, WORLD.W, WORLD.H);
    b.drawImage(this.paper, 0, 0, WORLD.W, WORLD.H);
  }

  // ---------------------------------------------------------------- pen

  private penDown(p: LivePt) {
    unlockAudio();
    this.live = { pts: [p], upAt: Infinity, width: null };
    this.liveMoved = false;
    this.liveStart = { x: p.x, y: p.y, t: p.t };
  }

  private penMove(pts: LivePt[], pred: LivePt[]) {
    const s = this.live;
    if (!s) return;
    for (const p of pts) {
      const q = s.pts[s.pts.length - 1];
      if (Math.hypot(p.x - q.x, p.y - q.y) < 0.75) continue;
      s.pts.push({ x: Math.max(2, Math.min(WORLD.W - 2, p.x)), y: Math.max(2, Math.min(WORLD.H - 2, p.y)), t: p.t, p: p.p });
    }
    this.predicted = pred;
    if (!this.liveMoved && Math.hypot(s.pts[s.pts.length - 1].x - this.liveStart.x, s.pts[s.pts.length - 1].y - this.liveStart.y) > TAP_MAX_MOVE * 0.6) {
      this.liveMoved = true;
      this.setScale(INK.toyDrawSpeed, INK.easeIn);
      this.hintAlpha = 0.999;
    }
    if (this.liveMoved) {
      const n = s.pts.length;
      const a = s.pts[Math.max(0, n - 4)],
        b = s.pts[n - 1];
      const v = Math.hypot(b.x - a.x, b.y - a.y) / Math.max(1 / 60, b.t - a.t);
      pencil(v, b.p);
      this.drawOverlay(); // immediate: perceived latency under a frame
    }
  }

  private penUp(p: LivePt, cancelled: boolean) {
    const s = this.live;
    this.live = null;
    this.predicted = [];
    pencil(0, 0.5, false);
    if (!s) return;
    const dur = p.t - this.liveStart.t;
    if (!this.liveMoved && !cancelled && dur < TAP_MAX_TIME + 0.4) {
      // a tap: walk + reach target for every creature
      this.world.toyTarget = { x: p.x, y: p.y };
      this.tapMark = { x: p.x, y: p.y, t: this.now };
      if (!this.wet.length) this.setScale(1, INK.easeOut);
      return;
    }
    if (cancelled || s.pts.length < 2) {
      if (!this.wet.length) this.setScale(1, INK.easeOut);
      return;
    }
    s.upAt = this.now;
    s.width = strokeWidths(s.pts);
    this.wet.push(s);
    pencilTick();
  }

  private undo() {
    if (this.wet.length) this.wet.pop();
    if (!this.wet.length && !this.live) this.setScale(1, INK.easeOut);
  }

  private setScale(target: number, dur: number) {
    if (this.scaleTarget === target) return;
    this.scaleFrom = this.scale;
    this.scaleTarget = target;
    this.scaleT0 = this.now;
    this.scaleDur = dur;
  }
  private scaleDur = 0.15;

  // ---------------------------------------------------------------- loop

  private frame(tms: number) {
    pencilFrame();
    const t = tms / 1000;
    let dt = this.last ? Math.min(0.1, t - this.last) : 1 / 60;
    // vsync jitter around 60 Hz would alternate 0 and 2 sim steps per frame
    if (Math.abs(dt - WORLD.dt) < 0.002) dt = WORLD.dt;
    this.last = t;
    this.now = t;
    // time scale easing (ease-out)
    const u = Math.min(1, (t - this.scaleT0) / this.scaleDur);
    const e = 1 - Math.pow(1 - u, 3);
    this.scale = this.scaleFrom + (this.scaleTarget - this.scaleFrom) * e;

    // drying → birth (all at once, when every stroke is dry and the pen is up)
    if (this.wet.length && !this.live && this.wet.every((s) => t - s.upAt >= INK.wetTime)) this.birth();

    this.acc += dt * this.scale;
    let n = 0;
    while (this.acc >= WORLD.dt && n < 4) {
      const t0 = performance.now();
      this.world.step();
      this.stepMs = this.stepMs * 0.9 + (performance.now() - t0) * 0.1;
      this.acc -= WORLD.dt;
      n++;
    }
    if (n === 4) this.acc = Math.min(this.acc, WORLD.dt);
    const w0 = performance.now();
    this.render(this.acc / WORLD.dt);
    this.adaptResolution(performance.now() - w0 + this.stepMs * n);
    requestAnimationFrame((tt) => this.frame(tt));
  }

  private birth() {
    const strokes = this.wet.map((s) => {
      const t0 = s.pts[0].t;
      return s.pts.map((p) => ({ x: p.x, y: p.y, t: p.t - t0, p: p.p }));
    });
    this.wet = [];
    const ev0 = this.world.events.length;
    const born = this.world.addStrokes(strokes);
    const grafted = this.world.events.slice(ev0).some((e) => e.type === 'graft');
    this.setScale(1, INK.easeOut);
    if (born.length || grafted) {
      birthPop();
      try {
        navigator.vibrate?.(12);
      } catch {
        /* no haptics */
      }
    }
  }

  private cooled = false;

  private render(alpha: number) {
    const g = this.g,
      r = this.rect,
      dpr = Math.min(this.worldDpr, r.dpr);
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(Math.floor(dpr * r.x) - 2, Math.floor(dpr * r.y) - 2, Math.ceil(dpr * r.w) + 4, Math.ceil(dpr * r.h) + 4);
    g.setTransform(dpr * r.scale, 0, 0, dpr * r.scale, dpr * r.x, dpr * r.y);
    g.save();
    g.beginPath();
    g.rect(0, 0, WORLD.W, WORLD.H);
    g.clip();
    // first-run hint, non-photo blue, fades once the first stroke begins
    if (this.hintAlpha > 0) {
      if (this.hintAlpha < 1) this.hintAlpha = Math.max(0, this.hintAlpha - 0.05);
      g.globalAlpha = this.hintAlpha * 0.9;
      g.fillStyle = COLORS.blue;
      g.font = '44px "Gochi Hand", cursive';
      g.textAlign = 'center';
      g.fillText('draw anything', WORLD.W / 2, 520);
      g.globalAlpha = 1;
    }
    this.renderer.draw(g, { alpha, realT: this.now, debug: this.debug, stepMs: this.stepMs });
    if (this.tapMark && this.now - this.tapMark.t < 0.6) {
      const k = (this.now - this.tapMark.t) / 0.6;
      g.strokeStyle = COLORS.blue;
      g.globalAlpha = 1 - k;
      g.lineWidth = 2;
      g.beginPath();
      g.arc(this.tapMark.x, this.tapMark.y, 8 + 16 * k, 0, Math.PI * 2);
      g.stroke();
      g.globalAlpha = 1;
    }
    // slow time: the page cools (look-and-feel §7)
    const slow = Math.max(0, Math.min(1, (1 - this.scale) / (1 - INK.toyDrawSpeed)));
    const cool = slow > 0.5;
    if (cool !== this.cooled) document.body.classList.toggle('slow', (this.cooled = cool));
    if (slow > 0.01) {
      // desaturation is a CSS filter on the static paper (body.slow); here only the 6% vignette
      const vg = g.createRadialGradient(WORLD.W / 2, WORLD.H / 2, WORLD.W * 0.45, WORLD.W / 2, WORLD.H / 2, WORLD.H * 0.75);
      vg.addColorStop(0, 'rgba(30,30,40,0)');
      vg.addColorStop(1, `rgba(30,30,40,${0.12 * slow})`);
      g.fillStyle = vg;
      g.fillRect(0, 0, WORLD.W, WORLD.H);
    }
    g.restore();
    this.drawOverlay();
    void boilState;
  }

  private drawOverlay() {
    const g = this.og,
      r = this.rect,
      dpr = r.dpr;
    const any = this.wet.length > 0 || this.live !== null;
    if (!any && !this.overlayDirty) return;
    this.overlayDirty = any;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.clearRect(0, 0, this.overlay.width, this.overlay.height);
    g.setTransform(dpr * r.scale, 0, 0, dpr * r.scale, dpr * r.x, dpr * r.y);
    const list = this.live ? [...this.wet, { ...this.live, pts: this.live.pts.concat(this.predicted.slice(0, 2)) }] : this.wet;
    drawWet(g, list, this.now, INK.wetTime);
  }
}
