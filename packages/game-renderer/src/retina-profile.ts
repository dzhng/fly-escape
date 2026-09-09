import { RetinaProjection, retinaProfile, retinaCameraProjection } from "./retina-projection";
import { retinalEyeRig } from "./retina-eye-rig";

/** Shared by the offline map exporter and runtime binding check. */
export function retinalProfileSemantic() {
  const projection = new RetinaProjection(retinaProfile);
  const { width, height, radius, distortion, zoom } = projection.profile;
  return {
    opticalModelVersion: "provisional-retina-gpu-f32-pooling-v1",
    capture: { width, height, ...retinaCameraProjection, distortion, zoom },
    layout: { radius, cells: projection.cells },
    eyeOrder: ["L", "R"], rgbOrder: ["R", "G", "B"], imageAxes: { x: "right", y: "down" },
    rigSha256: retinalEyeRig.rigSha256,
    photometry: { encoding: "linear-RGB8", exposure: 1, pooling: "GPU-float32-mean", quantization: "floor(255*clamp(mean,0,1)+0.5)", toneMapping: "none" },
  };
}

function canonical(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(",")}]`;
  return `{${Object.entries(value).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)
    .map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
}

export function assertRetinalProfile(profile: unknown): void {
  if (canonical(profile) !== canonical(retinalProfileSemantic()))
    throw new Error("Retinal map does not match the installed optical profile");
}
