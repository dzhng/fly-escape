import { expect, test } from "bun:test";
import * as THREE from "three";
import { loadPlacementModel, PlacementModels } from "./placement-models";

test("edible assets preserve native metres while floor cues retain catalog scaling", async () => {
  const food = new PlacementModels();
  food.setPlacements(
    [{ id: 1, kind: "fruit", position: { x: 3, z: 4 }, heading: 0.4 }],
    [
      {
        kind: "fruit",
        footprintRadius: 0.35,
        contact: "apple",
        edible: true,
        effect: {
          type: "source",
          kind: "attractiveOdor",
          radius: 0.75,
          rate: 1,
        },
      },
    ],
  );
  for (const kind of ["fruit", "crumbs"] as const) {
    const model = await loadPlacementModel(
      await Bun.file(new URL(`../../../assets/food/${kind === "fruit" ? "apple/apple" : kind}.glb`, import.meta.url)).arrayBuffer(), kind,
    );
    expect(model.bounds.max.y).toBeLessThanOrEqual(kind === "fruit" ? 0.1 : 0.005001);
    expect(model.bounds.min.y).toBeGreaterThanOrEqual(-0.000001);
    expect(model.triangles).toBeGreaterThan(50);
    food.replace(kind, model.root);
  }
  const box = new THREE.Box3().setFromObject(food.root, true);
  expect(box.min.x).toBeGreaterThan(2.95);
  expect(box.max.z).toBeLessThan(4.05);
  expect(box.max.y).toBeGreaterThan(0.05);
  expect(box.max.x - box.min.x).toBeGreaterThan(0.075);
  expect(food.root.children).toHaveLength(1);
  food.setPlacements([], []);
  expect(food.root.children).toHaveLength(0);
  food.dispose();
});

for (const kind of ["fruit", "banana", "crumbs", "vinegar", "fan", "lamp", "shade"] as const)
  test(`${kind} shared geometry survives edits and is released once when replaced`, async () => {
    const food = new PlacementModels();
    const load = () =>
      Bun.file(
        new URL(
          `../../../assets/${kind === "fan" || kind === "vinegar" ? "household" : kind === "fruit" || kind === "banana" || kind === "crumbs" ? "food" : "tools"}/${kind === "fruit" ? "apple/apple" : kind === "banana" ? "banana/banana" : kind === "fan" || kind === "vinegar" ? `${kind}/${kind}` : kind}.glb`,
          import.meta.url,
        ),
      )
        .arrayBuffer()
        .then(bytes => loadPlacementModel(bytes, kind));
    const first = await load();
    let released = 0;
    const geometries = new Set<THREE.BufferGeometry>();
    first.root.traverse((object) => {
      if (object instanceof THREE.Mesh) geometries.add(object.geometry);
    });
    for (const geometry of geometries) geometry.addEventListener("dispose", () => released++);
    const meshes = geometries.size;
    food.replace(kind, first.root);
    food.setPlacements([], []);
    expect(released).toBe(0);
    food.replace(kind, (await load()).root);
    expect(released).toBe(meshes);
    food.dispose();
    expect(released).toBe(meshes);
  });

for (const kind of ["lamp", "shade"] as const)
  test(`${kind} is a finite static floor surface within its placement footprint`, async () => {
    const model = await loadPlacementModel(
      await Bun.file(new URL(`../../../assets/tools/${kind}.glb`, import.meta.url)).arrayBuffer(), kind,
    );
    expect(model.triangles).toBeGreaterThan(0);
    expect(model.bounds.max.y).toBeLessThanOrEqual(0.005001);
    expect(model.bounds.min.y).toBeGreaterThanOrEqual(-0.000001);
    model.dispose();
  });

test("banana stays native sized after placement and rejects mismatched apple geometry", async () => {
  const bytes = await Bun.file(new URL("../../../assets/food/banana/banana.glb", import.meta.url)).arrayBuffer();
  await expect(loadPlacementModel(bytes, "fruit")).rejects.toThrow("baked core contact surface");
  const model = await loadPlacementModel(bytes, "banana");
  const models = new PlacementModels();
  models.replace("banana", model.root);
  models.setPlacements([{ id: 1, kind: "banana", position: { x: 2, z: 3 }, heading: Math.PI / 2 }], [{ kind: "banana", footprintRadius: 0.12, contact: "banana", edible: true, effect: { type: "source", kind: "attractiveOdor", radius: 0.75, rate: 1 } }]);
  const bounds = new THREE.Box3().setFromObject(models.root);
  expect(bounds.max.z - bounds.min.z).toBeCloseTo(model.bounds.max.x - model.bounds.min.x, 6);
  expect(bounds.max.z - bounds.min.z).toBeGreaterThan(0.22);
  expect(bounds.max.y).toBeCloseTo(model.bounds.max.y, 6);
  models.dispose();
});


for (const [kind, folder] of [
  ["fan", "fan"], ["vinegar", "vinegar"], ["wornShoes", "worn-shoes"], ["dirtyDishes", "dirty-dishes"],
  ["laundry", "crumpled-laundry"], ["sleepingCat", "sleeping-cat"],
] as const) {
  test(`${kind} renders its exact native contact mesh without footprint scaling`, async () => {
    const model = await loadPlacementModel(await Bun.file(new URL(
      `../../../assets/household/${folder}/${folder}.glb`, import.meta.url,
    )).arrayBuffer(), kind);
    const nativeBounds = model.bounds.clone();
    const models = new PlacementModels();
    models.replace(kind, model.root);
    models.setPlacements([{ id: 1, kind, position: { x: 2, z: 3 }, heading: Math.PI / 2 }], [{
      kind, footprintRadius: 0.4, contact: kind,
      edible: false, effect: { type: "none" },
    }]);
    const bounds = new THREE.Box3().setFromObject(models.root);
    expect(bounds.max.z - bounds.min.z).toBeCloseTo(nativeBounds.max.x - nativeBounds.min.x, 6);
    expect(bounds.max.x - bounds.min.x).toBeCloseTo(nativeBounds.max.z - nativeBounds.min.z, 6);
    expect(bounds.max.y).toBeCloseTo(nativeBounds.max.y, 6);
    models.dispose();
  });
}
