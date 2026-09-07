import assert from "node:assert/strict";
import { readFile, mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { createHash } from "node:crypto";
import { chromium } from "playwright";

const [contentPath, nativePath, output] = process.argv.slice(2);
assert.ok(contentPath && nativePath && output, "usage: campaign-wasm.mjs CONTENT NATIVE_REPORT OUTPUT_DIR");
const contentText = await readFile(contentPath, "utf8");
const content = JSON.parse(contentText);
const native = JSON.parse(await readFile(nativePath, "utf8"));
const contentHash = createHash("sha256").update(contentText).digest("hex");
assert.equal(native.contentHash, contentHash);
assert.equal(content.frozen, true);
assert.equal(native.seedSet, "tuning");
assert.equal(native.pairs.length, 30);
assert.equal(native.acceptance.seedSetPassed, true);
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ channel: "chrome", headless: true });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.route("**/campaign-check", (route) => route.fulfill({
    contentType: "text/html", body: "<!doctype html><title>Campaign WASM transfer check</title>",
  }));
  await page.goto(`${process.env.BRAIN_URL ?? "http://127.0.0.1:5173"}/campaign-check`);
  const root = `/@fs${fileURLToPath(new URL("../../packages/sim-client/src/", import.meta.url))}`;
  const rows = [];
  for (const pair of native.pairs.slice(0, 3)) {
    assert.deepEqual(pair.conditions.map((c) => c.condition).sort(), ["no-fans", "poor", "reference"]);
    for (const condition of pair.conditions) {
      const input = { attemptId: condition.spec.attemptId, rootSeed: condition.spec.rootSeed,
        flyCount: 20, level: content.level, tuning: content.tuning, placements: condition.spec.placements };
      const row = await page.evaluate(async ({ root, input }) => {
        const { AttemptClient } = await import(`${root}attempt-client.ts`);
        return new Promise((resolve, reject) => {
          let info;
          let activeNeuralSteps = 0;
          let lastTick = 0;
          const timeout = setTimeout(() => { client.dispose(); reject(new Error("Attempt timed out")); }, 180000);
          const client = new AttemptClient((reply) => {
            if (reply.type === "ready") info = reply.info;
            if (reply.type === "frames") {
              activeNeuralSteps += reply.metrics.activeNeuralSteps;
              lastTick = reply.chunk.startTick + reply.chunk.tickCount - 1;
            }
            if (reply.type === "complete" || reply.type === "error") {
              clearTimeout(timeout);
              client.dispose();
              if (reply.type === "error") reject(new Error(reply.message));
              else resolve({ info, result: reply.result, activeNeuralSteps, lastTick });
            }
          });
          client.start(input);
        });
      }, { root, input });
      assert.equal(row.info.spec.graphHash, native.graphHash);
      assert.equal(row.info.spec.flyCount, 20);
      assert.ok(row.activeNeuralSteps > 0, "the attempt must perform actual neural updates");
      for (const key of ["levelHash", "tuningHash", "graphManifestHash", "placements"])
        assert.deepEqual(row.info.spec[key], condition.spec[key]);
      assert.equal(row.lastTick, content.level.durationTicks);
      assert.deepEqual(row.result, condition.result, "paired native/WASM outcomes differ; investigate before accepting content transfer");
      rows.push({ seed: pair.seed, condition: condition.condition, ...row });
      await writeFile(`${output}/report.json`, JSON.stringify({ contentHash, nativeBuildId: native.simulationBuildId,
        browser: browser.version(), rows, errors,
        scope: "Three tuning seeds in the actual WASM Worker with the frozen authored inputs. Outcome equality is observed for these pairs, not a promise of cross-platform bit identity or a production UI/performance gate." }, null, 2) + "\n");
      console.log(`${pair.seed} ${condition.condition}: ${row.result.outcomes.escaped}`);
    }
  }
  assert.deepEqual(errors, []);
} finally {
  await browser.close();
}
