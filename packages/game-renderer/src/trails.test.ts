import { expect, test } from 'bun:test';
import * as THREE from 'three';
import { WorldCamera } from './camera';
import { FlyTrails, recordedTrails } from './trails';

const projection = (zoom: () => number) => ({
  project: (p: { x: number; y: number; z: number }) => ({
    x: p.x * zoom(),
    y: p.z * zoom(),
    visible: true,
  }),
  offset: (p: { x: number; y: number; z: number }, x: number, y: number) =>
    new THREE.Vector3(p.x + x / zoom(), p.y, p.z + y / zoom()),
});
const path = Array.from({ length: 41 }, (_, tick) => ({ tick, x: tick / 10, y: 0, z: 0 }));
const snapshot = (trails: FlyTrails) => {
  const count = trails.mesh.geometry.drawRange.count;
  return {
    positions: Array.from(trails.mesh.geometry.getAttribute('position').array.slice(0, count * 3)),
    colors: Array.from(trails.mesh.geometry.getAttribute('color').array.slice(0, count * 4)),
  };
};
test('trail geometry is bounded, fades by playback time and restores exact seek state', () => {
  const trails = new FlyTrails(
    1,
    projection(() => 100),
  );
  trails.sample([path], 40);
  const end = snapshot(trails);
  const xs = end.positions.filter((_, i) => i % 3 === 0);
  expect(Math.max(...xs) - Math.min(...xs)).toBeCloseTo(2);
  expect(trails.mesh.geometry.drawRange.count).toBeLessThanOrEqual(30 * 6);
  const alphas = end.colors.filter((_, i) => i % 4 === 3);
  expect(Math.max(...alphas)).toBeCloseTo(1);
  expect(Math.min(...alphas)).toBeLessThan(0.5);
  trails.sample([path], 10);
  expect(Math.max(...snapshot(trails).positions.filter((_, i) => i % 3 === 0))).toBe(1);
  trails.sample([path], 40);
  expect(snapshot(trails)).toEqual(end);
  trails.sample([path], 40);
  expect(snapshot(trails)).toEqual(end);
  trails.sample([path], 71);
  expect(trails.mesh.geometry.drawRange.count).toBe(0);
});
test('discontinuities stop paths and fresh attempts contain no old vertices', () => {
  const trails = new FlyTrails(
    1,
    projection(() => 100),
  );
  const broken = path.map(p => ({ ...p, breakBefore: p.tick === 38 }));
  trails.sample([broken], 40);
  const xs = snapshot(trails).positions.filter((_, i) => i % 3 === 0);
  expect(Math.min(...xs)).toBeCloseTo(3.8);
  trails.sample([[]], 0);
  expect(trails.mesh.geometry.drawRange.count).toBe(0);
  expect(() => trails.sample([], 0)).toThrow('population');
});

test('recorded trails preserve physical height, detect input discontinuity and stop at terminal', () => {
  const history = [
    {
      tick: 1,
      height: 0.6,
      x: 0.1,
      z: 0,
      inputX: 0,
      inputZ: 0,
      mode: 'flying' as const,
      terminal: false,
    },
    {
      tick: 2,
      height: 0.525,
      x: 0.2,
      z: 0,
      inputX: 0.1,
      inputZ: 0,
      mode: 'walking' as const,
      terminal: false,
    },
    {
      tick: 3,
      height: 0.45,
      x: 0.3,
      z: 0,
      inputX: 0.2,
      inputZ: 0,
      mode: 'walking' as const,
      terminal: false,
    },
    {
      tick: 4,
      height: 0.08,
      x: 4,
      z: 0,
      inputX: 3.9,
      inputZ: 0,
      mode: 'feeding' as const,
      terminal: true,
    },
    {
      tick: 5,
      height: 0.08,
      x: 4,
      z: 0,
      inputX: 4,
      inputZ: 0,
      mode: 'feeding' as const,
      terminal: true,
    },
  ];
  const recorded = history;
  const points = recordedTrails([recorded], 5.5, [{ x: 99, y: 99, z: 99 }])[0];
  expect(points).toHaveLength(4);
  expect(points[0].y).toBe(0.6);
  expect(points[1].y).toBe(0.525);
  expect(points[2].y).toBeGreaterThan(0);
  expect(points[2].y).toBeLessThan(0.6);
  expect(points[3].y).toBe(0.08);
  expect(points[3].breakBefore).toBe(true);
  const fractional = recordedTrails([recorded.slice(0, 1)], 1.5, [{ x: 0.15, y: 0.6, z: 0 }])[0];
  expect(fractional.at(-1)).toEqual({ x: 0.15, y: 0.6, z: 0, tick: 1.5 });
});

test('trail width follows shared projection and the head gap excludes the fly footprint', () => {
  let zoom = 100;
  const trails = new FlyTrails(
    1,
    projection(() => zoom),
  );
  const width = () => {
    const zs = snapshot(trails).positions.filter((_, i) => i % 3 === 2);
    return (Math.max(...zs) - Math.min(...zs)) * zoom;
  };
  trails.sample([path], 40, 0.18);
  expect(Math.max(...snapshot(trails).positions.filter((_, i) => i % 3 === 0))).toBeCloseTo(3.82);
  expect(width()).toBeCloseTo(1.5);
  zoom = 100000;
  trails.sample([path], 40, 0.18);
  expect(width()).toBeCloseTo(1.5);
});

test('vertical trails retain recorded centres and pixel width at both perspective depths', () => {
  const rig = new WorldCamera(
    new THREE.Box3(new THREE.Vector3(-3, 0, -3), new THREE.Vector3(3, 1, 3)),
    0.003,
  );
  rig.resize(1440, 900);
  rig.follow(new THREE.Vector3(0, 0.4, 0));
  const trails = new FlyTrails(1, rig);
  for (const zoom of [0, -100000]) {
    rig.zoom(zoom);
    trails.sample(
      [
        [
          { x: 0, y: 0.3, z: 0, tick: 1 },
          { x: 0, y: 0.4, z: 0, tick: 2 },
        ],
      ],
      2,
    );
    const vertices = trails.mesh.geometry.getAttribute('position');
    expect(trails.mesh.geometry.drawRange.count).toBe(6);
    for (const [a, b, y] of [
      [0, 1, 0.3],
      [2, 5, 0.4],
    ]) {
      const p = new THREE.Vector3().fromBufferAttribute(vertices, a),
        q = new THREE.Vector3().fromBufferAttribute(vertices, b);
      const left = rig.project(p),
        right = rig.project(q);
      expect(Math.hypot(left.x - right.x, left.y - right.y)).toBeCloseTo(1.5, 2);
      expect(p.add(q).multiplyScalar(0.5).y).toBeCloseTo(y, 7);
    }
  }
});
