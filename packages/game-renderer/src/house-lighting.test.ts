import { expect, test } from "bun:test";
import * as THREE from "three";
import { exitEmitter, sconceEmitter, type HouseLightMount } from "@fly-escape/sim-client";
import { RoomDetails } from "./room-details";
import { ExitGlow } from "./exit-glow";

function expectEmitter(light: THREE.PointLight, emitter: ReturnType<typeof sconceEmitter>) {
  const position = light.getWorldPosition(new THREE.Vector3());
  expect(position.x).toBeCloseTo(emitter.source.position.x, 12);
  expect(position.z).toBeCloseTo(emitter.source.position.z, 12);
  expect(position.y).toBeCloseTo(emitter.position[1], 12);
  expect(light.intensity).toBe(emitter.intensity);
  expect(light.distance).toBe(emitter.source.radius);
}

test("moving and rotating wall fixtures keeps rendered lights on their sensory sources", () => {
  for (const quarterTurns of [0, 1, 2, 3] as const) {
    const mount: HouseLightMount = { position: [2 + quarterTurns, 1.1, 4 - quarterTurns], quarterTurns };
    const details = new RoomDetails([{ ...mount, kind: "sconce" }], new Map([["sconce", new THREE.Group()]]));
    details.root.updateMatrixWorld(true);
    const light = details.root.children.find(object => object instanceof THREE.PointLight) as THREE.PointLight;
    expectEmitter(light, sconceEmitter(mount));
  }
});

test("moving and reorienting an exit keeps its rendered light on its sensory source", () => {
  for (const outward of [{ x: -1, z: 0 }, { x: 0, z: 1 }, { x: 3, z: -3 }]) {
    const exit = { a: { x: 2, z: 3 }, b: { x: 4, z: 3 }, outward };
    const glow = new ExitGlow(exit);
    glow.root.updateMatrixWorld(true);
    const light = glow.root.children.find(object => object instanceof THREE.PointLight) as THREE.PointLight;
    expectEmitter(light, exitEmitter(exit));
    glow.dispose();
  }
});
