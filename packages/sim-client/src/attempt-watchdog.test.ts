import { expect, test } from "bun:test";
import { AttemptClient } from "./attempt-client";
import type { AttemptRequest, AttemptEnvelope, WorkerProgress } from "./attempt-protocol";

class StalledWorker {
  static latest: StalledWorker;
  onmessage?: (event: { data: AttemptEnvelope | WorkerProgress }) => void;
  sent: AttemptRequest[] = [];
  terminated = false;
  constructor() { StalledWorker.latest = this; }
  postMessage(message: AttemptRequest) { this.sent.push(message); }
  terminate() { this.terminated = true; }
  emit(data: unknown) { this.onmessage?.({ data: data as AttemptEnvelope | WorkerProgress }); }
}

test("queued idle cannot disable recovery for credits already sent; hidden time and stale runs are ignored", () => {
  const saved = { Worker: globalThis.Worker, setTimeout: globalThis.setTimeout, clearTimeout: globalThis.clearTimeout };
  const timers = new Map<number, () => void>();
  let next = 0;
  const received: string[] = [];
  const observed: WorkerProgress[] = [];
  let client: AttemptClient | undefined;
  try {
    globalThis.Worker = StalledWorker as unknown as typeof Worker;
    globalThis.setTimeout = ((fn: () => void) => { const id = ++next; timers.set(id, fn); return id; }) as unknown as typeof setTimeout;
    globalThis.clearTimeout = ((id: number) => { timers.delete(id); }) as unknown as typeof clearTimeout;
    client = new AttemptClient(reply => received.push(reply.type), progress => observed.push(progress));
    client.startLab("same", "1", 2, 100);
    const worker = StalledWorker.latest, generation = worker.sent.at(-1)!.generation;
    const reply = (value: object) => worker.emit({ generation, reply: { attemptId: "same", ...value } });
    reply({ type: "ready", info: {}, loadMs: 0, wasmBytes: 1 });
    reply({ type: "frames", chunk: {}, metrics: {} });
    reply({ type: "frames", chunk: {}, metrics: {} });
    worker.emit({ type: "progress", generation, attemptId: "same", phase: "idle" });
    expect(timers.size).toBe(1);
    worker.emit({ type: "progress", generation, attemptId: "same", phase: "capture", tick: 7 });
    expect(observed.at(-1)).toMatchObject({ phase: "capture", tick: 7 });
    const observedBeforeRestart = observed.length;
    client.setHidden(true);
    expect(timers.size).toBe(0);
    client.setHidden(false);
    expect(timers.size).toBe(1);
    [...timers.values()][0]();
    expect(worker.terminated).toBe(true);
    expect(received.at(-1)).toBe("error");
    client.startLab("same", "2", 2, 100);
    const fresh = StalledWorker.latest;
    expect(fresh).not.toBe(worker);
    worker.emit({ type: "progress", generation, attemptId: "same", phase: "idle" });
    expect(timers.size).toBe(1);
    expect(observed.length).toBe(observedBeforeRestart);
    client.cancel();
    expect(timers.size).toBe(0);
  } finally { client?.dispose(); Object.assign(globalThis, saved); }
});
