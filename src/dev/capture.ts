// Dev-only fixture capture (Gate 1): prompts ~40 labelled strokes, shows what the
// classifier read, and saves them to tests/fixtures/human/ through the dev server.
import { attachPen, LivePt } from '../input/pen';
import { layoutPage, clientToPage, PageRect } from '../game/view';
import { PAPERS, renderPaper } from '../render/materials';
import { drawWet, strokeWidths, WetStroke } from '../game/ink';
import { classifyStroke, partSummary, MarkKind } from '../sim/classify';
import { WORLD } from '../tuning';

interface Prompt {
  name: string;
  text: string;
  label?: MarkKind[]; // single-stroke prompts
  join?: number; // multi-stroke prompts: number of strokes that should make ONE creature
}

const P: Prompt[] = [
  { name: 'line', text: 'A straight line, any direction', label: ['line'] },
  { name: 'line', text: 'A long straight line', label: ['line'] },
  { name: 'line', text: 'A short little line', label: ['line'] },
  { name: 'arc', text: 'A curved line, like a smile', label: ['line'] },
  { name: 'arc', text: 'A big arch, like a rainbow (ends apart)', label: ['line'] },
  { name: 's-curve', text: 'A wavy S-shaped line', label: ['line'] },
  { name: 'corner', text: 'An L shape (one stroke)', label: ['line'] },
  { name: 'corner', text: 'A V shape (one stroke)', label: ['line'] },
  { name: 'corner', text: 'A U shape, open at the top', label: ['line'] },
  { name: 'loop', text: 'A small circle', label: ['loop'] },
  { name: 'loop', text: 'A big circle', label: ['loop'] },
  { name: 'loop', text: 'An oval', label: ['loop'] },
  { name: 'loop', text: 'A sloppy circle: leave a little gap at the end', label: ['loop'] },
  { name: 'loop', text: 'A circle that overshoots its start', label: ['loop'] },
  { name: 'box', text: 'A box, in one stroke', label: ['loop'] },
  { name: 'box', text: 'A triangle, in one stroke', label: ['loop'] },
  { name: 'loop', text: 'A blobby potato shape', label: ['loop'] },
  { name: 'lollipop', text: 'A stick with a circle on top, in ONE stroke', label: ['line', 'loop'] },
  { name: 'lollipop', text: 'A "6" shape', label: ['line', 'loop'] },
  { name: 'zigzag', text: 'A zigzag spring: small sharp back-and-forth', label: ['zigzag'] },
  { name: 'zigzag', text: 'A long zigzag spring', label: ['zigzag'] },
  { name: 'zigzag', text: 'A vertical zigzag spring (going down)', label: ['zigzag'] },
  { name: 'zigzag', text: 'A line, then a zigzag at the end (one stroke)', label: ['line', 'zigzag'] },
  { name: 'zigzag', text: 'A line with a zigzag in the middle (one stroke)', label: ['line', 'zigzag'] },
  { name: 'scribble', text: 'A small scribble (fill a little blob)', label: ['scribble'] },
  { name: 'scribble', text: 'A big messy scribble', label: ['scribble'] },
  { name: 'scribble', text: 'Shade a patch back and forth', label: ['scribble'] },
  { name: 'scribble', text: 'Scribble round and round, tight', label: ['scribble'] },
  { name: 'fist', text: 'A line ending in a scribbled fist (one stroke)', label: ['line', 'scribble'] },
  { name: 'fist', text: 'A scribble, then a line coming out of it (one stroke)', label: ['line', 'scribble'] },
  { name: 'line', text: 'A quick fast flick', label: ['line'] },
  { name: 'line', text: 'A slow, wobbly line', label: ['line'] },
  { name: 'loop', text: 'A quick fast circle', label: ['loop'] },
  { name: 'arc', text: 'A spiral that never closes… just kidding: a hook shape like "J"', label: ['line'] },
  { name: 'join', text: 'Two lines making a T that only JUST touch', join: 2 },
  { name: 'join', text: 'A circle head, then a body line that stops just short of it', join: 2 },
  { name: 'join', text: 'A body line, then two legs that start near (not on) it', join: 3 },
  { name: 'join', text: 'A cross: two lines crossing', join: 2 },
  { name: 'join', text: 'A stick figure, quickly, as you normally would', join: 6 },
  { name: 'join', text: 'A spider: a circle and legs, sloppily', join: 7 },
];

const out = { strokes: [] as { name: string; label: MarkKind[]; pts: { x: number; y: number; t: number }[] }[], joins: [] as { name: string; strokes: { x: number; y: number }[][] }[] };
let idx = 0;
let current: WetStroke[] = [];
let live: WetStroke | null = null;
let lastRead = '';
let agree = 0,
  tried = 0;

const canvas = document.getElementById('c') as HTMLCanvasElement;
const g = canvas.getContext('2d')!;
const bar = document.getElementById('bar')!;
let rect: PageRect;
let paper: HTMLCanvasElement;

function resize() {
  const dpr = Math.min(2, devicePixelRatio || 1);
  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + 'px';
  canvas.style.height = innerHeight + 'px';
  rect = layoutPage(innerWidth, innerHeight - 0, dpr);
  paper = renderPaper(PAPERS.cream, rect.w * dpr, rect.h * dpr);
  (window as unknown as { drew: unknown }).drew = { toy: { rect } }; // for tools/livepen
}
resize();
addEventListener('resize', resize);

function ui() {
  const p = P[idx];
  if (!p) {
    bar.innerHTML = `<b>Done!</b> ${out.strokes.length} strokes, ${out.joins.length} drawings. Classifier agreed on ${agree}/${tried}. <button id="save">Save fixtures</button>`;
    document.getElementById('save')!.onclick = save;
    return;
  }
  const need = p.join ? ` <i>(${current.length}/${p.join} strokes)</i>` : '';
  bar.innerHTML = `<span class="n">${idx + 1}/${P.length}</span> ${p.text}${need}<br><small>${lastRead}</small> <button id="redo">redo</button> <button id="skip">skip</button>`;
  document.getElementById('redo')!.onclick = () => {
    current = [];
    ui();
  };
  document.getElementById('skip')!.onclick = () => {
    current = [];
    idx++;
    ui();
  };
}

function commit() {
  const p = P[idx];
  const toPts = (s: WetStroke) => {
    const t0 = s.pts[0].t;
    return s.pts.map((q) => ({ x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10, t: Math.round((q.t - t0) * 1000) / 1000 }));
  };
  if (p.label) {
    const pts = toPts(current[0]);
    out.strokes.push({ name: p.name, label: p.label, pts });
    const got = [...new Set(partSummary(classifyStroke(pts)))].sort();
    const ok = got.join('+') === [...p.label].sort().join('+');
    tried++;
    if (ok) agree++;
    lastRead = `last: read as <b>${got.join(' + ') || '?'}</b> ${ok ? '✓' : `✗ (wanted ${p.label.join(' + ')})`}`;
  } else {
    out.joins.push({ name: p.name, strokes: current.map(toPts) });
    lastRead = 'last: saved drawing';
  }
  current = [];
  idx++;
  ui();
}

async function save() {
  const body = JSON.stringify({ device: navigator.userAgent, date: new Date().toISOString(), ...out });
  try {
    const r = await fetch('/__fixtures', { method: 'POST', body, headers: { 'content-type': 'application/json' } });
    bar.innerHTML = r.ok ? `Saved to <b>${await r.text()}</b>. Thank you!` : 'Save failed; downloading instead.';
    if (r.ok) return;
  } catch {
    /* fall through to download */
  }
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
  a.download = 'drew-fixtures.json';
  a.click();
}

attachPen(canvas, {
  toPage: (x, y) => clientToPage(rect, x, y),
  down: (p: LivePt) => {
    live = { pts: [p], upAt: Infinity, width: null };
  },
  move: (pts) => {
    if (!live) return;
    for (const q of pts) live.pts.push(q);
  },
  up: () => {
    if (!live) return;
    const s = live;
    live = null;
    if (s.pts.length < 3 || !P[idx]) return;
    s.upAt = performance.now() / 1000;
    s.width = strokeWidths(s.pts);
    current.push(s);
    const p = P[idx];
    if (p.label || current.length >= (p.join ?? 1)) setTimeout(commit, 350);
    else ui();
  },
});

function frame() {
  const dpr = rect.dpr;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#B98B5E';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.setTransform(dpr * rect.scale, 0, 0, dpr * rect.scale, dpr * rect.x, dpr * rect.y);
  g.drawImage(paper, 0, 0, WORLD.W, WORLD.H);
  drawWet(g, live ? [...current, live] : current, performance.now() / 1000, 1);
  requestAnimationFrame(frame);
}
ui();
frame();
