import type { RoomDetail } from "@fly-escape/game-renderer";

// Wall attachments preserve native dimensions and leave furniture and doors clear.
const shared: readonly RoomDetail[] = [
  { kind: "window", position: [2.2, 1.0, 0.10], quarterTurns: 0 },
  { kind: "window", position: [6.6, 1.0, 0.10], quarterTurns: 0 },
  { kind: "sconce", position: [3.8, 1.45, 0.14], quarterTurns: 0 },
  { kind: "sconce", position: [5.2, 1.45, 0.14], quarterTurns: 0 },
  { kind: "plant", position: [0.25, 1.05, 3.4], quarterTurns: 1 },
];
const sharedDoors: readonly RoomDetail[] = [
  { kind: "doorway", position: [4.8, 0, 2.55], quarterTurns: 1 },
  { kind: "doorway", position: [2.25, 0, 4.5], quarterTurns: 0 },
  { kind: "doorway", position: [6.45, 0, 4.5], quarterTurns: 0 },
  { kind: "doorway", position: [1.65, 0, 6], quarterTurns: 0 },
];
export const openWindowDetails: readonly RoomDetail[] = [
  ...shared, ...sharedDoors,
  { kind: "doorway", position: [6.45, 0, 6], quarterTurns: 0 },
];
export const turnTheCornerDetails: readonly RoomDetail[] = [
  ...shared, ...sharedDoors,
  { kind: "doorway", position: [4.8, 0, 6], quarterTurns: 0 },
  { kind: "doorway", position: [7.35, 0, 6], quarterTurns: 0 },
  { kind: "sconce", position: [0.14, 1.45, 7.1], quarterTurns: 1 },
];
