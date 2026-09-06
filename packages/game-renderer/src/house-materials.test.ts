import { expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { houseMaterial, type HouseMaterialRole } from "./house-materials";

test("authored house surfaces match the materials used by production geometry", () => {
  for (const role of ["floor", "wall", "solid"] as HouseMaterialRole[]) {
    const bytes = readFileSync(new URL(`../../../assets/house/${role}.glb`, import.meta.url));
    const gltf = JSON.parse(bytes.subarray(20, 20 + bytes.readUInt32LE(12)).toString());
    const expected = houseMaterial(role);
    for (const material of gltf.materials) {
      const pbr = material.pbrMetallicRoughness;
      expected.color
        .toArray()
        .forEach((channel, i) => expect(pbr.baseColorFactor[i]).toBeCloseTo(channel, 6));
      expect(pbr.roughnessFactor).toBeCloseTo(expected.roughness, 6);
    }
    expected.dispose();
  }
});
