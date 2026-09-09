import type {
  AttemptFrame,
  EyePose,
  RetinaBatch,
  ChunkHeader,
  BodyMode,
  BodyState,
  AttemptResult,
  AttemptSpec,
  BodyEventKind,
  FieldSample,
  SensorySample,
  PackedChunk,
  RecordLayout,
} from "./generated/sim";

export type TransferChunk = Omit<
  PackedChunk,
  "retinaRgb" | "values" | "states" | "events" | "tickNeuralSteps" | "motionOffsets" | "motionValues" | "motionStates"
> & {
  retinaRgb: Uint8Array;
  values: Float64Array;
  states: Uint32Array;
  events: Uint32Array;
  tickNeuralSteps: Uint32Array;
  motionOffsets: Uint32Array;
  motionValues: Float64Array;
  motionStates: Uint32Array;
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
export type MotionSampler = (values: Float64Array, states: Uint32Array, offsets: Uint32Array, fraction: number) => Float64Array;
export type RecordedTransform = {
  x: number;
  z: number;
  heading: number;
  height: number;
  rotation: [number, number, number, number];
};
const MOTION_VALUES = ["fraction", "x", "z", "heading", "height", "rotationX", "rotationY", "rotationZ", "rotationW"];
const MOTION_STATES = ["support", "grounded"];
const MOTION_SAMPLE = MOTION_VALUES.slice(1);
const ARCHIVE_CAP = 512 * 1024 * 1024;
const CHUNK_ENVELOPE_BYTES = 8 * 1024;
const integer = (n: number) => Number.isSafeInteger(n) && n >= 0;
export class RecordDecodeError extends Error {
  constructor(readonly code: "unsupported-record" | "invalid-record", message: string) {
    super(message);
    this.name = "RecordDecodeError";
  }
  get userMessage() {
    return this.code === "invalid-record" ? "This recording is damaged or incomplete. Start a new attempt." : this.message;
  }
}
function require(condition: unknown, message: string): asserts condition {
  if (!condition) throw new RecordDecodeError("invalid-record", message);
}
function requireSchema(value: unknown): void {
  require(typeof value === "object" && value !== null && "schemaVersion" in value,
    "This recording has an invalid header. Start a new attempt.");
  const version = (value as { schemaVersion: unknown }).schemaVersion;
  require(typeof version === "number" && Number.isSafeInteger(version) && version > 0,
    "This recording has an invalid header. Start a new attempt.");
  if (version !== 6) throw new RecordDecodeError("unsupported-record", version < 6
    ? "This recording uses an older format. Start a new attempt to view the fly's eyes."
    : "This recording uses a newer unsupported format. Start a new attempt to view the fly's eyes.");
}

/** Validates the JSON envelope before the worker takes any numeric buffers. */
export function parseRecordHeader(raw: string): ChunkHeader {
  let value: unknown;
  try { value = JSON.parse(raw); }
  catch { throw new RecordDecodeError("invalid-record", "This recording has a corrupt header. Start a new attempt."); }
  requireSchema(value);
  const header = value as ChunkHeader;
  require(typeof header.attemptId === "string" && header.attemptId.length > 0 && header.attemptId.length <= 256 &&
    integer(header.sequence) && integer(header.startTick) && header.startTick > 0 &&
    integer(header.tickCount) && header.tickCount > 0 && header.tickCount <= 10 &&
    integer(header.flyCount) && header.flyCount > 0 && header.flyCount <= 100 &&
    header.startTick + header.tickCount - 1 <= 6000 && "result" in header,
    "This recording has an invalid header. Start a new attempt.");
  return header;
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
    requireSchema(layout);
    require(["valueFields", "motionValueFields", "motionStateFields", "motionSampleFields",
      "stateFields", "eventFields", "groupIds", "groupFields", "modes", "outcomes", "feedingEnds", "eventKinds"]
      .every(key => Array.isArray((layout as unknown as Record<string, unknown>)[key])),
      "This recording has invalid layout metadata. Start a new attempt.");
    require([layout.valueFields, layout.motionValueFields, layout.motionStateFields, layout.motionSampleFields, layout.stateFields, layout.eventFields, layout.groupIds, layout.groupFields, layout.eventKinds]
      .every(names => names.length <= 64 && names.every(name => typeof name === "string" && name.length > 0 && name.length <= 256) && new Set(names).size === names.length), "Invalid record field names");
    require(layout.valueFields.length === 33 && layout.stateFields.length === 5 && layout.eventFields.length === 5 && layout.groupFields.length === 2 &&
      layout.maxChunkTicks === 10 && layout.maxEventsPerFlyTick === 8 &&
      JSON.stringify(layout.modes) === JSON.stringify(["walking","flying","feeding","landing"]) &&
      JSON.stringify(layout.outcomes) === JSON.stringify([null,"escaped","starved","zapped","timedOut","caught"]) &&
      JSON.stringify(layout.feedingEnds) === JSON.stringify(["contactLost","satiated","boutLimit","terminal"]), "Invalid record codes or bounds");
    require(integer(archiveByteBound) &&
      archiveByteBound <= ARCHIVE_CAP &&
      archiveByteBound > 0, "Record archive exceeds 512 MiB");
    require(typeof spec === "object" && spec !== null && typeof spec.attemptId === "string" && spec.attemptId.length > 0 && spec.attemptId.length <= 256 && integer(spec.flyCount) &&
      spec.flyCount >= 1 &&
      spec.flyCount <= 100 &&
      integer(spec.durationTicks) &&
      spec.durationTicks >= 1 &&
      spec.durationTicks <= 6000, "Invalid attempt horizon");
    require(layout.schemaVersion === 6 && integer(layout.noSupport) && layout.noSupport <= 0xffffffff &&
      layout.groupIds.length <= 16, "Unsupported record layout");
    // The core sampler consumes this version's canonical wire order directly.
    require(layout.maxMotionPoints === 129 &&
      JSON.stringify(layout.motionValueFields) === JSON.stringify(MOTION_VALUES) &&
      JSON.stringify(layout.motionStateFields) === JSON.stringify(MOTION_STATES) &&
      JSON.stringify(layout.motionSampleFields) === JSON.stringify(MOTION_SAMPLE), "Unsupported motion layout");
    require(Array.isArray(initialBodies) && initialBodies.length === spec.flyCount &&
      initialBodies.every(
        (b) =>
          typeof b === "object" && b !== null && typeof b.pose === "object" && b.pose !== null && typeof b.pose.position === "object" && b.pose.position !== null &&
          (b.mode === "walking" || b.mode === "flying") &&
          b.outcome === null &&
          [b.pose.position.x, b.pose.position.z, b.pose.heading, b.reserve, b.height].every(
            Number.isFinite,
          ) &&
          b.reserve >= 0 && validSupport(b.support, b.rotation, b.mode, layout.noSupport),
      ), "Invalid initial bodies");
    const config = layout.retinalConfig;
    require(config === null || (typeof config === "object" && config !== null &&
      typeof config.mapHash === "string" && /^[0-9a-f]{64}$/.test(config.mapHash) && integer(config.clientGeneration) && config.clientGeneration <= 0xffffffff && spec.flyCount <= 16 && typeof config.sceneId === "string" && config.sceneId.length > 0 && config.sceneId.length <= 256 &&
      typeof config.profile === "object" && config.profile !== null &&
      [config.profile.profileHash, config.profile.layoutHash, config.profile.rigHash, config.profile.colorModelHash].every(h => typeof h === "string" && /^[0-9a-f]{64}$/.test(h)) &&
      [config.profile.width, config.profile.height].every(n => integer(n) && n > 0 && n <= 256) &&
      integer(config.profile.sampleCount) && config.profile.sampleCount > 0 && config.profile.sampleCount <= config.profile.width * config.profile.height), "Invalid retinal record profile");
    require(layout.retinalPresentMask === 4 && layout.sensoryPresentMask === 1 && layout.neuralPresentMask === 2, "Invalid record presence masks");
    const fixedBytes = spec.durationTicks * (spec.flyCount * ((layout.valueFields.length + layout.groupIds.length * layout.groupFields.length) * 8 + layout.stateFields.length * 4 + (config?.profile.sampleCount ?? 0) * 6 + 8 * 20) + 4) + Math.ceil(spec.durationTicks / layout.maxChunkTicks) * CHUNK_ENVELOPE_BYTES + 16384;
    require(fixedBytes <= archiveByteBound, "Record archive cannot retain the authored fixed history");
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
      "rotationX", "rotationY", "rotationZ", "rotationW",
      "inputHeight", "inputRotationX", "inputRotationY", "inputRotationZ", "inputRotationW",
    ])
      require(name in this.valueOffsets, `Missing record field ${name}`);
    for (const name of ["mode", "outcome", "presence", "spikeCount", "support"])
      require(name in this.stateOffsets, `Missing state field ${name}`);
    for (const name of ["tick", "flyId", "kind", "arg0", "arg1"])
      require(name in this.eventOffsets, `Missing event field ${name}`);
    for (const name of ["meanVoltage", "spikeFraction"])
      require(name in this.groupOffsets, `Missing group field ${name}`);
    this.valueStride =
      layout.valueFields.length + layout.groupIds.length * layout.groupFields.length;
  }
  get retinalConfig() {
    return this.layout.retinalConfig === null ? null : structuredClone(this.layout.retinalConfig);
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
    require(typeof chunk === "object" && chunk !== null, "Invalid chunk header");
    if (chunk.attemptId !== this.spec.attemptId) return false;
    requireSchema(chunk);
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
    require(chunk.retinaRgb instanceof Uint8Array && chunk.values instanceof Float64Array &&
      chunk.states instanceof Uint32Array &&
      chunk.events instanceof Uint32Array &&
      chunk.tickNeuralSteps instanceof Uint32Array &&
      chunk.motionOffsets instanceof Uint32Array &&
      chunk.motionValues instanceof Float64Array &&
      chunk.motionStates instanceof Uint32Array, "Chunk requires transferred typed buffers");
    require(chunk.mapHash === (this.layout.retinalConfig?.mapHash ?? null) && chunk.profileHash === (this.layout.retinalConfig?.profile.profileHash ?? null) && chunk.sceneId === (this.layout.retinalConfig?.sceneId ?? null), "Retinal chunk identity mismatch");
    require(chunk.retinaRgb.length === count * (this.layout.retinalConfig?.profile.sampleCount ?? 0) * 6 && chunk.values.length === count * this.valueStride &&
      chunk.states.length === count * this.layout.stateFields.length &&
      chunk.tickNeuralSteps.length === chunk.tickCount &&
      chunk.events.length % this.layout.eventFields.length === 0 &&
      chunk.events.length <=
        count *
          this.layout.maxEventsPerFlyTick *
          this.layout.eventFields.length, "Invalid chunk buffer lengths");
    const buffers = new Set([
      chunk.retinaRgb.buffer,
      chunk.motionOffsets.buffer,
      chunk.motionValues.buffer,
      chunk.motionStates.buffer,
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
    const bytes = [...buffers].reduce((sum, buffer) => sum + buffer.byteLength, CHUNK_ENVELOPE_BYTES);
    require(this.bytes + bytes + 16384 <=
      this.archiveByteBound, "Record archive capacity exceeded");
    require(chunk.values.every(Number.isFinite), "Nonfinite recorded value");
    const flags = this.layout.sensoryPresentMask | this.layout.neuralPresentMask | (this.layout.retinalConfig ? this.layout.retinalPresentMask : 0);
    for (let i = 0; i < count; i++) {
      const s = i * this.layout.stateFields.length;
      require(chunk.states[s + this.stateOffsets.mode] < this.layout.modes.length &&
        chunk.states[s + this.stateOffsets.outcome] < this.layout.outcomes.length &&
        (chunk.states[s + this.stateOffsets.presence] & ~flags) ===
          0, "Invalid recorded state code");
      const presence = chunk.states[s + this.stateOffsets.presence];
      const retinal = !!(presence & this.layout.retinalPresentMask);
      if (this.layout.retinalConfig) {
        require(retinal === !!(presence & this.layout.neuralPresentMask), "Retinal presence differs from neural input");
        const width = this.layout.retinalConfig.profile.sampleCount * 6;
        require(retinal || chunk.retinaRgb.subarray(i * width, (i + 1) * width).every(v => v === 0), "Absent retinal slot contains bytes");
      }
      const v = i * this.valueStride;
      const support = chunk.states[s + this.stateOffsets.support];
      require(validSupport(support === this.layout.noSupport ? null : support,
        ["rotationX", "rotationY", "rotationZ", "rotationW"].map(name => chunk.values[v + this.valueOffsets[name]]),
        this.layout.modes[chunk.states[s + this.stateOffsets.mode]], this.layout.noSupport), "Invalid recorded support or rotation");
    }
    this.validateMotion(chunk, count);
    for (let record = 0; record < count; record++) {
      const start = chunk.motionOffsets[record] * this.layout.motionValueFields.length;
      const value = record * this.valueStride;
      for (const [input, motion] of [["inputX","x"],["inputZ","z"],["inputHeight","height"],["inputRotationX","rotationX"],["inputRotationY","rotationY"],["inputRotationZ","rotationZ"],["inputRotationW","rotationW"]]) {
        require(chunk.values[value + this.valueOffsets[input]] === chunk.motionValues[start + this.layout.motionValueFields.indexOf(motion)], "Input transform differs from motion start");
      }
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
          result.outcomes.caught,
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

  private validateMotion(chunk: TransferChunk, count: number) {
    const width = this.layout.motionValueFields.length;
    const stateWidth = this.layout.motionStateFields.length;
    const offsets = chunk.motionOffsets;
    require(offsets.length === count + 1 && offsets[0] === 0 &&
      chunk.motionValues.length === offsets[count] * width &&
      chunk.motionStates.length === offsets[count] * stateWidth, "Invalid motion buffer lengths");
    require(chunk.motionValues.every(Number.isFinite), "Nonfinite motion value");
    for (let record = 0; record < count; record++) {
      const start = offsets[record], end = offsets[record + 1];
      require(end >= start + 2 && end - start <= this.layout.maxMotionPoints, "Invalid motion point count");
      let prior = -1;
      for (let point = start; point < end; point++) {
        const base = point * width;
        const fraction = chunk.motionValues[base];
        require(fraction >= 0 && fraction <= 1 && fraction > prior &&
          (point !== start || fraction === 0) &&
          (point !== end - 1 || fraction === 1), "Invalid motion fractions");
        prior = fraction;
        const support = chunk.motionStates[point * stateWidth];
        const grounded = chunk.motionStates[point * stateWidth + 1];
        require(grounded <= 1 && (support === this.layout.noSupport || grounded === 1) &&
          validSupport(support === this.layout.noSupport ? null : support,
            Array.from(chunk.motionValues.subarray(base + 5, base + 9)),
            grounded ? "walking" : "flying", this.layout.noSupport), "Invalid motion support or rotation");
      }
      // The finalized trace and the tick record must describe the same endpoint.
      const endpoint = (end - 1) * width;
      const value = record * this.valueStride;
      for (const field of MOTION_SAMPLE) {
        require(chunk.motionValues[endpoint + this.layout.motionValueFields.indexOf(field)] ===
          chunk.values[value + this.valueOffsets[field]], "Motion endpoint differs from recorded body");
      }
      require(chunk.motionStates[(end - 1) * stateWidth] ===
        chunk.states[record * this.layout.stateFields.length + this.stateOffsets.support], "Motion endpoint support differs from recorded body");
    }
  }

  /** Samples only the selected tick through the core's pure sampler. Numeric
   * subviews remain archive-owned; the trusted WASM binding copies them into
   * bounded scratch memory and returns fresh poses, never retaining history. */
  sampleMotion(cursorTick: number, sampler: MotionSampler): RecordedTransform[] {
    require(Number.isFinite(cursorTick) && cursorTick >= 0 && cursorTick <= this.lastTick,
      "Motion cursor has not been recorded");
    if (cursorTick === 0) return this.initialBodies.map(body => ({
      x: body.pose.position.x, z: body.pose.position.z, heading: body.pose.heading,
      height: body.height, rotation: [...body.rotation],
    }));
    const tick = Math.ceil(cursorTick);
    const chunk = this.chunkAt(tick);
    const first = (tick - chunk.startTick) * chunk.flyCount;
    const start = chunk.motionOffsets[first];
    const end = chunk.motionOffsets[first + chunk.flyCount];
    const offsets = chunk.motionOffsets.slice(first, first + chunk.flyCount + 1);
    for (let i = 0; i < offsets.length; i++) offsets[i] -= start;
    const output = sampler(
      chunk.motionValues.subarray(start * this.layout.motionValueFields.length, end * this.layout.motionValueFields.length),
      chunk.motionStates.subarray(start * this.layout.motionStateFields.length, end * this.layout.motionStateFields.length),
      offsets, cursorTick - tick + 1,
    );
    const fields = this.layout.motionSampleFields;
    require(output.length === chunk.flyCount * fields.length && output.every(Number.isFinite), "Invalid core motion sample");
    return Array.from({length: chunk.flyCount}, (_, id) => {
      const value = (field: string) => output[id * fields.length + fields.indexOf(field)];
      return { x: value("x"), z: value("z"), heading: value("heading"), height: value("height"),
        rotation: [value("rotationX"), value("rotationY"), value("rotationZ"), value("rotationW")] };
    });
  }

  private chunkAt(tick: number): TransferChunk {
    let low = 0, high = this.chunks.length - 1;
    while (low < high) {
      const mid = Math.floor((low + high + 1) / 2);
      if (this.chunks[mid].startTick <= tick) low = mid;
      else high = mid - 1;
    }
    return this.chunks[low];
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

  private retinalRecord(tick: number, flyId: number): { chunk: TransferChunk; record: number } | null {
    require(integer(tick) && tick <= this.lastTick && integer(flyId) && flyId < this.spec.flyCount, "Retinal selection has not been recorded");
    if (tick === 0 || !this.layout.retinalConfig) return null;
    const chunk = this.chunkAt(tick);
    const record = (tick - chunk.startTick) * chunk.flyCount + flyId;
    return chunk.states[record * this.layout.stateFields.length + this.stateOffsets.presence] & this.layout.retinalPresentMask
      ? { chunk, record } : null;
  }
  /** Presence is independent of pixel intensity; this does not copy eye bytes. */
  hasRetina(tick: number, flyId: number): boolean { return this.retinalRecord(tick, flyId) !== null; }

  /** Fresh selected-fly bytes; no observer state or decoded history is retained. */
  retina(tick: number, flyId: number): { pose: EyePose; rgb: Uint8Array } | null {
    const input = this.retinalRecord(tick, flyId);
    if (!input) return null;
    const { chunk, record } = input;
    const v = (name: string) => chunk.values[record * this.valueStride + this.valueOffsets[name]];
    const width = this.layout.retinalConfig!.profile.sampleCount * 6;
    return { pose: { flyId, position: [v("inputX"),v("inputHeight"),v("inputZ")], rotation: [v("inputRotationX"),v("inputRotationY"),v("inputRotationZ"),v("inputRotationW")] }, rgb: chunk.retinaRgb.slice(record * width, (record + 1) * width) };
  }
  private retinalFrame(tick: number): RetinaBatch | null {
    const config = this.layout.retinalConfig;
    if (!config) return null;
    const inputs = Array.from({length:this.spec.flyCount}, (_, id) => this.retina(tick,id)).filter(input => input !== null);
    const rgb = new Uint8Array(inputs.length * config.profile.sampleCount * 6);
    inputs.forEach((input,index) => rgb.set(input.rgb,index * config.profile.sampleCount * 6));
    return { request: { attemptId:this.spec.attemptId,clientGeneration:config.clientGeneration,tick,profileHash:config.profile.profileHash,sceneId:config.sceneId,poses:inputs.map(input=>input.pose) }, rgb };
  }

  /** Playback reads body/neural state; selected eye views use retina() directly. */
  frame(tick: number, options: { retina?: boolean } = {}): AttemptFrame {
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
    const chunk = this.chunkAt(tick);
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
          support: s("support") === this.layout.noSupport ? null : s("support"),
          rotation: [v("rotationX"), v("rotationY"), v("rotationZ"), v("rotationW")] as BodyState["rotation"],
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
                vision: {
                  brightness: Array.from({ length: 8 }, () => 0) as SensorySample["vision"]["brightness"],
                  blocked: Array.from({ length: 8 }, () => 0) as SensorySample["vision"]["blocked"],
                },
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
      ...(this.layout.retinalConfig && options.retina !== false ? { retina: this.retinalFrame(tick)! } : {}),
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

function validSupport(support: number | null, rotation: readonly number[], mode: BodyMode, sentinel: number): boolean {
  return (support === null || (integer(support) && support <= 0xffffffff && support !== sentinel && (mode === "walking" || mode === "feeding"))) &&
    Array.isArray(rotation) && rotation.length === 4 && rotation.every(Number.isFinite) &&
    Math.abs(rotation.reduce((sum, v) => sum + v * v, 0) - 1) <= 1e-8;
}
