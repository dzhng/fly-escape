import { openWindowSconces, turnTheCornerSconces } from "./house-lighting";
import { doorwayDetails, type RoomDetail } from "@fly-escape/game-renderer";
import openWindow from "./open-window";
import turnTheCorner from "./turn-the-corner";

// Decorations retain native dimensions; door frames derive from the physical gaps.
const shared: readonly RoomDetail[] = [
  { kind: "window", position: [2.2, 1.0, 0.10], quarterTurns: 0 },
  { kind: "window", position: [6.9, 1.0, 0.10], quarterTurns: 0 },
  { kind: "plant", position: [0.25, 1.05, 3.4], quarterTurns: 1 },
];
export const openWindowDetails: readonly RoomDetail[] = [
  ...shared, ...openWindowSconces.map(mount => ({ ...mount, kind: "sconce" as const })), ...doorwayDetails(openWindow.level.geometry),
  { kind: "exitWindow", position: [0, 0, 2.25], quarterTurns: 1 },
];
export const turnTheCornerDetails: readonly RoomDetail[] = [
  ...shared, ...turnTheCornerSconces.map(mount => ({ ...mount, kind: "sconce" as const })), ...doorwayDetails(turnTheCorner.level.geometry),
  { kind: "exitWindow", position: [9.6, 0, 2.25], quarterTurns: 3 },
];
