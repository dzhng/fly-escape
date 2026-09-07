import type { RoomDetail } from "@fly-escape/game-renderer";

// Back faces meet the 12cm wall kit. Windows are closed wall attachments, separate from each level's escape opening.
const corridor: readonly RoomDetail[] = [
  { kind: "window", position: [0.8, 1.05, 0.10], quarterTurns: 0 },
  { kind: "sconce", position: [2.4, 1.45, 0.14], quarterTurns: 0 },
  { kind: "window", position: [4.0, 1.05, 0.10], quarterTurns: 0 },
  { kind: "sconce", position: [5.6, 1.45, 0.14], quarterTurns: 0 },
];
export const openWindowDetails: readonly RoomDetail[] = [
  ...corridor,
  { kind: "plant", position: [0.25, 1.05, 2.45], quarterTurns: 1 },
];
export const turnTheCornerDetails: readonly RoomDetail[] = [
  ...corridor,
  { kind: "plant", position: [0.25, 1.05, 2.45], quarterTurns: 1 },
  { kind: "plant", position: [3.45, 1.05, 5.45], quarterTurns: 1 },
  { kind: "sconce", position: [3.34, 1.45, 4.5], quarterTurns: 1 },
];
