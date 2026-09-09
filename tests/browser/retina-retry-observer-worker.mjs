// Read-only acquisition telemetry around the unchanged production worker.
import { RetinaCapture } from "../../packages/game-renderer/src/retina-capture";
let attemptId, active = 0, acquisition;
globalThis.__retinaBeforeNativeCommit = bytes => {
  if (!acquisition) return;
  const totalMs = performance.now() - acquisition.began;
  if (bytes !== acquisition.bytes) throw new Error("Observed transfer differs from captured RGB");
  self.postMessage({type:"retinaTransferObservation",attemptId:acquisition.id,totalMs,flies:acquisition.flies});
  acquisition = undefined;
};
self.addEventListener("message", ({data}) => { if (data.type === "start") attemptId = data.input.attemptId; });
const acquire = RetinaCapture.prototype.acquire;
RetinaCapture.prototype.acquire = async function(...args) {
  const id = attemptId;
  const began = performance.now();
  active++;
  try {
    const result = await acquire.apply(this, args);
    acquisition = {id,began,flies:args[0].length,bytes:result.samples.length};
    self.postMessage({type:"retinaCaptureObservation",attemptId:id,active,metrics:result.metrics});
    return result;
  } finally { active--; }
};
await import("../../packages/sim-client/src/attempt-worker.ts");
self.postMessage({type:"retinaObserverReady"});
