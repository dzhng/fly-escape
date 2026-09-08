import type { PlaybackClock } from "@fly-escape/sim-client";

/** Finish exit visuals after the recorded horizon, without advancing simulation or scoring. */
export class DepartureTail {
  seconds = 0;
  private lastNow: number | null = null;
  suspend(): void {
    this.lastNow = null;
  }
  update(now: number, clock: Pick<PlaybackClock, "cursorTick" | "state" | "speed">, completedTick?: number): void {
    if (completedTick === undefined || clock.cursorTick < completedTick) {
      this.seconds = 0;
      this.lastNow = null;
      return;
    }
    if (clock.state !== "ended") {
      this.lastNow = null;
      return;
    }
    if (this.lastNow !== null)
      this.seconds = Math.min(8, this.seconds + Math.max(0, now - this.lastNow) * clock.speed / 1000);
    this.lastNow = now;
  }
}
