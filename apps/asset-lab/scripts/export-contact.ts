/** Bake a static Blender GLB into the exact metre-space triangles queried by Rust. */
import { readFile, writeFile } from 'node:fs/promises';
import { contactGeometry } from '../../../packages/game-renderer/src/contact-geometry';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';

const [input, output] = process.argv.slice(2);
if (!input || !output) throw new Error('Usage: bun apps/asset-lab/scripts/export-contact.ts input.glb output.json');
const bytes = await readFile(input);
const gltf = await new GLTFLoader().parseAsync(
  bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '',
);
if (gltf.scenes.length !== 1 || gltf.animations.length)
  throw new Error('Contact assets require one static scene. Export only the active Blender scene.');
const { vertices, triangles } = contactGeometry(gltf.scene);
await writeFile(output, JSON.stringify({ id: 0, vertices, triangles }) + '\n');
console.log(JSON.stringify({ input, output, vertices: vertices.length, triangles: triangles.length }));
