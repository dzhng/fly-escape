import * as THREE from "three";
import { disposeObjectResources } from "./resources";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { clone } from "three/addons/utils/SkeletonUtils.js";

/** The asset retains resources; cloned instances own transforms and skeletons only. */
export class FlyModel {
  readonly bounds: THREE.Box3;
  readonly triangles: number;
  readonly materialCount: number;
  constructor(
    readonly root: THREE.Group,
    readonly clips: THREE.AnimationClip[],
  ) {
    root.updateMatrixWorld(true);
    this.bounds = new THREE.Box3().setFromObject(root);
    let triangles = 0;
    const materials = new Set<THREE.Material>();
    root.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      triangles +=
        (object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0) / 3;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        materials.add(material);
        for (const value of Object.values(material)) {
          if (!(value instanceof THREE.Texture)) continue;
          const image = value.image;
          if (image && (image.width > 1024 || image.height > 1024)) {
            throw new Error("Fly textures must be at most 1024 pixels per side.");
          }
        }
      }
      object.castShadow = true;
      object.receiveShadow = true;
    });
    this.triangles = triangles;
    this.materialCount = materials.size;
    if (triangles <= 0 || triangles > 20_000 || materials.size > 3) {
      throw new Error("Fly model needs visible geometry within 20,000 triangles and 3 materials.");
    }
    const size = this.bounds.getSize(new THREE.Vector3());
    if (
      ![...this.bounds.min, ...this.bounds.max].every(Number.isFinite) ||
      Math.min(size.x, size.y, size.z) <= 0
    ) {
      throw new Error("Fly model must have finite, nonempty three-dimensional bounds.");
    }
    if (
      this.bounds.min.x > 0 ||
      this.bounds.max.x < 0 ||
      this.bounds.min.z > 0 ||
      this.bounds.max.z < 0
    ) {
      throw new Error("Fly model footprint must contain the X/Z origin.");
    }
    if (Math.abs(this.bounds.min.y) > size.y * 0.05) {
      throw new Error("Fly model must have its ground contact at Y = 0.");
    }
  }
  instantiate(): THREE.Object3D {
    return clone(this.root);
  }
  dispose(): void {
    disposeObjectResources(this.root);
  }
}

export async function loadFlyModel(bytes: ArrayBuffer): Promise<FlyModel> {
  const gltf = await new GLTFLoader().parseAsync(bytes, "");
  try {
    return new FlyModel(gltf.scene, gltf.animations);
  } catch (error) {
    disposeObjectResources(gltf.scene);
    throw error;
  }
}
