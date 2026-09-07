import type {
  StartAttempt,
  ToolDef,
  SetupFixture,
  ResolvedSetup,
  PlacementState,
} from "./generated/sim";
import type {
  AttemptReply,
  AttemptCommand,
  AttemptEnvelope,
  SetupCommand,
  SetupReply,
} from "./attempt-protocol";

/** Transfers bounded production credits independently of the playback cursor. */
export class AttemptClient {
  private worker: Worker | undefined;
  private attemptId: string | undefined;
  private pendingCredits = 0;
  private generation = 0;
  private hidden = false;
  private ready = false;
  private finished = false;
  constructor(private receive: (reply: AttemptReply) => void) {}
  setReceiver(receive: (reply: AttemptReply) => void) {
    this.receive = receive;
  }
  private setupSequence = 0;
  private setupPending?: {
    id: number;
    resolve: (value: SetupFixture | ToolDef[] | ResolvedSetup | PlacementState) => void;
    reject: (reason: Error) => void;
  };
  setup(command: Extract<SetupCommand, { type: "catalog" }>): Promise<ToolDef[]>;
  setup(command: Extract<SetupCommand, { type: "fixture" }>): Promise<SetupFixture>;
  setup(command: Extract<SetupCommand, { type: "resolve" }>): Promise<ResolvedSetup>;
  setup(command: Extract<SetupCommand, { type: "edit" }>): Promise<PlacementState>;
  setup(command: SetupCommand): Promise<SetupFixture | ToolDef[] | ResolvedSetup | PlacementState> {
    if (this.setupPending) return Promise.reject(new Error("Setup validation is already pending"));
    this.worker ??= this.createWorker();
    const id = ++this.setupSequence;
    return new Promise((resolve, reject) => {
      this.setupPending = { id, resolve, reject };
      this.worker!.postMessage({ type: "setup", requestId: id, command });
    });
  }
  private createWorker() {
    const worker = new Worker(new URL("./attempt-worker.ts", import.meta.url), {
      type: "module",
    });
    worker.onmessage = (event: MessageEvent<AttemptEnvelope | SetupReply>) => {
      if ("type" in event.data && event.data.type === "setup") {
        const pending = this.setupPending;
        if (!pending || pending.id !== event.data.requestId) return;
        this.setupPending = undefined;
        if ("error" in event.data) pending.reject(new Error(event.data.error));
        else pending.resolve(event.data.value);
        return;
      }
      if (!("generation" in event.data)) return;
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
      this.setupPending?.reject(new Error(event.message));
      this.setupPending = undefined;
      worker.terminate();
      this.worker = undefined;
      this.ready = false;
      this.finished = true;
      this.pendingCredits = 0;
      if (this.attemptId)
        this.receive({
          type: "error",
          attemptId: this.attemptId,
          message: event.message,
        });
    };
    return worker;
  }
  private send(message: AttemptCommand) {
    this.worker?.postMessage({ ...message, generation: this.generation });
  }
  startLab(attemptId: string, rootSeed: string, flyCount: number, durationTicks: number) {
    this.prepare(attemptId);
    this.send({
      type: "startLab",
      attemptId,
      rootSeed,
      flyCount,
      durationTicks,
    });
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
    this.send({
      type: "grantCredits",
      attemptId: this.attemptId,
      count: this.pendingCredits,
    });
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
    this.setupPending?.reject(new Error("Setup client disposed"));
    this.setupPending = undefined;
    this.worker?.terminate();
    this.worker = undefined;
    this.cancel();
  }
}
