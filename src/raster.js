// Anti-aliased polygon rasterizer producing Scanlines.
//
// The Go version leans on github.com/golang/freetype/raster for curved and
// free-form shapes. This is a self-contained replacement using the signed-area
// accumulation technique (as in font-rs): every edge deposits its coverage
// into a buffer, and a running sum along each row gives per-pixel coverage.
// Taking |sum| clamped to 1 gives non-zero winding, so overlapping sub-paths
// (e.g. the pieces of a stroke) union cleanly as long as they share the same
// orientation.

export class Rasterizer {
  constructor(width, height) {
    this.width = width;
    this.height = height;
    this.acc = new Float32Array((width + 2) * (height + 1));
  }

  // paths: array of closed polygons, each a flat [x0, y0, x1, y1, ...] array
  // in pixel coordinates (pixel (x, y) covers [x, x+1) x [y, y+1)).
  fill(paths, lines) {
    lines.clear();
    let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
    for (const p of paths) {
      for (let i = 0; i < p.length; i += 2) {
        const x = p[i], y = p[i + 1];
        if (x < minx) minx = x;
        if (x > maxx) maxx = x;
        if (y < miny) miny = y;
        if (y > maxy) maxy = y;
      }
    }
    const x0 = Math.max(0, Math.floor(minx));
    const y0 = Math.max(0, Math.floor(miny));
    const x1 = Math.min(this.width, Math.ceil(maxx));
    const y1 = Math.min(this.height, Math.ceil(maxy));
    if (!(x1 > x0 && y1 > y0)) return lines;
    // Edges left of the clip box still matter (they cover everything to their
    // right), so x0 must stay at the true left edge when the shape spills off.
    const bw = x1 - x0;
    const bh = y1 - y0;
    const stride = bw + 2;
    for (const p of paths) {
      const n = p.length;
      for (let i = 0; i < n; i += 2) {
        const j = (i + 2) % n;
        this.edge(p[i] - x0, p[i + 1] - y0, p[j] - x0, p[j + 1] - y0, bw, bh, stride);
      }
    }
    this.collect(x0, y0, bw, bh, stride, lines);
    return lines;
  }

  // Clip an edge to 0 <= x <= bw. Portions left of the box become vertical
  // edges at x = 0 (they still cover the whole row); portions right of it
  // become vertical edges at x = bw, which fall outside the summed columns.
  edge(ax, ay, bx, by, bw, bh, stride) {
    if (ay === by) return;
    let t1 = -1, t2 = -1;
    const dx = bx - ax;
    if (ax < 0 !== bx < 0) t1 = -ax / dx;
    if (ax > bw !== bx > bw) t2 = (bw - ax) / dx;
    if (t1 > t2) {
      const t = t1;
      t1 = t2;
      t2 = t;
    }
    const dy = by - ay;
    let px = ax, py = ay;
    if (t1 >= 0) {
      const qx = ax + dx * t1, qy = ay + dy * t1;
      this.segment(clampX(px, bw), py, clampX(qx, bw), qy, bh, stride);
      px = qx;
      py = qy;
    }
    if (t2 >= 0) {
      const qx = ax + dx * t2, qy = ay + dy * t2;
      this.segment(clampX(px, bw), py, clampX(qx, bw), qy, bh, stride);
      px = qx;
      py = qy;
    }
    this.segment(clampX(px, bw), py, clampX(bx, bw), by, bh, stride);
  }

  segment(x0, y0, x1, y1, bh, stride) {
    if (y0 === y1) return;
    let dir = 1;
    if (y0 > y1) {
      dir = -1;
      let t = x0;
      x0 = x1;
      x1 = t;
      t = y0;
      y0 = y1;
      y1 = t;
    }
    if (y1 <= 0 || y0 >= bh) return;
    const dxdy = (x1 - x0) / (y1 - y0);
    let x = x0;
    if (y0 < 0) {
      x -= y0 * dxdy;
      y0 = 0;
    }
    if (y1 > bh) y1 = bh;
    const acc = this.acc;
    const yEnd = Math.ceil(y1);
    for (let y = Math.floor(y0); y < yEnd; y++) {
      const ls = y * stride;
      const dy = Math.min(y + 1, y1) - Math.max(y, y0);
      const xnext = x + dxdy * dy;
      const d = dy * dir;
      let xa = x, xb = xnext;
      if (xa > xb) {
        xa = xnext;
        xb = x;
      }
      const xaf = Math.floor(xa);
      const xbc = Math.ceil(xb);
      if (xbc <= xaf + 1) {
        const xmf = 0.5 * (x + xnext) - xaf;
        acc[ls + xaf] += d - d * xmf;
        acc[ls + xaf + 1] += d * xmf;
      } else {
        const s = 1 / (xb - xa);
        const x0f = xa - xaf;
        const a0 = 0.5 * s * (1 - x0f) * (1 - x0f);
        const x1f = xb - xbc + 1;
        const am = 0.5 * s * x1f * x1f;
        acc[ls + xaf] += d * a0;
        if (xbc === xaf + 2) {
          acc[ls + xaf + 1] += d * (1 - a0 - am);
        } else {
          const a1 = s * (1.5 - x0f);
          acc[ls + xaf + 1] += d * (a1 - a0);
          for (let xi = xaf + 2; xi < xbc - 1; xi++) acc[ls + xi] += d * s;
          const a2 = a1 + (xbc - xaf - 3) * s;
          acc[ls + xbc - 1] += d * (1 - a2 - am);
        }
        acc[ls + xbc] += d * am;
      }
      x = xnext;
    }
  }

  // Turn accumulated coverage into scanlines, merging runs of equal alpha,
  // and reset the touched part of the buffer.
  collect(x0, y0, bw, bh, stride, lines) {
    const acc = this.acc;
    for (let r = 0; r < bh; r++) {
      const ls = r * stride;
      let sum = 0;
      let runStart = 0;
      let runAlpha = 0;
      for (let c = 0; c < bw; c++) {
        sum += acc[ls + c];
        acc[ls + c] = 0;
        const cov = sum < 0 ? -sum : sum;
        const alpha = cov >= 0.9999 ? 0xffff : cov < 0.0001 ? 0 : Math.round(cov * 0xffff);
        if (alpha !== runAlpha) {
          if (runAlpha) lines.push(y0 + r, x0 + runStart, x0 + c - 1, runAlpha);
          runStart = c;
          runAlpha = alpha;
        }
      }
      if (runAlpha) lines.push(y0 + r, x0 + runStart, x0 + bw - 1, runAlpha);
      acc[ls + bw] = 0;
      acc[ls + bw + 1] = 0;
    }
  }
}

function clampX(x, bw) {
  return x < 0 ? 0 : x > bw ? bw : x;
}

// Signed area, used to give every sub-path the same orientation.
export function orient(path) {
  let area = 0;
  const n = path.length;
  for (let i = 0; i < n; i += 2) {
    const j = (i + 2) % n;
    area += path[i] * path[j + 1] - path[j] * path[i + 1];
  }
  if (area < 0) {
    for (let i = 0, j = n - 2; i < j; i += 2, j -= 2) {
      let t = path[i];
      path[i] = path[j];
      path[j] = t;
      t = path[i + 1];
      path[i + 1] = path[j + 1];
      path[j + 1] = t;
    }
  }
  return path;
}

export function circlePath(cx, cy, r, segments) {
  const p = new Array(segments * 2);
  for (let i = 0; i < segments; i++) {
    const a = (i / segments) * 2 * Math.PI;
    p[i * 2] = cx + r * Math.cos(a);
    p[i * 2 + 1] = cy + r * Math.sin(a);
  }
  return p;
}

// Outline of a polyline stroked with round caps and joins, as a set of
// same-orientation polygons: one quad per segment plus a disc per vertex.
export function strokePolyline(points, width, detail = 1) {
  const hw = width / 2;
  const segments = Math.max(8, Math.min(64, Math.ceil(hw * detail * 2)));
  const paths = [];
  for (let i = 0; i < points.length; i += 2) {
    paths.push(orient(circlePath(points[i], points[i + 1], hw, segments)));
  }
  for (let i = 0; i + 3 < points.length; i += 2) {
    const ax = points[i], ay = points[i + 1];
    const bx = points[i + 2], by = points[i + 3];
    const dx = bx - ax, dy = by - ay;
    const len = Math.hypot(dx, dy);
    if (len === 0) continue;
    const nx = (-dy / len) * hw, ny = (dx / len) * hw;
    paths.push(orient([ax + nx, ay + ny, bx + nx, by + ny, bx - nx, by - ny, ax - nx, ay - ny]));
  }
  return paths;
}

export function flattenQuadratic(x1, y1, x2, y2, x3, y3, steps) {
  const pts = new Array((steps + 1) * 2);
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const u = 1 - t;
    pts[i * 2] = u * u * x1 + 2 * u * t * x2 + t * t * x3;
    pts[i * 2 + 1] = u * u * y1 + 2 * u * t * y2 + t * t * y3;
  }
  return pts;
}
