import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { createImage } from '../src/index.js';
import { decodeImage, savePNG } from '../src/node/image-io.js';

const cli = new URL('../bin/shapedraw.js', import.meta.url).pathname;

test('CLI writes png, jpg, svg, gif and numbered frames', () => {
  const dir = mkdtempSync(join(tmpdir(), 'shapedraw-'));
  const input = join(dir, 'in.png');
  const im = createImage(40, 30);
  for (let i = 0; i < im.data.length; i += 4) {
    im.data[i] = (i / 4) % 40 * 6;
    im.data[i + 1] = 120;
    im.data[i + 2] = Math.floor(i / 160) * 8;
    im.data[i + 3] = 255;
  }
  savePNG(input, im);
  execFileSync('node', [
    cli, '-i', input,
    '-o', join(dir, 'out.png'), '-o', join(dir, 'out.jpg'), '-o', join(dir, 'out.svg'),
    '-o', join(dir, 'out.gif'), '-o', join(dir, 'frame-%02d.png'),
    '-m', '1', '-n', '2', '-m', '3', '-n', '2', '-s', '80', '-j', '2', '-seed', '1',
  ]);
  const out = decodeImage(readFileSync(join(dir, 'out.png')));
  assert.equal(out.width, 80);
  assert.equal(out.height, 60);
  assert.equal(decodeImage(readFileSync(join(dir, 'out.jpg'))).width, 80);
  const svg = readFileSync(join(dir, 'out.svg'), 'utf8');
  assert.equal((svg.match(/<polygon/g) || []).length, 2);
  assert.equal((svg.match(/<ellipse/g) || []).length, 2);
  assert.equal(readFileSync(join(dir, 'out.gif')).subarray(0, 3).toString(), 'GIF');
  for (let i = 1; i <= 4; i++) assert.ok(existsSync(join(dir, `frame-0${i}.png`)));
});

test('CLI reports missing arguments', () => {
  assert.throws(() => execFileSync('node', [cli], { stdio: 'pipe' }), /input argument required/);
});
