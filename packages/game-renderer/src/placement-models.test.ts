import { expect, test } from "bun:test";
import * as THREE from "three";
import { loadPlacementModel, PlacementModels } from "./placement-models";

test("food assets fit catalog-scaled floor footprints and replacement preserves placement", async () => {
  const food = new PlacementModels();
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
    const model = await loadPlacementModel(
      await Bun.file(new URL(`../../../assets/food/${kind}.glb`, import.meta.url)).arrayBuffer(),
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
  const food = new PlacementModels();
  const load = () =>
    Bun.file(new URL("../../../assets/food/fruit.glb", import.meta.url))
      .arrayBuffer()
      .then(loadPlacementModel);
  const first = await load();
  let released = 0;
  first.root.traverse((object) => {
    if (object instanceof THREE.Mesh) object.geometry.addEventListener("dispose", () => released++);
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

for (const kind of ["vinegar", "fan", "lamp", "shade"])
  test(`${kind} is a finite static floor surface within its placement footprint`, async () => {
    const model = await loadPlacementModel(
      await Bun.file(new URL(`../../../assets/tools/${kind}.glb`, import.meta.url)).arrayBuffer(),
    );
    expect(model.triangles).toBeGreaterThan(0);
    expect(model.bounds.max.y).toBeLessThanOrEqual(0.005001);
    expect(model.bounds.min.y).toBeGreaterThanOrEqual(-0.000001);
    model.dispose();
  });

test("authored fan direction follows placement heading and restores after editing", async () => {
  const models = new PlacementModels();
  const model = await loadPlacementModel(
    await Bun.file(new URL("../../../assets/tools/fan.glb", import.meta.url)).arrayBuffer(),
  );
  models.replace("fan", model.root);
  const catalog = [
    {
      kind: "fan" as const,
      footprintRadius: 0.25,
      effect: { type: "fan" as const, reach: 3, halfWidth: 0.75, speed: 0.5 },
    },
  ];
  const direction = (heading: number) => {
    models.setPlacements([{ id: 1, kind: "fan", position: { x: 2, z: 3 }, heading }], catalog);
    const arrow = models.root.getObjectByName("ForwardChevron") as THREE.Mesh;
    arrow.geometry.computeBoundingBox();
    models.root.updateMatrixWorld(true);
    return arrow.geometry
      .boundingBox!.getCenter(new THREE.Vector3())
      .applyMatrix4(arrow.matrixWorld)
      .sub(new THREE.Vector3(2, 0, 3));
  };
  const initial = direction(0);
  expect(initial.x).toBeGreaterThan(0.1);
  expect(Math.abs(initial.z)).toBeLessThan(1e-6);
  const turned = direction(Math.PI / 2);
  expect(turned.z).toBeGreaterThan(0.1);
  expect(Math.abs(turned.x)).toBeLessThan(1e-6);
  expect(direction(0).equals(initial)).toBe(true);
  models.dispose();
});
