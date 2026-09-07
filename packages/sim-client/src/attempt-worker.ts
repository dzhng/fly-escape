import init, {
  AttemptSession,
  swarm_request,
  setup_fixture,
  tool_catalog,
  resolve_setup,
  edit_setup,
  type InitOutput,
} from "./wasm/game_wasm";
import type { AttemptInfo, AttemptStep } from "./generated/sim";
import type { TransferChunk } from "./record";
import type { AttemptRequest, AttemptReply, SetupRequest } from "./attempt-protocol";

let generation = 0;
let currentAttemptId: string | undefined;
let currentClientGeneration = 0;
let pumping = false;
let memory: WebAssembly.Memory;
let active:
  | {
      id: string;
      clientGeneration: number;
      core: AttemptSession;
      credits: number;
      outstanding: number;
      granted: boolean;
      neuralSteps: number;
      chunkTicks: number;
    }
  | undefined;
const send = (
  reply: AttemptReply,
  buffers: ArrayBuffer[] = [],
  clientGeneration = currentClientGeneration,
) => self.postMessage({ generation: clientGeneration, reply }, buffers);
let wasmReady: ReturnType<typeof init> | undefined;
const loadWasm = () =>
  (wasmReady ??= init().catch((error) => {
    wasmReady = undefined;
    throw error;
  }));
let assets: Promise<[InitOutput, Uint8Array, string]> | undefined;
const loadAssets = () =>
  (assets ??= Promise.all([
    loadWasm(),
    fetch("/brain/graph.bin").then(async (response) => {
      if (!response.ok) throw new Error(`Graph download failed (${response.status})`);
      return new Uint8Array(await response.arrayBuffer());
    }),
    fetch("/brain/manifest.json").then(async (response) => {
      if (!response.ok) throw new Error(`Manifest download failed (${response.status})`);
      return response.text();
    }),
  ]).catch((error) => {
    assets = undefined;
    throw error;
  }));
const yieldToMessages = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
function release() {
  const previous = active;
  active = undefined;
  previous?.core.free();
}
function fail(id: string, error: unknown) {
  if (active?.id === id) {
    try { release(); }
    catch (cleanupError) { console.warn("[Fly escape] failed attempt cleanup", cleanupError); }
  }
  if (currentAttemptId === id) currentAttemptId = undefined;
  send({ type: "error", attemptId: id, message: String(error) });
}
async function pump() {
  if (pumping) return;
  pumping = true;
  const run = active;
  try {
    while (run && active === run && run.credits > 0) {
      run.credits--;
      const began = performance.now();
      const priorSteps = run.neuralSteps;
      let status: AttemptStep;
      do {
        if (active !== run) return;
        status = JSON.parse(run.core.step()) as AttemptStep;
        run.neuralSteps = status.neuralSteps;
        // A cancel/start can run after every complete core tick, never only after a chunk.
        await yieldToMessages();
      } while (!status.complete && status.bufferedTicks < run.chunkTicks);
      if (active !== run) return;
      const packed = run.core.take_chunk();
      if (!packed) throw new Error("Producer made no record progress");
      let chunk: TransferChunk;
      try {
        chunk = {
          ...JSON.parse(packed.header()),
          motionOffsets: packed.take_motion_offsets(),
          motionValues: packed.take_motion_values(),
          motionStates: packed.take_motion_states(),
          values: packed.take_values(),
          states: packed.take_states(),
          events: packed.take_events(),
          tickNeuralSteps: packed.take_tick_neural_steps(),
        };
      } finally {
        packed.free();
      }
      run.outstanding++;
      const metrics = {
        activeNeuralSteps: run.neuralSteps - priorSteps,
        productionMs: performance.now() - began,
        wasmBytes: memory.buffer.byteLength,
      };
      send(
        { type: "frames", attemptId: run.id, chunk, metrics },
        [
          chunk.motionOffsets.buffer as ArrayBuffer,
          chunk.motionValues.buffer as ArrayBuffer,
          chunk.motionStates.buffer as ArrayBuffer,
          chunk.values.buffer as ArrayBuffer,
          chunk.states.buffer as ArrayBuffer,
          chunk.events.buffer as ArrayBuffer,
          chunk.tickNeuralSteps.buffer as ArrayBuffer,
        ],
        run.clientGeneration,
      );
      if (status.complete) {
        const result = chunk.result;
        if (!result) throw new Error("Completed attempt has no result");
        send({ type: "complete", attemptId: run.id, result });
        release();
        currentAttemptId = undefined;
        return;
      }
    }
  } catch (error) {
    if (run && active === run) fail(run.id, error);
  } finally {
    pumping = false;
    if (active && active.credits > 0) void pump();
  }
}
self.onmessage = async (event: MessageEvent<AttemptRequest | SetupRequest>) => {
  const message = event.data;
  if (message.type === "setup") {
    try {
      if (active || currentAttemptId) throw new Error("Setup is frozen during an attempt");
      await loadWasm();
      if (active || currentAttemptId) throw new Error("Setup is frozen during an attempt");
      const c = message.command;
      const value =
        c.type === "catalog"
          ? tool_catalog()
          : c.type === "fixture"
            ? setup_fixture()
            : c.type === "resolve"
              ? resolve_setup(JSON.stringify(c.level), JSON.stringify(c.placements))
              : edit_setup(
                  JSON.stringify(c.level),
                  JSON.stringify(c.placements),
                  JSON.stringify(c.edit),
                );
      self.postMessage({
        type: "setup",
        requestId: message.requestId,
        value: JSON.parse(value),
      });
    } catch (error) {
      self.postMessage({
        type: "setup",
        requestId: message.requestId,
        error: String(error),
      });
    }
    return;
  }
  if (message.type === "start" || message.type === "startLab") {
    const ticket = ++generation;
    release();
    const id = message.type === "start" ? message.input.attemptId : message.attemptId;
    currentAttemptId = id;
    currentClientGeneration = message.generation;
    const started = performance.now();
    try {
      const [wasm, bytes, manifest] = await loadAssets();
      if (ticket !== generation) return;
      memory = wasm.memory;
      const input =
        message.type === "start"
          ? JSON.stringify(message.input)
          : swarm_request(id, message.rootSeed, message.flyCount, message.durationTicks);
      const core = new AttemptSession(bytes, manifest, input);
      let info: AttemptInfo;
      try {
        info = JSON.parse(core.info()) as AttemptInfo;
      } catch (error) {
        core.free();
        throw error;
      }
      active = {
        id,
        clientGeneration: message.generation,
        core,
        credits: 0,
        outstanding: 0,
        granted: false,
        neuralSteps: 0,
        chunkTicks: info.recordLayout.maxChunkTicks,
      };
      send({
        type: "ready",
        attemptId: active.id,
        info,
        loadMs: performance.now() - started,
        wasmBytes: memory.buffer.byteLength,
      });
    } catch (error) {
      if (ticket === generation) fail(id, error);
    }
  } else if (message.type === "cancel") {
    // Invalidate an outstanding asynchronous load as well as a running attempt.
    if (currentAttemptId !== message.attemptId || currentClientGeneration !== message.generation)
      return;
    generation++;
    release();
    currentAttemptId = undefined;
  } else if (active?.id === message.attemptId && active.clientGeneration === message.generation) {
    const count = message.count;
    if (
      !Number.isInteger(count) ||
      count < 1 ||
      count > 2 ||
      (active.granted && count > active.outstanding)
    ) {
      fail(active.id, "Invalid frame credit acknowledgement");
      return;
    }
    if (active.granted) active.outstanding -= count;
    active.granted = true;
    active.credits += count;
    if (active.credits + active.outstanding > 2) {
      fail(active.id, "At most two frame chunks may be in flight");
      return;
    }
    void pump();
  }
};
