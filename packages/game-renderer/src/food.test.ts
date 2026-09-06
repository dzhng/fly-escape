import { expect, test } from "bun:test";
import * as THREE from "three";
import { loadFoodModel, FoodModels } from "./food";

test("food assets fit catalog-scaled floor footprints and replacement preserves placement", async () => {
  const food = new FoodModels();
  food.setPlacements(
    [{ id: 1, kind: "fruit", position: { x: 3, z: 4 }, heading: 0.4 }],
    [
      {
        kind: "fruit",
        footprintRadius: 0.35,
        effect: {
          type: "source",
          kind: "attractiveOdor",
          radius: 0.75,
          rate: 1,
          foodRadius: 0.4,
        },
      },
    ],
  );
  for (const kind of ["fruit", "crumbs"] as const) {
    const model = await loadFoodModel(
      await Bun.file(
        new URL(`../../../assets/food/${kind}.glb`, import.meta.url),
      ).arrayBuffer(),
    );
    expect(model.bounds.max.y).toBeLessThanOrEqual(0.005001);
    expect(model.bounds.min.y).toBeGreaterThanOrEqual(-0.000001);
    expect(model.triangles).toBeGreaterThan(50);
    food.replace(kind, model.root);
  }
  const box = new THREE.Box3().setFromObject(food.root, true);
  expect(box.min.x).toBeGreaterThanOrEqual(3 - 0.350001);
  expect(box.max.z).toBeLessThanOrEqual(4 + 0.350001);
  expect(food.root.children).toHaveLength(1);
  food.setPlacements([], []);
  expect(food.root.children).toHaveLength(0);
  food.dispose();
});

test("shared food geometry survives edits and is released once when replaced", async () => {
  const food = new FoodModels();
  const load = () =>
    Bun.file(new URL("../../../assets/food/fruit.glb", import.meta.url))
      .arrayBuffer()
      .then(loadFoodModel);
  const first = await load();
  let released = 0;
  first.root.traverse((object) => {
    if (object instanceof THREE.Mesh)
      object.geometry.addEventListener("dispose", () => released++);
  });
  const meshes = first.root.children.length;
  food.replace("fruit", first.root);
  food.setPlacements([], []);
  expect(released).toBe(0);
  food.replace("fruit", (await load()).root);
  expect(released).toBe(meshes);
  food.dispose();
  expect(released).toBe(meshes);
});
