// Dev-only fixture capture (Gate 1): prompts ~40 labelled strokes and saves them to
// tests/fixtures/human/ through the dev server. Nothing advances until the player taps
// Next; drawing again replaces a single-stroke answer; Back revisits earlier prompts;
// progress survives a reload. The classifier's read is hidden until the end so it
// can't nudge the player into drawing "for the machine".
import { attachPen, LivePt } from '../input/pen';
import { layoutPage, clientToPage, PageRect } from '../game/view';
import { PAPERS, renderPaper } from '../render/materials';
import { drawWet, strokeWidths, WetStroke } from '../game/ink';
import { classifyStroke, partSummary, MarkKind } from '../sim/classify';
import { arc, circle, line, poly, springLine } from '../sim/canon';
import type { Pt } from '../sim/geom';
import { mulberry32 } from '../sim/rng';
import { COLORS, WORLD } from '../tuning';

interface Prompt {
  name: string;
  title: string;
  hint: string;
  label?: MarkKind[]; // single-stroke prompt: the marks this stroke should read as
  join?: number; // multi-stroke prompt: minimum strokes; all should make ONE creature
  example: () => Pt[][]; // drawn small in non-photo blue, in a 200×200 box
}

// messy scrub: a seeded random walk confined to a disc, so it reads as a real scribble
const tangle = (cx: number, cy: number, r: number) => {
  const rnd = mulberry32(Math.round(cx * 7 + r));
  const out: Pt[] = [];
  let a = 0;
  for (let i = 0; i < 46; i++) {
    a += 2.2 + rnd() * 1.6;
    const rr = r * (0.3 + 0.7 * rnd());
    out.push({ x: cx + Math.cos(a) * rr, y: cy + Math.sin(a) * rr * 0.85 });
  }
  return out;
};
const shade = (x0: number, y0: number, w: number, h: number) => {
  const out: Pt[] = [];
  for (let i = 0; i < 14; i++) out.push({ x: x0 + (i % 2 ? w : 0), y: y0 + (i / 13) * h });
  return poly(out);
};
const gapCircle = (cx: number, cy: number, r: number, gap: number) => arc(cx, cy, r, -Math.PI / 2, Math.PI * 1.5 - gap, 40);

const P: Prompt[] = [
  // ---- lines
  { name: 'line', title: 'A straight line', hint: 'One stroke, any direction.', label: ['line'], example: () => [line(30, 150, 170, 50)] },
  { name: 'line', title: 'A long line', hint: 'Across most of the page.', label: ['line'], example: () => [line(10, 100, 190, 110)] },
  { name: 'line', title: 'A short line', hint: 'About as long as your fingertip.', label: ['line'], example: () => [line(85, 100, 120, 90)] },
  { name: 'arc', title: 'A curve like a smile', hint: 'Ends stay apart. Don’t close it.', label: ['line'], example: () => [arc(100, 60, 80, 0.4, Math.PI - 0.4)] },
  { name: 'arc', title: 'A big rainbow arch', hint: 'One stroke, ends far apart at the bottom.', label: ['line'], example: () => [arc(100, 170, 85, Math.PI, Math.PI * 2)] },
  { name: 's-curve', title: 'A wavy S line', hint: 'One smooth stroke that bends one way, then the other.', label: ['line'], example: () => [[...arc(100, 60, 40, Math.PI * 0.5, Math.PI * 2, 30).reverse(), ...arc(100, 140, 40, -Math.PI / 2, Math.PI / 2, 30).reverse()]] },
  { name: 'corner', title: 'An L shape', hint: 'One stroke: down, then across, without lifting.', label: ['line'], example: () => [poly([{ x: 60, y: 30 }, { x: 60, y: 170 }, { x: 160, y: 170 }])] },
  { name: 'corner', title: 'A V shape', hint: 'One stroke: down to a point and back up.', label: ['line'], example: () => [poly([{ x: 40, y: 40 }, { x: 100, y: 170 }, { x: 160, y: 40 }])] },
  { name: 'corner', title: 'A U shape', hint: 'Open at the top.', label: ['line'], example: () => [[...line(50, 30, 50, 120), ...arc(100, 120, 50, Math.PI, 0, 20), ...line(150, 120, 150, 30)]] },
  { name: 'arc', title: 'A hook like the letter J', hint: 'Straight down, then curl at the bottom.', label: ['line'], example: () => [[...line(130, 30, 130, 130), ...arc(100, 130, 30, 0, Math.PI, 16)]] },
  { name: 'line', title: 'A fast flick', hint: 'As quick as you can, don’t be careful.', label: ['line'], example: () => [line(40, 160, 160, 60)] },
  { name: 'line', title: 'A slow wobbly line', hint: 'Draw slowly and let your hand wobble.', label: ['line'], example: () => [line(20, 100, 180, 100).map((p, i) => ({ x: p.x, y: p.y + Math.sin(i * 0.6) * 5 }))] },
  // ---- closed shapes
  { name: 'loop', title: 'A small circle', hint: 'Like you normally would. If it doesn’t quite close, leave it.', label: ['loop'], example: () => [circle(100, 100, 30)] },
  { name: 'loop', title: 'A big circle', hint: 'Like you normally would. Small gaps or overlaps are fine.', label: ['loop'], example: () => [circle(100, 100, 80)] },
  { name: 'loop', title: 'An oval', hint: 'A stretched circle, any direction.', label: ['loop'], example: () => [circle(100, 100, 50).map((p) => ({ x: 100 + (p.x - 100) * 1.6, y: p.y }))] },
  { name: 'loop', title: 'A lumpy potato', hint: 'A closed blobby shape.', label: ['loop'], example: () => [circle(100, 100, 60).map((p, i) => ({ x: 100 + (p.x - 100) * (1 + 0.18 * Math.sin(i * 0.5)), y: 100 + (p.y - 100) * (1 + 0.18 * Math.sin(i * 0.5)) }))] },
  { name: 'loop', title: 'A fast circle', hint: 'As quick as you can. Messy is good.', label: ['loop'], example: () => [circle(100, 100, 55)] },
  { name: 'loop', title: 'A circle with a gap — on purpose', hint: 'Stop a little before you get back to the start, like a C that almost closes.', label: ['loop'], example: () => [gapCircle(100, 100, 60, 0.45)] },
  { name: 'loop', title: 'A circle that overlaps itself', hint: 'Keep going past where you started, so the end crosses the beginning.', label: ['loop'], example: () => [arc(100, 100, 60, -Math.PI / 2, Math.PI * 1.5 + 0.6, 50)] },
  { name: 'box', title: 'A box in one stroke', hint: 'Four sides without lifting, back to the start.', label: ['loop'], example: () => [poly([{ x: 40, y: 40 }, { x: 160, y: 40 }, { x: 160, y: 160 }, { x: 40, y: 160 }, { x: 40, y: 40 }])] },
  { name: 'box', title: 'A triangle in one stroke', hint: 'Three sides without lifting, back to the start.', label: ['loop'], example: () => [poly([{ x: 100, y: 30 }, { x: 170, y: 160 }, { x: 30, y: 160 }, { x: 100, y: 30 }])] },
  // ---- stick + loop, one stroke
  { name: 'lollipop', title: 'A lollipop in one stroke', hint: 'Draw the stick upward, then loop a circle at the top — without lifting.', label: ['line', 'loop'], example: () => [[...line(100, 190, 100, 110), ...arc(100, 75, 35, Math.PI / 2, Math.PI / 2 + Math.PI * 2, 40)]] },
  { name: 'lollipop', title: 'The number 6', hint: 'Like you’d write it.', label: ['line', 'loop'], example: () => [[...arc(120, 110, 70, -Math.PI * 0.6, -Math.PI, 14), ...arc(100, 140, 45, Math.PI, Math.PI * 3, 40)]] },
  // ---- zigzag springs
  { name: 'zigzag', title: 'A zigzag spring', hint: 'Sharp, pointy back-and-forth teeth — at least 4 points. Like a spring or a lightning bolt.', label: ['zigzag'], example: () => [springLine(30, 100, 170, 100, 6, 22)] },
  { name: 'zigzag', title: 'A long zigzag', hint: 'Lots of pointy teeth across the page.', label: ['zigzag'], example: () => [springLine(10, 100, 190, 100, 10, 18)] },
  { name: 'zigzag', title: 'A zigzag going down', hint: 'Pointy teeth, but travelling down the page.', label: ['zigzag'], example: () => [springLine(100, 20, 100, 180, 6, 22)] },
  { name: 'zigzag', title: 'A line that ends in a zigzag', hint: 'One stroke: straight for a while, then pointy teeth at the end.', label: ['line', 'zigzag'], example: () => [[...line(10, 100, 90, 100), ...springLine(90, 100, 190, 100, 5, 20)]] },
  { name: 'zigzag', title: 'A line with a zigzag in the middle', hint: 'One stroke: straight, then teeth, then straight again.', label: ['line', 'zigzag'], example: () => [[...line(5, 100, 60, 100), ...springLine(60, 100, 140, 100, 4, 20), ...line(140, 100, 195, 100)]] },
  // ---- scribbles (solid blobs of ink)
  { name: 'scribble', title: 'A small scribble ball', hint: 'Scrub fast back and forth on ONE small spot until it’s a dark blob — like colouring in a coin.', label: ['scribble'], example: () => [tangle(100, 100, 22)] },
  { name: 'scribble', title: 'A big scribble blob', hint: 'Same idea, bigger: colour in a patch the size of your thumb, fast and messy.', label: ['scribble'], example: () => [tangle(100, 100, 50)] },
  { name: 'scribble', title: 'Shading', hint: 'Colour in a patch with quick back-and-forth lines, like shading with a pencil.', label: ['scribble'], example: () => [shade(60, 60, 80, 80)] },
  { name: 'scribble', title: 'A tangled ball', hint: 'Go round and round in tiny loops on one spot, like a ball of wool.', label: ['scribble'], example: () => [[...arc(100, 100, 12, 0, Math.PI * 14, 90).map((p, i) => ({ x: p.x + Math.sin(i * 0.37) * 18, y: p.y + Math.cos(i * 0.29) * 16 }))]] },
  { name: 'fist', title: 'An arm with a fist', hint: 'One stroke: a line, then — without lifting — scribble a small ball at its end.', label: ['line', 'scribble'], example: () => [[...line(20, 150, 120, 80), ...tangle(140, 70, 20)]] },
  { name: 'fist', title: 'A fist with an arm', hint: 'One stroke: scribble a small ball first, then pull a line out of it.', label: ['line', 'scribble'], example: () => [[...tangle(60, 70, 20), ...line(60, 70, 170, 160)]] },
  // ---- multi-stroke: these should become ONE creature
  { name: 'join', title: 'A T where the lines barely touch', hint: '2 strokes: a line, then a second line whose end just touches the first.', join: 2, example: () => [line(30, 50, 170, 50), line(100, 55, 100, 180)] },
  { name: 'join', title: 'A head and body with a small gap', hint: '2 strokes: a circle, then a line below it that stops just short of the circle.', join: 2, example: () => [circle(100, 50, 30), line(100, 92, 100, 190)] },
  { name: 'join', title: 'A body and two legs', hint: '3 strokes: a line, then two legs that start near its bottom end (not exactly on it).', join: 3, example: () => [line(100, 20, 100, 120), line(96, 126, 60, 190), line(104, 126, 140, 190)] },
  { name: 'join', title: 'A cross', hint: '2 strokes crossing each other, like +.', join: 2, example: () => [line(30, 100, 170, 100), line(100, 30, 100, 170)] },
  { name: 'join', title: 'A stick figure', hint: 'However you normally draw one, any number of strokes.', join: 2, example: () => [circle(100, 40, 24), line(100, 64, 100, 130), line(60, 90, 140, 90), line(100, 130, 70, 190), line(100, 130, 130, 190)] },
  { name: 'join', title: 'A spider', hint: 'A circle body with legs, quick and sloppy.', join: 2, example: () => [circle(100, 100, 28), line(78, 112, 25, 160), line(80, 100, 20, 100), line(122, 112, 175, 160), line(120, 100, 180, 100)] },
];

type Answer = { x: number; y: number; t: number }[][];
const STORE = 'drew-capture-v2';
let answers: (Answer | null)[] = P.map(() => null);
let idx = 0;
let current: WetStroke[] = [];
let live: WetStroke | null = null;

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
  rect = layoutPage(innerWidth, innerHeight, dpr);
  paper = renderPaper(PAPERS.cream, rect.w * dpr, rect.h * dpr);
  (window as unknown as { drew: unknown }).drew = { toy: { rect } }; // for tools/livepen
}
resize();
addEventListener('resize', resize);

// ---------------------------------------------------------------- persistence

function persist() {
  try {
    localStorage.setItem(STORE, JSON.stringify({ idx, answers }));
  } catch {
    /* private mode: progress just isn't kept */
  }
}
try {
  const s = JSON.parse(localStorage.getItem(STORE) ?? 'null');
  if (s && Array.isArray(s.answers) && s.answers.length === P.length) {
    answers = s.answers;
    idx = Math.min(P.length, s.idx | 0);
  }
} catch {
  /* fresh start */
}

const toAnswer = (strokes: WetStroke[]): Answer =>
  strokes.map((s) => {
    const t0 = s.pts[0].t;
    return s.pts.map((q) => ({ x: Math.round(q.x * 10) / 10, y: Math.round(q.y * 10) / 10, t: Math.round((q.t - t0) * 1000) / 1000 }));
  });
const fromAnswer = (a: Answer): WetStroke[] =>
  a.map((s) => {
    const pts = s.map((q) => ({ ...q, p: 0.5 }));
    return { pts, upAt: -1e9, width: strokeWidths(pts) };
  });

// ---------------------------------------------------------------- flow

function load(i: number) {
  idx = i;
  const a = answers[idx];
  current = a ? fromAnswer(a) : [];
  persist();
  ui();
}

function next() {
  if (!current.length) return;
  answers[idx] = toAnswer(current);
  load(idx + 1);
}

function button(id: string, text: string, on: () => void, enabled = true, primary = false) {
  const b = document.getElementById(id) as HTMLButtonElement;
  b.textContent = text;
  b.disabled = !enabled;
  b.className = primary ? 'primary' : '';
  b.onclick = on;
}

function ui() {
  const p = P[idx];
  if (!p) return finish();
  const multi = !!p.join;
  const enough = multi ? current.length >= p.join! : current.length === 1;
  const strokesNote = multi ? `<span class="count">(${current.length} stroke${current.length === 1 ? '' : 's'} so far)</span>` : '';
  bar.innerHTML = `
    <div class="top"><span class="n">${idx + 1}/${P.length}</span><b>${p.title}</b></div>
    <div class="hint">${p.hint} ${strokesNote}</div>
    <div class="tip">${multi ? 'Draw all the strokes, then tap Next.' : 'Not happy with it? Just draw it again — the new one replaces it.'}</div>
    <div class="row"><button id="b-back"></button><button id="b-clear"></button><button id="b-skip"></button><button id="b-next"></button></div>`;
  button('b-back', '◀ Back', () => load(idx - 1), idx > 0);
  if (multi)
    button(
      'b-clear',
      'Undo stroke',
      () => {
        current.pop();
        ui();
      },
      current.length > 0,
    );
  else
    button(
      'b-clear',
      'Clear',
      () => {
        current = [];
        ui();
      },
      current.length > 0,
    );
  button('b-skip', 'Skip', () => {
    answers[idx] = null;
    load(idx + 1);
  });
  button('b-next', 'Next ▶', next, enough, true);
}

function results() {
  const strokes: { name: string; label: MarkKind[]; pts: Answer[number] }[] = [];
  const joins: { name: string; strokes: Answer }[] = [];
  const misses: string[] = [];
  P.forEach((p, i) => {
    const a = answers[i];
    if (!a) return;
    if (p.label) {
      strokes.push({ name: p.name, label: p.label, pts: a[0] });
      const got = [...new Set(partSummary(classifyStroke(a[0])))].sort();
      if (got.join('+') !== [...p.label].sort().join('+')) misses.push(`${i + 1}. ${p.title}: read as ${got.join(' + ') || '?'}`);
    } else joins.push({ name: p.title, strokes: a });
  });
  return { strokes, joins, misses };
}

function finish() {
  current = [];
  const r = results();
  const agree = r.strokes.length - r.misses.length;
  bar.innerHTML = `
    <div class="top"><b>All done — thank you!</b></div>
    <div class="hint">${r.strokes.length} single strokes and ${r.joins.length} drawings. The game read ${agree}/${r.strokes.length} strokes the way the prompt meant.</div>
    ${r.misses.length ? `<div class="tip">Misread (the game’s fault, not yours): ${r.misses.join(' · ')}</div>` : ''}
    <div class="row"><button id="b-back"></button><button id="b-clear"></button><button id="b-skip"></button><button id="b-next"></button></div>`;
  button('b-back', '◀ Back', () => load(P.length - 1));
  button('b-clear', 'Start over', () => {
    if (!confirm('Erase all drawings and start again?')) return;
    answers = P.map(() => null);
    load(0);
  });
  button('b-skip', '', () => {}, false);
  (document.getElementById('b-skip') as HTMLElement).style.visibility = 'hidden';
  button('b-next', 'Save ✓', save, true, true);
}

async function save() {
  const btn = document.getElementById('b-next') as HTMLButtonElement;
  btn.disabled = true;
  btn.textContent = 'Saving…';
  const r = results();
  const body = JSON.stringify({ device: navigator.userAgent, date: new Date().toISOString(), strokes: r.strokes, joins: r.joins });
  const hint = bar.querySelector('.hint')!;
  try {
    const res = await fetch('/__fixtures', { method: 'POST', body, headers: { 'content-type': 'application/json' } });
    if (res.ok) {
      hint.innerHTML = `Saved to <b>${await res.text()}</b>. You can close this page.`;
      btn.textContent = 'Saved ✓';
      return;
    }
  } catch {
    /* fall through to download */
  }
  hint.innerHTML = 'Couldn’t reach the dev server, so the file is downloading instead. Send me drew-fixtures.json.';
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([body], { type: 'application/json' }));
  a.download = 'drew-fixtures.json';
  a.click();
}

// ---------------------------------------------------------------- pen

attachPen(canvas, {
  toPage: (x, y) => clientToPage(rect, x, y),
  down: (p: LivePt) => {
    if (!P[idx]) return;
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
    if (s.pts.length < 3) return;
    s.upAt = -1e9; // show it dry: no gloss on the capture page
    s.width = strokeWidths(s.pts);
    if (P[idx].label) current = [s]; // single-stroke prompt: a new stroke replaces the old one
    else current.push(s);
    ui();
  },
});

// ---------------------------------------------------------------- draw

function drawExample(p: Prompt) {
  // a small "like this" card in the top-right corner of the page, below the prompt bar
  const S = 0.75,
    X = WORLD.W - 200 * S - 24,
    Y = Math.max(40, (bar.offsetHeight - rect.y) / rect.scale + 30);
  g.save();
  g.fillStyle = 'rgba(255,255,255,0.55)';
  g.strokeStyle = COLORS.blue;
  g.lineWidth = 2;
  g.setLineDash([6, 6]);
  g.beginPath();
  g.rect(X - 10, Y - 10, 200 * S + 20, 200 * S + 44);
  g.fill();
  g.stroke();
  g.setLineDash([]);
  g.translate(X, Y);
  g.scale(S, S);
  g.lineWidth = 4 / S;
  g.lineCap = 'round';
  g.lineJoin = 'round';
  for (const s of p.example()) {
    g.beginPath();
    s.forEach((q, i) => (i ? g.lineTo(q.x, q.y) : g.moveTo(q.x, q.y)));
    g.stroke();
  }
  g.restore();
  g.fillStyle = COLORS.blue;
  g.font = '22px "Patrick Hand", sans-serif';
  g.textAlign = 'center';
  g.fillText('example', X + 100 * S, Y + 200 * S + 26);
}

function frame() {
  const dpr = rect.dpr;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.fillStyle = '#B98B5E';
  g.fillRect(0, 0, canvas.width, canvas.height);
  g.setTransform(dpr * rect.scale, 0, 0, dpr * rect.scale, dpr * rect.x, dpr * rect.y);
  g.drawImage(paper, 0, 0, WORLD.W, WORLD.H);
  if (P[idx]) drawExample(P[idx]);
  drawWet(g, live ? [...current, live] : current, performance.now() / 1000, 1);
  requestAnimationFrame(frame);
}
load(idx);
frame();
