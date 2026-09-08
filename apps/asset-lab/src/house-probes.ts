import type { Geometry } from "@fly-escape/sim-client";
import { doorwayOpenings } from "@fly-escape/game-renderer";

/** Diagnostic paths cross the same openings used to fit the visible door frames. */
export function doorwayProbes(geometry: Geometry) {
  return doorwayOpenings(geometry).map(({ rooms, a, b }) => ({
    label: `Room ${rooms[0]} ↔ ${rooms[1]}`,
    x: (a.x + b.x) / 2, z: (a.z + b.z) / 2,
    dx: a.x === b.x ? 1 : 0, dz: a.z === b.z ? 1 : 0,
  }));
}
