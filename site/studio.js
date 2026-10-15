import { Model, numberString, premultiply, unpremultiply } from '../src/index.js';
import { createWebPool } from '../src/web/threads.js';

const $ = (id) => document.getElementById(id);
const ui = {
  file: $('file'),
  sample: $('sample'),
  drop: $('drop'),
  canvas: $('canvas'),
  caption: $('caption'),
  original: $('original'),
  count: $('count'),
  alpha: $('alpha'),
  repeat: $('repeat'),
  start: $('start'),
  stop: $('stop'),
  svg: $('svg'),
  png: $('png'),
  shapes: $('s-shapes'),
  score: $('s-score'),
  time: $('s-time'),
  speed: $('s-speed'),
};

const INPUT_SIZE = 256;
const OUTPUT_SIZE = 1024;
const SAMPLE_URL = new URL('img/monalisa.jpg', import.meta.url);
const SAMPLE_NAME = 'Mona Lisa';
const WORKERS = Math.max(1, Math.min(16, navigator.hardwareConcurrency || 4));

let target = null;
let model = null;
let running = false;
let imageName = SAMPLE_NAME;
let originalUrl = null;
let run = { label: 'triangles', alpha: '128' };

const shapeLabel = () => {
  const input = document.querySelector('input[name="mode"]:checked');
  return input.parentElement.lastChild.textContent.trim().toLowerCase();
};
const mode = () => parseInt(document.querySelector('input[name="mode"]:checked').value, 10);

for (const id of ['count', 'alpha', 'repeat']) {
  const input = ui[id];
  const out = $(`${id}-out`);
  const show = () => {
    out.textContent = id === 'alpha' && input.value === '0' ? 'Each its own' : input.value;
  };
  input.addEventListener('input', show);
  show();
}

function setCaption(text) {
  ui.caption.textContent = text;
}

function describe(done) {
  const count = model ? model.shapes.length : 0;
  const alpha = run.alpha === '0' ? 'varying opacity' : `opacity ${run.alpha}`;
  const verb = done ? '' : 'so far, ';
  return `“${imageName}” in ${count} ${run.label}, ${verb}${alpha}.`;
}

// Draw the image into a canvas no larger than INPUT_SIZE and read its pixels.
async function loadTarget(blob) {
  const bitmap = await createImageBitmap(blob);
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

async function usePicture(blob, name) {
  if (!blob || !blob.type.startsWith('image/')) return;
  stop();
  try {
    target = await loadTarget(blob);
  } catch {
    setCaption('That file could not be read as a picture. Try a JPEG or PNG.');
    return;
  }
  imageName = name;
  if (originalUrl) URL.revokeObjectURL(originalUrl);
  originalUrl = URL.createObjectURL(blob);
  ui.original.src = originalUrl;
  start();
}

async function useSample() {
  const blob = await fetch(SAMPLE_URL).then((r) => r.blob());
  await usePicture(blob, SAMPLE_NAME);
}

function paint() {
  const im = unpremultiply(model.image());
  if (ui.canvas.width !== im.width || ui.canvas.height !== im.height) {
    ui.canvas.width = im.width;
    ui.canvas.height = im.height;
  }
  ui.canvas.getContext('2d').putImageData(new ImageData(im.data, im.width, im.height), 0, 0);
}

function setRunning(on) {
  running = on;
  ui.start.textContent = on ? 'Begin again' : 'Begin';
  ui.start.disabled = !target;
  ui.stop.disabled = !on;
  ui.svg.disabled = !model;
  ui.png.disabled = !model;
}

async function start() {
  if (!target) return;
  stop();
  const m = mode();
  const alpha = parseInt(ui.alpha.value, 10);
  const repeat = parseInt(ui.repeat.value, 10);
  const count = parseInt(ui.count.value, 10);
  run = { label: shapeLabel(), alpha: ui.alpha.value };
  const current = new Model(target, { size: OUTPUT_SIZE, pool: createWebPool(WORKERS) });
  model = current;
  setRunning(true);
  paint();
  setCaption(describe(false));

  const t0 = performance.now();
  let tried = 0;
  while (running && current === model && current.shapes.length < count) {
    try {
      tried += await current.step(m, alpha, repeat);
    } catch {
      return; // stopped mid-step
    }
    if (current !== model) return;
    paint();
    const elapsed = (performance.now() - t0) / 1000;
    ui.shapes.textContent = current.shapes.length;
    ui.score.textContent = `${(100 * (1 - current.score)).toFixed(1)}%`;
    ui.time.textContent = `${elapsed.toFixed(1)}s`;
    ui.speed.textContent = numberString(tried / elapsed);
    setCaption(describe(false));
  }
  if (current === model) {
    setCaption(describe(true));
    current.close();
    setRunning(false);
  }
}

function stop() {
  const wasRunning = running;
  running = false;
  if (model) {
    model.close();
    if (wasRunning) setCaption(`${describe(true)} Stopped.`);
  }
  setRunning(false);
}

function download(blob, name) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

const fileStem = () => imageName.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').toLowerCase() || 'picture';

ui.file.addEventListener('change', () => {
  const f = ui.file.files[0];
  if (f) usePicture(f, f.name);
  ui.file.value = '';
});
ui.sample.addEventListener('click', useSample);
ui.start.addEventListener('click', start);
ui.stop.addEventListener('click', stop);
ui.svg.addEventListener('click', () => {
  if (model) download(new Blob([model.svg()], { type: 'image/svg+xml' }), `${fileStem()}-shapes.svg`);
});
ui.png.addEventListener('click', () => {
  if (model) ui.canvas.toBlob((blob) => download(blob, `${fileStem()}-shapes.png`), 'image/png');
});

// Dropping a picture anywhere on the plate replaces the subject.
let dragDepth = 0;
ui.drop.addEventListener('dragenter', (e) => {
  e.preventDefault();
  dragDepth++;
  ui.drop.classList.add('over');
});
ui.drop.addEventListener('dragover', (e) => e.preventDefault());
ui.drop.addEventListener('dragleave', () => {
  if (--dragDepth <= 0) {
    dragDepth = 0;
    ui.drop.classList.remove('over');
  }
});
ui.drop.addEventListener('drop', (e) => {
  e.preventDefault();
  dragDepth = 0;
  ui.drop.classList.remove('over');
  const f = e.dataTransfer.files[0];
  if (f) usePicture(f, f.name);
});

useSample();
