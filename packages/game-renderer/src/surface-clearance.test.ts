import { expect, test } from "bun:test";
import * as THREE from "three";
import { SurfaceClearance } from "./surface-clearance";

test("a fly on a lower ledge remains above the overhanging plate as its display size changes", () => {
  const clearance = new SurfaceClearance();
  clearance.setSurfaces([{ id: 1,
    vertices: [[-1, 0.5, -1], [0, 0.5, -1], [0, 0.5, 1], [-1, 0.5, 1]],
    triangles: [[0, 1, 2], [0, 2, 3]],
  }]);
  const position = new THREE.Vector3(0.01, 0.1, 0);
  const bounds = new THREE.Box3(new THREE.Vector3(-0.01, 0, -0.01), new THREE.Vector3(0.01, 0.02, 0.01));
  for (const size of [2, 5, 10, 5, 2]) {
    const y = clearance.height(position, new THREE.Quaternion(), new THREE.Vector3(size, size, size), bounds);
    expect(y).toBeCloseTo(0.5, 7);
  }
  expect(position.toArray()).toEqual([0.01, 0.1, 0]);
});

test("surface-aligned flies rest on a slope without lifting onto its distant high corner", () => {
  const clearance = new SurfaceClearance();
  clearance.setSurfaces([{ id: 1, vertices: [[-1, -0.3, -1], [1, 0.7, -1], [1, 0.7, 1], [-1, -0.3, 1]], triangles: [[0, 1, 2], [0, 2, 3]] }]);
  const rotation = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.atan(0.5));
  const bounds = new THREE.Box3(new THREE.Vector3(-0.01, 0, -0.01), new THREE.Vector3(0.01, 0.02, 0.01));
  expect(clearance.height(new THREE.Vector3(0, 0.2, 0), rotation, new THREE.Vector3(5, 5, 5), bounds)).toBeCloseTo(0.2, 8);
});

test("clearance respects the triangle footprint and drops the visual lift after leaving it", () => {
  const clearance = new SurfaceClearance();
  clearance.setSurfaces([{ id: 1, vertices: [[0, 0.5, 0], [1, 0.5, 0], [0, 0.5, 1]], triangles: [[0, 1, 2]] }]);
  const bounds = new THREE.Box3(new THREE.Vector3(-0.01, 0, -0.01), new THREE.Vector3(0.01, 0.02, 0.01));
  const at = (x: number, z: number, y = 0) => clearance.height(new THREE.Vector3(x, y, z), new THREE.Quaternion(), new THREE.Vector3(1, 1, 1), bounds);
  expect(at(0.2, 0.2)).toBeCloseTo(0.5, 8);
  expect(at(0.9, 0.9)).toBe(0);
  expect(at(0.2, 0.2, 0.8)).toBe(0.8);
  expect(at(2, 2)).toBe(0);
});
