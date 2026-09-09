// Preparatory profile snapshot; no WebGL context, capture, or graph publication.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const [sourceRoot, output] = process.argv.slice(2);
assert(sourceRoot && output, "usage: bun export-profile.mjs SOURCE_ROOT OUTPUT.json");
const files = ["retina-projection.ts", "retina-eye-rig.ts", "retina-capture.ts", "retina-pooling.ts"];
const paths = files.map(name => resolve(sourceRoot, "packages/game-renderer/src", name));
const bytes = await Promise.all(paths.map(path => readFile(path)));
const sha256 = bytes => createHash("sha256").update(bytes).digest("hex");
const { RetinaProjection, retinaProfile } = await import(pathToFileURL(paths[0]).href);
const { retinalEyeRig } = await import(pathToFileURL(paths[1]).href);
// The provisional capture owner has not exported its camera constants yet. Read its
// literal numeric constructor, rejecting new expressions rather than guessing optics.
const constructor = bytes[2].toString().match(/new THREE\.PerspectiveCamera\(([^)]+)\)/);
assert(constructor, "capture camera constants unavailable");
const camera = constructor[1].split(",").map(term => {
  const parts = term.trim().split("/").map(part => Number(part.trim()));
  assert(parts.length <= 2 && parts.every(Number.isFinite), "camera uses nonliteral constants");
  return parts.length === 1 ? parts[0] : parts[0] / parts[1];
});
assert(camera.length === 4 && camera.every(Number.isFinite), "invalid camera projection");
const projection = new RetinaProjection(retinaProfile);
const { width, height, radius, distortion, zoom } = projection.profile;
const semantic = {
  opticalModelVersion: "provisional-retina-gpu-f32-pooling-v1",
  capture: { width, height, verticalFovDegrees: camera[0], aspect: camera[1], nearMetres: camera[2], farMetres: camera[3], distortion, zoom },
  layout: { radius, cells: projection.cells },
  eyeOrder: ["L", "R"], rgbOrder: ["R", "G", "B"], imageAxes: { x: "right", y: "down" },
  rigSha256: retinalEyeRig.rigSha256,
  photometry: { encoding: "linear-RGB8", exposure: 1, pooling: "GPU-float32-mean", quantization: "floor(255*clamp(mean,0,1)+0.5)", toneMapping: "none" },
};
const after = await Promise.all(paths.map(path => readFile(path)));
bytes.forEach((value, index) => assert(value.equals(after[index]), "source changed while exporting profile"));
await writeFile(output, JSON.stringify({
  status: "provisional; final optical profile and browser capture verification remain pending",
  semantic, rig: retinalEyeRig,
  rigCanonicalJson: JSON.stringify(Object.fromEntries(Object.entries(retinalEyeRig).filter(([key]) => key !== "rigSha256"))),
  provenance: { sourceSha256: Object.fromEntries(files.map((name, index) => [name, sha256(bytes[index])])),
    scope: "Projection/layout imported from the current owner; full slice03 rig supplies registration identity. This snapshot does not establish optical or browser capture correctness." },
}, null, 2) + "\n");
console.log(JSON.stringify({ samplesPerEye: projection.cells.length, rigSha256: semantic.rigSha256, output }));
