import { expect, test } from "bun:test";
import { flyAnimation } from "./fly-motion";

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
