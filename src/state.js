import { clamp } from './util.js';

// A candidate shape + alpha being optimised by a Searcher.
export class State {
  constructor(searcher, shape, alpha, mutateAlpha, score = -1) {
    if (mutateAlpha === undefined) {
      // alpha 0 means "let the optimiser pick the alpha too"
      mutateAlpha = alpha === 0;
      if (alpha === 0) alpha = 128;
    }
    this.searcher = searcher;
    this.shape = shape;
    this.alpha = alpha;
    this.mutateAlpha = mutateAlpha;
    this.score = score;
  }

  energy() {
    if (this.score < 0) this.score = this.searcher.energy(this.shape, this.alpha);
    return this.score;
  }

  doMove() {
    const old = this.copy();
    this.shape.mutate();
    if (this.mutateAlpha) {
      this.alpha = clamp(this.alpha + this.searcher.rnd.intn(21) - 10, 1, 255);
    }
    this.score = -1;
    return old;
  }

  undoMove(old) {
    this.shape = old.shape;
    this.alpha = old.alpha;
    this.score = old.score;
  }

  copy() {
    return new State(this.searcher, this.shape.copy(), this.alpha, this.mutateAlpha, this.score);
  }
}
