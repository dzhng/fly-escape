import "../../apps/web/src/style.css";
// Browser-only authored content; never imported by the release registry.
import React from "react";
import { createRoot } from "react-dom/client";
import { AttemptClient } from "../../packages/sim-client/src";
import { Campaign, type CampaignLevel } from "../../apps/web/src/campaign";
const client = new AttemptClient(() => {});
const fixture = await client.setup({ type: "fixture" });
client.dispose();
const levels: CampaignLevel[] = ["First", "Second", "Third"].map((title, index) => {
  const level = structuredClone(fixture.level);
  level.id = `test-campaign-${index}`;
  level.durationTicks = 1;
  level.placementRules.inventory = [{ kind: index === 1 ? "crumbs" : "fruit", count: 1 }];
  return { title, description: "Test-authored progression fixture", level, tuning: fixture.tuning };
});
createRoot(document.getElementById("root")!).render(<Campaign levels={levels} />);
