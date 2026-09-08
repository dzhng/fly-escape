import { expect, test } from "bun:test";
import { awardStars, emptyProgress } from "./progress";

test("watched milestones persist without lowering an earlier best or changing another level", () => {
  let progress = awardStars(emptyProgress(), "first", 1);
  expect(progress.bestStars).toEqual({ first: 1 });
  progress = awardStars(progress, "first", 3);
  progress = awardStars(progress, "second", 2);
  const best = progress;
  progress = awardStars(progress, "first", 1);
  expect(progress).toBe(best);
  expect(progress.bestStars).toEqual({ first: 3, second: 2 });
});
