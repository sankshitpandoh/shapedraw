import { degrees } from '../util.js';

export class Triangle {
  constructor(ctx, x1, y1, x2, y2, x3, y3) {
    this.ctx = ctx;
    this.x1 = x1;
    this.y1 = y1;
    this.x2 = x2;
    this.y2 = y2;
    this.x3 = x3;
    this.y3 = y3;
  }

  static random(ctx) {
    const rnd = ctx.rnd;
    const x1 = rnd.intn(ctx.width);
    const y1 = rnd.intn(ctx.height);
    const x2 = x1 + rnd.intn(31) - 15;
    const y2 = y1 + rnd.intn(31) - 15;
    const x3 = x1 + rnd.intn(31) - 15;
    const y3 = y1 + rnd.intn(31) - 15;
    const t = new Triangle(ctx, x1, y1, x2, y2, x3, y3);
    t.mutate();
    return t;
  }

  copy() {
    return new Triangle(this.ctx, this.x1, this.y1, this.x2, this.y2, this.x3, this.y3);
  }

  mutate() {
    const { width: w, height: h, rnd } = this.ctx;
    const m = 16;
    const step = (v, hi) => Math.max(-m, Math.min(hi - 1 + m, v + Math.trunc(rnd.norm() * 16)));
    for (;;) {
      switch (rnd.intn(3)) {
        case 0:
          this.x1 = step(this.x1, w);
          this.y1 = step(this.y1, h);
          break;
        case 1:
          this.x2 = step(this.x2, w);
          this.y2 = step(this.y2, h);
          break;
        case 2:
          this.x3 = step(this.x3, w);
          this.y3 = step(this.y3, h);
          break;
      }
      if (this.valid()) break;
    }
  }

  // Reject slivers: every interior angle must exceed 15 degrees.
  valid() {
    const minDegrees = 15;
    const angle = (ax, ay, bx, by, cx, cy) => {
      let x1 = bx - ax, y1 = by - ay, x2 = cx - ax, y2 = cy - ay;
      const d1 = Math.sqrt(x1 * x1 + y1 * y1);
      const d2 = Math.sqrt(x2 * x2 + y2 * y2);
      x1 /= d1;
      y1 /= d1;
      x2 /= d2;
      y2 /= d2;
      return degrees(Math.acos(x1 * x2 + y1 * y2));
    };
    const a1 = angle(this.x1, this.y1, this.x2, this.y2, this.x3, this.y3);
    const a2 = angle(this.x2, this.y2, this.x1, this.y1, this.x3, this.y3);
    const a3 = 180 - a1 - a2;
    return a1 > minDegrees && a2 > minDegrees && a3 > minDegrees;
  }

  rasterize(lines) {
    lines.clear();
    rasterizeTriangle(this.x1, this.y1, this.x2, this.y2, this.x3, this.y3, lines);
    return lines.crop(this.ctx.width, this.ctx.height);
  }

  paths() {
    return [[this.x1, this.y1, this.x2, this.y2, this.x3, this.y3]];
  }

  svg(attrs) {
    return `<polygon ${attrs} points="${this.x1},${this.y1} ${this.x2},${this.y2} ${this.x3},${this.y3}" />`;
  }

  toJSON() {
    const { x1, y1, x2, y2, x3, y3 } = this;
    return { type: 'triangle', x1, y1, x2, y2, x3, y3 };
  }

  static fromJSON(ctx, o) {
    return new Triangle(ctx, o.x1, o.y1, o.x2, o.y2, o.x3, o.y3);
  }
}

function rasterizeTriangle(x1, y1, x2, y2, x3, y3, lines) {
  let t;
  if (y1 > y3) {
    t = x1; x1 = x3; x3 = t;
    t = y1; y1 = y3; y3 = t;
  }
  if (y1 > y2) {
    t = x1; x1 = x2; x2 = t;
    t = y1; y1 = y2; y2 = t;
  }
  if (y2 > y3) {
    t = x2; x2 = x3; x3 = t;
    t = y2; y2 = y3; y3 = t;
  }
  if (y2 === y3) {
    rasterizeBottom(x1, y1, x2, y2, x3, y3, lines);
  } else if (y1 === y2) {
    rasterizeTop(x1, y1, x2, y2, x3, y3, lines);
  } else {
    const x4 = x1 + Math.trunc(((y2 - y1) / (y3 - y1)) * (x3 - x1));
    rasterizeBottom(x1, y1, x2, y2, x4, y2, lines);
    rasterizeTop(x2, y2, x4, y2, x3, y3, lines);
  }
}

function rasterizeBottom(x1, y1, x2, y2, x3, y3, lines) {
  const s1 = (x2 - x1) / (y2 - y1);
  const s2 = (x3 - x1) / (y3 - y1);
  let ax = x1, bx = x1;
  for (let y = y1; y <= y2; y++) {
    let a = Math.trunc(ax);
    let b = Math.trunc(bx);
    ax += s1;
    bx += s2;
    if (a > b) [a, b] = [b, a];
    lines.push(y, a, b, 0xffff);
  }
}

function rasterizeTop(x1, y1, x2, y2, x3, y3, lines) {
  const s1 = (x3 - x1) / (y3 - y1);
  const s2 = (x3 - x2) / (y3 - y2);
  let ax = x3, bx = x3;
  for (let y = y3; y > y1; y--) {
    ax -= s1;
    bx -= s2;
    let a = Math.trunc(ax);
    let b = Math.trunc(bx);
    if (a > b) [a, b] = [b, a];
    lines.push(y, a, b, 0xffff);
  }
}
