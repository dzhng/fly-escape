import type { CampaignLevel } from "./campaign";
import openWindow from "./levels/open-window";
import turnTheCorner from "./levels/turn-the-corner";

/** Existing authored puzzles, exposed for play while campaign balancing continues. */
export const campaignLevels: readonly CampaignLevel[] = [
  { ...openWindow, title: "Open Window", description: "Guide the flies through the rooms to the open window." },
  { ...turnTheCorner, title: "Turn the Corner", description: "Use the bend in the route to reach the upper window." },
];
