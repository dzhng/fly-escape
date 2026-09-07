import * as THREE from "three";
import palette from "../../../assets/house/palette.json";
export { palette as housePalette };
export type HouseMaterialRole = "wall" | "floor" | "solid";
export function houseMaterial(role: HouseMaterialRole) {
  return new THREE.MeshStandardMaterial(palette[role]);
}
