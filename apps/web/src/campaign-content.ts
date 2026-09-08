import { openWindowDetails, turnTheCornerDetails } from "./levels/room-details";
import type { CampaignLevel } from "./campaign";
import openWindow from "./levels/open-window";
import turnTheCorner from "./levels/turn-the-corner";

/** Existing authored puzzles, exposed for play while campaign balancing continues. */
export const campaignLevels: readonly CampaignLevel[] = [
  { ...openWindow, roomDetails: openWindowDetails, roomFloors: [{ roomId: 2, finish: "tile" }], title: "Open Window", description: "Guide the swarm from the office to the open window." },
  { ...turnTheCorner, roomDetails: turnTheCornerDetails, roomFloors: [{ roomId: 2, finish: "tile" }], title: "Turn the Corner", description: "Lead the swarm from the bottom room to the kitchen window." },
];
