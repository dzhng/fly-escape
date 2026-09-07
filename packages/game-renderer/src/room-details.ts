import * as THREE from "three";
import { loadStaticHouseModel } from "./house";
import type { WorldView } from "./index";
import exitWindowUrl from "../../../assets/house/exit-window/exit-window.glb?url";
import exitWindowEnvelope from "../../../assets/house/exit-window/envelope.json";
import doorwayUrl from "../../../assets/house/doorway/doorway.glb?url";
import windowUrl from "../../../assets/house/window/window.glb?url";
import plantUrl from "../../../assets/house/wall-plant/wall-plant.glb?url";
import sconceUrl from "../../../assets/house/sconce/sconce.glb?url";

/** Wall attachments in metres. Local +Z faces into the room; no core occupancy or sensory cue is added. */
export type RoomDetail = {
  kind: "window" | "sconce" | "plant" | "doorway" | "exitWindow";
  position: readonly [number, number, number];
  quarterTurns: 0 | 1 | 2 | 3;
};
const [left, floor, outward, right, top, inward] = exitWindowEnvelope.bounds;
const assets = {
  window: { url: windowUrl, size: [1.4, 1.1, 0.08] },
  sconce: { url: sconceUrl, size: [0.22, 0.32, 0.16] },
  plant: { url: plantUrl, size: [0.34, 1.265, 0.38] },
  doorway: { url: doorwayUrl, size: [1.02, 2.5, 0.16] },
  exitWindow: { url: exitWindowUrl, bounds: [left, floor, outward, right, top, inward] },
} as const;

export class RoomDetails {
  readonly root = new THREE.Group();
  private readonly direction = new THREE.Vector3();
  private readonly attachments: { model: THREE.Group; inward: THREE.Vector3 }[] = [];
  constructor(details: readonly RoomDetail[], sources: ReadonlyMap<RoomDetail["kind"], THREE.Group>) {
    this.root.name = "AuthoredRoomDetails";
    // Interior door surrounds remain legible without blocking the cutaway rooms behind them.
    sources.get("doorway")?.traverse(object => {
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
      mount.add(model);
      if (detail.kind === "sconce") {
        const light = new THREE.PointLight("#ffca88", 0.45, 2.5, 2);
        light.position.set(0, 0.18, 0.22);
        mount.add(light);
      }
      this.root.add(mount);
      if (detail.kind !== "doorway" && detail.kind !== "exitWindow") this.attachments.push({ model, inward: new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), mount.rotation.y) });
    }
  }
  update(camera: THREE.Camera) {
    camera.getWorldDirection(this.direction);
    // Wall-mounted models disappear with the foreground wall; its light remains in the room.
    for (const { model, inward } of this.attachments) model.visible = this.direction.dot(inward) <= 0;
  }
}

export async function loadRoomDetails(view: WorldView, details: readonly RoomDetail[], isCurrent: () => boolean) {
  if (details.length > 16 || details.filter(detail => detail.kind === "sconce").length > 4)
    throw new Error("A room scene supports at most 16 wall details and four household lights");
  const results = await Promise.allSettled([...new Set(details.map(detail => detail.kind))].map(async kind => {
    const response = await fetch(assets[kind].url);
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
  const scene = new RoomDetails(details, sources);
  // All source geometry and materials are shared by the installed instances and owned by the view.
  view.setRoomDetails(scene);
}
