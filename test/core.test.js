import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  Color,
  Random,
  Rasterizer,
  Scanlines,
  computeColor,
  copyImage,
  copyLines,
  createImage,
  differenceFull,
  differencePartial,
  differenceWithColor,
  drawLines,
  uniformImage,
} from '../src/index.js';

function randomImage(w, h, rnd) {
  const im = createImage(w, h);
  for (let i = 0; i < im.data.length; i++) im.data[i] = i % 4 === 3 ? 255 : rnd.intn(256);
  return im;
}

test('Color.fromHex handles 3, 4, 6 and 8 digit forms', () => {
  assert.deepEqual(Color.fromHex('#fff').toJSON(), { r: 255, g: 255, b: 255, a: 255 });
  assert.deepEqual(Color.fromHex('1234').toJSON(), { r: 0x11, g: 0x22, b: 0x33, a: 0x44 });
  assert.deepEqual(Color.fromHex('#0a0b0c').toJSON(), { r: 10, g: 11, b: 12, a: 255 });
  assert.deepEqual(Color.fromHex('0a0b0c80').toJSON(), { r: 10, g: 11, b: 12, a: 128 });
});

test('Random is deterministic for a seed', () => {
  const a = new Random(42);
  const b = new Random(42);
  for (let i = 0; i < 100; i++) assert.equal(a.float(), b.float());
});

test('drawLines with an opaque color fills exactly that color', () => {
  const im = uniformImage(4, 4, new Color(10, 20, 30, 255));
  const lines = new Scanlines();
  lines.push(1, 0, 3, 0xffff);
  drawLines(im, new Color(200, 100, 50, 255), lines);
  assert.deepEqual([...im.data.subarray(16, 20)], [200, 100, 50, 255]);
  assert.deepEqual([...im.data.subarray(0, 4)], [10, 20, 30, 255]);
});

test('computeColor finds the target color for opaque shapes', () => {
  const target = uniformImage(8, 8, new Color(90, 160, 30, 255));
  const current = uniformImage(8, 8, new Color(0, 0, 0, 255));
  const lines = new Scanlines();
  for (let y = 0; y < 8; y++) lines.push(y, 0, 7, 0xffff);
  assert.deepEqual(computeColor(target, current, lines, 255).toJSON(), { r: 90, g: 160, b: 30, a: 255 });
});

test('differencePartial matches differenceFull after drawing', () => {
  const rnd = new Random(7);
  const target = randomImage(32, 24, rnd);
  const before = randomImage(32, 24, rnd);
  const score = differenceFull(target, before);
  const lines = new Scanlines();
  for (let y = 3; y < 20; y++) lines.push(y, 2 + (y % 5), 25 - (y % 3), 0x8000 + y * 100);
  const after = copyImage(before);
  drawLines(after, new Color(120, 40, 220, 100), lines);
  const partial = differencePartial(target, before, after, score, lines);
  const full = differenceFull(target, after);
  // the running total is truncated to an integer, as in Go, so allow rounding drift
  assert.ok(Math.abs(partial - full) < 1e-6);
});

test('differenceWithColor is identical to copy + draw + differencePartial', () => {
  const rnd = new Random(11);
  for (let trial = 0; trial < 50; trial++) {
    const target = randomImage(20, 20, rnd);
    const current = randomImage(20, 20, rnd);
    const score = differenceFull(target, current);
    const lines = new Scanlines();
    for (let y = 0; y < 20; y += 1 + rnd.intn(3)) {
      const x1 = rnd.intn(20);
      lines.push(y, x1, x1 + rnd.intn(20 - x1), 1 + rnd.intn(0xffff));
    }
    const color = new Color(rnd.intn(256), rnd.intn(256), rnd.intn(256), 1 + rnd.intn(255));
    const buffer = createImage(20, 20);
    copyLines(buffer, current, lines);
    drawLines(buffer, color, lines);
    const expected = differencePartial(target, current, buffer, score, lines);
    assert.equal(differenceWithColor(target, current, color, score, lines), expected);
  }
});

function coverage(lines) {
  let total = 0;
  for (let i = 0; i < lines.length; i++) total += (lines.x2s[i] - lines.x1s[i] + 1) * (lines.alphas[i] / 0xffff);
  return total;
}

test('Rasterizer coverage equals polygon area', () => {
  const r = new Rasterizer(100, 100);
  const lines = new Scanlines();
  r.fill([[10.25, 10.5, 60.75, 10.5, 60.75, 40.5, 10.25, 40.5]], lines);
  assert.ok(Math.abs(coverage(lines) - 50.5 * 30) < 0.01);
  r.fill([[10, 10, 90, 20, 30, 80]], lines);
  assert.ok(Math.abs(coverage(lines) - 0.5 * Math.abs(80 * 70 - 10 * 20)) < 0.05);
});

test('Rasterizer clips shapes hanging off the canvas', () => {
  const r = new Rasterizer(50, 50);
  const lines = new Scanlines();
  r.fill([[-20, -20, 30, -20, 30, 30, -20, 30]], lines);
  assert.ok(Math.abs(coverage(lines) - 30 * 30) < 0.01);
  for (let i = 0; i < lines.length; i++) {
    assert.ok(lines.x1s[i] >= 0 && lines.x2s[i] < 50 && lines.ys[i] >= 0 && lines.ys[i] < 50);
  }
});

test('Rasterizer unions overlapping same-direction paths', () => {
  const r = new Rasterizer(40, 40);
  const lines = new Scanlines();
  const sq = [0, 0, 20, 0, 20, 20, 0, 20];
  r.fill([sq, sq], lines);
  assert.ok(Math.abs(coverage(lines) - 400) < 0.01);
});
