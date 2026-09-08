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
  const pose = () => skinnedVertices(model.root);
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

test("cloned flies preserve shared bone textures and independent animation", async () => {
  const { FlyMotion } = await import("./fly-motion");
  const model = await loadFlyModel(await Bun.file(new URL("../../../assets/fly/fly.glb", import.meta.url)).arrayBuffer());
  const instance = model.instantiate();
  const motion = new FlyMotion(model.root, model.clips);
  const cloneMotion = new FlyMotion(instance, model.clips);
  const textures = (root: THREE.Object3D) => {
    const result = new Set<THREE.DataTexture>();
    root.traverse(node => {
      if (!(node instanceof THREE.SkinnedMesh)) return;
      if (!node.skeleton.boneTexture) node.skeleton.computeBoneTexture();
      result.add(node.skeleton.boneTexture!);
    });
    return result;
  };
  const owner = new THREE.Group();
  owner.add(model.root, instance);
  try {
    const sourceTextures = textures(model.root);
    const cloneTextures = textures(instance);
    expect(cloneTextures.size).toBe(sourceTextures.size);
    for (const texture of cloneTextures) expect(sourceTextures.has(texture)).toBe(false);
    for (const clip of ["Walk", "Fly", "Land", "Feed"] as const) {
      motion.sample({ clip, seconds: 0.05 });
      cloneMotion.sample({ clip, seconds: 0.05 });
      const source = skinnedVertices(model.root);
      expect(skinnedVertices(instance)).toEqual(source);
      cloneMotion.sample({ clip, seconds: 0.125 });
      expect(skinnedVertices(model.root)).toEqual(source);
      expect(skinnedVertices(instance)).not.toEqual(source);
      cloneMotion.sample({ clip, seconds: 0.05 });
      expect(skinnedVertices(instance)).toEqual(source);
    }
  } finally {
    motion.dispose();
    cloneMotion.dispose();
    disposeObjectResources(owner);
  }
});

function skinnedVertices(root: THREE.Object3D): number[] {
  root.updateMatrixWorld(true);
  const result: number[] = [];
  root.traverse(node => {
    if (!(node instanceof THREE.SkinnedMesh)) return;
    node.skeleton.update();
    for (let i = 0; i < node.geometry.attributes.position.count; i++)
      result.push(...node.getVertexPosition(i, new THREE.Vector3()));
  });
  return result;
}

test("animated clearance bounds contain the posed fly through clip changes and reverse seeking", async () => {
  const { FlyMotion } = await import("./fly-motion");
  const model = await loadFlyModel(await Bun.file(new URL("../../../assets/fly/fly.glb", import.meta.url)).arrayBuffer());
  const motion = new FlyMotion(model.root, model.clips);
  try {
    for (const clip of ["Walk", "Feed", "Land", "Fly"] as const) for (const seconds of [0, 0.13, 0.37, 0.08]) {
      motion.sample({ clip, seconds });
      model.root.position.set(2, 0.4, -3);
      model.root.rotation.set(0.2, 0.7, -0.1);
      model.root.scale.setScalar(5);
      const bounds = motion.bounds.local.clone().expandByScalar(1e-9);
      model.root.updateMatrixWorld(true);
      const inverse = model.root.matrixWorld.clone().invert();
      let outside = 0;
      model.root.traverse(node => {
        if (!(node instanceof THREE.Mesh)) return;
        if (node instanceof THREE.SkinnedMesh) node.skeleton.update();
        for (let i = 0; i < node.geometry.attributes.position.count; i++) {
          const vertex = node.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(node.matrixWorld).applyMatrix4(inverse);
          if (!bounds.containsPoint(vertex)) outside++;
        }
      });
      expect(outside).toBe(0);
    }
  } finally { motion.dispose(); model.dispose(); }
});
