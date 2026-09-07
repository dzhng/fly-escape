import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { loadFlyModel } from "../src/fly-model";
import { FlyMotion } from "../src/fly-motion";
const [output = "/tmp/fly-envelope.json"] = process.argv.slice(2);
const bytes = await readFile("assets/fly/fly.glb");
const model = await loadFlyModel(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
);
const scale = 0.003 / 0.24124998398198225;
model.root.scale.setScalar(scale);
const motion = new FlyMotion(model.root, model.clips);
const rows = [];
for (const clip of model.clips) {
  for (let phase = 0; phase <= 100; phase++) {
    const seconds = (clip.duration * phase) / 100;
    motion.sample({ clip: clip.name as "Walk" | "Fly" | "Land" | "Feed", seconds });
    model.root.updateMatrixWorld(true);
    model.root.traverse((o) => {
      if (o instanceof THREE.SkinnedMesh) o.skeleton.update();
    });
    const min = new THREE.Vector3(Infinity, Infinity, Infinity),
      max = new THREE.Vector3(-Infinity, -Infinity, -Infinity);
    let radius = 0,
      vertices = 0;
    const antennae = [];
    model.root.traverse((o) => {
      if (!(o instanceof THREE.Mesh)) return;
      const partBounds = new THREE.Box3();
      const count = o.geometry.attributes.position.count;
      for (let i = 0; i < count; i++) {
        const p = o.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(o.matrixWorld);
        min.min(p);
        max.max(p);
        radius = Math.max(radius, Math.hypot(p.x, p.z));
        vertices++;
        partBounds.expandByPoint(p);
      }
      if (/antenna/i.test(o.name))
        antennae.push({
          name: o.name,
          centre: partBounds.getCenter(new THREE.Vector3()).toArray(),
        });
    });
    rows.push({
      clip: clip.name,
      phase: phase / 100,
      seconds,
      min: min.toArray(),
      max: max.toArray(),
      radius,
      vertices,
      antennae,
    });
  }
}
const maximumSampledRadius = Math.max(...rows.map((r) => r.radius));
const restCornerRadius = Math.hypot(
  Math.max(Math.abs(model.bounds.min.x), Math.abs(model.bounds.max.x)) * scale,
  Math.max(Math.abs(model.bounds.min.z), Math.abs(model.bounds.max.z)) * scale,
);
const diagnosticRadius = Math.max(maximumSampledRadius * 1.1, restCornerRadius);
await writeFile(
  output,
  JSON.stringify(
    {
      assetSha256: createHash("sha256").update(bytes).digest("hex"),
      scale,
      bodyLengthMetres: 0.003,
      sampling:
        "101 absolute FlyMotion phases per clip; posed getVertexPosition then matrixWorld after skeleton update. Looping endpoint returns phase0 per production mapping. No extra flight height translation changes floor-plane radius.",
      maximumSampledRadius,
      restCornerRadius,
      diagnosticRadius,
      margin:
        "At least10% above finite sampled radius and no smaller than rest AABB corner radius; not a continuous animation bound or accepted collision choice",
      rows,
    },
    null,
    2,
  ) + "\n",
);
motion.dispose();
model.dispose();
console.log(
  JSON.stringify({
    maximumSampledRadius,
    restCornerRadius,
    diagnosticRadius,
    clips: model.clips.map((c) => ({ name: c.name, duration: c.duration })),
  }),
);
