import { expect, test } from "bun:test";
import { PlaybackClock, type PlaybackMode } from "./playback";

test("initial lead covers sustained underproduction rather than a short buffer", () => {
  const clock = new PlaybackClock(1000);
  clock.play();
  clock.update(0, { computedTick: 40, complete: false, productionRate: 0.5 });
  expect(clock.state).toBe("buffering");
  clock.update(1000, {
    computedTick: 610,
    complete: false,
    productionRate: 0.5,
  });
  // Discounted R=.4; required lead is39*1.5+2=60.5 seconds.
  expect(clock.state).toBe("playing");
  expect(clock.cursorTick).toBe(0);
  clock.update(1100, {
    computedTick: 610,
    complete: false,
    productionRate: 0.5,
  });
  expect(clock.cursorTick).toBeCloseTo(1);
});

test("pause, hidden time, mode changes and seeking preserve one cursor without catch-up", () => {
  const clock = new PlaybackClock(1200);
  const progress = { computedTick: 1200, complete: true, productionRate: 0 };
  clock.play();
  clock.update(0, progress);
  clock.update(1000, progress);
  expect(clock.cursorTick).toBe(10);
  clock.pause();
  clock.update(9000, progress);
  expect(clock.cursorTick).toBe(10);
  expect(clock.state).toBe("paused");
  clock.play();
  clock.update(10000, progress);
  clock.update(11000, progress);
  expect(clock.cursorTick).toBe(20);
  clock.setHidden(true);
  clock.update(100000, progress);
  expect(clock.state).toBe("hidden");
  clock.setHidden(false);
  clock.update(200000, progress);
  expect(clock.cursorTick).toBe(20);
  // A 120 game-second horizon fits into a wall minute at 2×.
  clock.setMode("fast");
  clock.update(201000, progress);
  clock.update(202000, progress);
  expect(clock.cursorTick).toBe(40);
  clock.seek(5, progress.computedTick);
  clock.update(203000, progress);
  expect(clock.cursorTick).toBe(5);
  expect(() => clock.seek(1201, 1200)).toThrow();
  clock.pause();
  clock.setHidden(true);
  clock.setHidden(false);
  clock.update(300000, progress);
  expect(clock.state).toBe("paused");
  expect(clock.cursorTick).toBe(5);
});

test("depleted buffers freeze and rebuild a substantial lead before resuming", () => {
  const clock = new PlaybackClock(1000);
  clock.play();
  const progress = { computedTick: 30, complete: false, productionRate: 2 };
  clock.update(0, progress);
  clock.update(4000, progress);
  expect(clock.cursorTick).toBe(30);
  expect(clock.state).toBe("buffering");
  clock.update(4100, { ...progress, computedTick: 31 });
  clock.update(4200, { ...progress, computedTick: 32 });
  expect(clock.cursorTick).toBe(30);
  expect(clock.state).toBe("buffering");
  clock.update(7000, { ...progress, computedTick: 60 });
  expect(clock.cursorTick).toBe(30);
  expect(clock.state).toBe("playing");
  clock.update(7100, { ...progress, computedTick: 60 });
  expect(clock.cursorTick).toBeCloseTo(31);
});

test("a worse production estimate and fast consumption require renewed buffering", () => {
  const clock = new PlaybackClock(1200);
  clock.play();
  clock.update(0, { computedTick: 100, complete: false, productionRate: 2 });
  clock.update(100, {
    computedTick: 100,
    complete: false,
    productionRate: 0.1,
  });
  expect(clock.cursorTick).toBe(0);
  expect(clock.state).toBe("buffering");
  clock.update(200, { computedTick: 100, complete: false, productionRate: 2 });
  expect(clock.state).toBe("playing");
  clock.setMode("fast");
  clock.update(300, { computedTick: 100, complete: false, productionRate: 2 });
  expect(clock.state).toBe("buffering");
});

test("completed records can replay at zero production rate and stop at early terminal time", () => {
  const clock = new PlaybackClock(1000);
  const progress = { computedTick: 7, complete: true, productionRate: 0 };
  clock.update(0, progress);
  expect(clock.state).toBe("paused");
  clock.play();
  clock.update(10, progress);
  clock.update(1010, progress);
  expect(clock.cursorTick).toBe(7);
  expect(clock.state).toBe("ended");
  clock.seek(0, 7);
  clock.update(2010, progress);
  clock.update(2110, progress);
  expect(clock.cursorTick).toBe(1);
  clock.pause();
  clock.update(4000, progress);
  expect(clock.state).toBe("paused");
});

test("fast mode plays the authored horizon in one wall minute", () => {
  expect(new PlaybackClock(3000).fastMultiplier).toBe(5);
  expect(new PlaybackClock(6000).fastMultiplier).toBe(10);
  // Nothing plays slower than real time, so short horizons stay at 1×.
  expect(new PlaybackClock(400).fastMultiplier).toBe(1);
  expect(new PlaybackClock(600).fastMultiplier).toBe(1);

  for (const durationTicks of [3000, 6000]) {
    const clock = new PlaybackClock(durationTicks, 0.1, "fast");
    const progress = { computedTick: durationTicks, complete: true, productionRate: 0 };
    clock.play();
    clock.update(0, progress);
    clock.update(30000, progress);
    expect(clock.cursorTick).toBe(durationTicks / 2);
    clock.update(60000, progress);
    expect(clock.cursorTick).toBe(durationTicks);
    expect(clock.state).toBe("ended");
  }
});

test("playback offers exactly two modes and no other speed", () => {
  const clock = new PlaybackClock(3000);
  expect(clock.mode).toBe("realTime");
  expect(clock.speed).toBe(1);
  clock.setMode("fast");
  expect(clock.mode).toBe("fast");
  expect(clock.speed).toBe(5);
  clock.setMode("realTime");
  expect(clock.mode).toBe("realTime");
  expect(clock.speed).toBe(1);
  expect(() => clock.setMode(2 as unknown as PlaybackMode)).toThrow();
  expect(() => clock.setMode("turbo" as unknown as PlaybackMode)).toThrow();
  expect(
    () => new PlaybackClock(3000, 0.1, "2x" as unknown as PlaybackMode),
  ).toThrow();
});

test("switching modes keeps the cursor and rechecks lead instead of jumping", () => {
  const clock = new PlaybackClock(3000);
  const progress = { computedTick: 3000, complete: true, productionRate: 0 };
  clock.play();
  clock.update(0, progress);
  clock.update(2000, progress);
  expect(clock.cursorTick).toBe(20);
  clock.setMode("fast");
  expect(clock.cursorTick).toBe(20);
  // Resuming after the switch consumes no time waiting for the lead check.
  clock.update(2500, progress);
  expect(clock.cursorTick).toBe(20);
  clock.update(3500, progress);
  expect(clock.cursorTick).toBe(70);
  clock.setMode("realTime");
  expect(clock.cursorTick).toBe(70);
  clock.update(4000, progress);
  clock.update(5000, progress);
  expect(clock.cursorTick).toBe(80);
});

test("fast playback sizes its lead by the fast multiplier, not by real time", () => {
  const slow = { computedTick: 1000, complete: false, productionRate: 2 };
  const realTime = new PlaybackClock(3000);
  realTime.play();
  realTime.update(0, slow);
  expect(realTime.state).toBe("playing");

  const fast = new PlaybackClock(3000, 0.1, "fast");
  fast.play();
  // The same producer keeps up with real time but not with 5× consumption.
  fast.update(0, slow);
  expect(fast.state).toBe("buffering");
  expect(fast.cursorTick).toBe(0);
  // Production close to the horizon leaves only a small shortfall to absorb.
  fast.update(1000, { ...slow, computedTick: 2900 });
  expect(fast.state).toBe("playing");
  fast.update(1100, { ...slow, computedTick: 2900 });
  expect(fast.cursorTick).toBeCloseTo(5);
});

test("a fast attempt that ends early finishes sooner and is never stretched", () => {
  const clock = new PlaybackClock(3000, 0.1, "fast");
  const progress = { computedTick: 900, complete: true, productionRate: 0 };
  clock.play();
  clock.update(0, progress);
  clock.update(17000, progress);
  expect(clock.cursorTick).toBe(850);
  expect(clock.state).toBe("playing");
  // 90 recorded game seconds take 18 wall seconds at 5×, not the full minute.
  clock.update(18000, progress);
  expect(clock.cursorTick).toBe(900);
  expect(clock.state).toBe("ended");
});

test("hidden tabs and pauses behave the same in fast mode", () => {
  const clock = new PlaybackClock(6000, 0.1, "fast");
  const progress = { computedTick: 6000, complete: true, productionRate: 0 };
  clock.play();
  clock.update(0, progress);
  clock.update(1000, progress);
  expect(clock.cursorTick).toBe(100);
  clock.setHidden(true);
  clock.update(31000, progress);
  expect(clock.state).toBe("hidden");
  expect(clock.cursorTick).toBe(100);
  clock.setHidden(false);
  clock.update(31500, progress);
  expect(clock.cursorTick).toBe(100);
  clock.update(32500, progress);
  expect(clock.cursorTick).toBe(200);
  clock.pause();
  clock.update(90000, progress);
  expect(clock.state).toBe("paused");
  expect(clock.cursorTick).toBe(200);
});
