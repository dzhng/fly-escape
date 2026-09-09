import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const output = process.env.SPAWN_EVIDENCE ?? "/tmp/fly-spawn-transport";
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.route("**/spawn-check", (r) =>
    r.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Spawn transport check</title>",
    }),
  );
  await page.goto(`${process.env.BRAIN_URL ?? "http://127.0.0.1:5173"}/spawn-check`);
  const root = `/@fs${fileURLToPath(new URL("../../packages/sim-client/src/", import.meta.url))}`;
  const rows = [];
  for (const seed of ["42", "42", "43"]) {
    rows.push(
      await page.evaluate(
        async ({ root, seed }) => {
          const { AttemptClient } = await import(`${root}attempt-client.ts`);
          const { FrameArchive } = await import(`${root}record.ts`);
          let info, archive;
          const client = new AttemptClient(() => {});
          try {
            const fixture = await client.setup({ type: "fixture" });
            fixture.level.durationTicks = 3;
            return await new Promise((resolve, reject) => {
              const timeout = setTimeout(
                () => reject(new Error("spawn attempt exceeded 120 seconds")),
                120000,
              );
              client.setReceiver((reply) => {
                try {
                  if (reply.type === "error") throw new Error(reply.message);
                  if (reply.type === "ready") {
                    info = reply.info;
                    archive = new FrameArchive(
                      info.spec,
                      info.recordLayout,
                      info.archiveBytes,
                      info.initialBodies,
                    );
                  }
                  if (reply.type === "frames") archive.append(reply.chunk);
                  if (reply.type === "complete") {
                    archive.motion(3);
                    clearTimeout(timeout);
                    resolve({
                      seed,
                      info,
                      zero: archive.frame(0),
                      rewound: archive.motion(0),
                      first: archive.frame(1),
                    });
                  }
                } catch (error) {
                  clearTimeout(timeout);
                  reject(error);
                }
              });
              client.start({
                attemptId: `spawn-${seed}`,
                rootSeed: seed,
                flyCount: 20,
                level: fixture.level,
                tuning: { ...fixture.tuning, cues: fixture.tuning.cues.filter(cue => cue.pathway !== "vision") },
                placements: [],
              });
            });
          } finally {
            client.dispose();
          }
        },
        { root, seed },
      ),
    );
  }
  assert.deepEqual(rows[0].info.initialBodies, rows[1].info.initialBodies);
  assert.notDeepEqual(rows[0].info.initialBodies, rows[2].info.initialBodies);
  for (const row of rows) {
    const bodies = row.info.initialBodies,
      area = row.info.level.spawn,
      radius = row.info.level.bodyConfig.bodyRadius;
    assert.equal(bodies.length, 20);
    assert.equal(bodies.filter((b) => b.mode === "flying").length, 10);
    assert.deepEqual(
      row.zero.flies.map((f) => f.body),
      bodies,
    );
    assert.deepEqual(
      row.first.flies.map((f) => f.inputPose),
      bodies.map((b) => b.pose),
    );
    assert.deepEqual(
      row.rewound.map((m) => m.mode),
      bodies.map((b) => b.mode),
    );
    for (const [i, b] of bodies.entries()) {
      assert.ok(b.pose.heading >= 0 && b.pose.heading < 2 * Math.PI);
      assert.ok(
        b.pose.position.x >= area.min.x &&
          b.pose.position.x <= area.max.x &&
          b.pose.position.z >= area.min.z &&
          b.pose.position.z <= area.max.z,
      );
      for (const a of bodies.slice(0, i))
        assert.ok(
          Math.hypot(a.pose.position.x - b.pose.position.x, a.pose.position.z - b.pose.position.z) >
            2 * radius,
        );
    }
  }
  assert.deepEqual(errors, []);
  await mkdir(output, { recursive: true });
  await writeFile(
    `${output}/report.json`,
    JSON.stringify(
      {
        scope:
          "Three 3-tick real Graph/WASM Worker transport checks, not campaign calibration or a performance gate",
        rows,
        errors,
      },
      null,
      2,
    ) + "\n",
  );
  console.log("Same-seed replay, changed-seed cluster, mixed modes and tick-zero transport pass.");
} finally {
  await browser.close();
}
