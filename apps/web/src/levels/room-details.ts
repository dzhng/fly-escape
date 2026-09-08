import { doorwayDetails, type RoomDetail } from "@fly-escape/game-renderer";
import openWindow from "./open-window";
import turnTheCorner from "./turn-the-corner";

// Decorations retain native dimensions; door frames derive from the physical gaps.
const shared: readonly RoomDetail[] = [
  { kind: "window", position: [2.2, 1.0, 0.10], quarterTurns: 0 },
  { kind: "window", position: [6.9, 1.0, 0.10], quarterTurns: 0 },
  { kind: "sconce", position: [3.8, 1.45, 0.14], quarterTurns: 0 },
  { kind: "sconce", position: [8.05, 1.45, 0.14], quarterTurns: 0 },
  { kind: "plant", position: [0.25, 1.05, 3.4], quarterTurns: 1 },
];
export const openWindowDetails: readonly RoomDetail[] = [
  ...shared, ...doorwayDetails(openWindow.level.geometry),
  { kind: "exitWindow", position: [0, 0, 2.25], quarterTurns: 1 },
];
export const turnTheCornerDetails: readonly RoomDetail[] = [
  ...shared, ...doorwayDetails(turnTheCorner.level.geometry),
  { kind: "sconce", position: [0.14, 1.45, 7.1], quarterTurns: 1 },
  { kind: "exitWindow", position: [9.6, 0, 2.25], quarterTurns: 3 },
];
