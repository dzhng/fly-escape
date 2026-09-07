import { openWindowDetails, turnTheCornerDetails } from "./levels/room-details";
import type { CampaignLevel } from "./campaign";
import openWindow from "./levels/open-window";
import turnTheCorner from "./levels/turn-the-corner";

/** Existing authored puzzles, exposed for play while campaign balancing continues. */
export const campaignLevels: readonly CampaignLevel[] = [
  { ...openWindow, roomDetails: openWindowDetails, title: "Open Window", description: "Help the living-room swarm reach the nearby open window." },
  { ...turnTheCorner, roomDetails: turnTheCornerDetails, title: "Turn the Corner", description: "Guide the swarm from the study, through the hall and kitchen to the window." },
];
