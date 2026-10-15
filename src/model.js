// The model (primitive/model.go): holds the target, the current
// approximation, the shapes added so far, and a full-size rendering.

import { Color } from './color.js';
import { computeColor, copyLines, drawLines, differenceFull, differencePartial } from './core.js';
import { hillClimb } from './optimize.js';
import { InlinePool } from './pool.js';
import { Rasterizer } from './raster.js';
import { Scanlines } from './scanline.js';
import { Searcher } from './searcher.js';
import { shapeFromJSON } from './shapes/index.js';
import { State } from './state.js';
import { averageColor, copyImage, createImage, uniformImage } from './util.js';

export class Model {
  // target: premultiplied RGBA image at working resolution
  // background: Color, or null to use the average color of the target
  // size: longest side of the rendered output
  constructor(target, { background = null, size = 1024, pool = null, seed } = {}) {
    const w = target.width;
    const h = target.height;
    const aspect = w / h;
    if (aspect >= 1) {
      this.sw = size;
      this.sh = Math.trunc(size / aspect);
      this.scale = size / w;
    } else {
      this.sw = Math.trunc(size * aspect);
      this.sh = size;
      this.scale = size / h;
    }
    this.width = w;
    this.height = h;
    this.background = background || averageColor(target);
    this.target = target;
    this.current = uniformImage(w, h, this.background);
    this.before = createImage(w, h);
    this.score = differenceFull(this.target, this.current);
    this.shapes = [];
    this.colors = [];
    this.scores = [];
    this.pool = pool || new InlinePool({ seed });
    this.searcher = new Searcher(target, seed === undefined ? undefined : seed + 1000);
    this.lines = new Scanlines(4096);
    this.output = uniformImage(this.sw, this.sh, this.background);
    this.outputRasterizer = new Rasterizer(this.sw, this.sh);
    this.outputLines = new Scanlines(4096);
  }

  // Find the best next shape and add it (plus up to `repeat` extra shapes
  // found with a cheaper local search). Returns the number of shapes tried.
  async step(shapeType = 1, alpha = 128, repeat = 0) {
    const result = await this.pool.run({
      target: this.target,
      current: this.current,
      score: this.score,
      shapeType,
      alpha,
      n: 1000,
      age: 100,
      m: 16,
    });
    let counter = result.counter;
    let state = new State(
      this.searcher,
      shapeFromJSON(this.searcher, result.shape),
      result.alpha,
      result.mutateAlpha
    );
    this.add(state.shape, state.alpha);

    for (let i = 0; i < repeat; i++) {
      this.searcher.init(this.current, this.score);
      state.score = -1;
      const a = state.energy();
      state = hillClimb(state, 100);
      const b = state.energy();
      counter += this.searcher.counter;
      if (a === b) break;
      this.add(state.shape, state.alpha);
    }
    return counter;
  }

  add(shape, alpha) {
    const lines = shape.rasterize(this.lines);
    copyLines(this.before, this.current, lines);
    const color = computeColor(this.target, this.current, lines, alpha);
    drawLines(this.current, color, lines);
    this.score = differencePartial(this.target, this.before, this.current, this.score, lines);
    this.shapes.push(shape);
    this.colors.push(color);
    this.scores.push(this.score);
    this.draw(this.output, shape, color);
  }

  // Render a shape at output resolution, anti-aliased.
  draw(im, shape, color) {
    const s = this.scale;
    const paths = shape.paths(s).map((p) => p.map((v) => (v + 0.5) * s));
    const lines = this.outputRasterizer.fill(paths, this.outputLines);
    drawLines(im, color, lines);
  }

  // The rendered output image (premultiplied RGBA).
  image() {
    return this.output;
  }

  // Snapshots after each shape that improved the score by at least
  // scoreDelta, for animations.
  frames(scoreDelta = 0.001) {
    const im = uniformImage(this.sw, this.sh, this.background);
    const result = [copyImage(im)];
    let previous = 10;
    for (let i = 0; i < this.shapes.length; i++) {
      this.draw(im, this.shapes[i], this.colors[i]);
      const score = this.scores[i];
      if (previous - score >= scoreDelta) {
        previous = score;
        result.push(copyImage(im));
      }
    }
    return result;
  }

  svg() {
    const bg = this.background;
    const lines = [
      `<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="${this.sw}" height="${this.sh}">`,
      `<rect x="0" y="0" width="${this.sw}" height="${this.sh}" fill="${bg.hex()}" />`,
      `<g transform="scale(${this.scale.toFixed(6)}) translate(0.5 0.5)">`,
    ];
    for (let i = 0; i < this.shapes.length; i++) {
      const c = this.colors[i];
      const attrs = `fill="${c.hex()}" fill-opacity="${(c.a / 255).toFixed(6)}"`;
      lines.push(this.shapes[i].svg(attrs));
    }
    lines.push('</g>', '</svg>');
    return lines.join('\n');
  }

  // Serializable description of the result, e.g. for re-rendering elsewhere.
  toJSON() {
    return {
      width: this.sw,
      height: this.sh,
      scale: this.scale,
      background: this.background.toJSON(),
      shapes: this.shapes.map((s, i) => ({ ...s.toJSON(), color: this.colors[i].toJSON() })),
    };
  }

  close() {
    this.pool.close();
  }
}

export { Color };
