import { createWorkerHandler } from '../pool.js';

const handle = createWorkerHandler();
self.onmessage = (e) => self.postMessage(handle(e.data));
