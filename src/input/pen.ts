// Pointer capture (physics.md §3): coalesced events for density, predicted
// events for drawing latency only (never stored), pressure where meaningful,
// 1€ smoothing. Emits page-space points.
import { PEN } from '../tuning';
import { OneEuro } from './onefilter';

export interface LivePt {
  x: number;
  y: number;
  t: number; // seconds (performance clock, real time; converted by the scene)
  p: number;
}

export interface PenHandlers {
  toPage(clientX: number, clientY: number): { x: number; y: number };
  down(p: LivePt, e: PointerEvent): void;
  move(pts: LivePt[], predicted: LivePt[], e: PointerEvent): void;
  up(p: LivePt, e: PointerEvent, cancelled: boolean): void;
  multiTap?(fingers: number): void;
}

export function attachPen(el: HTMLElement, h: PenHandlers) {
  let active: number | null = null;
  const fx = new OneEuro(PEN.minCutoff, PEN.beta, PEN.dCutoff);
  const fy = new OneEuro(PEN.minCutoff, PEN.beta, PEN.dCutoff);
  let lastT = 0;
  // multi-finger taps (2 = undo, 3 = debug)
  const touches = new Map<number, { t: number; x: number; y: number; moved: boolean }>();
  let maxTouches = 0;
  let multiStart = 0;

  const pressureOf = (e: PointerEvent) => (e.pointerType === 'pen' && e.pressure > 0 ? e.pressure : 0.5);
  const conv = (e: PointerEvent, smooth: boolean): LivePt => {
    const q = h.toPage(e.clientX, e.clientY);
    const t = e.timeStamp / 1000;
    if (!smooth) return { x: q.x, y: q.y, t, p: pressureOf(e) };
    const dt = Math.max(1e-3, t - lastT);
    lastT = t;
    return { x: fx.filter(q.x, dt), y: fy.filter(q.y, dt), t, p: pressureOf(e) };
  };

  el.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    if (e.pointerType === 'touch') {
      touches.set(e.pointerId, { t: e.timeStamp, x: e.clientX, y: e.clientY, moved: false });
      if (touches.size === 1) multiStart = e.timeStamp;
      maxTouches = Math.max(maxTouches, touches.size);
      if (touches.size >= 2 && active !== null) {
        // second finger: this is a gesture, not a stroke
        h.up(conv(e, false), e, true);
        active = null;
      }
    }
    if (active !== null || touches.size > 1) return;
    active = e.pointerId;
    try {
      el.setPointerCapture(e.pointerId);
    } catch {
      /* capture can fail on synthetic events */
    }
    fx.reset();
    fy.reset();
    lastT = e.timeStamp / 1000;
    h.down(conv(e, true), e);
  });

  el.addEventListener('pointermove', (e) => {
    const tt = touches.get(e.pointerId);
    if (tt && Math.hypot(e.clientX - tt.x, e.clientY - tt.y) > 12) tt.moved = true;
    if (e.pointerId !== active) return;
    const evs = typeof e.getCoalescedEvents === 'function' ? e.getCoalescedEvents() : [];
    const pts = (evs.length ? evs : [e]).map((c) => conv(c, true));
    const pred = typeof e.getPredictedEvents === 'function' ? e.getPredictedEvents().map((c) => conv(c, false)) : [];
    h.move(pts, pred, e);
  });

  const end = (e: PointerEvent, cancelled: boolean) => {
    if (e.pointerType === 'touch') {
      touches.delete(e.pointerId);
      if (touches.size === 0) {
        if (maxTouches >= 2 && e.timeStamp - multiStart < 350 && h.multiTap) h.multiTap(maxTouches);
        maxTouches = 0;
      }
    }
    if (e.pointerId !== active) return;
    active = null;
    h.up(conv(e, true), e, cancelled);
  };
  el.addEventListener('pointerup', (e) => end(e, false));
  el.addEventListener('pointercancel', (e) => end(e, true));
}
