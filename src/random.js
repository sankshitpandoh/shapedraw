// Small seedable PRNG (mulberry32) with the helpers the algorithm needs.
// Mirrors the parts of Go's math/rand used by primitive.

export class Random {
  constructor(seed) {
    if (seed === undefined || seed === null) {
      seed = Math.floor(Math.random() * 4294967296);
    }
    this.state = seed >>> 0;
    this.spare = null;
  }

  // float in [0, 1)
  float() {
    let t = (this.state = (this.state + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  // integer in [0, n)
  intn(n) {
    return Math.floor(this.float() * n);
  }

  // standard normal distribution (Box-Muller)
  norm() {
    if (this.spare !== null) {
      const s = this.spare;
      this.spare = null;
      return s;
    }
    let u = 0;
    while (u === 0) u = this.float();
    const v = this.float();
    const r = Math.sqrt(-2 * Math.log(u));
    this.spare = r * Math.sin(2 * Math.PI * v);
    return r * Math.cos(2 * Math.PI * v);
  }
}
