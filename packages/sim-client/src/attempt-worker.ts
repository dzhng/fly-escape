import init, {
  AttemptSession,
  swarm_request,
  setup_fixture,
  tool_catalog,
  resolve_setup,
  edit_setup,
  type InitOutput,
} from "./wasm/game_wasm";
import type { AttemptInfo, AttemptStep, VisionRequest, ResolvedSetup, ToolDef } from "./generated/sim";
import { parseRecordHeader, RecordDecodeError, type TransferChunk } from "./record";
import type { AttemptRequest, AttemptReply, SetupRequest, WorkerFailure, WorkerProgress } from "./attempt-protocol";

import { prepareAttemptOptics } from "./attempt-optics";
import { createRetinaWorld } from "../../game-renderer/src/retina-world";
import { RetinaCapture } from "../../game-renderer/src/retina-capture";

let generation = 0;
let initializing: AbortController | undefined;
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
      optics?: { capture: RetinaCapture; world: Awaited<ReturnType<typeof createRetinaWorld>> };
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
// Yield a task after each tick so cancellation can run without nested timers'
// minimum delay. The single pump awaits each yield: only one resolver is pending.
const tickChannel = new MessageChannel();
let resumeTick: (() => void) | undefined;
tickChannel.port1.onmessage = () => {
  const resume = resumeTick;
  resumeTick = undefined;
  resume?.();
};
const yieldToMessages = () => new Promise<void>((resolve) => {
  resumeTick = resolve;
  tickChannel.port2.postMessage(null);
});
function retire(error: unknown) {
  generation++;
  active = undefined;
  currentAttemptId = undefined;
  self.postMessage({ type: "fatal", message: String(error) } satisfies WorkerFailure);
  self.close();
}
function dispose(value: { free(): void }, primaryError?: unknown): boolean {
  try {
    value.free();
    return true;
  } catch (cleanupError) {
    console.warn("[Fly escape] failed attempt cleanup", cleanupError);
    retire(primaryError ?? cleanupError);
    return false;
  }
}
function release(primaryError?: unknown): boolean {
  initializing?.abort();
  initializing = undefined;
  const previous = active;
  active = undefined;
  if (!previous) return true;
  try {
    previous.optics?.capture.dispose();
    previous.optics?.world.dispose();
    previous.core.cancel();
  } catch (error) { retire(primaryError ?? error); return false; }
  return dispose(previous.core, primaryError);
}
function fail(id: string, error: unknown) {
  if (active?.id === id && !release(error)) return;
  if (currentAttemptId === id) currentAttemptId = undefined;
  // A trap can strand a borrowed Rust value; retire the whole instance.
  if (error instanceof WebAssembly.RuntimeError) retire(error);
  else send({ type: "error", attemptId: id, message: error instanceof RecordDecodeError ? error.userMessage : String(error), ...(error instanceof RecordDecodeError ? {recordError:error.code} : {}) });
}
function progress(run: NonNullable<typeof active>, phase: WorkerProgress["phase"], tick?: number) {
  self.postMessage({ type: "progress", attemptId: run.id, generation: run.clientGeneration, phase, tick } satisfies WorkerProgress);
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
        progress(run, "compute");
        if (run.optics) {
          const requestText = run.core.prepare_tick();
          const request = JSON.parse(requestText) as VisionRequest | null;
          if (!request) throw new Error("Retinal producer prepared no tick");
          progress(run, "capture", request.tick);
          const rgb = request.poses.length ? (await run.optics.capture.acquire(request.poses)).samples : new Uint8Array();
          if (active !== run) return;
          progress(run, "compute", request.tick);
          status = JSON.parse(run.core.commit_tick(requestText, rgb)) as AttemptStep;
        } else status = JSON.parse(run.core.step()) as AttemptStep;
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
          ...parseRecordHeader(packed.header()),
          retinaRgb: packed.take_retina_rgb(),
          motionOffsets: packed.take_motion_offsets(),
          motionValues: packed.take_motion_values(),
          motionStates: packed.take_motion_states(),
          values: packed.take_values(),
          states: packed.take_states(),
          events: packed.take_events(),
          tickNeuralSteps: packed.take_tick_neural_steps(),
        };
      } catch (error) {
        if (!dispose(packed, error)) return;
        throw error;
      }
      if (!dispose(packed)) return;
      run.outstanding++;
      const metrics = {
        activeNeuralSteps: run.neuralSteps - priorSteps,
        productionMs: performance.now() - began,
        wasmBytes: memory.buffer.byteLength,
      };
      send(
        { type: "frames", attemptId: run.id, chunk, metrics },
        [
          chunk.retinaRgb.buffer as ArrayBuffer,
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
        if (!release()) return;
        send({ type: "complete", attemptId: run.id, result });
        currentAttemptId = undefined;
        return;
      }
    }
  } catch (error) {
    if (run && active === run) fail(run.id, error);
  } finally {
    pumping = false;
    if (active && active.credits > 0) void pump();
    else if (active === run && run) progress(run, "idle");
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
      if (error instanceof WebAssembly.RuntimeError) {
        retire(error);
        return;
      }
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
    if (!release()) return;
    const id = message.type === "start" ? message.input.attemptId : message.attemptId;
    currentAttemptId = id;
    currentClientGeneration = message.generation;
    const started = performance.now();
    const initialization = new AbortController();
    initializing = initialization;
    try {
      const [wasm, bytes, manifest] = await loadAssets();
      if (ticket !== generation) return;
      memory = wasm.memory;
      const input =
        message.type === "start"
          ? JSON.stringify(message.input)
          : swarm_request(id, message.rootSeed, message.flyCount, message.durationTicks);
      const optical = message.type === "start" && message.opticalWorld
        ? await prepareAttemptOptics(message.input, message.opticalWorld,
          JSON.parse(resolve_setup(JSON.stringify(message.input.level), JSON.stringify(message.input.placements))) as ResolvedSetup,
          JSON.parse(tool_catalog()) as ToolDef[], message.generation, initialization.signal)
        : undefined;
      if (ticket !== generation) return;
      const core = optical
        ? AttemptSession.new_retinal(bytes, manifest, input, JSON.stringify(optical.config), optical.mapText)
        : new AttemptSession(bytes, manifest, input);
      let optics: { capture: RetinaCapture; world: Awaited<ReturnType<typeof createRetinaWorld>> } | undefined;
      let info: AttemptInfo;
      try {
        info = JSON.parse(core.info()) as AttemptInfo;
        if (optical) {
          const world = await createRetinaWorld(optical.definition, () => ticket === generation, initialization.signal);
          try { optics = { world, capture: new RetinaCapture(world.scene) }; }
          catch (error) { world.dispose(); throw error; }
        }
        if (ticket !== generation) {
          optics?.capture.dispose(); optics?.world.dispose(); dispose(core); return;
        }
      } catch (error) {
        if (!dispose(core, error)) return;
        throw error;
      }
      initializing = undefined;
      active = {
        id,
        clientGeneration: message.generation,
        core,
        credits: 0,
        outstanding: 0,
        granted: false,
        neuralSteps: 0,
        chunkTicks: info.recordLayout.maxChunkTicks,
        optics,
      };
      send({
        type: "ready",
        attemptId: active.id,
        info,
        loadMs: performance.now() - started,
        wasmBytes: memory.buffer.byteLength,
      });
    } catch (error) {
      if (ticket === generation) { initializing = undefined; fail(id, error); }
    }
  } else if (message.type === "cancel") {
    // Invalidate an outstanding asynchronous load as well as a running attempt.
    if (currentAttemptId !== message.attemptId || currentClientGeneration !== message.generation)
      return;
    generation++;
    if (!release()) return;
    currentAttemptId = undefined;
  } else if (message.type === "visibility") {
    if (active?.id === message.attemptId && active.clientGeneration === message.generation)
      active.optics?.capture.setSuspended(message.hidden);
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
