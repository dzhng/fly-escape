import type { StartAttempt } from "./generated/sim";
import type { AttemptReply, AttemptCommand, AttemptEnvelope } from "./attempt-protocol";

/** Transfers bounded production credits independently of the playback cursor. */
export class AttemptClient {
  private worker: Worker | undefined;
  private attemptId: string | undefined;
  private pendingCredits = 0;
  private generation = 0;
  private hidden = false;
  private ready = false;
  private finished = false;
  constructor(private readonly receive: (reply: AttemptReply) => void) {}
  private createWorker() {
    const worker = new Worker(new URL("./attempt-worker.ts", import.meta.url), { type: "module" });
    worker.onmessage = (event: MessageEvent<AttemptEnvelope>) => {
      if (event.data.generation !== this.generation) return;
      const reply = event.data.reply;
      const generation = this.generation;
      if (reply.attemptId !== this.attemptId) return;
      if (reply.type === "ready") this.ready = true;
      if (reply.type === "complete" || reply.type === "error") {
        this.finished = true;
        this.pendingCredits = 0;
      }
      try {
        this.receive(reply);
      } catch (error) {
        const id = reply.attemptId;
        if (this.generation !== generation) return;
        this.cancel();
        this.receive({ type: "error", attemptId: id, message: String(error) });
        return;
      }
      if (this.generation !== generation) return;
      // The consumer has taken ownership before credit acknowledges the chunk.
      if (reply.type === "ready") this.pendingCredits = 2;
      else if (reply.type === "frames") this.pendingCredits++;
      this.flushCredits();
    };
    worker.onerror = (event) => {
      if (this.worker !== worker) return;
      worker.terminate();
      this.worker = undefined;
      this.ready = false;
      this.finished = true;
      this.pendingCredits = 0;
      if (this.attemptId)
        this.receive({ type: "error", attemptId: this.attemptId, message: event.message });
    };
    return worker;
  }
  private send(message: AttemptCommand) {
    this.worker?.postMessage({ ...message, generation: this.generation });
  }
  startLab(attemptId: string, rootSeed: string, flyCount: number, durationTicks: number) {
    this.prepare(attemptId);
    this.send({ type: "startLab", attemptId, rootSeed, flyCount, durationTicks });
  }
  private prepare(attemptId: string) {
    this.generation++;
    this.worker ??= this.createWorker();
    this.attemptId = attemptId;
    this.pendingCredits = 0;
    this.ready = false;
    this.finished = false;
  }
  start(input: StartAttempt) {
    this.prepare(input.attemptId);
    this.send({ type: "start", input });
  }
  private flushCredits() {
    if (this.hidden || !this.ready || this.finished || !this.attemptId || !this.pendingCredits)
      return;
    this.send({ type: "grantCredits", attemptId: this.attemptId, count: this.pendingCredits });
    this.pendingCredits = 0;
  }
  setHidden(hidden: boolean) {
    this.hidden = hidden;
    this.flushCredits();
  }
  cancel() {
    if (this.attemptId) this.send({ type: "cancel", attemptId: this.attemptId });
    this.generation++;
    this.attemptId = undefined;
    this.pendingCredits = 0;
    this.ready = false;
    this.finished = true;
  }
  dispose() {
    this.worker?.terminate();
    this.worker = undefined;
    this.cancel();
  }
}
