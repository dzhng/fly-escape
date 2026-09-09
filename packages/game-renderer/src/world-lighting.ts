import * as THREE from "three";
import type { Geometry } from "@fly-escape/sim-client";
import type { WorldLight } from "./world-scene";

/** Direction toward daylight in the horizontal plane, independent of exit scoring. */
export type WorldLightingAuthoring = { daylightDirection: readonly [number, number] };

/** Diagnostic rooms have a stable default; campaign rooms author their direction explicitly. */
export const defaultWorldLighting: WorldLightingAuthoring = { daylightDirection: [2 / 3, 2 / 3] };

export function authoredWorldLights(geometry: Geometry, authoring: WorldLightingAuthoring): readonly WorldLight[] {
  // The authored room envelope is stable before and after asynchronous model loading.
  const bounds = new THREE.Box3();
  for (const room of geometry.rooms) {
    bounds.expandByPoint(new THREE.Vector3(room.min.x, 0, room.min.z));
    bounds.expandByPoint(new THREE.Vector3(room.max.x, 1, room.max.z));
  }
  if (bounds.isEmpty()) throw new Error("World lighting requires room geometry");
  const center = bounds.getCenter(new THREE.Vector3());
  const radius = bounds.getSize(new THREE.Vector3()).length() / 2;
  const [x, z] = authoring.daylightDirection;
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.hypot(x, z) === 0)
    throw new Error("World daylight direction must be finite and nonzero");
  return [
    { kind: "hemisphere", sky: "#fff0cb", ground: "#718d80", intensity: 2.5 },
    { kind: "directional", color: "#ffe0a0", intensity: 3.4,
      position: [center.x + x * radius * 1.5, radius * 2, center.z + z * radius * 1.5],
      target: center.toArray(), castShadow: true,
      shadow: { mapSize: 1024, extent: radius * 1.5, near: 1, far: radius * 5, normalBias: .025, bias: -.001 } },
  ];
}
