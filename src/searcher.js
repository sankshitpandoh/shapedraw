// The search side of the algorithm (primitive/worker.go). A Searcher owns
// scratch buffers and an RNG, and finds a good shape to add to the current
// image. Several can run in parallel in separate threads.

import { computeColor, differenceWithColor } from './core.js';
import { hillClimb } from './optimize.js';
import { Random } from './random.js';
import { Rasterizer } from './raster.js';
import { Scanlines } from './scanline.js';
import { randomShape } from './shapes/index.js';
import { State } from './state.js';

export class Searcher {
  constructor(target, seed) {
    this.width = target.width;
    this.height = target.height;
    this.target = target;
    this.current = null;
    this.rasterizer = new Rasterizer(this.width, this.height);
    this.lines = new Scanlines(4096);
    this.rnd = new Random(seed);
    this.score = 0;
    this.counter = 0;
  }

  init(current, score) {
    this.current = current;
    this.score = score;
    this.counter = 0;
  }

  // The score the image would have if this shape were added to it.
  energy(shape, alpha) {
    this.counter++;
    const lines = shape.rasterize(this.lines);
    const color = computeColor(this.target, this.current, lines, alpha);
    return differenceWithColor(this.target, this.current, color, this.score, lines);
  }

  // m rounds of: best of n random shapes, then hill climb it.
  bestHillClimbState(type, alpha, n, age, m) {
    let bestEnergy = 0;
    let bestState = null;
    for (let i = 0; i < m; i++) {
      let state = this.bestRandomState(type, alpha, n);
      state = hillClimb(state, age);
      const energy = state.energy();
      if (i === 0 || energy < bestEnergy) {
        bestEnergy = energy;
        bestState = state;
      }
    }
    return bestState;
  }

  bestRandomState(type, alpha, n) {
    let bestEnergy = 0;
    let bestState = null;
    for (let i = 0; i < n; i++) {
      const state = this.randomState(type, alpha);
      const energy = state.energy();
      if (i === 0 || energy < bestEnergy) {
        bestEnergy = energy;
        bestState = state;
      }
    }
    return bestState;
  }

  randomState(type, alpha) {
    return new State(this, randomShape(this, type), alpha);
  }
}
