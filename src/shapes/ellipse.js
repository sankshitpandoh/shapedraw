import { clamp } from '../util.js';
import { circlePath } from '../raster.js';

export class Ellipse {
  constructor(ctx, x, y, rx, ry, circle = false) {
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.rx = rx;
    this.ry = ry;
    this.circle = circle;
  }

  static random(ctx) {
    const rnd = ctx.rnd;
    const x = rnd.intn(ctx.width);
    const y = rnd.intn(ctx.height);
    const rx = rnd.intn(32) + 1;
    const ry = rnd.intn(32) + 1;
    return new Ellipse(ctx, x, y, rx, ry, false);
  }

  static randomCircle(ctx) {
    const rnd = ctx.rnd;
    const x = rnd.intn(ctx.width);
    const y = rnd.intn(ctx.height);
    const r = rnd.intn(32) + 1;
    return new Ellipse(ctx, x, y, r, r, true);
  }

  copy() {
    return new Ellipse(this.ctx, this.x, this.y, this.rx, this.ry, this.circle);
  }

  mutate() {
    const { width: w, height: h, rnd } = this.ctx;
    switch (rnd.intn(3)) {
      case 0:
        this.x = clamp(this.x + Math.trunc(rnd.norm() * 16), 0, w - 1);
        this.y = clamp(this.y + Math.trunc(rnd.norm() * 16), 0, h - 1);
        break;
      case 1:
        this.rx = clamp(this.rx + Math.trunc(rnd.norm() * 16), 1, w - 1);
        if (this.circle) this.ry = this.rx;
        break;
      case 2:
        this.ry = clamp(this.ry + Math.trunc(rnd.norm() * 16), 1, h - 1);
        if (this.circle) this.rx = this.ry;
        break;
    }
  }

  rasterize(lines) {
    lines.clear();
    const { width: w, height: h } = this.ctx;
    const { x, y, rx, ry } = this;
    const aspect = rx / ry;
    for (let dy = 0; dy < ry; dy++) {
      const y1 = y - dy;
      const y2 = y + dy;
      if ((y1 < 0 || y1 >= h) && (y2 < 0 || y2 >= h)) continue;
      const s = Math.trunc(Math.sqrt(ry * ry - dy * dy) * aspect);
      const x1 = Math.max(x - s, 0);
      const x2 = Math.min(x + s, w - 1);
      if (y1 >= 0 && y1 < h) lines.push(y1, x1, x2, 0xffff);
      if (y2 >= 0 && y2 < h && dy > 0) lines.push(y2, x1, x2, 0xffff);
    }
    return lines;
  }

  paths(detail = 1) {
    const segments = Math.max(24, Math.min(360, Math.ceil(Math.max(this.rx, this.ry) * detail)));
    const p = circlePath(0, 0, 1, segments);
    for (let i = 0; i < p.length; i += 2) {
      p[i] = this.x + p[i] * this.rx;
      p[i + 1] = this.y + p[i + 1] * this.ry;
    }
    return [p];
  }

  svg(attrs) {
    return `<ellipse ${attrs} cx="${this.x}" cy="${this.y}" rx="${this.rx}" ry="${this.ry}" />`;
  }

  toJSON() {
    const { x, y, rx, ry, circle } = this;
    return { type: circle ? 'circle' : 'ellipse', x, y, rx, ry };
  }

  static fromJSON(ctx, o) {
    return new Ellipse(ctx, o.x, o.y, o.rx, o.ry, o.type === 'circle');
  }
}
