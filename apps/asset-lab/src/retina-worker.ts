import type { ToolDef } from "../../../packages/sim-client/src/generated/sim";
import { RetinaCapture, type RetinalPose } from "../../../packages/game-renderer/src/retina-capture";
import { RetinaProjection, retinaProfile, type RetinaProfile } from "../../../packages/game-renderer/src/retina-projection";
import { retinaFixtureScene } from "./retina-fixture";

export type CaptureCommand =
  | { type: "start"; profile?: RetinaProfile; doorwayBlocked?: boolean }
  | { type: "capture"; poses: RetinalPose[]; cameraImages?: boolean }
  | { type: "dispose" };
export type CaptureReady = { type: "ready"; profile: RetinaProfile; cells: number; gpu: string; initializationMs: number; catalog: ToolDef[] };
export type CaptureResult = { type: "captured"; cameraImages?: Uint8ClampedArray<ArrayBuffer>[] } & Awaited<ReturnType<RetinaCapture["acquire"]>>;
export type CaptureReply = CaptureReady | CaptureResult | { type: "disposed" } | { type: "error"; message: string };
let capture: RetinaCapture | undefined;
let disposeScene: (() => void) | undefined;
let generation = 0;

self.onmessage = async (event: MessageEvent<CaptureCommand>) => {
  const message = event.data;
  let ticket = generation;
  try {
    if (message.type === "dispose") {
      generation++;
      capture?.dispose();
      capture = undefined;
      disposeScene?.();
      disposeScene = undefined;
      self.postMessage({ type: "disposed" });
    } else if (message.type === "start") {
      new RetinaProjection(message.profile ?? retinaProfile);
      ticket = ++generation;
      capture?.dispose();
      disposeScene?.();
      capture = undefined;
      const began = performance.now();
      const fixture = await retinaFixtureScene(message.doorwayBlocked);
      if (ticket !== generation) { fixture.dispose(); return; }
      disposeScene = fixture.dispose;
      capture = new RetinaCapture(fixture.scene, message.profile ?? retinaProfile);
      self.postMessage({ type: "ready", profile: capture.projection.profile, cells: capture.projection.cells.length, gpu: capture.gpu, catalog: fixture.catalog, initializationMs: performance.now() - began });
    } else {
      if (!capture) throw new Error("Eye capture is not initialized");
      const result = await capture.acquire(message.poses, message.cameraImages);
      if (ticket !== generation) return;
      self.postMessage({ type: "captured", ...result }, [result.samples.buffer, ...(result.cameraImages?.map(image => image.buffer) ?? [])]);
    }
  } catch (error) {
    if (ticket !== generation) return;
    self.postMessage({ type: "error", message: String(error) });
  }
};
