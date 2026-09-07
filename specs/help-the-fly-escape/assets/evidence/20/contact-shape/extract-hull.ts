import { readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import * as THREE from "../../../../../../packages/game-renderer/node_modules/three/build/three.module.js";
import { ConvexGeometry } from "../../../../../../packages/game-renderer/node_modules/three/examples/jsm/geometries/ConvexGeometry.js";
import { loadFlyModel } from "../../../../../../packages/game-renderer/src/fly-model";
import { FlyMotion } from "../../../../../../packages/game-renderer/src/fly-motion";

const bytes = await readFile("assets/fly/fly.glb");
const model = await loadFlyModel(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
const motion = new FlyMotion(model.root, model.clips);
const envelope: THREE.Vector3[] = [];
let restingVertices: number[][] = [];
const phaseBounds: { clip: string; phase: number; min: number[]; max: number[] }[] = [];
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
    if (clip.name === "Walk" && phase === 0) restingVertices = points.map(p => p.toArray());
    const bounds = new THREE.Box3().setFromPoints(points);
    phaseBounds.push({ clip: clip.name, phase: phase / 100, min: bounds.min.toArray(), max: bounds.max.toArray() });
    const hull = new ConvexGeometry(points);
    const positions = hull.attributes.position;
    for (let i = 0; i < positions.count; i++) envelope.push(new THREE.Vector3().fromBufferAttribute(positions, i));
    hull.dispose();
  }
}
const hull = new ConvexGeometry(envelope);
const vertices: number[][] = [], indices: number[][] = [], seen = new Map<string, number>();
const positions = hull.attributes.position;
for (let i = 0; i < positions.count; i += 3) {
  const face: number[] = [];
  for (let j = 0; j < 3; j++) {
    const v = new THREE.Vector3().fromBufferAttribute(positions, i+j).toArray();
    const key = v.join(",");
    if (!seen.has(key)) { seen.set(key, vertices.length); vertices.push(v); }
    face.push(seen.get(key)!);
  }
  indices.push(face);
}
await writeFile(process.argv[2] ?? "/tmp/fly-contact-shape.json", JSON.stringify({ assetSha256: createHash("sha256").update(bytes).digest("hex"), sampling: "101 phases per clip; convex hull of posed native vertices; finite-sample candidate, not a continuous animation guarantee", vertices, indices, restingVertices, phaseBounds }, null, 2));
console.log(JSON.stringify({ vertices: vertices.length, faces: indices.length, minY: Math.min(...vertices.map(v => v[1])), maxY: Math.max(...vertices.map(v => v[1])) }));
hull.dispose(); motion.dispose(); model.dispose();
