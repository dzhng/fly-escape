import * as THREE from "three";
import { campaignLevels } from "../../web/src/campaign-content";
import { createRetinaWorld } from "../../../packages/game-renderer/src/retina-world";
import { disposeObjectResources } from "../../../packages/game-renderer/src/resources";
import initWasm, { tool_catalog } from "../../../packages/sim-client/src/wasm/game_wasm";
import type { Placement, ToolDef } from "../../../packages/sim-client/src/generated/sim";

let wasmReady: ReturnType<typeof initWasm> | undefined;
export type RetinaStimulus = { position: number[]; size: number[]; color: number };
export type RetinaFixtureOptions = { stimuli?: RetinaStimulus[]; doorwayBlocked?: boolean; landmarks?: boolean; levelIndex?: number; placements?: Placement[] };

/** Diagnostic stimuli surround the same physical world factory used by gameplay acquisition. */
export async function createRetinaFixture(options: RetinaFixtureOptions = {}, isCurrent: () => boolean = () => true) {
  const content = campaignLevels[options.levelIndex ?? 0];
  if (!content?.lighting) throw new Error("Optical fixture requires authored campaign lighting");
  await (wasmReady ??= initWasm());
  const catalog = JSON.parse(tool_catalog()) as ToolDef[];
  const placements = options.placements ?? content.level.fixedObjects;
  const world = await createRetinaWorld({ geometry: content.level.geometry,
    roomFloors: content.roomFloors ?? [], roomDetails: content.roomDetails ?? [], lighting: content.lighting,
    placements, catalog }, isCurrent);
  const landmarks = new THREE.Group();
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    landmarks.removeFromParent(); disposeObjectResources(landmarks); landmarks.clear(); world.dispose();
  };
  try {
    const stimuli = options.stimuli ?? (options.landmarks === false ? [] : [
      { position: [2, .35, 2], size: [.25, .25, .25], color: 0xee3322 },
      { position: [2, .35, 3], size: [.25, .25, .25], color: 0x2255ff },
      { position: [2, .9, 2.5], size: [.25, .25, .25], color: 0x22cc55 },
      { position: [5.4, .9, 2.55], size: [.02, 1.8, 1.2], color: 0x1649bb },
    ]);
    if (options.doorwayBlocked) stimuli.push({ position: [4.79, 1.05, 2.55], size: [.02, 2.1, .9], color: 0xbba986 });
    for (const stimulus of stimuli) {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(...stimulus.size), new THREE.MeshBasicMaterial({ color: stimulus.color }));
      mesh.position.fromArray(stimulus.position); landmarks.add(mesh);
    }
    landmarks.name = "OpticalFixtureLandmarks";
    world.scene.add(landmarks); world.scene.updateMatrixWorld(true);
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(JSON.stringify({ world: world.sceneId, stimuli })));
    const sceneId = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
    return { scene: world.scene, sceneId, catalog, placements, dispose };
  } catch (error) { dispose(); throw error; }
}
