import init, {
  BrainSession,
  FieldSession,
  LifecycleSession,
  type InitOutput,
} from "./wasm/game_wasm";
import type {
  BrainFrame,
  BrainInfo,
  FieldLabInfo,
  FieldLabFrame,
  LifecycleInfo,
  AttemptFrame,
} from "./generated/sim";
import type { Reply, Request } from "./protocol";
let generation = 0;
let session:
  | { kind: "brain"; core: BrainSession }
  | { kind: "fields"; core: FieldSession }
  | { kind: "lifecycle"; core: LifecycleSession }
  | undefined;
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
    if (
      message.type === "start" ||
      message.type === "startFields" ||
      message.type === "startLifecycle"
    ) {
      generation = message.generation;
      session?.core.free();
      session = undefined;
      const began = performance.now();
      const [wasm, bytes, manifest] = await loadAssets();
      if (message.generation !== generation) return;
      memory = wasm.memory;
      const timing = () => ({
        generation,
        loadMs: performance.now() - began,
        wasmBytes: memory.buffer.byteLength,
      });
      if (message.type === "startFields") {
        const core = new FieldSession(
          bytes,
          manifest,
          message.seed,
          JSON.stringify(message.scenario),
        );
        session = { kind: "fields", core };
        reply({ type: "fieldsReady", info: JSON.parse(core.info()) as FieldLabInfo, ...timing() });
      } else if (message.type === "startLifecycle") {
        const core = new LifecycleSession(
          bytes,
          manifest,
          message.seed,
          JSON.stringify(message.scenario),
        );
        session = { kind: "lifecycle", core };
        reply({
          type: "lifecycleReady",
          info: JSON.parse(core.info()) as LifecycleInfo,
          ...timing(),
        });
      } else {
        const core = new BrainSession(bytes, manifest, message.seed);
        session = { kind: "brain", core };
        reply({ type: "ready", info: JSON.parse(core.info()) as BrainInfo, ...timing() });
      }
    } else if (message.generation === generation && session) {
      if (message.type === "inject") {
        if (session.kind === "brain") session.core.inject(message.left, message.right);
      } else {
        const began = performance.now();
        const timing = () => ({
          generation,
          stepMs: performance.now() - began,
          wasmBytes: memory.buffer.byteLength,
        });
        if (session.kind === "fields") {
          reply({
            type: "fieldsFrame",
            frame: JSON.parse(session.core.step()) as FieldLabFrame,
            ...timing(),
          });
        } else if (session.kind === "brain") {
          reply({
            type: "frame",
            frame: JSON.parse(session.core.step()) as BrainFrame,
            ...timing(),
          });
        } else {
          const frame = JSON.parse(session.core.step()) as AttemptFrame | null;
          if (frame) reply({ type: "lifecycleFrame", frame, ...timing() });
          else reply({ type: "lifecycleComplete", generation });
        }
      }
    }
  } catch (error) {
    reply({ type: "error", generation: message.generation, message: String(error) });
  }
};
