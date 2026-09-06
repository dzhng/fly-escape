import type { FieldScenario, LifecycleScenario } from "./generated/sim";
import type { Reply, Request } from "./protocol";
export type * from "./generated/sim";
export type { Reply } from "./protocol";

/** Pull one tick at a time; no worker work is coupled to the render frame rate. */
export class BrainClient {
  private readonly worker = new Worker(new URL("./worker.ts", import.meta.url), { type: "module" });
  private generation = 0;
  private pending = false;
  private ready = false;

  constructor(private readonly receive: (reply: Reply) => void) {
    this.worker.onmessage = (event: MessageEvent<Reply>) => {
      if (event.data.generation !== this.generation) return;
      this.pending = false;
      this.ready = event.data.type !== "error";
      this.receive(event.data);
    };
    this.worker.onerror = (event) => {
      this.pending = false;
      this.ready = false;
      this.receive({ type: "error", generation: this.generation, message: event.message });
    };
  }
  private send(message: Request): void {
    this.worker.postMessage(message);
  }
  start(seed: number): void {
    this.generation++;
    this.ready = false;
    this.pending = false;
    this.send({ type: "start", generation: this.generation, seed });
  }
  startFields(seed: number, scenario: FieldScenario): void {
    this.generation++;
    this.ready = false;
    this.pending = false;
    this.send({ type: "startFields", generation: this.generation, seed, scenario });
  }
  startLifecycle(seed: number, scenario: LifecycleScenario): void {
    this.generation++;
    this.ready = false;
    this.pending = false;
    this.send({ type: "startLifecycle", generation: this.generation, seed, scenario });
  }
  step(): void {
    if (!this.ready || this.pending) return;
    this.pending = true;
    this.send({ type: "step", generation: this.generation });
  }
  inject(left: number, right: number): void {
    if (this.ready) this.send({ type: "inject", generation: this.generation, left, right });
  }
  dispose(): void {
    this.worker.terminate();
  }
}
