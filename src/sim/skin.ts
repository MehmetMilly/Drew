// Skin data: every drawn full-resolution point bound to the particles of its part,
// so the creature always looks exactly like the drawing, deformed (physics.md §4).
import type { MarkKind } from './classify';

export interface SkinLump {
  centre: number;
  ring: number[];
  rcx: number; // rest centre
  rcy: number;
}

export interface SkinPart {
  kind: MarkKind;
  stroke: number; // global stroke serial
  closed: boolean;
  n: number;
  // drawn rest points
  dx: Float32Array;
  dy: Float32Array;
  // pen data for rendering
  width: Float32Array; // 0..1 (speed + pressure modulation)
  time: Float32Array; // pen time since stroke start (s), for drying sweep + timelapse
  // segment binding (lines, loops, springs)
  pa: Int32Array;
  pb: Int32Array;
  cid: Int32Array; // constraint that holds pa-pb (-1 when the same particle)
  t: Float32Array;
  off: Float32Array;
  lump: SkinLump | null;
}

export function makeSkin(kind: MarkKind, stroke: number, n: number, closed: boolean): SkinPart {
  return {
    kind,
    stroke,
    closed,
    n,
    dx: new Float32Array(n),
    dy: new Float32Array(n),
    width: new Float32Array(n).fill(0.5),
    time: new Float32Array(n),
    pa: new Int32Array(n).fill(-1),
    pb: new Int32Array(n).fill(-1),
    cid: new Int32Array(n).fill(-1),
    t: new Float32Array(n),
    off: new Float32Array(n),
    lump: null,
  };
}
