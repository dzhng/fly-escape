import * as THREE from "three";
import type { Geometry } from "@fly-escape/sim-client";
import { HouseGeometry, type RoomFloor } from "./house";
import { loadHouseAssets } from "./house-assets";
import { PlacementModels } from "./placement-models";
import { loadPlacementAssets } from "./placement-assets";
import { loadRoomDetails, type RoomDetail, type RoomDetails } from "./room-details";
import { authoredWorldLights, type WorldLightingAuthoring } from "./world-lighting";
import { disposeObjectResources } from "./resources";

type LightColor = string | number;
type Position = readonly [number, number, number];
/** Physical light authoring is explicit; exit scoring and field rates are not photometry. */
export type WorldLight =
  | { kind: "hemisphere"; sky: LightColor; ground: LightColor; intensity: number }
  | { kind: "point"; color: LightColor; intensity: number; position: Position; distance: number; decay: number; castShadow: boolean }
  | { kind: "directional"; color: LightColor; intensity: number; position: Position; target: Position; castShadow: boolean; shadow?: { mapSize: number; extent: number; near: number; far: number; normalBias: number; bias: number } };

/** Each instance owns its mutable world and resources; only authoring and construction are shared. */
export class WorldScene {
  readonly root = new THREE.Group();
  readonly house: HouseGeometry;
  readonly placements: PlacementModels;
  readonly mode: "presentation" | "physical";
  details?: RoomDetails;
  readonly sun?: THREE.DirectionalLight;

  constructor(options: {
    geometry: Geometry;
    roomFloors?: readonly RoomFloor[];
    mode: "presentation" | "physical";
    lighting?: WorldLightingAuthoring;
    lights?: readonly WorldLight[];
  }) {
    if (options.lighting && options.lights) throw new Error("Choose authored lighting or explicit lights");
    const lights = options.lights ?? (options.lighting ? authoredWorldLights(options.geometry, options.lighting) : []);
    this.mode = options.mode;
    this.placements = new PlacementModels(this.mode === "presentation");
    this.house = new HouseGeometry(options.geometry, options.roomFloors, this.mode === "presentation");
    this.root.add(this.house.root, this.placements.root);
    for (const source of lights) {
      if (source.kind === "hemisphere") {
        this.root.add(new THREE.HemisphereLight(source.sky, source.ground, source.intensity));
      } else if (source.kind === "point") {
        const light = new THREE.PointLight(source.color, source.intensity, source.distance, source.decay);
        light.position.fromArray(source.position);
        light.castShadow = source.castShadow;
        this.root.add(light);
      } else {
        const light = new THREE.DirectionalLight(source.color, source.intensity);
        light.position.fromArray(source.position);
        light.target.position.fromArray(source.target);
        light.castShadow = source.castShadow;
        if (source.shadow) {
          const shadow = source.shadow;
          light.shadow.mapSize.set(shadow.mapSize, shadow.mapSize);
          light.shadow.camera.left = light.shadow.camera.bottom = -shadow.extent;
          light.shadow.camera.right = light.shadow.camera.top = shadow.extent;
          light.shadow.camera.near = shadow.near;
          light.shadow.camera.far = shadow.far;
          light.shadow.normalBias = shadow.normalBias;
          light.shadow.bias = shadow.bias;
          light.shadow.camera.updateProjectionMatrix();
        }
        this.sun ??= light;
        this.root.add(light, light.target);
      }
    }
  }

  setRoomDetails(details: RoomDetails): void {
    this.details?.dispose();
    this.details = details;
    this.root.add(details.root);
  }

  dispose(): void {
    this.root.removeFromParent();
    this.placements.root.removeFromParent();
    this.placements.dispose();
    this.details?.dispose();
    this.details = undefined;
    disposeObjectResources(this.root);
    this.root.clear();
  }
}

/** Readiness covers every physical asset category; instances never borrow another world's templates. */
export async function loadWorldSceneAssets(world: WorldScene, details: readonly RoomDetail[], isCurrent: () => boolean): Promise<void> {
  const results = await Promise.allSettled([
    loadHouseAssets(world.house, isCurrent),
    loadRoomDetails(world, details, isCurrent),
    loadPlacementAssets(world.placements, isCurrent),
  ]);
  const failure = results.find(result => result.status === "rejected");
  if (failure?.status === "rejected") throw failure.reason;
}
