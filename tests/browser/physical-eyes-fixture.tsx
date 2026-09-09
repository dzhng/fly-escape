import React from "react";
import { createRoot } from "react-dom/client";
import { AttemptPlayback } from "../../apps/web/src/playback";
import { campaignLevels } from "../../apps/web/src/campaign-content";
import { AttemptClient, type AttemptReply, type AttemptInfo } from "../../packages/sim-client/src";
import { FrameArchive } from "../../packages/sim-client/src/record";
import "../../apps/web/src/style.css";

const content = campaignLevels[0];
const input = { attemptId: "physical-eye-panels", rootSeed: "42", flyCount: 16,
  level: { ...content.level, durationTicks: 12 }, tuning: content.tuning, placements: [] };
const evidence: { archive?: FrameArchive; info?: AttemptInfo; chunks: number; complete: boolean; errors: string[] } = {
  chunks: 0, complete: false, errors: [],
};
declare global { interface Window { physicalEyes: typeof evidence; } }
window.physicalEyes = evidence;
/** Observes the production transport; capture, native computation and UI playback remain unchanged. */
class EvidenceClient extends AttemptClient {
  override setReceiver(receive: (reply: AttemptReply) => void) {
    super.setReceiver(reply => {
      if (reply.type === "ready") {
        evidence.info = reply.info;
        evidence.archive = new FrameArchive(reply.info.spec, reply.info.recordLayout, reply.info.archiveBytes, reply.info.initialBodies);
      }
      if (reply.type === "frames") { evidence.archive!.append(structuredClone(reply.chunk)); evidence.chunks++; }
      if (reply.type === "complete") evidence.complete = true;
      if (reply.type === "error") evidence.errors.push(reply.message);
      receive(reply);
    });
  }
}
const client = new EvidenceClient(() => {});
const catalog = await client.setup({ type: "catalog" });
createRoot(document.getElementById("root")!).render(<AttemptPlayback input={input} client={client} catalog={catalog}
  roomDetails={content.roomDetails} roomFloors={content.roomFloors} lighting={content.lighting} />);
