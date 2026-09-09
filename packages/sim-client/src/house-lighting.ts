import type { ExitOpening, Source } from "./generated/sim";

export type HouseLightMount = {
  position: readonly [number, number, number];
  quarterTurns: 0 | 1 | 2 | 3;
};

/** Visual intensity and sensory rate are separate game assumptions, not photometry. */
function emitter(position: [number, number, number], intensity: number, rate: number, radius: number) {
  const source: Source = { kind: "lamp", position: { x: position[0], z: position[2] }, rate, radius };
  return { position, intensity, distance: radius, source };
}

export function sconceEmitter(mount: HouseLightMount) {
  const [dx, dz] = [[0, 0.22], [0.22, 0], [0, -0.22], [-0.22, 0]][mount.quarterTurns];
  return { ...emitter([mount.position[0] + dx, mount.position[1] + 0.18, mount.position[2] + dz], 0.45, 0.45, 2.5),
    color: "#ffca88", decay: 2 };
}

export function exitEmitter(exit: ExitOpening) {
  const normal = Math.hypot(exit.outward.x, exit.outward.z);
  return emitter([
    (exit.a.x + exit.b.x) / 2 - 0.55 * exit.outward.x / normal,
    1.15,
    (exit.a.z + exit.b.z) / 2 - 0.55 * exit.outward.z / normal,
  ], 9, 9, 4.6);
}
