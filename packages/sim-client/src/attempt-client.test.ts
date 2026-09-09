import { expect, test } from "bun:test";
import { AttemptClient } from "./attempt-client";
import type { AttemptEnvelope, AttemptRequest, SetupRequest, SetupReply, WorkerFailure } from "./attempt-protocol";

// The Worker is the browser boundary: deliver a reply already queued before restart.
class WorkerBoundary {
  static latest: WorkerBoundary;
  onmessage?: (event: MessageEvent<AttemptEnvelope | SetupReply | WorkerFailure>) => void;
  onerror?: (event: ErrorEvent) => void;
  sent: AttemptRequest[] = [];
  setupId = 0;
  terminated = false;
  constructor() {
    WorkerBoundary.latest = this;
  }
  postMessage(message: AttemptRequest | SetupRequest) {
    if (message.type === "setup") this.setupId = message.requestId;
    else this.sent.push(message);
  }
  terminate() { this.terminated = true; }
  fatal() {
    this.onmessage?.(new MessageEvent<WorkerFailure>("message", { data: { type: "fatal", message: "native trap" } }));
  }
  completeSetup(requestId = this.setupId) {
    this.onmessage?.(new MessageEvent<SetupReply>("message", { data: { type: "setup", requestId, value: [] } }));
  }
  deliver(generation: number, attemptId: string) {
    this.onmessage?.(new MessageEvent<AttemptEnvelope>("message", {
      data: { generation, reply: { type: "error", attemptId, message: "old failure" } },
    }));
  }
}

test("reusing an attempt ID cannot deliver a queued failure to the new run", () => {
  const original = globalThis.Worker;
  globalThis.Worker = WorkerBoundary as unknown as typeof Worker;
  const received: string[] = [];
  const client = new AttemptClient((reply) => received.push(reply.type));
  try {
    client.startLab("same", "1", 2, 100);
    const worker = WorkerBoundary.latest;
    const prior = worker.sent.at(-1)!.generation;
    client.startLab("same", "2", 2, 100);
    const current = worker.sent.at(-1)!.generation;
    worker.deliver(prior, "same");
    expect(received).toEqual([]);
    worker.deliver(current, "same");
    expect(received).toEqual(["error"]);
  } finally {
    client.dispose();
    globalThis.Worker = original;
  }
});


test("a fatal setup failure permits a fresh worker and stale faults cannot reject its reply", async () => {
  const original = globalThis.Worker;
  globalThis.Worker = WorkerBoundary as unknown as typeof Worker;
  const client = new AttemptClient(() => {});
  try {
    const failed = client.setup({ type: "catalog" }).catch(error => error.message);
    const retired = WorkerBoundary.latest;
    retired.fatal();
    expect(retired.terminated).toBe(true);
    expect(await failed).toBe("native trap");
    const retry = client.setup({ type: "catalog" }).then(value => ({ value }), error => ({ error: error.message }));
    const current = WorkerBoundary.latest;
    expect(current).not.toBe(retired);
    retired.fatal();
    expect(current.terminated).toBe(false);
    current.completeSetup();
    expect(await retry).toEqual({ value: [] });
  } finally {
    client.dispose();
    globalThis.Worker = original;
  }
});

test("leaving a setup lets the next level resolve without accepting the old reply", async () => {
  const original = globalThis.Worker;
  globalThis.Worker = WorkerBoundary as unknown as typeof Worker;
  const client = new AttemptClient(() => {});
  try {
    const prior = client.setup({ type: "catalog" }).catch(error => error.message);
    const worker = WorkerBoundary.latest;
    const priorId = worker.setupId;
    client.cancel();
    let settled = false;
    const next = client.setup({ type: "catalog" }).then(
      value => { settled = true; return { value }; },
      error => { settled = true; return { error: error.message }; },
    );
    worker.completeSetup(priorId);
    await Promise.resolve();
    expect(settled).toBe(false);
    worker.completeSetup();
    expect(await next).toEqual({ value: [] });
    expect(await prior).toBe("Setup cancelled");
    expect(worker.terminated).toBe(false);
  } finally {
    client.dispose();
    globalThis.Worker = original;
  }
});
