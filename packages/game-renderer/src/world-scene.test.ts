import { expect, test } from "bun:test";
import * as THREE from "three";
import geometry from "../../../assets/house/five-rooms.json";
import type { ToolDef } from "@fly-escape/sim-client";
import { WorldScene, loadWorldSceneAssets } from "./world-scene";
import { doorwayDetails } from "./room-details";

const catalog: ToolDef[] = [{ kind: "fruit", footprintRadius: .35, contact: "apple", contactHazard: null, edible: true,
  effect: { type: "source", kind: "attractiveOdor", radius: .75, rate: 1 } }];
const placement = { id: 1, kind: "fruit" as const, position: { x: 3, z: 4 }, heading: .4 };

async function withAssetFiles(action: () => Promise<void>, rejected?: string) {
  const original = globalThis.fetch;
  globalThis.fetch = (async input => {
    const path = String(input);
    if (rejected && path.endsWith(rejected)) return new Response(null, { status: 503 });
    return new Response(await Bun.file(path).arrayBuffer());
  }) as typeof fetch;
  try { await action(); } finally { globalThis.fetch = original; }
}

function visibleScene(root: THREE.Object3D) {
  root.updateMatrixWorld(true);
  const result: { name: string; matrix: number[]; opacity: number[] }[] = [];
  root.traverseVisible(object => {
    if (!(object instanceof THREE.Mesh)) return;
    result.push({ name: object.name, matrix: object.matrixWorld.toArray(),
      opacity: (Array.isArray(object.material) ? object.material : [object.material]).map(material => material.opacity) });
  });
  return result;
}

test("physical authored world keeps opaque geometry when the presentation camera cuts away walls", async () => {
  const physical = new WorldScene({ geometry, mode: "physical" });
  const presentation = new WorldScene({ geometry, mode: "presentation" });
  const details = [...doorwayDetails(geometry), { kind: "sconce" as const, position: [2, 1.1, .1] as const, quarterTurns: 0 as const }];
  try {
    await withAssetFiles(async () => {
      await loadWorldSceneAssets(physical, details, () => true);
      await loadWorldSceneAssets(presentation, details, () => true);
    });
    physical.placements.setPlacements([placement], catalog, { placement: { ...placement, id: 2, position: { x: 20, z: 20 } }, valid: false });
    presentation.placements.setPlacements([placement], catalog);
    const before = visibleScene(physical.root);
    const camera = new THREE.PerspectiveCamera();
    camera.position.set(10, 12, 10); camera.lookAt(0, 0, 0); camera.updateMatrixWorld(true);
    presentation.house.updateWallVisibility(camera);
    physical.house.updateWallVisibility(camera);
    presentation.details!.update(camera);
    physical.details!.update(camera);
    expect(presentation.house.walls.children.some(wall => wall.userData.cutaway)).toBe(true);
    expect(visibleScene(physical.root)).toEqual(before);
    const doorwayMaterials = (world: WorldScene) => {
      const result: THREE.Material[] = [];
      world.details!.root.getObjectByName("RoomDetail-doorway")!.traverse(object => {
        if (object instanceof THREE.Mesh) result.push(...(Array.isArray(object.material) ? object.material : [object.material]));
      });
      return result;
    };
    expect(doorwayMaterials(physical).length).toBeGreaterThan(0);
    expect(doorwayMaterials(physical).every(material => material.opacity === 1 && material.depthWrite)).toBe(true);
    expect(doorwayMaterials(presentation).every(material => material.opacity === .28 && !material.depthWrite)).toBe(true);
    const physicalLights: THREE.Light[] = [];
    physical.root.traverse(object => { if (object instanceof THREE.Light) physicalLights.push(object); });
    expect(physicalLights).toEqual([]);
    const bounds = new THREE.Box3().setFromObject(physical.placements.root, true);
    expect(bounds.min.x).toBeGreaterThan(2.95);
    expect(bounds.max.z).toBeLessThan(4.05);
    expect(bounds.max.y).toBeGreaterThan(.05);
    let physicalDisposals = 0;
    physical.root.traverse(object => {
      if (object instanceof THREE.Mesh) object.geometry.addEventListener("dispose", () => physicalDisposals++);
    });
    presentation.dispose();
    expect(physicalDisposals).toBe(0);
    expect(visibleScene(physical.root)).toEqual(before);
  } finally {
    presentation.dispose();
    physical.dispose();
  }
});

test("failed or stale shared asset loads do not install a partial placement template set", async () => {
  const world = new WorldScene({ geometry, mode: "physical" });
  world.placements.setPlacements([placement], catalog);
  try {
    await withAssetFiles(async () => {
      await expect(loadWorldSceneAssets(world, [], () => true)).rejects.toThrow("shade model request failed");
    }, "shade.glb");
    expect(world.placements.root.children).toEqual([]);
    await withAssetFiles(() => loadWorldSceneAssets(world, [], () => false));
    expect(world.placements.root.children).toEqual([]);
    await withAssetFiles(() => loadWorldSceneAssets(world, [], () => true));
    expect(new THREE.Box3().setFromObject(world.placements.root).max.y).toBeGreaterThan(.05);
  } finally {
    world.dispose();
  }
});

test("physical light positions come only from explicit authoring and release owned shadow targets", () => {
  const world = new WorldScene({ geometry, mode: "physical", lights: [
    { kind: "point", color: "#35a1dc", intensity: 2, position: [-2, 1.3, 7], distance: 4, decay: 2, castShadow: true },
  ] });
  const light = world.root.children.find(object => object instanceof THREE.PointLight) as THREE.PointLight;
  expect(light.getWorldPosition(new THREE.Vector3()).toArray()).toEqual([-2, 1.3, 7]);
  expect(light.color.getHexString()).toBe("35a1dc");
  expect(light.intensity).toBe(2);
  light.shadow.map = new THREE.WebGLRenderTarget(4, 4);
  let disposed = 0;
  light.shadow.map.addEventListener("dispose", () => disposed++);
  world.dispose();
  expect(disposed).toBe(1);
});
