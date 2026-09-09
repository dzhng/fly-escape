import * as THREE from "three";
import { loadStaticHouseModel } from "./house";
import type { WorldScene } from "./world-scene";
import { disposeObjectResources } from "./resources";
import { sconceEmitter, type HouseLightMount } from "../../sim-client/src/house-lighting";
import type { Geometry } from "@fly-escape/sim-client";
import { doorwayOpenings } from "./doorways";
import doorwayEnvelope from "../../../assets/house/doorway/envelope.json";
import exitWindowUrl from "../../../assets/house/exit-window/exit-window.glb?url";
import exitWindowEnvelope from "../../../assets/house/exit-window/envelope.json";
import doorwayUrl from "../../../assets/house/doorway/doorway.glb?url";
import windowUrl from "../../../assets/house/window/window.glb?url";
import plantUrl from "../../../assets/house/wall-plant/wall-plant.glb?url";
import sconceUrl from "../../../assets/house/sconce/sconce.glb?url";

/** Wall attachments in metres. Local +Z faces inward; sconces share authored sensory emitters. */
export type RoomDetail = HouseLightMount & ({ kind: "doorway"; width: number } | { kind: "window" | "sconce" | "plant" | "exitWindow" });
const [left, floor, outward, right, top, inward] = exitWindowEnvelope.bounds;
const [doorLeft, doorFloor, doorBack, doorRight, doorTop, doorFront] = doorwayEnvelope.bounds;
const assets = {
  window: { url: windowUrl, size: [1.4, 1.1, 0.08] },
  sconce: { url: sconceUrl, size: [0.22, 0.32, 0.16] },
  plant: { url: plantUrl, size: [0.34, 1.265, 0.38] },
  doorway: { url: doorwayUrl, bounds: [doorLeft, doorFloor, doorBack, doorRight, doorTop, doorFront] },
  exitWindow: { url: exitWindowUrl, bounds: [left, floor, outward, right, top, inward] },
} as const;

/** Decorative frames follow physical openings; they never carry their own layout. */
export function doorwayDetails(geometry: Geometry): RoomDetail[] {
  return doorwayOpenings(geometry).map(({ a, b }) => ({
    kind: "doorway", position: [(a.x + b.x) / 2, 0, (a.z + b.z) / 2],
    quarterTurns: a.x === b.x ? 1 : 0, width: Math.hypot(b.x - a.x, b.z - a.z),
  }));
}

/** Spread posts without thickening them; only the lintel spans the wider gap. */
export function fitDoorway(model: THREE.Group, width: number): void {
  const half = doorwayEnvelope.clearWidth / 2;
  const extra = (width - doorwayEnvelope.clearWidth) / 2;
  if (Math.abs(extra) < 1e-8) return;
  model.updateMatrixWorld(true);
  const rootInverse = model.matrixWorld.clone().invert();
  const point = new THREE.Vector3();
  model.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    const transform = rootInverse.clone().multiply(object.matrixWorld);
    const inverse = transform.clone().invert();
    object.geometry = object.geometry.clone();
    const positions = object.geometry.getAttribute("position");
    for (let i = 0; i < positions.count; i++) {
      point.fromBufferAttribute(positions, i).applyMatrix4(transform);
      point.x += Math.max(-1, Math.min(1, point.x / half)) * extra;
      point.applyMatrix4(inverse);
      positions.setXYZ(i, point.x, point.y, point.z);
    }
    positions.needsUpdate = true;
    object.geometry.computeVertexNormals();
    object.geometry.computeBoundingBox();
    object.geometry.computeBoundingSphere();
  });
}

export class RoomDetails {
  readonly root = new THREE.Group();
  private readonly direction = new THREE.Vector3();
  private readonly attachments: { model: THREE.Group; inward: THREE.Vector3 }[] = [];
  constructor(details: readonly RoomDetail[], private readonly sources: ReadonlyMap<RoomDetail["kind"], THREE.Group>, private readonly presentation = true) {
    this.root.name = "AuthoredRoomDetails";
    // Interior door surrounds remain legible without blocking the cutaway rooms behind them.
    if (presentation) sources.get("doorway")?.traverse(object => {
      if (!(object instanceof THREE.Mesh)) return;
      object.castShadow = false;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        material.transparent = true;
        material.opacity = 0.28;
        material.depthWrite = false;
      }
    });
    for (const detail of details) {
      const mount = new THREE.Group();
      mount.position.fromArray(detail.position);
      mount.rotation.y = detail.quarterTurns * Math.PI / 2;
      const model = sources.get(detail.kind)!.clone(true);
      model.name = `RoomDetail-${detail.kind}`;
      if (detail.kind === "doorway") fitDoorway(model, detail.width);
      mount.add(model);
      if (detail.kind === "sconce") {
        const emitter = sconceEmitter(detail);
        const light = new THREE.PointLight(emitter.color, emitter.intensity, emitter.distance, emitter.decay);
        light.position.fromArray(emitter.position);
        this.root.add(light);
      }
      this.root.add(mount);
      if (detail.kind !== "doorway" && detail.kind !== "exitWindow") this.attachments.push({ model, inward: new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), mount.rotation.y) });
    }
  }
  update(camera: THREE.Camera) {
    if (!this.presentation) return;
    camera.getWorldDirection(this.direction);
    // Wall-mounted models disappear with the foreground wall; its light remains in the room.
    for (const { model, inward } of this.attachments) model.visible = this.direction.dot(inward) <= 0;
  }
  dispose(): void {
    this.root.removeFromParent();
    const owned = new THREE.Group();
    owned.add(this.root, ...this.sources.values());
    disposeObjectResources(owned);
    owned.clear();
  }
}

export async function loadRoomDetails(world: WorldScene, details: readonly RoomDetail[], isCurrent: () => boolean, signal?: AbortSignal) {
  if (details.length > 16 || details.filter(detail => detail.kind === "sconce").length > 4)
    throw new Error("A room scene supports at most 16 wall details and four household lights");
  const results = await Promise.allSettled([...new Set(details.map(detail => detail.kind))].map(async kind => {
    const response = await fetch(assets[kind].url, { signal });
    if (!response.ok) throw new Error(`Room ${kind} request failed (${response.status})`);
    const contract = assets[kind];
    const bounds = "bounds" in contract ? contract.bounds : (() => {
      const [x, y, z] = contract.size;
      return [-x / 2, 0, -z / 2, x / 2, y, z / 2] as const;
    })();
    const model = await loadStaticHouseModel(await response.arrayBuffer(), { name: kind, bounds });
    return { kind, model };
  }));
  const failure = results.find(result => result.status === "rejected");
  if (failure || !isCurrent()) {
    for (const result of results) if (result.status === "fulfilled") result.value.model.dispose();
    if (failure?.status === "rejected") throw failure.reason;
    return;
  }
  const sources = new Map<RoomDetail["kind"], THREE.Group>();
  for (const result of results) if (result.status === "fulfilled") sources.set(result.value.kind, result.value.model.root);
  const scene = new RoomDetails(details, sources, world.mode === "presentation");
  world.setRoomDetails(scene);
}
