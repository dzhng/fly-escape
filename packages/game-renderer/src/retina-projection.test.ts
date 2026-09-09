import { expect, test } from "bun:test";
import { RetinaProjection } from "./retina-projection";

test("compound sampling preserves color and eye-image handedness", () => {
  const projection = new RetinaProjection({ width: 32, height: 32, radius: 4, distortion: 0, zoom: 1 });
  const pixels = new Float32Array(32 * 32 * 4);
  for (let row = 0; row < 32; row++) for (let col = 0; col < 32; col++) {
    const offset = ((31 - row) * 32 + col) * 4;
    pixels.set([col < 16 ? 1 : 0, row < 16 ? 1 : 0, 173 / 255, 1], offset);
  }
  const sampled = projection.sample(pixels, 32, 0, 0);
  const at = (q: number, r: number) => {
    const index = projection.cells.findIndex(cell => cell.q === q && cell.r === r);
    return Array.from(sampled.slice(index * 3, index * 3 + 3));
  };
  expect(at(-3, 0)[0]).toBe(255);
  expect(at(3, 0)[0]).toBe(0);
  expect(at(0, -3)[1]).toBe(255);
  expect(at(0, 3)[1]).toBe(0);
  expect(Array.from(sampled).filter((_, index) => index % 3 === 2).every(value => value === 173)).toBe(true);
});

test("nonfinite optical pixels fail instead of becoming black neural samples", () => {
  const projection = new RetinaProjection({ width: 32, height: 32, radius: 4, distortion: 0, zoom: 1 });
  const pixels = new Float32Array(32 * 32 * 4).fill(Number.NaN);
  expect(() => projection.sample(pixels, 32, 0, 0)).toThrow("nonfinite");
});
