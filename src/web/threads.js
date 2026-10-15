import { ThreadPool } from '../pool.js';

export function createWebPool(count = navigator.hardwareConcurrency || 4, options = {}) {
  const handles = [];
  for (let i = 0; i < count; i++) {
    const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
    handles.push({
      postMessage: (msg) => worker.postMessage(msg),
      onMessage: (fn) => worker.addEventListener('message', (e) => fn(e.data)),
      terminate: () => worker.terminate(),
    });
  }
  return new ThreadPool(handles, options);
}
