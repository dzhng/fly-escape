import "../../apps/web/src/style.css";
import React from "react";
import { createRoot } from "react-dom/client";
import { AttemptPlayback } from "../../apps/web/src/playback";
import { AttemptClient } from "../../packages/sim-client/src";
import { campaignLevels } from "../../apps/web/src/campaign-content";
const query = new URLSearchParams(location.search);
const content = campaignLevels[Number(query.get("level") ?? 0)];
const horizon = Number(query.get("ticks") ?? content.level.durationTicks);
if (!Number.isInteger(horizon) || horizon < 1 || horizon > 6000) throw new Error("Invalid diagnostic horizon");
// This fixture changes only the diagnostic horizon; authored campaign timers remain intact.
const input = { attemptId:"retinal-campaign-budget",rootSeed:"42",flyCount:16,
  level:{...content.level,durationTicks:horizon},tuning:content.tuning,placements:[] };
const client = new AttemptClient(() => {});
const catalog = await client.setup({type:"catalog"});
createRoot(document.getElementById("root")!).render(<AttemptPlayback input={input} client={client} catalog={catalog}
  roomDetails={content.roomDetails} roomFloors={content.roomFloors} lighting={content.lighting} />);
