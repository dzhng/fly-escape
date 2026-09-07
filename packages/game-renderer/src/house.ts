import * as THREE from "three";
import { houseMaterial } from "./house-materials";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Geometry, FurnitureModel } from "@fly-escape/sim-client";
import { disposeObjectResources } from "./resources";
import catalog from "../../../assets/house/catalog.json";

export type HousePart = "wall" | "floor" | "solid";
export type HouseAsset = HousePart | FurnitureModel;
const PART_BOUNDS = {
  wall: [-0.5, 0, -0.06, 0.5, 2.5, 0.06],
  floor: [-0.5, -0.25, -0.5, 0.5, 0, 0.5],
  solid: [-0.5, 0, -0.5, 0.5, 1, 0.5],
} as const;

/** Catalogue placement contracts stay separate from static GLB validation. */
export function loadHousePart(bytes: ArrayBuffer, part: HouseAsset) {
  const expected = part in PART_BOUNDS ? PART_BOUNDS[part as HousePart] : (() => {
    const [x, y, z] = catalog[part as FurnitureModel];
    return [-x / 2, 0, -z / 2, x / 2, y, z / 2] as const;
  })();
  return loadStaticHouseModel(bytes, {
    name: part, bounds: expected, tolerance: part in PART_BOUNDS ? 0.001 : 1e-6,
    castShadow: part !== "floor",
  });
}

/** Native inspection uses this same loader without registering a physical furnishing. */
export async function loadStaticHouseModel(bytes: ArrayBuffer, contract: {
  name: string; bounds: readonly [number, number, number, number, number, number]; tolerance?: number; castShadow?: boolean;
}) {
  const gltf = await new GLTFLoader().parseAsync(bytes, "");
  try {
    const box = new THREE.Box3().setFromObject(gltf.scene);
    const bounds = [...box.min, ...box.max];
    if (gltf.animations.length || bounds.some((v, i) => !Number.isFinite(v) || Math.abs(v - contract.bounds[i]) > (contract.tolerance ?? 1e-6)))
      throw new Error(`${contract.name} must be static and preserve its kit bounds and pivot.`);
    let triangles = 0;
    gltf.scene.traverse((object) => {
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) throw new Error("House parts must be static meshes.");
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position?.count ?? 0) / 3;
      object.castShadow = contract.castShadow ?? true;
      object.receiveShadow = true;
    });
    if (triangles <= 0 || triangles > 20_000) throw new Error("House part must contain 1–20,000 triangles.");
    return { root: gltf.scene, bounds: box, triangles, dispose: () => disposeObjectResources(gltf.scene) };
  } catch (error) {
    disposeObjectResources(gltf.scene);
    throw error;
  }
}

/** Rendered wall rectangles, including shared-corner extensions, in world metres. */
export function wallFootprints(walls: Geometry["walls"]) {
  const joins = new Map<string, { x: number; z: number }[]>();
  const key = (p: { x: number; z: number }) => `${p.x},${p.z}`;
  for (const segment of walls) {
    const direction = { x: segment.b.x - segment.a.x, z: segment.b.z - segment.a.z };
    for (const point of [segment.a, segment.b]) {
      const directions = joins.get(key(point)) ?? [];
      directions.push(direction); joins.set(key(point), directions);
    }
  }
  return walls.map(segment => {
    const dx = segment.b.x - segment.a.x, dz = segment.b.z - segment.a.z;
    const length = Math.hypot(dx, dz);
    const extension = (point: { x: number; z: number }) =>
      joins.get(key(point))!.some(d => Math.abs(d.x * dz - d.z * dx) > 1e-8) ? PART_BOUNDS.wall[5] : 0;
    const start = extension(segment.a), end = extension(segment.b);
    return { segment, dx, dz, length, start, end, halfDepth: PART_BOUNDS.wall[5] };
  });
}

/** Owns all room instances and their shared resources; topology belongs to Geometry. */
export class HouseGeometry {
  readonly root = new THREE.Group();
  readonly walls = new THREE.Group();
  readonly floors = new THREE.Group();
  readonly solids = new THREE.Group();
  private wallViews: { group: THREE.Group; full: THREE.Group; base: THREE.Group; upper: THREE.Group; segment: Geometry["walls"][number] }[] = [];
  private readonly viewDirection = new THREE.Vector3();
  private readonly solidSources = new Map<"solid" | FurnitureModel, { source: THREE.Group; native: boolean }>();
  constructor(private readonly geometry: Geometry) {
    this.root.add(this.floors, this.walls, this.solids);
    const wall = new THREE.Group();
    const wallMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 2.5, 0.12), houseMaterial("wall"));
    wallMesh.position.y = 1.25;
    wallMesh.castShadow = wallMesh.receiveShadow = true;
    wall.add(wallMesh);
    const floor = new THREE.Group();
    const floorMesh = new THREE.Mesh(new THREE.BoxGeometry(1, 0.25, 1), houseMaterial("floor"));
    floorMesh.position.y = -0.125;
    floorMesh.receiveShadow = true;
    floor.add(floorMesh);
    this.replace("wall", wall);
    this.replace("floor", floor);
    for (const key of new Set(geometry.solids.map(prop => prop.furnishing?.model ?? "solid"))) {
      const source = new THREE.Group();
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), houseMaterial("solid"));
      mesh.position.y = 0.5;
      mesh.castShadow = mesh.receiveShadow = true;
      source.add(mesh);
      this.solidSources.set(key, { source, native: false });
    }
    this.rebuildSolids();
  }
  /** Cut room-facing foreground walls even when no fly is selected. */
  updateWallVisibility(camera: THREE.Camera): void {
    camera.getWorldDirection(this.viewDirection);
    for (const wall of this.wallViews) {
      const { a, b } = wall.segment;
      const vertical = Math.abs(a.x - b.x) < 1e-8;
      const edge = vertical ? a.x : a.z;
      const lo = Math.min(vertical ? a.z : a.x, vertical ? b.z : b.x);
      const hi = Math.max(vertical ? a.z : a.x, vertical ? b.z : b.x);
      const direction = vertical ? this.viewDirection.x : this.viewDirection.z;
      const cut = this.geometry.rooms.some(room => {
        const near = vertical ? room.min.x : room.min.z, far = vertical ? room.max.x : room.max.z;
        const alongMin = vertical ? room.min.z : room.min.x, alongMax = vertical ? room.max.z : room.max.x;
        return (Math.abs(near - edge) < 1e-8 || Math.abs(far - edge) < 1e-8)
          && Math.min(hi, alongMax) > Math.max(lo, alongMin)
          && ((near + far) / 2 - edge) * direction > 0;
      });
      wall.full.visible = !cut;
      wall.base.visible = wall.upper.visible = cut;
      wall.group.userData.cutaway = cut;
    }
  }
  get assetKeys(): HouseAsset[] { return ["wall", "floor", ...this.solidSources.keys()]; }
  private rebuildSolids(): void {
    // Templates own resources; rebuilding placements must not dispose shared meshes.
    this.solids.clear();
    for (const prop of this.geometry.solids) {
      const template = this.solidSources.get(prop.furnishing?.model ?? "solid")!;
      const placement = new THREE.Group();
      const instance = template.source.clone(true);
      if (template.native) placement.rotation.y = prop.furnishing!.quarterTurns * Math.PI / 2;
      else instance.scale.multiply(new THREE.Vector3(prop.max.x - prop.min.x, prop.height, prop.max.z - prop.min.z));
      placement.add(instance);
      placement.userData.cutawayScale = Math.min(1, 0.06 / prop.height);
      placement.position.set((prop.min.x + prop.max.x) / 2, 0, (prop.min.z + prop.max.z) / 2);
      this.solids.add(placement);
    }
  }

  /** Owns imported materials; floor instances copy UV geometry to preserve grain scale. */
  replace(part: HouseAsset, source: THREE.Group): void {
    if (part !== "wall" && part !== "floor") {
      const old = this.solidSources.get(part);
      if (!old) { disposeObjectResources(source); return; }
      this.solidSources.set(part, { source, native: part !== "solid" });
      this.rebuildSolids();
      disposeObjectResources(old.source);
      return;
    }
    const owner = part === "wall" ? this.walls : this.floors;
    disposeObjectResources(owner);
    owner.clear();
    if (part === "wall") {
      this.wallViews = [];
      const clipped = (normal: number, constant: number, opacity: number) => {
        const template = source.clone(true);
        const materials = new Map<THREE.Material, THREE.Material>();
        template.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          const copy = (original: THREE.Material) => {
            let material = materials.get(original);
            if (!material) {
              material = original.clone();
              material.clippingPlanes = [new THREE.Plane(new THREE.Vector3(0, normal, 0), constant)];
              material.clipShadows = true;
              material.transparent = opacity < 1;
              material.opacity = opacity;
              material.depthWrite = opacity === 1;
              materials.set(original, material);
            }
            return material;
          };
          object.material = Array.isArray(object.material) ? object.material.map(copy) : copy(object.material);
          if (opacity < 1) object.castShadow = false;
        });
        return template;
      };
      const baseTemplate = source.clone(true);
      baseTemplate.scale.y *= 0.15 / PART_BOUNDS.wall[4];
      const upperTemplate = clipped(1, -0.15, 0.06);
      for (const { segment, dx, dz, length, start, end } of wallFootprints(this.geometry.walls)) {
        const placement = new THREE.Group();
        const full = source.clone(true), base = baseTemplate.clone(true), upper = upperTemplate.clone(true);
        placement.add(full, base, upper);
        base.visible = upper.visible = false;
        this.wallViews.push({ group: placement, full, base, upper, segment });
        placement.scale.x = length + start + end;
        placement.position.set(
          (segment.a.x + segment.b.x) / 2 + (end - start) * dx / (2 * length),
          0,
          (segment.a.z + segment.b.z) / 2 + (end - start) * dz / (2 * length),
        );
        placement.rotation.y = -Math.atan2(dz, dx);
        owner.add(placement);
      }
    } else if (part === "floor") {
      for (const room of this.geometry.rooms) {
        const placement = new THREE.Group();
        const instance = source.clone(true);
        instance.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return;
          object.geometry = object.geometry.clone();
          const uv = object.geometry.getAttribute("uv");
          if (uv) for (let i = 0; i < uv.count; i++)
            uv.setXY(i, uv.getX(i) * (room.max.x - room.min.x), uv.getY(i) * (room.max.z - room.min.z));
        });
        placement.add(instance);
        placement.scale.set(room.max.x - room.min.x, 1, room.max.z - room.min.z);
        placement.position.set((room.min.x + room.max.x) / 2, 0, (room.min.z + room.max.z) / 2);
        owner.add(placement);
      }
    }
    if (!owner.children.length) disposeObjectResources(source);
    else if (part === "floor") source.traverse(object => {
      if (object instanceof THREE.Mesh) object.geometry.dispose();
    });
  }
}

/** Keep the physical boundary legible while exposing a selected fly above a low base. */
export function cutAwayOccluders(occluders: THREE.Group, raycaster?: THREE.Raycaster): void {
  for (const part of occluders.children) part.scale.y = 1;
  // Ray queries must see the restored mesh, not the previous frame's reduced base.
  occluders.updateMatrixWorld(true);
  if (!raycaster) return;
  for (const hit of raycaster.intersectObjects(occluders.children, true)) {
    let owner = hit.object;
    while (owner.parent && owner.parent !== occluders) owner = owner.parent;
    if (owner.parent === occluders) owner.scale.y = owner.userData.cutawayScale ?? 0.1;
  }
}
