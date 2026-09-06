import init, { BrainSession, FieldSession, type InitOutput } from "./wasm/game_wasm";
import type {
  BrainFrame,
  BrainInfo,
  FieldLabInfo,
  FieldLabFrame,
  Reply,
  Request,
} from "./protocol";
let generation = 0;
let session: BrainSession | FieldSession | undefined;
let isFields = false;
let info: BrainInfo | undefined;
let memory: WebAssembly.Memory;
const reply = (value: Reply) => self.postMessage(value);
let assets: Promise<[InitOutput, Uint8Array, string]> | undefined;
const loadAssets = () =>
  (assets ??= Promise.all([
    init(),
    fetch("/brain/graph.bin").then(async (r) => {
      if (!r.ok) throw new Error(`Graph download failed (${r.status})`);
      return new Uint8Array(await r.arrayBuffer());
    }),
    fetch("/brain/manifest.json").then(async (r) => {
      if (!r.ok) throw new Error(`Manifest download failed (${r.status})`);
      return r.text();
    }),
  ]).catch((error) => {
    assets = undefined;
    throw error;
  }));
self.onmessage = async (event: MessageEvent<Request>) => {
  const message = event.data;
  try {
    if (message.type === "start" || message.type === "startFields") {
      generation = message.generation;
      session?.free();
      session = undefined;
      const began = performance.now();
      const [wasm, bytes, manifest] = await loadAssets();
      if (message.generation !== generation) return;
      memory = wasm.memory;
      isFields = message.type === "startFields";
      if (message.type === "startFields") {
        session = new FieldSession(bytes, manifest, message.seed, JSON.stringify(message.scenario));
        const fieldInfo = JSON.parse(session.info()) as FieldLabInfo;
        info = fieldInfo.brain;
        reply({
          type: "fieldsReady",
          generation,
          info: fieldInfo,
          loadMs: performance.now() - began,
          wasmBytes: memory.buffer.byteLength,
        });
      } else {
        session = new BrainSession(bytes, manifest, message.seed);
        info = JSON.parse(session.info()) as BrainInfo;
        reply({
          type: "ready",
          generation,
          info,
          loadMs: performance.now() - began,
          wasmBytes: memory.buffer.byteLength,
        });
      }
    } else if (message.generation === generation && session && info) {
      if (message.type === "inject") {
        if (!(session instanceof BrainSession)) return;
        session.inject(message.left, message.right);
      } else {
        const began = performance.now();
        const frame = JSON.parse(session.step()) as BrainFrame | FieldLabFrame;
        if (isFields)
          reply({
            type: "fieldsFrame",
            generation,
            frame: frame as FieldLabFrame,
            stepMs: performance.now() - began,
            wasmBytes: memory.buffer.byteLength,
          });
        else
          reply({
            type: "frame",
            generation,
            frame: frame as BrainFrame,
            stepMs: performance.now() - began,
            wasmBytes: memory.buffer.byteLength,
          });
      }
    }
  } catch (error) {
    reply({ type: "error", generation: message.generation, message: String(error) });
  }
};
