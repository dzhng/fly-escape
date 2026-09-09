import * as THREE from "three";
import type { Geometry, Placement } from "@fly-escape/sim-client";
import { WorldScene, loadWorldSceneAssets } from "./world-scene";
import { batchStaticMeshes } from "./static-batches";
import type { RoomFloor } from "./house";
import type { RoomDetail } from "./room-details";
import type { PlacementAppearance } from "./placement-models";
import type { WorldLightingAuthoring } from "./world-lighting";
import { housePalette } from "./house-materials";
import revision from "./retina-scene-revision.json";

/** Only physical authoring crosses into the optical world; no exit/scoring or player state. */
export type RetinaWorldDefinition = {
  geometry: Geometry;
  roomFloors: readonly RoomFloor[];
  roomDetails: readonly RoomDetail[];
  placements: readonly Placement[];
  catalog: readonly PlacementAppearance[];
  lighting: WorldLightingAuthoring;
};

function physicalDefinition(authoring: RetinaWorldDefinition): RetinaWorldDefinition {
  return structuredClone({
    geometry: authoring.geometry, roomFloors: authoring.roomFloors, roomDetails: authoring.roomDetails,
    placements: authoring.placements, lighting: authoring.lighting,
    catalog: authoring.catalog.map(({ kind, footprintRadius, contact }) => ({ kind, footprintRadius, contact })),
  });
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}

export async function retinaWorldIdentity(definition: RetinaWorldDefinition): Promise<string> {
  const bytes = new TextEncoder().encode(canonical({ sceneRevision: revision.revision, definition: physicalDefinition(definition) }));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
}

/** A static sensory world owns every mesh/resource independently of the presentation world. */
export async function createRetinaWorld(authoring: RetinaWorldDefinition, isCurrent: () => boolean = () => true, signal?: AbortSignal) {
  const definition = physicalDefinition(authoring);
  const sceneId = await retinaWorldIdentity(definition);
  signal?.throwIfAborted();
  const world = new WorldScene({ ...definition, mode: "physical" });
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(housePalette.background);
  scene.add(world.root);
  let releaseBatches: (() => void) | undefined;
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    releaseBatches?.(); world.dispose(); scene.clear();
  };
  try {
    world.placements.setPlacements(definition.placements, definition.catalog);
    await loadWorldSceneAssets(world, definition.roomDetails, isCurrent, signal);
    if (!isCurrent()) throw new Error("Retinal world initialization cancelled");
    releaseBatches = batchStaticMeshes(world.root);
    scene.updateMatrixWorld(true);
    scene.matrixWorldAutoUpdate = false;
    return { scene, sceneId, world, dispose };
  } catch (error) { dispose(); throw error; }
}
