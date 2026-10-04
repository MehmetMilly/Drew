// Phase 1 toy: a blank page where you draw, the ink dries and the creature is
// born. Tap to give every creature a walk target and a reach target.
import { INK, WORLD, COLORS, LEVEL } from '../tuning';
import { World } from '../sim/world';
import { startLevel, type LevelDef } from '../sim/level';
import type { Pt } from '../sim/geom';
import { load as loadSave, recordWin, recordFail } from './save';
import { epitaph } from './epitaph';
import { pickMoment, type Birth } from './replay';
import { Show } from './show';
import { Juice } from '../render/fx';
import { WorldRenderer } from '../render/renderer';
import { PAPERS, renderDesk, renderPaper } from '../render/materials';
import { attachPen, LivePt } from '../input/pen';
import { drawWet, strokeWidths, WetStroke } from './ink';
import { clientToPage, layoutPage, safeInsets, PageRect } from './view';
import { pencil, pencilTick, unlockAudio, birthPop, pencilFrame } from '../audio/pencil';
import { sfxEvent, sfxFrame } from '../audio/sfx';
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
  private heard = 0; // world events already sent to audio
  debug = false;
  private tapMark: { x: number; y: number; t: number } | null = null;
  private hintAlpha = 1;
  /** Menus sit on the live page: no blank-page hint under them. */
  quiet = false;
  /** The pause note is up: the world holds still. */
  paused = false;
  private now = 0;
  private overlayDirty = true;

  // ---- level mode (null = the blank-page toy)
  level: LevelDef | null = null;
  private readUntil = 0;
  private inkUsed = 0;
  private drawn: Pt[][] = []; // this attempt's strokes (become the next ghost)
  private ghost: Pt[][] = [];
  private result: 'play' | 'win' | 'fail' = 'play';
  private resultAt = 0;
  private stampAt = Infinity; // the win stamp slams after the highlight (tester: show the replay first)
  private hitStopUntil = 0;
  private blockMark: { x: number; y: number; t: number } | null = null;
  private blocked = false;
  private births: Birth[] = [];
  private show: Show | null = null;
  private juice = new Juice();
  private dt = 1 / 60;
  private recorder: MediaRecorder | null = null;
  private winInfo: Parameters<NonNullable<Toy['onWin']>>[0] | null = null;
  private endStep = 0;
  private hintGhost: Pt[][] | null = null;
  private hintGhostAt = 0;
  /** shell hooks */
  onWin: ((info: { level: LevelDef; heroes: { name: string; kind: string }[]; newBadges: string[]; epitaph: string; strokes: Pt[][] }) => void) | null = null;
  onRetry: (() => void) | null = null;
  onWatchEnd: (() => void) | null = null;
  onFail: (() => void) | null = null;
  /** Pass-and-play: when set, dry ink is handed over as strokes instead of being born. */
  capture: ((strokes: Pt[][]) => void) | null = null;
  /** The pencil is put down (a draw timer ran out). */
  penLocked = false;

  /** Any ink on the page this attempt (wet or born). */
  get drewAnything() {
    return this.wet.length > 0 || this.births.length > 0 || (this.live?.pts.length ?? 0) >= 2;
  }

  /** Time's up: the ink still on the page dries at once and nothing more can be drawn. */
  dryNow() {
    this.penLocked = true;
    if (this.live && this.live.pts.length >= 2) this.commit(this.live);
    this.live = null;
    for (const s of this.wet) s.upAt = -Infinity;
    if (!this.wet.length && this.capture) this.capture([]);
  }

  /** Start a level (or the blank page with null). Retrying the same level keeps a ghost. */
  load(def: LevelDef | null) {
    const same = def && this.level && def.id === this.level.id;
    this.ghost = same && this.drawn.length ? this.drawn : same ? this.ghost : [];
    const paperChange = (def?.paper ?? 'cream') !== (this.level?.paper ?? 'cream');
    this.level = def;
    if (paperChange && this.rect) this.resize();
    this.world = new World({ seed: 1 });
    this.heard = 0;
    if (def) startLevel(this.world, def);
    this.renderer.reset(this.world);
    this.wet = [];
    this.live = null;
    this.drawn = [];
    this.births = [];
    this.show = null;
    this.stampAt = Infinity;
    this.winInfo = null;
    this.inkUsed = 0;
    this.stuck = { x: 0, y: 0, t: -1 };
    this.penLocked = false;
    this.result = 'play';
    this.acc = 0;
    this.scale = this.scaleFrom = this.scaleTarget = 1;
    this.readUntil = def ? this.now + LEVEL.readTime : 0;
    this.hintAlpha = def ? 0 : 1;
    this.hintGhost = null;
    // adaptive ghost hint: after three fails, a reference body fades in for 2 s (design §14)
    if (def && (loadSave().fails[def.id] ?? 0) >= 3 && def.refs.length) {
      const r = def.refs[(loadSave().fails[def.id] ?? 0) % def.refs.length];
      this.hintGhost = r.strokes;
      this.hintGhostAt = this.now + LEVEL.readTime;
    }
    this.overlayDirty = true;
    document.body.classList.remove('slow');
    this.cooled = false;
  }

  /** A Hall hero lives again on the blank page: its strokes, stood on the floor. */
  adopt(strokes: { x: number; y: number }[][], name?: string) {
    let x0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const st of strokes) for (const p of st) (x0 = Math.min(x0, p.x), x1 = Math.max(x1, p.x), y1 = Math.max(y1, p.y));
    const dx = WORLD.W / 2 - (x0 + x1) / 2,
      dy = WORLD.floorY - 6 - y1;
    const born = this.world.addStrokes(strokes.map((st) => st.map((p, i) => ({ x: p.x + dx, y: p.y + dy, t: i * 0.008, p: 0.5 }))));
    // the Hall's name is the hero's name: one source of truth
    if (name && born[0]) {
      born[0].name = name;
      born[0].firstName = name.split(' ')[0];
    }
    this.hintAlpha = 0;
    birthPop();
  }

  retry() {
    if (this.level) this.load(this.level);
  }

  private get drawSpeed() {
    return this.level ? this.level.draw * (loadSave().settings.gentle ? 0.7 : 1) : INK.toyDrawSpeed;
  }
  private get wetTime() {
    return loadSave().settings.gentle ? INK.wetTimeGentle : INK.wetTime;
  }
  private get inkBudget() {
    return this.level ? this.level.ink * (loadSave().settings.gentle ? 2 : 1) : Infinity;
  }

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
    this.heard = 0;
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
    this.rect = layoutPage(w, h, dpr, safeInsets());
    this.worldDpr = Math.min(this.worldDpr, dpr);
    this.applyWorldDpr();
    this.paper = renderPaper(PAPERS[this.level?.paper ?? 'cream'] ?? PAPERS.cream, Math.round(this.rect.w * dpr), Math.round(this.rect.h * dpr));
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
    if (this.penLocked) return;
    if (this.now < this.readUntil) this.readUntil = this.now; // touching skips the title beat
    this.blocked = false;
    if (this.level && this.insideTerrain(p.x, p.y)) {
      this.blocked = true;
      this.blockMark = { x: p.x, y: p.y, t: this.now };
    }
    this.live = { pts: [p], upAt: Infinity, width: null };
    this.liveMoved = false;
    this.liveStart = { x: p.x, y: p.y, t: p.t };
  }

  private insideTerrain(x: number, y: number) {
    return this.world.terrainDepth(x, y, 3) > 0;
  }

  private penMove(pts: LivePt[], pred: LivePt[]) {
    let s = this.live;
    if (!s || (this.level && this.result !== 'play')) return;
    // Daily "One Stroke": the pencil lifts for good after the first stroke
    if (this.level?.mod === 'one-stroke' && (this.wet.length || this.births.length)) return;
    for (const p0 of pts) {
      const p = { x: Math.max(2, Math.min(WORLD.W - 2, p0.x)), y: Math.max(2, Math.min(WORLD.H - 2, p0.y)), t: p0.t, p: p0.p };
      // no-draw zones: the pencil skips over solid terrain (design §3)
      if (this.level && this.insideTerrain(p.x, p.y)) {
        if (!this.blocked) {
          this.blocked = true;
          this.blockMark = { x: p.x, y: p.y, t: this.now };
          if (s.pts.length >= 2) this.commit(s);
          s = this.live = { pts: [], upAt: Infinity, width: null };
        }
        continue;
      }
      if (this.blocked) {
        this.blocked = false;
        s = this.live = { pts: [p], upAt: Infinity, width: null };
        continue;
      }
      const q = s.pts[s.pts.length - 1];
      if (q && Math.hypot(p.x - q.x, p.y - q.y) < 0.75) continue;
      // the ink budget: the pencil runs out
      const d = q ? Math.hypot(p.x - q.x, p.y - q.y) : 0;
      if (this.inkUsed + d > this.inkBudget) break;
      this.inkUsed += d;
      s.pts.push(p);
    }
    if (!s.pts.length) return;
    this.predicted = pred;
    if (!this.liveMoved && Math.hypot(s.pts[s.pts.length - 1].x - this.liveStart.x, s.pts[s.pts.length - 1].y - this.liveStart.y) > TAP_MAX_MOVE * 0.6) {
      this.liveMoved = true;
      this.setScale(this.drawSpeed, INK.easeIn);
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
    if (this.show) {
      // a tap skips a replay
      if (this.show.visible) this.show.skip();
      return;
    }
    if (this.level && this.result !== 'play') {
      // after the result any touch is a tap: instant retry (design §2)
      if (this.result === 'fail' && this.now - this.resultAt > LEVEL.failBeat) this.onRetry ? this.onRetry() : this.retry();
      return;
    }
    if (!this.liveMoved && !cancelled && dur < TAP_MAX_TIME + 0.4) {
      if (this.level) {
        if (!this.wet.length) this.setScale(1, INK.easeOut);
        return;
      }
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
    this.commit(s);
  }

  private commit(s: WetStroke) {
    s.upAt = this.now;
    s.width = strokeWidths(s.pts);
    this.wet.push(s);
    pencilTick();
  }

  private undo() {
    const s = this.wet.pop();
    if (s) for (let k = 1; k < s.pts.length; k++) this.inkUsed -= Math.hypot(s.pts[k].x - s.pts[k - 1].x, s.pts[k].y - s.pts[k - 1].y);
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
    if (this.wet.length && !this.live && this.wet.every((s) => t - s.upAt >= this.wetTime)) this.birth();

    // the title holds the first frame; a win lands with a short hit-stop
    if (t >= this.readUntil && t >= this.hitStopUntil && !this.show?.visible && !this.paused) this.acc += dt * this.scale;
    this.watchResult();
    if (!this.paused) this.updateShow(dt);
    let n = 0;
    while (this.acc >= WORLD.dt && n < 4) {
      const t0 = performance.now();
      this.world.step();
      if (this.level?.inkRegen) this.inkUsed = Math.max(0, this.inkUsed - this.level.inkRegen * WORLD.dt);
      this.stuckCheck();
      this.stepMs = this.stepMs * 0.9 + (performance.now() - t0) * 0.1;
      this.acc -= WORLD.dt;
      n++;
    }
    if (n === 4) this.acc = Math.min(this.acc, WORLD.dt);
    const ev = this.world.events;
    const reduced = loadSave().settings.reducedMotion;
    for (; this.heard < ev.length; this.heard++) {
      sfxEvent(ev[this.heard], this.world, this.scale);
      const hs = this.juice.event(ev[this.heard], this.now, reduced);
      if (hs) this.hitStopUntil = Math.max(this.hitStopUntil, this.now + hs);
    }
    this.dt = dt;
    sfxFrame(this.world, this.scale);
    const w0 = performance.now();
    this.render(this.acc / WORLD.dt);
    this.adaptResolution(performance.now() - w0 + this.stepMs * n);
    requestAnimationFrame((tt) => this.frame(tt));
  }

  private birth() {
    if (this.capture) {
      const cap = this.capture;
      this.capture = null;
      const got = this.wet.map((s) => s.pts.map((p) => ({ x: p.x, y: p.y })));
      this.wet = [];
      this.setScale(1, INK.easeOut);
      cap(got);
      return;
    }
    const strokes = this.wet.map((s) => {
      const t0 = s.pts[0].t;
      return s.pts.map((p) => ({ x: p.x, y: p.y, t: p.t - t0, p: p.p }));
    });
    for (const s of strokes) this.drawn.push(s.map((p) => ({ x: p.x, y: p.y })));
    this.wet = [];
    if (this.level) this.births.push({ step: this.world.steps, strokes });
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
  private stuck = { x: 0, y: 0, t: -1 };

  /** HOME and HUG have no clock: with the ink spent and Little Guy going nowhere, the attempt
   *  ends as a fail ("stuck") instead of idling until the player finds Retry. */
  private stuckCheck() {
    const w = this.world,
      L = w.level,
      g = w.guy;
    if (!L || !g?.alive || L.result !== 'play' || this.level?.casual) return;
    const goal = L.def.goal;
    if (!((goal.type === 'home' && !goal.seconds) || goal.type === 'hug')) return;
    let x = 0,
      y = 0;
    for (const i of g.ids) (x += w.P.x[i]), (y += w.P.y[i]);
    x /= g.ids.length;
    y /= g.ids.length;
    const canDraw = this.inkBudget - this.inkUsed > LEVEL.stuckInk || this.wet.length > 0 || !!this.live;
    if (canDraw || this.stuck.t < 0 || Math.hypot(x - this.stuck.x, y - this.stuck.y) > LEVEL.stuckMove) {
      this.stuck = { x, y, t: w.t };
      return;
    }
    if (w.t - this.stuck.t >= LEVEL.stuckTime) {
      L.result = 'fail';
      L.resultAt = w.t;
      L.cause = 'stuck';
    }
  }

  private watchResult() {
    const L = this.world.level;
    if (!L || !this.level || this.result !== 'play' || L.result === 'play') return;
    this.result = L.result;
    this.resultAt = this.now;
    if (L.result === 'win') {
      this.hitStopUntil = this.now + LEVEL.hitStop;
      const heroes = this.world.creatures.filter((c) => c.alive && !c.isPiece).map((c) => ({ name: c.name, kind: c.kind }));
      const kinds = [...new Set(heroes.map((h) => h.kind))];
      const best = this.world.creatures[L.hugger >= 0 ? L.hugger : this.world.guy?.hugging ?? -1] ?? this.world.creatures.find((c) => c.alive);
      const ep = epitaph(this.world);
      let eye: { x: number; y: number } | undefined;
      if (best) {
        // the face, carried back into the drawing's own frame (translation only)
        const h = this.world.headPos(best),
          c = this.world.centroid(best);
        let sx = 0, sy = 0, n = 0;
        for (const st of best.strokes) for (const p of st) (sx += p.x, sy += p.y, n++);
        eye = { x: h.x - c.x + sx / n, y: h.y - c.y + sy / n };
      }
      const fresh = this.level.casual ? [] : recordWin(this.level.id, kinds, best ? { name: best.name, kind: best.kind, level: this.level.id, strokes: best.strokes, at: Date.now(), epitaph: ep, eye } : null);
      this.winInfo = { level: this.level, heroes, newBadges: fresh, epitaph: ep, strokes: this.drawn };
      this.endStep = this.world.steps;
      this.show = new Show(this.level, this.births, pickMoment(this.world), this.endStep, 'highlight', this.now + LEVEL.hitStop, loadSave().settings.reducedMotion);
      if (this.show.phase === 'done') this.slam();
    } else {
      this.endStep = this.world.steps;
      if (!this.level.casual) recordFail(this.level.id);
      setTimeout(() => this.result === 'fail' && this.onFail?.(), LEVEL.failBeat * 1000);
    }
  }

  /** The full replay (design §11): timelapse, action at 1×, the moment at 0.3×. */
  watch(record = false) {
    if (!this.level || this.result === 'play' || !this.births.length) return;
    const w = this.world;
    const title = record ? `${this.level.id}  ${this.level.title}` : null;
    this.show = new Show(this.level, this.births, pickMoment(w), this.endStep, 'watch', this.now, loadSave().settings.reducedMotion, title);
    if (record) this.recordClip();
  }

  /** Save clip (design §11): the Watch replay off the world canvas into a video file. */
  static canRecord() {
    return typeof MediaRecorder !== 'undefined' && typeof HTMLCanvasElement.prototype.captureStream === 'function' && !!Toy.clipType();
  }

  private static clipType() {
    if (typeof MediaRecorder === 'undefined') return '';
    return ['video/mp4;codecs=avc1', 'video/mp4', 'video/webm;codecs=vp9', 'video/webm'].find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
  }

  private recordClip() {
    const type = Toy.clipType();
    if (!type) return;
    const rec = new MediaRecorder(this.g.canvas.captureStream(30), { mimeType: type, videoBitsPerSecond: 4_000_000 });
    const parts: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && parts.push(e.data);
    rec.onstop = () => {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob(parts, { type }));
      a.download = `drew-${this.level?.id ?? 'clip'}.${type.startsWith('video/mp4') ? 'mp4' : 'webm'}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 5000);
    };
    rec.start();
    this.recorder = rec;
  }

  /** Win payoff after the replay: the stamp slams (with its shake), then the end card. */
  private slam() {
    if (this.stampAt !== Infinity) return;
    this.stampAt = this.now;
    if (!loadSave().settings.reducedMotion) this.juice.trauma = Math.min(1, this.juice.trauma + 0.3);
    const info = this.winInfo;
    if (info) setTimeout(() => this.level?.id === info.level.id && this.result === 'win' && this.onWin?.(info), 220);
  }

  private updateShow(dt: number) {
    const s = this.show;
    if (!s) return;
    s.update(dt, this.now);
    if (s.phase !== 'done') return;
    this.show = null;
    if (s.kind === 'highlight') this.slam();
    else if (s.kind === 'watch') {
      if (this.recorder?.state === 'recording') this.recorder.stop();
      this.recorder = null;
      this.onWatchEnd?.();
    }
  }

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
    if (this.hintAlpha > 0 && !this.quiet) {
      if (this.hintAlpha < 1) this.hintAlpha = Math.max(0, this.hintAlpha - 0.05);
      g.globalAlpha = this.hintAlpha * 0.9;
      g.fillStyle = COLORS.blue;
      g.font = '44px "Gochi Hand", cursive';
      g.textAlign = 'center';
      g.fillText('draw anything', WORLD.W / 2, 520);
      g.globalAlpha = 1;
    }
    g.save();
    if (!this.recorder) this.juice.shake(g, this.dt, this.now);
    // the clip needs the paper in the recorded canvas (it normally lives on the backdrop)
    if (this.recorder && this.paper) g.drawImage(this.paper, 0, 0, WORLD.W, WORLD.H);
    if (this.show?.visible || this.recorder) {
      this.show?.draw(g, this.now, loadSave().settings.intentLines);
      g.restore();
    } else {
      if (this.level) this.drawLevelUnder(g);
      this.renderer.draw(g, { alpha, realT: this.now, debug: this.debug, stepMs: this.stepMs, intentLines: loadSave().settings.intentLines });
      this.juice.draw(g, this.now);
      g.restore();
      if (this.level) this.drawLevelOver(g);
    }
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

  /** Ghost of the last attempt and the adaptive hint, under the world (non-photo blue). */
  private drawLevelUnder(g: CanvasRenderingContext2D) {
    const strokesPath = (ss: Pt[][]) => {
      g.beginPath();
      for (const s of ss) {
        if (!s.length) continue;
        g.moveTo(s[0].x, s[0].y);
        for (let k = 1; k < s.length; k++) g.lineTo(s[k].x, s[k].y);
      }
    };
    g.lineCap = 'round';
    g.lineJoin = 'round';
    if (this.ghost.length) {
      g.strokeStyle = COLORS.blue;
      g.globalAlpha = 0.35;
      g.lineWidth = 3;
      strokesPath(this.ghost);
      g.stroke();
    }
    if (this.hintGhost) {
      const age = this.now - this.hintGhostAt;
      if (age > 0 && age < 2.4) {
        g.globalAlpha = 0.5 * Math.min(1, age / 0.4) * Math.min(1, (2.4 - age) / 0.4);
        g.strokeStyle = COLORS.blue;
        g.lineWidth = 4;
        g.setLineDash([2, 7]);
        // the body only, not its position: drawn small in the top corner
        g.save();
        g.translate(560, 380);
        g.scale(0.35, 0.35);
        let cx = 0,
          cy = 0,
          n = 0;
        for (const s of this.hintGhost)
          for (const p of s) {
            cx += p.x;
            cy += p.y;
            n++;
          }
        g.translate(-cx / n, -cy / n);
        strokesPath(this.hintGhost);
        g.stroke();
        g.restore();
        g.setLineDash([]);
      }
    }
    g.globalAlpha = 1;
  }

  /** Title beat, hint, ink pencil, no-draw mark, stamp or ✗. */
  private drawLevelOver(g: CanvasRenderingContext2D) {
    const L = this.level!;
    const t = this.now;
    // title: handwritten across the page while the first frame holds, then it lifts away
    const since = t - (this.readUntil - LEVEL.readTime);
    if (since < LEVEL.readTime + 0.8) {
      const fade = since < LEVEL.readTime ? 1 : 1 - (since - LEVEL.readTime) / 0.8;
      const reveal = Math.min(1, since / 0.6);
      g.save();
      g.globalAlpha = Math.max(0, fade);
      g.font = '64px "Gochi Hand", cursive';
      g.textAlign = 'center';
      const wd = g.measureText(L.title).width;
      g.beginPath();
      g.rect(WORLD.W / 2 - wd / 2 - 10, 300, (wd + 20) * reveal, 120);
      g.clip();
      g.fillStyle = COLORS.felt;
      g.fillText(L.title, WORLD.W / 2, 380);
      g.restore();
    }
    // the one handwritten hint, until the first stroke
    if (L.hint && !this.drawn.length && !this.wet.length && !this.live) {
      g.save();
      g.globalAlpha = Math.min(1, Math.max(0, since - 0.3) / 0.4) * 0.9;
      g.fillStyle = COLORS.blue;
      g.font = '42px "Gochi Hand", cursive';
      g.textAlign = 'center';
      g.fillText(L.hint, WORLD.W / 2, 520);
      g.restore();
    }
    this.drawPencil(g);
    if (this.blockMark && t - this.blockMark.t < 0.5) {
      g.save();
      g.globalAlpha = 1 - (t - this.blockMark.t) / 0.5;
      g.strokeStyle = COLORS.blue;
      g.setLineDash([3, 4]);
      g.lineWidth = 2;
      g.beginPath();
      g.arc(this.blockMark.x, this.blockMark.y, 14, 0, Math.PI * 2);
      g.stroke();
      g.restore();
    }
    if (this.result === 'win' && t >= this.stampAt) this.drawStamp(g, t - this.stampAt);
    else if (this.result === 'fail') this.drawFail(g, t - this.resultAt);
  }

  /** The ink budget as a real pencil across the top that shortens as you draw. */
  private drawPencil(g: CanvasRenderingContext2D) {
    if (!isFinite(this.inkBudget)) return;
    const live = this.live ? this.live.pts.length : 0;
    void live;
    const left = Math.max(0, 1 - this.inkUsed / this.inkBudget);
    const x0 = 40,
      y = 54,
      full = 300;
    const len = 28 + full * left;
    g.save();
    // left-handed layout: the pencil moves to the top-right, mirrored (design §15)
    if (loadSave().settings.leftHanded) {
      g.translate(WORLD.W, 0);
      g.scale(-1, 1);
    }
    g.lineJoin = 'round';
    // body
    g.fillStyle = '#E9E2D0';
    g.strokeStyle = COLORS.graphite;
    g.lineWidth = 2;
    g.beginPath();
    g.rect(x0 + 26, y - 9, len - 26, 18);
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(x0 + 26, y - 3);
    g.lineTo(x0 + len, y - 3);
    g.moveTo(x0 + 26, y + 3);
    g.lineTo(x0 + len, y + 3);
    g.globalAlpha = 0.35;
    g.stroke();
    g.globalAlpha = 1;
    // sharpened end and graphite tip
    g.fillStyle = '#D9C49E';
    g.beginPath();
    g.moveTo(x0 + 26, y - 9);
    g.lineTo(x0, y);
    g.lineTo(x0 + 26, y + 9);
    g.closePath();
    g.fill();
    g.stroke();
    g.fillStyle = COLORS.graphite;
    g.beginPath();
    g.moveTo(x0 + 9, y - 3);
    g.lineTo(x0, y);
    g.lineTo(x0 + 9, y + 3);
    g.closePath();
    g.fill();
    g.restore();
  }

  private drawStamp(g: CanvasRenderingContext2D, age: number) {
    if (age < 0.05) return;
    const k = Math.min(1, (age - 0.05) / 0.12);
    const s = 1.7 - 0.7 * k;
    g.save();
    g.translate(WORLD.W / 2, 560);
    g.rotate(-0.14);
    g.scale(s, s);
    g.globalAlpha = 0.25 + 0.65 * k;
    g.strokeStyle = COLORS.green;
    g.fillStyle = COLORS.green;
    g.font = '72px "Gochi Hand", cursive';
    const word = this.level!.goal.type === 'hug' ? 'FRIENDS' : 'SAVED';
    const tw = g.measureText(word).width;
    const hw = (tw + 70 + 56) / 2; // text + the check + margins
    g.lineWidth = 7;
    g.beginPath();
    g.roundRect(-hw, -62, hw * 2, 124, 14);
    g.stroke();
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(-hw + 12, -50, hw * 2 - 24, 100, 10);
    g.stroke();
    // a drawn check (the font has no ✓): shape says success as well as colour
    const cx = -hw + 34;
    g.lineWidth = 10;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    g.beginPath();
    g.moveTo(cx, 2);
    g.lineTo(cx + 14, 18);
    g.lineTo(cx + 42, -20);
    g.stroke();
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    g.fillText(word, cx + 56, 4);
    g.restore();
  }

  private drawFail(g: CanvasRenderingContext2D, age: number) {
    const k = Math.min(1, age / 0.25);
    g.save();
    g.translate(WORLD.W / 2, 560);
    g.strokeStyle = COLORS.red;
    g.lineCap = 'round';
    g.lineWidth = 12;
    g.beginPath();
    g.moveTo(-60, -60);
    g.lineTo(-60 + 120 * Math.min(1, k * 2), -60 + 120 * Math.min(1, k * 2));
    if (k > 0.5) {
      const q = (k - 0.5) * 2;
      g.moveTo(60, -60);
      g.lineTo(60 - 120 * q, -60 + 120 * q);
    }
    g.stroke();
    if (age > LEVEL.failBeat) {
      g.globalAlpha = Math.min(1, (age - LEVEL.failBeat) / 0.3);
      g.fillStyle = COLORS.graphite;
      g.font = '40px "Gochi Hand", cursive';
      g.textAlign = 'center';
      g.fillText('tap to try again', 0, 130);
    }
    g.restore();
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
    let list = this.live ? [...this.wet, { ...this.live, pts: this.live.pts.concat(this.predicted.slice(0, 2)) }] : this.wet;
    // Daily modifiers: Blind Draw hides the ink until birth; Mirror shows its reflection
    if (this.level?.mod === 'blind') list = [];
    else if (this.level?.mod === 'mirror') list = [...list, ...list.map((s) => ({ ...s, pts: s.pts.map((p) => ({ ...p, x: WORLD.W - p.x })) }))];
    drawWet(g, list, this.now, INK.wetTime);
  }
}
