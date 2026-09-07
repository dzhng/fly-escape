import { expect, test } from "bun:test";
import { unlockedLevelCount, type CampaignLevel } from "./campaign";
import { emptyProgress, awardResult } from "./progress";

test("one earned star unlocks only the next sequential level and a reset relocks later levels", () => {
  const levels = ["a", "b", "c"].map((id) => ({ level: { id } })) as CampaignLevel[];
  let progress = emptyProgress();
  expect(unlockedLevelCount(levels, progress)).toBe(1);
  progress.bestStars.c = 3;
  expect(unlockedLevelCount(levels, progress)).toBe(1);
  progress = awardResult(progress, "a", {
    attemptId: "earned",
    stars: 1,
    completedTick: 1,
    outcomes: { escaped: 1, starved: 0, zapped: 0, timedOut: 19, score: 1 },
  });
  expect(unlockedLevelCount(levels, progress)).toBe(2);
  progress.bestStars.b = 1;
  expect(unlockedLevelCount(levels, progress)).toBe(3);
  expect(unlockedLevelCount(levels, emptyProgress())).toBe(1);
  expect(unlockedLevelCount([], progress)).toBe(0);
});
