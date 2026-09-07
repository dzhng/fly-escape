import { expect, test } from "bun:test";
import { awardResult, emptyProgress } from "./progress";
import type { AttemptResult } from "@fly-escape/sim-client";

test("a worse retry cannot reduce a level's saved best stars or overwrite another level", () => {
  const result = (attemptId: string, stars: number): AttemptResult => ({
    attemptId, stars, completedTick: 1,
    outcomes: { escaped: 20, starved: 0, zapped: 0, caught: 0, timedOut: 0, score: 20 },
  });
  let progress = awardResult(emptyProgress(), "first", result("a", 3));
  progress = awardResult(progress, "second", result("b", 2));
  progress = awardResult(progress, "first", result("c", 1));
  expect(progress.bestStars).toEqual({ first: 3, second: 2 });
});
