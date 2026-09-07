import { expect, test } from "bun:test";
import * as THREE from "three";
import { HouseGeometry, cutAwayOccluders, loadHousePart } from "./house";
import geometry from "../../../assets/house/five-rooms.json";
import { doorwayProbes } from "../../../apps/asset-lab/src/house-probes";

test("nested GLB cutaway retains a low segment base and restores full walls without an occluder query", async () => {
  const house = new HouseGeometry({ solids: [], rooms: geometry.rooms, walls: [
    { a: { x: 0, z: -1 }, b: { x: 0, z: 1 } },
    { a: { x: 2, z: -1 }, b: { x: 2, z: 1 } },
  ] });
  const asset = await loadHousePart(await Bun.file(new URL("../../../assets/house/wall.glb", import.meta.url)).arrayBuffer(), "wall");
  house.replace("wall", asset.root);
  house.root.updateMatrixWorld(true);
  const ray = new THREE.Raycaster(new THREE.Vector3(-1, 0.3, 0), new THREE.Vector3(1, 0, 0), 0, 1.5);
  cutAwayOccluders(house.walls, ray);
  expect(house.walls.children.map(w => new THREE.Box3().setFromObject(w).getSize(new THREE.Vector3()).y)).toEqual([expect.closeTo(0.06, 4), expect.closeTo(0.6, 4)]);
  // Repeated queries must restore before intersecting, or the short base escapes the ray.
  cutAwayOccluders(house.walls, ray);
  expect(new THREE.Box3().setFromObject(house.walls.children[0]).max.y).toBeCloseTo(0.06, 4);
  cutAwayOccluders(house.walls);
  expect(house.walls.children.map(w => new THREE.Box3().setFromObject(w).max.y)).toEqual([expect.closeTo(0.6, 4), expect.closeTo(0.6, 4)]);
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

test("shared wall endpoints close the outside corner without filling doorway ends", async () => {
  const house = new HouseGeometry({ solids: [], rooms: geometry.rooms, walls: [
    { a: { x: -1, z: 0 }, b: { x: 0, z: 0 } },
    { a: { x: 0, z: -1 }, b: { x: 0, z: 0 } },
  ] });
  house.root.updateMatrixWorld(true);
  const corner = new THREE.Raycaster(new THREE.Vector3(0.04, 1, 0.04), new THREE.Vector3(0, -1, 0));
  expect(corner.intersectObjects(house.walls.children, true).length).toBeGreaterThan(0);
  const openEnd = new THREE.Raycaster(new THREE.Vector3(-1.04, 1, 0), new THREE.Vector3(0, -1, 0));
  expect(openEnd.intersectObjects(house.walls.children, true)).toEqual([]);
});


test("solid GLB matches core bounds, retains its footprint during cutaway, and restores", async () => {
  const house = new HouseGeometry(geometry);
  const bytes = await Bun.file(new URL("../../../assets/house/solid.glb", import.meta.url)).arrayBuffer();
  const asset = await loadHousePart(bytes, "solid");
  house.replace("solid", asset.root);
  const prop = geometry.solids[0];
  const bounds = () => new THREE.Box3().setFromObject(house.solids);
  expect([...bounds().min, ...bounds().max]).toEqual([
    expect.closeTo(prop.min.x, 5), 0, expect.closeTo(prop.min.z, 5),
    expect.closeTo(prop.max.x, 5), expect.closeTo(prop.height, 5), expect.closeTo(prop.max.z, 5),
  ]);
  const ray = new THREE.Raycaster(new THREE.Vector3(prop.min.x - 1, 0.3, (prop.min.z + prop.max.z) / 2), new THREE.Vector3(1, 0, 0));
  for (let i = 0; i < 2; ++i) {
    cutAwayOccluders(house.solids, ray);
    expect(bounds().max.y).toBeCloseTo(0.06, 5);
    expect(bounds().min.x).toBeCloseTo(prop.min.x, 5);
    expect(bounds().max.z).toBeCloseTo(prop.max.z, 5);
  }
  cutAwayOccluders(house.solids);
  expect(bounds().max.y).toBeCloseTo(prop.height, 5);
  const resources = new Set<THREE.BufferGeometry>();
  asset.root.traverse(o => { if (o instanceof THREE.Mesh) resources.add(o.geometry); });
  let disposed = 0;
  resources.forEach(r => r.addEventListener("dispose", () => ++disposed));
  house.replace("solid", (await loadHousePart(bytes, "solid")).root);
  expect(disposed).toBe(resources.size);
});

test("native furnishings match core footprints through rotation and independent replacement", async () => {
  const { default: scale } = await import("../../../assets/proportions/scale.json");
  const core = scale.geometry as import("@fly-escape/sim-client").Geometry;
  const house = new HouseGeometry(core);
  const cabinetBytes = await Bun.file(new URL("../../../assets/house/cabinet/cabinet.glb", import.meta.url)).arrayBuffer();
  const sofaBytes = await Bun.file(new URL("../../../assets/house/sofa/sofa.glb", import.meta.url)).arrayBuffer();
  const cabinet = await loadHousePart(cabinetBytes, "cabinet");
  const sofa = await loadHousePart(sofaBytes, "sofa");
  let cabinetDisposals = 0, sofaDisposals = 0;
  const cabinetMesh = cabinet.root.getObjectByProperty("type", "Mesh") as THREE.Mesh;
  const sofaMesh = sofa.root.getObjectByProperty("type", "Mesh") as THREE.Mesh;
  cabinetMesh.geometry.addEventListener("dispose", () => cabinetDisposals++);
  sofaMesh.geometry.addEventListener("dispose", () => sofaDisposals++);
  house.replace("cabinet", cabinet.root);
  house.replace("sofa", sofa.root);
  const checkBounds = () => {
    for (let i = 0; i < 2; i++) {
      const prop = core.solids[i], box = new THREE.Box3().setFromObject(house.solids.children[i]);
      const expected = [prop.min.x, 0, prop.min.z, prop.max.x, prop.height, prop.max.z];
      [...box.min, ...box.max].forEach((v, j) => expect(Math.abs(v - expected[j])).toBeLessThan(1e-6));
    }
    const sofaFront = new THREE.Vector3(0, 0, 1).transformDirection(house.solids.children[1].matrixWorld);
    expect(sofaFront.z).toBeCloseTo(-1);
  };
  checkBounds();
  const solid = await loadHousePart(await Bun.file(new URL("../../../assets/house/solid.glb", import.meta.url)).arrayBuffer(), "solid");
  house.replace("solid", solid.root);
  checkBounds();
  expect(cabinetDisposals).toBe(0);
  expect(sofaDisposals).toBe(0);
  house.replace("cabinet", (await loadHousePart(cabinetBytes, "cabinet")).root);
  expect(cabinetDisposals).toBe(1);
  expect(sofaDisposals).toBe(0);
  checkBounds();
  await expect(loadHousePart(sofaBytes, "cabinet")).rejects.toThrow("bounds");
});
