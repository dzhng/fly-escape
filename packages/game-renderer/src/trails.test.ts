import { expect, test } from "bun:test";
import { FlyTrails, recordedTrails } from "./trails";

const path = Array.from({ length: 41 }, (_, tick) => ({ tick, x: tick / 10, y: 0, z: 0 }));
const snapshot = (trails: FlyTrails) => {
  const count = trails.mesh.geometry.drawRange.count;
  return {
    positions: Array.from(trails.mesh.geometry.getAttribute("position").array.slice(0, count * 3)),
    colors: Array.from(trails.mesh.geometry.getAttribute("color").array.slice(0, count * 4)),
  };
};
test("trail geometry is bounded, fades by playback time and restores exact seek state", () => {
  const trails = new FlyTrails(1);
  trails.sample([path], 40);
  const end = snapshot(trails);
  const xs = end.positions.filter((_, i) => i % 3 === 0);
  expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(2);
  expect(trails.mesh.geometry.drawRange.count).toBeLessThanOrEqual(30 * 6);
  const alphas = end.colors.filter((_, i) => i % 4 === 3);
  expect(Math.max(...alphas)).toBeCloseTo(0.8);
  expect(Math.min(...alphas)).toBeLessThan(0.1);
  trails.sample([path], 10);
  expect(Math.max(...snapshot(trails).positions.filter((_, i) => i % 3 === 0))).toBe(1);
  trails.sample([path], 40);
  expect(snapshot(trails)).toEqual(end);
  trails.sample([path], 40);
  expect(snapshot(trails)).toEqual(end);
  trails.sample([path], 71);
  expect(trails.mesh.geometry.drawRange.count).toBe(0);
});
test("discontinuities stop paths and fresh attempts contain no old vertices", () => {
  const trails = new FlyTrails(1);
  const broken = path.map((p) => ({ ...p, breakBefore: p.tick === 38 }));
  trails.sample([broken], 40);
  const xs = snapshot(trails).positions.filter((_, i) => i % 3 === 0);
  expect(Math.min(...xs)).toBeCloseTo(3.8);
  trails.sample([[]], 0);
  expect(trails.mesh.geometry.drawRange.count).toBe(0);
  expect(() => trails.sample([], 0)).toThrow("population");
});

test("recorded trails preserve mode height, detect input discontinuity and stop at terminal", () => {
  const history = [
    { tick: 1, x: 0.1, z: 0, inputX: 0, inputZ: 0, mode: "flying" as const, terminal: false },
    { tick: 2, x: 0.2, z: 0, inputX: 0.1, inputZ: 0, mode: "walking" as const, terminal: false },
    { tick: 3, x: 0.3, z: 0, inputX: 0.2, inputZ: 0, mode: "walking" as const, terminal: false },
    { tick: 4, x: 4, z: 0, inputX: 3.9, inputZ: 0, mode: "feeding" as const, terminal: true },
    { tick: 5, x: 4, z: 0, inputX: 4, inputZ: 0, mode: "feeding" as const, terminal: true },
  ];
  const recorded = history.map((pose) => ({
    ...pose,
    motion: {
      mode: pose.mode,
      previousMode: "flying" as const,
      startedTick: pose.mode === "walking" ? 2 : pose.tick,
      cursorTick: pose.tick,
    },
  }));
  const points = recordedTrails([recorded], 5.5, [{ x: 99, y: 99, z: 99 }], 0.1)[0];
  expect(points).toHaveLength(4);
  expect(points[0].y).toBe(0.6);
  expect(points[1].y).toBe(0.6);
  expect(points[2].y).toBeGreaterThan(0);
  expect(points[2].y).toBeLessThan(0.6);
  expect(points[3].y).toBe(0);
  expect(points[3].breakBefore).toBe(true);
  const fractional = recordedTrails(
    [recorded.slice(0, 1)],
    1.5,
    [{ x: 0.15, y: 0.6, z: 0 }],
    0.1,
  )[0];
  expect(fractional.at(-1)).toEqual({ x: 0.15, y: 0.6, z: 0, tick: 1.5 });
});
