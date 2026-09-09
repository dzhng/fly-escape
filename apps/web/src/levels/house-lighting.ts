import { exitEmitter, sconceEmitter, type HouseLightMount, type LevelDef } from "@fly-escape/sim-client";

const shared: readonly HouseLightMount[] = [
  { position: [3.8, 1.45, 0.14], quarterTurns: 0 },
  { position: [8.05, 1.45, 0.14], quarterTurns: 0 },
];
export const openWindowSconces = shared;
export const turnTheCornerSconces: readonly HouseLightMount[] = [
  ...shared, { position: [0.14, 1.45, 7.1], quarterTurns: 1 },
];

/** Resolve before export so every consumer receives the same authored light field. */
export function resolveHouseLighting(level: LevelDef, sconces: readonly HouseLightMount[]): LevelDef {
  return { ...level, sources: [...level.sources, ...sconces.map(mount => sconceEmitter(mount).source), exitEmitter(level.exit).source] };
}
