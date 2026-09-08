import { test, expect } from "bun:test";
import { PlaybackClock } from "@fly-escape/sim-client";
import { departingFly } from "@fly-escape/game-renderer";
import { DepartureTail } from "./departure-tail";

test("last escape finishes after early completion, pauses, and resets when replay rewinds", () => {
  const clock = new PlaybackClock(3000, 0.1, "fast");
  const tail = new DepartureTail();
  const progress = { complete: true, computedTick: 7, productionRate: 1 };
  clock.play(); clock.seek(7, 7); clock.update(0, progress);
  tail.update(0, clock, 7); tail.update(1000, clock, 7);
  expect(tail.seconds).toBe(5);
  clock.setHidden(true); tail.suspend();
  clock.setHidden(false); clock.update(1100, progress);
  tail.update(1100, clock, 7);
  expect(tail.seconds).toBe(5);
  clock.pause(); tail.update(2000, clock, 7);
  expect(tail.seconds).toBe(5);
  clock.play(); clock.update(3000, progress); tail.update(3000, clock, 7);
  tail.update(4000, clock, 7);
  expect(tail.seconds).toBe(8);
  expect(clock.cursorTick).toBe(7);
  expect(departingFly({ x: 0, y: 0, z: 0, heading: 0 }, tail.seconds, { x: -1, z: 0 }).hidden).toBe(true);
  clock.seek(0, 7); tail.update(5000, clock, 7);
  expect(tail.seconds).toBe(0);
});
