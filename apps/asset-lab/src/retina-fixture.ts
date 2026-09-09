import * as THREE from "three";
import { campaignLevels } from "../../web/src/campaign-content";
import { WorldScene, loadWorldSceneAssets } from "../../../packages/game-renderer/src/world-scene";
import { batchStaticMeshes } from "../../../packages/game-renderer/src/static-batches";
import { housePalette } from "../../../packages/game-renderer/src/house-materials";
import { disposeObjectResources } from "../../../packages/game-renderer/src/resources";
import { sconceEmitter } from "../../../packages/sim-client/src/house-lighting";
import initWasm, { tool_catalog } from "../../../packages/sim-client/src/wasm/game_wasm";
import type { ToolDef } from "../../../packages/sim-client/src/generated/sim";

let wasmReady: ReturnType<typeof initWasm> | undefined;

/** Authored physical world plus diagnostic landmarks; no independent room geometry. */
export async function retinaFixtureScene(doorwayBlocked = false) {
  const content = campaignLevels[0];
  await (wasmReady ??= initWasm());
  const catalog = JSON.parse(tool_catalog()) as ToolDef[];
  const world = new WorldScene({ geometry: content.level.geometry, roomFloors: content.roomFloors, mode: "physical" });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(housePalette.background);
  scene.add(world.root, new THREE.HemisphereLight("#fff0cb", "#718d80", 2.5));
  const sun = new THREE.DirectionalLight("#ffe0a0", 3.4);
  sun.position.set(-8, 20, 5); sun.target.position.set(5, 0, 5); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.left = sun.shadow.camera.bottom = -20;
  sun.shadow.camera.right = sun.shadow.camera.top = 20;
  sun.shadow.camera.near = 0.1; sun.shadow.camera.far = 80;
  scene.add(sun, sun.target);
  // Shared light authoring extraction completes slice 03; these remain the measured probe values.
  for (const detail of content.roomDetails ?? []) if (detail.kind === "sconce") {
    const source = sconceEmitter(detail);
    const light = new THREE.PointLight("#ffca88", source.intensity, source.source.radius, 2);
    light.position.fromArray(source.position); scene.add(light);
  }
  const landmarks = new THREE.Group();
  let releaseBatches: (() => void) | undefined;
  const dispose = () => { releaseBatches?.(); world.dispose(); disposeObjectResources(scene); scene.clear(); };
  try {
    world.placements.setPlacements(content.level.fixedObjects, catalog);
    await loadWorldSceneAssets(world, content.roomDetails ?? [], () => true);
    for (const [x, y, z, color] of [[2, 0.35, 2, 0xee3322], [2, 0.35, 3, 0x2255ff], [2, 0.9, 2.5, 0x22cc55]]) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.25, 0.25), new THREE.MeshBasicMaterial({ color }));
      mesh.position.set(x, y, z); landmarks.add(mesh);
    }
    const doorwayTarget = new THREE.Mesh(new THREE.BoxGeometry(0.02, 1.8, 1.2), new THREE.MeshBasicMaterial({ color: 0x1649bb }));
    doorwayTarget.position.set(5.4, 0.9, 2.55); landmarks.add(doorwayTarget);
    if (doorwayBlocked) {
      const blocker = new THREE.Mesh(new THREE.BoxGeometry(0.02, 2.1, 0.9), new THREE.MeshBasicMaterial({ color: 0xbba986 }));
      blocker.position.set(4.79, 1.05, 2.55); landmarks.add(blocker);
    }
    landmarks.name = "OpticalFixtureLandmarks";
    scene.add(landmarks); scene.updateMatrixWorld(true);
    releaseBatches = batchStaticMeshes(scene);
    scene.matrixWorldAutoUpdate = false;
    return { scene, catalog, dispose };
  } catch (error) { dispose(); throw error; }
}
