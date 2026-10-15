import { Color } from './color.js';

export function clamp(x, lo, hi) {
  return x < lo ? lo : x > hi ? hi : x;
}

export function radians(degrees) {
  return (degrees * Math.PI) / 180;
}

export function degrees(radians) {
  return (radians * 180) / Math.PI;
}

export function rotate(x, y, theta) {
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  return [x * c - y * s, x * s + y * c];
}

export function numberString(x) {
  for (const suffix of ['', 'k', 'M', 'G']) {
    if (x < 1000) return `${x.toFixed(1)}${suffix}`;
    x /= 1000;
  }
  return `${x.toFixed(1)}T`;
}

// Images are plain { width, height, data } objects with RGBA bytes, the same
// shape as a browser ImageData. Pixel data is premultiplied by alpha, like
// Go's image.RGBA.

export function createImage(width, height) {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

export function copyImage(im) {
  return { width: im.width, height: im.height, data: new Uint8ClampedArray(im.data) };
}

export function uniformImage(width, height, color) {
  const im = createImage(width, height);
  const d = im.data;
  // premultiply, matching how Go draws an NRGBA color into an RGBA image
  const r = Math.trunc((color.r * color.a) / 255);
  const g = Math.trunc((color.g * color.a) / 255);
  const b = Math.trunc((color.b * color.a) / 255);
  for (let i = 0; i < d.length; i += 4) {
    d[i] = r;
    d[i + 1] = g;
    d[i + 2] = b;
    d[i + 3] = color.a;
  }
  return im;
}

// Convert straight-alpha pixels (PNG decoders, canvas getImageData) to
// premultiplied alpha in place.
export function premultiply(im) {
  const d = im.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 255) continue;
    d[i] = Math.trunc((d[i] * a) / 255);
    d[i + 1] = Math.trunc((d[i + 1] * a) / 255);
    d[i + 2] = Math.trunc((d[i + 2] * a) / 255);
  }
  return im;
}

// Inverse of premultiply, for encoders that expect straight alpha.
export function unpremultiply(im) {
  const out = copyImage(im);
  const d = out.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3];
    if (a === 255 || a === 0) continue;
    d[i] = Math.round((d[i] * 255) / a);
    d[i + 1] = Math.round((d[i + 1] * 255) / a);
    d[i + 2] = Math.round((d[i + 2] * 255) / a);
  }
  return out;
}

export function averageColor(im) {
  const d = im.data;
  let r = 0, g = 0, b = 0;
  for (let i = 0; i < d.length; i += 4) {
    r += d[i];
    g += d[i + 1];
    b += d[i + 2];
  }
  const n = im.width * im.height;
  return new Color(Math.trunc(r / n), Math.trunc(g / n), Math.trunc(b / n), 255);
}

// Scale an image down to fit within size x size, keeping the aspect ratio.
// Images that already fit are returned as a copy. Uses area averaging.
export function thumbnail(im, size) {
  const { width: w, height: h } = im;
  if (size <= 0 || (w <= size && h <= size)) return copyImage(im);
  let nw, nh;
  if (w >= h) {
    nw = size;
    nh = Math.max(1, Math.trunc((size * h) / w));
  } else {
    nh = size;
    nw = Math.max(1, Math.trunc((size * w) / h));
  }
  const out = createImage(nw, nh);
  const sx = w / nw;
  const sy = h / nh;
  const src = im.data;
  const dst = out.data;
  for (let y = 0; y < nh; y++) {
    const y0 = y * sy;
    const y1 = y0 + sy;
    for (let x = 0; x < nw; x++) {
      const x0 = x * sx;
      const x1 = x0 + sx;
      let r = 0, g = 0, b = 0, a = 0, total = 0;
      for (let py = Math.floor(y0); py < Math.ceil(y1); py++) {
        const wy = Math.min(py + 1, y1) - Math.max(py, y0);
        for (let px = Math.floor(x0); px < Math.ceil(x1); px++) {
          const wgt = wy * (Math.min(px + 1, x1) - Math.max(px, x0));
          const i = (py * w + px) * 4;
          r += src[i] * wgt;
          g += src[i + 1] * wgt;
          b += src[i + 2] * wgt;
          a += src[i + 3] * wgt;
          total += wgt;
        }
      }
      const j = (y * nw + x) * 4;
      dst[j] = r / total;
      dst[j + 1] = g / total;
      dst[j + 2] = b / total;
      dst[j + 3] = a / total;
    }
  }
  return out;
}
