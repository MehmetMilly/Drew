// Drew spike: core "living ink" sim. Plain JS, deterministic, no deps.
// Principle under test: intent is puppeted, consequence is simulated.
(function (root) {
  const W = 720, H = 1280, GROUND = 1060;
  const DT = 1 / 60, SUB = 2, H_ = DT / SUB, ITER = 10;
  const G = 1800;
  const SPACING = 10, PR = 5;

  function rng(seed) { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); }
  const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);

  function resample(pts, sp) {
    const out = [{ x: pts[0].x, y: pts[0].y }];
    let acc = 0;
    for (let i = 1; i < pts.length; i++) {
      let ax = pts[i - 1].x, ay = pts[i - 1].y; const bx = pts[i].x, by = pts[i].y;
      let seg = dist(ax, ay, bx, by);
      while (acc + seg >= sp) {
        const t = (sp - acc) / seg;
        ax = ax + (bx - ax) * t; ay = ay + (by - ay) * t;
        out.push({ x: ax, y: ay });
        seg = dist(ax, ay, bx, by); acc = 0;
      }
      acc += seg;
    }
    const last = pts[pts.length - 1];
    if (dist(out[out.length - 1].x, out[out.length - 1].y, last.x, last.y) > sp * 0.4) out.push({ x: last.x, y: last.y });
    return out;
  }
  function polyArea(p) { let a = 0; for (let i = 0; i < p.length; i++) { const j = (i + 1) % p.length; a += p[i].x * p[j].y - p[j].x * p[i].y; } return Math.abs(a / 2); }
  function strokeLen(p) { let l = 0; for (let i = 1; i < p.length; i++) l += dist(p[i - 1].x, p[i - 1].y, p[i].x, p[i].y); return l; }

  class World {
    constructor(opts = {}) {
      this.P = []; this.C = []; this.creatures = []; this.bodies = []; this.t = 0; this.events = [];
      this.rand = rng(opts.seed || 7);
      this.ward = null; this.goalX = null; this.failed = false; this.won = false;
      this.groundPts = opts.ground || [{ x: 0, y: GROUND }, { x: W, y: GROUND }];
      this.tune = Object.assign({
        shapeK: 0.12, balance: 0.85, bendK: 0.25, servoGain: 0.06, reachF: 5200, reachMax: 9000,
        friction: 0.35, footFriction: 0.6, speedBase: 150, jumpV: 0, reachSpeed: 900, reaction: 0.25, reachGain: 0.25,
      }, opts.tune || {});
    }
    // ---------- bodies (bombs, boulders, ward) ----------
    addBody(b) { b.px = b.x - (b.vx || 0) * DT; b.py = b.y - (b.vy || 0) * DT; b.alive = true; this.bodies.push(b); return b; }
    // ---------- creatures from strokes ----------
    addCreature(strokes) {
      const t = this.tune;
      const base = this.P.length;
      const sInfo = [];
      for (const raw of strokes) {
        const L = strokeLen(raw);
        const closed = raw.length > 6 && dist(raw[0].x, raw[0].y, raw[raw.length - 1].x, raw[raw.length - 1].y) < Math.max(22, 0.15 * L) && polyArea(raw) > 600;
        const pts = resample(raw, SPACING);
        if (closed && pts.length > 3 && dist(pts[0].x, pts[0].y, pts[pts.length - 1].x, pts[pts.length - 1].y) < SPACING * 0.6) pts.pop();
        const ids = [];
        for (const p of pts) { ids.push(this.P.length); this.P.push({ x: p.x, y: p.y, px: p.x, py: p.y, ax: 0, ay: 0, im: 1, g: false, cr: -1, s: sInfo.length, w: 1 }); }
        const links = [];
        for (let i = 1; i < ids.length; i++) links.push(this.link(ids[i - 1], ids[i], 1));
        for (let i = 2; i < ids.length; i++) this.link(ids[i - 2], ids[i], t.bendK, 'bend');
        if (closed) { links.push(this.link(ids[ids.length - 1], ids[0], 1)); if (ids.length > 3) { this.link(ids[ids.length - 2], ids[0], t.bendK, 'bend'); this.link(ids[ids.length - 1], ids[1], t.bendK, 'bend'); } }
        sInfo.push({ ids, closed, area: closed ? polyArea(pts) : 0, raw });
        this.strokes = this.strokes || []; this.strokes.push({ ids, closed, links });
      }
      // welds: particles of different strokes that touch; also endpoints snap to nearby strokes (finger slop)
      const deg = {};
      const addDeg = (i) => deg[i] = (deg[i] || 0) + 1;
      for (let a = 0; a < sInfo.length; a++) for (let b = a + 1; b < sInfo.length; b++) {
        const A = sInfo[a], B = sInfo[b];
        const endsA = A.closed ? [] : [A.ids[0], A.ids[A.ids.length - 1]];
        const endsB = B.closed ? [] : [B.ids[0], B.ids[B.ids.length - 1]];
        let best = null;
        for (const i of A.ids) for (const j of B.ids) {
          const pi = this.P[i], pj = this.P[j];
          const d = dist(pi.x, pi.y, pj.x, pj.y);
          const isEnd = endsA.includes(i) || endsB.includes(j);
          const lim = isEnd ? 18 : 9;
          if (d < lim) { this.link(i, j, 1, 'weld'); addDeg(i); addDeg(j); }
        }
      }
      // components
      const n = this.P.length - base; const parent = new Array(n).fill(0).map((_, i) => i);
      const find = (x) => (parent[x] === x ? x : (parent[x] = find(parent[x])));
      for (const c of this.C) { if (c.a >= base && c.b >= base) parent[find(c.a - base)] = find(c.b - base); }
      const groups = {};
      for (let i = 0; i < n; i++) { const r = find(i); (groups[r] = groups[r] || []).push(i + base); }
      const made = [];
      for (const k in groups) made.push(this.makeCreature(groups[k], sInfo, deg));
      return made;
    }
    link(a, b, k, type = 'dist') {
      const pa = this.P[a], pb = this.P[b];
      const c = { a, b, rest: dist(pa.x, pa.y, pb.x, pb.y), k, type, broken: false };
      this.C.push(c); return c;
    }
    makeCreature(ids, sInfo, deg) {
      const cr = { id: this.creatures.length, ids, alive: true, name: '', hands: [], feet: [], head: null, grab: null, mode: 'idle', look: { x: 0, y: 0 }, blink: 0, strain: 0, phase: 0 };
      for (const i of ids) this.P[i].cr = cr.id;
      let cx = 0, cy = 0, minY = 1e9, maxY = -1e9, minX = 1e9, maxX = -1e9;
      for (const i of ids) { const p = this.P[i]; cx += p.x; cy += p.y; minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); }
      cx /= ids.length; cy /= ids.length;
      cr.rest = ids.map((i) => ({ x: this.P[i].x - cx, y: this.P[i].y - cy }));
      cr.h = maxY - minY; cr.w = maxX - minX; cr.size = Math.max(cr.h, cr.w);
      cr.ink = ids.length * SPACING;
      // head = largest loop in this creature
      const strokesHere = sInfo.filter((s) => s.ids.length && this.P[s.ids[0]].cr === cr.id);
      const loops = strokesHere.filter((s) => s.closed).sort((a, b) => b.area - a.area);
      if (loops.length) cr.head = { ids: loops[0].ids, r: Math.sqrt(loops[0].area / Math.PI) };
      else { // worm: eyes at highest particle... prefer an endpoint
        let best = ids[0]; for (const i of ids) if (this.P[i].y < this.P[best].y) best = i;
        cr.head = { ids: [best], r: 10 };
      }
      // tips
      const tips = [];
      for (const s of strokesHere) {
        if (s.closed) continue;
        for (const e of [s.ids[0], s.ids[s.ids.length - 1]]) if (!deg[e]) tips.push({ id: e, s });
      }
      const headSet = new Set(cr.head.ids);
      for (const tp of tips) {
        if (headSet.has(tp.id)) continue;
        // limb path: walk from tip along its stroke up to 60% of stroke or a weld
        const sid = tp.s.ids; const fromStart = tp.id === sid[0];
        const chain = []; const len = Math.max(3, Math.floor(sid.length * 0.85));
        for (let k = 0; k < len; k++) { const idx = fromStart ? sid[k] : sid[sid.length - 1 - k]; if (k > 0 && deg[idx]) break; chain.push(idx); }
        const p = this.P[tp.id];
        const limb = { tip: tp.id, chain, len: chain.length * SPACING };
        if (p.y > cy + 0.25 * cr.h && p.y > maxY - 0.35 * cr.h) cr.feet.push(limb); else cr.hands.push(limb);
      }
      // core = particles closest to centroid
      const sorted = ids.slice().sort((a, b) => dist(this.P[a].x, this.P[a].y, cx, cy) - dist(this.P[b].x, this.P[b].y, cx, cy));
      cr.core = sorted.slice(0, Math.max(3, Math.floor(ids.length * 0.3)));
      // tip particles get looser shape matching so they can reach
      for (const l of cr.hands) l.chain.forEach((id, k) => (this.P[id].w = 0.15 + 0.85 * (k / l.chain.length)));
      for (const l of cr.feet) l.chain.forEach((id, k) => (this.P[id].w = 0.4 + 0.6 * (k / l.chain.length)));
      // anatomy-derived stats
      cr.mass = ids.length;
      cr.strength = Math.pow(cr.ink / 400, 0.6);
      const legLen = cr.feet.length ? cr.feet.reduce((a, l) => a + l.len, 0) / cr.feet.length : 0;
      cr.speed = this.tune.speedBase * (cr.feet.length ? (0.8 + Math.min(1.6, legLen / 60)) : 0.35) / Math.pow(cr.size / 200, 0.35);
      cr.balance = cr.feet.length >= 2 ? this.tune.balance : cr.feet.length === 1 ? this.tune.balance * 0.6 : 0.25;
      cr.name = nameFor(cr, loops.length);
      let lift = 0; for (const i of ids) { const p = this.P[i]; lift = Math.max(lift, p.y - (this.groundY(p.x) - PR)); }
      if (lift > 0) for (const i of ids) { this.P[i].y -= lift; this.P[i].py = this.P[i].y; }
      this.creatures.push(cr);
      this.events.push({ t: this.t, type: 'born', cr: cr.id, name: cr.name });
      return cr;
    }
    groundY(x) {
      const g = this.groundPts; if (x <= g[0].x) return g[0].y;
      for (let i = 1; i < g.length; i++) if (x <= g[i].x) { const t = (x - g[i - 1].x) / (g[i].x - g[i - 1].x); return g[i - 1].y + (g[i].y - g[i - 1].y) * t; }
      return g[g.length - 1].y;
    }
    centroid(cr) { let x = 0, y = 0, n = 0; for (const i of cr.ids) { const p = this.P[i]; x += p.x; y += p.y; n++; } return { x: x / n, y: y / n }; }
    headPos(cr) { let x = 0, y = 0; for (const i of cr.head.ids) { x += this.P[i].x; y += this.P[i].y; } return { x: x / cr.head.ids.length, y: y / cr.head.ids.length }; }
    // ---------- brain ----------
    think(cr) {
      const c = this.centroid(cr);
      const ward = this.ward;
      let targetX = ward ? ward.x + (c.x < ward.x ? -40 : 40) : c.x;
      let focus = ward ? { x: ward.x, y: ward.y } : null;
      cr.mode = 'guard';
      // threats: bombs (falling or resting), sorted by danger to ward
      const threats = this.bodies.filter((b) => b.alive && b.kind === 'bomb' && !(b.thrown && this.t - b.thrownAt < 0.9) && !b.held);
      if (ward && threats.length) {
        threats.sort((a, b) => Math.abs(a.x - ward.x) - Math.abs(b.x - ward.x));
        const th = threats[0];
        focus = { x: th.x, y: th.y };
        cr.mode = 'intercept';
        targetX = th.x + (ward.x - th.x) * 0.35; // stand between-ish, slightly toward the threat
        cr.reachTargets = threats;
      } else cr.reachTargets = [];
      if (this.goalX != null && !threats.length) { targetX = this.goalX; cr.mode = 'carry'; focus = { x: this.goalX, y: GROUND - 100 }; }
      if (cr.forceTarget) { targetX = cr.forceTarget.x; focus = cr.forceTarget; cr.mode = 'walk'; }
      cr.targetX = targetX; cr.focus = focus;
      if (focus) { cr.look.x += (focus.x - cr.look.x) * 0.25; cr.look.y += (focus.y - cr.look.y) * 0.25; }
    }
    actuate(cr, h) {
      const t = this.tune, P = this.P;
      const c = this.centroid(cr);
      let grounded = 0; for (const i of cr.ids) if (P[i].g) grounded++;
      // locomotion: velocity servo on whole body (puppeted intent), only with ground contact
      const dx = cr.targetX - c.x;
      const want = Math.abs(dx) < 12 ? 0 : Math.sign(dx) * Math.min(cr.speed, Math.abs(dx) * 3);
      if (grounded) {
        const gain = t.servoGain * Math.min(1.5, cr.strength * 400 / cr.mass + 0.4);
        for (const i of cr.ids) { const p = P[i]; const vx = (p.x - p.px) / h; const nvx = vx + (want - vx) * gain; p.px = p.x - nvx * h; }
      }
      // gait: feet alternate lifting (visual stepping that also helps over bumps)
      if (Math.abs(want) > 5 && cr.feet.length) {
        cr.phase += h * (3 + cr.speed / 80);
        cr.feet.forEach((l, k) => {
          const s = Math.sin(cr.phase * Math.PI * 2 + k * Math.PI);
          if (s > 0.2) { const p = P[l.tip]; p.ay -= 2600 * s; p.ax += Math.sign(want) * 1800 * s; }
        });
      }
      // hands: reach for nearest threat; reaction on core
      cr.strain = Math.max(0, cr.strain - h * 2);
      for (const l of cr.hands) {
        l.reaching = 0;
        if (cr.grab && cr.grab.limb === l) continue;
        let best = null, bd = 1e9;
        for (const b of cr.reachTargets) { const d = dist(P[l.tip].x, P[l.tip].y, b.x, b.y); if (d < bd) { bd = d; best = b; } }
        if (!best) continue;
        if (bd > cr.size * 1.6 + 120) continue; // out of sense range for this hand
        const tp = P[l.tip];
        const root = P[l.chain[l.chain.length - 1]];
        let gx = best.x - root.x, gy = best.y - root.y; const gl = Math.hypot(gx, gy) || 1; const R = l.len * 1.05;
        const tgx = gl > R ? root.x + gx / gl * R : best.x, tgy = gl > R ? root.y + gy / gl * R : best.y;
        bd = Math.hypot(tgx - tp.x, tgy - tp.y) || 1e-6;
        const vmax = t.reachSpeed * (0.7 + 0.3 * Math.min(2, cr.strength));
        const sp = Math.min(vmax, bd * 8);
        const dvx = (tgx - tp.x) / bd * sp, dvy = (tgy - tp.y) / bd * sp;
        const share = [1, 0.7, 0.45, 0.25];
        l.chain.slice(0, 4).forEach((id, k) => this.servo(P[id], dvx * share[k], dvy * share[k], t.reachGain, h));
        l.reaching = 1;
        // grab
        const realD = dist(tp.x, tp.y, best.x, best.y);
        if (realD < best.r + 12 && !cr.grab && !best.held) { cr.grab = { limb: l, body: best, t: 0 }; best.held = true; this.events.push({ t: this.t, type: 'grab', cr: cr.id }); }
      }
      for (const l of cr.hands) { const soft = l.reaching || (cr.grab && cr.grab.limb === l); for (const id of l.chain) P[id].soft = soft; }
      // holding: swing up then throw away from ward
      if (cr.grab) {
        const g = cr.grab, b = g.body, tp = P[g.limb.tip];
        g.t += h;
        b.x = tp.x; b.y = tp.y; b.px = P[g.limb.tip].px; b.py = P[g.limb.tip].py;
        const away = Math.sign(b.x - (this.ward ? this.ward.x : 0)) || 1;
        const hp = this.headPos(cr);
        const root = P[g.limb.chain[g.limb.chain.length - 1]];
        let sx = root.x + away * g.limb.len * 0.7, sy = root.y - g.limb.len * 0.7; // swing target inside the arm's envelope
        const dd = dist(tp.x, tp.y, sx, sy) || 1; const sp2 = Math.min(t.reachSpeed * 1.5, dd * 10);
        g.limb.chain.slice(0, 3).forEach((id, k) => this.servo(P[id], (sx - tp.x) / dd * sp2 * [1, .6, .3][k], (sy - tp.y) / dd * sp2 * [1, .6, .3][k], t.reachGain, h));
        if (g.t > 0.32) {
          const tv = 950 + 250 * Math.min(2, cr.strength);
          b.px = b.x - away * tv * h; b.py = b.y + 0.7 * tv * h; b.held = false; b.thrown = true; b.thrownAt = this.t; cr.grab = null;
          this.events.push({ t: this.t, type: 'throw', cr: cr.id });
        }
      }
    }
    servo(p, vx, vy, gain, h) { const cx = (p.x - p.px) / h, cy = (p.y - p.py) / h; p.px = p.x - (cx + (vx - cx) * gain) * h; p.py = p.y - (cy + (vy - cy) * gain) * h; }
    // ---------- step ----------
    step() {
      const P = this.P, t = this.tune;
      for (const cr of this.creatures) if (cr.alive) this.think(cr);
      for (let s = 0; s < SUB; s++) {
        const h = H_;
        for (const p of P) { p.ax = 0; p.ay = G; }
        for (const cr of this.creatures) if (cr.alive) this.actuate(cr, h);
        for (const p of P) {
          const vx = (p.x - p.px) * 0.995, vy = (p.y - p.py) * 0.995;
          p.px = p.x; p.py = p.y;
          p.x += vx + p.ax * h * h; p.y += vy + p.ay * h * h;
        }
        for (const b of this.bodies) {
          if (!b.alive || b.held) continue;
          const vx = (b.x - b.px) * 0.998, vy = (b.y - b.py) * 0.998; b.px = b.x; b.py = b.y; b.x += vx; b.y += vy + G * h * h;
        }
        for (let it = 0; it < ITER; it++) {
          for (const c of this.C) {
            if (c.broken) continue;
            const a = P[c.a], b = P[c.b];
            const dx = b.x - a.x, dy = b.y - a.y; const d = Math.hypot(dx, dy) || 1e-6;
            if (c.type !== 'bend' && d > (c.type === 'weld' ? c.rest + 24 : c.rest * 2.3)) { c.broken = true; this.events.push({ t: this.t, type: 'tear' }); continue; }
            const diff = (d - c.rest) / d * 0.5 * c.k;
            a.x += dx * diff; a.y += dy * diff; b.x -= dx * diff; b.y -= dy * diff;
          }
          if (it % 3 === 0) for (const cr of this.creatures) if (cr.alive) this.shapeMatch(cr);
          this.collide();
        }
      }
      this.t += DT;
      this.updateBombs();
    }
    shapeMatch(cr) {
      const P = this.P, k = this.tune.shapeK;
      const c = this.centroid(cr);
      let sc = 0, ss = 0;
      cr.ids.forEach((id, i) => { const p = P[id], r = cr.rest[i]; const qx = p.x - c.x, qy = p.y - c.y; sc += r.x * qx + r.y * qy; ss += r.x * qy - r.y * qx; });
      let ang = Math.atan2(ss, sc);
      ang *= (1 - cr.balance); // upright bias = balance cheat
      cr.angle = ang;
      const co = Math.cos(ang), si = Math.sin(ang);
      cr.ids.forEach((id, i) => { const p = P[id], r = cr.rest[i]; const tx = c.x + r.x * co - r.y * si, ty = c.y + r.x * si + r.y * co; const kk = k * (p.soft ? 0.05 : p.w); p.x += (tx - p.x) * kk; p.y += (ty - p.y) * kk; });
    }
    collide() {
      const P = this.P, t = this.tune;
      for (const p of P) {
        p.g = false;
        const gy = this.groundY(p.x);
        if (p.y > gy - PR) {
          p.y = gy - PR; p.g = true;
          const fr = t.friction; p.px = p.px + (p.x - p.px) * fr; // kill some horizontal velocity
        }
        if (p.x < PR) p.x = PR; if (p.x > W - PR) p.x = W - PR;
      }
      for (const b of this.bodies) {
        if (!b.alive) continue;
        if (!b.held) {
          const gy = this.groundY(b.x), slope = (this.groundY(b.x + 4) - this.groundY(b.x - 4)) / 8;
          if (b.y > gy - b.r) { b.y = gy - b.r; b.px = b.px + (b.x - b.px) * 0.02; b.px -= slope * 0.6; }
          if (b.x < b.r) b.x = b.r; if (b.x > W - b.r) b.x = W - b.r;
        }
        if (b.held) continue;
        for (const p of P) {
          if (p.cr < 0) continue;
          const dx = p.x - b.x, dy = p.y - b.y; const d = Math.hypot(dx, dy); const m = b.r + PR;
          if (d < m && d > 0) {
            const push = (m - d) / d; const wb = b.mass / (b.mass + 1), wp = 1 - wb;
            p.x += dx * push * wb; p.y += dy * push * wb; b.x -= dx * push * wp; b.y -= dy * push * wp;
          }
        }
      }
      // ward collides with creatures (ward is a light circle body)
    }
    updateBombs() {
      for (const b of this.bodies) {
        if (!b.alive || b.kind !== 'bomb') continue;
        if (this.t >= b.fuseAt) {
          b.alive = false; this.events.push({ t: this.t, type: 'boom', x: b.x, y: b.y });
          if (this.ward && dist(b.x, b.y, this.ward.x, this.ward.y) < 140) { this.failed = true; this.ward.dead = true; this.events.push({ t: this.t, type: 'ward-dead' }); }
          for (const p of this.P) { const d = dist(p.x, p.y, b.x, b.y); if (d < 170 && d > 0) { const f = (1 - d / 170) * 14; p.px -= (p.x - b.x) / d * f; p.py -= (p.y - b.y) / d * f; } }
          for (const c of this.C) { const a = this.P[c.a]; if (dist(a.x, a.y, b.x, b.y) < 55) c.broken = true; }
        }
      }
    }
  }
  const NAMES = ['Gerald', 'Doris', 'Kevin', 'Mabel', 'Nigel', 'Wendy', 'Bernard', 'Phil', 'Agnes', 'Clive', 'Brenda', 'Otis'];
  function nameFor(cr, loops) {
    const n = NAMES[(cr.ids.length * 7 + cr.hands.length * 3 + cr.feet.length) % NAMES.length];
    let ep = 'the Plain';
    const longArm = cr.hands.some((l) => l.len > 0.9 * cr.h && l.len > 60);
    if (cr.size > 430) ep = 'the Enormous';
    else if (cr.feet.length >= 5) ep = 'the Many-Legged';
    else if (!cr.hands.length && !cr.feet.length && loops === 0) ep = 'the Worm';
    else if (longArm) ep = 'the Long-Armed';
    else if (loops === 0) ep = 'the Headless';
    else if (cr.size < 70) ep = 'the Tiny';
    return n + ' ' + ep;
  }
  root.Drew = { World, W, H, GROUND, DT };
})(typeof window !== 'undefined' ? window : globalThis);
