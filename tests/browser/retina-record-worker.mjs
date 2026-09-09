// Browser/WASM boundary probe with explicitly controlled RGB, not physical capture.
import init, {
  AttemptSession,
  swarm_request,
} from "../../packages/sim-client/src/wasm/game_wasm.js";
import { parseRecordHeader } from "../../packages/sim-client/src/record.ts";
const hash = async (bytes) =>
  Array.from(
    new Uint8Array(await crypto.subtle.digest("SHA-256", bytes)),
    (b) => b.toString(16).padStart(2, "0"),
  ).join("");
self.onmessage = async (event) => {
  const {flyCount = 2, attemptId = "record-worker", palette = 0} = event.data;
  let core;
  try {
    const wasm = await init();
    const [graph, manifest, mapText] = await Promise.all([
      fetch("/brain/graph.bin").then((r) => r.arrayBuffer()),
      fetch("/brain/manifest.json").then((r) => r.text()),
      fetch(
        new URL(
          "../../specs/retinal-vision/assets/05/retinal-map.json",
          import.meta.url,
        ),
      ).then((r) => r.text()),
    ]);
    const map = JSON.parse(mapText),
      identity = map.identities;
    const config = {
      clientGeneration: 7,
      sceneId: palette ? `controlled-record-worker-${palette}` : "controlled-record-worker",
      mapHash: await hash(new TextEncoder().encode(mapText)),
      profile: {
        profileHash: identity.profileHash,
        layoutHash: identity.layoutHash,
        rigHash: identity.rigHash,
        colorModelHash: identity.colorModelHash,
        width: map.profile.capture.width,
        height: map.profile.capture.height,
        sampleCount: map.profile.layout.cells.length,
      },
    };
    const request = JSON.parse(swarm_request(attemptId, "42", flyCount, 12));
    core = AttemptSession.new_retinal(
      new Uint8Array(graph),
      manifest,
      JSON.stringify(request),
      JSON.stringify(config),
      mapText,
    );
    const info = JSON.parse(core.info());
    self.postMessage({ type: "info", info, request });
    let staging = 0,
      maxStaging = 0,
      packedTotal = 0;
    const expected = [];
    for (let tick = 1; tick <= 12; tick++) {
      const prepared = core.prepare_tick(),
        input = JSON.parse(prepared),
        width = config.profile.sampleCount * 6;
      const rgb = new Uint8Array(input.poses.length * width);
      input.poses.forEach((pose, fly) => {
        for (let sample = 0; sample < width; sample++)
          rgb[fly * width + sample] =
            tick === 1 && pose.flyId === 0
              ? 0
              : (tick * 17 + pose.flyId * 31 + sample * 13 + palette * 7) % 256;
      });
      expected.push({ tick, request: input, rgb: rgb.slice() });
      staging += rgb.byteLength;
      maxStaging = Math.max(staging, maxStaging);
      const step = JSON.parse(core.commit_tick(prepared, rgb));
      if (step.bufferedTicks === 10 || step.complete) {
        const packed = core.take_chunk();
        const chunk = {
          ...parseRecordHeader(packed.header()),
          retinaRgb: packed.take_retina_rgb(),
          values: packed.take_values(),
          states: packed.take_states(),
          events: packed.take_events(),
          tickNeuralSteps: packed.take_tick_neural_steps(),
          motionOffsets: packed.take_motion_offsets(),
          motionValues: packed.take_motion_values(),
          motionStates: packed.take_motion_states(),
        };
        packed.free();
        packedTotal += chunk.retinaRgb.byteLength;
        const buffers = Object.values(chunk)
          .filter(ArrayBuffer.isView)
          .map((view) => view.buffer);
        self.postMessage({ type: "chunk", chunk }, buffers);
        staging = 0;
      }
    }
    self.postMessage({
      type: "complete",
      expected,
      metrics: {
        maxRgbStaging: maxStaging,
        packedRgbBytes: packedTotal,
        wasmHighWater: wasm.memory.buffer.byteLength,
      },
    });
  } catch (error) {
    self.postMessage({ type: "error", message: String(error) });
  } finally {
    core?.free();
  }
};
