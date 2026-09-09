import { expect, test } from "bun:test";
import * as THREE from "three";
import { batchStaticMeshes } from "./static-batches";

test("static batching retains transformed surfaces and distinct materials", () => {
  const scene = new THREE.Scene();
  const red = new THREE.MeshBasicMaterial({ color: "red" });
  const blue = new THREE.MeshBasicMaterial({ color: "blue" });
  for (const [x, material] of [[-2, red], [3, red], [7, blue]] as const) {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2, 3), material);
    mesh.position.set(x, .5, 4);
    mesh.rotation.y = Math.PI / 2;
    scene.add(mesh);
  }
  const surfaces = () => {
    scene.updateMatrixWorld(true);
    const vertices: string[] = [];
    scene.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return;
      const position = object.geometry.getAttribute("position");
      for (let i = 0; i < position.count; i++) {
        const point = new THREE.Vector3().fromBufferAttribute(position, i).applyMatrix4(object.matrixWorld);
        vertices.push([object.material.color.getHexString(), ...point.toArray().map(value => value.toFixed(5))].join(","));
      }
    });
    return vertices.sort();
  };
  const before = surfaces();
  batchStaticMeshes(scene);
  expect(surfaces()).toEqual(before);
  const visible: THREE.Object3D[] = [];
  scene.traverseVisible(object => { if (object instanceof THREE.Mesh) visible.push(object); });
  expect(visible.length).toBe(2);
});

test("batching preserves unmerged children beneath a mesh parent", () => {
  const scene = new THREE.Scene();
  const material = new THREE.MeshBasicMaterial();
  const parent = new THREE.Mesh(new THREE.BoxGeometry(), material);
  const sibling = new THREE.Mesh(new THREE.BoxGeometry(), material);
  const child = new THREE.Mesh(new THREE.SphereGeometry(), new THREE.MeshBasicMaterial({ transparent: true }));
  parent.add(child); scene.add(parent, sibling);
  const release = batchStaticMeshes(scene);
  const visible: THREE.Object3D[] = [];
  scene.traverseVisible(object => visible.push(object));
  expect(visible.includes(child)).toBe(true);
  release();
  expect(parent.visible).toBe(true);
  expect(sibling.visible).toBe(true);
});
