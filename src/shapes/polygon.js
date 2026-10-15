import { clamp } from '../util.js';

export class Polygon {
  constructor(ctx, order, convex, xs, ys) {
    this.ctx = ctx;
    this.order = order;
    this.convex = convex;
    this.xs = xs;
    this.ys = ys;
  }

  static random(ctx, order = 4, convex = false) {
    const rnd = ctx.rnd;
    const xs = new Array(order);
    const ys = new Array(order);
    xs[0] = rnd.float() * ctx.width;
    ys[0] = rnd.float() * ctx.height;
    for (let i = 1; i < order; i++) {
      xs[i] = xs[0] + rnd.float() * 40 - 20;
      ys[i] = ys[0] + rnd.float() * 40 - 20;
    }
    const p = new Polygon(ctx, order, convex, xs, ys);
    p.mutate();
    return p;
  }

  copy() {
    return new Polygon(this.ctx, this.order, this.convex, this.xs.slice(), this.ys.slice());
  }

  mutate() {
    const { width: w, height: h, rnd } = this.ctx;
    const m = 16;
    const { xs, ys, order } = this;
    for (;;) {
      if (rnd.float() < 0.25) {
        const i = rnd.intn(order);
        const j = rnd.intn(order);
        [xs[i], ys[i], xs[j], ys[j]] = [xs[j], ys[j], xs[i], ys[i]];
      } else {
        const i = rnd.intn(order);
        xs[i] = clamp(xs[i] + rnd.norm() * 16, -m, w - 1 + m);
        ys[i] = clamp(ys[i] + rnd.norm() * 16, -m, h - 1 + m);
      }
      if (this.valid()) break;
    }
  }

  valid() {
    if (!this.convex) return true;
    const { xs, ys, order } = this;
    let sign = false;
    for (let a = 0; a < order; a++) {
      const i = a % order, j = (a + 1) % order, k = (a + 2) % order;
      const c = (xs[j] - xs[i]) * (ys[k] - ys[j]) - (ys[j] - ys[i]) * (xs[k] - xs[j]);
      if (a === 0) sign = c > 0;
      else if (c > 0 !== sign) return false;
    }
    return true;
  }

  rasterize(lines) {
    return this.ctx.rasterizer.fill(this.paths(), lines);
  }

  paths() {
    const p = [];
    for (let i = 0; i < this.order; i++) p.push(this.xs[i], this.ys[i]);
    return [p];
  }

  svg(attrs) {
    const points = this.xs.map((x, i) => `${x.toFixed(6)},${this.ys[i].toFixed(6)}`);
    return `<polygon ${attrs} points="${points.join(',')}" />`;
  }

  toJSON() {
    return { type: 'polygon', convex: this.convex, xs: this.xs.slice(), ys: this.ys.slice() };
  }

  static fromJSON(ctx, o) {
    return new Polygon(ctx, o.xs.length, o.convex, o.xs.slice(), o.ys.slice());
  }
}
