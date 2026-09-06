import assert from "node:assert/strict";
import { mkdir, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";
const base = process.env.BRAIN_URL ?? "http://127.0.0.1:5173";
const browser = await chromium.launch({
  headless: true,
  channel: process.env.BROWSER_CHANNEL ?? "chrome",
});
const page = await browser.newPage();
page.on("console", (message) => console.log(message.text()));
try {
  // A blank harness avoids running an unrelated lab brain or renderer during the probe.
  await page.route("**/capacity-probe", (route) =>
    route.fulfill({ contentType: "text/html", body: "<title>Swarm capacity probe</title>" }),
  );
  await page.goto(`${base}/capacity-probe`);
  const result = await page.evaluate(
    async (root) => {
      const { AttemptClient } = await import(`${root}/attempt-client.ts`);
      const { FrameArchive } = await import(`${root}/record.ts`);
      const attempt = (id, count, horizon) =>
        new Promise((resolve, reject) => {
          let info,
            archive,
            activeNeuralSteps = 0,
            productionMs = 0,
            wasmBytes = 0;
          const started = performance.now();
          const client = new AttemptClient((reply) => {
            if (reply.type === "ready") {
              info = reply.info;
              wasmBytes = reply.wasmBytes;
              archive = new FrameArchive(info.spec, info.recordLayout, info.archiveBytes);
            } else if (reply.type === "frames") {
              archive.append(reply.chunk);
              activeNeuralSteps += reply.metrics.activeNeuralSteps;
              productionMs += reply.metrics.productionMs;
              wasmBytes = Math.max(wasmBytes, reply.metrics.wasmBytes);
              if (archive.computedTick % 100 === 0)
                console.log(`Capacity: ${archive.computedTick}/${horizon} ticks`);
            } else if (reply.type === "complete") {
              resolve({
                spec: info.spec,
                activeNeuralSteps,
                productionMs,
                elapsedMs: performance.now() - started,
                activeEquivalentRate: (activeNeuralSteps * 100) / (count * productionMs),
                wasmBytes,
                archiveOwnedBytes: archive.ownedBytes,
                archiveBoundBytes: info.archiveBytes,
                graphBytes: info.graphBytes,
                brainStateBytes: info.brainStateBytes,
                observedJSHeapBytes: performance.memory?.usedJSHeapSize ?? null,
                result: reply.result,
              });
              client.dispose();
            } else if (reply.type === "error") {
              client.dispose();
              reject(new Error(reply.message));
            }
          });
          client.startLab(id, "42", count, horizon);
        });
      let fullHorizonError = null;
      try {
        await attempt("capacity-full-horizon", 100, 6000);
      } catch (error) {
        fullHorizonError = error.message;
      }
      return { fullHorizonError, shortHorizon: await attempt("capacity-short-horizon", 100, 1000) };
    },
    "/@fs" + fileURLToPath(new URL("../../packages/sim-client/src", import.meta.url)),
  );
  assert.match(result.fullHorizonError ?? "", /archive/i);
  assert.equal(result.shortHorizon.activeNeuralSteps, 100000);
  assert.equal(result.shortHorizon.spec.flyCount, 100);
  assert.equal(result.shortHorizon.result.outcomes.timedOut, 100);
  assert.ok(result.shortHorizon.archiveOwnedBytes <= result.shortHorizon.archiveBoundBytes);
  const output = new URL("../../specs/help-the-fly-escape/assets/evidence/05/", import.meta.url);
  await mkdir(output, { recursive: true });
  await writeFile(
    new URL("browser-capacity.json", output),
    JSON.stringify({ browser: browser.version(), ...result }, null, 2) + "\n",
  );
  console.log(JSON.stringify(result, null, 2));
} finally {
  await browser.close();
}
