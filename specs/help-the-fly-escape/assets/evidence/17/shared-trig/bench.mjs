// One timed campaign attempt through the real AttemptSession: 20 flies, 500 ticks,
// level 2, chunks drained at 10 buffered ticks exactly as the worker does.
// Usage: node bench.mjs <wasmPkgDir> [--digest]
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const pkgDir = process.argv[2];
const digest = process.argv.includes('--digest');
const ticks = 500;
const root = '/private/tmp/fly-timed-rounds';

const { initSync, AttemptSession } = await import(`${pkgDir}/game_wasm.js`);
initSync({ module: readFileSync(`${pkgDir}/game_wasm_bg.wasm`) });

const ts = readFileSync(`${root}/apps/web/src/levels/turn-the-corner.ts`, 'utf8');
const content = JSON.parse(ts.slice(ts.indexOf('= {') + 2, ts.lastIndexOf('};') + 1));
const request = { ...content, attemptId: 'noise-sincos', rootSeed: '11716541513791412824', flyCount: 20, placements: [] };

const core = new AttemptSession(
  readFileSync(`${root}/data/processed/brain/graph.bin`),
  readFileSync(`${root}/data/processed/brain/manifest.json`, 'utf8'),
  JSON.stringify(request),
);

const hash = digest ? createHash('sha256') : null;
const start = performance.now();
let last = null;
for (let i = 0; i < ticks; i++) {
  const s = core.step();
  if (hash) hash.update(s);
  last = s;
  if (JSON.parse(s).bufferedTicks >= 10) {
    const c = core.take_chunk();
    if (hash) {
      hash.update(c.header());
      hash.update(Buffer.from(new Float64Array(c.take_motion_values()).buffer));
      hash.update(Buffer.from(new Uint32Array(c.take_motion_states()).buffer));
      hash.update(Buffer.from(new Uint32Array(c.take_motion_offsets()).buffer));
      hash.update(Buffer.from(new Float64Array(c.take_values()).buffer));
      hash.update(Buffer.from(new Uint32Array(c.take_states()).buffer));
      hash.update(Buffer.from(new Uint32Array(c.take_events()).buffer));
      hash.update(Buffer.from(new Uint32Array(c.take_tick_neural_steps()).buffer));
    }
    c.free();
  }
}
const wallMs = performance.now() - start;
console.log(JSON.stringify({
  pkg: pkgDir.split('/').pop(), ticks, wallMs: +wallMs.toFixed(1), msPerTick: +(wallMs / ticks).toFixed(3),
  lastTick: JSON.parse(last), digest: hash ? hash.digest('hex') : null,
}));
core.free();
