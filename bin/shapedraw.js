#!/usr/bin/env node
import { availableParallelism } from 'node:os';
import { extname } from 'node:path';
import { Color, Model, numberString, thumbnail } from '../src/index.js';
import { createNodePool } from '../src/node/threads.js';
import { loadImage, saveFile, saveGIF, saveJPG, savePNG } from '../src/node/image-io.js';
import { InlinePool } from '../src/pool.js';

const usage = `Usage: shapedraw [OPTIONS] -i input -o output -n count

  -i <path>     input image path (PNG or JPEG, "-" for stdin)
  -o <path>     output image path (.png .jpg .svg .gif; repeatable; "-" for SVG to stdout;
                put "%d" in the path to save every frame)
  -n <count>    number of primitives (repeatable; each takes the current -m/-a/-rep)
  -m <mode>     0=combo 1=triangle 2=rect 3=ellipse 4=circle 5=rotatedrect
                6=beziers 7=rotatedellipse 8=polygon (default 1)
  -a <alpha>    alpha value, 0 lets the algorithm choose (default 128)
  -bg <hex>     background color (default: average image color)
  -r <size>     resize large input images to this size (default 256)
  -s <size>     output image size (default 1024)
  -j <n>        number of parallel workers (default uses all cores)
  -rep <n>      add N extra shapes per iteration with reduced search (default 0)
  -nth <n>      save every Nth frame (put "%d" in path) (default 1)
  -seed <n>     random seed, for reproducible output
  -v            verbose
  -vv           very verbose
`;

function fail(messages) {
  for (const m of messages) console.error(m);
  process.stdout.write(usage);
  process.exit(1);
}

// Go's flag package semantics: "-flag value", "-flag=value", "--flag".
// Flags are processed in order so each -n captures the -m/-a/-rep before it.
function parseArgs(argv) {
  const opts = {
    input: '',
    outputs: [],
    configs: [],
    background: '',
    alpha: 128,
    inputSize: 256,
    outputSize: 1024,
    mode: 1,
    workers: 0,
    nth: 1,
    repeat: 0,
    seed: undefined,
    logLevel: 0,
  };
  const intFlags = {
    a: 'alpha',
    r: 'inputSize',
    s: 'outputSize',
    m: 'mode',
    j: 'workers',
    nth: 'nth',
    rep: 'repeat',
    seed: 'seed',
  };
  for (let i = 0; i < argv.length; i++) {
    let arg = argv[i];
    if (!arg.startsWith('-') || arg === '-') fail([`ERROR: unexpected argument: ${arg}`]);
    arg = arg.replace(/^--?/, '');
    let value;
    const eq = arg.indexOf('=');
    if (eq >= 0) {
      value = arg.slice(eq + 1);
      arg = arg.slice(0, eq);
    }
    if (arg === 'h' || arg === 'help') {
      process.stdout.write(usage);
      process.exit(0);
    }
    if (arg === 'v' || arg === 'vv') {
      opts.logLevel = Math.max(opts.logLevel, arg === 'v' ? 1 : 2);
      continue;
    }
    if (value === undefined) {
      if (i + 1 >= argv.length) fail([`ERROR: flag needs an argument: -${arg}`]);
      value = argv[++i];
    }
    if (arg === 'i') opts.input = value;
    else if (arg === 'o') opts.outputs.push(value);
    else if (arg === 'bg') opts.background = value;
    else if (arg === 'n') {
      opts.configs.push({ count: parseInt(value, 10), mode: opts.mode, alpha: opts.alpha, repeat: opts.repeat });
    } else if (arg in intFlags) {
      const n = Number(value);
      if (!Number.isInteger(n)) fail([`ERROR: invalid value "${value}" for flag -${arg}`]);
      opts[intFlags[arg]] = n;
    } else fail([`ERROR: flag provided but not defined: -${arg}`]);
  }

  const errors = [];
  if (!opts.input) errors.push('ERROR: input argument required');
  if (opts.outputs.length === 0) errors.push('ERROR: output argument required');
  if (opts.configs.length === 0) errors.push('ERROR: number argument required');
  if (opts.configs.length === 1) {
    Object.assign(opts.configs[0], { mode: opts.mode, alpha: opts.alpha, repeat: opts.repeat });
  }
  for (const c of opts.configs) {
    if (!(c.count >= 1)) errors.push('ERROR: number argument must be > 0');
  }
  if (errors.length) fail(errors);
  return opts;
}

function formatPath(path, frame) {
  return path.replace(/%(0?)(\d*)d/g, (_, zero, width) =>
    String(frame).padStart(Number(width) || 0, zero ? '0' : ' ')
  );
}

async function main() {
  const opts = parseArgs(process.argv.slice(2));
  const log = (level, msg) => {
    if (opts.logLevel >= level) process.stdout.write(msg + '\n');
  };

  const workers = opts.workers < 1 ? availableParallelism() : opts.workers;

  log(1, `reading ${opts.input}`);
  let input = loadImage(opts.input);
  if (opts.inputSize > 0) input = thumbnail(input, opts.inputSize);

  const background = opts.background ? Color.fromHex(opts.background) : null;
  const pool = workers > 1 ? createNodePool(workers, { seed: opts.seed }) : new InlinePool({ seed: opts.seed });
  const model = new Model(input, { background, size: opts.outputSize, pool, seed: opts.seed });

  log(1, `0: t=0.000, score=${model.score.toFixed(6)}`);
  const start = performance.now();
  let frame = 0;
  try {
    for (let j = 0; j < opts.configs.length; j++) {
      const config = opts.configs[j];
      log(1, `count=${config.count}, mode=${config.mode}, alpha=${config.alpha}, repeat=${config.repeat}`);
      for (let i = 0; i < config.count; i++) {
        frame++;
        const t = performance.now();
        const n = await model.step(config.mode, config.alpha, config.repeat);
        const nps = numberString(n / ((performance.now() - t) / 1000));
        const elapsed = (performance.now() - start) / 1000;
        log(1, `${frame}: t=${elapsed.toFixed(3)}, score=${model.score.toFixed(6)}, n=${n}, n/s=${nps}`);

        for (const output of opts.outputs) {
          const ext = output === '-' ? '.svg' : extname(output).toLowerCase();
          const percent = output.includes('%');
          const saveFrames = percent && ext !== '.gif' && frame % opts.nth === 0;
          const last = j === opts.configs.length - 1 && i === config.count - 1;
          if (!saveFrames && !last) continue;
          const path = percent ? formatPath(output, frame) : output;
          log(1, `writing ${path}`);
          switch (ext) {
            case '.png':
              savePNG(path, model.image());
              break;
            case '.jpg':
            case '.jpeg':
              saveJPG(path, model.image(), 95);
              break;
            case '.svg':
              saveFile(path, model.svg());
              break;
            case '.gif':
              saveGIF(path, model.frames(0.001), 50, 250);
              break;
            default:
              throw new Error(`unrecognized file extension: ${ext}`);
          }
        }
      }
    }
  } finally {
    model.close();
  }
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
