import { expect, test } from "bun:test";
import { campaignLevels } from "../campaign-content";
import { doorwayOpenings } from "@fly-escape/game-renderer";

for (const { level } of campaignLevels) test(`${level.id}: the release has a connected route through multiple rooms`, () => {
  if (level.spawn.kind !== "cluster") throw new Error("Campaign requires a clustered start");
  const start = { x: (level.spawn.min.x + level.spawn.max.x) / 2, z: (level.spawn.min.z + level.spawn.max.z) / 2 };
  const exit = { x: (level.exit.a.x + level.exit.b.x) / 2, z: (level.exit.a.z + level.exit.b.z) / 2 };
  const roomAt = (p: { x: number; z: number }) => level.geometry.rooms.find(r => p.x >= r.min.x && p.x <= r.max.x && p.z >= r.min.z && p.z <= r.max.z)!.id;
  const neighbours = new Map(level.geometry.rooms.map(r => [r.id, [] as number[]]));
  for (const { rooms: [a, b] } of doorwayOpenings(level.geometry)) {
    neighbours.get(a)!.push(b); neighbours.get(b)!.push(a);
  }
  const distance = new Map([[roomAt(start), 0]]);
  const queue = [roomAt(start)];
  for (const room of queue) for (const next of neighbours.get(room)!) {
    if (distance.has(next)) continue;
    distance.set(next, distance.get(room)! + 1); queue.push(next);
  }
  expect(distance.size).toBe(level.geometry.rooms.length);
  expect(distance.get(roomAt(exit))).toBeGreaterThanOrEqual(3);
  expect([...neighbours].some(([id, exits]) => id !== roomAt(start) && id !== roomAt(exit) && exits.length === 1)).toBe(true);
});
