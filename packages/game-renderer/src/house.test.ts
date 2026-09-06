import { expect, test } from "bun:test";
import * as THREE from "three";
import { HouseGeometry, cutAwayWalls, loadHousePart } from "./house";
import geometry from "../../../assets/house/five-rooms.json";
import { doorwayProbes } from "../../../apps/asset-lab/src/house-probes";

test("nested GLB cutaway hides the complete segment while leaving neighbors visible", async () => {
  const house = new HouseGeometry({ rooms: geometry.rooms, walls: [
    { a: { x: 0, z: -1 }, b: { x: 0, z: 1 } },
    { a: { x: 2, z: -1 }, b: { x: 2, z: 1 } },
  ] });
  const asset = await loadHousePart(await Bun.file(new URL("../../../assets/house/wall.glb", import.meta.url)).arrayBuffer(), "wall");
  house.replace("wall", asset.root);
  house.root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(-1, 0.3, 0), new THREE.Vector3(1, 0, 0), 0, 1.5);
  cutAwayWalls(house.walls, ray);
  expect(house.walls.children.map(w => w.visible)).toEqual([false, true]);
});

test("authored meshes leave every geometry doorway open and release replaced resources", async () => {
  const house = new HouseGeometry(geometry);
  const asset = await loadHousePart(await Bun.file(new URL("../../../assets/house/wall.glb", import.meta.url)).arrayBuffer(), "wall");
  house.replace("wall", asset.root);
  house.root.updateMatrixWorld(true);
  const doors = doorwayProbes(geometry);
  expect(doors.map(d => d.label)).toEqual(["Room 1 ↔ 2", "Room 2 ↔ 3", "Room 2 ↔ 5", "Room 3 ↔ 4"]);
  for (const d of doors) {
    const ray = new THREE.Raycaster(new THREE.Vector3(d.x - d.dx, 0.2, d.z - d.dz), new THREE.Vector3(d.dx, 0, d.dz), 0, 2);
    expect(ray.intersectObjects(house.walls.children, true)).toEqual([]);
  }
  let disposals = 0;
  const resources = new Set<THREE.BufferGeometry>();
  asset.root.traverse(o => { if (o instanceof THREE.Mesh) resources.add(o.geometry); });
  resources.forEach(r => r.addEventListener("dispose", () => ++disposals));
  const replacement = await loadHousePart(await Bun.file(new URL("../../../assets/house/wall.glb", import.meta.url)).arrayBuffer(), "wall");
  house.replace("wall", replacement.root);
  expect(disposals).toBe(resources.size);
  await expect(loadHousePart(await Bun.file(new URL("../../../assets/house/floor.glb", import.meta.url)).arrayBuffer(), "wall")).rejects.toThrow("bounds");
});
