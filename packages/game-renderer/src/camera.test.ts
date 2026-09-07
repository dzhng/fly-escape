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

test("millimetre subjects stay in the frustum at follow and extra-close household framing", () => {
  const room = new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 2.6, 4));
  const rig = new WorldCamera(room, 0.0018);
  rig.resize(1120, 794);
  const subject = new THREE.Vector3(2, 0.0009, 2);
  rig.follow(subject);
  for (const close of [false, true]) {
    if (close) rig.zoomClose();
    for (const y of [0, 0.0009, 0.0018]) {
      expect(rig.project(new THREE.Vector3(2, y, 2)).visible).toBe(true);
    }
    expect(rig.state.following).toBe(true);
    expect(rig.state.target).toEqual(subject.toArray());
  }
  rig.overview();
  for (const x of [0, 4]) for (const y of [0, 2.6]) for (const z of [0, 4])
    expect(rig.project(new THREE.Vector3(x, y, z)).visible).toBe(true);
});

test("zoom compensation grows continuously at wide views and retains native close size", () => {
  const camera = new WorldCamera(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 2.6, 4)), 0.0018);
  camera.resize(1120, 794);
  camera.follow(new THREE.Vector3(2, 0.0009, 2));
  expect(camera.displayScale(0.00386)).toBe(1);
  let previous = 1;
  for (let i = 0; i < 60; i++) {
    camera.zoom(70);
    const scale = camera.displayScale(0.00386);
    expect(scale).toBeGreaterThanOrEqual(previous);
    expect(scale / previous).toBeLessThanOrEqual(Math.exp(70 * 0.0015) + 1e-10);
    expect(camera.displayScale(0.00386)).toBe(scale);
    previous = scale;
  }
  expect(previous).toBeGreaterThan(10);
  camera.resize(1120, 397);
  expect(camera.displayScale(0.00386)).toBeCloseTo(previous);
  camera.resize(1120, 794);
  expect(camera.displayScale(0.00386)).toBeCloseTo(previous);
  camera.zoomClose();
  expect(camera.displayScale(0.00386)).toBe(1);
});

test("inspection focus preserves fixed camera orientation and ignores fly tracking", () => {
  const camera = new WorldCamera(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 2.6, 4)), 0.003);
  camera.resize(1120, 900);
  camera.inspect(new THREE.Vector3(2.5, 1.51, 0.14), 0.864);
  const state = camera.state;
  camera.track(new THREE.Vector3(3, 0, 2));
  expect(camera.state).toEqual(state);
  expect(camera.project({ x: 2.5, y: 1.51, z: 0.14 }).x).toBeCloseTo(560);
  expect(camera.project({ x: 2.5, y: 1.51, z: 0.14 }).y).toBeCloseTo(450);
});

test("diagnostic mounting elevation never leaks into follow or Overview", () => {
  const camera = new WorldCamera(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 2.6, 4)), 0.003);
  camera.resize(1120, 900);
  const ordinary = camera.camera.quaternion.clone();
  const subject = new THREE.Vector3(2.5, 1.51, 0.14);
  camera.inspect(subject, 0.864, "mounting");
  expect(camera.camera.quaternion.angleTo(ordinary)).toBeGreaterThan(0.5);
  camera.follow(subject);
  expect(camera.camera.quaternion.angleTo(ordinary)).toBeLessThan(1e-7);
  camera.inspect(subject, 0.864, "mounting");
  camera.overview();
  expect(camera.camera.quaternion.angleTo(ordinary)).toBeLessThan(1e-7);
  camera.inspect(subject, 0.864, "mounting");
  camera.inspect(subject, 0.864);
  expect(camera.camera.quaternion.angleTo(ordinary)).toBeLessThan(1e-7);
});
