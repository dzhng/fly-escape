import { expect, test } from "bun:test";
import * as THREE from "three";
import type { ExitOpening } from "@fly-escape/sim-client";
import { APERTURE_V, ExitGlow, hazeAlpha, poolAlpha } from "./exit-glow";

// The two campaign openings, plus the same opening with a and b authored in the other
// order: the frame must come from `outward`, never from the vertex order or a map name.
const openings: Record<string, ExitOpening> = {
  "west wall": { a: { x: 0, z: 1.8 }, b: { x: 0, z: 2.7 }, outward: { x: -1, z: 0 } },
  "east wall": { a: { x: 9.6, z: 1.8 }, b: { x: 9.6, z: 2.7 }, outward: { x: 1, z: 0 } },
  "east wall, reversed": { a: { x: 9.6, z: 2.7 }, b: { x: 9.6, z: 1.8 }, outward: { x: 1, z: 0 } },
  "diagonal": { a: { x: 2, z: 2 }, b: { x: 2.6, z: 2.6 }, outward: { x: 3, z: -3 } },
};

/** Extent of `mesh` along `axis`, measured from the opening centre in the floor plane. */
function span(mesh: THREE.Object3D, centre: THREE.Vector3, axis: THREE.Vector3) {
  const geometry = (mesh as THREE.Mesh).geometry;
  geometry.computeBoundingBox();
  const local = geometry.boundingBox!;
  let low = Infinity;
  let high = -Infinity;
  for (const x of [local.min.x, local.max.x]) {
    for (const y of [local.min.y, local.max.y]) {
      for (const z of [local.min.z, local.max.z]) {
        const world = mesh.localToWorld(new THREE.Vector3(x, y, z));
        const along = (world.x - centre.x) * axis.x + (world.z - centre.z) * axis.z;
        low = Math.min(low, along);
        high = Math.max(high, along);
      }
    }
  }
  return { low, high };
}

test("the spill is framed by the opening's own outward normal, whatever its orientation", () => {
  for (const exit of Object.values(openings)) {
    const glow = new ExitGlow(exit);
    glow.root.updateMatrixWorld(true);
    const centre = new THREE.Vector3((exit.a.x + exit.b.x) / 2, 0, (exit.a.z + exit.b.z) / 2);
    const reach = Math.hypot(exit.outward.x, exit.outward.z);
    const inward = new THREE.Vector3(-exit.outward.x / reach, 0, -exit.outward.z / reach);
    const across = new THREE.Vector3(inward.z, 0, -inward.x);
    const width = Math.hypot(exit.b.x - exit.a.x, exit.b.z - exit.a.z);
    const [pool, haze, lamp] = glow.root.children;

    // The pool travels into the room, and crosses the threshold rather than ending on it.
    const depth = span(pool, centre, inward);
    expect(depth.high).toBeGreaterThan(1.5);
    expect(depth.low).toBeLessThan(-0.1);
    expect(depth.low).toBeGreaterThan(-0.75);
    // It fans wider than the opening rather than running as a parallel-sided slab.
    const fan = span(pool, centre, across);
    expect(fan.high - fan.low).toBeGreaterThan(width + 1);
    expect(fan.high).toBeCloseTo(-fan.low, 5);

    // The glare hangs in the opening, clear of the 0.06 m wall half-depth it shines past.
    const hazeBox = new THREE.Box3().setFromObject(haze);
    const inset = span(haze, centre, inward);
    expect(inset.low).toBeGreaterThan(0.06);
    expect(inset.high).toBeLessThan(0.3);
    expect(hazeBox.min.y).toBeCloseTo(0, 5);
    // Low enough to still read as light where the exit wall is cut to its 0.15 m base.
    expect(hazeBox.max.y).toBeLessThan(1.5);

    // The single local light sits inside the room, so real surfaces catch it.
    const position = lamp.getWorldPosition(new THREE.Vector3());
    const reachIn = position.clone().sub(centre).dot(inward);
    expect(reachIn).toBeGreaterThan(0.2);
    expect(reachIn).toBeLessThan(depth.high);
    expect(position.y).toBeGreaterThan(0.5);
    expect(position.y).toBeLessThan(2.5);
    expect(lamp).toBeInstanceOf(THREE.PointLight);
    glow.dispose();
  }
});

test("the glow is drawn as light: additive, depth-tested and never depth-writing", () => {
  const glow = new ExitGlow(openings["west wall"]);
  const lights: THREE.Light[] = [];
  glow.root.traverse((object) => {
    if (object instanceof THREE.Light) lights.push(object);
    if (!(object instanceof THREE.Mesh)) return;
    const material = object.material as THREE.MeshBasicMaterial;
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
    expect(material.depthTest).toBe(true);
    expect(material.blending).toBe(THREE.AdditiveBlending);
    // Warm yellow, and never opaque enough to hide what the light falls on.
    const hue = material.color.getHSL({ h: 0, s: 0, l: 0 }, THREE.SRGBColorSpace).h * 360;
    expect(hue).toBeGreaterThan(30);
    expect(hue).toBeLessThan(55);
    expect(material.opacity).toBeLessThan(1);
  });
  expect(lights).toHaveLength(1);
  expect(lights[0].castShadow).toBe(false);
  glow.dispose();
});

test("the pool peaks at the opening and fades out before either end", () => {
  const core = 0.45 / (0.9 + 1.8);
  expect(poolAlpha(core, 0.5, APERTURE_V)).toBeCloseTo(1, 6);
  expect(poolAlpha(core, 0.5, 1)).toBe(0);
  expect(poolAlpha(core, 0.5, 0)).toBe(0);
  for (const u of [0, 1]) expect(poolAlpha(core, u, APERTURE_V)).toBe(0);
  for (const offset of [0.05, 0.15, 0.3]) {
    expect(poolAlpha(core, 0.5 - offset, 0.6)).toBeCloseTo(poolAlpha(core, 0.5 + offset, 0.6), 12);
  }
  let previous = 1;
  for (let v = APERTURE_V; v >= 0; v -= APERTURE_V / 12) {
    const alpha = poolAlpha(core, 0.5, v);
    expect(alpha).toBeLessThanOrEqual(previous + 1e-12);
    previous = alpha;
  }
  // At the opening the beam is no wider than the opening; deeper in, it has spread past it.
  expect(poolAlpha(core, 0.5 + core, APERTURE_V)).toBe(0);
  expect(poolAlpha(core, 0.5 + core, APERTURE_V * 0.35)).toBeGreaterThan(0);
});

test("the haze fades out well below its top edge, so it never reads as a pane", () => {
  const core = 0.45 / (0.9 + 0.44);
  const column = Array.from({ length: 101 }, (_, step) => hazeAlpha(core, 0.5, step / 100));
  expect(column[0]).toBe(0);
  expect(Math.max(...column)).toBeCloseTo(1, 6);
  // The brightest band sits low, and the whole upper plane is empty.
  expect(column.indexOf(Math.max(...column))).toBeLessThan(35);
  expect(column.slice(85).every(alpha => alpha === 0)).toBe(true);
  for (const u of [0, 1]) expect(Math.max(...column.map((_, step) => hazeAlpha(core, u, step / 100)))).toBe(0);
  expect(hazeAlpha(core, 0.5 + core, 0.2)).toBeLessThan(hazeAlpha(core, 0.5, 0.2));
});

test("an unchanged opening reuses the glow, and disposal releases every field once", () => {
  const glow = new ExitGlow(openings["west wall"]);
  expect(glow.matches({ a: { x: 0, z: 1.8 }, b: { x: 0, z: 2.7 }, outward: { x: -1, z: 0 } })).toBe(true);
  expect(glow.matches(openings["east wall"])).toBe(false);
  expect(glow.matches({ ...openings["west wall"], outward: { x: -1, z: 0.2 } })).toBe(false);

  const scene = new THREE.Scene();
  scene.add(glow.root);
  const disposals = new Map<object, number>();
  const watch = (resource: THREE.BufferGeometry | THREE.Material | THREE.Texture) => {
    disposals.set(resource, 0);
    resource.addEventListener("dispose", () => disposals.set(resource, disposals.get(resource)! + 1));
  };
  glow.root.traverse((object) => {
    if (!(object instanceof THREE.Mesh)) return;
    watch(object.geometry);
    const material = object.material as THREE.MeshBasicMaterial;
    watch(material);
    watch(material.map!);
  });
  expect(disposals.size).toBe(6);

  glow.dispose();
  expect(scene.children).toEqual([]);
  expect([...disposals.values()]).toEqual([1, 1, 1, 1, 1, 1]);
});

test("an opening without a width or an outward direction is rejected rather than drawn", () => {
  expect(() => new ExitGlow({ a: { x: 1, z: 1 }, b: { x: 1, z: 1 }, outward: { x: 1, z: 0 } })).toThrow();
  expect(() => new ExitGlow({ a: { x: 1, z: 1 }, b: { x: 1, z: 2 }, outward: { x: 0, z: 0 } })).toThrow();
});
