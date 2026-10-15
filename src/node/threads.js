import { availableParallelism } from 'node:os';
import { Worker } from 'node:worker_threads';
import { ThreadPool } from '../pool.js';

export function createNodePool(count = availableParallelism(), options = {}) {
  const handles = [];
  for (let i = 0; i < count; i++) {
    const worker = new Worker(new URL('./thread.js', import.meta.url));
    handles.push({
      postMessage: (msg) => worker.postMessage(msg),
      onMessage: (fn) => worker.on('message', fn),
      terminate: () => worker.terminate(),
    });
  }
  return new ThreadPool(handles, options);
}
