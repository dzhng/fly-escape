import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Geometry } from "@fly-escape/sim-client";
import { disposeObjectResources } from "./resources";

export type HousePart = "wall" | "floor";
const PART_BOUNDS = {
  wall: [-0.5, 0, -0.06, 0.5, 0.6, 0.06],
  floor: [-0.5, -0.25, -0.5, 0.5, 0, 0.5],
};

/** Replacement bounds keep the native pivot and declared world scale. */
export async function loadHousePart(bytes: ArrayBuffer, part: HousePart) {
  const gltf = await new GLTFLoader().parseAsync(bytes, "");
  try {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const bounds = [...box.min, ...box.max];
    if (gltf.animations.length || bounds.some((v, i) => !Number.isFinite(v) || Math.abs(v - PART_BOUNDS[part][i]) > 0.001))
      throw new Error(`${part} must be static and preserve its kit bounds and pivot.`);
    let triangles = 0;
    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) throw new Error("House parts must be static meshes.");
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0) / 3;
      object.castShadow = part === "wall";
      object.receiveShadow = true;
    });
    if (triangles <= 0 || triangles > 20_000) throw new Error("House part must contain 1–20,000 triangles.");
    return { root: gltf.scene, dispose: () => disposeObjectResources(gltf.scene) };
  } catch (error) {
    disposeObjectResources(gltf.scene);
    throw error;
  }
}

/** Owns all room instances and their shared resources; topology belongs to Geometry. */
export class HouseGeometry {
  readonly root = new THREE.Group();
  readonly walls = new THREE.Group();
  readonly floors = new THREE.Group();
  constructor(private readonly geometry: Geometry) {
    this.root.add(this.floors, this.walls);
    const wall = new THREE.Group();
    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.6, 0.12), new THREE.MeshStandardMaterial({ color: "#8aab9d", roughness: 1 }));
    wallMesh.position.y = 0.3;
    wallMesh.castShadow = wallMesh.receiveShadow = true;
    wall.add(wallMesh);
    const floor = new THREE.Group();
    const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.25, 1), new THREE.MeshStandardMaterial({ color: "#d9dfca", roughness: 1 }));
    floorMesh.position.y = -0.125;
    floorMesh.receiveShadow = true;
    floor.add(floorMesh);
    this.replace("wall", wall);
    this.replace("floor", floor);
  }
  /** Takes ownership of source resources. Clones share geometry/materials. */
  replace(part: HousePart, source: THREE.Group): void {
    const owner = part === "wall" ? this.walls : this.floors;
    disposeObjectResources(owner);
    owner.clear();
    if (part === "wall") {
      for (const segment of this.geometry.walls) {
        const dx = segment.b.x - segment.a.x;
        const dz = segment.b.z - segment.a.z;
        const placement = new THREE.Group();
        placement.add(source.clone(true));
        placement.scale.x = Math.hypot(dx, dz);
        placement.position.set((segment.a.x + segment.b.x) / 2, 0, (segment.a.z + segment.b.z) / 2);
        placement.rotation.y = -Math.atan2(dz, dx);
        owner.add(placement);
      }
    } else {
      for (const room of this.geometry.rooms) {
        const placement = new THREE.Group();
        placement.add(source.clone(true));
        placement.scale.set(room.max.x - room.min.x, 1, room.max.z - room.min.z);
        placement.position.set((room.min.x + room.max.x) / 2, 0, (room.min.z + room.max.z) / 2);
        owner.add(placement);
      }
    }
    if (!owner.children.length) disposeObjectResources(source);
  }
}

/** Recursive mesh hits remove their complete segment, including sibling meshes. */
export function cutAwayWalls(walls: THREE.Group, raycaster: THREE.Raycaster): void {
  for (const hit of raycaster.intersectObjects(walls.children, true)) {
    let owner = hit.object;
    while (owner.parent && owner.parent !== walls) owner = owner.parent;
    if (owner.parent === walls) owner.visible = false;
  }
}
