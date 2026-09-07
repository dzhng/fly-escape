import * as THREE from "three";
import { contactGeometry } from "./contact-geometry";
import bananaSurface from "../../../assets/food/banana/contact.json";
import appleSurface from "../../../assets/food/apple/contact.json";
import shoesSurface from "../../../assets/household/worn-shoes/contact.json";
import dishesSurface from "../../../assets/household/dirty-dishes/contact.json";
import laundrySurface from "../../../assets/household/crumpled-laundry/contact.json";
import fanSurface from "../../../assets/household/fan/contact.json";
import vinegarSurface from "../../../assets/household/vinegar/contact.json";
import catSurface from "../../../assets/household/sleeping-cat/contact.json";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import type { Placement, ToolDef } from "@fly-escape/sim-client";
import { disposeObjectResources } from "./resources";
export type PlacementKind = Placement["kind"];
const nativeSurfaces: Partial<Record<PlacementKind, typeof appleSurface>> = {
  fan: fanSurface, vinegar: vinegarSurface, fruit: appleSurface, banana: bananaSurface, wornShoes: shoesSurface,
  dirtyDishes: dishesSurface, laundry: laundrySurface, sleepingCat: catSurface,
};

/** Native contact assets preserve metres; floor-cue assets scale only in X/Z. */
export async function loadPlacementModel(bytes: ArrayBuffer, kind: PlacementKind) {
  const surface = nativeSurfaces[kind];
  const { scene: root, animations, scenes } = await new GLTFLoader().parseAsync(bytes, "");
  try {
    if (scenes.length !== 1) throw new Error("Placement model must contain one scene.");
    root.updateMatrixWorld(true);
    let triangles = 0;
    root.traverse((object) => {
      if (object instanceof THREE.Light || object instanceof THREE.Camera)
        throw new Error("Placement model cannot add lights or cameras.");
      if (!(object instanceof THREE.Mesh)) return;
      if (object instanceof THREE.SkinnedMesh) throw new Error("Placement model must be static.");
      triangles += (object.geometry.index?.count ?? object.geometry.attributes.position.count) / 3;
      const positions = object.geometry.attributes.position;
      for (let i = 0; i < positions.count; i++) {
        const p = new THREE.Vector3()
          .fromBufferAttribute(positions, i)
          .applyMatrix4(object.matrixWorld);
        if (
          ![p.x, p.y, p.z].every(Number.isFinite) || (!surface && (
          Math.hypot(p.x, p.z) > 1.000001 ||
          p.y < -0.000001 ||
          p.y > 0.005001))
        )
          throw new Error(
            "Placement model must fit radius one and Y=0…0.005 without an offset pivot.",
          );
      }
      object.castShadow = !!surface;
      object.receiveShadow = true;
    });
    if (surface) {
      const geometry = contactGeometry(root);
      if (JSON.stringify(geometry.vertices) !== JSON.stringify(surface.vertices)
        || JSON.stringify(geometry.triangles) !== JSON.stringify(surface.triangles))
        throw new Error("Native object geometry must match the baked core contact surface.");
    }
    const triangleLimit = surface?.triangles.length ?? 5000;
    if (animations.length || triangles < 1 || triangles > triangleLimit)
      throw new Error(`Placement model must contain 1–${triangleLimit} static triangles.`);
    return {
      root,
      triangles,
      bounds: new THREE.Box3().setFromObject(root),
      dispose: () => disposeObjectResources(root),
    };
  } catch (error) {
    disposeObjectResources(root);
    throw error;
  }
}

type Ghost = { placement: Placement; valid: boolean | null };
/** Templates own shared resources; placed clones own transforms only. */
export class PlacementModels {
  readonly root = new THREE.Group();
  private sources = new Map<PlacementKind, THREE.Group>();
  private placements: Placement[] = [];
  private catalog: ToolDef[] = [];
  private ghost?: Ghost;
  private ghostMaterial = new THREE.MeshStandardMaterial({
    transparent: true,
    opacity: 0.7,
    depthWrite: false,
  });
  replace(kind: PlacementKind, source: THREE.Group): void {
    const old = this.sources.get(kind);
    this.sources.set(kind, source);
    this.rebuild();
    if (old) disposeObjectResources(old);
  }
  setPlacements(placements: Placement[], catalog: ToolDef[], ghost?: Ghost): void {
    this.placements = placements;
    this.catalog = catalog;
    this.ghost = ghost;
    this.rebuild();
  }
  private rebuild(): void {
    this.root.clear();
    for (const item of [
      ...this.placements.map((placement) => ({
        placement,
        ghost: false,
        valid: true,
      })),
      ...(this.ghost ? [{ ...this.ghost, ghost: true }] : []),
    ]) {
      const p = item.placement;
      const source = this.sources.get(p.kind);
      if (!source) continue;
      const tool = this.catalog.find((tool) => tool.kind === p.kind);
      if (!tool) throw new Error(`Missing object definition: ${p.kind}`);
      const instance = source.clone(true);
      instance.position.set(p.position.x, 0, p.position.z);
      instance.rotation.y = -p.heading;
      if (!tool.contact) instance.scale.set(tool.footprintRadius, 1, tool.footprintRadius);
      if (item.ghost) {
        this.ghostMaterial.color.set(
          item.valid === null ? "#e5dbaf" : item.valid ? "#67e5ae" : "#ff657f",
        );
        instance.position.y = 0.008;
        instance.traverse((o) => {
          if (o instanceof THREE.Mesh) o.material = this.ghostMaterial;
        });
      }
      this.root.add(instance);
    }
  }
  dispose(): void {
    this.root.clear();
    for (const source of this.sources.values()) disposeObjectResources(source);
    this.sources.clear();
    this.ghostMaterial.dispose();
  }
}
