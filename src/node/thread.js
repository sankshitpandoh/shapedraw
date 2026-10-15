import { parentPort } from 'node:worker_threads';
import { createWorkerHandler } from '../pool.js';

const handle = createWorkerHandler();
parentPort.on('message', (msg) => parentPort.postMessage(handle(msg)));
