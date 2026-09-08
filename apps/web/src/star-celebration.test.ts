import { expect, test } from "bun:test";
import { WatchedStars } from "./star-celebration";

test("stars celebrate when watched, once per milestone despite replay and seeking", () => {
  const seen = new WatchedStars();
  const thresholds = [4, 9, 15];
  expect(seen.observe(15, thresholds, false)).toBeUndefined();
  expect(seen.observe(3, thresholds, true)).toBeUndefined();
  expect(seen.observe(4, thresholds, true)).toBe(1);
  expect(seen.observe(8, thresholds, true)).toBeUndefined();
  expect(seen.observe(0, thresholds, true)).toBeUndefined();
  expect(seen.observe(4, thresholds, true)).toBeUndefined();
  expect(seen.observe(15, thresholds, false)).toBeUndefined();
  expect(seen.observe(15, thresholds, true)).toBe(3);
  expect(seen.observe(9, thresholds, true)).toBeUndefined();
  expect(seen.observe(15, thresholds, true)).toBeUndefined();
  expect(new WatchedStars().observe(9, thresholds, true)).toBe(2);
});
