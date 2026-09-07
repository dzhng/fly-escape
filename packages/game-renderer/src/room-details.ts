import * as THREE from "three";
import { loadStaticHouseModel } from "./house";
import type { WorldView } from "./index";
import windowUrl from "../../../assets/house/window/window.glb?url";
import sconceUrl from "../../../assets/house/sconce/sconce.glb?url";

/** Wall attachments in metres. Local +Z faces into the room; no core occupancy or sensory cue is added. */
export type RoomDetail = {
  kind: "window" | "sconce";
  position: readonly [number, number, number];
  quarterTurns: 0 | 1 | 2 | 3;
};
const assets = {
  window: { url: windowUrl, size: [1.4, 1.1, 0.08] },
  sconce: { url: sconceUrl, size: [0.22, 0.32, 0.16] },
} as const;

function finishMaterials(root: THREE.Group, kind: RoomDetail["kind"]) {
  const old = new Set<THREE.Material>();
  const paint = new THREE.MeshStandardMaterial({ color: kind === "window" ? "#eee4d2" : "#bda583", roughness: 0.75 });
  const metal = new THREE.MeshStandardMaterial({ color: "#9a7547", metalness: 0.7, roughness: 0.3 });
  const accent = new THREE.MeshStandardMaterial(kind === "window"
    ? { color: "#aec4c8", metalness: 0.12, roughness: 0.2 }
    : { color: "#fff0d0", emissive: "#ffcb83", emissiveIntensity: 0.8, roughness: 0.55 });
  root.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) old.add(material);
    object.material = kind === "window"
      ? object.name.startsWith("GlassPane") ? accent : object.name.startsWith("Handle") ? metal : paint
      : object.name.startsWith("UnlitBulb") ? accent : object.name.startsWith("BoundEdgeShade") ? paint : metal;
  });
  old.forEach(material => material.dispose());
}

export class RoomDetails {
  readonly root = new THREE.Group();
  private readonly direction = new THREE.Vector3();
  private readonly attachments: { model: THREE.Group; inward: THREE.Vector3 }[] = [];
  constructor(details: readonly RoomDetail[], sources: ReadonlyMap<RoomDetail["kind"], THREE.Group>) {
    this.root.name = "AuthoredRoomDetails";
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
      this.attachments.push({ model, inward: new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), mount.rotation.y) });
    }
  }
  update(camera: THREE.Camera) {
    camera.getWorldDirection(this.direction);
    // Wall-mounted models disappear with the foreground wall; its light remains in the room.
    for (const { model, inward } of this.attachments) model.visible = this.direction.dot(inward) <= 0;
  }
}

export async function loadRoomDetails(view: WorldView, details: readonly RoomDetail[], isCurrent: () => boolean) {
  if (details.length > 12 || details.filter(detail => detail.kind === "sconce").length > 4)
    throw new Error("A room scene supports at most 12 wall details and four household lights");
  const results = await Promise.allSettled([...new Set(details.map(detail => detail.kind))].map(async kind => {
    const response = await fetch(assets[kind].url);
    if (!response.ok) throw new Error(`Room ${kind} request failed (${response.status})`);
    const [x, y, z] = assets[kind].size;
    const model = await loadStaticHouseModel(await response.arrayBuffer(), { name: kind, bounds: [-x / 2, 0, -z / 2, x / 2, y, z / 2] });
    finishMaterials(model.root, kind);
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
