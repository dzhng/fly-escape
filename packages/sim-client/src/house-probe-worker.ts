import init, { house_probe } from "./wasm/game_wasm";
import type { HouseProbeRequest, HouseProbeReply } from "./house-probe";
const ready = init();
self.onmessage = async ({ data }: MessageEvent<HouseProbeRequest>) => {
  let reply: HouseProbeReply;
  try {
    await ready;
    reply = { id: data.id, probe: JSON.parse(house_probe(data.progress, data.detour)) };
  } catch (error) {
    reply = { id: data.id, error: error instanceof Error ? error.message : String(error) };
  }
  self.postMessage(reply);
};
