import { openWindowDetails, turnTheCornerDetails } from "./levels/room-details";
import type { CampaignLevel } from "./campaign";
import openWindow from "./levels/open-window";
import turnTheCorner from "./levels/turn-the-corner";

/** Existing authored puzzles, exposed for play while campaign balancing continues. */
export const campaignLevels: readonly CampaignLevel[] = [
  { ...openWindow, roomDetails: openWindowDetails, title: "Open Window", description: "Guide the flies through the rooms to the open window." },
  { ...turnTheCorner, roomDetails: turnTheCornerDetails, title: "Turn the Corner", description: "Use the bend in the route to reach the upper window." },
];
