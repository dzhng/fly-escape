import { test, expect } from "bun:test";
import * as THREE from "three";
import { FlyModel, loadFlyModel } from "./fly-model";
import { disposeObjectResources } from "./resources";

test("replacement with geometry far from its pivot is rejected instead of disappearing from follow", () => {
  const root = new THREE.Group();
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial());
  mesh.position.set(100, 0.5, 0);
  root.add(mesh);
  try {
    expect(() => {
      new FlyModel(root, []);
    }).toThrow(/origin/);
  } finally {
    disposeObjectResources(root);
  }
});

test("authored GLB has finite grounded bounds and independently poseable clones", async () => {
  const model = await loadFlyModel(
    await Bun.file(new URL("../../../assets/fly/fly.glb", import.meta.url)).arrayBuffer(),
  );
  const instance = model.instantiate();
  expect([...model.bounds.min, ...model.bounds.max].every(Number.isFinite)).toBe(true);
  const bone = model.root.getObjectByProperty("type", "Bone")!;
  const copy = instance.getObjectByName(bone.name)!;
  const original = bone.position.clone();
  copy.position.x += 1;
  expect(bone.position.equals(original)).toBe(true);
  const owner = new THREE.Group();
  owner.add(model.root, instance);
  disposeObjectResources(owner);
});
