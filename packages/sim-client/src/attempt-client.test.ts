import { expect, test } from "bun:test";
import { AttemptClient } from "./attempt-client";
import type { AttemptEnvelope, AttemptRequest } from "./attempt-protocol";

// The Worker is the browser boundary: deliver a reply already queued before restart.
class WorkerBoundary {
  static latest: WorkerBoundary;
  onmessage?: (event: MessageEvent<AttemptEnvelope>) => void;
  onerror?: (event: ErrorEvent) => void;
  sent: AttemptRequest[] = [];
  constructor() {
    WorkerBoundary.latest = this;
  }
  postMessage(message: AttemptRequest) {
    this.sent.push(message);
  }
  terminate() {}
  deliver(generation: number, attemptId: string) {
    this.onmessage?.({
      data: { generation, reply: { type: "error", attemptId, message: "old failure" } },
    } as MessageEvent<AttemptEnvelope>);
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
