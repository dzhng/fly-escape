import { expect, test } from "bun:test";
import { sconceEmitter, exitEmitter } from "@fly-escape/sim-client";
import { openWindowDetails, turnTheCornerDetails } from "./room-details";
import openWindow from "./open-window";
import turnTheCorner from "./turn-the-corner";

test("resolved campaign exports enable vision", () => {
  for (const content of [openWindow, turnTheCorner]) {
    expect(content.tuning.cues.filter(cue => cue.pathway === "vision")).toEqual([{ pathway: "vision", gain: 3 }]);
  }
});

test("every visible campaign fixture contributes exactly one resolved source", () => {
  for (const [content, details] of [[openWindow, openWindowDetails], [turnTheCorner, turnTheCornerDetails]] as const) {
    expect(content.level.sources).toEqual([
      ...details.filter(detail => detail.kind === "sconce").map(detail => sconceEmitter(detail).source),
      exitEmitter(content.level.exit).source,
    ]);
  }
});
