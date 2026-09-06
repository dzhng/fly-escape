import { expect, test } from "bun:test";
import { PlaybackClock } from "./playback";

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

test("pause, hidden time, speed changes and seeking preserve one cursor without catch-up", () => {
  const clock = new PlaybackClock(1000);
  const progress = { computedTick: 1000, complete: true, productionRate: 0 };
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
  clock.setSpeed(2);
  clock.update(201000, progress);
  clock.update(202000, progress);
  expect(clock.cursorTick).toBe(40);
  clock.seek(5, progress.computedTick);
  clock.update(203000, progress);
  expect(clock.cursorTick).toBe(5);
  expect(() => clock.seek(1001, 1000)).toThrow();
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

test("a worse production estimate and 2× consumption require renewed buffering", () => {
  const clock = new PlaybackClock(1000);
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
  clock.setSpeed(2);
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
