import type { HouseProbe } from "./generated/sim";
export type HouseProbeRequest = { id: number; progress: number; detour: boolean };
export type HouseProbeReply = { id: number; probe: HouseProbe } | { id: number; error: string };

/** One in-flight query and one latest queued slider position; never load a neural graph. */
export class HouseProbeClient {
  private readonly worker = new Worker(new URL("./house-probe-worker.ts", import.meta.url), { type: "module" });
  private generation = 0;
  private busy = false;
  private failure?: string;
  private queued?: HouseProbeRequest;
  constructor(private readonly receive: (reply: HouseProbeReply) => void) {
    this.worker.onmessage = ({ data }: MessageEvent<HouseProbeReply>) => {
      this.busy = false;
      if (data.id === this.generation) this.receive(data);
      this.pump();
    };
    this.worker.onerror = e => {
      this.failure = e.message || "Solid probe worker failed.";
      this.busy = false;
      this.queued = undefined;
      this.receive({ id: this.generation, error: this.failure });
    };
  }
  request(progress: number, detour: boolean): void {
    const id = ++this.generation;
    if (this.failure) { this.receive({ id, error: this.failure }); return; }
    this.queued = { id, progress, detour };
    this.pump();
  }
  cancel(): void { ++this.generation; this.queued = undefined; }
  private pump(): void {
    if (this.busy || !this.queued) return;
    this.busy = true;
    this.worker.postMessage(this.queued);
    this.queued = undefined;
  }
  dispose(): void { this.worker.terminate(); }
}
