// Structure-of-arrays stores for particles and constraints. Slots are never
// reused within a world, so render skins can hold ids safely; a world is rebuilt
// per attempt. `alive` counts live particles for the 900-particle budget.

export const PF = {
  GROUND: 1, // touching terrain this substep
  SOFT: 2, // being driven by an actuator (shape weight drops)
  LOOP: 4,
  LUMP: 8,
  LUMPC: 16, // lump centre
  PINNED: 32, // stance foot: horizontal velocity zeroed on contact
  ALIVE: 64,
  GUY: 128, // Little Guy particle
} as const;

export class Particles {
  readonly cap: number;
  n = 0; // high-water mark
  x: Float64Array;
  y: Float64Array;
  px: Float64Array;
  py: Float64Array;
  // render snapshot from the start of the last step (for interpolation)
  sx: Float64Array;
  sy: Float64Array;
  // drawn rest position (creature rest frame = drawing coordinates)
  rx: Float64Array;
  ry: Float64Array;
  m: Float64Array;
  im: Float64Array;
  w: Float64Array; // shape matching weight
  fr: Float64Array; // extra friction multiplier
  nx: Float64Array; // last contact normal
  ny: Float64Array;
  owner: Int32Array; // creature id, -1 = none
  tag: Int32Array; // loop/lump index within the creature build, -1 none
  stroke: Int32Array; // source stroke index within the creature build
  flags: Uint16Array;
  alive = 0;

  constructor(cap: number) {
    this.cap = cap;
    const f = () => new Float64Array(cap);
    this.x = f();
    this.y = f();
    this.px = f();
    this.py = f();
    this.sx = f();
    this.sy = f();
    this.rx = f();
    this.ry = f();
    this.m = f();
    this.im = f();
    this.w = f();
    this.fr = f();
    this.nx = f();
    this.ny = f();
    this.owner = new Int32Array(cap).fill(-1);
    this.tag = new Int32Array(cap).fill(-1);
    this.stroke = new Int32Array(cap).fill(-1);
    this.flags = new Uint16Array(cap);
  }

  get available() {
    return this.cap - this.n;
  }

  add(x: number, y: number, mass: number): number {
    if (this.n >= this.cap) throw new Error('particle capacity');
    const i = this.n++;
    this.x[i] = this.px[i] = this.sx[i] = this.rx[i] = x;
    this.y[i] = this.py[i] = this.sy[i] = this.ry[i] = y;
    this.m[i] = mass;
    this.im[i] = mass > 0 ? 1 / mass : 0;
    this.w[i] = 1;
    this.fr[i] = 1;
    this.nx[i] = this.ny[i] = 0;
    this.owner[i] = -1;
    this.tag[i] = -1;
    this.stroke[i] = -1;
    this.flags[i] = PF.ALIVE;
    this.alive++;
    return i;
  }

  remove(i: number) {
    if (!(this.flags[i] & PF.ALIVE)) return;
    this.flags[i] = 0;
    this.owner[i] = -1;
    this.alive--;
  }

  isAlive(i: number) {
    return (this.flags[i] & PF.ALIVE) !== 0;
  }
}

export const CT = {
  LINK: 0,
  BEND: 1,
  WELD: 2,
  SPRING: 3,
  LUMP: 4, // lump ring / spokes (structural, stiff)
  GRAB: 5, // temporary hand-to-thing
  JOINT: 6, // part-to-part join inside a stroke
} as const;
export type CType = (typeof CT)[keyof typeof CT];

export const STRUCTURAL = (t: number) => t !== CT.BEND && t !== CT.GRAB;

export class Constraints {
  readonly cap: number;
  n = 0;
  a: Int32Array;
  b: Int32Array;
  rest: Float64Array;
  rest0: Float64Array; // original rest (springs actuate `rest`)
  k: Float64Array;
  type: Uint8Array;
  dead: Uint8Array; // 1 = broken/removed
  strain: Float32Array; // last measured stretch ratio - 1

  constructor(cap: number) {
    this.cap = cap;
    this.a = new Int32Array(cap);
    this.b = new Int32Array(cap);
    this.rest = new Float64Array(cap);
    this.rest0 = new Float64Array(cap);
    this.k = new Float64Array(cap);
    this.type = new Uint8Array(cap);
    this.dead = new Uint8Array(cap).fill(1);
    this.strain = new Float32Array(cap);
  }

  add(a: number, b: number, rest: number, k: number, type: number): number {
    if (this.n >= this.cap) throw new Error('constraint capacity');
    const i = this.n++;
    this.a[i] = a;
    this.b[i] = b;
    this.rest[i] = this.rest0[i] = rest;
    this.k[i] = k;
    this.type[i] = type;
    this.dead[i] = 0;
    this.strain[i] = 0;
    return i;
  }

  remove(i: number) {
    if (this.dead[i]) return;
    this.dead[i] = 1;
  }
}
