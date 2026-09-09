import { expect, test } from "bun:test";
import * as THREE from "three";
import { loadFlyModel } from "./fly-model";
import { retinalEyeRig } from "./retina-eye-rig";

test("frozen eye origins match the actual skinned asset in native metres", async () => {
  const bytes = await Bun.file(new URL("../../../assets/fly/fly.glb", import.meta.url)).arrayBuffer();
  const model = await loadFlyModel(bytes);
  try {
    expect(new Bun.CryptoHasher("sha256").update(bytes).digest("hex")).toBe(retinalEyeRig.assetSha256);
    for (const eye of retinalEyeRig.eyes) {
      const mesh = model.root.getObjectByName(eye.sourceMesh);
      if (!(mesh instanceof THREE.SkinnedMesh)) throw new Error("Missing authored eye");
      mesh.skeleton.update();
      // Independently collect posed vertices, avoiding raw glTF/accessor bounds.
      const bounds = new THREE.Box3();
      for (let vertex = 0; vertex < mesh.geometry.attributes.position.count; vertex++) {
        bounds.expandByPoint(mesh.getVertexPosition(vertex, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld));
      }
      expect(bounds.getCenter(new THREE.Vector3()).distanceTo(new THREE.Vector3(...eye.positionMetres))).toBeLessThan(1e-14);
      expect(eye.side === "L" ? eye.positionMetres[0] > 0 : eye.positionMetres[0] < 0).toBe(true);
    }
  } finally {
    model.dispose();
  }
});

test("reference optical axes see the correct asymmetric native-world landmarks", () => {
  // Heading zero faces world +X; source/body physical left must face world -Z.
  const body = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI / 2);
  for (const eye of retinalEyeRig.eyes) {
    const camera = body.clone().multiply(new THREE.Quaternion(...eye.cameraToBodyQuaternion));
    const toCamera = camera.clone().invert();
    const leftMarker = new THREE.Vector3(0, 0, -1).applyQuaternion(toCamera);
    const aheadMarker = new THREE.Vector3(1, 0, 0).applyQuaternion(toCamera);
    const upperMarker = new THREE.Vector3(0, 1, 0).applyQuaternion(toCamera);
    expect(eye.side === "L" ? leftMarker.z < 0 : leftMarker.z > 0).toBe(true);
    expect(aheadMarker.z).toBeLessThan(0);
    expect(upperMarker.y).toBeGreaterThan(.99);
  }
});

test("consumers cannot mutate the shared rig or its coordinates", () => {
  expect(Reflect.set(retinalEyeRig.eyes[0].positionMetres, "0", 1)).toBe(false);
  expect(Reflect.set(retinalEyeRig.eyes[0], "side", "R")).toBe(false);
  expect(Reflect.set(retinalEyeRig.eyes, "0", retinalEyeRig.eyes[1])).toBe(false);
  expect(Reflect.set(retinalEyeRig, "units", "millimetres")).toBe(false);
});
