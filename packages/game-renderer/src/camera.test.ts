import { expect, test } from "bun:test";
import * as THREE from "three";
import { WorldCamera } from "./camera";
const bounds = new THREE.Box3(new THREE.Vector3(-5, 0, -4), new THREE.Vector3(8, 1, 9));

test("follow keeps a moving and terminal target centered while zoom preserves it", () => {
  const rig = new WorldCamera(bounds, 1);
  rig.resize(1000, 600);
  const target = new THREE.Vector3(2, 0.5, 3);
  rig.follow(target);
  expect(rig.project(target).x).toBeCloseTo(500);
  expect(rig.project(target).y).toBeCloseTo(300);
  expect(rig.project(target).visible).toBe(true);
  rig.zoom(-100000);
  expect(rig.state.distance).toBe(rig.state.minDistance);
  expect(rig.state.following).toBe(true);
  target.set(4, 0.7, 5);
  rig.track(target);
  expect(rig.project(target).x).toBeCloseTo(500);
  expect(rig.project(target).y).toBeCloseTo(300);
  const stopped = rig.state;
  rig.track(target);
  expect(rig.state).toEqual(stopped);
});

test("overview fits every room corner and pan releases follow without rotating", () => {
  const rig = new WorldCamera(bounds, 1);
  rig.resize(700, 500);
  rig.overview();
  for (const x of [-5, 8]) for (const y of [0, 1]) for (const z of [-4, 9]) expect(rig.project(new THREE.Vector3(x,y,z)).visible).toBe(true);
  rig.follow(new THREE.Vector3(2, 0.5, 3));
  const rotation = rig.camera.quaternion.clone();
  rig.pan(100, -60);
  const panned = rig.state.target;
  expect(rig.state.following).toBe(false);
  rig.track(new THREE.Vector3(7, 0.5, 8));
  expect(rig.state.target).toEqual(panned);
  expect(rig.camera.quaternion.angleTo(rotation)).toBeLessThan(1e-7);
  rig.zoom(100000);
  expect(rig.state.distance).toBe(rig.state.maxDistance);
  rig.overview();
  rig.resize(500, 700);
  for (const x of [-5, 8]) for (const y of [0, 1]) for (const z of [-4, 9]) expect(rig.project(new THREE.Vector3(x,y,z)).visible).toBe(true);
});

test("maximum zoom-out still fits the house while following an edge fly", () => {
  const rig = new WorldCamera(bounds, 1);
  rig.resize(1000, 500);
  rig.follow(new THREE.Vector3(-5, 0.5, -4));
  rig.zoom(100000);
  for (const x of [-5, 8]) for (const y of [0, 1]) for (const z of [-4, 9]) expect(rig.project(new THREE.Vector3(x,y,z)).visible).toBe(true);
});
