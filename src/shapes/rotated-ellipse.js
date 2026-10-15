import { clamp, radians, rotate } from '../util.js';

export class RotatedEllipse {
  constructor(ctx, x, y, rx, ry, angle) {
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.rx = rx;
    this.ry = ry;
    this.angle = angle;
  }

  static random(ctx) {
    const rnd = ctx.rnd;
    const x = rnd.float() * ctx.width;
    const y = rnd.float() * ctx.height;
    const rx = rnd.float() * 32 + 1;
    const ry = rnd.float() * 32 + 1;
    const a = rnd.float() * 360;
    return new RotatedEllipse(ctx, x, y, rx, ry, a);
  }

  copy() {
    return new RotatedEllipse(this.ctx, this.x, this.y, this.rx, this.ry, this.angle);
  }

  mutate() {
    const { width: w, height: h, rnd } = this.ctx;
    switch (rnd.intn(3)) {
      case 0:
        this.x = clamp(this.x + rnd.norm() * 16, 0, w - 1);
        this.y = clamp(this.y + rnd.norm() * 16, 0, h - 1);
        break;
      case 1:
        this.rx = clamp(this.rx + rnd.norm() * 16, 1, w - 1);
        this.ry = clamp(this.ry + rnd.norm() * 16, 1, h - 1);
        break;
      case 2:
        this.angle = this.angle + rnd.norm() * 32;
        break;
    }
  }

  rasterize(lines) {
    return this.ctx.rasterizer.fill(this.paths(), lines);
  }

  paths(detail = 1) {
    const segments = Math.max(32, Math.min(360, Math.ceil(Math.max(this.rx, this.ry) * detail)));
    const theta = radians(this.angle);
    const p = new Array(segments * 2);
    for (let i = 0; i < segments; i++) {
      const a = (i / segments) * 2 * Math.PI;
      const [px, py] = rotate(this.rx * Math.cos(a), this.ry * Math.sin(a), theta);
      p[i * 2] = px + this.x;
      p[i * 2 + 1] = py + this.y;
    }
    return [p];
  }

  svg(attrs) {
    const f = (v) => v.toFixed(6);
    return `<g transform="translate(${f(this.x)} ${f(this.y)}) rotate(${f(this.angle)}) scale(${f(this.rx)} ${f(this.ry)})"><ellipse ${attrs} cx="0" cy="0" rx="1" ry="1" /></g>`;
  }

  toJSON() {
    const { x, y, rx, ry, angle } = this;
    return { type: 'rotated-ellipse', x, y, rx, ry, angle };
  }

  static fromJSON(ctx, o) {
    return new RotatedEllipse(ctx, o.x, o.y, o.rx, o.ry, o.angle);
  }
}
