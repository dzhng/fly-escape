import { expect, test } from "bun:test";
import { unlockedLevelCount, type CampaignLevel } from "./campaign";
import { emptyProgress, awardStars } from "./progress";

test("one earned star unlocks only the next sequential level and a reset relocks later levels", () => {
  const levels = ["a", "b", "c"].map((id) => ({ level: { id } })) as CampaignLevel[];
  let progress = emptyProgress();
  expect(unlockedLevelCount(levels, progress)).toBe(1);
  progress.bestStars.c = 3;
  expect(unlockedLevelCount(levels, progress)).toBe(1);
  progress = awardStars(progress, "a", 1);
  expect(unlockedLevelCount(levels, progress)).toBe(2);
  progress.bestStars.b = 1;
  expect(unlockedLevelCount(levels, progress)).toBe(3);
  expect(unlockedLevelCount(levels, emptyProgress())).toBe(1);
  expect(unlockedLevelCount([], progress)).toBe(0);
});
