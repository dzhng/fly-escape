import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/** Freeze visible static meshes into material batches, preserving their world transforms. */
export function batchStaticMeshes(scene: THREE.Object3D): () => void {
  scene.updateMatrixWorld(true);
  const toRoot = scene.matrixWorld.clone().invert();
  const originals: THREE.Mesh[] = [];
  const buckets = new Map<string, THREE.Mesh<THREE.BufferGeometry, THREE.Material>[]>();
  scene.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh) || object instanceof THREE.SkinnedMesh
      || object instanceof THREE.InstancedMesh || Array.isArray(object.material)
      || object.children.length > 0 || object.material.transparent || object.matrixWorld.determinant() <= 0) return;
    const geometry = object.geometry as THREE.BufferGeometry;
    const attributes = Object.entries(geometry.attributes)
      .map(([name, attribute]) => `${name}:${attribute.itemSize}:${attribute.normalized}`).sort().join(",");
    const key = [object.material.uuid, object.castShadow, object.receiveShadow, object.renderOrder,
      object.geometry.index !== null, attributes].join("|");
    const bucket = buckets.get(key) ?? [];
    bucket.push(object);
    buckets.set(key, bucket);
  });
  const batches = new THREE.Group();
  batches.name = "StaticMaterialBatches";
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue;
    const transformed = meshes.map(mesh => mesh.geometry.clone().applyMatrix4(toRoot.clone().multiply(mesh.matrixWorld)));
    const geometry = mergeGeometries(transformed);
    for (const source of transformed) source.dispose();
    if (!geometry) throw new Error("Static sensory meshes could not be batched");
    const first = meshes[0];
    const merged = new THREE.Mesh(geometry, first.material);
    merged.castShadow = first.castShadow;
    merged.receiveShadow = first.receiveShadow;
    merged.renderOrder = first.renderOrder;
    for (const mesh of meshes) { mesh.visible = false; originals.push(mesh); }
    batches.add(merged);
  }
  scene.add(batches);
  scene.updateMatrixWorld(true);
  return () => {
    batches.removeFromParent();
    for (const mesh of originals) mesh.visible = true;
    for (const mesh of batches.children) (mesh as THREE.Mesh).geometry.dispose();
    batches.clear();
  };
}
