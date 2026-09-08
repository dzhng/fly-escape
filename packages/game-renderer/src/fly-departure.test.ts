import { expect, test } from "bun:test";
import { departingFly } from "./fly-departure";

test("escape departure heads outward, climbs, shrinks and restores on backward seek", () => {
  const source = { x: 0, y: 0.5, z: 2, heading: 1, outcome: "escaped" as const };
  const start = departingFly(source, 0, { x: -1, z: 0 });
  const middle = departingFly(source, 4, { x: -1, z: 0 });
  expect(start.x).toBe(source.x);
  expect(middle.x).toBeLessThan(source.x);
  expect(middle.y).toBeGreaterThan(source.y);
  expect(middle.focus).toEqual([0, 0.5, 2]);
  expect(middle.presentationScale).toBeLessThan(1);
  expect(middle.animation?.clip).toBe("Fly");
  expect(departingFly(source, 8, { x: -1, z: 0 }).hidden).toBe(true);
  expect(departingFly(source, 0, { x: -1, z: 0 })).toEqual(start);
  expect(departingFly(source, 2, { x: 1, z: 0 }).x).toBeGreaterThan(source.x);
  expect(source).toEqual({ x: 0, y: 0.5, z: 2, heading: 1, outcome: "escaped" });
});
