import { clamp, radians, rotate } from '../util.js';

export class RotatedRectangle {
  constructor(ctx, x, y, sx, sy, angle) {
    this.ctx = ctx;
    this.x = x;
    this.y = y;
    this.sx = sx;
    this.sy = sy;
    this.angle = angle;
  }

  static random(ctx) {
    const rnd = ctx.rnd;
    const x = rnd.intn(ctx.width);
    const y = rnd.intn(ctx.height);
    const sx = rnd.intn(32) + 1;
    const sy = rnd.intn(32) + 1;
    const a = rnd.intn(360);
    const r = new RotatedRectangle(ctx, x, y, sx, sy, a);
    r.mutate();
    return r;
  }

  copy() {
    return new RotatedRectangle(this.ctx, this.x, this.y, this.sx, this.sy, this.angle);
  }

  mutate() {
    const { width: w, height: h, rnd } = this.ctx;
    switch (rnd.intn(3)) {
      case 0:
        this.x = clamp(this.x + Math.trunc(rnd.norm() * 16), 0, w - 1);
        this.y = clamp(this.y + Math.trunc(rnd.norm() * 16), 0, h - 1);
        break;
      case 1:
        this.sx = clamp(this.sx + Math.trunc(rnd.norm() * 16), 1, w - 1);
        this.sy = clamp(this.sy + Math.trunc(rnd.norm() * 16), 1, h - 1);
        break;
      case 2:
        this.angle = this.angle + Math.trunc(rnd.norm() * 32);
        break;
    }
  }

  corners() {
    const { sx, sy } = this;
    const a = radians(this.angle);
    return [
      rotate(-sx / 2, -sy / 2, a),
      rotate(sx / 2, -sy / 2, a),
      rotate(sx / 2, sy / 2, a),
      rotate(-sx / 2, sy / 2, a),
    ];
  }

  // Same edge-walking scan conversion as the Go version.
  rasterize(lines) {
    lines.clear();
    const { width: w, height: h } = this.ctx;
    const xs = [], ys = [];
    for (const [rx, ry] of this.corners()) {
      xs.push(Math.trunc(rx) + this.x);
      ys.push(Math.trunc(ry) + this.y);
    }
    xs.push(xs[0]);
    ys.push(ys[0]);
    const miny = Math.min(ys[0], ys[1], ys[2], ys[3]);
    const maxy = Math.max(ys[0], ys[1], ys[2], ys[3]);
    const n = maxy - miny + 1;
    const min = new Int32Array(n).fill(w);
    const max = new Int32Array(n);
    for (let i = 0; i < 4; i++) {
      const x = xs[i], y = ys[i];
      const dx = xs[i + 1] - x, dy = ys[i + 1] - y;
      const count = Math.trunc(Math.sqrt(dx * dx + dy * dy)) * 2;
      for (let j = 0; j < count; j++) {
        const t = count > 1 ? j / (count - 1) : 0;
        const xi = Math.trunc(x + dx * t);
        const yi = Math.trunc(y + dy * t) - miny;
        if (xi < min[yi]) min[yi] = xi;
        if (xi > max[yi]) max[yi] = xi;
      }
    }
    for (let i = 0; i < n; i++) {
      const y = miny + i;
      if (y < 0 || y >= h) continue;
      const a = Math.max(min[i], 0);
      const b = Math.min(max[i], w - 1);
      if (b >= a) lines.push(y, a, b, 0xffff);
    }
    return lines;
  }

  paths() {
    const p = [];
    for (const [rx, ry] of this.corners()) p.push(rx + this.x, ry + this.y);
    return [p];
  }

  svg(attrs) {
    return `<g transform="translate(${this.x} ${this.y}) rotate(${this.angle}) scale(${this.sx} ${this.sy})"><rect ${attrs} x="-0.5" y="-0.5" width="1" height="1" /></g>`;
  }

  toJSON() {
    const { x, y, sx, sy, angle } = this;
    return { type: 'rotated-rectangle', x, y, sx, sy, angle };
  }

  static fromJSON(ctx, o) {
    return new RotatedRectangle(ctx, o.x, o.y, o.sx, o.sy, o.angle);
  }
}
