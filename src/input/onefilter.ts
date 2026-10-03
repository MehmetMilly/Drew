// 1€ filter (Casiez et al.): fast flicks stay sharp, slow wobbles are calmed.
const alpha = (cutoff: number, dt: number) => {
  const tau = 1 / (2 * Math.PI * cutoff);
  return 1 / (1 + tau / dt);
};

export class OneEuro {
  private x: number | null = null;
  private dx = 0;
  constructor(
    private minCutoff: number,
    private beta: number,
    private dCutoff = 1,
  ) {}
  reset() {
    this.x = null;
    this.dx = 0;
  }
  filter(v: number, dt: number): number {
    if (this.x === null || dt <= 0) {
      this.x = v;
      return v;
    }
    const d = (v - this.x) / dt;
    this.dx += alpha(this.dCutoff, dt) * (d - this.dx);
    const cutoff = this.minCutoff + this.beta * Math.abs(this.dx);
    this.x += alpha(cutoff, dt) * (v - this.x);
    return this.x;
  }
}
