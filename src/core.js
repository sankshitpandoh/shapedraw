// Pixel math shared by the search and the renderer. These are straight ports
// of primitive/core.go, including its integer rounding behaviour.

import { Color } from './color.js';
import { clamp } from './util.js';

// The color that, drawn with the given alpha over `current`, best matches
// `target` across the given scanlines.
export function computeColor(target, current, lines, alpha) {
  const t = target.data;
  const c = current.data;
  const w = target.width;
  const { ys, x1s, x2s } = lines;
  const a = Math.trunc((0x101 * 255) / alpha);
  let rsum = 0, gsum = 0, bsum = 0, count = 0;
  for (let k = 0; k < lines.length; k++) {
    let i = (ys[k] * w + x1s[k]) * 4;
    for (let x = x1s[k], x2 = x2s[k]; x <= x2; x++, i += 4) {
      const cr = c[i], cg = c[i + 1], cb = c[i + 2];
      rsum += (t[i] - cr) * a + cr * 0x101;
      gsum += (t[i + 1] - cg) * a + cg * 0x101;
      bsum += (t[i + 2] - cb) * a + cb * 0x101;
      count++;
    }
  }
  if (count === 0) return new Color(0, 0, 0, 0);
  const r = clamp(Math.trunc(rsum / count) >> 8, 0, 255);
  const g = clamp(Math.trunc(gsum / count) >> 8, 0, 255);
  const b = clamp(Math.trunc(bsum / count) >> 8, 0, 255);
  return new Color(r, g, b, alpha);
}

export function copyLines(dst, src, lines) {
  const w = dst.width;
  const { ys, x1s, x2s } = lines;
  for (let k = 0; k < lines.length; k++) {
    const a = (ys[k] * w + x1s[k]) * 4;
    const b = a + (x2s[k] - x1s[k] + 1) * 4;
    dst.data.set(src.data.subarray(a, b), a);
  }
}

// Composite a straight-alpha color over the image along the scanlines,
// scaling by each scanline's coverage alpha.
export function drawLines(im, color, lines) {
  const m = 0xffff;
  const d = im.data;
  const w = im.width;
  const sa = color.a * 0x101;
  const sr = Math.trunc((color.r * 0x101 * color.a) / 0xff);
  const sg = Math.trunc((color.g * 0x101 * color.a) / 0xff);
  const sb = Math.trunc((color.b * 0x101 * color.a) / 0xff);
  const { ys, x1s, x2s, alphas } = lines;
  for (let k = 0; k < lines.length; k++) {
    const ma = alphas[k];
    const a = (m - Math.trunc((sa * ma) / m)) * 0x101;
    let i = (ys[k] * w + x1s[k]) * 4;
    for (let x = x1s[k], x2 = x2s[k]; x <= x2; x++, i += 4) {
      // (x / m) >>> 8 truncates twice, matching Go's integer (x / m) >> 8
      d[i] = ((d[i] * a + sr * ma) / m) >>> 8;
      d[i + 1] = ((d[i + 1] * a + sg * ma) / m) >>> 8;
      d[i + 2] = ((d[i + 2] * a + sb * ma) / m) >>> 8;
      d[i + 3] = ((d[i + 3] * a + sa * ma) / m) >>> 8;
    }
  }
}

// Root-mean-square difference between two images, normalised to 0..1.
export function differenceFull(a, b) {
  const ad = a.data;
  const bd = b.data;
  let total = 0;
  for (let i = 0; i < ad.length; i++) {
    const d = ad[i] - bd[i];
    total += d * d;
  }
  return Math.sqrt(total / (a.width * a.height * 4)) / 255;
}

// Update a differenceFull score after the pixels under `lines` changed from
// `before` to `after`, without rescanning the whole image.
export function differencePartial(target, before, after, score, lines) {
  const t = target.data;
  const bd = before.data;
  const ad = after.data;
  const w = target.width;
  const n = target.width * target.height * 4;
  let total = Math.trunc(Math.pow(score * 255, 2) * n);
  const { ys, x1s, x2s } = lines;
  for (let k = 0; k < lines.length; k++) {
    let i = (ys[k] * w + x1s[k]) * 4;
    for (let x = x1s[k], x2 = x2s[k]; x <= x2; x++, i += 4) {
      const dr1 = t[i] - bd[i];
      const dg1 = t[i + 1] - bd[i + 1];
      const db1 = t[i + 2] - bd[i + 2];
      const da1 = t[i + 3] - bd[i + 3];
      const dr2 = t[i] - ad[i];
      const dg2 = t[i + 1] - ad[i + 1];
      const db2 = t[i + 2] - ad[i + 2];
      const da2 = t[i + 3] - ad[i + 3];
      total -= dr1 * dr1 + dg1 * dg1 + db1 * db1 + da1 * da1;
      total += dr2 * dr2 + dg2 * dg2 + db2 * db2 + da2 * da2;
    }
  }
  return Math.sqrt(total / n) / 255;
}

// Equivalent to copyLines + drawLines into a scratch buffer followed by
// differencePartial, fused into a single pass that never writes pixels.
// This is the search's hot loop.
export function differenceWithColor(target, current, color, score, lines) {
  const t = target.data;
  const c = current.data;
  const w = target.width;
  const n = target.width * target.height * 4;
  const m = 0xffff;
  const sa = color.a * 0x101;
  const sr = Math.trunc((color.r * 0x101 * color.a) / 0xff);
  const sg = Math.trunc((color.g * 0x101 * color.a) / 0xff);
  const sb = Math.trunc((color.b * 0x101 * color.a) / 0xff);
  let total = Math.trunc(Math.pow(score * 255, 2) * n);
  const { ys, x1s, x2s, alphas } = lines;
  for (let k = 0; k < lines.length; k++) {
    const ma = alphas[k];
    const a = (m - Math.trunc((sa * ma) / m)) * 0x101;
    const ar = sr * ma, ag = sg * ma, ab = sb * ma, aa = sa * ma;
    let i = (ys[k] * w + x1s[k]) * 4;
    for (let x = x1s[k], x2 = x2s[k]; x <= x2; x++, i += 4) {
      const cr = c[i], cg = c[i + 1], cb = c[i + 2], ca = c[i + 3];
      const tr = t[i], tg = t[i + 1], tb = t[i + 2], ta = t[i + 3];
      const dr1 = tr - cr, dg1 = tg - cg, db1 = tb - cb, da1 = ta - ca;
      const dr2 = tr - (((cr * a + ar) / m) >>> 8);
      const dg2 = tg - (((cg * a + ag) / m) >>> 8);
      const db2 = tb - (((cb * a + ab) / m) >>> 8);
      const da2 = ta - (((ca * a + aa) / m) >>> 8);
      total += dr2 * dr2 + dg2 * dg2 + db2 * db2 + da2 * da2 - (dr1 * dr1 + dg1 * dg1 + db1 * db1 + da1 * da1);
    }
  }
  return Math.sqrt(total / n) / 255;
}
