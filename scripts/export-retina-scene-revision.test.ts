import { expect, test } from "bun:test";
import { mkdtemp, mkdir, writeFile, rm, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { createSceneRevision, sceneRevisionPath } from "./export-retina-scene-revision";

test("scene provenance repeats exactly and follows newly imported asset and source changes", async () => {
  const root = await mkdtemp(join(tmpdir(), "retina-revision-"));
  try {
    await mkdir(join(root, "src"));
    await writeFile(join(root, "package.json"), "{}");
    await writeFile(join(root, "bun.lock"), "lock");
    await writeFile(join(root, "src/world.ts"), 'import asset from "./room.glb?url"; export { material } from "./material";');
    await writeFile(join(root, "src/material.ts"), 'export const material = "warm";');
    await writeFile(join(root, "src/room.glb"), new Uint8Array([0, 1, 2, 255]));
    const capture = () => createSceneRevision(root, ["src/world.ts"]);
    const first = await capture();
    await writeFile(join(root, "scoring.json"), '{"exitReward":999}');
    expect(await capture()).toEqual(first);
    expect(JSON.stringify(await capture())).toBe(JSON.stringify(first));
    await writeFile(join(root, "src/room.glb"), new Uint8Array([0, 2, 2, 255]));
    expect((await capture()).revision).not.toBe(first.revision);
    await writeFile(join(root, "src/room.glb"), new Uint8Array([0, 1, 2, 255]));
    expect(await capture()).toEqual(first);
    await writeFile(join(root, "src/material.ts"), 'export const material = "cool";');
    expect((await capture()).revision).not.toBe(first.revision);
    await writeFile(join(root, "src/material.ts"), 'export const material = "warm"; import "./new.json";');
    await writeFile(join(root, "src/new.json"), '{"size":2}');
    const added = await capture();
    expect(added.files.map(file => file.path)).toContain("src/new.json");
    await writeFile(join(root, "src/new.json"), '{"size":3}');
    expect((await capture()).revision).not.toBe(added.revision);
  } finally { await rm(root, { recursive: true, force: true }); }
});


test("literal URL/dynamic dependencies, type-only imports and cycles preserve a complete bounded graph", async () => {
  const root = await mkdtemp(join(tmpdir(), "retina-revision-"));
  try {
    await mkdir(join(root, dirname(sceneRevisionPath)), { recursive: true });
    await writeFile(join(root, "package.json"), "{}");
    await writeFile(join(root, "bun.lock"), "lock");
    await writeFile(join(root, "entry.ts"), `import type { Absent } from "./missing";
      import { type AlsoAbsent } from "./missing";
      export type { Missing } from "./missing";
      import revision from "./${sceneRevisionPath}";
      const url = new URL("./texture.bin", import.meta.url);
      export const load = () => import("./nested");`);
    await writeFile(join(root, "nested.ts"), 'import "./entry";');
    await writeFile(join(root, "texture.bin"), "texture");
    await writeFile(join(root, sceneRevisionPath), "old generated revision");
    const first = await createSceneRevision(root, ["entry.ts", "nested.ts"]);
    expect(first.files.map(file => file.path)).toEqual(["bun.lock", "entry.ts", "nested.ts", "package.json", "texture.bin"]);
    await writeFile(join(root, sceneRevisionPath), "new generated revision");
    expect(await createSceneRevision(root, ["nested.ts", "entry.ts"])).toEqual(first);
    await writeFile(join(root, "entry.ts"), 'const file = "./nested"; import(file);');
    await expect(createSceneRevision(root, ["entry.ts"])).rejects.toThrow("Nonliteral dynamic import");
    await writeFile(join(root, "entry.ts"), 'import "./missing";');
    await expect(createSceneRevision(root, ["entry.ts"])).rejects.toThrow("Missing scene dependency");
  } finally { await rm(root, { recursive: true, force: true }); }
});

test("checked-in provenance regenerates exactly from the physical renderer and its assets", async () => {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const expected = JSON.parse(await readFile(join(root, sceneRevisionPath), "utf8"));
  expect(await createSceneRevision(root)).toEqual(expected);
});
