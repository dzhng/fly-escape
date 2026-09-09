import { useCallback, useEffect, useRef, type RefObject } from "react";
import { FlyPreviews, loadFlyModel, type FlyPose } from "@fly-escape/game-renderer";
import flyModelUrl from "../../../assets/fly/fly.glb?url";

export const PREVIEW_PIXELS = 92;
export type PreviewUpdate = (poses: readonly FlyPose[], cameraRotation: readonly [number, number, number, number]) => void;
let loading: Promise<ArrayBuffer> | undefined;
// Cache bytes, not GPU resources whose listeners would retain retired renderers.
export const loadFlyPreviewBytes = () => (loading ??= fetch(flyModelUrl).then(async response => {
  if (!response.ok) throw new Error(`Fly preview model request failed (${response.status})`);
  return response.arrayBuffer();
}).catch(cause => { loading = undefined; throw cause; }));

/** The world publishes its exact sampled poses after rendering, including while seeking. */
export function useFlyPreviews(update: RefObject<PreviewUpdate | null>) {
  const canvases = useRef(new Map<number, HTMLCanvasElement>());
  useEffect(() => {
    const owner = new FlyPreviews(PREVIEW_PIXELS);
    let live = true;
    let lastKey = "";
    void loadFlyPreviewBytes().then(loadFlyModel).then(model => {
      if (!live) { model.dispose(); return; }
      owner.setModel(model);
      update.current = (poses, cameraRotation) => {
        const key = JSON.stringify([cameraRotation, poses.map(p => [p.rotation, p.heading, p.animation, p.hidden])]);
        if (key === lastKey) return;
        lastKey = key;
        owner.paint([...canvases.current].map(([id, canvas]) => ({ canvas, pose: poses[id] })), cameraRotation);
      };
    }).catch(cause => console.warn("[Fly escape] fly previews unavailable", cause));
    return () => { live = false; update.current = null; owner.dispose(); };
  }, [update]);
  return useCallback((id: number, canvas: HTMLCanvasElement | null) => {
    if (canvas) canvases.current.set(id, canvas);
    else canvases.current.delete(id);
  }, []);
}
