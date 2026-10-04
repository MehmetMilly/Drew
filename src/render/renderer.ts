// Composes a frame of the world on the page canvas (page space 720×1280).
import { COLORS, LOOK, WORLD, PEN } from '../tuning';
import { drawProps, drawWater } from './props';
import { drawFire, drawSharpener } from './damage';
import { drawCage, drawLava, drawRing, drawBodies, drawGuy, drawBursts, drawCountdown, drawGoal, drawPlayers, drawSpikes, type Burst } from './stage';
import { guyCentre } from '../sim/littleguy';
import { World, SimEvent } from '../sim/world';
import type { Creature } from '../sim/creature';
import { PF, CT } from '../sim/store';
import { isBlinking } from '../sim/brain';
import { inkPattern, pencilVersion } from './pencils';
import { ribbon, widthPx } from './graphite';
import { drawFace } from './face';
import { boil1, boilFrame } from './boil';
import { hashNoise } from '../sim/rng';

type Ctx = CanvasRenderingContext2D;

const MAXP = 16384;
const XS = new Float32Array(MAXP),
  YS = new Float32Array(MAXP),
  WS = new Float32Array(MAXP);

interface Plate {
  cr: number;
  text: string;
  t0: number;
  angle: number;
}
interface Dust {
  pts: number[];
  t0: number;
}
interface Snap {
  x: number;
  y: number;
  t0: number;
}

export interface RenderOpts {
  alpha: number; // interpolation between last two sim steps
  realT: number; // seconds, real clock (boil)
  debug: boolean;
  stepMs?: number;
  intentLines?: boolean;
}

export class WorldRenderer {
  private pattern: CanvasPattern | null = null;
  private patternV = -1;
  plates: Plate[] = [];
  private flashes: { id: number; t0: number }[] = [];
  private dusts: Dust[] = [];
  private snaps: Snap[] = [];
  bursts: Burst[] = [];
  private seen = 0;
  private terrainCache = new Map<number, { xs: number[]; ys: number[]; s: number[]; key: string }>();

  constructor(private w: World) {}

  reset(w: World) {
    this.w = w;
    this.plates = [];
    this.flashes = [];
    this.dusts = [];
    this.snaps = [];
    this.bursts = [];
    this.seen = 0;
    this.terrainCache.clear();
  }

  /** Consume new sim events into visual state. */
  private events() {
    const ev = this.w.events;
    for (; this.seen < ev.length; this.seen++) this.onEvent(ev[this.seen]);
  }

  private onEvent(e: SimEvent) {
    const w = this.w;
    // one nameplate on screen at a time; a severed piece gets eyes and a "!", not a label
    if (e.type === 'born' && e.cr !== undefined && w.creatures[e.cr]?.team === 0) {
      // (the opponent is named on its ladder card; the plate is for the player's hero)
      const cr = w.creatures[e.cr];
      this.plates = [{ cr: e.cr, text: cr.name, t0: e.t + 0.12, angle: hashNoise(cr.seed, 5) * 0.12 }];
    } else if (e.type === 'graft' && e.cr !== undefined && e.text) {
      // "Kevin grew an arm!": the plate slaps on again with the news
      const cr = w.creatures[e.cr];
      this.plates = [{ cr: e.cr, text: e.text, t0: e.t + 0.1, angle: -hashNoise(cr.seed, 9) * 0.12 }];
    } else if (e.type === 'dust' && e.pts) this.dusts.push({ pts: e.pts, t0: e.t });
    else if (e.type === 'tear' && e.x !== undefined) this.snaps.push({ x: e.x, y: e.y!, t0: e.t });
    else if (e.type === 'boom') this.bursts.push({ kind: 'boom', x: e.x!, y: e.y!, t0: e.t });
    else if (e.type === 'knock' && e.x !== undefined) {
      // juice §6: the struck enemy flashes white for a frame, then red for two
      let best = -1,
        bd = 120 * 120;
      for (const b of w.bodies) {
        if (!b.alive || !b.data.threat) continue;
        const d = (b.x - e.x) ** 2 + (b.y - e.y!) ** 2;
        if (d < bd) (bd = d), (best = b.id);
      }
      if (best >= 0) this.flashes.push({ id: best, t0: e.t });
    }
    else if (e.type === 'guyDied') this.bursts.push({ kind: 'poof', x: e.x!, y: e.y!, t0: e.t });
    else if (e.type === 'win' && w.guy?.alive) {
      const c = guyCentre(w, w.guy);
      this.bursts.push({ kind: 'heart', x: c.x, y: c.y, t0: e.t });
    }
  }

  draw(g: Ctx, o: RenderOpts) {
    const w = this.w;
    this.events();
    if (!this.pattern || this.patternV !== pencilVersion()) (this.pattern = inkPattern(g)), (this.patternV = pencilVersion());
    const frame = boilFrame(o.realT);
    drawCountdown(g, w);
    drawGoal(g, w);
    drawLava(g, w);
    this.drawTerrain(g, frame);
    drawRing(g, w);
    drawSpikes(g, w);
    drawProps(g, w);
    drawSharpener(g, w);
    drawPlayers(g, w);
    drawBodies(g, w, o.alpha, frame);
    this.drawFlashes(g, o.alpha);
    for (const cr of w.creatures) if (cr.alive) this.drawShadow(g, cr, o.alpha);
    this.drawSleepingFoe(g, frame);
    this.drawInk(g, o.alpha, frame);
    this.drawDust(g);
    for (const cr of w.creatures) if (cr.alive) this.drawCreatureFace(g, cr, o, frame);
    if (o.intentLines !== false) for (const cr of w.creatures) if (cr.alive) this.drawIntent(g, cr, o);
    drawFire(g, w);
    if (w.guy) drawGuy(g, w, w.guy, o.alpha, frame);
    drawCage(g, w); // the bars in front of him
    drawWater(g, w);
    this.drawSnaps(g);
    drawBursts(g, this.bursts, w.t);
    this.drawPlates(g, o.alpha);
    if (o.debug) this.drawDebug(g, o);
  }

  // ---------------------------------------------------------------- positions

  private px(i: number, a: number) {
    const P = this.w.P;
    return P.sx[i] + (P.x[i] - P.sx[i]) * a;
  }
  private py(i: number, a: number) {
    const P = this.w.P;
    return P.sy[i] + (P.y[i] - P.sy[i]) * a;
  }

  headView(cr: Creature, a: number) {
    const w = this.w;
    let hx = 0,
      hy = 0;
    let r = cr.head.r;
    let angle = 0;
    if (cr.head.kind === 'loop' && cr.loops[cr.head.loop]) {
      const ring = cr.loops[cr.head.loop].ring;
      for (const i of ring) {
        hx += this.px(i, a);
        hy += this.py(i, a);
      }
      hx /= ring.length;
      hy /= ring.length;
      // ring orientation vs rest
      let rcx = 0,
        rcy = 0;
      for (const i of ring) {
        rcx += w.P.rx[i];
        rcy += w.P.ry[i];
      }
      rcx /= ring.length;
      rcy /= ring.length;
      let sc = 0,
        ss = 0;
      for (const i of ring) {
        const rx = (w.P.rx[i] - rcx) * cr.flip,
          ry = w.P.ry[i] - rcy,
          qx = this.px(i, a) - hx,
          qy = this.py(i, a) - hy;
        sc += rx * qx + ry * qy;
        ss += rx * qy - ry * qx;
      }
      angle = Math.atan2(ss, sc);
      // a roller's eyes stay level while its body turns over, like a hamster in a ball
      if (cr.gait === 'roll') angle = 0;
      // the face turns toward where it's heading
      hx += cr.face.side * r * LOOK.faceTurn;
    } else {
      const i = cr.head.point;
      hx = this.px(i, a);
      r = cr.head.r;
      hy = this.py(i, a) - r * 0.6;
      angle = ((cr as Creature & { angle?: number }).angle ?? 0) * (1 - cr.stats.balance);
    }
    const er = cr.head.kind === 'point' ? Math.max(6.5, Math.min(11, r * 0.45)) : Math.max(5, Math.min(11, r * 0.3));
    const gap = er * 1.12;
    return { hx, hy, angle, er, gap, r };
  }

  // ---------------------------------------------------------------- ink

  /** Sumo: the opponent is already drawn on the page, asleep, until the player's creature wakes. */
  private drawSleepingFoe(g: Ctx, frame: number) {
    const L = this.w.level;
    if (!L || L.def.goal.type !== 'sumo' || L.foesAt >= 0) return;
    const foe = L.def.goal.foe.filter((st) => st.length);
    if (!foe.length) return;
    g.save();
    g.strokeStyle = COLORS.felt; // not the player's ink: it belongs to the world
    g.globalAlpha = 0.93;
    g.lineWidth = 9 * LOOK.foeWidth;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    foe.forEach((st, si) => {
      g.beginPath();
      st.forEach((p, i) => {
        const x = p.x + boil1(si * 2 + 901, i, frame) * LOOK.boilAmp,
          y = p.y + boil1(si * 2 + 902, i, frame) * LOOK.boilAmp;
        i ? g.lineTo(x, y) : g.moveTo(x, y);
      });
      g.stroke();
    });
    // a snore above its highest point
    let top = foe[0][0];
    for (const st of foe) for (const p of st) if (p.y < top.y) top = p;
    const bob = Math.sin(this.w.t * 2) * 4;
    g.fillStyle = COLORS.graphite;
    g.font = '28px "Patrick Hand", cursive';
    g.fillText('z', top.x + 20, top.y - 20 + bob);
    g.font = '20px "Patrick Hand", cursive';
    g.fillText('z', top.x + 38, top.y - 42 + bob);
    g.restore();
  }

  private drawInk(g: Ctx, a: number, frame: number) {
    const w = this.w,
      P = w.P,
      C = w.C;
    g.fillStyle = this.pattern!;
    g.globalAlpha = 0.93;
    const foeInk = (i: number) => w.creatures[P.owner[i]]?.team === 1;
    for (const sk of w.skins) {
      // colour jobs: the player's ink is graphite; a Sumo opponent is part of the world (felt)
      const pi = sk.lump ? sk.lump.centre : sk.pa[0];
      const foe = pi >= 0 && foeInk(pi);
      g.fillStyle = foe ? COLORS.felt : this.pattern!;
      const wk = foe ? LOOK.foeWidth : 1; // a bolder felt-tip line, like the terrain's
      let n = 0;
      const flush = () => {
        if (n > 0) ribbon(g, XS, YS, WS, 0, n, 9, 11, sk.closed && n === sk.n);
        n = 0;
      };
      let lumpCos = 1,
        lumpSin = 0,
        lcx = 0,
        lcy = 0;
      if (sk.lump) {
        const L = sk.lump;
        if (!P.isAlive(L.centre) || !w.creatures[P.owner[L.centre]]?.alive) continue;
        lcx = this.px(L.centre, a);
        lcy = this.py(L.centre, a);
        let sc = 0,
          ss = 0;
        for (const i of L.ring) {
          const rx = P.rx[i] - P.rx[L.centre],
            ry = P.ry[i] - P.ry[L.centre],
            qx = this.px(i, a) - lcx,
            qy = this.py(i, a) - lcy;
          sc += rx * qx + ry * qy;
          ss += rx * qy - ry * qx;
        }
        const th = Math.atan2(ss, sc);
        lumpCos = Math.cos(th);
        lumpSin = Math.sin(th);
      }
      let s = 0;
      for (let k = 0; k < sk.n; k++) {
        if (k > 0) s += Math.hypot(sk.dx[k] - sk.dx[k - 1], sk.dy[k] - sk.dy[k - 1]);
        let x: number, y: number;
        if (sk.lump) {
          const dx = sk.dx[k] - P.rx[sk.lump.centre],
            dy = sk.dy[k] - P.ry[sk.lump.centre];
          x = lcx + dx * lumpCos - dy * lumpSin;
          y = lcy + dx * lumpSin + dy * lumpCos;
        } else {
          const pa = sk.pa[k],
            pb = sk.pb[k],
            cid = sk.cid[k];
          const ok = P.isAlive(pa) && P.isAlive(pb) && (cid < 0 || !C.dead[cid]) && w.creatures[P.owner[pa]]?.alive;
          if (!ok) {
            flush();
            continue;
          }
          // a new owner (after a sever) starts a new ribbon
          if (n > 0 && k > 0 && P.owner[sk.pa[k - 1]] !== P.owner[pa]) flush();
          const ax = this.px(pa, a),
            ay = this.py(pa, a),
            bx = this.px(pb, a),
            by = this.py(pb, a);
          const dx = bx - ax,
            dy = by - ay;
          const L = Math.hypot(dx, dy) || 1;
          const t = sk.t[k],
            off = sk.off[k];
          x = ax + dx * t - (dy / L) * off;
          y = ay + dy * t + (dx / L) * off;
        }
        x += boil1(sk.stroke * 2 + 1, s, frame) * LOOK.boilAmp;
        y += boil1(sk.stroke * 2 + 2, s, frame) * LOOK.boilAmp;
        XS[n] = x;
        YS[n] = y;
        WS[n] = widthPx(sk.width[k]) * wk;
        n++;
        if (n >= MAXP - 1) flush();
      }
      flush();
    }
    g.globalAlpha = 1;
  }

  private drawFlashes(g: Ctx, a: number) {
    const w = this.w,
      t = w.t;
    this.flashes = this.flashes.filter((f) => t - f.t0 < 3 * WORLD.dt + 1e-6);
    for (const f of this.flashes) {
      const b = w.bodies.find((q) => q.id === f.id);
      if (!b?.alive) continue;
      const x = b.sx + (b.x - b.sx) * a,
        y = b.sy + (b.y - b.sy) * a;
      g.save();
      g.fillStyle = t - f.t0 < WORLD.dt + 1e-6 ? '#FFFFFF' : COLORS.red;
      g.globalAlpha = 0.85;
      g.beginPath();
      if (b.hw) {
        g.translate(x, b.kind === 'crusher' ? b.data.rail : y);
        g.rotate(b.angle ?? 0);
        g.rect(-b.hw, -b.hh!, b.hw * 2, b.hh! * 2);
      } else g.arc(x, y, b.r, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  }

  private drawDust(g: Ctx) {
    const t = this.w.t;
    this.dusts = this.dusts.filter((d) => t - d.t0 < 1);
    for (const d of this.dusts) {
      const u = (t - d.t0) / 1;
      g.fillStyle = `rgba(58,58,64,${0.8 * (1 - u)})`;
      for (let k = 0; k < d.pts.length; k += 2) {
        const j = hashNoise(k, 3, 9);
        g.beginPath();
        g.arc(d.pts[k] + j * 6 * u, d.pts[k + 1] + u * u * 30 + hashNoise(k, 4, 9) * 3, 2.2 * (1 - u * 0.6), 0, Math.PI * 2);
        g.fill();
      }
    }
  }

  private drawSnaps(g: Ctx) {
    const t = this.w.t;
    this.snaps = this.snaps.filter((d) => t - d.t0 < 0.3);
    g.strokeStyle = COLORS.felt;
    g.lineWidth = 2;
    g.lineCap = 'round';
    for (const s of this.snaps) {
      const u = (t - s.t0) / 0.3;
      g.globalAlpha = 1 - u;
      for (let k = 0; k < 5; k++) {
        const ang = (k / 5) * Math.PI * 2 + 0.4;
        const r0 = 8 + u * 10,
          r1 = 16 + u * 16;
        g.beginPath();
        g.moveTo(s.x + Math.cos(ang) * r0, s.y + Math.sin(ang) * r0);
        g.lineTo(s.x + Math.cos(ang) * r1, s.y + Math.sin(ang) * r1);
        g.stroke();
      }
    }
    g.globalAlpha = 1;
  }

  // ---------------------------------------------------------------- world

  private drawTerrain(g: Ctx, frame: number) {
    const w = this.w;
    g.fillStyle = COLORS.felt;
    w.terrain.forEach((T, ti) => {
      if (T.broken || T.kind === 'bridge') return; // bridges are drawn as planks (props.ts)
      let c = this.terrainCache.get(ti);
      const key = T.minX + ',' + T.maxX; // a Sumo ring shrinks: redraw its outline as it goes
      if (!c || c.key !== key) {
        // resample edges every 6 px with a 2 px felt-tip wobble
        const xs: number[] = [],
          ys: number[] = [],
          s: number[] = [];
        let acc = 0;
        const pts = T.pts;
        for (let i = 0; i < pts.length; i++) {
          const a = pts[i],
            b = pts[(i + 1) % pts.length];
          const L = Math.hypot(b.x - a.x, b.y - a.y);
          const n = Math.max(1, Math.ceil(L / 6));
          for (let k = 0; k < n; k++) {
            const u = k / n;
            const wob = 1.0 * boil1(ti * 31 + 7, acc + L * u, 99, 30);
            xs.push(a.x + (b.x - a.x) * u + wob);
            ys.push(a.y + (b.y - a.y) * u + wob);
            s.push(acc + L * u);
          }
          acc += L;
        }
        c = { xs, ys, s, key };
        this.terrainCache.set(ti, c);
      }
      g.beginPath();
      for (let k = 0; k < c.xs.length; k++) {
        const x = c.xs[k] + boil1(ti * 13 + 3, c.s[k], frame, 18) * LOOK.boilAmp;
        const y = c.ys[k] + boil1(ti * 13 + 4, c.s[k], frame, 18) * LOOK.boilAmp;
        if (k === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
      }
      g.closePath();
      g.fill();
    });
  }

  private drawShadow(g: Ctx, cr: Creature, a: number) {
    const P = this.w.P;
    let minX = Infinity,
      maxX = -Infinity,
      maxY = -Infinity,
      cx = 0;
    for (const i of cr.ids) {
      const x = this.px(i, a),
        y = this.py(i, a);
      minX = Math.min(minX, x);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      cx += x;
    }
    cx /= cr.ids.length;
    void P;
    const gy = this.w.groundY(cx, maxY - 8);
    if (!isFinite(gy)) return;
    const h = Math.max(0, gy - maxY - 5);
    const wdt = Math.max(20, (maxX - minX) * 0.55) / (1 + h / 220);
    const alpha = Math.min(1, 1 / (1 + h / 90));
    if (!shadowSprite) shadowSprite = makeShadow();
    g.globalAlpha = alpha;
    g.drawImage(shadowSprite, cx - wdt, gy - wdt * 0.18, wdt * 2, wdt * 0.36);
    g.globalAlpha = 1;
  }

  private drawCreatureFace(g: Ctx, cr: Creature, o: RenderOpts, frame: number) {
    const v = this.headView(cr, o.alpha);
    // a point head (worm): small eyes perched on the end
    drawFace(g, cr, { ...v, blinking: isBlinking(this.w, cr), mode: cr.brain.plan !== 'toy' && cr.brain.plan !== 'hug' && cr.brain.mode !== 'idle' ? cr.brain.plan : cr.brain.mode, frame, t: o.realT, age: this.w.t - cr.bornAt });
  }

  private drawIntent(g: Ctx, cr: Creature, o: RenderOpts) {
    const b = cr.brain;
    const age = this.w.t - b.intentAt;
    if (age < 0 || age > 0.4 + 0.15) return;
    const v = this.headView(cr, o.alpha);
    const u = Math.min(1, age / 0.12);
    const fade = age > 0.4 ? 1 - (age - 0.4) / 0.15 : 1;
    g.save();
    g.strokeStyle = COLORS.blue;
    g.globalAlpha = 0.85 * fade;
    g.lineWidth = 2;
    g.setLineDash([2, 7]);
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(v.hx, v.hy);
    g.lineTo(v.hx + (b.intentX - v.hx) * u, v.hy + (b.intentY - v.hy) * u);
    g.stroke();
    g.setLineDash([]);
    if (u >= 1) {
      g.beginPath();
      g.arc(b.intentX, b.intentY, 7, 0, Math.PI * 2);
      g.stroke();
    }
    g.restore();
  }

  private drawPlates(g: Ctx, a: number) {
    const w = this.w;
    const t = w.t;
    const HOLD = LOOK.nameplateHold;
    this.plates = this.plates.filter((p) => t - p.t0 < HOLD + 0.45 && w.creatures[p.cr]?.alive);
    for (const p of this.plates) {
      const age = t - p.t0;
      if (age < 0) continue;
      const cr = w.creatures[p.cr];
      const v = this.headView(cr, a);
      let top = Infinity;
      for (const i of cr.ids) top = Math.min(top, this.py(i, a));
      const x = Math.max(110, Math.min(610, v.hx));
      const y = Math.max(40, Math.min(top, v.hy - v.r) - 34);
      // slap: overshoot over 160 ms
      const sl = Math.min(1, age / LOOK.nameplateSlap);
      let scale = sl < 1 ? 1.35 - 0.47 * Math.sin((sl * Math.PI) / 2) : 1;
      if (sl >= 1 && age < LOOK.nameplateSlap + 0.08) scale = 0.88 + 0.12 * ((age - LOOK.nameplateSlap) / 0.08);
      let alpha = sl < 0.3 ? sl / 0.3 : 1;
      let rot = p.angle;
      let dy = 0;
      if (age > HOLD) {
        // peel away: lift a corner, drift up, fade
        const u = Math.min(1, (age - HOLD) / 0.45);
        rot += u * 0.5;
        dy = -u * 30;
        alpha = 1 - u;
      }
      g.save();
      g.globalAlpha = alpha;
      g.translate(x, y + dy);
      g.rotate(rot);
      g.scale(scale, scale);
      g.font = '26px "Gochi Hand", cursive';
      const tw = g.measureText(p.text).width;
      const W = tw + 26,
        H = 38;
      g.fillStyle = 'rgba(40,30,20,0.18)';
      g.fillRect(-W / 2 + 3, -H / 2 + 4, W, H);
      g.fillStyle = '#FFFFFF';
      g.strokeStyle = COLORS.red;
      g.lineWidth = 3;
      roundRect(g, -W / 2, -H / 2, W, H, 6);
      g.fill();
      g.stroke();
      g.fillStyle = COLORS.felt;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(p.text, 0, 2);
      g.restore();
    }
  }

  // ---------------------------------------------------------------- debug

  private drawDebug(g: Ctx, o: RenderOpts) {
    const w = this.w,
      P = w.P,
      C = w.C;
    const a = o.alpha;
    g.save();
    g.lineWidth = 1.5;
    for (let c = 0; c < C.n; c++) {
      if (C.dead[c]) continue;
      const t = C.type[c];
      if (t === CT.BEND) continue;
      const i = C.a[c],
        j = C.b[c];
      const st = Math.min(1, Math.abs(C.strain[c]) * 4);
      g.strokeStyle = t === CT.SPRING ? '#B04FD0' : t === CT.WELD ? '#2FA84F' : `rgba(${Math.round(127 + 128 * st)},${Math.round(178 * (1 - st))},${Math.round(229 * (1 - st))},0.9)`;
      g.beginPath();
      g.moveTo(this.px(i, a), this.py(i, a));
      g.lineTo(this.px(j, a), this.py(j, a));
      g.stroke();
    }
    for (const cr of w.creatures) {
      if (!cr.alive) continue;
      for (const l of cr.limbs) {
        const x = this.px(l.tip, a),
          y = this.py(l.tip, a);
        g.fillStyle = l.foot ? '#2FA84F' : '#3B82F6';
        g.beginPath();
        if (l.foot) g.rect(x - 6, y - 6, 12, 12);
        else g.arc(x, y, 7, 0, Math.PI * 2);
        g.fill();
        // envelope
        g.strokeStyle = 'rgba(59,130,246,0.25)';
        g.beginPath();
        g.arc(this.px(l.root, a), this.py(l.root, a), l.len * 1.05 * 0.86, 0, Math.PI * 2);
        g.stroke();
      }
      for (const lp of cr.lumps) {
        g.fillStyle = 'rgba(230,140,40,0.5)';
        g.beginPath();
        g.arc(this.px(lp.centre, a), this.py(lp.centre, a), 10, 0, Math.PI * 2);
        g.fill();
      }
      const c = w.centroid(cr);
      g.fillStyle = COLORS.blue;
      g.font = '15px monospace';
      g.textAlign = 'center';
      g.fillText(`${cr.kind} · ${cr.brain.mode} · ${cr.stats.speed.toFixed(0)}px/s`, c.x, c.y + cr.stats.h / 2 + 30);
      if (cr.brain.targetX !== null) {
        g.strokeStyle = COLORS.blue;
        g.beginPath();
        g.moveTo(cr.brain.targetX - 10, WORLD.floorY);
        g.lineTo(cr.brain.targetX + 10, WORLD.floorY);
        g.moveTo(cr.brain.reachX - 8, cr.brain.reachY - 8);
        g.lineTo(cr.brain.reachX + 8, cr.brain.reachY + 8);
        g.moveTo(cr.brain.reachX + 8, cr.brain.reachY - 8);
        g.lineTo(cr.brain.reachX - 8, cr.brain.reachY + 8);
        g.stroke();
      }
    }
    for (let i = 0; i < P.n; i++) {
      if (!(P.flags[i] & PF.ALIVE)) continue;
      if (P.flags[i] & PF.PINNED) {
        g.fillStyle = '#E23B2E';
        g.fillRect(this.px(i, a) - 2, this.py(i, a) - 2, 4, 4);
      }
    }
    g.fillStyle = 'rgba(244,241,232,0.85)';
    g.fillRect(8, 8, 300, 74);
    g.fillStyle = '#1B1B1F';
    g.font = '15px monospace';
    g.textAlign = 'left';
    g.fillText(`step ${(o.stepMs ?? 0).toFixed(2)} ms   t=${w.t.toFixed(2)}`, 16, 30);
    g.fillText(`particles ${P.alive}/${WORLD.maxParticles}  creatures ${w.liveCreatures().length}`, 16, 50);
    g.fillText(`tears ${w.totalTears}  vmax ${w.maxSpeedSeen.toFixed(0)}`, 16, 70);
    g.restore();
    void PEN;
  }
}

let shadowSprite: HTMLCanvasElement | null = null;
/** A soft graphite smudge, rendered once and scaled under every figure. */
function makeShadow(): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const g = c.getContext('2d')!;
  const grad = g.createRadialGradient(64, 64, 1, 64, 64, 64);
  grad.addColorStop(0, 'rgba(58,58,64,0.24)');
  grad.addColorStop(0.6, 'rgba(58,58,64,0.10)');
  grad.addColorStop(1, 'rgba(58,58,64,0)');
  g.fillStyle = grad;
  g.fillRect(0, 0, 128, 128);
  return c;
}

export function roundRect(g: Ctx, x: number, y: number, w: number, h: number, r: number) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.lineTo(x + w - r, y);
  g.quadraticCurveTo(x + w, y, x + w, y + r);
  g.lineTo(x + w, y + h - r);
  g.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  g.lineTo(x + r, y + h);
  g.quadraticCurveTo(x, y + h, x, y + h - r);
  g.lineTo(x, y + r);
  g.quadraticCurveTo(x, y, x + r, y);
  g.closePath();
}
