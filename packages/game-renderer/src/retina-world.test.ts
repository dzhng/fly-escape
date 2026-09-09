import { expect, test } from "bun:test";
import { retinaWorldIdentity, type RetinaWorldDefinition } from "./retina-world";

const definition = (): RetinaWorldDefinition => ({
  geometry: { rooms: [{ id: 1, min: { x: 0, z: 0 }, max: { x: 4, z: 4 } }], walls: [], solids: [] },
  roomFloors: [], roomDetails: [], placements: [{ id: 1, kind: "lamp", position: { x: 1, z: 2 }, heading: 0 }],
  catalog: [{ kind: "lamp", footprintRadius: .3, contact: null }], lighting: { daylightDirection: [-1, 0] },
});

test("scene identity binds physical authoring and ignores presentation/scoring metadata", async () => {
  const source = definition();
  const first = await retinaWorldIdentity(source);
  const decorated = { ...source, exit: { outward: [1, 0], reward: 999 }, selectedFly: 3, playerCamera: [5, 6, 7],
    catalog: source.catalog.map(tool => ({ ...tool, effect: { type: "source", rate: 1234 } })) };
  expect(await retinaWorldIdentity(decorated)).toBe(first);
  const reordered = { ...source, geometry: { solids: [], walls: [], rooms: source.geometry.rooms } };
  expect(await retinaWorldIdentity(reordered)).toBe(first);
  for (const changed of [
    { ...source, placements: [{ ...source.placements[0], position: { x: 2, z: 2 } }] },
    { ...source, lighting: { daylightDirection: [1, 0] as const } },
    { ...source, catalog: [{ ...source.catalog[0], footprintRadius: .4 }] },
  ]) expect(await retinaWorldIdentity(changed)).not.toBe(first);
});

test("asynchronous scene identity snapshots the caller's authoring", async () => {
  const source = definition();
  const first = await retinaWorldIdentity(source);
  const pending = retinaWorldIdentity(source);
  source.geometry.rooms[0].max.x = 40;
  expect(await pending).toBe(first);
  expect(await retinaWorldIdentity(source)).not.toBe(first);
});
