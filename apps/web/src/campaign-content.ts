import { openWindowDetails, turnTheCornerDetails } from "./levels/room-details";
import type { CampaignLevel } from "./campaign";
import openWindow from "./levels/open-window";
import turnTheCorner from "./levels/turn-the-corner";

/** Existing authored puzzles, exposed for play while campaign balancing continues. */
export const campaignLevels: readonly CampaignLevel[] = [
  { ...openWindow, roomDetails: openWindowDetails, roomFloors: [{ roomId: 2, finish: "tile" }], title: "Open Window", description: "Guide the bedroom swarm through the house to the open window." },
  { ...turnTheCorner, roomDetails: turnTheCornerDetails, roomFloors: [{ roomId: 2, finish: "tile" }], title: "Turn the Corner", description: "Lead the study swarm around the house’s wrong turns to the kitchen window." },
];
