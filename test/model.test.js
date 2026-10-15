import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Model, Random, Scanlines, Searcher, ShapeType, createImage, randomShape, shapeFromJSON } from '../src/index.js';

function gradient(w, h) {
  const im = createImage(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      im.data[i] = (x * 255) / w;
      im.data[i + 1] = (y * 255) / h;
      im.data[i + 2] = x === y ? 255 : 40;
      im.data[i + 3] = 255;
    }
  }
  return im;
}

test('every shape type rasterizes inside the image and round-trips through JSON', () => {
  const target = gradient(64, 48);
  const searcher = new Searcher(target, 5);
  const lines = new Scanlines();
  for (let type = 1; type <= 8; type++) {
    for (let k = 0; k < 200; k++) {
      const shape = randomShape(searcher, type);
      shape.mutate();
      shape.rasterize(lines);
      for (let i = 0; i < lines.length; i++) {
        assert.ok(lines.ys[i] >= 0 && lines.ys[i] < 48, `type ${type} y in range`);
        assert.ok(lines.x1s[i] >= 0 && lines.x2s[i] < 64 && lines.x1s[i] <= lines.x2s[i], `type ${type} x in range`);
      }
      const copy = shapeFromJSON(searcher, JSON.parse(JSON.stringify(shape)));
      assert.deepEqual(copy.toJSON(), shape.toJSON());
      assert.ok(shape.svg('fill="#000"').startsWith('<'));
    }
  }
});

test('model score decreases as shapes are added, for every mode', async () => {
  const target = gradient(48, 32);
  for (let mode = 0; mode <= 8; mode++) {
    const model = new Model(target, { size: 96, seed: 1 });
    const start = model.score;
    for (let i = 0; i < 4; i++) await model.step(mode, 128, 0);
    assert.ok(model.score < start, `mode ${mode} improves`);
    assert.equal(model.shapes.length, 4);
    assert.equal(model.image().width, 96);
    assert.equal(model.image().height, 64);
    assert.ok(model.svg().includes('</svg>'));
  }
});

test('alpha 0 lets the optimiser choose alpha', async () => {
  const model = new Model(gradient(32, 32), { size: 64, seed: 2 });
  await model.step(ShapeType.TRIANGLE, 0, 0);
  assert.ok(model.colors[0].a >= 1 && model.colors[0].a <= 255);
});

test('a fixed seed gives reproducible results', async () => {
  const run = async () => {
    const model = new Model(gradient(40, 30), { size: 80, seed: 9 });
    for (let i = 0; i < 3; i++) await model.step(ShapeType.ANY, 128, 1);
    return model.svg();
  };
  assert.equal(await run(), await run());
});

test('Random.norm is roughly standard normal', () => {
  const rnd = new Random(3);
  let sum = 0, sq = 0;
  const n = 20000;
  for (let i = 0; i < n; i++) {
    const v = rnd.norm();
    sum += v;
    sq += v * v;
  }
  assert.ok(Math.abs(sum / n) < 0.05);
  assert.ok(Math.abs(sq / n - 1) < 0.05);
});
