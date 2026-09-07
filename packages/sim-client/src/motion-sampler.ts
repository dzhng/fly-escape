import type { MotionSampler } from "./record";

let ready: Promise<MotionSampler> | undefined;

/** Main-thread playback loads the pure core sampler, without a neural graph or
 * a second simulation session. Concurrent mounts share WASM initialization. */
export function loadMotionSampler(): Promise<MotionSampler> {
  return ready ??= import("./wasm/game_wasm").then(async core => {
    await core.default();
    return core.sample_motion;
  }).catch(error => {
    ready = undefined;
    throw error;
  });
}
