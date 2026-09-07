import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as THREE from "three";
import { ConvexGeometry } from "three/addons/geometries/ConvexGeometry.js";
import { loadFlyModel } from "../../../packages/game-renderer/src/fly-model";
import { FlyMotion } from "../../../packages/game-renderer/src/fly-motion";

// Finite animation samples are a provisional envelope, not a continuous guarantee.
const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error("Usage: bun apps/asset-lab/scripts/export-fly-contact.ts input.glb output.json");
const bytes = await readFile(input);
const model = await loadFlyModel(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const motion = new FlyMotion(model.root, model.clips);
const envelope: THREE.Vector3[] = [];
for (const clip of model.clips) {
  for (let phase = 0; phase <= 100; phase++) {
    motion.sample({ clip: clip.name as "Walk" | "Fly" | "Land" | "Feed", seconds: clip.duration * phase / 100 });
    model.root.updateMatrixWorld(true);
    model.root.traverse(o => { if (o instanceof THREE.SkinnedMesh) o.skeleton.update(); });
    const points: THREE.Vector3[] = [];
    model.root.traverse(o => {
      if (!(o instanceof THREE.Mesh)) return;
      for (let i = 0; i < o.geometry.attributes.position.count; i++)
        points.push(o.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(o.matrixWorld));
    });
    const hull = new ConvexGeometry(points);
    const positions = hull.attributes.position;
    for (let i = 0; i < positions.count; i++) envelope.push(new THREE.Vector3().fromBufferAttribute(positions, i));
    hull.dispose();
  }
}
const hull = new ConvexGeometry(envelope);
const vertices: number[][] = [], seen = new Set<string>();
const positions = hull.attributes.position;
for (let i = 0; i < positions.count; i++) {
  const vertex = new THREE.Vector3().fromBufferAttribute(positions, i).toArray();
  const key = vertex.join(",");
  if (!seen.has(key)) { seen.add(key); vertices.push(vertex); }
}
await writeFile(output, JSON.stringify({
  assetSha256: createHash("sha256").update(bytes).digest("hex"), vertices,
}) + "\n");
console.log(JSON.stringify({ input, output, vertices: vertices.length }));
hull.dispose(); motion.dispose(); model.dispose();
