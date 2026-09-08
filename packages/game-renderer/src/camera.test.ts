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

test("maximum zoom keeps an edge fly centered; Overview restores the whole house", () => {
  const rig = new WorldCamera(bounds, 1);
  rig.resize(1000, 500);
  const overviewDistance = rig.state.maxDistance;
  const target = new THREE.Vector3(-5, 0.5, -4);
  rig.follow(target); rig.zoom(100000);
  expect(rig.state.distance).toBe(overviewDistance);
  expect(rig.project(target).x).toBeCloseTo(500);
  expect(rig.project(target).y).toBeCloseTo(250);
  expect(rig.state.following).toBe(true);
  rig.overview();
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

test("circular exterior contains every ground ray across normal camera limits", () => {
  for (const [width,height] of [[720,900],[1120,794],[1600,900],[2560,720]]) {
    const rig=new WorldCamera(bounds,0.003); rig.resize(width,height);
    for(const x of [bounds.min.x,1.5,bounds.max.x]) for(const z of [bounds.min.z,2.5,bounds.max.z]) {
      rig.follow(new THREE.Vector3(x,0.6,z));
      for(const zoom of [-100000,100000]) {
        rig.zoom(zoom); const circle=rig.exteriorGroundCircle();
        for(const nx of [-1,1]) for(const ny of [-1,1]) {
          const ray=new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(nx,ny),rig.camera);
          const point=ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),0),new THREE.Vector3());
          expect(point).not.toBeNull();
          expect(point!.clone().project(rig.camera).z).toBeLessThanOrEqual(1 + 1e-8);
          expect(Math.hypot(point!.x-circle.x,point!.z-circle.z)).toBeLessThanOrEqual(circle.radius+1e-8);
        }
      }
    }
    const normal=rig.exteriorGroundCircle(); rig.inspect(new THREE.Vector3(1,2,1),0.5,"mounting");
    expect(rig.exteriorGroundCircle()).toEqual(normal);
  }
});

/** Screen pixels a subject at `point` covers once its own enlargement is applied. */
function screenSpan(rig: WorldCamera, point: THREE.Vector3, nativeSpan: number) {
  const up = new THREE.Vector3().setFromMatrixColumn(rig.camera.matrixWorld, 1);
  const top = point.clone().addScaledVector(up, nativeSpan * rig.displayScale(nativeSpan, point));
  return Math.hypot(rig.project(point).x - rig.project(top).x, rig.project(point).y - rig.project(top).y);
}

test("every fly keeps its readable size at its own depth, however close the view gets", () => {
  const rig = new WorldCamera(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 2.6, 4)), 0.0018);
  rig.resize(1120, 794);
  const followed = new THREE.Vector3(2, 0.0009, 2);
  rig.follow(followed);
  // Neighbours a metre in front of and behind the followed fly, on the view axis.
  const axis = new THREE.Vector3().subVectors(rig.camera.position, followed).setY(0).normalize();
  const behind = followed.clone().addScaledVector(axis, -1);
  const beside = followed.clone().addScaledVector(new THREE.Vector3(axis.z, 0, -axis.x), 1);
  for (const wheel of [-100000, -700, 700, 1400]) {
    rig.zoom(wheel);
    // The neighbour a metre deeper used to collapse as the view closed in.
    expect(screenSpan(rig, behind, 0.00386)).toBeCloseTo(24, 0);
    // A neighbour at the followed depth is only ever larger, never enlarged past native.
    expect(screenSpan(rig, beside, 0.00386)).toBeGreaterThanOrEqual(23.5);
  }
  rig.zoomClose();
  // The followed fly is past its readable size at this range, so it stays native.
  expect(rig.displayScale(0.00386, followed)).toBe(1);
  expect(screenSpan(rig, behind, 0.00386)).toBeCloseTo(24, 0);
});

test("world enlargement is capped, so the farthest view shrinks flies instead of growing them", () => {
  const rig = new WorldCamera(new THREE.Box3(new THREE.Vector3(0, 0, 0), new THREE.Vector3(4, 2.6, 4)), 0.0018);
  rig.resize(1120, 794);
  rig.overview();
  const centre = new THREE.Vector3(2, 0.0009, 2);
  const capped = rig.displayScale(0.00386, centre);
  // An enlarged fly never passes 3% of the shortest room span.
  expect(capped * 0.00386).toBeCloseTo(0.03 * 4, 9);
  const span = screenSpan(rig, centre, 0.00386);
  expect(span).toBeLessThan(20);
  expect(span).toBeGreaterThan(8);
  // Halfway back in, the readable size is restored rather than exceeded.
  rig.zoom(-1200);
  expect(rig.displayScale(0.00386, centre)).toBeLessThan(capped);
  expect(screenSpan(rig, centre, 0.00386)).toBeCloseTo(24, 0);
});

test("orbit turns the view only: target, zoom and follow survive, and reset restores the default", () => {
  const rig = new WorldCamera(bounds, 0.003);
  rig.resize(1000, 600);
  const subject = new THREE.Vector3(2, 0.5, 3);
  rig.follow(subject);
  rig.zoom(-400);
  const before = rig.state;
  const upright = rig.camera.quaternion.clone();
  rig.rotate(120, -40);
  expect(rig.camera.quaternion.angleTo(upright)).toBeGreaterThan(0.1);
  expect(rig.state.rotated).toBe(true);
  expect(rig.state.target).toEqual(before.target);
  expect(rig.state.distance).toBeCloseTo(before.distance);
  expect(rig.state.following).toBe(true);
  expect(rig.project(subject).x).toBeCloseTo(500);
  expect(rig.project(subject).y).toBeCloseTo(300);
  rig.resetRotation();
  expect(rig.camera.quaternion.angleTo(upright)).toBeLessThan(1e-7);
  expect(rig.state).toEqual(before);
});

test("orbit keeps the camera above the floor, the house framed and the ground under every ray", () => {
  const rig = new WorldCamera(bounds, 0.003);
  rig.resize(1280, 720);
  const floor = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  for (const pitch of [-1000, -100, 0, 100, 1000]) {
    rig.resetRotation();
    rig.rotate(0, pitch);
    for (let turn = 0; turn < 12; turn++) {
      rig.rotate(105, 0);
      rig.follow(new THREE.Vector3(bounds.max.x, 0.5, bounds.min.z));
      expect(rig.camera.position.y).toBeGreaterThan(bounds.min.y);
      const circle = rig.exteriorGroundCircle();
      for (const nx of [-1, 1]) for (const ny of [-1, 1]) {
        const caster = new THREE.Raycaster();
        caster.setFromCamera(new THREE.Vector2(nx, ny), rig.camera);
        const hit = caster.ray.intersectPlane(floor, new THREE.Vector3());
        expect(hit).not.toBeNull();
        // Inside the grass disc and inside the far plane: no bare sector, no clipped ground.
        expect(Math.hypot(hit!.x - circle.x, hit!.z - circle.z)).toBeLessThanOrEqual(circle.radius + 1e-8);
        expect(hit!.clone().project(rig.camera).z).toBeLessThanOrEqual(1);
      }
      rig.overview();
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z])
        expect(rig.project(new THREE.Vector3(x, y, z)).visible).toBe(true);
    }
  }
});

test("ground coverage is reused across a turn, and panning follows the turned screen axes", () => {
  const rig = new WorldCamera(bounds, 0.003);
  rig.resize(1280, 720);
  rig.follow(new THREE.Vector3(1, 0.5, 2));
  rig.zoom(-2000);
  const circle = rig.exteriorGroundCircle();
  for (let turn = 0; turn < 8; turn++) {
    rig.rotate(90, 0);
    expect(rig.exteriorGroundCircle()).toEqual(circle);
  }
  for (const yaw of [0, 200, 400]) {
    rig.resetRotation();
    rig.rotate(yaw, 0);
    rig.follow(new THREE.Vector3(1, 0.5, 2));
    const anchor = new THREE.Vector3(1, 0.5, 2);
    const start = rig.project(anchor);
    rig.pan(-90, 0);
    const moved = rig.project(anchor);
    expect(moved.x - start.x).toBeCloseTo(90, 0);
    expect(Math.abs(moved.y - start.y)).toBeLessThan(1);
  }
});
