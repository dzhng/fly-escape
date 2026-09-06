import type { Geometry } from "@fly-escape/sim-client";

/** Diagnostic paths are derived from shared room boundaries minus wall coverage. */
export function doorwayProbes(geometry: Geometry) {
  const probes: { label: string; x: number; z: number; dx: number; dz: number }[] = [];
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
          const center = (start + lo) / 2;
          probes.push({ label: `Room ${a.id} ↔ ${b.id}`, x: axis === "x" ? boundary : center, z: axis === "z" ? boundary : center, dx: axis === "x" ? 1 : 0, dz: axis === "z" ? 1 : 0 });
        }
        start = Math.max(start, hi);
      }
    }
  }
  return probes;
}
