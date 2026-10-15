import { Model, numberString, premultiply, unpremultiply } from '../src/index.js';
import { createWebPool } from '../src/web/threads.js';

const $ = (id) => document.getElementById(id);
const ui = {
  file: $('file'),
  drop: $('drop'),
  dropText: $('drop-text'),
  mode: $('mode'),
  count: $('count'),
  alpha: $('alpha'),
  repeat: $('repeat'),
  workers: $('workers'),
  start: $('start'),
  stop: $('stop'),
  svg: $('svg'),
  png: $('png'),
  stage: $('stage'),
  empty: $('empty'),
  stats: $('stats'),
  original: $('original'),
  canvas: $('canvas'),
  caption: $('caption'),
};

const INPUT_SIZE = 256;
const OUTPUT_SIZE = 1024;

let target = null;
let model = null;
let running = false;
let imageName = 'image';

ui.workers.value = Math.max(1, Math.min(16, navigator.hardwareConcurrency || 4));

for (const id of ['count', 'alpha', 'repeat']) {
  const input = ui[id];
  const out = $(`${id}-out`);
  const show = () => {
    out.textContent = id === 'alpha' && input.value === '0' ? 'auto' : input.value;
  };
  input.addEventListener('input', show);
  show();
}

// Draw the image into a canvas no larger than INPUT_SIZE and read its pixels.
async function loadTarget(file) {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, INPUT_SIZE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(bitmap, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  bitmap.close();
  return premultiply({ width: w, height: h, data: data.data });
}

async function selectFile(file) {
  if (!file || !file.type.startsWith('image/')) return;
  stop();
  imageName = file.name.replace(/\.[^.]+$/, '') || 'image';
  target = await loadTarget(file);
  ui.original.src = URL.createObjectURL(file);
  ui.dropText.textContent = file.name;
  ui.stage.hidden = false;
  ui.empty.hidden = true;
  ui.start.disabled = false;
  ui.canvas.width = target.width;
  ui.canvas.height = target.height;
  ui.canvas.getContext('2d').clearRect(0, 0, target.width, target.height);
}

ui.file.addEventListener('change', () => selectFile(ui.file.files[0]));
ui.drop.addEventListener('dragover', (e) => {
  e.preventDefault();
  ui.drop.classList.add('over');
});
ui.drop.addEventListener('dragleave', () => ui.drop.classList.remove('over'));
ui.drop.addEventListener('drop', (e) => {
  e.preventDefault();
  ui.drop.classList.remove('over');
  selectFile(e.dataTransfer.files[0]);
});

function paint() {
  const im = unpremultiply(model.image());
  if (ui.canvas.width !== im.width || ui.canvas.height !== im.height) {
    ui.canvas.width = im.width;
    ui.canvas.height = im.height;
  }
  ui.canvas.getContext('2d').putImageData(new ImageData(im.data, im.width, im.height), 0, 0);
}

async function start() {
  if (!target) return;
  stop();
  const workers = Math.max(1, Math.min(64, parseInt(ui.workers.value, 10) || 1));
  const mode = parseInt(ui.mode.value, 10);
  const alpha = parseInt(ui.alpha.value, 10);
  const repeat = parseInt(ui.repeat.value, 10);
  const count = parseInt(ui.count.value, 10);
  model = new Model(target, { size: OUTPUT_SIZE, pool: createWebPool(workers) });
  running = true;
  ui.start.disabled = true;
  ui.stop.disabled = false;
  ui.svg.disabled = false;
  ui.png.disabled = false;
  ui.stats.hidden = false;
  ui.caption.textContent = ui.mode.selectedOptions[0].textContent;
  paint();

  const current = model;
  const t0 = performance.now();
  let tried = 0;
  while (running && current === model && current.shapes.length < count) {
    try {
      tried += await current.step(mode, alpha, repeat);
    } catch {
      break; // stopped mid-step
    }
    if (current !== model) break;
    paint();
    const elapsed = (performance.now() - t0) / 1000;
    $('s-shapes').textContent = current.shapes.length;
    $('s-score').textContent = `${(100 * (1 - current.score)).toFixed(2)}%`;
    $('s-time').textContent = `${elapsed.toFixed(1)}s`;
    $('s-speed').textContent = `${numberString(tried / elapsed)} shapes/s`;
  }
  if (current === model) {
    running = false;
    ui.start.disabled = false;
    ui.stop.disabled = true;
  }
}

function stop() {
  running = false;
  ui.start.disabled = !target;
  ui.stop.disabled = true;
  if (model) model.close();
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

ui.start.addEventListener('click', start);
ui.stop.addEventListener('click', stop);
ui.svg.addEventListener('click', () => {
  if (model) download(new Blob([model.svg()], { type: 'image/svg+xml' }), `${imageName}-shapes.svg`);
});
ui.png.addEventListener('click', () => {
  if (model) ui.canvas.toBlob((blob) => download(blob, `${imageName}-shapes.png`), 'image/png');
});
