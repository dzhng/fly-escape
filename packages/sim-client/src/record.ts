import type {
  AttemptFrame,
  BodyMode,
  BodyState,
  AttemptResult,
  AttemptSpec,
  BodyEventKind,
  FieldSample,
  PackedChunk,
  RecordLayout,
} from "./generated/sim";

export type TransferChunk = Omit<
  PackedChunk,
  "values" | "states" | "events" | "tickNeuralSteps"
> & {
  values: Float64Array;
  states: Uint32Array;
  events: Uint32Array;
  tickNeuralSteps: Uint32Array;
};
export type RecordedPose = {
  tick: number;
  x: number;
  z: number;
  height: number;
  inputX: number;
  inputZ: number;
  mode: BodyMode;
  terminal: boolean;
};
export type RecordedMotion = {
  mode: BodyMode;
  startedTick: number;
  cursorTick: number;
};
const ARCHIVE_CAP = 128 * 1024 * 1024;
const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
function require(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

/** Owns transferred numeric buffers, never decoded frame history. Tick zero is
 * supplied by attempt metadata; frame(0) reads the immutable core-resolved initial bodies. */
export class FrameArchive {
  private chunks: TransferChunk[] = [];
  private readonly initialBodies: BodyState[];
  private readonly spec: Pick<AttemptSpec, "attemptId" | "flyCount" | "durationTicks">;
  private readonly layout: RecordLayout;
  private readonly valueOffsets: Record<string, number>;
  private readonly stateOffsets: Record<string, number>;
  private readonly eventOffsets: Record<string, number>;
  private readonly groupOffsets: Record<string, number>;
  private readonly valueStride: number;
  private bytes = 0;
  private lastTick = 0;
  private motionTick = 0;
  private motionCache = new Uint16Array(0);
  private finalResult: AttemptResult | null = null;

  constructor(
    spec: Pick<AttemptSpec, "attemptId" | "flyCount" | "durationTicks">,
    layout: RecordLayout,
    readonly archiveByteBound: number,
    initialBodies: readonly BodyState[],
  ) {
    require(integer(archiveByteBound) &&
      archiveByteBound <= ARCHIVE_CAP &&
      archiveByteBound > 0, "Record archive exceeds 128 MiB");
    require(integer(spec.flyCount) &&
      spec.flyCount >= 1 &&
      spec.flyCount <= 100 &&
      integer(spec.durationTicks) &&
      spec.durationTicks >= 1 &&
      spec.durationTicks <= 6000, "Invalid attempt horizon");
    require(layout.schemaVersion === 2 &&
      layout.groupIds.length <= 16, "Unsupported record layout");
    require(initialBodies.length === spec.flyCount &&
      initialBodies.every(
        (b) =>
          (b.mode === "walking" || b.mode === "flying") &&
          b.outcome === null &&
          [b.pose.position.x, b.pose.position.z, b.pose.heading, b.reserve, b.height].every(
            Number.isFinite,
          ) &&
          b.reserve >= 0,
      ), "Invalid initial bodies");
    this.initialBodies = structuredClone(initialBodies) as BodyState[];
    this.spec = {
      attemptId: spec.attemptId,
      flyCount: spec.flyCount,
      durationTicks: spec.durationTicks,
    };
    this.layout = structuredClone(layout);
    const offsets = (names: string[]) =>
      Object.fromEntries(names.map((name, index) => [name, index]));
    this.valueOffsets = offsets(layout.valueFields);
    this.stateOffsets = offsets(layout.stateFields);
    this.eventOffsets = offsets(layout.eventFields);
    this.groupOffsets = offsets(layout.groupFields);
    // Names express the consuming domain, while metadata alone supplies offsets.
    for (const name of [
      "inputX",
      "inputZ",
      "inputHeading",
      "x",
      "z",
      "heading",
      "reserve",
      "thrust",
      "turn",
      "flightThrust",
      "flightTurn",
      "leftAttractiveOdor",
      "leftRepellentOdor",
      "leftBrightness",
      "leftShade",
      "leftExitCue",
      "rightAttractiveOdor",
      "rightRepellentOdor",
      "rightBrightness",
      "rightShade",
      "rightExitCue",
      "windX",
      "windZ",
      "height",
    ])
      require(name in this.valueOffsets, `Missing record field ${name}`);
    for (const name of ["mode", "outcome", "presence", "spikeCount"])
      require(name in this.stateOffsets, `Missing state field ${name}`);
    for (const name of ["tick", "flyId", "kind", "arg0", "arg1"])
      require(name in this.eventOffsets, `Missing event field ${name}`);
    for (const name of ["meanVoltage", "spikeFraction"])
      require(name in this.groupOffsets, `Missing group field ${name}`);
    this.valueStride =
      layout.valueFields.length + layout.groupIds.length * layout.groupFields.length;
  }
  get computedTick() {
    return this.lastTick;
  }
  get complete() {
    return this.finalResult !== null;
  }
  get result() {
    return this.finalResult === null ? null : structuredClone(this.finalResult);
  }
  get ownedBytes() {
    return this.bytes;
  }

  clear() {
    this.chunks = [];
    this.bytes = 0;
    this.lastTick = 0;
    this.finalResult = null;
    this.motionTick = 0;
    this.motionCache = new Uint16Array(0);
  }

  /** Stale attempts are ignored before inspecting their payload. Invalid current
   * chunks fail atomically so callers can report a fatal production error.
   * Successful append detaches every supplied numeric buffer. */
  append(chunk: TransferChunk): boolean {
    if (chunk.attemptId !== this.spec.attemptId) return false;
    require(!this.complete &&
      chunk.schemaVersion === this.layout.schemaVersion &&
      chunk.sequence === this.chunks.length &&
      chunk.startTick === this.lastTick + 1 &&
      chunk.flyCount === this.spec.flyCount, "Chunk identity or sequence mismatch");
    require(integer(chunk.tickCount) &&
      chunk.tickCount > 0 &&
      chunk.tickCount <= this.layout.maxChunkTicks, "Invalid chunk tick count");
    const end = chunk.startTick + chunk.tickCount - 1;
    require(end <= this.spec.durationTicks, "Chunk exceeds authored horizon");
    const count = chunk.tickCount * chunk.flyCount;
    require(chunk.values instanceof Float64Array &&
      chunk.states instanceof Uint32Array &&
      chunk.events instanceof Uint32Array &&
      chunk.tickNeuralSteps instanceof Uint32Array, "Chunk requires transferred typed buffers");
    require(chunk.values.length === count * this.valueStride &&
      chunk.states.length === count * this.layout.stateFields.length &&
      chunk.tickNeuralSteps.length === chunk.tickCount &&
      chunk.events.length % this.layout.eventFields.length === 0 &&
      chunk.events.length <=
        count *
          this.layout.maxEventsPerFlyTick *
          this.layout.eventFields.length, "Invalid chunk buffer lengths");
    const buffers = new Set([
      chunk.values.buffer,
      chunk.states.buffer,
      chunk.events.buffer,
      chunk.tickNeuralSteps.buffer,
    ]);
    require([...buffers].every(
      (buffer) => buffer instanceof ArrayBuffer,
    ), "Archive requires owned ArrayBuffers");
    // Match the core's envelope allowance and count backing allocations, including
    // any larger buffers retained by a subview. Shared graph metadata lives outside.
    const bytes = [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, 1024);
    require(this.bytes + bytes + 16384 <=
      this.archiveByteBound, "Record archive capacity exceeded");
    require(chunk.values.every(Number.isFinite), "Nonfinite recorded value");
    const flags = this.layout.sensoryPresentMask | this.layout.neuralPresentMask;
    for (let i = 0; i < count; i++) {
      const s = i * this.layout.stateFields.length;
      require(chunk.states[s + this.stateOffsets.mode] < this.layout.modes.length &&
        chunk.states[s + this.stateOffsets.outcome] < this.layout.outcomes.length &&
        (chunk.states[s + this.stateOffsets.presence] & ~flags) ===
          0, "Invalid recorded state code");
    }
    const eventCounts = new Uint8Array(count);
    for (let i = 0; i < chunk.events.length; i += this.layout.eventFields.length) {
      const tick = chunk.events[i + this.eventOffsets.tick];
      const fly = chunk.events[i + this.eventOffsets.flyId];
      require(tick >= chunk.startTick &&
        tick <= end &&
        fly < chunk.flyCount, "Event outside chunk");
      require(++eventCounts[(tick - chunk.startTick) * chunk.flyCount + fly] <=
        this.layout.maxEventsPerFlyTick, "Event budget exceeded");
      this.event(chunk, i);
    }
    const result = chunk.result;
    require(result === null ||
      (typeof result === "object" &&
        result !== null &&
        result.attemptId === this.spec.attemptId &&
        result.completedTick === end &&
        integer(result.stars) &&
        result.stars <= 3 &&
        typeof result.outcomes === "object" &&
        result.outcomes !== null &&
        [
          result.outcomes.escaped,
          result.outcomes.starved,
          result.outcomes.zapped,
          result.outcomes.timedOut,
          result.outcomes.score,
        ].every(
          (n) => integer(n) && n <= this.spec.flyCount,
        )), "Invalid result identity, tick or summary");
    require(end < this.spec.durationTicks ||
      result !== null, "Final authored tick requires a result");
    // Transfer detaches the caller's views without copying numeric history.
    // Structured cloning also removes aliases to headers and the final result.
    const owned = structuredClone(chunk, {
      transfer: [...buffers] as ArrayBuffer[],
    });
    this.chunks.push(owned);
    this.bytes += bytes;
    this.lastTick = end;
    this.finalResult = owned.result;
    return true;
  }

  /** O(population) retained transition state, no decoded history. Sequential
   * playback scans each packed state once; reverse seeks rebuild at most the
   * authored 6000 ticks. Four u16 values per fly (at most 800 bytes) fit the existing 16 KiB
   * metadata allowance; returned samples are transient, like decoded frames. */
  motion(cursorTick: number): RecordedMotion[] {
    require(Number.isFinite(cursorTick) &&
      cursorTick >= 0 &&
      cursorTick <= this.lastTick, "Motion cursor has not been recorded");
    const tick = Math.floor(cursorTick);
    if (tick < this.motionTick || this.motionCache.length === 0) {
      this.motionTick = 0;
      this.motionCache = new Uint16Array(this.spec.flyCount * 3);

      for (let id = 0; id < this.spec.flyCount; id++) {
        this.motionCache[id * 3] = this.layout.modes.indexOf(
          this.initialBodies[id].mode,
        );
      }
    }
    if (tick > this.motionTick) {
      let low = 0,
        high = this.chunks.length - 1;
      while (low < high) {
        const mid = Math.floor((low + high + 1) / 2);
        if (this.chunks[mid].startTick <= this.motionTick + 1) low = mid;
        else high = mid - 1;
      }
      for (let index = low; index < this.chunks.length; index++) {
        const chunk = this.chunks[index];
        const end = Math.min(tick, chunk.startTick + chunk.tickCount - 1);
        for (let t = Math.max(this.motionTick + 1, chunk.startTick); t <= end; t++) {
          for (let id = 0; id < this.spec.flyCount; id++) {
            const offset =
              ((t - chunk.startTick) * chunk.flyCount + id) * this.layout.stateFields.length;
            const mode = chunk.states[offset + this.stateOffsets.mode];
            const base = id * 3;
            if (this.motionCache[base + 2] !== 0) continue;
            if (mode !== this.motionCache[base]) {
              this.motionCache[base] = mode;
              this.motionCache[base + 1] = t;
            }
            if (this.layout.outcomes[chunk.states[offset + this.stateOffsets.outcome]] !== null)
              this.motionCache[base + 2] = t;
          }
        }
        if (end === tick) break;
      }
      this.motionTick = tick;
    }
    return Array.from({ length: this.spec.flyCount }, (_, id) => ({
      mode: this.layout.modes[this.motionCache[id * 3]],
      startedTick: this.motionCache[id * 3 + 1],
      cursorTick: this.motionCache[id * 3 + 2] || cursorTick,
    }));
  }

  /** Pose-only window for trails: no neural decoding or retained second history. */
  poseHistory(endTick: number, windowTicks = 40): RecordedPose[][] {
    require(integer(endTick) && endTick <= this.lastTick, "Tick has not been recorded");
    require(integer(windowTicks) &&
      windowTicks > 0 &&
      windowTicks <= 40, "Pose window exceeds 40 ticks");
    const histories: RecordedPose[][] = Array.from({ length: this.spec.flyCount }, () => []);
    const start = Math.max(1, endTick - windowTicks + 1);
    for (const chunk of this.chunks) {
      const end = Math.min(endTick, chunk.startTick + chunk.tickCount - 1);
      if (end < start) continue;
      if (chunk.startTick > endTick) break;
      for (let tick = Math.max(start, chunk.startTick); tick <= end; tick++) {
        for (let id = 0; id < chunk.flyCount; id++) {
          const record = (tick - chunk.startTick) * chunk.flyCount + id;
          const base = record * this.valueStride;
          const state = record * this.layout.stateFields.length;
          const mode = this.layout.modes[chunk.states[state + this.stateOffsets.mode]];
          histories[id].push({
            tick,
            x: chunk.values[base + this.valueOffsets.x],
            z: chunk.values[base + this.valueOffsets.z],
            height: chunk.values[base + this.valueOffsets.height],
            inputX: chunk.values[base + this.valueOffsets.inputX],
            inputZ: chunk.values[base + this.valueOffsets.inputZ],
            mode,
            terminal:
              this.layout.outcomes[chunk.states[state + this.stateOffsets.outcome]] !== null,
          });
        }
      }
    }
    return histories;
  }

  /** Read one group's bounded history directly from packed storage. Missing
   * neural samples remain gaps, including terminal ticks; never invent zeros. */
  neuralTrace(flyId: number, groupId: string, endTick: number, windowTicks = 100) {
    require(integer(flyId) && flyId < this.spec.flyCount, "Unknown fly");
    require(integer(endTick) && endTick <= this.lastTick, "Tick has not been recorded");
    require(integer(windowTicks) &&
      windowTicks > 0 &&
      windowTicks <= 100, "Trace window exceeds 100 ticks");
    const group = this.layout.groupIds.indexOf(groupId);
    require(group >= 0, "Unknown neural group");
    const points: {
      tick: number;
      meanVoltage: number | null;
      spikeFraction: number | null;
    }[] = [];
    const start = Math.max(1, endTick - windowTicks + 1);
    for (const chunk of this.chunks) {
      const end = Math.min(endTick, chunk.startTick + chunk.tickCount - 1);
      if (end < start) continue;
      if (chunk.startTick > endTick) break;
      for (let tick = Math.max(start, chunk.startTick); tick <= end; tick++) {
        const record = (tick - chunk.startTick) * chunk.flyCount + flyId;
        const present =
          chunk.states[record * this.layout.stateFields.length + this.stateOffsets.presence] &
          this.layout.neuralPresentMask;
        const base =
          record * this.valueStride +
          this.layout.valueFields.length +
          group * this.layout.groupFields.length;
        points.push({
          tick,
          meanVoltage: present ? chunk.values[base + this.groupOffsets.meanVoltage] : null,
          spikeFraction: present ? chunk.values[base + this.groupOffsets.spikeFraction] : null,
        });
      }
    }
    return points;
  }

  frame(tick: number): AttemptFrame {
    if (tick === 0)
      return {
        tick: 0,
        neuralSteps: 0,
        result: null,
        flies: this.initialBodies.map((body, id) => ({
          id,
          inputPose: structuredClone(body.pose),
          body: structuredClone(body),
          sensory: null,
          neural: null,
          events: [],
        })),
      };
    require(integer(tick) && tick >= 1 && tick <= this.lastTick, "Tick has not been recorded");
    let low = 0,
      high = this.chunks.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      if (this.chunks[mid].startTick <= tick) low = mid;
      else high = mid - 1;
    }
    const chunk = this.chunks[low];
    const tickIndex = tick - chunk.startTick;
    const flies = Array.from({ length: chunk.flyCount }, (_, id) => {
      const record = tickIndex * chunk.flyCount + id;
      const v = (name: string) => chunk.values[record * this.valueStride + this.valueOffsets[name]];
      const s = (name: string) =>
        chunk.states[record * this.layout.stateFields.length + this.stateOffsets[name]];
      const side = (prefix: string): FieldSample => ({
        attractiveOdor: v(`${prefix}AttractiveOdor`),
        repellentOdor: v(`${prefix}RepellentOdor`),
        brightness: v(`${prefix}Brightness`),
        shade: v(`${prefix}Shade`),
        exitCue: v(`${prefix}ExitCue`),
      });
      return {
        id,
        inputPose: {
          position: { x: v("inputX"), z: v("inputZ") },
          heading: v("inputHeading"),
        },
        body: {
          height: v("height"),
          pose: { position: { x: v("x"), z: v("z") }, heading: v("heading") },
          mode: this.layout.modes[s("mode")],
          reserve: v("reserve"),
          outcome: this.layout.outcomes[s("outcome")],
        },
        sensory:
          s("presence") & this.layout.sensoryPresentMask
            ? {
                left: side("left"),
                right: side("right"),
                wind: { x: v("windX"), z: v("windZ") },
              }
            : null,
        neural:
          s("presence") & this.layout.neuralPresentMask
            ? {
                motor: {
                  thrust: v("thrust"),
                  turn: v("turn"),
                  flightThrust: v("flightThrust"),
                  flightTurn: v("flightTurn"),
                },
                spikeCount: s("spikeCount"),
                groups: this.layout.groupIds.map((id, group) => {
                  const base =
                    record * this.valueStride +
                    this.layout.valueFields.length +
                    group * this.layout.groupFields.length;
                  return {
                    id,
                    meanVoltage: chunk.values[base + this.groupOffsets.meanVoltage],
                    spikeFraction: chunk.values[base + this.groupOffsets.spikeFraction],
                  };
                }),
              }
            : null,
        events: [] as AttemptFrame["flies"][number]["events"],
      };
    });
    for (let i = 0; i < chunk.events.length; i += this.layout.eventFields.length) {
      if (chunk.events[i + this.eventOffsets.tick] === tick)
        flies[chunk.events[i + this.eventOffsets.flyId]].events.push({
          tick,
          kind: this.event(chunk, i),
        });
    }
    return {
      tick,
      neuralSteps: chunk.tickNeuralSteps[tickIndex],
      flies,
      result: chunk.result?.completedTick === tick ? structuredClone(chunk.result) : null,
    };
  }

  private event(chunk: TransferChunk, i: number): BodyEventKind {
    const a = chunk.events[i + this.eventOffsets.arg0],
      b = chunk.events[i + this.eventOffsets.arg1];
    switch (this.layout.eventKinds[chunk.events[i + this.eventOffsets.kind]]) {
      case "modeChanged":
        require(a < this.layout.modes.length && b < this.layout.modes.length, "Invalid event mode");
        return {
          type: "modeChanged",
          from: this.layout.modes[a],
          to: this.layout.modes[b],
        };
      case "feedingStarted":
        require(a === 0 && b === 0, "Invalid feeding event");
        return { type: "feedingStarted" };
      case "feedingEnded":
        require(a < this.layout.feedingEnds.length && b === 0, "Invalid feeding end");
        return { type: "feedingEnded", reason: this.layout.feedingEnds[a] };
      case "terminal": {
        const outcome = this.layout.outcomes[a];
        require(outcome != null && b === 0, "Invalid terminal event");
        return { type: "terminal", outcome };
      }
      default:
        throw new Error("Unknown recorded event");
    }
  }
}
