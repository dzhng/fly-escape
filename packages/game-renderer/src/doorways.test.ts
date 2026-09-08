import { expect, test } from "bun:test";
import * as THREE from "three";
import type { Geometry } from "@fly-escape/sim-client";
import { doorwayDetails, RoomDetails } from "./room-details";
import { loadStaticHouseModel } from "./house";
import { disposeObjectResources } from "./resources";
import envelope from "../../../assets/house/doorway/envelope.json";

const geometry: Geometry = {
  rooms: [
    { id: 1, min: { x: 0, z: 0 }, max: { x: 5, z: 2 } },
    { id: 2, min: { x: 0, z: 2 }, max: { x: 5, z: 5 } },
  ],
  walls: [
    { a: { x: 0, z: 2 }, b: { x: 0.9, z: 2 } },
    { a: { x: 3.6, z: 2 }, b: { x: 5, z: 2 } },
  ], solids: [],
};

test("a widened opening carries its frame to both wall ends without thickening the posts", async () => {
  const [a, b, c, d, e, f] = envelope.bounds;
  const template = await loadStaticHouseModel(
    await Bun.file(new URL("../../../assets/house/doorway/doorway.glb", import.meta.url)).arrayBuffer(),
    { name: "doorway", bounds: [a, b, c, d, e, f] },
  );
  const original = new THREE.Box3().setFromObject(template.root.getObjectByName("DoorFrameLeft")!);
  const details = new RoomDetails(doorwayDetails(geometry), new Map([["doorway", template.root]]));
  try {
    details.root.updateMatrixWorld(true);
    const left = new THREE.Box3().setFromObject(details.root.getObjectByName("DoorFrameLeft")!);
    const right = new THREE.Box3().setFromObject(details.root.getObjectByName("DoorFrameRight")!);
    expect(left.max.x).toBeCloseTo(geometry.walls[0].b.x, 6);
    expect(right.min.x).toBeCloseTo(geometry.walls[1].a.x, 6);
    expect(left.max.x - left.min.x).toBeCloseTo(original.max.x - original.min.x, 6);
    expect(right.min.z).toBeCloseTo(2 - 0.08, 6);
    expect(right.max.z).toBeCloseTo(2 + 0.08, 6);
  } finally { disposeObjectResources(details.root); template.dispose(); }
});

test("closing an opening removes its frame instead of retaining a separate decoration", () => {
  expect(doorwayDetails(geometry)).toHaveLength(1);
  expect(doorwayDetails({ ...geometry, walls: [{ a: { x: 0, z: 2 }, b: { x: 5, z: 2 } }] })).toEqual([]);
});
