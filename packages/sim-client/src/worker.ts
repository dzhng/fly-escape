import init, { BrainSession, type InitOutput } from './wasm/game_wasm';
import type { BrainFrame, BrainInfo, Reply, Request } from './protocol';
let generation = 0;
let session: BrainSession | undefined;
let info: BrainInfo | undefined;
let memory: WebAssembly.Memory;
const reply = (value: Reply) => self.postMessage(value);
let assets: Promise<[InitOutput, Uint8Array, string]> | undefined;
const loadAssets = () => assets ??= Promise.all([
  init(),
  fetch('/brain/graph.bin').then(async r => { if (!r.ok) throw new Error(`Graph download failed (${r.status})`); return new Uint8Array(await r.arrayBuffer()); }),
  fetch('/brain/manifest.json').then(async r => { if (!r.ok) throw new Error(`Manifest download failed (${r.status})`); return r.text(); }),
]).catch(error => { assets = undefined; throw error; });
self.onmessage = async (event: MessageEvent<Request>) => {
  const message = event.data;
  try {
    if (message.type === 'start') {
      generation = message.generation;
      session?.free();
      session = undefined;
      const began = performance.now();
      const [wasm, bytes, manifest] = await loadAssets();
      if (message.generation !== generation) return;
      memory = wasm.memory;
      session = new BrainSession(bytes, manifest, message.seed);
      info = JSON.parse(session.info()) as BrainInfo;
      reply({ type: 'ready', generation, info, loadMs: performance.now() - began, wasmBytes: memory.buffer.byteLength });
    } else if (message.generation === generation && session && info) {
      if (message.type === 'inject') {
        const left = info.groups.find(g => g.id === 'smellL')!.indices;
        const right = info.groups.find(g => g.id === 'smellR')!.indices;
        session.inject(new Uint32Array([...left, ...right]), new Float64Array([
          ...left.map(() => message.left), ...right.map(() => message.right),
        ]));
      } else {
        const began = performance.now();
        const frame = JSON.parse(session.step()) as BrainFrame;
        reply({ type: 'frame', generation, frame, stepMs: performance.now() - began, wasmBytes: memory.buffer.byteLength });
      }
    }
  } catch (error) {
    reply({ type: 'error', generation: message.generation, message: String(error) });
  }
};
