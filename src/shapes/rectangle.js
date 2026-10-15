import { clamp } from '../util.js';

export class Rectangle {
  constructor(ctx, x1, y1, x2, y2) {
    this.ctx = ctx;
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
  }

  static random(ctx) {
    const rnd = ctx.rnd;
    const x1 = rnd.intn(ctx.width);
    const y1 = rnd.intn(ctx.height);
    const x2 = clamp(x1 + rnd.intn(32) + 1, 0, ctx.width - 1);
    const y2 = clamp(y1 + rnd.intn(32) + 1, 0, ctx.height - 1);
    return new Rectangle(ctx, x1, y1, x2, y2);
  }

  bounds() {
    return [
      Math.min(this.x1, this.x2),
      Math.min(this.y1, this.y2),
      Math.max(this.x1, this.x2),
      Math.max(this.y1, this.y2),
    ];
  }

  copy() {
    return new Rectangle(this.ctx, this.x1, this.y1, this.x2, this.y2);
  }

  mutate() {
    const { width: w, height: h, rnd } = this.ctx;
    if (rnd.intn(2) === 0) {
      this.x1 = clamp(this.x1 + Math.trunc(rnd.norm() * 16), 0, w - 1);
      this.y1 = clamp(this.y1 + Math.trunc(rnd.norm() * 16), 0, h - 1);
    } else {
      this.x2 = clamp(this.x2 + Math.trunc(rnd.norm() * 16), 0, w - 1);
      this.y2 = clamp(this.y2 + Math.trunc(rnd.norm() * 16), 0, h - 1);
    }
  }

  rasterize(lines) {
    lines.clear();
    const [x1, y1, x2, y2] = this.bounds();
    for (let y = y1; y <= y2; y++) lines.push(y, x1, x2, 0xffff);
    return lines;
  }

  paths() {
    const [x1, y1, x2, y2] = this.bounds();
    return [[x1, y1, x2 + 1, y1, x2 + 1, y2 + 1, x1, y2 + 1]];
  }

  svg(attrs) {
    const [x1, y1, x2, y2] = this.bounds();
    return `<rect ${attrs} x="${x1}" y="${y1}" width="${x2 - x1 + 1}" height="${y2 - y1 + 1}" />`;
  }

  toJSON() {
    const { x1, y1, x2, y2 } = this;
    return { type: 'rectangle', x1, y1, x2, y2 };
  }

  static fromJSON(ctx, o) {
    return new Rectangle(ctx, o.x1, o.y1, o.x2, o.y2);
  }
}
