import * as THREE from "three";
import { loadPlacementModel } from "@fly-escape/game-renderer";
import { placementAssetUrls } from "../../../assets/tools/registry";
import type { ToolKind } from "@fly-escape/sim-client";

/** Offline thumbnails share the game's asset loader, geometry and materials. */
export async function renderObjectThumbnails(): Promise<Record<string, string>> {
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, preserveDrawingBuffer: true });
  renderer.setSize(256, 256);
  renderer.setPixelRatio(1);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  const result: Record<string, string> = {};
  try {
    for (const [kind, url] of Object.entries(placementAssetUrls)) {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`Object thumbnail asset failed: ${kind}`);
      const model = await loadPlacementModel(await response.arrayBuffer(), kind as ToolKind);
      const scene = new THREE.Scene();
      const center = model.bounds.getCenter(new THREE.Vector3());
      const size = model.bounds.getSize(new THREE.Vector3());
      const radius = size.length() / 2;
      model.root.position.sub(center);
      scene.add(model.root, new THREE.HemisphereLight(0xffffff, 0x77705c, 2.4));
      const key = new THREE.DirectionalLight(0xffffff, 3);
      key.position.set(radius * 3, radius * 5, radius * 4);
      key.castShadow = true;
      key.shadow.camera.left = key.shadow.camera.bottom = -radius * 2;
      key.shadow.camera.right = key.shadow.camera.top = radius * 2;
      key.shadow.camera.near = radius * 0.01;
      key.shadow.camera.far = radius * 15;
      key.shadow.bias = -0.0001;
      scene.add(key);
      const groundGeometry = new THREE.PlaneGeometry(radius * 6, radius * 6);
      const groundMaterial = new THREE.ShadowMaterial({ opacity: 0.2 });
      const ground = new THREE.Mesh(groundGeometry, groundMaterial);
      ground.rotation.x = -Math.PI / 2;
      ground.position.y = -size.y / 2 - radius * 0.002;
      ground.receiveShadow = true;
      scene.add(ground);
      const framing = radius * 1.15;
      const camera = new THREE.OrthographicCamera(-framing, framing, framing, -framing, radius * 0.01, radius * 20);
      camera.position.set(radius * (kind === "fan" ? 5 : 3), radius * (kind === "fan" ? 1.5 : 3.5), radius * (kind === "fan" ? 1.5 : 4));
      camera.lookAt(0, 0, 0);
      renderer.render(scene, camera);
      result[kind] = renderer.domElement.toDataURL("image/png");
      model.dispose(); groundGeometry.dispose(); groundMaterial.dispose(); key.shadow.map?.dispose();
    }
  } finally {
    renderer.dispose(); renderer.forceContextLoss();
  }
  return result;
}
