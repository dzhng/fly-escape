import { RetinaCapture, type RetinalPose } from "../../packages/game-renderer/src/retina-capture";
import { createRetinaWorld, type RetinaWorldDefinition } from "../../packages/game-renderer/src/retina-world";
import { FLIES, MAX_TICKS, type Tape } from "./retinal-baseline-record";

let tape: Tape;
let capture: RetinaCapture;
let world: Awaited<ReturnType<typeof createRetinaWorld>>;
let tick = 0, captureCalls = 0, activeFlyTicks = 0, rgbBytes = 0, initializationMs = 0;
let elapsed: Float64Array;
let lastMetrics: unknown, gpu = "unknown";
export async function configureCaptureControl(message: { tape: Tape; definition: RetinaWorldDefinition }) {
  if (capture || !Number.isInteger(message.tape.ticks) || message.tape.ticks < 1 || message.tape.ticks > MAX_TICKS ||
      message.tape.poses.length !== message.tape.ticks * FLIES * 7 || message.tape.active.length !== message.tape.ticks)
    throw Error("Invalid or duplicate baseline pose tape");
  tape = message.tape;
  elapsed = new Float64Array(tape.ticks);
  const began = performance.now();
  world = await createRetinaWorld(message.definition);
  capture = new RetinaCapture(world.scene);
  const gl = capture.renderer.getContext(), extension = gl.getExtension("WEBGL_debug_renderer_info");
  if (extension) gpu = gl.getParameter(extension.UNMASKED_RENDERER_WEBGL);
  if (gpu === "unknown" || /SwiftShader|llvmpipe|software/i.test(gpu)) throw Error(`Hardware GPU required: ${gpu}`);
  initializationMs = performance.now() - began;
}
/** The patch invokes this immediately before the original, unchanged core.step(). */
export async function beforeBaselineStep() {
  if (!capture || tick >= tape.ticks) throw Error("Capture step exceeds the baseline tape");
  const poses: RetinalPose[] = [];
  for (let id = 0; id < FLIES; id++) if (tape.active[tick] & (1 << id)) {
    const offset = (tick * FLIES + id) * 7;
    poses.push({ position: [tape.poses[offset], tape.poses[offset+1], tape.poses[offset+2]], rotation: [tape.poses[offset+3], tape.poses[offset+4], tape.poses[offset+5], tape.poses[offset+6]] });
  }
  const began = performance.now();
  if (poses.length) {
    const frame = await capture.acquire(poses);
    rgbBytes += frame.samples.byteLength;
    activeFlyTicks += poses.length;
    captureCalls++;
    lastMetrics = frame.metrics;
  }
  elapsed[tick++] = performance.now() - began;
}
export function captureControlReport() {
  const sorted = Array.from(elapsed.subarray(0, tick)).sort((a, b) => a - b);
  const report = { tick, captureCalls, activeFlyTicks, rgbBytes, initializationMs, gpu, sceneId: world.sceneId,
    captureAwaitMs: sorted.reduce((a, b) => a + b, 0), p50Ms: sorted[Math.floor(sorted.length * .5)],
    p95Ms: sorted[Math.max(0, Math.ceil(sorted.length * .95) - 1)], worstMs: sorted.at(-1), lastMetrics,
    tapeBytes: tape.poses.byteLength + tape.active.byteLength };
  capture.dispose(); world.dispose();
  return report;
}
