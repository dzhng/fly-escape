export type PlaybackState =
  "paused" | "buffering" | "playing" | "hidden" | "ended";
/** Real time, or fast enough to fit one authored attempt into a wall minute. */
export type PlaybackMode = "realTime" | "fast";
export type ProductionProgress = {
  computedTick: number;
  complete: boolean;
  /** Game seconds produced per wall second, measured from active neural work.
   * Loading and terminal no-op ticks must not enter this rate. */
  productionRate: number;
};

/** Wall seconds a fast replay of the whole authored horizon should occupy. */
const FAST_ATTEMPT_SECONDS = 60;

/** One fractional tick cursor for every visible consumer. Wall timestamps are
 * milliseconds; graph cadence remains a separate, fixed simulation concern. */
export class PlaybackClock {
  /** Game seconds per wall second in fast mode, from the authored horizon.
   * Attempts that end early simply finish sooner; they are never stretched. */
  readonly fastMultiplier: number;
  private cursor = 0;
  private currentMode: PlaybackMode;
  private requested = false;
  private hidden = false;
  private lastNow: number | null = null;
  private currentState: PlaybackState = "paused";
  constructor(
    readonly durationTicks: number,
    readonly tickSeconds = 0.1,
    mode: PlaybackMode = "realTime",
  ) {
    if (
      !Number.isInteger(durationTicks) ||
      durationTicks < 1 ||
      durationTicks > 6000 ||
      !Number.isFinite(tickSeconds) ||
      tickSeconds <= 0
    )
      throw new Error("Invalid playback horizon");
    this.currentMode = validMode(mode);
    this.fastMultiplier = Math.max(
      1,
      (durationTicks * tickSeconds) / FAST_ATTEMPT_SECONDS,
    );
  }
  get cursorTick() {
    return this.cursor;
  }
  get state() {
    return this.currentState;
  }
  get mode() {
    return this.currentMode;
  }
  /** Game seconds consumed per wall second at the current mode. */
  get speed() {
    return this.currentMode === "fast" ? this.fastMultiplier : 1;
  }

  play() {
    if (this.requested) return;
    this.requested = true;
    this.restartLeadCheck();
  }
  pause() {
    this.requested = false;
    this.currentState = "paused";
    this.lastNow = null;
  }
  /** The cursor is kept; a faster mode may rebuild its lead instead of stuttering. */
  setMode(mode: PlaybackMode) {
    if (validMode(mode) !== this.currentMode) {
      this.currentMode = mode;
      this.restartLeadCheck();
    }
  }
  setHidden(hidden: boolean) {
    if (hidden !== this.hidden) {
      this.hidden = hidden;
      this.restartLeadCheck();
    }
  }
  seek(tick: number, computedTick: number) {
    if (
      !Number.isFinite(tick) ||
      !Number.isInteger(computedTick) ||
      tick < 0 ||
      tick > computedTick ||
      computedTick > this.durationTicks
    )
      throw new Error("Cannot seek beyond computed time");
    this.cursor = tick;
    this.restartLeadCheck();
  }

  update(nowMs: number, progress: ProductionProgress): number {
    if (
      !Number.isFinite(nowMs) ||
      !Number.isInteger(progress.computedTick) ||
      progress.computedTick < this.cursor ||
      progress.computedTick > this.durationTicks ||
      !Number.isFinite(progress.productionRate) ||
      progress.productionRate < 0
    )
      throw new Error("Invalid playback progress");
    const elapsed =
      this.lastNow === null ? 0 : Math.max(0, nowMs - this.lastNow) / 1000;
    this.lastNow = nowMs;
    if (!this.requested || this.hidden) {
      this.currentState = this.requested ? "hidden" : "paused";
      return this.cursor;
    }
    if (progress.complete && this.cursor >= progress.computedTick) {
      this.currentState = "ended";
      return this.cursor;
    }
    const speed = this.speed;
    const buffered = (progress.computedTick - this.cursor) * this.tickSeconds;
    const remaining =
      (this.durationTicks - progress.computedTick) * this.tickSeconds;
    const rate = progress.productionRate * 0.8;
    const deficit =
      rate === 0 ? Infinity : remaining * Math.max(0, speed / rate - 1);
    const lead = Math.max(3 * speed, deficit + 2 * speed);
    if (this.currentState !== "playing") {
      if (!progress.complete && (rate === 0 || buffered < lead)) {
        this.currentState = "buffering";
        return this.cursor;
      }
      this.currentState = "playing";
      // Starting/resuming consumes no time spent waiting for this lead.
      return this.cursor;
    }
    // The deficit estimate decides when it is safe to start, never whether to
    // keep going: a momentarily worse estimate must not pause a deep buffer.
    // Playing stops only on frames running out, one wall second of reserve ahead
    // of empty so arriving production ticks are not raced.
    if (!progress.complete && buffered < speed) {
      this.currentState = "buffering";
      return this.cursor;
    }
    const next = this.cursor + (elapsed * speed) / this.tickSeconds;
    this.cursor = Math.min(progress.computedTick, next);
    if (next >= progress.computedTick)
      this.currentState = progress.complete ? "ended" : "buffering";
    return this.cursor;
  }
  private restartLeadCheck() {
    this.lastNow = null;
    this.currentState = this.requested
      ? this.hidden
        ? "hidden"
        : "buffering"
      : "paused";
  }
}

function validMode(mode: PlaybackMode): PlaybackMode {
  if (mode !== "realTime" && mode !== "fast")
    throw new Error("Playback offers real time and fast only");
  return mode;
}
