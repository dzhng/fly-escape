import type { Geometry } from "@fly-escape/sim-client";

/** Interior openings are shared room boundaries minus the physical wall coverage. */
export function doorwayOpenings(geometry: Geometry) {
  const openings: { rooms: readonly [number, number]; a: { x: number; z: number }; b: { x: number; z: number } }[] = [];
  for (const [i, a] of geometry.rooms.entries()) for (const b of geometry.rooms.slice(i + 1)) {
    for (const axis of ["x", "z"] as const) {
      const along = axis === "x" ? "z" : "x";
      const boundary = a.max[axis] === b.min[axis] ? a.max[axis] : b.max[axis] === a.min[axis] ? a.min[axis] : null;
      if (boundary === null) continue;
      const low = Math.max(a.min[along], b.min[along]);
      const high = Math.min(a.max[along], b.max[along]);
      if (high <= low) continue;
      const blocked = geometry.walls.filter(w => w.a[axis] === boundary && w.b[axis] === boundary)
        .map(w => [Math.max(low, Math.min(w.a[along], w.b[along])), Math.min(high, Math.max(w.a[along], w.b[along]))])
        .filter(([lo, hi]) => hi > lo).sort((a, b) => a[0] - b[0]);
      let start = low;
      for (const [lo, hi] of [...blocked, [high, high]]) {
        if (lo > start) {
          openings.push({ rooms: [a.id, b.id],
            a: { x: axis === "x" ? boundary : start, z: axis === "z" ? boundary : start },
            b: { x: axis === "x" ? boundary : lo, z: axis === "z" ? boundary : lo },
          });
        }
        start = Math.max(start, hi);
      }
    }
  }
  return openings;
}
