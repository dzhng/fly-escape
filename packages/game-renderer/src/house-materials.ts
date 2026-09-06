import * as THREE from "three";
import palette from "../../../assets/house/palette.json";
export { palette as housePalette };
export type HouseMaterialRole = "wall" | "floor" | "solid";
export function houseMaterial(role: HouseMaterialRole) {
  return new THREE.MeshStandardMaterial(palette[role]);
}
/** A replacement changes the kit's shape; semantic surface colors remain shared with the game. */
export function applyHousePalette(root: THREE.Object3D, role: HouseMaterialRole) {
  root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
      if (!(material instanceof THREE.MeshStandardMaterial)) continue;
      material.color.set(palette[role].color);
      material.roughness = palette[role].roughness;
    }
  });
}
