// Runs the shape search across one or more Searchers and returns the best
// result. InlinePool runs on the calling thread; ThreadPool fans the work out
// to worker threads (Node worker_threads or browser Web Workers) through
// small adapter objects.

import { Searcher } from './searcher.js';

function summarize(state, counter) {
  return {
    shape: state.shape.toJSON(),
    alpha: state.alpha,
    mutateAlpha: state.mutateAlpha,
    score: state.energy(),
    counter,
  };
}

export class InlinePool {
  constructor({ seed } = {}) {
    this.seed = seed;
    this.searcher = null;
    this.size = 1;
  }

  async run(job) {
    if (!this.searcher || this.searcher.target !== job.target) {
      this.searcher = new Searcher(job.target, this.seed);
    }
    const s = this.searcher;
    s.init(job.current, job.score);
    const state = s.bestHillClimbState(job.shapeType, job.alpha, job.n, job.age, job.m);
    return summarize(state, s.counter);
  }

  close() {}
}

// Each handle must provide postMessage(msg), onMessage(fn) and terminate().
export class ThreadPool {
  constructor(handles, { seed } = {}) {
    this.handles = handles;
    this.size = handles.length;
    this.seed = seed;
    this.target = null;
    this.pending = handles.map(() => []);
    handles.forEach((h, i) =>
      h.onMessage((msg) => {
        const p = this.pending[i].shift();
        if (!p) return;
        if (msg.error) p.reject(new Error(msg.error));
        else p.resolve(msg);
      })
    );
  }

  request(i, msg) {
    return new Promise((resolve, reject) => {
      this.pending[i].push({ resolve, reject });
      this.handles[i].postMessage(msg);
    });
  }

  async run(job) {
    const wn = this.size;
    if (this.target !== job.target) {
      this.target = job.target;
      await Promise.all(
        this.handles.map((_, i) =>
          this.request(i, {
            type: 'init',
            width: job.target.width,
            height: job.target.height,
            data: job.target.data,
            seed: this.seed === undefined ? undefined : this.seed + i + 1,
          })
        )
      );
    }
    const wm = Math.ceil(job.m / wn);
    const results = await Promise.all(
      this.handles.map((_, i) =>
        this.request(i, {
          type: 'run',
          current: job.current.data,
          score: job.score,
          shapeType: job.shapeType,
          alpha: job.alpha,
          n: job.n,
          age: job.age,
          m: wm,
        })
      )
    );
    let best = null;
    let counter = 0;
    for (const r of results) {
      counter += r.counter;
      if (!best || r.score < best.score) best = r;
    }
    return { ...best, counter };
  }

  close() {
    for (const h of this.handles) h.terminate();
    for (const queue of this.pending) {
      for (const p of queue.splice(0)) p.reject(new Error('pool closed'));
    }
  }
}

// Message handler used inside each worker thread.
export function createWorkerHandler() {
  let searcher = null;
  return (msg) => {
    try {
      if (msg.type === 'init') {
        const target = { width: msg.width, height: msg.height, data: new Uint8ClampedArray(msg.data) };
        searcher = new Searcher(target, msg.seed);
        return { ok: true };
      }
      if (msg.type === 'run') {
        const { width, height } = searcher;
        const current = { width, height, data: msg.current };
        searcher.init(current, msg.score);
        const state = searcher.bestHillClimbState(msg.shapeType, msg.alpha, msg.n, msg.age, msg.m);
        return summarize(state, searcher.counter);
      }
      return { error: `unknown message: ${msg.type}` };
    } catch (err) {
      return { error: String(err && err.stack ? err.stack : err) };
    }
  };
}
