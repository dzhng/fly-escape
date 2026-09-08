import { expect, test } from "bun:test";
import { Color } from "three";
import { groupColor } from "./brain-view";

test("legend colours are understood by the renderer and distinguish groups", () => {
  const first = new Color(groupColor(0));
  const next = new Color(groupColor(1));
  expect(first.r).toBeGreaterThan(first.g);
  expect(next.g).toBeGreaterThan(next.r);
  expect(first.equals(next)).toBe(false);
});
