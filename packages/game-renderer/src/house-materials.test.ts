import { expect, test } from "bun:test";
import * as THREE from "three";
import { HouseGeometry } from "./house";
import geometry from "../../../assets/house/five-rooms.json";

test("house replacement preserves authored materials and floor grain density across room sizes", () => {
  const house = new HouseGeometry(geometry);
  const map = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ color: "#aa7733", roughness: 0.37, map });
  const source = new THREE.Group();
  source.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), material));
  house.replace("floor", source);
  expect(material.color.getHexString()).toBe("aa7733");
  expect(material.roughness).toBe(0.37);
  expect(material.map).toBe(map);
  for (const placement of house.floors.children) {
    const mesh = placement.children[0].children[0] as THREE.Mesh;
    expect(mesh.material).toBe(material);
    const uv = mesh.geometry.getAttribute("uv");
    // The same authored texture interval covers the same world distance in every room.
    expect((uv.getX(1) - uv.getX(0)) / placement.scale.x).toBeCloseTo(1, 6);
    expect(Math.abs(uv.getY(2) - uv.getY(0)) / placement.scale.z).toBeCloseTo(1, 6);
  }
});
