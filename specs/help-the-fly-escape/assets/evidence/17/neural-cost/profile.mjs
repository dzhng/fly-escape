// Bounded WASM profile of one timed campaign attempt: 500 ticks, 20 flies, level 2.
// Usage: node profile.mjs <wasmPkgDir> <outCpuprofile> [ticks]
import { readFileSync, writeFileSync } from 'node:fs';
import { Session } from 'node:inspector';

const pkgDir = process.argv[2];
const outFile = process.argv[3];
const ticks = Number(process.argv[4] ?? 500);
const root = '/private/tmp/fly-timed-rounds';

const { initSync, AttemptSession } = await import(`${pkgDir}/game_wasm.js`);
initSync({ module: readFileSync(`${pkgDir}/game_wasm_bg.wasm`) });

const ts = readFileSync(`${root}/apps/web/src/levels/turn-the-corner.ts`, 'utf8');
const content = JSON.parse(ts.slice(ts.indexOf('= {') + 2, ts.lastIndexOf('};') + 1));
const request = { ...content, attemptId: 'profile-timed', rootSeed: '11716541513791412824', flyCount: 20, placements: [] };

const build = performance.now();
const core = new AttemptSession(
  readFileSync(`${root}/data/processed/brain/graph.bin`),
  readFileSync(`${root}/data/processed/brain/manifest.json`, 'utf8'),
  JSON.stringify(request),
);
const buildMs = performance.now() - build;

const inspector = new Session();
inspector.connect();
const post = (method, params = {}) => new Promise((res, rej) => inspector.post(method, params, (e, r) => (e ? rej(e) : res(r))));
await post('Profiler.enable');
await post('Profiler.setSamplingInterval', { interval: 200 });
await post('Profiler.start');
const start = performance.now();
let chunkMs = 0;
let last = null;
for (let i = 0; i < ticks; i++) {
  last = JSON.parse(core.step());
  if (last.bufferedTicks >= 10) {
    const t0 = performance.now();
    const c = core.take_chunk();
    c.free();
    chunkMs += performance.now() - t0;
  }
}
const wallMs = performance.now() - start;
const { profile } = await post('Profiler.stop');
writeFileSync(outFile, JSON.stringify(profile));

const self = new Map();
for (const n of profile.nodes) {
  const f = n.callFrame;
  const key = f.functionName || `(anonymous ${f.url})`;
  self.set(key, (self.get(key) || 0) + (n.hitCount || 0));
}
const total = [...self.values()].reduce((a, b) => a + b, 0);
const top = [...self].sort((a, b) => b[1] - a[1]).slice(0, 25).map(([name, hits]) => ({ name: name.slice(0, 150), hits, pct: +(100 * hits / total).toFixed(2) }));
console.log(JSON.stringify({ pkgDir, ticks, buildMs: +buildMs.toFixed(1), wallMs: +wallMs.toFixed(1), msPerTick: +(wallMs / ticks).toFixed(2), chunkMs: +chunkMs.toFixed(1), lastTick: last, totalSamples: total }, null, 1));
console.log(JSON.stringify(top, null, 1));
core.free();
inspector.disconnect();
