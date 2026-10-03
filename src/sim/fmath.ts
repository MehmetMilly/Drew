// Deterministic transcendental functions for the simulation. V8 builds differ in
// the last ulp of Math.atan2 (Node vs Chromium), which breaks replay determinism.
// These use only + − × ÷ and sqrt, which IEEE 754 makes exact everywhere.

const PI = 3.141592653589793;
const HALF_PI = 1.5707963267948966;
const TWO_PI = 6.283185307179586;

export const hypot = (x: number, y: number) => Math.sqrt(x * x + y * y);

/** atan on [-1, 1] with argument halving; error < 1e-12. */
function atanSmall(z: number): number {
  // reduce: atan(z) = 2·atan(z / (1 + sqrt(1 + z²)))
  const z1 = z / (1 + Math.sqrt(1 + z * z));
  const z2 = z1 / (1 + Math.sqrt(1 + z1 * z1)); // |z2| ≤ tan(π/16) ≈ 0.199
  const s = z2 * z2;
  // Taylor series to z^23
  let t = 1 / 23;
  t = 1 / 21 - s * t;
  t = 1 / 19 - s * t;
  t = 1 / 17 - s * t;
  t = 1 / 15 - s * t;
  t = 1 / 13 - s * t;
  t = 1 / 11 - s * t;
  t = 1 / 9 - s * t;
  t = 1 / 7 - s * t;
  t = 1 / 5 - s * t;
  t = 1 / 3 - s * t;
  t = 1 - s * t;
  return 4 * z2 * t;
}

export function atan(z: number): number {
  if (z > 1) return HALF_PI - atanSmall(1 / z);
  if (z < -1) return -HALF_PI - atanSmall(1 / z);
  return atanSmall(z);
}

export function atan2(y: number, x: number): number {
  if (x > 0) return atan(y / x);
  if (x < 0) return y >= 0 ? atan(y / x) + PI : atan(y / x) - PI;
  if (y > 0) return HALF_PI;
  if (y < 0) return -HALF_PI;
  return 0;
}

function sinPoly(x: number) {
  // |x| ≤ π/4
  const s = x * x;
  return x * (1 + s * (-1 / 6 + s * (1 / 120 + s * (-1 / 5040 + s * (1 / 362880 + s * (-1 / 39916800 + s * (1 / 6227020800)))))));
}
function cosPoly(x: number) {
  const s = x * x;
  return 1 + s * (-1 / 2 + s * (1 / 24 + s * (-1 / 720 + s * (1 / 40320 + s * (-1 / 3628800 + s * (1 / 479001600 + s * (-1 / 87178291200)))))));
}

export function sin(x: number): number {
  if (!isFinite(x)) return NaN;
  const k = Math.round(x / HALF_PI);
  const r = x - k * HALF_PI; // |r| ≤ π/4 (+tiny)
  switch (((k % 4) + 4) % 4) {
    case 0:
      return sinPoly(r);
    case 1:
      return cosPoly(r);
    case 2:
      return -sinPoly(r);
    default:
      return -cosPoly(r);
  }
}

export function cos(x: number): number {
  return sin(x + HALF_PI);
}

export function exp(x: number): number {
  // e^x = 2^k · e^r, |r| ≤ ln2/2
  const LN2 = 0.6931471805599453;
  const k = Math.round(x / LN2);
  const r = x - k * LN2;
  let t = 1,
    sum = 1;
  for (let i = 1; i < 18; i++) {
    t *= r / i;
    sum += t;
  }
  let p = 1;
  let kk = Math.abs(k);
  let base = 2;
  while (kk) {
    if (kk & 1) p *= base;
    base *= base;
    kk >>= 1;
  }
  return k >= 0 ? sum * p : sum / p;
}

export function log(x: number): number {
  if (!(x > 0)) return NaN;
  // x = m · 2^e with m in [0.75, 1.5)
  let e = 0;
  while (x >= 1.5) {
    x /= 2;
    e++;
  }
  while (x < 0.75) {
    x *= 2;
    e--;
  }
  // log(m) = 2·atanh((m−1)/(m+1))
  const z = (x - 1) / (x + 1);
  const s = z * z;
  let t = 0,
    pz = z;
  for (let i = 1; i < 40; i += 2) {
    t += pz / i;
    pz *= s;
  }
  return 2 * t + e * 0.6931471805599453;
}

export const pow = (x: number, y: number) => (x === 0 ? 0 : exp(y * log(x)));

export { PI, TWO_PI, HALF_PI };
