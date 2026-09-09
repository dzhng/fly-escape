import * as THREE from "three";
import { loadFlyModel } from "../../../packages/game-renderer/src/fly-model";
import { retinalEyeRig } from "../../../packages/game-renderer/src/retina-eye-rig";
import { retinaCameraProjection } from "../../../packages/game-renderer/src/retina-projection";
import flyUrl from "../../../assets/fly/fly.glb?url";

/** Native-size, unanimated mounting diagnostic; WorldView owns the returned resources. */
export async function loadRetinaRigView(): Promise<THREE.Group> {
  const response = await fetch(flyUrl);
  if (!response.ok) throw new Error("Eye mounting model could not load");
  const model = await loadFlyModel(await response.arrayBuffer());
  const root = new THREE.Group();
  root.add(model.root);
  for (const [index, eye] of retinalEyeRig.eyes.entries()) {
    const color = new THREE.Color(index === 0 ? 0x00e5ff : 0xff45dd);
    const origin = new THREE.Mesh(new THREE.SphereGeometry(.00006, 8, 6), new THREE.MeshBasicMaterial({ color, depthTest: false }));
    origin.position.fromArray(eye.positionMetres);
    const camera = new THREE.PerspectiveCamera(retinaCameraProjection.verticalFovDegrees,
      retinaCameraProjection.aspect, retinaCameraProjection.nearMetres, .001);
    camera.position.fromArray(eye.positionMetres);
    camera.quaternion.fromArray(eye.cameraToBodyQuaternion);
    camera.updateMatrixWorld(true);
    const helper = new THREE.CameraHelper(camera);
    helper.setColors(color, color, color, color, color);
    root.add(origin, helper);
  }
  return root;
}
