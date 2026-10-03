// Level-card thumbnails (look-and-feel §8): a tiny greybox doodle of the level's
// lower page: felt terrain, the threats in their red accent, Little Guy and his scarf.
import { COLORS, HAZ, LEVEL, WORLD } from '../tuning';
import type { LevelDef } from '../sim/level';

const W = 168,
  TOP = 820; // page y where the crop starts: the action lives low on the page

export function levelThumb(def: LevelDef): HTMLCanvasElement {
  const k = W / WORLD.W,
    H = Math.round((WORLD.H - TOP) * k);
  const c = document.createElement('canvas');
  const dpr = Math.min(2, devicePixelRatio || 1) * 1.3;
  c.width = W * dpr;
  c.height = H * dpr;
  c.style.width = W + 'px';
  c.style.height = H + 'px';
  c.className = 'thumb';
  const g = c.getContext('2d')!;
  g.scale(dpr * k, dpr * k);
  g.translate(0, -TOP);
  g.lineJoin = g.lineCap = 'round';
  // the felt floor and terrain
  g.fillStyle = COLORS.felt;
  if (def.floor !== false) g.fillRect(0, WORLD.floorY, WORLD.W, WORLD.H - WORLD.floorY);
  for (const t of def.terrain) {
    g.beginPath();
    t.forEach((p, i) => (i ? g.lineTo(p.x, p.y) : g.moveTo(p.x, p.y)));
    g.closePath();
    g.fill();
  }
  // threats: felt bodies with one red accent each
  for (const e0 of def.entities as { type: string; x: number; y: number; h?: number; r?: number; x0?: number; x1?: number }[]) {
    if (e0.type === 'spikes') {
      // felt teeth, red along the points
      const n = Math.max(1, Math.round((e0.x1! - e0.x0!) / 36)),
        step = (e0.x1! - e0.x0!) / n;
      g.fillStyle = COLORS.felt;
      g.beginPath();
      g.moveTo(e0.x0!, e0.y);
      for (let i = 0; i < n; i++) g.lineTo(e0.x0! + step * (i + 0.5), e0.y - 34), g.lineTo(e0.x0! + step * (i + 1), e0.y);
      g.fill();
      g.strokeStyle = COLORS.red;
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(e0.x0!, e0.y - 34);
      g.lineTo(e0.x1!, e0.y - 34);
      g.stroke();
      continue;
    }
    if (e0.type === 'cargo') {
      // a little player holding up a yellow ball
      g.strokeStyle = COLORS.felt;
      g.lineWidth = 6;
      g.beginPath();
      g.moveTo(e0.x, e0.y + 30);
      g.lineTo(e0.x, e0.y + 62);
      g.stroke();
      g.fillStyle = COLORS.yellow;
      g.beginPath();
      g.arc(e0.x, e0.y, 20, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = COLORS.felt;
      g.lineWidth = 4;
      g.stroke();
      continue;
    }
    // threats that start above the crop (falling bombs) are pinned to its top edge
    const e = { ...e0, y: e0.type === 'crusher' ? e0.y : Math.max(e0.y, TOP + (e0.r ?? HAZ.boulderR) * (e0.type === 'boulder' ? 1 : 0.6) + 8) };
    g.fillStyle = COLORS.felt;
    g.strokeStyle = COLORS.red;
    g.lineWidth = 6;
    g.beginPath();
    if (e.type === 'boulder') {
      g.arc(e.x, e.y, e.r ?? HAZ.boulderR, 0, Math.PI * 2);
      g.fill();
    } else if (e.type === 'bomb') {
      g.arc(e.x, e.y, HAZ.bombR * 1.6, 0, Math.PI * 2);
      g.fill();
      g.stroke();
    } else if (e.type === 'crusher') {
      const h = e.h ?? 300;
      g.rect(e.x - HAZ.crusherW / 2, e.y - h / 2, HAZ.crusherW, h);
      g.fill();
      g.strokeStyle = COLORS.red;
      g.beginPath();
      g.moveTo(e.x + HAZ.crusherW / 2, e.y - h / 2);
      g.lineTo(e.x + HAZ.crusherW / 2, e.y + h / 2);
      g.stroke();
    } else if (e.type === 'ball') {
      g.arc(e.x, e.y, HAZ.ballR * 1.6, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(e.x - HAZ.ballR, e.y);
      g.lineTo(e.x + HAZ.ballR, e.y);
      g.stroke();
    } else if (e.type === 'ninja') {
      g.arc(e.x, Math.min(e.y, WORLD.floorY - HAZ.ninjaR * 1.6), HAZ.ninjaR * 1.6, 0, Math.PI * 2);
      g.fill();
      g.beginPath();
      g.moveTo(e.x - HAZ.ninjaR * 1.6, e.y - HAZ.ninjaR * 1.2);
      g.lineTo(e.x + HAZ.ninjaR * 1.6, e.y - HAZ.ninjaR * 1.2);
      g.stroke();
    }
  }
  // the goal in yellow: the flag, or the hoop (pinned inside the crop)
  const goal = def.goal;
  if (goal.type === 'home') {
    g.strokeStyle = COLORS.felt;
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(goal.x, goal.y);
    g.lineTo(goal.x, goal.y - LEVEL.flagH);
    g.stroke();
    g.fillStyle = COLORS.yellow;
    g.beginPath();
    g.moveTo(goal.x, goal.y - LEVEL.flagH);
    g.lineTo(goal.x + 56, goal.y - LEVEL.flagH + 20);
    g.lineTo(goal.x, goal.y - LEVEL.flagH + 40);
    g.fill();
  } else if (goal.type === 'score') {
    const hy = Math.max(goal.hoop.y, TOP + 40);
    g.strokeStyle = COLORS.yellow;
    g.lineWidth = 10;
    g.beginPath();
    g.ellipse(goal.hoop.x, hy, LEVEL.hoopW / 2, 9, 0, 0, Math.PI * 2);
    g.stroke();
  }
  // Little Guy, drawn big enough to read at this size
  const { x, y } = def.guy;
  g.strokeStyle = COLORS.felt;
  g.fillStyle = COLORS.felt;
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(x - 12, y);
  g.lineTo(x, y - 26);
  g.lineTo(x + 12, y);
  g.moveTo(x, y - 26);
  g.lineTo(x, y - 52);
  g.stroke();
  g.beginPath();
  g.arc(x, y - 64, 13, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = COLORS.yellow;
  g.lineWidth = 8;
  g.beginPath();
  g.moveTo(x - 9, y - 48);
  g.lineTo(x + 18, y - 44);
  g.stroke();
  return c;
}
