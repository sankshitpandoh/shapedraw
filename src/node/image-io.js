import { readFileSync, writeFileSync } from 'node:fs';
import gifenc from 'gifenc';
import jpeg from 'jpeg-js';
import { PNG } from 'pngjs';
import { premultiply, unpremultiply } from '../util.js';

const { GIFEncoder, quantize, applyPalette } = gifenc;

function readInput(path) {
  return path === '-' ? readFileSync(0) : readFileSync(path);
}

// Decode a PNG or JPEG into a premultiplied RGBA image.
export function loadImage(path) {
  return decodeImage(readInput(path));
}

export function decodeImage(buf) {
  let im;
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
    const png = PNG.sync.read(buf);
    im = { width: png.width, height: png.height, data: new Uint8ClampedArray(png.data) };
  } else if (buf[0] === 0xff && buf[1] === 0xd8) {
    const jpg = jpeg.decode(buf, { useTArray: true, formatAsRGBA: true, maxMemoryUsageInMB: 2048 });
    im = { width: jpg.width, height: jpg.height, data: new Uint8ClampedArray(jpg.data.buffer) };
  } else {
    throw new Error('unsupported image format (expected PNG or JPEG)');
  }
  return premultiply(im);
}

export function savePNG(path, im) {
  const straight = unpremultiply(im);
  const png = new PNG({ width: im.width, height: im.height });
  png.data = Buffer.from(straight.data.buffer, straight.data.byteOffset, straight.data.length);
  writeFileSync(path, PNG.sync.write(png));
}

export function saveJPG(path, im, quality = 95) {
  const straight = unpremultiply(im);
  const data = Buffer.from(straight.data.buffer, straight.data.byteOffset, straight.data.length);
  writeFileSync(path, jpeg.encode({ width: im.width, height: im.height, data }, quality).data);
}

// delay and lastDelay are in hundredths of a second, like the Go version.
export function saveGIF(path, frames, delay = 50, lastDelay = 250) {
  const gif = GIFEncoder();
  frames.forEach((frame, i) => {
    const rgba = unpremultiply(frame).data;
    const palette = quantize(rgba, 256);
    const index = applyPalette(rgba, palette);
    gif.writeFrame(index, frame.width, frame.height, {
      palette,
      delay: (i === frames.length - 1 ? lastDelay : delay) * 10,
      repeat: 0,
    });
  });
  gif.finish();
  writeFileSync(path, gif.bytes());
}

export function saveFile(path, contents) {
  if (path === '-') process.stdout.write(contents);
  else writeFileSync(path, contents);
}
