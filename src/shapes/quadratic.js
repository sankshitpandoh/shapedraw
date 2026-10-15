import { clamp } from '../util.js';
import { flattenQuadratic, strokePolyline } from '../raster.js';

// A quadratic bezier curve drawn as a stroked line.
export class Quadratic {
  constructor(ctx, x1, y1, x2, y2, x3, y3, width) {
    this.ctx = ctx;
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.x3 = x3;
    this.y3 = y3;
    this.width = width;
  }

  static random(ctx) {
    const rnd = ctx.rnd;
    const x1 = rnd.float() * ctx.width;
    const y1 = rnd.float() * ctx.height;
    const x2 = x1 + rnd.float() * 40 - 20;
    const y2 = y1 + rnd.float() * 40 - 20;
    const x3 = x2 + rnd.float() * 40 - 20;
    const y3 = y2 + rnd.float() * 40 - 20;
    const q = new Quadratic(ctx, x1, y1, x2, y2, x3, y3, 0.5);
    q.mutate();
    return q;
  }

  copy() {
    const { ctx, x1, y1, x2, y2, x3, y3, width } = this;
    return new Quadratic(ctx, x1, y1, x2, y2, x3, y3, width);
  }

  mutate() {
    const { width: w, height: h, rnd } = this.ctx;
    const m = 16;
    const sx = (v) => clamp(v + rnd.norm() * 16, -m, w - 1 + m);
    const sy = (v) => clamp(v + rnd.norm() * 16, -m, h - 1 + m);
    for (;;) {
      // The Go version picks from 3 cases, so its width mutation (case 3) never
      // runs and every curve keeps the initial 0.5px width. Kept for parity.
      switch (rnd.intn(3)) {
        case 0:
          this.x1 = sx(this.x1);
          this.y1 = sy(this.y1);
          break;
        case 1:
          this.x2 = sx(this.x2);
          this.y2 = sy(this.y2);
          break;
        case 2:
          this.x3 = sx(this.x3);
          this.y3 = sy(this.y3);
          break;
      }
      if (this.valid()) break;
    }
  }

  // The endpoints must be further apart than either is from the control point.
  valid() {
    const dx12 = Math.trunc(this.x1 - this.x2), dy12 = Math.trunc(this.y1 - this.y2);
    const dx23 = Math.trunc(this.x2 - this.x3), dy23 = Math.trunc(this.y2 - this.y3);
    const dx13 = Math.trunc(this.x1 - this.x3), dy13 = Math.trunc(this.y1 - this.y3);
    const d12 = dx12 * dx12 + dy12 * dy12;
    const d23 = dx23 * dx23 + dy23 * dy23;
    const d13 = dx13 * dx13 + dy13 * dy13;
    return d13 > d12 && d13 > d23;
  }

  rasterize(lines) {
    return this.ctx.rasterizer.fill(this.paths(), lines);
  }

  paths(detail = 1) {
    const { x1, y1, x2, y2, x3, y3 } = this;
    const length = Math.hypot(x2 - x1, y2 - y1) + Math.hypot(x3 - x2, y3 - y2);
    const steps = Math.max(4, Math.min(256, Math.ceil((length * detail) / 4)));
    return strokePolyline(flattenQuadratic(x1, y1, x2, y2, x3, y3, steps), this.width, detail);
  }

  svg(attrs) {
    const f = (v) => v.toFixed(6);
    attrs = attrs.replaceAll('fill', 'stroke');
    return `<path ${attrs} fill="none" d="M ${f(this.x1)} ${f(this.y1)} Q ${f(this.x2)} ${f(this.y2)}, ${f(this.x3)} ${f(this.y3)}" stroke-width="${f(this.width)}" />`;
  }

  toJSON() {
    const { x1, y1, x2, y2, x3, y3, width } = this;
    return { type: 'quadratic', x1, y1, x2, y2, x3, y3, width };
  }

  static fromJSON(ctx, o) {
    return new Quadratic(ctx, o.x1, o.y1, o.x2, o.y2, o.x3, o.y3, o.width);
  }
}
