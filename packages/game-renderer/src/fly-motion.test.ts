import { expect, test } from "bun:test";
import { flyAnimation, flyHeight } from "./fly-motion";

test("recorded landing gives way to walking, while feeding takes precedence", () => {
  const landed = { mode: "walking", previousMode: "flying", startedTick: 20, cursorTick: 23 } as const;
  const land = flyAnimation(landed, 0.1);
  expect(land.clip).toBe("Land");
  expect(land.seconds).toBeCloseTo(0.3, 12);
  const walking = flyAnimation({ ...landed, cursorTick: 31 }, 0.1);
  expect(walking.clip).toBe("Walk");
  expect(walking.seconds).toBeCloseTo(0.3, 12);
  expect(flyAnimation({ ...landed, mode: "feeding" }, 0.1).clip).toBe("Feed");
  expect(flyAnimation({ ...landed, mode: "flying", previousMode: "walking" }, 0.1).clip).toBe("Fly");
});


test("landing descends from flight height to ground over the landing clip", () => {
  const motion = { mode: "walking", previousMode: "flying", startedTick: 20, cursorTick: 20 } as const;
  const height = (cursorTick: number) => flyHeight({ ...motion, cursorTick }, 0.1);
  expect(height(20)).toBe(0.6);
  expect(height(24)).toBeCloseTo(0.3, 12);
  expect(height(28)).toBe(0);
  expect(flyAnimation({ ...motion, cursorTick: 28 }, 0.1).clip).toBe("Walk");
  expect(height(40)).toBe(0);
  expect(height(22)).toBeGreaterThan(height(26));
  expect(height(24)).toBeCloseTo(0.3, 12); // Reverse seek uses the same recorded phase.
});

test("feeding contact stays on the floor even directly after flight", () => {
  const motion = { mode: "feeding", previousMode: "flying", startedTick: 20, cursorTick: 20 } as const;
  for (const cursorTick of [20, 20.5, 23, 28, 21, 20]) {
    expect(flyHeight({ ...motion, cursorTick }, 0.1)).toBe(0);
    expect(flyAnimation({ ...motion, cursorTick }, 0.1).clip).toBe("Feed");
  }
  expect(flyHeight({ ...motion, mode: "flying", previousMode: "walking" }, 0.1)).toBe(0.6);
});
