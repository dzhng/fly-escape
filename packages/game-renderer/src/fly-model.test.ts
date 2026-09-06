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

test("authored clips restore identical skinned mesh phase after reverse seek without root motion", async () => {
  const { FlyMotion } = await import("./fly-motion");
  const model = await loadFlyModel(
    await Bun.file(new URL("../../../assets/fly/fly.glb", import.meta.url)).arrayBuffer(),
  );
  const motion = new FlyMotion(model.root, model.clips);
  const pose = () => {
    model.root.updateMatrixWorld(true);
    const values: number[] = [];
    model.root.traverse((node) => {
      if (!(node instanceof THREE.SkinnedMesh)) return;
      node.skeleton.update();
      for (let i = 0; i < node.geometry.attributes.position.count; i++)
        values.push(...node.getVertexPosition(i, new THREE.Vector3()));
    });
    return values;
  };
  for (const clip of ["Walk", "Fly", "Land", "Feed"] as const) {
    motion.sample({ clip, seconds: 0.05 });
    const first = pose();
    motion.sample({ clip, seconds: clip === "Feed" ? 0.5 : 0.125 });
    expect(Math.max(...pose().map((value, i) => Math.abs(value - first[i])))).toBeGreaterThan(1e-5);
    motion.sample({ clip, seconds: 0.05 });
    expect(pose()).toEqual(first);
    motion.sample({ clip, seconds: 100.05 });
    expect(model.root.position.toArray()).toEqual([0, 0, 0]);
    if (clip !== "Land") {
      const looped = pose();
      expect(Math.max(...looped.map((value, i) => Math.abs(value - first[i])))).toBeLessThan(1e-10);
    }
  }
  motion.dispose();
  model.dispose();
});
